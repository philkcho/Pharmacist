"use server";

/**
 * Worker — turn a pending consult into an AI-drafted one ready for
 * pharmacist review. Called fire-and-forget right after submitConsult,
 * and also by a cron reaper that picks up any stuck pending rows.
 *
 * Idempotent: only acts on rows in 'pending' or 'ai_drafting' state.
 * Guards against double-processing by transitioning to 'ai_drafting'
 * before the LLM call.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { draftConsult, type DraftConsultResult } from "@/lib/ai/draft-consult";
import type { ConsultRawInput } from "@/lib/actions/consults";

interface ProcessResult {
  ok: boolean;
  consultId: string;
  status?: string;
  error?: string;
}

export async function processConsultDraft(
  consultId: string
): Promise<ProcessResult> {
  const admin = createAdminClient();

  // 1. Claim the row (atomic state transition)
  const { data: row, error: fetchError } = await admin
    .from("consults")
    .update({ status: "ai_drafting" })
    .eq("id", consultId)
    .in("status", ["pending"])
    .select("*")
    .maybeSingle();

  if (fetchError) return { ok: false, consultId, error: fetchError.message };
  if (!row) {
    // Already claimed by another worker, or terminal state. Not an error.
    return { ok: true, consultId, status: "skipped" };
  }

  try {
    // 2. Run AI draft pipeline
    const result: DraftConsultResult = await draftConsult({
      rawInput: row.raw_input_jsonb as ConsultRawInput,
      stackSnapshot: row.stack_snapshot,
      profileSnapshot: row.profile_snapshot,
    });

    // 3. Persist result
    const update: Record<string, unknown> = {
      ai_draft_jsonb: result.draft,
      ai_references_jsonb: result.references,
      ai_recommendations_jsonb: result.recommendations,
      ai_completed_at: new Date().toISOString(),
      ai_model: result.model,
      category: result.category,
      is_high_risk: result.isHighRisk,
      priority: result.isEmergency ? 100 : result.isHighRisk ? 10 : 0,
      status: "ready_for_review",
    };

    const { error: updateError } = await admin
      .from("consults")
      .update(update)
      .eq("id", consultId);

    if (updateError) {
      await admin
        .from("consults")
        .update({
          status: "pending",
          archive_reason: `draft persist failed: ${updateError.message}`,
        })
        .eq("id", consultId);
      return { ok: false, consultId, error: updateError.message };
    }

    return { ok: true, consultId, status: "ready_for_review" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Reset to pending so a retry can pick it up
    await admin
      .from("consults")
      .update({
        status: "pending",
        archive_reason: `ai draft failed: ${message.slice(0, 200)}`,
      })
      .eq("id", consultId);
    return { ok: false, consultId, error: message };
  }
}

// Cron-friendly batch processor — picks up stuck or new rows.
// Used by /api/cron/consult-drafts (TODO).
export async function processPendingConsults(
  limit = 5
): Promise<{ processed: number; results: ProcessResult[] }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("consults")
    .select("id")
    .eq("status", "pending")
    .order("created_at")
    .limit(limit);

  if (!data || data.length === 0) {
    return { processed: 0, results: [] };
  }

  const results: ProcessResult[] = [];
  for (const row of data) {
    const result = await processConsultDraft(row.id as string);
    results.push(result);
  }

  return { processed: results.length, results };
}
