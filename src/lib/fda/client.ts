/**
 * openFDA Drug Label API wrapper.
 *
 * Docs: https://open.fda.gov/apis/drug/label/
 * Rate limits: 240 req/min, 1000/day anonymous; 120k/day with API key.
 * Set OPENFDA_API_KEY in .env.local to raise the limit.
 */

const BASE_URL = "https://api.fda.gov/drug/label.json";

export interface FdaDrugLabel {
  splId: string;
  brandName: string | null;
  genericName: string | null;
  manufacturer: string | null;
  activeIngredients: string[];
  dosageForms: string[];
  routes: string[];
  indications: string | null;
  warnings: string | null;
  doNotUse: string | null;
  whenUsing: string | null;
  stopUse: string | null;
  dosageAndAdministration: string | null;
  sideEffects: string | null;
  inactiveIngredients: string | null;
  purpose: string | null;
  keepOutOfReachOfChildren: string | null;
  raw: unknown;
}

interface OpenFdaLabelResult {
  id?: string;
  set_id?: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_type?: string[];
    route?: string[];
    substance_name?: string[];
  };
  active_ingredient?: string[];
  inactive_ingredient?: string[];
  dosage_and_administration?: string[];
  dosage_forms_and_strengths?: string[];
  indications_and_usage?: string[];
  purpose?: string[];
  warnings?: string[];
  do_not_use?: string[];
  when_using?: string[];
  stop_use?: string[];
  keep_out_of_reach_of_children?: string[];
  adverse_reactions?: string[];
}

interface OpenFdaResponse {
  error?: { code: string; message: string };
  results?: OpenFdaLabelResult[];
  meta?: { results?: { total?: number } };
}

function first<T>(arr: T[] | undefined): T | null {
  return arr && arr.length > 0 ? arr[0] : null;
}

function joinText(arr: string[] | undefined): string | null {
  if (!arr || arr.length === 0) return null;
  return arr.join("\n\n").trim() || null;
}

function normalize(result: OpenFdaLabelResult): FdaDrugLabel {
  const splId = result.set_id ?? result.id ?? "";
  const activeIngredientsRaw =
    result.openfda?.substance_name ??
    (result.active_ingredient ?? []).flatMap((s) =>
      s.split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean)
    );

  return {
    splId,
    brandName: first(result.openfda?.brand_name),
    genericName: first(result.openfda?.generic_name),
    manufacturer: first(result.openfda?.manufacturer_name),
    activeIngredients: Array.from(new Set(activeIngredientsRaw)).slice(0, 20),
    dosageForms: result.dosage_forms_and_strengths ?? [],
    routes: result.openfda?.route ?? [],
    indications: joinText(result.indications_and_usage),
    warnings: joinText(result.warnings),
    doNotUse: joinText(result.do_not_use),
    whenUsing: joinText(result.when_using),
    stopUse: joinText(result.stop_use),
    dosageAndAdministration: joinText(result.dosage_and_administration),
    sideEffects: joinText(result.adverse_reactions),
    inactiveIngredients: joinText(result.inactive_ingredient),
    purpose: joinText(result.purpose),
    keepOutOfReachOfChildren: joinText(result.keep_out_of_reach_of_children),
    raw: result,
  };
}

interface SearchOptions {
  /** If true, only OTC (over-the-counter) products are returned. */
  otcOnly?: boolean;
  /** Max number of results to return (default 1). */
  limit?: number;
}

/**
 * openFDA uses Lucene-style queries with `+` as the AND operator. We can't
 * pass this through URLSearchParams because that encodes `+` as `%2B`, which
 * openFDA then treats as a literal plus inside the search string — breaking
 * the AND logic. Instead we build the URL manually: encode the user-supplied
 * term with encodeURIComponent and splice in literal `+` / `%22` (quote)
 * characters as Lucene control tokens.
 */
function buildSearchQuery(term: string, opts: SearchOptions): string {
  // encodeURIComponent turns " into %22 already, so we don't need to escape
  // quotes manually — but the term itself should never contain a quote since
  // it's a drug name. Strip any just in case.
  const encoded = encodeURIComponent(term.replace(/"/g, ""));
  const q = `%22${encoded}%22`; // "term"
  const nameFilter = `(openfda.brand_name:${q}+openfda.generic_name:${q}+openfda.substance_name:${q})`;
  const otcFilter = opts.otcOnly
    ? `+AND+openfda.product_type:%22HUMAN+OTC+DRUG%22`
    : "";
  return nameFilter + otcFilter;
}

async function callOpenFda(searchQuery: string, limit: number): Promise<OpenFdaResponse> {
  const apiKey = process.env.OPENFDA_API_KEY;
  const keyPart = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
  const url = `${BASE_URL}?search=${searchQuery}&limit=${limit}${keyPart}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // openFDA is public static data — safe to cache aggressively
    next: { revalidate: 60 * 60 * 24 },
  });

  if (res.status === 404) return { results: [] };
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`openFDA ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Search openFDA drug labels by brand/generic/substance name.
 * Returns normalized label records, or [] if nothing matches.
 */
export async function searchDrugLabels(
  term: string,
  opts: SearchOptions = {}
): Promise<FdaDrugLabel[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const searchQuery = buildSearchQuery(trimmed, opts);
  const limit = opts.limit ?? 1;

  try {
    const data = await callOpenFda(searchQuery, limit);
    if (!data.results) return [];
    return data.results.map(normalize);
  } catch (err) {
    console.error("[fda] searchDrugLabels failed:", err);
    return [];
  }
}

/** Convenience: fetch the single best-match OTC label for a given name. */
export async function getBestOtcLabel(
  term: string
): Promise<FdaDrugLabel | null> {
  const [otc] = await searchDrugLabels(term, { otcOnly: true, limit: 1 });
  if (otc) return otc;
  // Fallback: drop the OTC filter if nothing found
  const [any] = await searchDrugLabels(term, { limit: 1 });
  return any ?? null;
}
