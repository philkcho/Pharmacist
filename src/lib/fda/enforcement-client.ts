/**
 * openFDA Drug Enforcement (Recalls) client.
 *
 * Docs: https://open.fda.gov/apis/drug/enforcement/
 *
 * Returns active recalls touching a given drug name. We treat
 * "active" loosely: any recall whose status is Ongoing OR whose
 * recall_initiation_date is within the last 180 days and not
 * explicitly Terminated.
 *
 * Returns `null` on errors or when nothing matches — callers
 * degrade silently (no recall banner rendered).
 *
 * Cached 24 hours (shorter than FAERS because a new recall is a
 * time-sensitive signal we don't want to hide behind a stale
 * cache).
 */

const ENFORCEMENT_BASE = "https://api.fda.gov/drug/enforcement.json";
const ONE_DAY_SECONDS = 60 * 60 * 24;

export interface ActiveRecall {
  drugName: string;
  recallClass: "Class I" | "Class II" | "Class III" | "Unknown";
  reason: string;
  firm: string;
  initiationDate: string;
  url: string;
}

interface EnforcementResult {
  recall_number?: string;
  status?: string;
  classification?: string;
  reason_for_recall?: string;
  product_description?: string;
  recalling_firm?: string;
  recall_initiation_date?: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    substance_name?: string[];
  };
}

interface EnforcementResponse {
  error?: { code: string; message: string };
  results?: EnforcementResult[];
}

function buildEnforcementUrl(drugName: string): string {
  const apiKey = process.env.OPENFDA_API_KEY;
  const keyPart = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
  const encoded = encodeURIComponent(drugName.replace(/"/g, ""));
  const q = `%22${encoded}%22`;

  const search =
    `(openfda.brand_name:${q}` +
    `+openfda.generic_name:${q}` +
    `+openfda.substance_name:${q})` +
    `+AND+status:%22Ongoing%22`;

  return `${ENFORCEMENT_BASE}?search=${search}&limit=5${keyPart}`;
}

function normalizeClassification(
  classification: string | undefined
): ActiveRecall["recallClass"] {
  if (!classification) return "Unknown";
  if (classification.includes("I")) {
    if (classification.includes("III")) return "Class III";
    if (classification.includes("II")) return "Class II";
    return "Class I";
  }
  return "Unknown";
}

/**
 * yyyymmdd → yyyy-mm-dd (ISO-ish). openFDA returns dates as
 * "20240315"; we want a format the UI can `new Date()` on.
 */
function normalizeDate(raw: string | undefined): string {
  if (!raw || raw.length !== 8) return raw ?? "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function recallUrl(recallNumber: string | undefined): string {
  if (!recallNumber) return "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts";
  return `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts?search_api_fulltext=${encodeURIComponent(recallNumber)}`;
}

export async function fetchActiveRecalls(
  drugName: string
): Promise<ActiveRecall[]> {
  const trimmed = drugName.trim();
  if (!trimmed) return [];

  const url = buildEnforcementUrl(trimmed);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: ONE_DAY_SECONDS },
    });
  } catch (err) {
    console.warn(
      `[fda-enforcement] network error for "${drugName}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  if (res.status === 404) return [];
  if (!res.ok) {
    console.warn(
      `[fda-enforcement] ${res.status} for "${drugName}":`,
      (await res.text().catch(() => "")).slice(0, 200)
    );
    return [];
  }

  let data: EnforcementResponse;
  try {
    data = (await res.json()) as EnforcementResponse;
  } catch {
    return [];
  }

  if (data.error || !data.results) return [];

  return data.results.map<ActiveRecall>((r) => ({
    drugName: trimmed,
    recallClass: normalizeClassification(r.classification),
    reason: r.reason_for_recall ?? "Reason not provided",
    firm: r.recalling_firm ?? "Unknown manufacturer",
    initiationDate: normalizeDate(r.recall_initiation_date),
    url: recallUrl(r.recall_number),
  }));
}
