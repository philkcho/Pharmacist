"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { getOrFetchMedication } from "@/lib/actions/medications";

/**
 * Public result shape returned from the Product Lookup widget.
 * Distinguishes between pharmacist-reviewed records (full trust),
 * FDA-only synced records (medium trust, no pharmacist review yet),
 * AI-generated analysis (low trust, clearly labeled), and misses
 * (no data available at all).
 */
export type LookupResultType =
  | "pharmacist_reviewed"
  | "fda_only"
  | "ai_generated"
  | "miss";

export interface LookupResultSuccess {
  type: "pharmacist_reviewed" | "fda_only";
  lookupId: number | null;
  medication: {
    id: number;
    name: string;
    slug: string;
    genericName: string | null;
    brandNames: string[];
    description: string | null;
    activeIngredients: string[];
    dosageForms: string[];
    warnings: string | null;
    sideEffects: string | null;
    isOtc: boolean;
    source: string;
    fdaSplId: string | null;
    lastSyncedAt: string | null;
  };
}

export interface LookupResultMiss {
  type: "miss";
  lookupId: number | null;
  query: string;
  message: string;
}

/**
 * Gemini-generated analysis used as a fallback when DB + openFDA both
 * miss. This is NEVER cached, NEVER written to medications, and MUST
 * render with a prominent "not yet reviewed" warning banner on the
 * client. See section 14.5 of docs/compare-feature.md.
 */
export interface AiAnalysis {
  productName: string;
  isLikelyOtc: boolean;
  summary: string;
  commonUses: string[];
  activeIngredients: string[];
  keyWarnings: string[];
  confidence: "high" | "medium" | "low";
  suggestedSources: Array<{
    title: string;
    url: string;
    type:
      | "fda_label"
      | "pubmed"
      | "cdc"
      | "who"
      | "nih_ods"
      | "nih_medlineplus"
      | "other_authoritative";
  }>;
}

export interface LookupResultAiGenerated {
  type: "ai_generated";
  lookupId: number | null;
  query: string;
  analysis: AiAnalysis;
}

export type LookupResult =
  | LookupResultSuccess
  | LookupResultAiGenerated
  | LookupResultMiss;

/**
 * Log a lookup attempt to product_lookups. Failures are swallowed —
 * analytics logging must never break the user-facing lookup flow.
 * Returns the inserted row id so the client can attach a review
 * request back to the same lookup.
 */
async function logLookupAttempt(params: {
  queryText: string;
  resultType: LookupResultType;
  matchedMedicationId: number | null;
}): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_lookups")
      .insert({
        query_text: params.queryText,
        result_type: params.resultType,
        matched_medication_id: params.matchedMedicationId,
      })
      .select("id")
      .single<{ id: number }>();
    if (error) {
      console.warn("[lookup] log insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn("[lookup] log threw:", err);
    return null;
  }
}

/**
 * Zod schema matching the `AiAnalysis` interface. Used by Gemini's
 * `generateObject` to enforce structured output.
 */
const AiAnalysisSchema = z.object({
  productName: z
    .string()
    .describe("Standardized product name, corrected if the input has typos"),
  isLikelyOtc: z
    .boolean()
    .describe(
      "Is this likely an over-the-counter medication, supplement, or cosmetic product?"
    ),
  summary: z
    .string()
    .describe(
      "Plain English consumer description, 2-3 sentences. Avoid clinical jargon."
    ),
  commonUses: z
    .array(z.string())
    .describe("3-5 common reasons consumers use this product"),
  activeIngredients: z
    .array(z.string())
    .describe(
      "Active ingredients you are confident about. Return an empty array if uncertain."
    ),
  keyWarnings: z
    .array(z.string())
    .describe(
      "3-5 consumer-facing warnings, drug interactions, or contraindications"
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "Your confidence in this analysis. Use 'low' for unfamiliar or ambiguous products."
    ),
  suggestedSources: z
    .array(
      z.object({
        title: z.string().describe("Source title"),
        url: z
          .string()
          .describe("Real URL to an authoritative institution page"),
        type: z.enum([
          "fda_label",
          "pubmed",
          "cdc",
          "who",
          "nih_ods",
          "nih_medlineplus",
          "other_authoritative",
        ]),
      })
    )
    .describe("3-5 authoritative source suggestions for verification"),
});

/**
 * Ask Gemini for a consumer-friendly analysis of an unknown product.
 * Only called when the DB + openFDA pipeline returns nothing. Never
 * cached, never written to `medications`. Returns null on any error
 * so the caller can gracefully fall back to a plain "miss" result.
 */
