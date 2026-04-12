import type { FetcherResult, RetrievalInput, SourceFetcher } from "./types";

/**
 * Open Beauty Facts (OBF) retriever.
 *
 * https://world.openbeautyfacts.org/
 *
 * OBF is the beauty & skincare sibling of Open Food Facts — a free,
 * community-contributed database of cosmetics, skincare, haircare,
 * and personal-care products. Like OFF it exposes a public REST API
 * with no API key and no hard rate limit (play nice: 1-2 req/sec).
 *
 * For Phase 1, OBF is the ONLY new beauty data source. We search
 * it by brand/ingredient name, and if results come back we:
 *
 *   1. Extract a product overview fragment (name, brand, categories,
 *      image URL) → feeds the TrendProductCard
 *   2. Extract an INCI list fragment → feeds the Ingredient section
 *
 * Both are emitted as SourceFragments (Tier 2 — it's community data,
 * not FDA/peer-reviewed) so the synthesizer can reference them.
 *
 * NOTE: OBF data quality is uneven. Missing fields are common. We
 * defensively handle empty strings and null values everywhere and
 * never fail the whole pipeline over a missing INCI list.
 *
 * Next.js fetch cache: 24h revalidate. Product data changes slowly.
 */

const OBF_SEARCH_BASE = "https://world.openbeautyfacts.org/cgi/search.pl";
const ONE_DAY_SECONDS = 60 * 60 * 24;
const TIER: 2 = 2; // community-contributed data → Tier 2

/**
 * Minimal subset of the OBF product JSON. The full shape has 200+
 * fields; we declare only what we read.
 */
interface OBFProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  ingredients_text?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  url?: string;
}

interface OBFSearchResponse {
  count?: number;
  products?: OBFProduct[];
}

/**
 * Search OBF by query term. Returns the top `limit` products.
 */
async function searchOBF(
  query: string,
  limit = 5
): Promise<OBFProduct[]> {
  const url = new URL(OBF_SEARCH_BASE);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("fields", [
    "code",
    "product_name",
    "brands",
    "categories",
    "ingredients_text",
    "image_url",
    "image_front_url",
    "image_front_small_url",
    "url",
  ].join(","));

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "DrPharmacist/1.0 (https://drpharmacist.com)" },
    next: { revalidate: ONE_DAY_SECONDS },
  });

  if (!res.ok) {
    throw new Error(
      `OBF search ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`
    );
  }

  const data = (await res.json()) as OBFSearchResponse;
  return data.products ?? [];
}

/**
 * Pick the best available image URL from a product, preferring the
 * front-facing photo over generic "image_url".
 */
function bestImageUrl(product: OBFProduct): string | undefined {
  return (
    product.image_front_url ??
    product.image_url ??
    product.image_front_small_url ??
    undefined
  );
}

/**
 * Product URL — either the OBF page or a generated one from barcode.
 */
