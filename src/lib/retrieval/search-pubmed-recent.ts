import type { SourceFragment } from "@/lib/ai/types";
import type { FetcherResult, RetrievalInput, SourceFetcher } from "./types";

/**
 * Recent-PubMed retriever (last 30 days).
 *
 * Distinct from `search-pubmed.ts` in two ways:
 *
 *   1. Applies a `reldate=30` filter so only papers *indexed* within
 *      the last 30 days come back. This populates the "Why now"
 *      section of trend article pages — fresh science that explains
 *      *why* the query is trending.
 *   2. Drops the `review[PT]` bias of the main PubMed retriever.
 *      A freshly-published primary study is exactly what we want;
 *      systematic reviews take too long to wait for.
 *
 * Returned SourceFragments have a higher relevance floor (85+) so
 * merge-and-rank tends to promote them above older general PubMed
 * hits. They're tagged `publishedAt` with the ISO date so the
 * synthesizer's trendDrivers post-processor can verify freshness.
 *
 * Rate limits match search-pubmed:
 *   - 3 req/sec anonymous, 10 req/sec with PUBMED_API_KEY
 *   - esearch + esummary = 2 requests per retrieval
 *
 * Cached 6 hours (shorter than main PubMed's 24h because fresh-
 * publication windows move fast).
 */

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const SIX_HOURS_SECONDS = 60 * 60 * 6;
const RELDATE_DAYS = 30;

interface EsearchResult {
  esearchresult?: {
    idlist?: string[];
    count?: string;
  };
}

interface EsummaryAuthor {
  name?: string;
}

interface EsummaryDocsum {
  uid?: string;
  title?: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  epubdate?: string;
  authors?: EsummaryAuthor[];
  pubtype?: string[];
}

interface EsummaryResult {
  result?: {
    uids?: string[];
    [pmid: string]: EsummaryDocsum | string[] | undefined;
  };
}

