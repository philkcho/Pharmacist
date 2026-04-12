import type { SourceFragment } from "@/lib/ai/types";
import type { FetcherResult, RetrievalInput, SourceFetcher } from "./types";

/**
 * NCBI PubMed E-utilities client.
 *
 * Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/
 * Rate limits:
 *   - Anonymous: 3 requests/second
 *   - With PUBMED_API_KEY: 10 requests/second
 *
 * Two-step retrieval:
 *   1. esearch.fcgi → returns PMIDs matching the query
 *   2. esummary.fcgi → returns title/authors/journal/year for each PMID
 *
 * We filter to review articles and systematic reviews where
 * possible because the LLM synthesis layer benefits from
 * already-distilled evidence rather than individual primary studies.
 *
 * This fetcher is intentionally conservative:
 *   - At most 1 esearch + 1 esummary call per retrieval
 *   - At most 5 PMIDs per query
 *   - Fails gracefully — a 503 or network error logs into
 *     result.errors but returns zero fragments
 *
 * PubMed responses are cached by Next.js fetch for 24h to avoid
 * hitting the rate limit on repeat queries from the trend
 * pipeline + (later) Phase 2 user Q&A.
 */

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const ONE_DAY_SECONDS = 60 * 60 * 24;

interface EsearchResult {
  esearchresult?: {
    idlist?: string[];
    count?: string;
    errorlist?: {
      phrasesnotfound?: string[];
    };
  };
}

interface EsummaryAuthor {
  name?: string;
  authtype?: string;
}

interface EsummaryDocsum {
  uid?: string;
  title?: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  authors?: EsummaryAuthor[];
  pubtype?: string[];
}

interface EsummaryResult {
  result?: {
    uids?: string[];
    [pmid: string]: EsummaryDocsum | string[] | undefined;
  };
}

/**
 * Build a PubMed query string that biases toward high-quality
 * evidence. For the trend pipeline we prefer:
 *   - Review articles (publication type filter)
 *   - Systematic reviews / meta-analyses
 *   - English
 *   - Past 5 years (freshness)
 *
 * We don't force ALL filters — if a query is too narrow it'll
 * return zero PMIDs and we lose the source entirely. Instead we
 * rely on PubMed's own relevance sort for the `sort=relevance`
 * parameter.
 */
function buildPubmedQuery(query: string): string {
  const cleaned = query.replace(/[^\w\s-]/g, " ").trim();
  if (!cleaned) return "";
  return `${cleaned} AND (review[PT] OR systematic[SB] OR "meta analysis"[PT]) AND english[lang]`;
}

function apiKeyParam(): string {
  const key = process.env.PUBMED_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/**
 * esearch — given a query, return up to `retmax` PMIDs.
 */
async function esearch(query: string, retmax = 5): Promise<string[]> {
  const pubmedQuery = buildPubmedQuery(query);
  if (!pubmedQuery) return [];

  const url =
    `${EUTILS_BASE}/esearch.fcgi` +
    `?db=pubmed&retmode=json&sort=relevance` +
    `&retmax=${retmax}` +
    `&term=${encodeURIComponent(pubmedQuery)}` +
    apiKeyParam();

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: ONE_DAY_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`esearch ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as EsearchResult;
  return data.esearchresult?.idlist ?? [];
}

/**
 * esummary — given PMIDs, return metadata for each.
 */
async function esummary(pmids: string[]): Promise<EsummaryDocsum[]> {
  if (pmids.length === 0) return [];

  const url =
    `${EUTILS_BASE}/esummary.fcgi` +
    `?db=pubmed&retmode=json` +
    `&id=${encodeURIComponent(pmids.join(","))}` +
    apiKeyParam();

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: ONE_DAY_SECONDS },
  });

  if (!res.ok) {
    throw new Error(
      `esummary ${res.status}: ${await res.text().catch(() => "")}`
    );
  }

  const data = (await res.json()) as EsummaryResult;
  const byUid = data.result ?? {};
  const uids = (byUid.uids as string[] | undefined) ?? pmids;

  return uids
    .map((uid) => byUid[uid])
    .filter((v): v is EsummaryDocsum => !!v && typeof v === "object");
}

/**
 * Turn an esummary docsum into a SourceFragment.
 */
function docsumToFragment(
  docsum: EsummaryDocsum,
  originalQuery: string
): SourceFragment | null {
  const pmid = docsum.uid;
  if (!pmid) return null;

  const title = docsum.title?.trim() || "PubMed article";
  const journal = docsum.fulljournalname ?? docsum.source ?? "PubMed";
  const year = docsum.pubdate ? docsum.pubdate.slice(0, 4) : undefined;
  const firstAuthors =
    docsum.authors
      ?.slice(0, 3)
      .map((a) => a.name)
      .filter((n): n is string => typeof n === "string") ?? [];
  const authorString =
    firstAuthors.length > 0
      ? firstAuthors.join(", ") +
        (docsum.authors && docsum.authors.length > 3 ? ", et al." : "")
      : undefined;

  const citationParts: string[] = [];
  if (authorString) citationParts.push(authorString);
  citationParts.push(journal);
  if (year) citationParts.push(year);
  const citation = citationParts.join(", ");

  return {
    id: 0, // renumbered by merge-and-rank
    tier: 1,
    sourceType: "pubmed",
    title,
    url: pubmedUrl(pmid),
    quote: `Peer-reviewed article in ${journal}${
      year ? ` (${year})` : ""
    } matching "${originalQuery}".`,
    citation,
    authors: authorString,
    publishedAt: year,
    retrievedAt: new Date().toISOString(),
    // Review articles start with 78. Non-review is rare here
    // because buildPubmedQuery filters for review[PT].
    relevanceScore: (docsum.pubtype ?? []).some((t) =>
      /review|meta/i.test(t)
    )
      ? 82
      : 70,
  };
}

export const searchPubmed: SourceFetcher = async (
  input: RetrievalInput
): Promise<FetcherResult> => {
  const result: FetcherResult = {
    fragments: [],
    errors: [],
    source: "pubmed",
  };

  // Build the query from the most specific entities we have.
  // Preference: drugs → generic ingredients → raw query.
  const pieces: string[] = [];
  pieces.push(...input.entities.drugs);
  pieces.push(...input.entities.genericIngredients);

  const queryTerm = pieces.length > 0 ? pieces.join(" ") : input.query;
  if (!queryTerm.trim()) return result;

  try {
    const pmids = await esearch(queryTerm, 5);
    if (pmids.length === 0) return result;

    const docsums = await esummary(pmids);
    for (const docsum of docsums) {
      const fragment = docsumToFragment(docsum, queryTerm);
      if (fragment) result.fragments.push(fragment);
    }
  } catch (err) {
    result.errors.push(
      `PubMed search for "${queryTerm}" failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
};
