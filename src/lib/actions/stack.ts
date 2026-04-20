"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureProductComplete } from "@/lib/actions/ensure-product-complete";
import { revalidatePath } from "next/cache";

export type StackItemType = "medication" | "supplement" | "cosmetic";

export interface StackItem {
  id: number;
  itemType: StackItemType;
  medicationId: number | null;
  unmatchedName: string | null;
  resolvedName: string | null; // joined from medications when matched
  resolvedSlug: string | null;
  imageUrl: string | null;
  dosage: string | null;
  frequency: string | null;
  timingNotes: string | null;
  startedAt: string | null;
  notes: string | null;
  source: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AddStackItemInput {
  name: string;
  itemType: StackItemType;
  dosage?: string;
  frequency?: string;
  timingNotes?: string;
  startedAt?: string;
  notes?: string;
  source?: string; // 'manual' | 'photo_ocr' | 'rx_label' | 'consult_extraction'
  sourceAttachmentUrl?: string;
}

// Add a stack item. Tries to match an existing approved medication by
// fuzzy slug; if missing and the name looks valid, kicks off
// ensureProductComplete in the background so the unmatched fallback
// is resolved within ~30s.
export async function addStackItem(
  input: AddStackItemInput
): Promise<{ ok: boolean; item?: StackItem; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "Name required" };

  // 1. Try to resolve to an existing medication
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: matched } = await supabase
    .from("medications")
    .select("id, slug, name, image_url")
    .or(`slug.eq.${slug},name.ilike.${trimmed}`)
    .eq("approval_status", "approved")
    .limit(1)
    .maybeSingle();

  // 2. Insert
  const { data: inserted, error } = await supabase
    .from("user_stack")
    .insert({
      user_id: user.id,
      item_type: input.itemType,
      medication_id: matched?.id ?? null,
      unmatched_name: matched ? null : trimmed,
      dosage: input.dosage ?? null,
      frequency: input.frequency ?? null,
      timing_notes: input.timingNotes ?? null,
      started_at: input.startedAt ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      source_attachment_url: input.sourceAttachmentUrl ?? null,
    })
    .select("*")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message ?? "Insert failed" };

  // 3. If unmatched, kick off product creation in the background.
  //    Don't await — UI gets the item immediately, ensureProductComplete
  //    backfills medication_id on its next call.
  if (!matched) {
    void ensureProductComplete({
      name: trimmed,
      productType: input.itemType === "cosmetic" ? "cosmetic" : "supplement",
    }).then(async (ensured) => {
      if (!ensured) return;
      const admin = await createClient();
      await admin
        .from("user_stack")
        .update({ medication_id: ensured.id, unmatched_name: null })
        .eq("id", inserted.id);
    }).catch(() => {
      // Failure is non-fatal; the item stays as unmatched_name.
    });
  }

  revalidatePath("/stack");
  return { ok: true, item: rowToItem(inserted, matched) };
}

export async function archiveStackItem(
  id: number,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_stack")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      archive_reason: reason ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stack");
  return { ok: true };
}

export async function updateStackItem(
  id: number,
  updates: Partial<
    Pick<
      AddStackItemInput,
      "dosage" | "frequency" | "timingNotes" | "startedAt" | "notes"
    >
  >
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const patch: Record<string, unknown> = {};
  if (updates.dosage !== undefined) patch.dosage = updates.dosage;
  if (updates.frequency !== undefined) patch.frequency = updates.frequency;
  if (updates.timingNotes !== undefined) patch.timing_notes = updates.timingNotes;
  if (updates.startedAt !== undefined) patch.started_at = updates.startedAt;
  if (updates.notes !== undefined) patch.notes = updates.notes;

  const { error } = await supabase
    .from("user_stack")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stack");
  return { ok: true };
}

export async function listMyStack(): Promise<StackItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_stack")
    .select(
      `
      id, item_type, medication_id, unmatched_name,
      dosage, frequency, timing_notes, started_at, notes,
      source, is_active, created_at,
      medications!user_stack_medication_id_fkey ( name, slug, image_url )
      `
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((row) => {
    const med = (row.medications as { name?: string; slug?: string; image_url?: string | null } | null) ?? null;
    return rowToItem(row, med);
  });
}

function rowToItem(
  row: Record<string, unknown>,
  matched: { name?: string; slug?: string; image_url?: string | null } | null
): StackItem {
  return {
    id: row.id as number,
    itemType: row.item_type as StackItemType,
    medicationId: (row.medication_id as number | null) ?? null,
    unmatchedName: (row.unmatched_name as string | null) ?? null,
    resolvedName: matched?.name ?? null,
    resolvedSlug: matched?.slug ?? null,
    imageUrl: matched?.image_url ?? null,
    dosage: (row.dosage as string | null) ?? null,
    frequency: (row.frequency as string | null) ?? null,
    timingNotes: (row.timing_notes as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
  };
}
