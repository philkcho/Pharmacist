"use server";

import { createClient } from "@/lib/supabase/server";

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
  iherb: (q) => `https://www.iherb.com/search?kw=${encodeURIComponent(q)}`,
  stylekorean: (q) =>
    `https://www.stylekorean.com/shop/search/result.php?search_str=${encodeURIComponent(q)}`,
  yesstyle: (q) =>
    `https://www.yesstyle.com/en/search?q=${encodeURIComponent(q)}`,
};

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
      "id, name, slug, generic_name, brand_names, description, image_url, price_range, product_type, verdict, category_id"
    )
    .or(`name.ilike.%${decoded}%,generic_name.ilike.%${decoded}%`)
    .order("comparison_score", { ascending: false, nullsFirst: true })
    .limit(5);

  let products = (medData ?? []) as Array<Record<string, unknown>>;

  // 2. If not enough, search by brand_names
  if (products.length < 5) {
    const { data: brandData } = await supabase
      .from("medications")
      .select(
        "id, name, slug, generic_name, brand_names, description, image_url, price_range, product_type, verdict, category_id"
      )
      .contains("brand_names", [decoded])
      .limit(5 - products.length);

    if (brandData) {
      const existingIds = new Set(products.map((p) => p.id));
      for (const row of brandData) {
        if (!existingIds.has(row.id))
          products.push(row as Record<string, unknown>);
      }
    }
  }

  // 3. Load purchase links for each product
  const productIds = products.map((p) => p.id as number);
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

  // 4. Build retailer search links (always available)
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

  // 5. Related trends
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

  // 6. Retailer product sections (sample data — replace with API later)
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

// ============================================================
// Sample retailer products (placeholder until APIs are connected)
// ============================================================

