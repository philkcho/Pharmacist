/**
 * Shared article-reference fetcher.
 *
 * Used by safety articles, ingredient guides, and product comparisons
 * to gather Tier 1 (FDA DailyMed) + Tier 2 (PubMed review) citations
 * they can render in a "References" section.
 *
 * Design:
 *   - FDA retriever only returns data for OTC drug labels — supplement/
 *     cosmetic inputs get 0 FDA fragments and fall back to PubMed alone.
 *   - PubMed retriever is biased toward review/meta-analysis articles
 *     (see `buildPubmedQuery`). We try progressively simpler queries
 *     because the review filter zero-matches full brand names.
 *   - Real URLs only — AI is never asked to invent citations, which
 *     eliminates the citation-hallucination risk for YMYL content.
 */

import { searchPubmed } from "@/lib/retrieval/search-pubmed";
import { fetchFdaFacts } from "@/lib/retrieval/fetch-fda-facts";
import { emptyEntities, type SourceFragment } from "@/lib/ai/types";

export interface ArticleReference {
  title: string;
  url: string;
  kind: "pubmed" | "fda";
  citation?: string;
  year?: string;
}

export interface FetchReferencesInput {
  /** Primary term for PubMed search (e.g. generic ingredient name). */
  primaryTerm: string;
  /** Fallback terms tried in order if primary has 0 PubMed hits. */
  fallbackTerms?: string[];
  /** Drug/ingredient names sent to FDA lookup. FDA is OTC-drug only. */
  drugTerms?: string[];
  /** Max references total. Default 6 (1–2 FDA + 4–5 PubMed). */
  limit?: number;
}

// Lightweight ingredient-name guesser for products/comparisons lacking
// structured genericName/activeIngredients. Covers ~45 common OTC /
// supplement / skincare actives so PubMed search has something to bite.
const COMMON_INGREDIENT_TERMS: readonly string[] = [
  "vitamin c",
  "vitamin d",
  "vitamin e",
  "vitamin k",
  "vitamin b12",
  "vitamin a",
  "omega-3",
  "fish oil",
  "probiotics",
  "melatonin",
  "magnesium",
  "zinc",
  "iron",
  "calcium",
  "biotin",
  "collagen",
  "glucosamine",
  "turmeric",
  "curcumin",
  "ashwagandha",
  "ginseng",
  "coq10",
  "creatine",
  "niacinamide",
  "hyaluronic acid",
  "retinol",
  "retinoid",
  "salicylic acid",
  "glycolic acid",
  "lactic acid",
  "azelaic acid",
  "benzoyl peroxide",
  "ceramide",
  "acetaminophen",
  "ibuprofen",
  "naproxen",
  "aspirin",
  "diphenhydramine",
  "loratadine",
  "cetirizine",
  "famotidine",
  "omeprazole",
  "esomeprazole",
  "polyethylene glycol",
  "spermidine",
];

export function extractLikelyIngredient(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of COMMON_INGREDIENT_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}

export async function fetchArticleReferences(
  input: FetchReferencesInput
): Promise<ArticleReference[]> {
  const limit = input.limit ?? 6;
  const [pubmedRefs, fdaRefs] = await Promise.all([
    fetchPubmedRefs(input.primaryTerm, input.fallbackTerms ?? []),
    fetchFdaRefs(input.drugTerms ?? []),
  ]);

  // FDA first — Tier 1 authority weighs more on YMYL pages than PubMed
  // reviews, and we want it to be the first thing a reader sees.
  return [...fdaRefs, ...pubmedRefs].slice(0, limit);
}

async function fetchPubmedRefs(
  primary: string,
  fallbacks: string[]
): Promise<ArticleReference[]> {
  const queries = [primary, ...fallbacks].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );

  for (const query of queries) {
    try {
      const { fragments } = await searchPubmed({
        query,
        entities: { ...emptyEntities(), genericIngredients: [query] },
        limit: 6,
      });
      if (fragments.length > 0) {
        return fragments.slice(0, 5).map(fragmentToReference);
      }
    } catch (err) {
      console.warn(
        "[references] PubMed fetch failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
  return [];
}

async function fetchFdaRefs(drugTerms: string[]): Promise<ArticleReference[]> {
  const terms = Array.from(
    new Set(
      drugTerms
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0)
    )
  );
  if (terms.length === 0) return [];

  try {
    const { fragments } = await fetchFdaFacts({
      query: terms[0],
      entities: {
        ...emptyEntities(),
        drugs: terms,
      },
      limit: 6,
    });

    // Collapse multi-section fragments (Warnings, Dosing, Indications…)
    // to one reference per unique DailyMed URL — keep the highest-
    // relevance fragment per URL (Warnings scores 90).
    const bestByUrl = new Map<string, SourceFragment>();
    for (const frag of fragments) {
      const existing = bestByUrl.get(frag.url);
      if (!existing || frag.relevanceScore > existing.relevanceScore) {
        bestByUrl.set(frag.url, frag);
      }
    }

    return Array.from(bestByUrl.values())
      .map((f) => ({
        title: cleanFdaTitle(f),
        url: f.url,
        kind: "fda" as const,
        citation: f.citation,
        year: f.publishedAt,
      }))
      .slice(0, 2);
  } catch (err) {
    console.warn(
      "[references] FDA fetch failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

function fragmentToReference(f: SourceFragment): ArticleReference {
  const isFda = f.sourceType.startsWith("fda_");
  return {
    title: f.title,
    url: f.url,
    kind: isFda ? "fda" : "pubmed",
    citation: f.citation,
    year: f.publishedAt,
  };
}

function cleanFdaTitle(f: SourceFragment): string {
  const match = f.title.match(/FDA\s[^—]+—\s*(.+)$/);
  const subject = match ? match[1].trim() : f.title;
  return `FDA Drug Label — ${subject}`;
}
