"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { processConsultDraft } from "@/lib/actions/process-consult-draft";
import { slugifyConsult } from "@/lib/consult-slug";

export type ConsultStatus =
  | "pending"
  | "ai_drafting"
  | "ready_for_review"
  | "in_review"
  | "approved"
  | "needs_more_info"
  | "rejected"
  | "archived";

export type ConsultVisibility =
  | "private"
  | "pending_publish"
  | "public"
  | "archived";

export type ConsultCategory =
  | "drug_interactions"
  | "skin_care"
  | "supplements"
  | "symptoms"
  | "pregnancy"
  | "pediatric"
  | "mental_health"
  | "general";

export interface ConsultPhoto {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ConsultRawInput {
  text?: string;
  photos?: ConsultPhoto[];
  voiceUrl?: string;
  labPdfUrl?: string;
  symptoms?: string[];
  goal?: string;
}

export interface ConsultRecord {
  id: string;
  slug: string | null;
  userId: string | null;
  email: string | null;
  status: ConsultStatus;
  visibility: ConsultVisibility;
  category: ConsultCategory;
  priority: number;
  isHighRisk: boolean;
  rawInput: ConsultRawInput;
  inputTypes: string[];
  profileSnapshot: unknown;
  stackSnapshot: unknown;
  aiDraft: unknown;
  aiReferences: unknown;
  aiRecommendations: unknown;
  aiCompletedAt: string | null;
  pharmacistFinal: unknown;
  reviewedAt: string | null;
  publishedAt: string | null;
  redactedInput: unknown;
  redactedAnswer: unknown;
  viewCount: number;
  helpfulCount: number;
  affiliateClicks: number;
  createdAt: string;
}

export interface SubmitConsultInput {
  rawInput: ConsultRawInput;
  category?: ConsultCategory;
  email?: string; // required for anonymous submission
  includeStackSnapshot?: boolean;
  includeProfileSnapshot?: boolean;
  // When true, the consult is flagged (visibility='pending_publish') at
  // submission so the pharmacist's approval can auto-publish it to /ask
  // without requiring the user to come back and toggle it manually.
  shareByDefault?: boolean;
}


// Submit a new consult. The AI draft is triggered async (a separate
// worker reads `status = 'pending'` and processes the queue) so the
// caller gets an immediate row back.
export async function submitConsult(
  input: SubmitConsultInput
): Promise<{ ok: boolean; consultId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth required — anonymous submissions are no longer accepted.
  // Frontend gates the form behind login, this is the server-side enforcement.
  if (!user) {
    return {
      ok: false,
      error: "Please sign in to submit a consult",
    };
  }

  const inputTypes: string[] = [];
  if (input.rawInput.text) inputTypes.push("text");
  if (input.rawInput.photos?.length) inputTypes.push("photo");
  if (input.rawInput.voiceUrl) inputTypes.push("voice");
  if (input.rawInput.labPdfUrl) inputTypes.push("lab_pdf");
  if (input.rawInput.symptoms?.length) inputTypes.push("symptoms");

  // Snapshot user profile + stack at submission so the AI draft is
  // reproducible even if the user changes their stack later.
  let profileSnapshot: unknown = null;
  let stackSnapshot: unknown = null;
  if (user && input.includeProfileSnapshot !== false) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    profileSnapshot = profile;
  }
  if (user && input.includeStackSnapshot !== false) {
    const { data: stack } = await supabase
      .from("user_stack")
      .select(`
        *,
        medications!user_stack_medication_id_fkey ( name, slug, generic_name )
      `)
      .eq("user_id", user.id)
      .eq("is_active", true);
    stackSnapshot = stack;
  }

  // Insert with admin client — RLS bypassed because we've already
  // gated by app-layer auth (user OR email required above), and we
  // tightly control which columns get set. SELECT/UPDATE still enforce
  // RLS so users only see their own consults.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consults")
    .insert({
      user_id: user?.id ?? null,
      email: input.email ?? user?.email ?? null,
      raw_input_jsonb: input.rawInput,
      input_types: inputTypes,
      profile_snapshot: profileSnapshot,
      stack_snapshot: stackSnapshot,
      category: input.category ?? "general",
      status: "pending",
      // Opt-in share flag — flipped to 'public' automatically when
      // the pharmacist approves. Default stays 'private'.
      visibility: input.shareByDefault ? "pending_publish" : "private",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  // Fire-and-forget: kick off AI draft. Caller doesn't await; the
  // /consult/[id] page polls until ai_completed_at is non-null.
  void processConsultDraft(data.id as string).catch((err) => {
    console.error("[submitConsult] draft worker failed:", err);
  });

  return { ok: true, consultId: data.id as string };
}

export async function listMyConsults(): Promise<ConsultRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("consults")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map(rowToRecord);
}

export async function getMyConsult(
  id: string
): Promise<ConsultRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("consults")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? rowToRecord(data) : null;
}

