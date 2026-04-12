/**
 * openFDA FAERS (Adverse Event Reporting System) client.
 *
 * Docs: https://open.fda.gov/apis/drug/event/
 *
 * FAERS is the FDA's public database of adverse event reports
 * submitted by healthcare providers, manufacturers, and consumers.
 * It's not a clean "this is what this drug does" dataset — it's
 * voluntarily-reported incidents, so the numbers are absolute
 * counts (not rates), and reporting biases are heavy. We render
 * it explicitly as "reports" not "rates" to keep the UI honest.
 *
 * We use the `count` endpoint to aggregate the top reaction terms
 * for a given drug over the last 12 months. One API call per drug.
 *
 * Usage is rate-limited to the same 240 req/min / 120k per day
 * bucket as the rest of openFDA. We cache 7 days by default.
 *
 * This module is intentionally read-only and returns `null` on
 * errors so callers can degrade gracefully.
 */

const FAERS_BASE = "https://api.fda.gov/drug/event.json";
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

export interface FaersTopReactions {
  drugName: string;
  reactions: Array<{ term: string; count: number }>;
}

interface FaersCountResponse {
  error?: { code: string; message: string };
  results?: Array<{ term: string; count: number }>;
}

function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Build a FAERS count query that returns the top reaction terms
 * reported for `drugName` in the last 12 months.
 *
 * The query searches across generic_name, brand_name, and
 * substance_name within the `patient.drug.openfda` subdocument —
 * FAERS indexes drugs by several names and missing one causes
 * false-zero results.
 */
function buildFaersUrl(drugName: string): string {
  const apiKey = process.env.OPENFDA_API_KEY;
  const keyPart = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
  const encoded = encodeURIComponent(drugName.replace(/"/g, ""));
  const q = `%22${encoded}%22`;

  const now = new Date();
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const dateRange = `[${yyyymmdd(yearAgo)}+TO+${yyyymmdd(now)}]`;

  // patient.drug.openfda is the fully-indexed subdoc
  const nameFilter =
    `(patient.drug.openfda.generic_name:${q}` +
    `+patient.drug.openfda.brand_name:${q}` +
    `+patient.drug.openfda.substance_name:${q})`;
  const dateFilter = `+AND+receivedate:${dateRange}`;

  const search = `${nameFilter}${dateFilter}`;
  // count over reaction terms, top 5
  return `${FAERS_BASE}?search=${search}&count=patient.reaction.reactionmeddrapt.exact&limit=5${keyPart}`;
}

/**
 * Query FAERS for the top 5 reported adverse reaction terms for
 * `drugName` over the past 12 months. Returns `null` if no data
 * is available or the API errors out — callers should treat a
 * `null` as "no FAERS data to show" and degrade silently.
 */
export async function fetchFaersTopReactions(
  drugName: string
): Promise<FaersTopReactions | null> {
  const trimmed = drugName.trim();
  if (!trimmed) return null;

  const url = buildFaersUrl(trimmed);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: SEVEN_DAYS_SECONDS },
    });
  } catch (err) {
    console.warn(
      `[faers] network error for "${drugName}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // 404 = nothing reported in window. Not an error.
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(
      `[faers] ${res.status} for "${drugName}":`,
      (await res.text().catch(() => "")).slice(0, 200)
    );
    return null;
  }

  let data: FaersCountResponse;
  try {
    data = (await res.json()) as FaersCountResponse;
  } catch {
    return null;
  }

  if (data.error || !data.results || data.results.length === 0) return null;

  return {
    drugName: trimmed,
    reactions: data.results.map((r) => ({
      term: humanizeReactionTerm(r.term),
      count: r.count,
    })),
  };
}

/**
 * FAERS reaction terms are MedDRA Preferred Terms — all-caps and
 * clinical. We lowercase them and fix a few common layperson-
 * hostile ones so the UI can render them inline without hand
 * massaging.
 */
function humanizeReactionTerm(term: string): string {
  const base = term.toLowerCase().replace(/_/g, " ").trim();
  const fixes: Record<string, string> = {
    "drug ineffective": "drug didn't work as expected",
    "nausea": "nausea",
    "headache": "headache",
    "dizziness": "dizziness",
    "rash": "rash",
    "off label use": "off-label use",
    "product quality issue": "product quality complaint",
  };
  return fixes[base] ?? base;
}
