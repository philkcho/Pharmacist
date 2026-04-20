"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SavedItemType =
  | "medication"
  | "article"
  | "expert_pick"
  | "trend"
  | "consult"
  | "qa";

export interface SavedItem {
  id: number;
  itemType: SavedItemType;
  itemId: string;
  notes: string | null;
  createdAt: string;
}

export async function saveItem(
  itemType: SavedItemType,
  itemId: string,
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("user_saved_items").upsert(
    {
      user_id: user.id,
      item_type: itemType,
      item_id: itemId,
      notes: notes ?? null,
    },
    { onConflict: "user_id,item_type,item_id" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/saved");
  return { ok: true };
}

export async function unsaveItem(
  itemType: SavedItemType,
  itemId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_saved_items")
    .delete()
    .eq("user_id", user.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/saved");
  return { ok: true };
}

export async function isSaved(
  itemType: SavedItemType,
  itemId: string
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_saved_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();

  return data !== null;
}

export async function listSavedItems(
  itemType?: SavedItemType
): Promise<SavedItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("user_saved_items")
    .select("id, item_type, item_id, notes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (itemType) query = query.eq("item_type", itemType);

  const { data } = await query;
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as number,
    itemType: row.item_type as SavedItemType,
    itemId: row.item_id as string,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

// Bulk-import saved items from anonymous localStorage on first sign-in.
// Idempotent: existing rows are skipped via the unique constraint.
export async function syncLocalSavedItems(
  items: { itemType: SavedItemType; itemId: string; notes?: string }[]
): Promise<{ ok: boolean; imported: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, imported: 0, error: "Not signed in" };
  if (items.length === 0) return { ok: true, imported: 0 };

  const rows = items.map((it) => ({
    user_id: user.id,
    item_type: it.itemType,
    item_id: it.itemId,
    notes: it.notes ?? null,
  }));

  const { error, count } = await supabase
    .from("user_saved_items")
    .upsert(rows, {
      onConflict: "user_id,item_type,item_id",
      ignoreDuplicates: true,
      count: "exact",
    });

  if (error) return { ok: false, imported: 0, error: error.message };

  revalidatePath("/saved");
  return { ok: true, imported: count ?? rows.length };
}
