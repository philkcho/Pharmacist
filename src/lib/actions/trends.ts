"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isPharmacist } from "@/lib/actions/auth";
import { fetchWeeklyTrends } from "@/lib/trends/google-trends-client";
import { normalizeQuery, getMondayOfWeek } from "@/lib/trends/normalize";
import { isDuplicateRecent } from "@/lib/trends/dedupe";
import type { TrendCategory } from "@/lib/trends/category-mapping";
import { classifyTopic } from "@/lib/ai/classify-topic";
import {
  synthesizeAnalysis,
  type SynthesisResult,
} from "@/lib/ai/synthesize-analysis";
import { runRetrieval } from "@/lib/retrieval/merge-and-rank";
import { fetchDbFacts } from "@/lib/retrieval/fetch-db-facts";
import { fetchFdaFacts } from "@/lib/retrieval/fetch-fda-facts";
import { searchPubmed } from "@/lib/retrieval/search-pubmed";
import {
  searchRecentPubmed,
  fetchRecentPubmedStudies,
} from "@/lib/retrieval/search-pubmed-recent";
import { fetchCuratedSources } from "@/lib/retrieval/curated-sources";
import {
  fetchOpenBeautyFacts,
  persistBeautyProducts,
} from "@/lib/retrieval/fetch-open-beauty-facts";
import { fetchFaersTopReactions } from "@/lib/fda/faers-client";
import { fetchActiveRecalls } from "@/lib/fda/enforcement-client";
import { matchProducts } from "@/lib/ai/match-products";
import { generateTrendImageUrl } from "@/lib/ai/generate-trend-image";
import type {
  AnalysisResult,
  MarketReaction,
  ProductMatch,
  TopicUnderstanding,
} from "@/lib/ai/types";

// ============================================================
// Ingestion result + row types
// ============================================================

export interface IngestedTrendPreview {
  queryText: string;
  category: TrendCategory;
  rankType: "top" | "rising";
  rankPosition: number | null;
}

export interface IngestionResult {
  insertedCount: number;
  skippedDuplicateCount: number;
  skippedEmptyCount: number;
  errors: string[];
  detectedWeek: string;
  /** The actual trends that were inserted this run — for admin preview. */
  insertedTrends: IngestedTrendPreview[];
}

export type TrendStatus =
  | "pending"
  | "analyzing"
  | "published"
  | "rejected"
  | "archived";

export type TrendRankType = "top" | "rising";

