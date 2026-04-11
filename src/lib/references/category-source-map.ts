/**
 * Authoritative source whitelist for medication references.
 *
 * Kept in lockstep with:
 *   - `public.medication_source_type` enum in migration 003
 *   - `medicationSourceTypeEnum` in `src/lib/db/schema.ts`
 *
 * Any time a value is added here, both locations must be updated.
 *
 * Usage:
 *   - AI prompts inject `CATEGORY_SOURCE_PRIORITY[categorySlug]` so Gemini
 *     picks the right authority for each category (e.g. AAD for skincare).
 *   - Admin UI highlights the matching Tier 2 sources when a pharmacist
 *     adds references to a medication.
 *   - `SOURCE_TIER_LEVEL` is used server-side to enforce the rule that
 *     Tier 3 sources cannot be cited alone.
 *
 * See `docs/compare-feature.md` section 13.2 for the full rationale.
 */

export type SourceType =
  // ── Tier 1: Universal primary sources ──
  | "fda_label"
  | "fda_guidance"
  | "fda_mocra"
  | "pubmed"
  | "cochrane"
  | "cdc"
  | "who"
  | "nih_ods"
  | "nih_medlineplus"
  | "nih_nccih"
  | "ema"
  // ── Tier 2: Category-specific expert authorities ──
  | "aad"
  | "dermnet_nz"
  | "cir"
  | "eu_cosing"
  | "skin_cancer_foundation"
  | "usp"
  | "nsf"
  | "consumerlab"
  | "examine"
  | "ada_seal"
  | "aap"
  | "healthychildren"
  | "aao"
  | "nih_nei"
  | "aga"
  | "isapp"
  | "red_cross"
  | "aha"
  | "aasm"
  // ── Tier 3: Conditional (never cited alone) ──
  | "ewg"
  // ── Fallback ──
  | "other_authoritative";

/** Human-readable label for UI badges and methodology page. */
export const SOURCE_LABEL: Record<SourceType, string> = {
  fda_label: "FDA Drug Label",
  fda_guidance: "FDA Guidance",
  fda_mocra: "FDA MoCRA",
  pubmed: "PubMed",
  cochrane: "Cochrane Review",
  cdc: "CDC",
  who: "WHO",
  nih_ods: "NIH ODS",
  nih_medlineplus: "NIH MedlinePlus",
  nih_nccih: "NIH NCCIH",
  ema: "EMA",

  aad: "AAD",
  dermnet_nz: "DermNet NZ",
  cir: "Cosmetic Ingredient Review",
  eu_cosing: "EU CosIng",
  skin_cancer_foundation: "Skin Cancer Foundation",
  usp: "USP",
  nsf: "NSF",
  consumerlab: "ConsumerLab",
  examine: "Examine.com",
  ada_seal: "ADA Seal",
  aap: "AAP",
  healthychildren: "HealthyChildren.org",
  aao: "AAO",
  nih_nei: "National Eye Institute",
  aga: "AGA",
  isapp: "ISAPP",
  red_cross: "American Red Cross",
  aha: "American Heart Association",
  aasm: "AASM",

  ewg: "EWG Skin Deep",

  other_authoritative: "Other authoritative source",
};

/** Tier level for each source type. Enforced in admin review workflow. */
export const SOURCE_TIER_LEVEL: Record<SourceType, 1 | 2 | 3> = {
  // Tier 1
  fda_label: 1,
  fda_guidance: 1,
  fda_mocra: 1,
  pubmed: 1,
  cochrane: 1,
  cdc: 1,
  who: 1,
  nih_ods: 1,
  nih_medlineplus: 1,
  nih_nccih: 1,
  ema: 1,
  // Tier 2
  aad: 2,
  dermnet_nz: 2,
  cir: 2,
  eu_cosing: 2,
  skin_cancer_foundation: 2,
  usp: 2,
  nsf: 2,
  consumerlab: 2,
  examine: 2,
  ada_seal: 2,
  aap: 2,
  healthychildren: 2,
  aao: 2,
  nih_nei: 2,
  aga: 2,
  isapp: 2,
  red_cross: 2,
  aha: 2,
  aasm: 2,
  // Tier 3
  ewg: 3,
  // Fallback — treated as Tier 2 by default; pharmacist must justify in review
  other_authoritative: 2,
};

