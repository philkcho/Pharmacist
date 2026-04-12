/**
 * Shared types for the three-layer answer system.
 *
 * These types are consumed by:
 *   - Layer 1: src/lib/ai/classify-topic.ts (Phase D)
 *   - Layer 2: src/lib/retrieval/**
 *   - Layer 3: src/lib/ai/synthesize-analysis.ts (Phase D)
 *   - Admin + public pages that render the three layers
 *
 * Design goal: one AnalysisResult shape works for both
 *   (a) trend pipeline (ingested from Google Trends, Phase E)
 *   (b) Phase 2 user Q&A (Phase I)
 * so no component or prompt has to know which path produced it.
 */

import type { SourceType } from "@/lib/references/category-source-map";

// ============================================================
// Layer 1 — question / topic understanding
// ============================================================

export type TopicType =
  | "product_info"          // "what is tylenol"
  | "safety_check"          // "is tylenol safe with alcohol"
  | "dosage"                // "how much tylenol for a 6 year old"
  | "interaction"           // "tylenol + advil together"
  | "symptom_relief"        // "what helps headaches"
  | "comparison"            // "tylenol vs advil"
  | "population_specific"   // "is this safe in pregnancy"
  | "general_education"     // "what is acetaminophen"
  | "out_of_scope";         // non-OTC / non-health

export interface Entities {
  /** Brand names from packaging (e.g. "Tylenol", "Zyrtec", "Farmacy Honey Halo"). */
  drugs: string[];
  /** Generic / active ingredient names (e.g. "acetaminophen", "niacinamide"). */
  genericIngredients: string[];
  /** Symptoms mentioned in the query ("headache", "congestion", "dry skin"). */
  symptoms: string[];
  /** Population qualifiers ("pregnant", "children under 6", "elderly"). */
  populations: string[];
  /** Health conditions ("liver disease", "hypertension", "eczema"). */
  conditions: string[];
  /** Substances the drug might interact with ("alcohol", "caffeine", "MAOI"). */
  substances: string[];
  /**
   * Category slugs from the existing `categories` table
   * (e.g. "pain-relief", "skin-care-beauty"). Used to drive
   * CATEGORY_SOURCE_PRIORITY in the retrieval step.
   */
  categorySlugs: string[];
}

export function emptyEntities(): Entities {
  return {
    drugs: [],
    genericIngredients: [],
    symptoms: [],
    populations: [],
    conditions: [],
    substances: [],
    categorySlugs: [],
  };
}

export interface TopicUnderstanding {
  originalQuery: string;
  normalizedQuery: string;
  topicType: TopicType;
  entities: Entities;
  /** One-liner describing the user's intent in plain English. */
  intent: string;
}

// ============================================================
// Layer 2 — retrieved source fragments
// ============================================================

/**
 * One authoritative source fragment that supports (or contradicts)
 * a claim. The `quote` field carries the 1–3 sentences that are
 * actually relevant to the topic — not the entire source document.
 *
 * `id` is a stable index within a single AnalysisResult.sources
 * array. Layer 3 Claim objects reference source fragments by this
 * id, NOT by URL — the UI resolves id → fragment at render time.
 */
export interface SourceFragment {
  id: number;
  tier: 1 | 2 | 3;
  sourceType: SourceType;
  title: string;
  url: string;
  /** The specific passage that answers the topic (1–3 sentences). */
  quote: string;
  /** Full citation string, e.g. "FDA DailyMed, 2024". */
  citation: string;
  authors?: string;
  /** ISO 8601 date or year string. */
  publishedAt?: string;
  /** When we fetched this fragment, for cache freshness and audit. */
  retrievedAt: string;
  /** 0–100. Used by merge-and-rank to order within a tier. */
  relevanceScore: number;
}

// ============================================================
// Layer 3 — synthesis output
// ============================================================

export interface Claim {
  /** One sentence of the synthesized answer. */
  text: string;
  /** SourceFragment.id values that support this claim. */
  sourceIndexes: number[];
  /** True if this sentence is AI inference not directly from a cited source. */
  isInference: boolean;
}