export interface TrendTopicRow {
  id: number;
  source: "google_trends";
  category: TrendCategory;
  rankType: TrendRankType;
  rankPosition: number | null;
  queryText: string;
  normalizedQuery: string;
  volumeScore: number | null;
  detectedWeek: string;
  detectedAt: string;
  status: TrendStatus;
  analyzedAt: string | null;
  analysisError: string | null;
  publishedAt: string | null;
  slug: string | null;
  imageUrl: string | null;
  pharmacistReviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TrendTopicDbRow {
  id: number;
  source: "google_trends";
  category: TrendCategory;
  rank_type: TrendRankType;
  rank_position: number | null;
  query_text: string;
  normalized_query: string;
  volume_score: number | null;
  detected_week: string;
  detected_at: string;
  status: TrendStatus;
  analyzed_at: string | null;
  analysis_error: string | null;
  published_at: string | null;
  slug: string | null;
  image_url: string | null;
  pharmacist_reviewed: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function dbRowToTopic(row: TrendTopicDbRow): TrendTopicRow {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    rankType: row.rank_type,
    rankPosition: row.rank_position,
    queryText: row.query_text,
    normalizedQuery: row.normalized_query,
    volumeScore: row.volume_score,
    detectedWeek: row.detected_week,
    detectedAt: row.detected_at,
    status: row.status,
    analyzedAt: row.analyzed_at,
    analysisError: row.analysis_error,
    publishedAt: row.published_at,
    slug: row.slug,
    imageUrl: row.image_url ?? null,
    pharmacistReviewed: row.pharmacist_reviewed,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// Core ingestion — no auth check; callers are responsible
// ============================================================

/**
 * Pull this week's trending queries from Google Trends, dedupe
 * against the last 4 weeks, and insert new rows as `pending`.
 *
 * Intentionally has no auth check: this function is called both
 * from the authenticated admin server action and from the
 * CRON_SECRET-guarded /api/cron/weekly HTTP route. Wrap it with
 * your preferred auth policy, don't call it directly from public
 * client code.
 */
export async function ingestWeeklyTrends(): Promise<IngestionResult> {
  const detectedWeek = getMondayOfWeek();
  const result: IngestionResult = {
    insertedCount: 0,
    skippedDuplicateCount: 0,
    skippedEmptyCount: 0,
    errors: [],
    detectedWeek,
    insertedTrends: [],
  };

  let bundles;
  try {
    bundles = await fetchWeeklyTrends();
  } catch (err) {
    result.errors.push(
      `fetchWeeklyTrends failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  if (bundles.every((b) => b.trends.length === 0)) {
    result.errors.push(
      "Google Trends returned no data for any seed. The unofficial package may be rate-limited or the HTML layout may have changed."
    );
  }

  // Use admin client to bypass RLS — this function runs from the
  // CRON_SECRET-guarded cron route (no user session) and from the
  // pharmacist-authenticated admin trigger.
  const supabase = createAdminClient();

  for (const bundle of bundles) {
    for (const trend of bundle.trends) {
      const normalized = normalizeQuery(trend.query);
      if (!normalized) {
        result.skippedEmptyCount++;
        continue;
      }

      if (await isDuplicateRecent(normalized)) {
        result.skippedDuplicateCount++;
        continue;
      }

      const { error } = await supabase.from("trend_topics").insert({
        source: "google_trends",
        category: bundle.category,
        rank_type: trend.rankType,
        rank_position: trend.rankPosition,
        query_text: trend.query,
        normalized_query: normalized,
        volume_score: trend.volumeScore,
        detected_week: detectedWeek,
        raw_payload: trend.raw,
      });

      if (error) {
        // 23505 = unique_violation. The (source, normalized_query,
        // detected_week) constraint caught a race; treat as dup.
        if (error.code === "23505") {
          result.skippedDuplicateCount++;
        } else {
          result.errors.push(
            `insert failed for "${trend.query}": ${error.message}`
          );
        }
        continue;
      }

      result.insertedCount++;
      result.insertedTrends.push({
        queryText: trend.query,
        category: bundle.category,
        rankType: trend.rankType,
        rankPosition: trend.rankPosition,
      });
    }
  }

  return result;
}

// ============================================================
// Admin-facing wrappers (require pharmacist auth via RLS)
// ============================================================

async function assertPharmacist(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase.rpc("is_pharmacist");
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Pharmacist role required");
}

/**
 * Admin-triggered manual ingestion. Same work as the cron path,
 * but checks that the caller is a pharmacist first and revalidates
 * the /admin/trends page so the new rows show up without a refresh.
 */
export async function triggerTrendIngestion(): Promise<IngestionResult> {
  await assertPharmacist();
  const result = await ingestWeeklyTrends();
  revalidatePath("/trends");
  return result;
}

/**
 * List trend_topics filtered by status, newest first.
 *
 * Uses the RLS-aware server client. For pharmacists this returns
 * every row; for anon it will be blocked unless you query
 * `status = 'published'`.
 */
export async function listTrendsByStatus(
  status?: TrendStatus,
  limit = 50
): Promise<TrendTopicRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("trend_topics")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[trends] listTrendsByStatus failed:", error);
    return [];
  }
  return (data as TrendTopicDbRow[] | null)?.map(dbRowToTopic) ?? [];
}

// ─── Admin review list (with analysis preview) ──────────────

export type AdminTrendFilter =
  | "pending_review" // status=published AND NOT pharmacist_reviewed — awaiting approval
  | "live" // status=published AND pharmacist_reviewed — visible to public
  | "pending"
  | "analyzing"
  | "rejected"
  | "archived";

export interface AdminTrendRow extends TrendTopicRow {
  headline: string | null;
  answer: string | null;
  leadExplanation: string | null;
  keyTakeaways: string[];
  redFlags: string[];
  confidence: "high" | "medium" | "low" | null;
  sourceCount: number;
  productMatchCount: number;
}

interface AdminTrendJoinedRow extends TrendTopicDbRow {
  trend_analyses:
    | {
        synthesis_jsonb: unknown;
        sources_jsonb: unknown;
        product_matches_jsonb: unknown;
      }
    | null;
}

/**
 * Admin-only list with synthesis preview for in-line review. Supports
 * virtual filters "pending_review" (status=published, unreviewed) and
 * "live" (status=published, reviewed) in addition to raw status filters.
 */
export async function listAdminTrends(
  filter: AdminTrendFilter,
  limit = 50
): Promise<AdminTrendRow[]> {
  await assertPharmacist();
  const admin = createAdminClient();

  let query = admin
    .from("trend_topics")
    .select(
      "*, trend_analyses(synthesis_jsonb, sources_jsonb, product_matches_jsonb)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  switch (filter) {
    case "pending_review":
      query = query.eq("status", "published").eq("pharmacist_reviewed", false);
      break;
    case "live":
      query = query.eq("status", "published").eq("pharmacist_reviewed", true);
      break;
    case "pending":
    case "analyzing":
    case "rejected":
    case "archived":
      query = query.eq("status", filter);
      break;
  }

  const { data, error } = await query;
  if (error) {
    console.error("[trends] listAdminTrends failed:", error);
    return [];
  }

  return ((data ?? []) as AdminTrendJoinedRow[]).map((row) => {
    const topic = dbRowToTopic(row);
    const synth = row.trend_analyses?.synthesis_jsonb as
      | {
          answer?: string;
          leadExplanation?: string;
          headline?: string;
          keyTakeaways?: string[];
          redFlags?: string[];
          confidence?: "high" | "medium" | "low";
        }
      | null;
    const sources = Array.isArray(row.trend_analyses?.sources_jsonb)
      ? (row.trend_analyses!.sources_jsonb as unknown[])
      : [];
    const matches = Array.isArray(row.trend_analyses?.product_matches_jsonb)
      ? (row.trend_analyses!.product_matches_jsonb as unknown[])
      : [];

    return {
      ...topic,
      headline: synth?.headline ?? null,
      answer: synth?.answer ?? null,
      leadExplanation: synth?.leadExplanation ?? null,
      keyTakeaways: synth?.keyTakeaways ?? [],
      redFlags: synth?.redFlags ?? [],
      confidence: synth?.confidence ?? null,
      sourceCount: sources.length,
      productMatchCount: matches.length,
    };
  });
}

/**
 * List published trends with headline from synthesis for display
 * on homepage and trending index.
 *
 * Only pharmacist-reviewed trends surface publicly. AI-analyzed-but-
 * unreviewed trends stay in the admin "Pending Review" queue.
 */
export async function listPublishedTrendsWithHeadline(
  limit = 10
): Promise<Array<TrendTopicRow & { headline: string | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trend_topics")
    .select("*, trend_analyses(synthesis_jsonb)")
    .eq("status", "published")
    .eq("pharmacist_reviewed", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[trends] listPublishedTrendsWithHeadline failed:", error);
    return [];
  }

  return ((data ?? []) as Array<TrendTopicDbRow & { trend_analyses: { synthesis_jsonb: unknown } | null }>).map((row) => {
    const topic = dbRowToTopic(row);
    const synth = row.trend_analyses?.synthesis_jsonb as { headline?: string } | null;
    return { ...topic, headline: synth?.headline ?? null };
  });
}

/**
 * Count unreviewed-but-published trends for the admin sidebar badge.
 */
export async function countUnreviewedTrends(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("trend_topics")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("pharmacist_reviewed", false);
  if (error) {
    console.warn("[trends] countUnreviewedTrends failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

// ============================================================
// Analysis worker (Phase E)
// ============================================================
// Runs the three-layer pipeline on one or more pending trend_topics
// rows and writes the result to trend_analyses. On success the
// topic flips straight to `published` (auto-publish policy — no
// human review gate). The amber "AI draft — pending pharmacist
// review" banner shows on the public page until a pharmacist
// flips `pharmacist_reviewed` to true.

const ANALYSIS_BATCH_SIZE_DEFAULT = 3;

export interface AnalyzeTrendResult {
  trendId: number;
  outcome: "published" | "rejected" | "failed";
  reason?: string;
  slug?: string;
  /** Original trend keyword (for admin preview listing). */
  queryText?: string;
  /** AI-generated headline when outcome === "published". */
  headline?: string | null;
}

export interface AnalysisBatchResult {
  pickedCount: number;
  publishedCount: number;
  rejectedCount: number;
  failedCount: number;
  results: AnalyzeTrendResult[];
}

/**
 * URL slug from a normalized query + trend id for uniqueness.
 * Example: "best moisturizer" + 42 → "best-moisturizer-t42"
 */
function generateSlug(normalized: string, trendId: number): string {
  const base = normalized
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-t${trendId}` : `trend-t${trendId}`;
}

/**
 * Analyze one pending trend end-to-end.
 *
 * 1. Load the trend_topics row (admin client, bypasses RLS)
 * 2. Layer 1 — classifyTopic(queryText, categoryHint)
 * 3. Layer 2 — runRetrieval([db, fda, pubmed, curated], input)
 * 4. Layer 3 — synthesizeAnalysis(understanding, sources)
 * 5. Persist AnalysisResult to trend_analyses
 * 6. Update trend_topics.status:
 *    - synthesis: kind='analysis' → 'published'
 *    - synthesis: kind='refusal'  → 'rejected'
 *    - hard error                 → stays 'pending', sets analysis_error
 *
 * Uses the admin Supabase client (service role) because the weekly
 * cron runs unauthenticated. RLS would otherwise block writes.
 */
export async function analyzeTrend(
  trendId: number
): Promise<AnalyzeTrendResult> {
  const admin = createAdminClient();

  // 1. Load + claim.
  const { data: trendRow, error: loadError } = await admin
    .from("trend_topics")
    .select("*")
    .eq("id", trendId)
    .maybeSingle<TrendTopicDbRow>();

  if (loadError || !trendRow) {
    return {
      trendId,
      outcome: "failed",
      reason: `Failed to load trend: ${loadError?.message ?? "not found"}`,
    };
  }

  if (trendRow.status !== "pending") {
    return {
      trendId,
      outcome: "failed",
      reason: `Trend is in status '${trendRow.status}', not 'pending'.`,
    };
  }

  await admin
    .from("trend_topics")
    .update({ status: "analyzing" })
    .eq("id", trendId);

  try {
    // 2. Layer 1.
    const understanding = await classifyTopic(trendRow.query_text, {
      categoryHint: trendRow.category,
    });

    // 3. Layer 2.
    // For health (pharma) trends, include the recent-PubMed (30-day)
    // retriever so fresh publications can explain "why now". For
    // beauty we skip it — fresh derm papers exist but they rarely
    // map to trending beauty queries, and the extra API call is
    // wasteful.
    const retrievers = [fetchDbFacts, fetchFdaFacts, searchPubmed, fetchCuratedSources];
    if (trendRow.category === "health") {
      retrievers.push(searchRecentPubmed);
    }
    if (trendRow.category === "beauty_fitness") {
      retrievers.push(fetchOpenBeautyFacts);

      // Persist OBF search results as draft cosmetic products so
      // they accumulate for pharmacist review. Search by each
      // entity keyword (ingredients, drugs, symptoms) — not just
      // the raw query — so "best skincare routine" also finds
      // "moisturizer", "sunscreen", "retinoid" products.
      const beautySearchTerms = new Set<string>();
      beautySearchTerms.add(trendRow.query_text);
      for (const t of understanding.entities.genericIngredients) beautySearchTerms.add(t);
      for (const t of understanding.entities.drugs) beautySearchTerms.add(t);
      for (const t of understanding.entities.symptoms) beautySearchTerms.add(t);

      for (const term of beautySearchTerms) {
        persistBeautyProducts(term, 3).catch((err) => {
          console.warn(
            `[trends] persistBeautyProducts("${term}") failed for trend ${trendId}:`,
            err instanceof Error ? err.message : err
          );
        });
      }
    }

    const retrieval = await runRetrieval(retrievers, {
      query: trendRow.query_text,
      entities: understanding.entities,
      categoryHint: trendRow.category,
    });

    // 4. Build MarketReaction with pharma-specific signals (FAERS,
    // recalls, recent PubMed). All calls degrade to empty silently
    // so a single API failure doesn't block publishing.
    //
    // Product matching:
    // - Pharma (health): only for recommendation-intent topic types
    //   (product_info, comparison, symptom_relief) to avoid
    //   inappropriate drug suggestions for dosage/safety queries.
    // - Beauty (beauty_fitness): ALWAYS attempt matching regardless
    //   of topicType, because even "general_education" beauty
    //   articles mention specific product categories (moisturizer,
    //   sunscreen, retinoid) that users want to explore.
    const PHARMA_PRODUCT_TYPES = new Set([
      "product_info",
      "comparison",
      "symptom_relief",
    ]);
    const shouldMatchProducts =
      trendRow.category === "beauty_fitness" ||
      PHARMA_PRODUCT_TYPES.has(understanding.topicType);

    let productMatches: ProductMatch[] = shouldMatchProducts
      ? await matchProducts(
          understanding,
          trendRow.category as TrendCategory,
          5
        ).catch((err) => {
          console.warn(
            `[trends] matchProducts failed for trend ${trendId}:`,
            err instanceof Error ? err.message : err
          );
          return [] as ProductMatch[];
        })
      : [];

    // Fallback: if the matchProducts query came back with fewer than 5,
    // ask Gemini to suggest real brand-name products, hand each to
    // ensureProductComplete (which auto-approves on AI success), then
    // APPEND the ensured products directly to productMatches. We skip
    // re-calling matchProducts because its ILIKE substring logic often
    // misses (e.g. article entity "retinoid" != product genericName
    // "retinol"). Direct append guarantees newly-created products land
    // in the matches list.
    if (shouldMatchProducts && productMatches.length < 5) {
      const deficit = 5 - productMatches.length;
      try {
        const { suggestTrendProducts } = await import(
          "@/lib/ai/suggest-trend-products"
        );
        const { ensureProductComplete } = await import(
          "@/lib/actions/ensure-product-complete"
        );

        const suggestions = await suggestTrendProducts({
          understanding,
          category: trendRow.category as TrendCategory,
          existingProductNames: productMatches.map((m) => m.name),
          count: deficit,
        });

        if (suggestions.length > 0) {
          console.log(
            `[trends] trend ${trendId}: ${productMatches.length} matched, creating ${suggestions.length} via fallback`
          );

          const existingIds = new Set(productMatches.map((m) => m.medicationId));
          for (const s of suggestions) {
            if (productMatches.length >= 5) break;
            try {
              const ensured = await ensureProductComplete({
                name: s.name,
                genericName: s.genericName,
                productType: s.productType,
                categorySlug: understanding.entities.categorySlugs[0] ?? null,
              });
              if (!ensured || existingIds.has(ensured.id)) continue;
              existingIds.add(ensured.id);
              productMatches.push({
                medicationId: ensured.id,
                name: ensured.name,
                slug: ensured.slug,
                reason: `AI-suggested: ${s.rationale}`,
                ingredientHighlights: s.genericName ? [s.genericName] : [],
              });
            } catch (err) {
              console.warn(
                `[trends] ensureProductComplete failed for "${s.name}":`,
                err instanceof Error ? err.message : err
              );
            }
          }
        }
      } catch (err) {
        console.warn(
          `[trends] product fallback failed for trend ${trendId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const marketReaction: MarketReaction = {
      relatedQueries: [],
    };

    if (trendRow.category === "health") {
      const primaryDrug =
        understanding.entities.drugs[0] ??
        understanding.entities.genericIngredients[0];

      if (primaryDrug) {
        const [faers, recalls] = await Promise.all([
          fetchFaersTopReactions(primaryDrug).catch(() => null),
          fetchActiveRecalls(primaryDrug).catch(() => []),
        ]);
        if (faers) marketReaction.topReactions = [faers];
        if (recalls.length > 0) marketReaction.activeRecalls = recalls;
      }

      const recentStudies = await fetchRecentPubmedStudies(
        primaryDrug ?? trendRow.query_text,
        3
      ).catch(() => []);
      if (recentStudies.length > 0) {
        marketReaction.recentPubmedStudies = recentStudies;
      }
    }

    const synthesisResult: SynthesisResult = await synthesizeAnalysis({
      understanding,
      sources: retrieval.fragments,
      productMatches,
      marketReaction,
      categoryHint: trendRow.category,
    });

    // 5. Build AnalysisResult — the canonical shape we persist.
    const now = new Date().toISOString();
    const analysisResult: AnalysisResult = {
      understanding,
      sources: retrieval.fragments,
      productMatches,
      marketReaction,
      synthesis:
        synthesisResult.kind === "analysis" ? synthesisResult.analysis : null,
      refusal:
        synthesisResult.kind === "refusal"
          ? synthesisResult.refusal
          : undefined,
      generatedAt: now,
    };

    // 6. Persist to trend_analyses (upsert — analyzeTrend is
    // intended to be retry-safe).
    const { error: analysesError } = await admin
      .from("trend_analyses")
      .upsert(
        {
          trend_topic_id: trendId,
          understanding_jsonb: analysisResult.understanding,
          sources_jsonb: analysisResult.sources,
          synthesis_jsonb:
            analysisResult.synthesis ?? analysisResult.refusal ?? null,
          product_matches_jsonb: analysisResult.productMatches,
          market_reaction_jsonb: analysisResult.marketReaction,
          ai_model: "gemini-2.5-pro",
          generated_at: now,
        },
        { onConflict: "trend_topic_id" }
      );

    if (analysesError) {
      throw new Error(
        `trend_analyses upsert failed: ${analysesError.message}`
      );
    }

    // 7. Update trend_topics based on synthesis outcome.
    if (synthesisResult.kind === "analysis") {
      const slug = generateSlug(trendRow.normalized_query, trendId);

      // Generate cover image URL (Pollinations.ai — free, no API key)
      // Also pre-warms the cache so image is ready when users visit.
      const headline = synthesisResult.analysis?.headline ?? null;
      const imageUrl = await generateTrendImageUrl(
        trendRow.query_text,
        trendRow.category,
        headline
      );

      const { error: updateError } = await admin
        .from("trend_topics")
        .update({
          status: "published",
          analyzed_at: now,
          analysis_error: null,
          published_at: now,
          slug,
          image_url: imageUrl,
        })
        .eq("id", trendId);
      if (updateError) {
        throw new Error(
          `trend_topics publish update failed: ${updateError.message}`
        );
      }
      return {
        trendId,
        outcome: "published",
        slug,
        queryText: trendRow.query_text,
        headline,
      };
    } else {
      // Persist the AI's refusal reason so the Rejected tab can explain
      // why an item was auto-rejected (e.g. "no OTC ADHD medications
      // exist", "insufficient evidence", "medical-advice request").
      const refusalReason = synthesisResult.refusal.reason ?? null;
      const { error: updateError } = await admin
        .from("trend_topics")
        .update({
          status: "rejected",
          analyzed_at: now,
          analysis_error: refusalReason
            ? `AI refusal: ${refusalReason}`.slice(0, 500)
            : null,
        })
        .eq("id", trendId);
      if (updateError) {
        throw new Error(
          `trend_topics reject update failed: ${updateError.message}`
        );
      }
      return {
        trendId,
        outcome: "rejected",
        reason: refusalReason ?? undefined,
        queryText: trendRow.query_text,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[trends] analyzeTrend(${trendId}) failed:`, message);
    // Revert to pending so the next cron tick can retry.
    await admin
      .from("trend_topics")
      .update({
        status: "pending",
        analyzed_at: new Date().toISOString(),
        analysis_error: message.slice(0, 500),
      })
      .eq("id", trendId);
    return {
      trendId,
      outcome: "failed",
      reason: message,
      queryText: trendRow.query_text,
    };
  }
}

/**
 * Pick up to `limit` pending trends (oldest-first) and analyze
 * each sequentially. Caller is responsible for enforcing time
 * budgets (Vercel Cron serverless 60s cap).
 *
 * Runs without auth checks — invoked by the CRON_SECRET-guarded
 * /api/cron/weekly route and the pharmacist-auth-guarded
 * triggerTrendAnalysis() admin wrapper.
 */
export async function analyzePendingTrends(
  limit = ANALYSIS_BATCH_SIZE_DEFAULT
): Promise<AnalysisBatchResult> {
  const admin = createAdminClient();

  const { data: pending, error: loadError } = await admin
    .from("trend_topics")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (loadError) {
    console.error("[trends] analyzePendingTrends load failed:", loadError);
    return {
      pickedCount: 0,
      publishedCount: 0,
      rejectedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const picked = (pending ?? []) as Array<{ id: number }>;
  const results: AnalyzeTrendResult[] = [];
  let publishedCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;

  for (const row of picked) {
    const result = await analyzeTrend(row.id);
    results.push(result);
    if (result.outcome === "published") publishedCount++;
    else if (result.outcome === "rejected") rejectedCount++;
    else failedCount++;
  }

  return {
    pickedCount: picked.length,
    publishedCount,
    rejectedCount,
    failedCount,
    results,
  };
}

/**
 * Admin-triggered analysis batch. Same work as the cron path,
 * but checks that the caller is a pharmacist first.
 */
export async function triggerTrendAnalysis(
  limit?: number
): Promise<AnalysisBatchResult> {
  await assertPharmacist();
  const result = await analyzePendingTrends(limit);
  revalidatePath("/trends");
  return result;
}

// ============================================================
// Admin review workflow — publish / unpublish / reject
// ============================================================

/**
 * Mark an AI-analyzed trend as pharmacist-reviewed so it surfaces on
 * the public homepage and /trending index. Idempotent — re-running
 * on an already-reviewed trend is a no-op.
 *
 * Only callable by pharmacists. Revalidates home + trending pages so
 * readers see the new post within seconds.
 */
export async function publishTrend(
  trendId: number
): Promise<{ success: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { data: current, error: loadErr } = await admin
    .from("trend_topics")
    .select("status, slug")
    .eq("id", trendId)
    .maybeSingle<{ status: string; slug: string | null }>();

  if (loadErr || !current) {
    return { success: false, error: loadErr?.message ?? "Trend not found" };
  }
  if (current.status !== "published") {
    return {
      success: false,
      error: `Trend must be in 'published' status to be reviewed (current: ${current.status}).`,
    };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("trend_topics")
    .update({
      pharmacist_reviewed: true,
      reviewed_at: now,
      published_at: now, // refresh timestamp so the post surfaces as new
    })
    .eq("id", trendId);

  if (updErr) return { success: false, error: updErr.message };

  revalidatePath("/");
  revalidatePath("/trending");
  if (current.slug) revalidatePath(`/trending/${current.slug}`);
  revalidatePath("/trends");
  return { success: true };
}

/**
 * Demote a live trend back to draft (hide from public). Keeps the
 * analysis + published status intact so it can be republished with
 * one click later. Use this when a post needs a correction or is
 * suspected to be stale.
 */
export async function unpublishTrend(
  trendId: number
): Promise<{ success: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("trend_topics")
    .select("slug")
    .eq("id", trendId)
    .maybeSingle<{ slug: string | null }>();

  const { error: updErr } = await admin
    .from("trend_topics")
    .update({ pharmacist_reviewed: false })
    .eq("id", trendId);

  if (updErr) return { success: false, error: updErr.message };

  revalidatePath("/");
  revalidatePath("/trending");
  if (current?.slug) revalidatePath(`/trending/${current.slug}`);
  revalidatePath("/trends");
  return { success: true };
}

/**
 * Run the full Layer 1→2→3 pipeline on a single pending trend. Used
 * by the admin "Analyze this one" button. Wraps analyzeTrend() with
 * the pharmacist auth check + revalidation.
 */
export async function triggerSingleAnalysis(
  trendId: number
): Promise<AnalyzeTrendResult> {
  await assertPharmacist();
  const result = await analyzeTrend(trendId);
  revalidatePath("/trends");
  return result;
}

// ─── Backfill: re-match up to 5 products per existing analysis ──

export interface BackfillResult {
  scanned: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Full per-trend refresh pipeline used by the admin "Backfill all articles"
 * button. For every analyzed trend (status=published or rejected):
 *
 *   1. Re-run matchProducts with limit=5
 *   2. If <5 matches, ask Gemini for real brand-name suggestions and
 *      create each via ensureProductComplete (auto-approves on AI success)
 *   3. Re-run matchProducts to pick up newly-created rows
 *   4. Persist updated `product_matches_jsonb`
 *   5. If ≥2 products, re-run synthesizeAnalysis to regenerate productGroups
 *      (role buckets: Morning / Evening / Moisturize etc.)
 *   6. Persist updated `synthesis_jsonb`
 *   7. Revalidate the trend's public path so readers see the changes
 *
 * Result: after one click, every existing article has top-5 products
 * AND role-grouped Recommended Products section rendering on the page.
 *
 * Idempotent: matches that already look up-to-date are skipped.
 */
export async function backfillTrendProductMatches(
  limit = 100
): Promise<BackfillResult> {
  await assertPharmacist();
  const admin = createAdminClient();
  const result: BackfillResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Fetch analyses with their parent trend's category + status + slug
  const { data: rows, error } = await admin
    .from("trend_analyses")
    .select(
      "trend_topic_id, understanding_jsonb, sources_jsonb, synthesis_jsonb, product_matches_jsonb, market_reaction_jsonb, trend_topics!inner(id, slug, status, category)"
    )
    .in("trend_topics.status", ["published", "rejected"])
    .order("trend_topic_id", { ascending: false })
    .limit(limit);

  if (error) {
    result.errors.push(`analyses load failed: ${error.message}`);
    return result;
  }

  const updatedSlugs: string[] = [];

  for (const row of rows ?? []) {
    result.scanned++;
    const topic = Array.isArray(row.trend_topics)
      ? row.trend_topics[0]
      : row.trend_topics;
    if (!topic) {
      result.skipped++;
      continue;
    }

    const understanding = row.understanding_jsonb as TopicUnderstanding | null;
    if (!understanding || !understanding.entities) {
      result.skipped++;
      continue;
    }

    try {
      let newMatches = await matchProducts(
        understanding,
        topic.category as TrendCategory,
        5
      );

      // Same fallback as analyzeTrend: create missing products via
      // Gemini + ensureProductComplete, and append directly (skip
      // re-matching — ILIKE often misses new products).
      if (newMatches.length < 5) {
        const deficit = 5 - newMatches.length;
        try {
          const { suggestTrendProducts } = await import(
            "@/lib/ai/suggest-trend-products"
          );
          const { ensureProductComplete } = await import(
            "@/lib/actions/ensure-product-complete"
          );
          const suggestions = await suggestTrendProducts({
            understanding,
            category: topic.category as TrendCategory,
            existingProductNames: newMatches.map((m) => m.name),
            count: deficit,
          });
          const existingIds = new Set(newMatches.map((m) => m.medicationId));
          for (const s of suggestions) {
            if (newMatches.length >= 5) break;
            try {
              const ensured = await ensureProductComplete({
                name: s.name,
                genericName: s.genericName,
                productType: s.productType,
                categorySlug:
                  understanding.entities.categorySlugs[0] ?? null,
              });
              if (!ensured || existingIds.has(ensured.id)) continue;
              existingIds.add(ensured.id);
              newMatches.push({
                medicationId: ensured.id,
                name: ensured.name,
                slug: ensured.slug,
                reason: `AI-suggested: ${s.rationale}`,
                ingredientHighlights: s.genericName ? [s.genericName] : [],
              });
            } catch (err) {
              console.warn(
                `[backfill] ensureProductComplete failed for "${s.name}":`,
                err instanceof Error ? err.message : err
              );
            }
          }
        } catch (err) {
          console.warn(
            `[backfill] fallback failed for trend ${topic.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      const oldMatches = Array.isArray(row.product_matches_jsonb)
        ? (row.product_matches_jsonb as ProductMatch[])
        : [];
      const matchesChanged =
        oldMatches.length !== newMatches.length ||
        !oldMatches.every(
          (m, i) => m.medicationId === newMatches[i]?.medicationId
        );

      const existingSynthesis = row.synthesis_jsonb as
        | { productGroups?: unknown[] }
        | null;
      const hasGroups =
        existingSynthesis &&
        Array.isArray(existingSynthesis.productGroups) &&
        existingSynthesis.productGroups.length > 0;

      // Need groups if matches changed OR groups missing, and we have
      // enough products to form one.
      const needsGroupsRegen =
        newMatches.length >= 2 && (matchesChanged || !hasGroups);

      // Skip if nothing would change
      if (!matchesChanged && !needsGroupsRegen) {
        result.skipped++;
        continue;
      }

      // 1) Persist updated matches if changed
      if (matchesChanged) {
        const { error: updErr } = await admin
          .from("trend_analyses")
          .update({ product_matches_jsonb: newMatches })
          .eq("trend_topic_id", row.trend_topic_id);
        if (updErr) {
          result.errors.push(
            `trend #${topic.id} (${topic.slug ?? "no-slug"}): matches update failed: ${updErr.message}`
          );
          continue;
        }
      }

      // 2) Regenerate synthesis to produce productGroups if needed
      if (needsGroupsRegen) {
        const understandingForSynth = understanding;
        const sources = Array.isArray(row.sources_jsonb)
          ? (row.sources_jsonb as import("@/lib/ai/types").SourceFragment[])
          : [];
        if (sources.length > 0) {
          const marketReaction =
            row.market_reaction_jsonb &&
            typeof row.market_reaction_jsonb === "object"
              ? (row.market_reaction_jsonb as MarketReaction)
              : undefined;
          try {
            const synthRes = await synthesizeAnalysis({
              understanding: understandingForSynth,
              sources,
              productMatches: newMatches,
              marketReaction,
              categoryHint: topic.category as string,
            });
            if (synthRes.kind === "analysis") {
              await admin
                .from("trend_analyses")
                .update({ synthesis_jsonb: synthRes.analysis })
                .eq("trend_topic_id", row.trend_topic_id);
            }
          } catch (err) {
            // Non-fatal — matches still persist; groups remain missing
            console.warn(
              `[backfill] groups regen failed for trend ${topic.id}:`,
              err instanceof Error ? err.message : err
            );
          }
        }
      }

      result.updated++;
      if (topic.slug) updatedSlugs.push(topic.slug as string);
    } catch (err) {
      result.errors.push(
        `trend #${topic.id} (${topic.slug ?? "no-slug"}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/trending");
  for (const slug of updatedSlugs) {
    revalidatePath(`/trending/${slug}`);
  }
  return result;
}

/**
 * Re-run `synthesizeAnalysis()` on every analyzed trend that's missing
 * `synthesis_jsonb.productGroups`. Rebuilds the full Analysis so Gemini
 * can group the already-matched products into 2-4 role buckets
 * (Morning / Evening / Moisturize / Take-with-food etc.).
 *
 * Cost: Gemini 2.5 Pro call × N trends. Roughly $0.001-0.003 each.
 * Default limit 25 → ~$0.08 per full click.
 *
 * Idempotent: rows that already have productGroups are skipped.
 */
export async function backfillProductGroups(
  limit = 25
): Promise<BackfillResult> {
  await assertPharmacist();
  const admin = createAdminClient();
  const result: BackfillResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const { data: rows, error } = await admin
    .from("trend_analyses")
    .select(
      "trend_topic_id, understanding_jsonb, sources_jsonb, synthesis_jsonb, product_matches_jsonb, market_reaction_jsonb, trend_topics!inner(id, slug, status, category)"
    )
    .in("trend_topics.status", ["published", "rejected"])
    .order("trend_topic_id", { ascending: false })
    .limit(limit);

  if (error) {
    result.errors.push(`analyses load failed: ${error.message}`);
    return result;
  }

  const updatedSlugs: string[] = [];

  for (const row of rows ?? []) {
    result.scanned++;
    const topic = Array.isArray(row.trend_topics)
      ? row.trend_topics[0]
      : row.trend_topics;
    if (!topic) {
      result.skipped++;
      continue;
    }

    // Skip if productGroups already populated
    const existingSynthesis = row.synthesis_jsonb as
      | { productGroups?: unknown[] }
      | null;
    if (
      existingSynthesis &&
      Array.isArray(existingSynthesis.productGroups) &&
      existingSynthesis.productGroups.length > 0
    ) {
      result.skipped++;
      continue;
    }

    const understanding = row.understanding_jsonb as TopicUnderstanding | null;
    if (!understanding || !understanding.entities) {
      result.errors.push(
        `trend #${topic.id} (${topic.slug ?? "no-slug"}): missing understanding`
      );
      continue;
    }

    const sources = Array.isArray(row.sources_jsonb)
      ? (row.sources_jsonb as import("@/lib/ai/types").SourceFragment[])
      : [];
    if (sources.length === 0) {
      result.errors.push(
        `trend #${topic.id} (${topic.slug ?? "no-slug"}): no sources, Gemini would refuse`
      );
      continue;
    }

    const productMatches = Array.isArray(row.product_matches_jsonb)
      ? (row.product_matches_jsonb as ProductMatch[])
      : [];
    if (productMatches.length < 2) {
      result.errors.push(
        `trend #${topic.id} (${topic.slug ?? "no-slug"}): only ${productMatches.length} matched product(s) — need ≥2 to group. Run "Backfill all articles" first to get more matches.`
      );
      continue;
    }

    const marketReaction =
      row.market_reaction_jsonb &&
      typeof row.market_reaction_jsonb === "object"
        ? (row.market_reaction_jsonb as MarketReaction)
        : undefined;

    try {
      const synthRes = await synthesizeAnalysis({
        understanding,
        sources,
        productMatches,
        marketReaction,
        categoryHint: topic.category as string,
      });

      if (synthRes.kind !== "analysis") {
        result.errors.push(
          `trend #${topic.id} (${topic.slug ?? "no-slug"}): Gemini refused (${synthRes.refusal.reason})`
        );
        continue;
      }

      // Double-check productGroups actually landed
      const groups = synthRes.analysis.productGroups;
      if (!groups || groups.length === 0) {
        result.errors.push(
          `trend #${topic.id} (${topic.slug ?? "no-slug"}): Gemini ran but returned empty productGroups — validator may have stripped invalid ids`
        );
        continue;
      }

      const { error: updErr } = await admin
        .from("trend_analyses")
        .update({ synthesis_jsonb: synthRes.analysis })
        .eq("trend_topic_id", row.trend_topic_id);

      if (updErr) {
        result.errors.push(
          `trend #${topic.id} (${topic.slug ?? "no-slug"}): update failed: ${updErr.message}`
        );
        continue;
      }

      result.updated++;
      if (topic.slug) updatedSlugs.push(topic.slug as string);
    } catch (err) {
      result.errors.push(
        `trend #${topic.id} (${topic.slug ?? "no-slug"}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/trending");
  for (const slug of updatedSlugs) {
    revalidatePath(`/trending/${slug}`);
  }
  return result;
}

/**
 * Hard-delete a trend (and its trend_analyses via FK cascade). Use
 * for raw-pending rows that aren't worth analyzing — keyword noise,
 * irrelevant to health/beauty, etc. Prefer rejectTrend() for already-
 * analyzed drafts so we keep the synthesis for audit.
 */
export async function deleteTrend(
  trendId: number
): Promise<{ success: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  // Remove child rows first in case the FK is not ON DELETE CASCADE.
  await admin.from("trend_analyses").delete().eq("trend_topic_id", trendId);

  const { error } = await admin
    .from("trend_topics")
    .delete()
    .eq("id", trendId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/trends");
  revalidatePath("/");
  revalidatePath("/trending");
  return { success: true };
}

/**
 * Reject a trend — status moves to 'rejected' and it drops out of
 * both the admin Pending Review queue and all public queries. The
 * underlying analysis row is preserved in case we want to audit.
 */
export async function rejectTrend(
  trendId: number,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("trend_topics")
    .select("slug")
    .eq("id", trendId)
    .maybeSingle<{ slug: string | null }>();

  const { error: updErr } = await admin
    .from("trend_topics")
    .update({
      status: "rejected",
      pharmacist_reviewed: false,
      analysis_error: reason ? `Rejected by reviewer: ${reason}`.slice(0, 500) : null,
    })
    .eq("id", trendId);

  if (updErr) return { success: false, error: updErr.message };

  revalidatePath("/");
  revalidatePath("/trending");
  if (current?.slug) revalidatePath(`/trending/${current.slug}`);
  revalidatePath("/trends");
  return { success: true };
}

// ============================================================
// Public data access — trending page rendering
// ============================================================

/**
 * Full data bundle needed by `/trending/[slug]` to render all
 * sections (Hook → Lead → Products → Safety → Sources → Footer).
 */
export interface TrendPageData {
  topic: TrendTopicRow;
  analysis: {
    understandingJsonb: unknown;
    sourcesJsonb: unknown;
    synthesisJsonb: unknown;
    productMatchesJsonb: unknown;
    marketReactionJsonb: unknown;
    aiModel: string;
    generatedAt: string;
    pharmacistNotes: string | null;
    pharmacistOverrides: unknown;
  };
  /** Full medication rows for each product match (for cards). */
  matchedMedications: Array<{
    id: number;
    name: string;
    slug: string;
    genericName: string | null;
    brandNames: string[] | null;
    description: string | null;
    imageUrl: string | null;
    priceRange: string | null;
    recommendedFor: string[] | null;
    dosageForms: string[] | null;
    warnings: string | null;
    sideEffects: string | null;
    pros: unknown;
    cons: unknown;
    verdict: string | null;
    ingredientAnalysis: unknown;
    source: string;
    reviewedAt: string | null;
    comparisonScore: number | null;
  }>;
  /** Purchase links for matched medications (retailer search URLs). */
  purchaseLinks: Array<{
    medicationId: number;
    retailerName: string;
    retailerSlug: string;
    url: string;
    affiliateUrl: string | null;
    price: string | null;
    priceCurrency: string;
    linkId: number;
  }>;
}

interface TrendAnalysisDbRow {
  trend_topic_id: number;
  understanding_jsonb: unknown;
  sources_jsonb: unknown;
  synthesis_jsonb: unknown;
  product_matches_jsonb: unknown;
  market_reaction_jsonb: unknown;
  ai_model: string;
  generated_at: string;
  pharmacist_notes: string | null;
  pharmacist_overrides: unknown;
}

/**
 * Load a published trend by slug, including the full analysis and
 * matched medication details.
 *
 * Uses the public Supabase client — RLS policies restrict to
 * `status = 'published'` rows for anon/authenticated users.
 *
 * Admins (pharmacists) get a bypass: they see reviewed AND unreviewed
 * drafts so they can preview AI-generated content before approving it
 * via the admin queue.
 */
export async function getTrendBySlug(
  slug: string
): Promise<TrendPageData | null> {
  const supabase = await createClient();
  const isAdmin = await isPharmacist();

  // 1. Fetch trend_topics by slug (RLS allows published only).
  const { data: topicData, error: topicError } = await supabase
    .from("trend_topics")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<TrendTopicDbRow>();

  if (topicError || !topicData) return null;

  // Gate unreviewed drafts to admins only. Public readers hit 404.
  if (!topicData.pharmacist_reviewed && !isAdmin) {
    return null;
  }

  const topic = dbRowToTopic(topicData);

  // 2. Fetch trend_analyses (RLS allows when parent is published).
  const { data: analysisData, error: analysisError } = await supabase
    .from("trend_analyses")
    .select("*")
    .eq("trend_topic_id", topicData.id)
    .maybeSingle<TrendAnalysisDbRow>();

  if (analysisError || !analysisData) return null;

  const analysis = {
    understandingJsonb: analysisData.understanding_jsonb,
    sourcesJsonb: analysisData.sources_jsonb,
    synthesisJsonb: analysisData.synthesis_jsonb,
    productMatchesJsonb: analysisData.product_matches_jsonb,
    marketReactionJsonb: analysisData.market_reaction_jsonb,
    aiModel: analysisData.ai_model,
    generatedAt: analysisData.generated_at,
    pharmacistNotes: analysisData.pharmacist_notes,
    pharmacistOverrides: analysisData.pharmacist_overrides,
  };

  // 3. If product_matches_jsonb has medication IDs, fetch full rows.
  const productMatches = Array.isArray(analysis.productMatchesJsonb)
    ? (analysis.productMatchesJsonb as Array<{ medicationId?: number }>)
    : [];
  const medIds = productMatches
    .map((m) => m.medicationId)
    .filter((id): id is number => typeof id === "number");

  let matchedMedications: TrendPageData["matchedMedications"] = [];
  if (medIds.length > 0) {
    const { data: medData } = await supabase
      .from("medications")
      .select(
        "id, name, slug, generic_name, brand_names, description, image_url, price_range, recommended_for, dosage_forms, warnings, side_effects, pros, cons, verdict, ingredient_analysis, source, reviewed_at, comparison_score"
      )
      .in("id", medIds);

    if (medData) {
      matchedMedications = (
        medData as Array<{
          id: number;
          name: string;
          slug: string;
          generic_name: string | null;
          brand_names: string[] | null;
          description: string | null;
          image_url: string | null;
          price_range: string | null;
          recommended_for: string[] | null;
          dosage_forms: string[] | null;
          warnings: string | null;
          side_effects: string | null;
          pros: unknown;
          cons: unknown;
          verdict: string | null;
          ingredient_analysis: unknown;
          source: string;
          reviewed_at: string | null;
          comparison_score: number | null;
        }>
      ).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        genericName: row.generic_name,
        brandNames: row.brand_names,
        description: row.description,
        imageUrl: row.image_url,
        priceRange: row.price_range,
        recommendedFor: row.recommended_for,
        dosageForms: row.dosage_forms,
        warnings: row.warnings,
        sideEffects: row.side_effects,
        pros: row.pros,
        cons: row.cons,
        verdict: row.verdict,
        ingredientAnalysis: row.ingredient_analysis,
        source: row.source,
        reviewedAt: row.reviewed_at,
        comparisonScore: row.comparison_score,
      }));
    }
  }

  // 4. Fetch purchase links for matched medications
  let purchaseLinks: Array<{
    medicationId: number;
    retailerName: string;
    retailerSlug: string;
    url: string;
    affiliateUrl: string | null;
    price: string | null;
    priceCurrency: string;
    linkId: number;
  }> = [];

  if (medIds.length > 0) {
    const { data: linkData } = await supabase
      .from("product_purchase_links")
      .select("*, retailers(name, slug)")
      .in("medication_id", medIds)
      .eq("is_active", true)
      .order("sort_order");

    if (linkData) {
      purchaseLinks = linkData.map(
        (r: Record<string, unknown>) => {
          const retailer = r.retailers as { name: string; slug: string } | null;
          return {
            medicationId: r.medication_id as number,
            retailerName: retailer?.name ?? "Unknown",
            retailerSlug: retailer?.slug ?? "",
            url: r.url as string,
            affiliateUrl: (r.affiliate_url as string) ?? null,
            price: r.price != null ? String(r.price) : null,
            priceCurrency: (r.price_currency as string) ?? "USD",
            linkId: r.id as number,
          };
        }
      );
    }
  }

  return { topic, analysis, matchedMedications, purchaseLinks };
}

/**
 * Return all reviewed+published trend slugs for `generateStaticParams`
 * and sitemap generation. Unreviewed drafts are excluded so they don't
 * show up in the public sitemap.
 */
export async function getPublishedTrendSlugs(): Promise<string[]> {
  // Use admin client because generateStaticParams runs at build
  // time without an HTTP request (no cookies available).
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("trend_topics")
    .select("slug")
    .eq("status", "published")
    .eq("pharmacist_reviewed", true)
    .not("slug", "is", null);

  return (data ?? [])
    .map((r: { slug: string | null }) => r.slug)
    .filter((s): s is string => typeof s === "string");
}
