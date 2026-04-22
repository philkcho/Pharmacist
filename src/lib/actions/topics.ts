"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SAMPLE_PRODUCTS } from "@/lib/data/sample-products";
import { autoGeneratePurchaseLinks } from "@/lib/actions/purchase-links";
import { ensureProductComplete } from "@/lib/actions/ensure-product-complete";
import { iherbSearchUrl } from "@/lib/affiliate/iherb";

export interface TopicProduct {
  id: number;
  name: string;
  slug: string;
  genericName: string | null;
  brandNames: string[] | null;
  description: string | null;
  imageUrl: string | null;
  priceRange: string | null;
  productType: string;
  verdict: string | null;
  purchaseLinks: Array<{
    linkId: number;
    retailerName: string;
    retailerSlug: string;
    url: string;
  }>;
}

export interface RetailerSearchLink {
  name: string;
  slug: string;
  searchUrl: string;
}

export interface RetailerProduct {
  name: string;
  imageUrl: string;
  price: string;
  description: string;
  url: string;
}

export interface RetailerSection {
  retailerName: string;
  retailerSlug: string;
  emoji: string;
  searchUrl: string;
  products: RetailerProduct[];
}

export interface TopicPageData {
  keyword: string;
  displayKeyword: string;
  products: TopicProduct[];
  /** Direct search links for each retailer (always available, even with 0 products) */
  retailerSearchLinks: RetailerSearchLink[];
  /** Retailer-specific product listings (sample data for now, API later) */
  retailerSections: RetailerSection[];
  relatedTrends: Array<{
    id: number;
    queryText: string;
    slug: string;
    category: string;
  }>;
}

const RETAILER_SEARCH_TEMPLATES: Record<string, (q: string) => string> = {
  amazon: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  iherb: (q) => iherbSearchUrl(q),
  stylekorean: (q) =>
    `https://www.stylekorean.com/shop/search/result.php?search_str=${encodeURIComponent(q)}`,
  yesstyle: (q) =>
    `https://www.yesstyle.com/en/search?q=${encodeURIComponent(q)}`,
};