// Public listing — used by /ask. Only visibility='public' rows.
export async function listPublicConsults(opts?: {
  category?: ConsultCategory;
  limit?: number;
  offset?: number;
}): Promise<ConsultRecord[]> {
  const supabase = await createClient();
  let query = supabase
    .from("consults")
    .select("*")
    .eq("visibility", "public")
    .order("published_at", { ascending: false })
    .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 20) - 1);

  if (opts?.category) query = query.eq("category", opts.category);

  const { data } = await query;
  return (data ?? []).map(rowToRecord);
}

export async function getPublicConsultBySlug(
  slug: string
): Promise<ConsultRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consults")
    .select("*")
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle();

  if (!data) return null;

  // Increment view count (RPC, security definer)
  await supabase.rpc("increment_consult_view", { consult_uuid: data.id });

  return rowToRecord(data);
}

export async function listPublicConsultsForProduct(
  productId: number,
  limit = 5
): Promise<ConsultRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consults")
    .select("*")
    .eq("visibility", "public")
    .contains("related_product_ids", [productId])
    .order("published_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(rowToRecord);
}

// User opts in to make their consult public. Triggers redaction
// pipeline; status moves to 'pending_publish' until user confirms
// the redacted version.
export async function requestPublish(
  consultId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("consults")
    .update({ visibility: "pending_publish" })
    .eq("id", consultId)
    .eq("user_id", user.id)
    .eq("visibility", "private");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/consult`);
  return { ok: true };
}

// User toggles their own consult between public (shared in /ask)
// and private. Called from the consult card's visibility switch.
// Auto-generates a URL slug on first publish (using the pharmacist
// answer's oneLineSummary + short id suffix for uniqueness).
export async function setConsultVisibility(
  consultId: string,
  visibility: "public" | "private"
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Load the consult to check ownership + answer presence + existing slug
  const { data: row, error: readErr } = await supabase
    .from("consults")
    .select("id, user_id, slug, pharmacist_final_jsonb")
    .eq("id", consultId)
    .maybeSingle();
  if (readErr || !row) {
    return { ok: false, error: readErr?.message ?? "Not found" };
  }
  if (row.user_id !== user.id) {
    return { ok: false, error: "Not your consult" };
  }
  if (!row.pharmacist_final_jsonb) {
    return {
      ok: false,
      error: "Answer must be pharmacist-reviewed before sharing",
    };
  }

  const patch: Record<string, unknown> = { visibility };

  if (visibility === "public") {
    if (!row.slug) {
      const final = row.pharmacist_final_jsonb as { oneLineSummary?: string };
      patch.slug = slugifyConsult(final?.oneLineSummary, consultId);
    }
    patch.published_at = new Date().toISOString();
  }

  // Use admin client — RLS only allows owner/pharmacist to update, but
  // the owner check above is sufficient and the admin path keeps the
  // update simple even when RLS gets tightened later.
  const admin = createAdminClient();
  const { error } = await admin
    .from("consults")
    .update(patch)
    .eq("id", consultId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/consult");
  revalidatePath("/ask");
  if (patch.slug) revalidatePath(`/ask/${patch.slug}`);

  return {
    ok: true,
    slug: (patch.slug as string | undefined) ?? (row.slug as string | null) ?? undefined,
  };
}

// Legacy helper: user confirms the redacted version is OK to publish.
// Kept for future admin-gated redaction flow.
export async function confirmRedaction(
  consultId: string,
  redactedInput: unknown,
  redactedAnswer: unknown
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("consults")
    .update({
      redacted_input_jsonb: redactedInput,
      redacted_answer_jsonb: redactedAnswer,
    })
    .eq("id", consultId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Admin/pharmacist publishes a consult after verifying redaction.
// Server-only: uses admin client to bypass RLS.
export async function publishConsult(
  consultId: string,
  slug: string,
  category: ConsultCategory,
  relatedProductIds: number[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Verify pharmacist role
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "pharmacist")
    .maybeSingle();
  if (!role) return { ok: false, error: "Pharmacist role required" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("consults")
    .update({
      visibility: "public",
      slug,
      category,
      related_product_ids: relatedProductIds,
      published_at: new Date().toISOString(),
    })
    .eq("id", consultId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ask");
  revalidatePath(`/ask/${slug}`);
  return { ok: true };
}

function rowToRecord(row: Record<string, unknown>): ConsultRecord {
  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    status: row.status as ConsultStatus,
    visibility: row.visibility as ConsultVisibility,
    category: row.category as ConsultCategory,
    priority: (row.priority as number) ?? 0,
    isHighRisk: (row.is_high_risk as boolean) ?? false,
    rawInput: (row.raw_input_jsonb as ConsultRawInput) ?? {},
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