export const TIER_1_SOURCES: ReadonlySet<SourceType> = new Set(
  (Object.keys(SOURCE_TIER_LEVEL) as SourceType[]).filter(
    (s) => SOURCE_TIER_LEVEL[s] === 1
  )
);

export const TIER_3_SOURCES: ReadonlySet<SourceType> = new Set(
  (Object.keys(SOURCE_TIER_LEVEL) as SourceType[]).filter(
    (s) => SOURCE_TIER_LEVEL[s] === 3
  )
);

/**
 * Per-category source priority. AI prompts and admin UI use this to suggest
 * the most relevant Tier 2 authorities before falling back to Tier 1.
 *
 * Keys should match `categories.slug` in the database. Categories without an
 * explicit mapping fall back to Tier 1 only (see `getSourcePriority`).
 */
export const CATEGORY_SOURCE_PRIORITY: Record<string, SourceType[]> = {
  // ── Pharmaceutical drugs — FDA-centric ──
  "pain-relief": ["fda_label", "pubmed", "cochrane", "cdc", "aha"],
  "cold-flu": ["fda_label", "cdc", "pubmed", "cochrane", "who"],
  allergy: ["fda_label", "aad", "pubmed", "cochrane"],

  // ── Cosmetics & skincare — dermatology-first ──
  "skin-care-beauty": [
    "aad",
    "cir",
    "dermnet_nz",
    "pubmed",
    "eu_cosing",
    "fda_mocra",
    "skin_cancer_foundation",
  ],
  "skin-care": [
    "aad",
    "cir",
    "dermnet_nz",
    "pubmed",
    "eu_cosing",
    "fda_mocra",
  ],

  // ── Supplements & vitamins — NIH ODS is the top authority ──
  "vitamins-supplements": [
    "nih_ods",
    "pubmed",
    "cochrane",
    "usp",
    "nsf",
    "examine",
  ],

  // ── Digestive health — GI society + FDA + probiotics body ──
  "digestive-health": ["fda_label", "aga", "nih_ods", "isapp", "pubmed"],

  // ── Oral care — ADA Seal is the gold standard ──
  "oral-care": ["ada_seal", "pubmed", "aad", "fda_label"],

  // ── Sleep — sleep medicine society + NIH complementary health ──
  "sleep-relaxation": ["aasm", "nih_nccih", "pubmed", "cochrane"],

  // ── First aid — Red Cross / AHA guidelines ──
  "first-aid": ["red_cross", "aha", "aad", "fda_label", "pubmed"],

  // ── Future categories (reserved) ──
  "eye-care": ["aao", "nih_nei", "pubmed", "fda_label"],
  "baby-care": ["aap", "healthychildren", "cdc", "fda_label"],
};

/**
 * Get the priority list of source types for a given category slug.
 *
 * Falls back to Tier 1 universal sources if the category has no specific
 * mapping. This keeps the review flow working for new categories without
 * a code change (though you should add an entry to CATEGORY_SOURCE_PRIORITY
 * when introducing a new category in production).
 */
export function getSourcePriority(categorySlug: string): SourceType[] {
  return (
    CATEGORY_SOURCE_PRIORITY[categorySlug] ?? [
      "fda_label",
      "pubmed",
      "cochrane",
      "cdc",
      "nih_medlineplus",
    ]
  );
}

/**
 * Check whether the set of sources passes the Tier 3 policy:
 * a Tier 3 source (e.g. EWG) can only be cited when at least one
 * Tier 1 or Tier 2 source supports the same claim.
 */
export function passesTierPolicy(sourceTypes: SourceType[]): boolean {
  if (sourceTypes.length === 0) return false;
  const hasT3 = sourceTypes.some((s) => SOURCE_TIER_LEVEL[s] === 3);
  if (!hasT3) return true;
  return sourceTypes.some((s) => SOURCE_TIER_LEVEL[s] <= 2);
}