export async function getTopicByKeyword(
  keyword: string,
  fromExpertSlug?: string
): Promise<TopicPageData> {
  const supabase = await createClient();
  const decoded = decodeURIComponent(keyword).replace(/-/g, " ").trim();
  const displayKeyword =
    decoded.charAt(0).toUpperCase() + decoded.slice(1);

  // If arriving from a Dr.'s Analysis "Shop Options" click, fetch that
  // expert pick's mentionedProducts so we can prioritize them in the list.
  let priorityProductSlugs: string[] = [];
  if (fromExpertSlug) {
    const { data: expertPick } = await supabase
      .from("expert_picks")
      .select("mentioned_products")
      .eq("slug", fromExpertSlug)
      .maybeSingle();

    if (expertPick?.mentioned_products) {
      const mentioned = expertPick.mentioned_products as Array<{
        slug?: string;
        name?: string;
      }>;
      priorityProductSlugs = mentioned
        .map((p) => p.slug)
        .filter((s): s is string => typeof s === "string" && s.length > 0);
    }
  }

  // Build variants — singular and plural — so "probiotics" finds
  // "Culturelle Probiotic" and "vitamin" finds "vitamins".
  const variants = new Set<string>([decoded]);
  if (decoded.endsWith("s")) variants.add(decoded.slice(0, -1));
  else variants.add(decoded + "s");

  const orClauses = Array.from(variants)
    .flatMap((v) => [`name.ilike.%${v}%`, `generic_name.ilike.%${v}%`])
    .join(",");

  let products: Array<Record<string, unknown>> = [];

  // When arriving from a Dr.'s Analysis "Shop Options" click, show ONLY
  // that analysis's mentioned products — don't mix in unrelated keyword
  // search results. The user expects continuity with the previous page.
  if (priorityProductSlugs.length > 0) {
    const { data: priorityData } = await supabase
      .from("medications")
      .select(
        "id, name, slug, generic_name, brand_names, description, image_url, price_range, product_type, verdict, category_id"
      )
      .in("slug", priorityProductSlugs);

    if (priorityData) {
      // Preserve the exact order from the analysis page
      const bySlug = new Map(
        priorityData.map((p) => [p.slug as string, p as Record<string, unknown>])
      );
      for (const slug of priorityProductSlugs) {
        const row = bySlug.get(slug);
        if (row) products.push(row);
      }
    }
  } else {
    // No referrer — fall back to keyword search
    const { data: medData } = await supabase
      .from("medications")
      .select(
        "id, name, slug, generic_name, brand_names, description, image_url, price_range, product_type, verdict, category_id"
      )
      .or(orClauses)
      .order("comparison_score", { ascending: false, nullsFirst: true })
      .limit(10);

    if (medData) {
      products = medData as Array<Record<string, unknown>>;
    }
  }

  // 2. If not enough, search by brand_names (skip when from Dr.'s Analysis)
  if (priorityProductSlugs.length === 0 && products.length < 10) {
    const { data: brandData } = await supabase
      .from("medications")
      .select(
        "id, name, slug, generic_name, brand_names, description, image_url, price_range, product_type, verdict, category_id"
      )
      .contains("brand_names", [decoded])
      .limit(10 - products.length);

    if (brandData) {
      const existingIds = new Set(products.map((p) => p.id));
      for (const row of brandData) {
        if (!existingIds.has(row.id))
          products.push(row as Record<string, unknown>);
      }
    }
  }

  // 3. Fill in missing display data on-demand (images + purchase links).
  //    Missing AI analysis (verdict) is enriched in the background —
  //    too slow to block page render and may fail on Gemini quota.
  //    Ensures topic pages never show empty thumbnails / missing Buy buttons.
  const productIds = products.map((p) => p.id as number);
  await enrichProductsForDisplay(products, productIds);

  // 4. Load purchase links for each product (after any auto-generation above)
  const linksMap = new Map<number, TopicProduct["purchaseLinks"]>();

  if (productIds.length > 0) {
    const { data: linkData } = await supabase
      .from("product_purchase_links")
      .select("id, medication_id, url, retailers(name, slug)")
      .in("medication_id", productIds)
      .eq("is_active", true)
      .order("sort_order");

    if (linkData) {
      for (const link of linkData) {
        const medId = link.medication_id as number;
        if (!linksMap.has(medId)) linksMap.set(medId, []);
        const retailers = link.retailers as unknown;
        const retailer = Array.isArray(retailers)
          ? (retailers[0] as { name: string; slug: string } | undefined)
          : (retailers as { name: string; slug: string } | null);
        linksMap.get(medId)!.push({
          linkId: link.id as number,
          retailerName: retailer?.name ?? "Buy",
          retailerSlug: retailer?.slug ?? "",
          url: link.url as string,
        });
      }
    }
  }

  const topicProducts: TopicProduct[] = products.map((p) => ({
    id: p.id as number,
    name: p.name as string,
    slug: p.slug as string,
    genericName: (p.generic_name as string) ?? null,
    brandNames: (p.brand_names as string[]) ?? null,
    description: (p.description as string) ?? null,
    imageUrl: (p.image_url as string) ?? null,
    priceRange: (p.price_range as string) ?? null,
    productType: (p.product_type as string) ?? "otc_drug",
    verdict: (p.verdict as string) ?? null,
    purchaseLinks: linksMap.get(p.id as number) ?? [],
  }));

  // 5. Build retailer search links (always available)
  const { data: retailers } = await supabase
    .from("retailers")
    .select("name, slug")
    .eq("is_active", true)
    .order("name");

  const retailerSearchLinks: RetailerSearchLink[] = (retailers ?? [])
    .filter((r) => RETAILER_SEARCH_TEMPLATES[r.slug as string])
    .map((r) => ({
      name: r.name as string,
      slug: r.slug as string,
      searchUrl: RETAILER_SEARCH_TEMPLATES[r.slug as string](decoded),
    }));

  // 6. Related trends
  const { data: trendData } = await supabase
    .from("trend_topics")
    .select("id, query_text, slug, category")
    .eq("status", "published")
    .ilike("query_text", `%${decoded}%`)
    .order("created_at", { ascending: false })
    .limit(5);

  const relatedTrends = (trendData ?? []).map((t) => ({
    id: t.id as number,
    queryText: t.query_text as string,
    slug: t.slug as string,
    category: t.category as string,
  }));

  // 7. Retailer product sections (sample data — replace with API later)
  const retailerSections = getSampleRetailerProducts(decoded, retailerSearchLinks);

  return {
    keyword,
    displayKeyword,
    products: topicProducts,
    retailerSearchLinks,
    retailerSections,
    relatedTrends,
  };
}


