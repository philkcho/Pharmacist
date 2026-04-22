"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { iherbSearchUrl } from "@/lib/affiliate/iherb";

/**
 * Auto-generate search-based purchase links for a product across
 * all active retailers. These are retailer search URLs (not deep
 * links) — they always work without API keys or affiliate accounts.
 *
 * When the pharmacist later gets affiliate accounts (Amazon
 * Associates, Impact/iHerb, etc.), they can replace these search
 * URLs with proper affiliate deep links via the admin UI.
 *
 * Idempotent: skips retailers that already have a link for this
 * product (UNIQUE constraint on medication_id + retailer_id).
 */

interface RetailerSearchConfig {
  slug: string;
  buildSearchUrl: (productName: string) => string;
}

/**
 * Build a more specific search URL by emphasizing exact brand/product match.
 * Amazon's search ranking respects quoted phrases, so we wrap the name in
 * quotes when possible. This reduces unrelated results for supplements.
 */
function exactMatchQuery(name: string): string {
  // Strip common marketing words that hurt search accuracy
  const cleaned = name
    .replace(/\b(the|extra strength|maximum|ultra|original)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return `"${cleaned}"`;
}

const RETAILER_SEARCH_URLS: RetailerSearchConfig[] = [
  {
    slug: "amazon",
    buildSearchUrl: (name) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(exactMatchQuery(name))}&i=hpc`,
    // i=hpc restricts to Health & Household category for better relevance
  },
  {
    slug: "iherb",
    buildSearchUrl: (name) => iherbSearchUrl(name),
  },
  {
    slug: "stylekorean",
    buildSearchUrl: (name) =>
      `https://www.stylekorean.com/shop/search/result.php?search_str=${encodeURIComponent(name)}`,
  },
  {
    slug: "yesstyle",
    buildSearchUrl: (name) =>
      `https://www.yesstyle.com/en/search?q=${encodeURIComponent(name)}`,
  },
];

/**
 * Generate search-based purchase links for a product. Called
 * automatically when products are created via FDA fetch or OBF
 * persist.
 *
 * @param medicationId - The product's ID in the medications table
 * @param productName - The product name to use in search URLs
 * @param productType - "otc_drug" | "supplement" | "cosmetic" | "quasi_drug"
 */
export async function autoGeneratePurchaseLinks(
  medicationId: number,
  productName: string,
  productType: string
): Promise<number> {
  const admin = createAdminClient();

  // Load active retailers
  const { data: retailers } = await admin
    .from("retailers")
    .select("id, slug")
    .eq("is_active", true);

  if (!retailers || retailers.length === 0) return 0;

  // Decide which retailers are relevant for this product type
  const relevantSlugs = getRelevantRetailers(productType);

  let created = 0;
  for (const retailer of retailers) {
    const slug = retailer.slug as string;
    if (!relevantSlugs.has(slug)) continue;

    const config = RETAILER_SEARCH_URLS.find((r) => r.slug === slug);
    if (!config) continue;

    const searchUrl = config.buildSearchUrl(productName);

    const { error } = await admin.from("product_purchase_links").insert({
      medication_id: medicationId,
      retailer_id: retailer.id,
      url: searchUrl,
      is_active: true,
      sort_order: created,
    });

    // 23505 = unique violation (link already exists), skip silently
    if (error && error.code !== "23505") {
      console.warn(
        `[purchase-links] auto-generate failed for med ${medicationId} + retailer ${slug}:`,
        error.message
      );
    } else if (!error) {
      created++;
    }
  }

  return created;
}

/**
 * Determine which retailers are relevant for a product type.
 *
 * - OTC drugs / supplements → Amazon, iHerb
 * - Cosmetics / K-beauty → Amazon, StyleKorean, YesStyle
 * - Quasi-drugs (SPF, medicated) → all
 */
function getRelevantRetailers(productType: string): Set<string> {
  switch (productType) {
    case "otc_drug":
    case "supplement":
      return new Set(["amazon", "iherb"]);
    case "cosmetic":
      return new Set(["amazon", "stylekorean", "yesstyle"]);
    case "quasi_drug":
      return new Set(["amazon", "iherb", "stylekorean", "yesstyle"]);
    default:
      return new Set(["amazon"]);
  }
}