function apiKeyParam(): string {
  const key = process.env.PUBMED_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/**
 * Build a recent-PubMed query. We DO NOT impose publication type
 * filters here because limiting to review articles in a 30-day
 * window returns almost nothing.
 */
function buildRecentQuery(query: string): string {
  const cleaned = query.replace(/[^\w\s-]/g, " ").trim();
  if (!cleaned) return "";
  return `${cleaned} AND english[lang]`;
}

async function esearchRecent(query: string, retmax = 5): Promise<string[]> {
  const q = buildRecentQuery(query);
  if (!q) return [];

  const url =
    `${EUTILS_BASE}/esearch.fcgi` +
    `?db=pubmed&retmode=json&sort=pub_date` +
    `&retmax=${retmax}` +
    `&reldate=${RELDATE_DAYS}` +
    `&datetype=pdat` +
    `&term=${encodeURIComponent(q)}` +
    apiKeyParam();

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: SIX_HOURS_SECONDS },
  });

  if (!res.ok) {
    throw new Error(
      `recent-pubmed esearch ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
    );
  }

  const data = (await res.json()) as EsearchResult;
  return data.esearchresult?.idlist ?? [];
}

async function esummaryRecent(pmids: string[]): Promise<EsummaryDocsum[]> {
  if (pmids.length === 0) return [];

  const url =
    `${EUTILS_BASE}/esummary.fcgi` +
    `?db=pubmed&retmode=json` +
    `&id=${encodeURIComponent(pmids.join(","))}` +
    apiKeyParam();

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: SIX_HOURS_SECONDS },
  });

  if (!res.ok) {
    throw new Error(
      `recent-pubmed esummary ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
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
 * Parse PubMed's `pubdate` which comes in forms like:
 *   "2024 Mar 15"
 *   "2024 Apr"
 *   "2024"
 * into an ISO date string best-effort.
 */
function parsePubdate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  const yearMatch = raw.match(/^(\d{4})/);
  return yearMatch ? `${yearMatch[1]}-01-01T00:00:00.000Z` : undefined;
}

function docsumToRecentFragment(
  docsum: EsummaryDocsum,
  originalQuery: string
): SourceFragment | null {
  const pmid = docsum.uid;
  if (!pmid) return null;

  const title = docsum.title?.trim() || "PubMed article";
  const journal = docsum.fulljournalname ?? docsum.source ?? "PubMed";
  // Prefer epubdate (electronic pub) over pubdate when both exist —
  // epubdate is the better "fresh publication" signal for the
  // 30-day window.
  const publishedAt =
    parsePubdate(docsum.epubdate) ?? parsePubdate(docsum.pubdate);

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
  if (publishedAt) citationParts.push(publishedAt.slice(0, 10));
  const citation = citationParts.join(", ");

  return {
    id: 0, // renumbered by merge-and-rank
    tier: 1,
    sourceType: "pubmed",
    title,
    url: pubmedUrl(pmid),
    quote: `Recent peer-reviewed article in ${journal} matching "${originalQuery}", published within the last 30 days.`,
    citation,
    authors: authorString,
    publishedAt,
    retrievedAt: new Date().toISOString(),
    // Higher baseline than regular search-pubmed (82 for reviews).
    // Fresh publications carry the "why now" signal the Hook needs.
    relevanceScore: 88,
  };
}

export const searchRecentPubmed: SourceFetcher = async (
  input: RetrievalInput
): Promise<FetcherResult> => {
  const result: FetcherResult = {
    fragments: [],
    errors: [],
    source: "pubmed-recent",
  };

  const pieces: string[] = [];
  pieces.push(...input.entities.drugs);
  pieces.push(...input.entities.genericIngredients);

  const queryTerm = pieces.length > 0 ? pieces.join(" ") : input.query;
  if (!queryTerm.trim()) return result;

  try {
    const pmids = await esearchRecent(queryTerm, 5);
    if (pmids.length === 0) return result;

    const docsums = await esummaryRecent(pmids);
    for (const docsum of docsums) {
      const fragment = docsumToRecentFragment(docsum, queryTerm);
      if (fragment) result.fragments.push(fragment);
    }
  } catch (err) {
    result.errors.push(
      `recent-pubmed search for "${queryTerm}" failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
};

/**
 * Lightweight variant that returns pre-formatted chronological
 * entries for market_reaction_jsonb.recentPubmedStudies (section 2
 * "Why now" list). This calls the SAME underlying PubMed endpoints
 * but re-packages the output in UI-friendly shape.
 *
 * In practice `analyzeTrend()` calls `searchRecentPubmed` once (via
 * the retrieval pipeline) to get SourceFragments, then calls this
 * separately to populate marketReaction. We could share a cache
 * layer but Next.js fetch cache already dedupes by URL so both
 * callers share the underlying request.
 */
export async function fetchRecentPubmedStudies(
  queryTerm: string,
  limit = 3
): Promise<
  Array<{
    pmid: string;
    title: string;
    journal: string;
    publishedAt: string;
    url: string;
  }>
> {
  if (!queryTerm.trim()) return [];

  let pmids: string[];
  try {
    pmids = await esearchRecent(queryTerm, limit);
  } catch (err) {
    console.warn(
      `[recent-pubmed] esearch failed for "${queryTerm}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
  if (pmids.length === 0) return [];

  let docsums: EsummaryDocsum[];
  try {
    docsums = await esummaryRecent(pmids);
  } catch (err) {
    console.warn(
      `[recent-pubmed] esummary failed for "${queryTerm}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  return docsums
    .map((d) => {
      if (!d.uid) return null;
      const publishedAt =
        parsePubdate(d.epubdate) ?? parsePubdate(d.pubdate) ?? "";
      return {
        pmid: d.uid,
        title: d.title?.trim() || "PubMed article",
        journal: d.fulljournalname ?? d.source ?? "PubMed",
        publishedAt,
        url: pubmedUrl(d.uid),
      };
    })
    .filter(
      (
        v
      ): v is {
        pmid: string;
        title: string;
        journal: string;
        publishedAt: string;
        url: string;
      } => v !== null
    );
}