/**
 * Fill in missing display data for DB products on-demand.
 *
 * - image_url null  → build deterministic Pollinations URL, write back
 * - 0 purchase_links → autoGeneratePurchaseLinks (DB inserts, fast)
 * - verdict null    → ensureProductComplete in background (AI too slow to block)
 *
 * Mutates `products` in place so the caller's imageUrl reflects the fill.
 * Errors are swallowed — partial data is better than a 500 on the topic page.
 */
async function enrichProductsForDisplay(
  products: Array<Record<string, unknown>>,
  productIds: number[]
): Promise<void> {
  if (products.length === 0) return;

  const admin = createAdminClient();

  // Missing images are intentionally left null here — SSR hot path
  // can't burn Google Custom Search quota. Backfill runs via
  // ensureProductComplete (admin actions / cron fill).

  // ── Check which products have zero purchase links ──
  const { data: existingLinks } = await admin
    .from("product_purchase_links")
    .select("medication_id")
    .in("medication_id", productIds);

  const linkedIds = new Set(
    (existingLinks ?? []).map((l) => l.medication_id as number)
  );

  const productsMissingLinks = products.filter(
    (p) => !linkedIds.has(p.id as number)
  );

  if (productsMissingLinks.length > 0) {
    await Promise.all(
      productsMissingLinks.map((p) =>
        autoGeneratePurchaseLinks(
          p.id as number,
          p.name as string,
          (p.product_type as string) ?? "otc_drug"
        ).catch(() => 0)
      )
    );
  }

  // ── Kick off AI analysis in the background for products missing verdict ──
  //   Not awaited — next visit to the topic page will reflect the fill.
  for (const p of products) {
    if (!p.verdict) {
      ensureProductComplete({
        name: p.name as string,
        productType: (p.product_type as
          | "otc_drug"
          | "supplement"
          | "cosmetic"
          | "quasi_drug"
          | undefined) ?? undefined,
      }).catch(() => {});
    }
  }
}

// Fallback: generate generic sample for any keyword not in SAMPLE_PRODUCTS
function getGenericSamples(keyword: string, retailerSlug: string): RetailerProduct[] {
  const searchUrl = RETAILER_SEARCH_TEMPLATES[retailerSlug]?.(keyword) ?? "#";
  return [
    { name: `Top ${keyword} product #1`, imageUrl: "", price: "See retailer", description: `Popular ${keyword} — check retailer for details`, url: searchUrl },
    { name: `Top ${keyword} product #2`, imageUrl: "", price: "See retailer", description: `Highly rated ${keyword} option`, url: searchUrl },
    { name: `Top ${keyword} product #3`, imageUrl: "", price: "See retailer", description: `Best value ${keyword}`, url: searchUrl },
  ];
}

function getSampleRetailerProducts(
  keyword: string,
  retailerLinks: RetailerSearchLink[]
): RetailerSection[] {
  const EMOJIS: Record<string, string> = {
    amazon: "🛒",
    iherb: "🌿",
    stylekorean: "🇰🇷",
    yesstyle: "✨",
  };

  // Only show sections if we have curated sample data for this keyword.
  // Generic fallback products are misleading and not actually available.
  const lowerKeyword = keyword.toLowerCase();
  const sampleKey = Object.keys(SAMPLE_PRODUCTS).find((k) =>
    lowerKeyword.includes(k)
  );

  if (!sampleKey) return [];

  return retailerLinks
    .map((r) => ({
      retailerName: r.name,
      retailerSlug: r.slug,
      emoji: EMOJIS[r.slug] ?? "🏪",
      searchUrl: r.searchUrl,
      products: SAMPLE_PRODUCTS[sampleKey][r.slug] ?? [],
    }))
    // Only include retailers that actually have products for this keyword
    .filter((section) => section.products.length > 0);
}