export interface Analysis {
  /** Full plain-English answer with inline [1][2] citation markers. */
  answer: string;
  /** Same content as `answer`, segmented per sentence with citation validation. */
  claims: Claim[];
  confidence: "high" | "medium" | "low";
  /** Known gaps, e.g. "No data for pediatric use under 6". */
  limitations: string[];
  /** 0–4 suggested follow-up questions, consumed by the UI chip row. */
  followUpQuestions: string[];
  /**
   * ~200–250 word plain-English lead for the trending article page
   * (section 1 "The 1-Minute Read"). Must cover: what it is, who
   * it's for / who's talking about it, what current evidence says,
   * and 1–2 most important takeaways. Uses inline [N] citation
   * markers that resolve against the same sources array as `claims`.
   */
  leadExplanation: string;
  /**
   * 3–5 scannable bullet takeaways for the TL;DR panel (section 3).
   * Each bullet may include inline [N] citation markers.
   */
  keyTakeaways: string[];
  /**
   * 0–5 "See a doctor if..." red flags (section 6). Consumer-friendly
   * wording, no diagnosis. Empty array if the topic has no obvious
   * red flags (e.g. general skincare education).
   */
  redFlags: string[];
  /**
   * 0–3 short phrases naming *why* this query is trending right now,
   * pulled ONLY from Layer 2 sources published within the last 30
   * days. Rendered as "Possible driver: …" chips in the Hook section.
   */
  trendDrivers: string[];
}

// ============================================================
// Product matching + market reaction (trend pipeline extensions)
// ============================================================

export interface ProductMatch {
  /** FK to medications.id */
  medicationId: number;
  name: string;
  slug: string;
  /** Why the analysis considered this product relevant. */
  reason: string;
  /** Active ingredient highlights, short phrases suitable for a chip list. */
  ingredientHighlights: string[];
}

export interface MarketReaction {
  /** "Related queries" from Google Trends, used as a market-pulse proxy. */
  relatedQueries: string[];
  /** Optional week-over-week growth indicator (0–100). */
  velocityScore?: number;
  /** Optional news / Reddit mentions (Phase H hardening). */
  newsMentions?: Array<{
    title: string;
    source: string;
    url: string;
    publishedAt: string;
  }>;
  /**
   * Top adverse reactions reported to FDA FAERS in the past 12 months
   * for the matched drug(s). Rendered in section 6 (Safety). Pharma
   * only — empty for beauty trends.
   */
  topReactions?: Array<{
    drugName: string;
    reactions: Array<{ term: string; count: number }>;
  }>;
  /**
   * Active FDA recalls (any class) touching the matched drug(s).
   * Rendered as a warning banner in section 2 ("Why now"). Pharma only.
   */
  activeRecalls?: Array<{
    drugName: string;
    recallClass: "Class I" | "Class II" | "Class III" | "Unknown";
    reason: string;
    firm: string;
    initiationDate: string;
    url: string;
  }>;
  /**
   * Recent PubMed studies (last 30 days) relevant to the query.
   * Rendered in section 2 "Why now" as a chronological list. These
   * are *also* emitted as SourceFragments by the recent-pubmed
   * retriever so the synthesizer can cite them — this field is just
   * the friendly, pre-sorted, date-forward view for the UI.
   */
  recentPubmedStudies?: Array<{
    pmid: string;
    title: string;
    journal: string;
    publishedAt: string;
    url: string;
  }>;
}

// ============================================================
// Canonical response shape
// ============================================================

export interface AnalysisResult {
  understanding: TopicUnderstanding;
  /** Tier-ordered source fragments, capped by merge-and-rank (default 8). */
  sources: SourceFragment[];
  /** Pharmacist-reviewed medications matched by entity overlap. */
  productMatches: ProductMatch[];
  /** Google Trends related-queries + optional news. */
  marketReaction: MarketReaction;
  /** Null when refused or when Layer 2 returned zero sources. */
  synthesis: Analysis | null;
  refusal?: {
    reason: "out_of_scope" | "dangerous" | "no_sources" | "requires_doctor";
    message: string;
  };
  generatedAt: string;
}