async function generateAiAnalysis(query: string): Promise<AiAnalysis | null> {
  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-pro"),
      maxRetries: 0,
      schema: AiAnalysisSchema,
      system: `You are a licensed pharmacist (PharmD) helping a consumer understand an OTC product they searched for. A human pharmacist will review your analysis before it is ever published on the site, but users may see a draft version in the meantime — so be honest and conservative.

Critical rules:
- Target an 8th-grade reading level. No clinical jargon.
- Frame information around practical consumer questions.
- Never fabricate PubMed IDs, DOIs, or FDA document numbers.
- Suggested source URLs must be REAL pages from authoritative institutions
  (FDA DailyMed, PubMed, CDC, NIH ODS, NIH MedlinePlus, WHO). If you are
  unsure of a specific study URL, use the institution's search page
  (e.g. https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=...).
- If the product is not a known OTC medication/supplement/skincare item,
  set confidence to "low" and say so in the summary.
- Do not recommend prescription medications.`,
      prompt: `The consumer searched for: "${query}"

Return a structured analysis. Be honest about confidence — a pharmacist will double-check every claim before it is shown to anyone.`,
    });
    return object as AiAnalysis;
  } catch (err) {
    console.warn("[lookup] AI fallback failed:", err);
    return null;
  }
}

/**
 * Narrow the loose jsonb active_ingredients field into a string array
 * suitable for the client. Handles the legacy shapes:
 *   - string[] (what FDA cache writes)
 *   - [{ name, amount }, ...] (potential future admin format)
 *   - null / anything else → []
 */
function normalizeActiveIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): string | null => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }
      return null;
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

/**
 * Look up an OTC product by name, generic name, or brand.
 *
 * Pipeline:
 *   1. DB lookup (pharmacist-reviewed + FDA cache) via getOrFetchMedication
 *   2. Fallback to openFDA (same helper handles it + caches the result
 *      when the caller has write permission)
 *   3. Classify the result by review status and return a UI-safe shape
 *
 * Intentionally NOT rate-limited in this MVP. Rate limiting + anonymous
 * session tracking land in Sprint 2b along with the `product_lookups`
 * audit table.
 */
export async function lookupProduct(query: string): Promise<LookupResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      type: "miss",
      lookupId: null,
      query: "",
      message: "Please enter a product name.",
    };
  }

  // Normalize for logging so "Tylenol", " tylenol ", and "TYLENOL" all
  // land in the same analytics bucket.
  const normalized = trimmed.toLowerCase();

  const row = await getOrFetchMedication(trimmed);

  if (!row) {
    // Always log the DB/FDA miss for analytics, regardless of whether
    // AI fallback succeeds afterward. Curation priority = raw miss rate.
    const lookupId = await logLookupAttempt({
      queryText: normalized,
      resultType: "miss",
      matchedMedicationId: null,
    });

    // Try an AI fallback so the user sees something rather than a dead end.
    // This is clearly labeled as AI-generated on the client (see the
    // `LookupResultAiGenerated` rendering in product-lookup.tsx).
    const aiAnalysis = await generateAiAnalysis(trimmed);
    if (aiAnalysis) {
      return {
        type: "ai_generated",
        lookupId,
        query: trimmed,
        analysis: aiAnalysis,
      };
    }

    return {
      type: "miss",
      lookupId,
      query: trimmed,
      message:
        "No match found. We don't have this product in our database or the FDA label registry yet.",
    };
  }

  // A record is considered pharmacist-reviewed when a human has stamped it
  // via the compare feature review workflow. FDA-synced rows are trustworthy
  // for label data but haven't been curated yet.
  const isReviewed =
    row.source === "manual" ||
    // @ts-expect-error — reviewed_at comes from migration 003, not yet in
    // the CachedMedication interface. Safe to read — select * returns it.
    (row.reviewed_at !== null && row.reviewed_at !== undefined);

  const resultType: LookupResultType = isReviewed
    ? "pharmacist_reviewed"
    : "fda_only";

  const lookupId = await logLookupAttempt({
    queryText: normalized,
    resultType,
    matchedMedicationId: row.id,
  });

  return {
    type: resultType,
    lookupId,
    medication: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      genericName: row.generic_name,
      brandNames: row.brand_names ?? [],
      description: row.description,
      activeIngredients: normalizeActiveIngredients(row.active_ingredients),
      dosageForms: row.dosage_forms ?? [],
      warnings: row.warnings,
      sideEffects: row.side_effects,
      isOtc: row.is_otc,
      source: row.source,
      fdaSplId: row.fda_spl_id,
      lastSyncedAt: row.last_synced_at,
    },
  };
}