function productUrl(product: OBFProduct): string {
  return (
    product.url ??
    (product.code
      ? `https://world.openbeautyfacts.org/product/${product.code}`
      : "https://world.openbeautyfacts.org/")
  );
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export const fetchOpenBeautyFacts: SourceFetcher = async (
  input: RetrievalInput
): Promise<FetcherResult> => {
  const result: FetcherResult = {
    fragments: [],
    errors: [],
    source: "open_beauty_facts",
  };

  // Only run for beauty_fitness trends. If the categoryHint doesn't
  // match we bail early — the retrieval pipeline should call us
  // selectively, but this is a safety net.
  if (input.categoryHint && input.categoryHint !== "beauty_fitness") {
    return result;
  }

  // Build search terms from all entity types — beauty queries
  // often have entities in symptoms ("dry skin"), conditions
  // ("acne"), or drugs ("retinoid") rather than just
  // genericIngredients. Search each term individually to maximize
  // coverage (OBF search works better with single keywords than
  // long compound queries).
  const terms = new Set<string>();
  for (const t of input.entities.drugs) terms.add(t.trim());
  for (const t of input.entities.genericIngredients) terms.add(t.trim());
  for (const t of input.entities.symptoms) terms.add(t.trim());
  for (const t of input.entities.conditions) terms.add(t.trim());
  if (terms.size === 0) {
    // Fall back to raw query
    terms.add(input.query);
  }
  // Remove empties
  terms.delete("");

  if (terms.size === 0) return result;

  // Search OBF for each term individually, collect unique products
  const seenCodes = new Set<string>();
  let products: OBFProduct[] = [];

  for (const term of terms) {
    try {
      const hits = await searchOBF(term, 3);
      for (const h of hits) {
        const code = h.code ?? h.product_name;
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          products.push(h);
        }
      }
    } catch (err) {
      result.errors.push(
        `OBF search for "${term}" failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (products.length >= 5) break;
  }
  products = products.slice(0, 5);

  if (products.length === 0) return result;

  const now = new Date().toISOString();

  for (const product of products) {
    const name = product.product_name?.trim();
    if (!name) continue;

    const brand = product.brands?.trim();
    const url = productUrl(product);

    // Fragment 1: Product overview (always emitted if name exists)
    const overviewParts: string[] = [`Product: ${name}`];
    if (brand) overviewParts.push(`Brand: ${brand}`);
    if (product.categories) {
      overviewParts.push(`Categories: ${clip(product.categories, 150)}`);
    }
    const imageUrl = bestImageUrl(product);
    if (imageUrl) overviewParts.push(`Image: ${imageUrl}`);

    result.fragments.push({
      id: 0, // renumbered by merge-and-rank
      tier: TIER,
      sourceType: "other_authoritative", // OBF isn't in the exact whitelist; use fallback
      title: `Open Beauty Facts — ${name}${brand ? ` (${brand})` : ""}`,
      url,
      quote: overviewParts.join(". "),
      citation: `Open Beauty Facts: ${name}`,
      publishedAt: undefined,
      retrievedAt: now,
      relevanceScore: 60,
    });

    // Fragment 2: INCI ingredient list (only if populated)
    const inci = product.ingredients_text?.trim();
    if (inci && inci.length > 10) {
      result.fragments.push({
        id: 0,
        tier: TIER,
        sourceType: "other_authoritative",
        title: `INCI Ingredients — ${name}`,
        url,
        quote: `Full INCI ingredients list: ${clip(inci, 500)}`,
        citation: `Open Beauty Facts: ${name} — INCI list`,
        publishedAt: undefined,
        retrievedAt: now,
        relevanceScore: 55,
      });
    }
  }

  return result;
};

/**
 * Lightweight helper for product matching (Step 4) that returns
 * raw OBF product objects for downstream processing, bypassing the
 * SourceFragment conversion. Not a SourceFetcher — called directly
 * from match-products.ts.
 */
/**
 * Persist OBF search results as `draft` cosmetic products in the
 * medications table. Dedupes by `obf_barcode` — if a product with
 * the same barcode already exists, it's skipped (no upsert to
 * avoid overwriting pharmacist edits).
 *
 * Called from `analyzeTrend()` when category='beauty_fitness' so
 * beauty trend products accumulate in the DB for pharmacist review.
 *
 * Returns the count of newly inserted rows.
 */
export async function persistBeautyProducts(
  query: string,
  limit = 5
): Promise<number> {
  // Dynamic import to avoid circular dependency
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const products = await searchBeautyProducts(query, limit);
  if (products.length === 0) return 0;

  let inserted = 0;
  for (const p of products) {
    if (!p.barcode || !p.name) continue;

    // Check for existing product with same barcode
    const { data: existing } = await admin
      .from("medications")
      .select("id")
      .eq("obf_barcode", p.barcode)
      .maybeSingle();

    if (existing) continue;

    const slug = p.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);

    const { error } = await admin.from("medications").insert({
      name: p.name,
      slug: `${slug}-obf-${p.barcode.slice(-6)}`,
      brand_names: p.brand ? [p.brand] : [],
      description: p.categories
        ? `${p.name} — ${p.categories.split(",").slice(0, 3).join(", ")}`
        : p.name,
      image_url: p.imageUrl,
      images: p.imageUrl
        ? [{ url: p.imageUrl, alt: p.name, isPrimary: true, sortOrder: 0 }]
        : [],
      inci_list: p.inci,
      is_otc: false,
      source: "manual",
      product_type: "cosmetic",
      approval_status: "draft",
      obf_barcode: p.barcode,
      external_source: "obf",
      external_id: p.barcode,
      last_external_sync: new Date().toISOString(),
      country_of_origin: "KR", // Default assumption for beauty trend queries
    });

    if (error) {
      // 23505 = unique violation (slug or barcode collision), skip silently
      if (error.code !== "23505") {
        console.warn(
          `[obf] persist failed for "${p.name}":`,
          error.message
        );
      }
    } else {
      inserted++;
    }
  }

  return inserted;
}

export async function searchBeautyProducts(
  query: string,
  limit = 5
): Promise<
  Array<{
    barcode: string;
    name: string;
    brand: string | null;
    categories: string | null;
    inci: string | null;
    imageUrl: string | null;
    url: string;
  }>
> {
  let products: OBFProduct[];
  try {
    products = await searchOBF(query, limit);
  } catch (err) {
    console.warn(
      `[obf] searchBeautyProducts failed for "${query}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  return products
    .filter((p) => p.product_name?.trim())
    .map((p) => ({
      barcode: p.code ?? "",
      name: p.product_name!.trim(),
      brand: p.brands?.trim() ?? null,
      categories: p.categories?.trim() ?? null,
      inci: p.ingredients_text?.trim() ?? null,
      imageUrl: bestImageUrl(p) ?? null,
      url: productUrl(p),
    }));
}
