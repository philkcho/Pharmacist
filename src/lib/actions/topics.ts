"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TopicProduct {
  id: number;
  name: string;
  slug: string;
  genericName: string | null;
  brandNames: string[] | null;
  imageUrl: string | null;
  priceRange: string | null;
  productType: string;
  verdict: string | null;
  purchaseLinks: Array<{
    linkId: number;
    retailerName: string;
    url: string;
  }>;
}

export interface TopicPageData {
  keyword: string;
  displayKeyword: string;
  products: TopicProduct[];
  relatedTrends: Array<{
    id: number;
    queryText: string;
    slug: string;
    category: string;
  }>;
}

/**
 * Load data for the /topics/[keyword] page.
 *
 * 1. Search medications by keyword (approved only)
 * 2. Search trend_topics that mention this keyword (published only)
 * 3. Load purchase links for matched products
 */
export async function getTopicByKeyword(
  keyword: string
): Promise<TopicPageData> {
  const supabase = await createClient();
  const decoded = decodeURIComponent(keyword).replace(/-/g, " ").trim();
  const displayKeyword =
    decoded.charAt(0).toUpperCase() + decoded.slice(1);

  // 1. Search products (approved only via RLS)
  const { data: medData } = await supabase
    .from("medications")
    .select(
      "id, name, slug, generic_name, brand_names, image_url, price_range, product_type, verdict, category_id"
    )
    .or(
      `name.ilike.%${decoded}%,generic_name.ilike.%${decoded}%`
    )
    .order("comparison_score", { ascending: false, nullsFirst: true })
    .limit(5);

  // 2. If not enough products, try searching by brand_names
  let products = (medData ?? []) as Array<Record<string, unknown>>;
  if (products.length < 5) {
    const { data: brandData } = await supabase
      .from("medications")
      .select(
        "id, name, slug, generic_name, brand_names, image_url, price_range, product_type, verdict, category_id"
      )
      .contains("brand_names", [decoded])
      .limit(5 - products.length);

    if (brandData) {
      const existingIds = new Set(products.map((p) => p.id));
      for (const row of brandData) {
        if (!existingIds.has(row.id)) products.push(row as Record<string, unknown>);
      }
    }
  }

  // 3. Load purchase links for each product
  const productIds = products.map((p) => p.id as number);
  let linksMap = new Map<number, TopicProduct["purchaseLinks"]>();

  if (productIds.length > 0) {
    const { data: linkData } = await supabase
      .from("product_purchase_links")
      .select("id, medication_id, url, retailers(name)")
      .in("medication_id", productIds)
      .eq("is_active", true)
      .order("sort_order");

    if (linkData) {
      for (const link of linkData) {
        const medId = link.medication_id as number;
        if (!linksMap.has(medId)) linksMap.set(medId, []);
        const retailers = link.retailers as unknown;
        const retailer = Array.isArray(retailers) ? retailers[0] as { name: string } | undefined : retailers as { name: string } | null;
        linksMap.get(medId)!.push({
          linkId: link.id as number,
          retailerName: retailer?.name ?? "Buy",
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
    imageUrl: (p.image_url as string) ?? null,
    priceRange: (p.price_range as string) ?? null,
    productType: (p.product_type as string) ?? "otc_drug",
    verdict: (p.verdict as string) ?? null,
    purchaseLinks: linksMap.get(p.id as number) ?? [],
  }));

  // 4. Related trends (published, matching keyword)
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

  return {
    keyword,
    displayKeyword,
    products: topicProducts,
    relatedTrends,
  };
}
