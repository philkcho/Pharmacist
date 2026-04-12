/**
 * Category → seed keyword map for Google Trends ingestion.
 *
 * The unofficial `google-trends-api` package exposes `relatedQueries`
 * which returns ranked `top` and `rising` lists around a seed
 * keyword. To ingest "what's trending in Health this week" we
 * pick a small set of representative seeds per category and
 * collect their top/rising related queries.
 *
 * This is a heuristic. Over time the list should expand to cover
 * more of each category, and the analysis pipeline's dedup window
 * (4 weeks) prevents seeds from flooding the queue with repeats.
 *
 * Pharma queries naturally land in the Health bucket — we do not
 * maintain a separate category (locked-in decision in plan file).
 */

export type TrendCategory = "health" | "beauty_fitness" | "other";

export const CATEGORY_SEEDS: Record<
  Exclude<TrendCategory, "other">,
  string[]
> = {
  health: [
    "otc medication",
    "pain reliever",
    "vitamin supplement",
  ],
  beauty_fitness: [
    "skincare routine",
    "sunscreen",
    "moisturizer",
  ],
};

/**
 * Categories the weekly ingestion run covers. Kept separate from the
 * full enum (which includes `other`) so that we never ingest "other"
 * directly — it's only used as a fallback bucket for future UI.
 */
export const INGESTION_CATEGORIES: ReadonlyArray<
  Exclude<TrendCategory, "other">
> = ["health", "beauty_fitness"] as const;
