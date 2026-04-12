/**
 * Retrieval-layer types.
 *
 * Each fetcher (db, fda, pubmed, curated) implements the
 * `SourceFetcher` contract and returns an array of SourceFragments
 * that merge-and-rank.ts then combines into the final Layer 2 output.
 *
 * Fetchers must be resilient: individual failures (rate limits,
 * bad HTML, 5xx) return an empty array + an error message, they
 * never throw. The pipeline aggregates errors and surfaces them
 * alongside the successful fragments.
 */

import type { SourceFragment, Entities } from "@/lib/ai/types";

export interface RetrievalInput {
  /** The raw query (trend phrase or user question). */
  query: string;
  /** Layer 1 output — entities used to drive retrieval. */
  entities: Entities;
  /** Category slug hint used for CATEGORY_SOURCE_PRIORITY lookups. */
  categoryHint?: string;
  /** Max number of fragments in the final merged output. Default 8. */
  limit?: number;
}

/**
 * What each fetcher returns. Errors are attached to the result
 * (not thrown) so the pipeline can report partial success.
 */
export interface FetcherResult {
  fragments: SourceFragment[];
  errors: string[];
  /** Short source identifier, e.g. "db", "fda", "pubmed". */
  source: string;
}

/**
 * Full Layer 2 retrieval output, after merging every fetcher.
 */
export interface RetrievalResult {
  fragments: SourceFragment[];
  /** Errors surfaced from individual fetchers, namespaced by source. */
  errors: string[];
  /** Timestamp of the outermost retrieval call. */
  fetchedAt: string;
}

/**
 * All fetchers share this signature so the top-level pipeline can
 * fan-out with Promise.allSettled and merge the results uniformly.
 */
export type SourceFetcher = (input: RetrievalInput) => Promise<FetcherResult>;
