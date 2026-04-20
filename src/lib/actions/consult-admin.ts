"use server";

/**
 * Pharmacist-side server actions for the consult review queue.
 *
 * All functions enforce the pharmacist role at the start; clients
 * never get a permission check failure to differentiate from "no rows."
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import { slugifyConsult } from "@/lib/consult-slug";
import type {
  ConsultRecord,
  ConsultStatus,
  ConsultCategory,
} from "@/lib/actions/consults";

async function assertPharmacist(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "pharmacist")
    .maybeSingle();
  if (!data) throw new Error("Pharmacist role required");
  return user.id;
}

export interface QueueCounts {
  pending: number;
  ai_drafting: number;
  ready_for_review: number;
  in_review: number;
  needs_more_info: number;
  approved_today: number;
}

export async function getConsultQueueCounts(): Promise<QueueCounts> {
  await assertPharmacist();
  const admin = createAdminClient();

  const todayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const queries = await Promise.all([
    admin.from("consults").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("consults").select("id", { count: "exact", head: true }).eq("status", "ai_drafting"),
    admin.from("consults").select("id", { count: "exact", head: true }).eq("status", "ready_for_review"),
    admin.from("consults").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    admin.from("consults").select("id", { count: "exact", head: true }).eq("status", "needs_more_info"),
    admin
      .from("consults")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("reviewed_at", todayIso),
  ]);

  return {
    pending: queries[0].count ?? 0,
    ai_drafting: queries[1].count ?? 0,
    ready_for_review: queries[2].count ?? 0,
    in_review: queries[3].count ?? 0,
    needs_more_info: queries[4].count ?? 0,
    approved_today: queries[5].count ?? 0,
  };
}

export async function listQueueByStatus(
  status: ConsultStatus,
  limit = 50
): Promise<ConsultRecord[]> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { data } = await admin
    .from("consults")
    .select("*")
    .eq("status", status)
    .order("priority", { ascending: false })
    .order("created_at")
    .limit(limit);

  return (data ?? []).map((row) => rowToRecord(row));
}

export async function getConsultForReview(
  id: string
): Promise<ConsultRecord | null> {
  await assertPharmacist();
  const admin = createAdminClient();
  const { data } = await admin
    .from("consults")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToRecord(data) : null;
}

// Approve as-is — uses the existing AI draft as the final answer.
export async function approveAsIs(
  consultId: string,
  timeSpentSeconds?: number
): Promise<{ ok: boolean; error?: string }> {
  const pharmacistAuthId = await assertPharmacist();
  const admin = createAdminClient();

  // Find the pharmacist_profile that maps to this auth user.
  const { data: profile } = await admin
    .from("pharmacist_profiles")
    .select("id")
    .eq("id", pharmacistAuthId)
    .maybeSingle();

  const { data: row } = await admin
    .from("consults")
    .select("ai_draft_jsonb, visibility, slug")
    .eq("id", consultId)
    .maybeSingle();
  if (!row?.ai_draft_jsonb) {
    return { ok: false, error: "No AI draft to approve" };
  }

  const patch = buildApprovePatch({
    finalAnswer: row.ai_draft_jsonb as ConsultDraft,
    editSummary: "Approved as-is",
    pharmacistProfileId: profile?.id ?? null,
    timeSpentSeconds,
    consultId,
    intendedVisibility: row.visibility as string,
    existingSlug: (row.slug as string | null) ?? null,
  });

  const { error } = await admin
    .from("consults")
    .update(patch)
    .eq("id", consultId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/consult-queue");
  revalidatePath(`/consult`);
  if (patch.visibility === "public") {
    revalidatePath("/ask");
    if (patch.slug) revalidatePath(`/ask/${patch.slug}`);
  }
  return { ok: true };
}

export async function approveWithEdits(
  consultId: string,
  finalAnswer: ConsultDraft,
  editSummary: string,
  timeSpentSeconds?: number
): Promise<{ ok: boolean; error?: string }> {
  const pharmacistAuthId = await assertPharmacist();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("pharmacist_profiles")
    .select("id")
    .eq("id", pharmacistAuthId)
    .maybeSingle();

  const { data: row } = await admin
    .from("consults")
    .select("visibility, slug")
    .eq("id", consultId)
    .maybeSingle();

  const patch = buildApprovePatch({
    finalAnswer,
    editSummary,
    pharmacistProfileId: profile?.id ?? null,
    timeSpentSeconds,
    consultId,
    intendedVisibility: (row?.visibility as string | undefined) ?? "private",
    existingSlug: (row?.slug as string | null | undefined) ?? null,
  });

  const { error } = await admin
    .from("consults")
    .update(patch)
    .eq("id", consultId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/consult-queue");
  revalidatePath(`/consult`);
  if (patch.visibility === "public") {
    revalidatePath("/ask");
    if (patch.slug) revalidatePath(`/ask/${patch.slug}`);
  }
  return { ok: true };
}

// Shared helper: builds the DB patch for approve actions, auto-flipping
// visibility to 'public' (with slug + published_at) when the user had
// opted in at submission (visibility='pending_publish').
function buildApprovePatch(args: {
  finalAnswer: ConsultDraft;
  editSummary: string;
  pharmacistProfileId: string | null;
  timeSpentSeconds?: number;
  consultId: string;
  intendedVisibility: string;
  existingSlug: string | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    pharmacist_final_jsonb: args.finalAnswer,
    pharmacist_id: args.pharmacistProfileId,
    pharmacist_edit_summary: args.editSummary,
    pharmacist_time_seconds: args.timeSpentSeconds ?? null,
    reviewed_at: new Date().toISOString(),
    status: "approved",
  };

  if (args.intendedVisibility === "pending_publish") {
    patch.visibility = "public";
    patch.published_at = new Date().toISOString();
    patch.slug =
      args.existingSlug ?? slugifyConsult(args.finalAnswer.oneLineSummary, args.consultId);
  }

  return patch;
}

export async function requestMoreInfo(
  consultId: string,
  question: string
): Promise<{ ok: boolean; error?: string }> {
  const pharmacistAuthId = await assertPharmacist();
  const admin = createAdminClient();

  // 1. Add follow-up message
  const { error: insertError } = await admin
    .from("consult_followups")
    .insert({
      consult_id: consultId,
      role: "pharmacist",
      author_id: pharmacistAuthId,
      message: question,
    });
  if (insertError) return { ok: false, error: insertError.message };

  // 2. Update consult status
  const { error: updateError } = await admin
    .from("consults")
    .update({ status: "needs_more_info" })
    .eq("id", consultId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/admin/consult-queue");
  return { ok: true };
}

export async function rejectConsult(
  consultId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { error } = await admin
    .from("consults")
    .update({
      status: "rejected",
      archive_reason: reason,
      archived_at: new Date().toISOString(),
    })
    .eq("id", consultId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/consult-queue");
  return { ok: true };
}

// Permanently delete a single consult (and its follow-ups via FK
// cascade). Pharmacist-only. Used for spam, test rows, or
// pharmacist-discretion takedowns.
export async function deleteConsult(
  consultId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { error } = await admin.from("consults").delete().eq("id", consultId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/consult-queue");
  return { ok: true };
}

// Wipe ALL consults and their follow-ups. Pharmacist-only. Used for
// QA/testing — clears the queue completely so reproducing AI bugs
// doesn't get cluttered by stale rows. consult_followups rows are
// removed automatically via FK cascade.
export async function deleteAllConsults(): Promise<{
  ok: boolean;
  deleted: number;
  error?: string;
}> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { data: rows, error: countError } = await admin
    .from("consults")
    .select("id");
  if (countError) return { ok: false, deleted: 0, error: countError.message };

  const total = rows?.length ?? 0;
  if (total === 0) return { ok: true, deleted: 0 };

  // Supabase requires a filter on bulk delete. `not.is.null` matches
  // every row but satisfies the "must include filter" guard.
  const { error } = await admin
    .from("consults")
    .delete()
    .not("id", "is", null);

  if (error) return { ok: false, deleted: 0, error: error.message };

  revalidatePath("/consult-queue");
  return { ok: true, deleted: total };
}

function rowToRecord(row: Record<string, unknown>): ConsultRecord {
  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    status: row.status as ConsultStatus,
    visibility: row.visibility as ConsultRecord["visibility"],
    category: row.category as ConsultCategory,
    priority: (row.priority as number) ?? 0,
    isHighRisk: (row.is_high_risk as boolean) ?? false,
    rawInput: (row.raw_input_jsonb as ConsultRecord["rawInput"]) ?? {},
    inputTypes: (row.input_types as string[]) ?? [],
    profileSnapshot: row.profile_snapshot,
    stackSnapshot: row.stack_snapshot,
    aiDraft: row.ai_draft_jsonb,
    aiReferences: row.ai_references_jsonb,
    aiRecommendations: row.ai_recommendations_jsonb,
    aiCompletedAt: (row.ai_completed_at as string | null) ?? null,
    pharmacistFinal: row.pharmacist_final_jsonb,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    redactedInput: row.redacted_input_jsonb,
    redactedAnswer: row.redacted_answer_jsonb,
    viewCount: (row.view_count as number) ?? 0,
    helpfulCount: (row.helpful_count as number) ?? 0,
    affiliateClicks: (row.affiliate_clicks as number) ?? 0,
    createdAt: row.created_at as string,
  };
}