/**
 * Submit a "please review this product" request from the Lookup widget.
 * Requires a lookupId from a previous lookupProduct() call — this keeps
 * the review queue linked back to the exact query that couldn't be
 * answered, so pharmacists see what the user actually typed.
 *
 * Email and note are both optional. Duplicate protection is handled
 * at the application layer (upcoming); for MVP we allow any number
 * of submissions.
 */
export interface RequestReviewInput {
  lookupId: number;
  queryText: string;
  contactEmail?: string;
  requesterNote?: string;
}

export interface RequestReviewResult {
  ok: boolean;
  message: string;
}

function isValidEmail(email: string): boolean {
  // Deliberately permissive — we're not rejecting; we're just sanity-
  // checking so obvious garbage doesn't make it into the queue.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function requestPharmacistReview(
  input: RequestReviewInput
): Promise<RequestReviewResult> {
  if (!Number.isFinite(input.lookupId) || input.lookupId <= 0) {
    return { ok: false, message: "Missing lookup reference." };
  }
  const query = input.queryText.trim();
  if (!query) {
    return { ok: false, message: "Missing product name." };
  }

  const email = input.contactEmail?.trim();
  if (email && !isValidEmail(email)) {
    return {
      ok: false,
      message: "That email doesn't look right. Leave it blank if you prefer.",
    };
  }

  const note = input.requesterNote?.trim();
  if (note && note.length > 1000) {
    return { ok: false, message: "Note is too long (max 1000 characters)." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("lookup_review_requests").insert({
      product_lookup_id: input.lookupId,
      query_text: query,
      contact_email: email || null,
      requester_note: note || null,
    });

    if (error) {
      console.error("[lookup] review request insert failed:", error);
      return {
        ok: false,
        message: "Couldn't save your request. Please try again.",
      };
    }
  } catch (err) {
    console.error("[lookup] review request threw:", err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  return {
    ok: true,
    message:
      "Thanks! A pharmacist will review this product and we'll add it to the site.",
  };
}


// ============================================================
// Admin: review queue management
// ============================================================
// These server actions are only useful to pharmacist admins. RLS
// on `lookup_review_requests` blocks SELECT/UPDATE for anyone who
// isn't authenticated as a pharmacist, so unauthorized callers
// will just see an empty list or an error.

export type ReviewRequestStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "rejected";

export interface ReviewRequestRow {
  id: number;
  productLookupId: number;
  queryText: string;
  contactEmail: string | null;
  requesterNote: string | null;
  status: ReviewRequestStatus;
  assignedTo: string | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface ReviewRequestDbRow {
  id: number;
  product_lookup_id: number;
  query_text: string;
  contact_email: string | null;
  requester_note: string | null;
  status: ReviewRequestStatus;
  assigned_to: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function dbRowToReviewRequest(row: ReviewRequestDbRow): ReviewRequestRow {
  return {
    id: row.id,
    productLookupId: row.product_lookup_id,
    queryText: row.query_text,
    contactEmail: row.contact_email,
    requesterNote: row.requester_note,
    status: row.status,
    assignedTo: row.assigned_to,
    reviewerNote: row.reviewer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/**
 * Admin: list review requests, optionally filtered by status.
 * RLS enforces pharmacist-only access.
 */
export async function listReviewRequests(
  status?: ReviewRequestStatus
): Promise<ReviewRequestRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("lookup_review_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[lookup] listReviewRequests failed:", error);
    return [];
  }
  return (data as ReviewRequestDbRow[] | null)?.map(dbRowToReviewRequest) ?? [];
}

/**
 * Admin: count pending review requests. Used by the sidebar badge.
 */
export async function countPendingReviewRequests(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("lookup_review_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.warn("[lookup] countPendingReviewRequests failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Admin: update a review request's status (and optional internal note).
 * Setting status to "done" or "rejected" also stamps completed_at.
 */
export async function updateReviewRequestStatus(
  id: number,
  status: ReviewRequestStatus,
  reviewerNote?: string
): Promise<{ ok: boolean; message?: string }> {
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, message: "Invalid request id." };
  }
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status };
  if (reviewerNote !== undefined) patch.reviewer_note = reviewerNote;
  if (status === "done" || status === "rejected") {
    patch.completed_at = new Date().toISOString();
  } else {
    patch.completed_at = null;
  }

  const { error } = await supabase
    .from("lookup_review_requests")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("[lookup] updateReviewRequestStatus failed:", error);
    return { ok: false, message: error.message };
  }

  // Revalidate the admin review queue page so the list updates.
  revalidatePath("/review-requests");
  return { ok: true };
}
