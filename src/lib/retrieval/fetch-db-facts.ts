import {
  getOrFetchMedication,
  getMedicationReferences,
  type MedicationReferenceRow,
} from "@/lib/actions/medications";
import type { SourceFragment } from "@/lib/ai/types";
import type { SourceType } from "@/lib/references/category-source-map";
import { SOURCE_TIER_LEVEL } from "@/lib/references/category-source-map";
import type { FetcherResult, RetrievalInput, SourceFetcher } from "./types";

/**
 * Retrieval from our own curated data: the `medications` table +
 * `medication_references` table seeded by pharmacists (or the
 * Phase 3 compare workflow).
 *
 * This is ALWAYS the highest-authority path — pharmacist review
 * has already stamped these references as acceptable, so they
 * arrive pre-vetted and can be ranked at the top of Layer 2.
 */

/**
 * Convert a DB-stored `MedicationReferenceRow` into the canonical
 * `SourceFragment` shape used by the rest of the retrieval pipeline.
 *
 * `id` is a placeholder — it'll be renumbered by `merge-and-rank`
 * once all fetchers return, so Layer 3 claim citations can use a
 * stable index across the whole retrieval output.
 */
function rowToFragment(
  row: MedicationReferenceRow,
  medicationName: string
): SourceFragment {
  const tier = (SOURCE_TIER_LEVEL[row.source_type as SourceType] ?? 2) as
    | 1
    | 2
    | 3;

  const authorYear = [row.authors, row.published_at]
    .filter(Boolean)
    .join(", ");
  const fallbackCitation = authorYear.length > 0 ? authorYear : row.title;

  return {
    id: 0, // renumbered later
    tier,
    sourceType: row.source_type as SourceType,
    title: row.title,
    url: row.url,
    quote: row.citation_text ?? `${row.title} — cited for ${medicationName}.`,
    citation: row.citation_text ?? fallbackCitation,
    authors: row.authors ?? undefined,
    publishedAt: row.published_at ?? undefined,
    retrievedAt: new Date().toISOString(),
    // Curated DB references are hand-picked, so we start them
    // with a high baseline relevance. merge-and-rank will
    // apply additional ranking within the tier.
    relevanceScore: 85,
  };
}

/**
 * For each drug/ingredient entity we try:
 *   1. `getOrFetchMedication(name)` — DB lookup that transparently
 *      falls back to openFDA + upsert on miss
 *   2. `getMedicationReferences(id)` — hand-curated references
 *
 * Only pharmacist-review stamped references are returned. If a
 * medication has zero references (e.g. newly synced from FDA
 * without manual curation) this fetcher returns nothing for it —
 * the FDA fetcher will still pick it up.
 */
export const fetchDbFacts: SourceFetcher = async (
  input: RetrievalInput
): Promise<FetcherResult> => {
  const result: FetcherResult = {
    fragments: [],
    errors: [],
    source: "db",
  };

  // De-dup across drug + genericIngredient entity lists so we don't
  // do two lookups for the same substance (common: "Tylenol" in
  // drugs, "acetaminophen" in genericIngredients — both resolve
  // to the same medication row).
  const searchTerms = Array.from(
    new Set(
      [...input.entities.drugs, ...input.entities.genericIngredients]
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  if (searchTerms.length === 0) {
    return result;
  }

  for (const term of searchTerms) {
    let medication;
    try {
      medication = await getOrFetchMedication(term);
    } catch (err) {
      result.errors.push(
        `getOrFetchMedication("${term}") threw: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
    if (!medication) continue;

    let refs: MedicationReferenceRow[] = [];
    try {
      refs = await getMedicationReferences(medication.id);
    } catch (err) {
      result.errors.push(
        `getMedicationReferences(${medication.id}) threw: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    for (const row of refs) {
      result.fragments.push(rowToFragment(row, medication.name));
    }
  }

  return result;
};