const SAMPLE_PRODUCTS: Record<string, Record<string, RetailerProduct[]>> = {
  moisturizer: {
    amazon: [
      { name: "CeraVe Moisturizing Cream", imageUrl: "https://m.media-amazon.com/images/I/61S7BrCBj7L._SL300_.jpg", price: "$16.99", description: "Daily face & body moisturizer with 3 essential ceramides and hyaluronic acid", url: "https://www.amazon.com/dp/B00TTD9BRC" },
      { name: "Neutrogena Hydro Boost Gel-Cream", imageUrl: "https://m.media-amazon.com/images/I/71cVOgvzIaL._SL300_.jpg", price: "$19.97", description: "Oil-free water gel moisturizer with hyaluronic acid for extra-dry skin", url: "https://www.amazon.com/dp/B00NR1YQHM" },
      { name: "La Roche-Posay Toleriane Double Repair", imageUrl: "https://m.media-amazon.com/images/I/61Yb0KRVZnL._SL300_.jpg", price: "$22.99", description: "UV moisturizer SPF 30 with ceramide-3 and niacinamide", url: "https://www.amazon.com/dp/B01N9SPQHQ" },
      { name: "Vanicream Moisturizing Cream", imageUrl: "https://m.media-amazon.com/images/I/61QNp0pMVhL._SL300_.jpg", price: "$14.49", description: "Fragrance-free, dye-free for sensitive skin — dermatologist recommended", url: "https://www.amazon.com/dp/B000NWGCZ2" },
      { name: "Cetaphil Daily Hydrating Lotion", imageUrl: "https://m.media-amazon.com/images/I/61lKBdXFyYL._SL300_.jpg", price: "$13.99", description: "Lightweight daily moisturizer with hyaluronic acid for all skin types", url: "https://www.amazon.com/dp/B07GC74LL5" },
    ],
    iherb: [
      { name: "NOW Solutions Hyaluronic Acid Moisturizer", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/now/now07730/y/28.jpg", price: "$12.47", description: "PM moisturizer with hyaluronic acid and botanical extracts", url: "https://www.iherb.com/pr/now-foods-solutions-hyaluronic-acid-moisturizer/899" },
      { name: "Cosrx Advanced Snail 92 Cream", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/cos/cos00192/y/23.jpg", price: "$16.64", description: "K-beauty snail mucin cream for deep hydration and skin repair", url: "https://www.iherb.com/pr/cosrx-advanced-snail-92-all-in-one-cream/83954" },
      { name: "Cerave Moisturizing Cream", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/cer/cer00279/v/12.jpg", price: "$18.92", description: "Ceramide-rich face & body cream developed with dermatologists", url: "https://www.iherb.com/pr/cerave-moisturizing-cream/82792" },
      { name: "Pyunkang Yul Moisture Cream", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/pyu/pyu00255/y/16.jpg", price: "$14.56", description: "K-beauty deep moisture cream with astragalus root extract", url: "https://www.iherb.com/pr/pyunkang-yul-moisture-cream/103099" },
      { name: "Heimish Moringa Ceramide Cream", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/hem/hem00088/y/8.jpg", price: "$19.00", description: "Barrier-strengthening cream with moringa oil and ceramides", url: "https://www.iherb.com/pr/heimish-moringa-ceramide-hyaluronic-hydrating-cream/113399" },
    ],
    stylekorean: [
      { name: "COSRX Oil-Free Ultra Moisturizing Lotion", imageUrl: "https://www.stylekorean.com/shop/data/goods/1648/main_image/20220316_102447.jpg", price: "$13.90", description: "Lightweight birch sap lotion for oily and combination skin", url: "https://www.stylekorean.com/shop/cosrx-oil-free-ultra-moisturizing-lotion-with-birch-sap/1648/" },
      { name: "Laneige Water Bank Blue Hyaluronic Cream", imageUrl: "https://www.stylekorean.com/shop/data/goods/8832/main_image/20230116_155818.jpg", price: "$28.00", description: "Intensive hydrating cream with blue hyaluronic acid technology", url: "https://www.stylekorean.com/shop/laneige-water-bank-blue-hyaluronic-cream-moisturizer/8832/" },
      { name: "Innisfree Green Tea Seed Cream", imageUrl: "https://www.stylekorean.com/shop/data/goods/5024/main_image/20210621_165510.jpg", price: "$18.50", description: "Antioxidant-rich cream with Jeju green tea for hydration", url: "https://www.stylekorean.com/shop/innisfree-green-tea-seed-cream/5024/" },
      { name: "Etude SoonJung 2x Barrier Cream", imageUrl: "https://www.stylekorean.com/shop/data/goods/3245/main_image/20210119_152036.jpg", price: "$12.80", description: "pH 5.5 panthenol barrier cream for sensitive skin", url: "https://www.stylekorean.com/shop/etude-soonjung-2x-barrier-intensive-cream/3245/" },
      { name: "Sulwhasoo Concentrated Ginseng Cream", imageUrl: "https://www.stylekorean.com/shop/data/goods/9912/main_image/20230801_102156.jpg", price: "$89.00", description: "Luxury anti-aging cream with Korean red ginseng extract", url: "https://www.stylekorean.com/shop/sulwhasoo-concentrated-ginseng-renewing-cream/9912/" },
    ],
    yesstyle: [
      { name: "Beauty of Joseon Dynasty Cream", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/beauty-of-joseon-dynasty-cream-50ml.jpg", price: "$15.90", description: "Traditional Korean rice bran & ginseng nourishing cream", url: "https://www.yesstyle.com/en/beauty-of-joseon-dynasty-cream-50ml/info.html/pid.1076583846" },
      { name: "SKIN1004 Madagascar Centella Cream", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/skin1004-madagascar-centella-soothing-cream-75ml.jpg", price: "$18.90", description: "Centella asiatica soothing cream for calming irritated skin", url: "https://www.yesstyle.com/en/skin1004-madagascar-centella-soothing-cream/info.html/pid.1098254019" },
      { name: "MISSHA Time Revolution Night Repair", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/missha-time-revolution-night-repair-ampoule-cream-50ml.jpg", price: "$24.90", description: "Fermented night cream with bifida ferment lysate for renewal", url: "https://www.yesstyle.com/en/missha-time-revolution-night-repair-ampoule-cream/info.html/pid.1097543215" },
      { name: "Torriden DIVE-IN Low Molecule Cream", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/torriden-dive-in-low-molecular-hyaluronic-acid-cream-80ml.jpg", price: "$19.90", description: "5 types of hyaluronic acid for multi-layer deep hydration", url: "https://www.yesstyle.com/en/torriden-dive-in-low-molecular-hyaluronic-acid-cream/info.html/pid.1107294315" },
      { name: "Dr. Jart+ Ceramidin Cream", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/dr-jart-ceramidin-cream-50ml.jpg", price: "$36.90", description: "5-Cera Complex barrier repair cream — dermatologist tested", url: "https://www.yesstyle.com/en/dr-jart-ceramidin-cream-50ml/info.html/pid.1054956044" },
    ],
  },
  sunscreen: {
    amazon: [
      { name: "EltaMD UV Clear SPF 46", imageUrl: "https://m.media-amazon.com/images/I/61DQMU-wDIL._SL300_.jpg", price: "$39.00", description: "Oil-free facial sunscreen with niacinamide — dermatologist #1 recommended", url: "https://www.amazon.com/dp/B002MSN3QQ" },
      { name: "Supergoop Unseen Sunscreen SPF 40", imageUrl: "https://m.media-amazon.com/images/I/51PLGZ55GwL._SL300_.jpg", price: "$38.00", description: "Invisible, weightless, scentless SPF 40 primer for all skin tones", url: "https://www.amazon.com/dp/B07B3T6FHD" },
      { name: "La Roche-Posay Anthelios Melt-in SPF 60", imageUrl: "https://m.media-amazon.com/images/I/61OKEhmjk5L._SL300_.jpg", price: "$35.99", description: "Ultra-light fluid face sunscreen with Cell-Ox Shield technology", url: "https://www.amazon.com/dp/B002CML1VG" },
      { name: "Blue Lizard Sensitive Mineral SPF 50+", imageUrl: "https://m.media-amazon.com/images/I/71SYm-SRnkL._SL300_.jpg", price: "$17.98", description: "100% mineral zinc oxide sunscreen — smart bottle turns blue in UV", url: "https://www.amazon.com/dp/B01M7T1GY2" },
      { name: "Neutrogena Ultra Sheer Dry-Touch SPF 55", imageUrl: "https://m.media-amazon.com/images/I/71txQq7OQFL._SL300_.jpg", price: "$10.97", description: "Lightweight, non-greasy broad spectrum UVA/UVB protection", url: "https://www.amazon.com/dp/B004D2826K" },
    ],
    iherb: [
      { name: "COSRX Aloe Soothing Sun Cream SPF 50+", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/cos/cos00576/y/13.jpg", price: "$14.28", description: "Lightweight K-beauty sun cream with aloe vera — no white cast", url: "https://www.iherb.com/pr/cosrx-aloe-soothing-sun-cream-spf-50-pa/97176" },
      { name: "Purito Daily Go-To Sunscreen SPF 50+", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/put/put00016/y/3.jpg", price: "$12.99", description: "Chemical-free daily sun protection with centella extract", url: "https://www.iherb.com/pr/purito-daily-go-to-sunscreen/116788" },
      { name: "Beauty of Joseon Relief Sun SPF 50+", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/boj/boj00004/y/8.jpg", price: "$12.50", description: "Rice + probiotics organic sunscreen — lightweight, moisturizing", url: "https://www.iherb.com/pr/beauty-of-joseon-relief-sun-rice-probiotics/112781" },
      { name: "Isntree Hyaluronic Acid Watery Sun Gel", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/int/int00066/y/3.jpg", price: "$13.86", description: "Watery gel sunscreen with 50% hyaluronic acid complex", url: "https://www.iherb.com/pr/isntree-hyaluronic-acid-watery-sun-gel/113847" },
      { name: "Round Lab Birch Juice Moisturizing Sunscreen", imageUrl: "https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/rou/rou00006/y/8.jpg", price: "$15.20", description: "Birch juice-infused moisturizing sunscreen for dry skin", url: "https://www.iherb.com/pr/round-lab-birch-juice-moisturizing-sunscreen/113612" },
    ],
    stylekorean: [
      { name: "MISSHA All Around Safe Block SPF 50+", imageUrl: "https://www.stylekorean.com/shop/data/goods/2456/main_image/20201215_153024.jpg", price: "$9.80", description: "Best-selling Korean daily sun milk — lightweight, affordable", url: "https://www.stylekorean.com/shop/missha-all-around-safe-block-essence-sun-milk-spf50-pa/2456/" },
      { name: "Innisfree Daily UV Defense SPF 36", imageUrl: "https://www.stylekorean.com/shop/data/goods/7821/main_image/20220815_102410.jpg", price: "$14.00", description: "No sebum daily sunscreen — matte finish for oily skin", url: "https://www.stylekorean.com/shop/innisfree-daily-uv-defense-sunscreen/7821/" },
      { name: "Sulwhasoo UV Wise Brightening Cream SPF 50+", imageUrl: "https://www.stylekorean.com/shop/data/goods/10512/main_image/20231112_094522.jpg", price: "$45.00", description: "Luxury tone-up sun cream with ginseng — multi-protection", url: "https://www.stylekorean.com/shop/sulwhasoo-uv-wise-brightening-multi-protector/10512/" },
      { name: "Rohto Skin Aqua Tone Up UV Essence", imageUrl: "https://www.stylekorean.com/shop/data/goods/6234/main_image/20220110_163825.jpg", price: "$11.50", description: "Japanese lavender tone-up sun essence — transparent finish", url: "https://www.stylekorean.com/shop/rohto-skin-aqua-tone-up-uv-essence-spf50-pa/6234/" },
      { name: "Anessa Perfect UV Sunscreen Milk SPF 50+", imageUrl: "https://www.stylekorean.com/shop/data/goods/8321/main_image/20221019_161025.jpg", price: "$28.00", description: "Shiseido's strongest UV protection — water & sweat resistant", url: "https://www.stylekorean.com/shop/anessa-perfect-uv-sunscreen-skincare-milk/8321/" },
    ],
    yesstyle: [
      { name: "Biore UV Aqua Rich Watery Essence SPF 50+", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/biore-uv-aqua-rich-watery-essence-spf-50-pa-2019-edition-50g.jpg", price: "$12.90", description: "Cult-favorite Japanese watery sunscreen — lightweight, no white cast", url: "https://www.yesstyle.com/en/biore-uv-aqua-rich-watery-essence-spf50/info.html/pid.1053576956" },
      { name: "SKIN1004 Madagascar Centella Air-Fit SPF 50+", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/skin1004-madagascar-centella-air-fit-suncream-plus-spf50-pa-50ml.jpg", price: "$14.90", description: "Centella soothing sun cream — calming for sensitive skin", url: "https://www.yesstyle.com/en/skin1004-madagascar-centella-air-fit-suncream/info.html/pid.1098254098" },
      { name: "Klairs All-day Airy Sunscreen SPF 50+", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/klairs-all-day-airy-sunscreen-spf50-pa-50ml.jpg", price: "$18.90", description: "Ultra-lightweight airy texture — no stickiness, reef-safe", url: "https://www.yesstyle.com/en/klairs-all-day-airy-sunscreen-spf50/info.html/pid.1089953145" },
      { name: "Nivea UV Deep Protect & Care Gel SPF 50+", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/nivea-japan-uv-deep-protect-care-gel-spf50-pa-80g.jpg", price: "$13.90", description: "Japanese deep UV protection gel — beauty-care formula", url: "https://www.yesstyle.com/en/nivea-uv-deep-protect-care-gel-spf50/info.html/pid.1102451312" },
      { name: "Round Lab Birch Juice Moisturizing Sun Cream", imageUrl: "https://d2gg9evh47fn9z.cloudfront.net/thumb/300/round-lab-birch-juice-moisturizing-sun-cream-spf50-pa-50ml.jpg", price: "$16.90", description: "Hydrating birch juice sun cream for dry and dehydrated skin", url: "https://www.yesstyle.com/en/round-lab-birch-juice-moisturizing-sun-cream/info.html/pid.1107523941" },
    ],
  },
};

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

  // Find best matching sample key
  const lowerKeyword = keyword.toLowerCase();
  const sampleKey = Object.keys(SAMPLE_PRODUCTS).find((k) =>
    lowerKeyword.includes(k)
  );

  return retailerLinks.map((r) => ({
    retailerName: r.name,
    retailerSlug: r.slug,
    emoji: EMOJIS[r.slug] ?? "🏪",
    searchUrl: r.searchUrl,
    products: sampleKey
      ? (SAMPLE_PRODUCTS[sampleKey][r.slug] ?? getGenericSamples(keyword, r.slug))
      : getGenericSamples(keyword, r.slug),
  }));
}
