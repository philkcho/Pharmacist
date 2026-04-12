import type { SourceFragment } from "@/lib/ai/types";
import { passesTierPolicy } from "@/lib/references/category-source-map";
import type {
  FetcherResult,
  RetrievalInput,
  RetrievalResult,
  SourceFetcher,
} from "./types";

/**
 * Merge + rank + cap the outputs of every Layer 2 fetcher.
 *
 * Pipeline:
 *   1. Fan-out to all fetchers with `Promise.allSettled` so a single
 *      slow/failed fetcher never blocks the rest.
 *   2. Flatten into one SourceFragment array.
 *   3. Dedupe by URL (keeping the highest-relevance duplicate).
 *   4. Sort by Tier (1 best) then relevanceScore (desc).
 *   5. Apply Tier-3 policy: Tier 3 sources (e.g. EWG) are dropped
 *      unless the deduped list also contains at least one Tier 1 or
 *      Tier 2 source overall.
 *   6. Cap at `limit` (default 8).
 *   7. Renumber `id` in the final array so Layer 3 claim citations
 *      can use a stable 0-based index.
 */

const DEFAULT_LIMIT = 8;

function dedupeByUrl(fragments: SourceFragment[]): SourceFragment[] {
  const byUrl = new Map<string, SourceFragment>();
  for (const frag of fragments) {
    const existing = byUrl.get(frag.url);
    if (!existing || frag.relevanceScore > existing.relevanceScore) {
      byUrl.set(frag.url, frag);
    }
  }
  return Array.from(byUrl.values());
}

function sortForRanking(fragments: SourceFragment[]): SourceFragment[] {
  return [...fragments].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.relevanceScore - a.relevanceScore;
  });
}

/**
 * Enforce the policy that Tier 3 sources cannot be cited alone.
 * This mirrors `passesTierPolicy` in category-source-map.ts but
 * operates on fragment arrays rather than source-type arrays.
 *
 * Implementation: if ANY Tier 1 or Tier 2 fragment exists in the
 * overall set, Tier 3 fragments are allowed to stay. Otherwise
 * they're dropped (we refuse to present Tier 3 as standalone
 * evidence).
 */
function applyTierPolicy(fragments: SourceFragment[]): SourceFragment[] {
  if (fragments.length === 0) return fragments;
  const sourceTypes = fragments.map((f) => f.sourceType);
  if (passesTierPolicy(sourceTypes)) return fragments;
  return fragments.filter((f) => f.tier <= 2);
}

function renumber(fragments: SourceFragment[]): SourceFragment[] {
  return fragments.map((frag, index) => ({ ...frag, id: index }));
}

/**
 * Run every fetcher and combine their outputs.
 *
 * The fetchers array is passed in explicitly so tests can inject
 * mocks and so the Phase E analysis worker can compose which
 * fetchers to use per question type (e.g. dosage questions skip
 * PubMed and go FDA-only).
 */
export async function runRetrieval(
  fetchers: SourceFetcher[],
  input: RetrievalInput
): Promise<RetrievalResult> {
  const settled = await Promise.allSettled(fetchers.map((f) => f(input)));

  const allFragments: SourceFragment[] = [];
  const errors: string[] = [];

  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      const fetcherResult: FetcherResult = outcome.value;
      allFragments.push(...fetcherResult.fragments);
      errors.push(
        ...fetcherResult.errors.map((e) => `[${fetcherResult.source}] ${e}`)
      );
    } else {
      errors.push(
        `[fetcher ${index}] ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`
      );
    }
  });

  const deduped = dedupeByUrl(allFragments);
  const filtered = applyTierPolicy(deduped);
  const sorted = sortForRanking(filtered);
  const limit = input.limit ?? DEFAULT_LIMIT;
  const capped = sorted.slice(0, limit);
  const numbered = renumber(capped);

  return {
    fragments: numbered,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}
