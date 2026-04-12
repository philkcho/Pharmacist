import { createClient } from "@/lib/supabase/server";

/**
 * Duplicate-detection window for weekly trend ingestion.
 *
 * A trend that was ingested in the last N weeks is considered a
 * duplicate even if Google Trends returns it again, so we don't
 * spam the queue with the same "tylenol safety" topic every week
 * forever.
 *
 * Chosen value: 4 weeks. Long enough to feel fresh, short enough
 * that recurring seasonal topics (cold medicine in January,
 * sunscreen in July) get a second pass the following month.
 */
export const DEDUP_WEEKS = 4;

/**
 * Returns true if `normalized_query` already appears in trend_topics
 * within the last `DEDUP_WEEKS` weeks. This is a soft check — the
 * `UNIQUE (source, normalized_query, detected_week)` DB constraint
 * is the hard guarantee against same-week dupes.
 *
 * Failures fall back to `false` (treat as not duplicate) so an
 * unrelated Supabase hiccup never silently blocks ingestion. The
 * unique-constraint-violation path in `ingestWeeklyTrends` still
 * catches any races.
 */
export async function isDuplicateRecent(
  normalizedQuery: string
): Promise<boolean> {
  if (!normalizedQuery.trim()) return false;

  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - DEDUP_WEEKS * 7);

  const { data, error } = await supabase
    .from("trend_topics")
    .select("id")
    .eq("normalized_query", normalizedQuery)
    .gte("detected_at", cutoff.toISOString())
    .limit(1);

  if (error) {
    console.warn(
      `[trends/dedupe] check failed for "${normalizedQuery}":`,
      error.message
    );
    return false;
  }
  return (data?.length ?? 0) > 0;
}
