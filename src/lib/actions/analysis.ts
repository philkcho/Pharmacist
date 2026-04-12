"use server";

import { createClient } from "@/lib/supabase/server";

export interface IngredientDetail {
  name: string;
  amount?: string;
  whatItDoes?: string;
  howFast?: string;
  whoItsFor?: string;
  whenToAvoid?: string[];
  maxPerDay?: string;
  mechanism?: string;
  clinicalNotes?: string;
}

export interface PurchaseOption {
  linkId: number;
  retailerName: string;
  retailerSlug: string;
  url: string;
  price?: string;
}

export interface AnalysisPageData {
  found: boolean;
  productName: string;
  slug: string;
  genericName: string | null;
  brandNames: string[] | null;
  description: string | null;
  imageUrl: string | null;
  productType: string;
  priceRange: string | null;
  verdict: string | null;
  pros: string[];
  cons: string[];
  ingredients: IngredientDetail[];
  warnings: string | null;
  sideEffects: string | null;
  purchaseOptions: PurchaseOption[];
  retailerSearchUrls: Array<{ name: string; url: string; emoji: string }>;
}

const RETAILER_TEMPLATES: Record<string, { build: (q: string) => string; emoji: string }> = {
  amazon: { build: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`, emoji: "🛒" },
  iherb: { build: (q) => `https://www.iherb.com/search?kw=${encodeURIComponent(q)}`, emoji: "🌿" },
  stylekorean: { build: (q) => `https://www.stylekorean.com/shop/search/result.php?search_str=${encodeURIComponent(q)}`, emoji: "🇰🇷" },
  yesstyle: { build: (q) => `https://www.yesstyle.com/en/search?q=${encodeURIComponent(q)}`, emoji: "✨" },
};

function parseText(field: unknown): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object" && "text" in (field as Record<string, unknown>)) {
    return String((field as { text: unknown }).text);
  }
  return "";
}

function parseProsCons(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => (typeof item === "string" ? item : parseText(item)))
    .filter((s) => s.length > 0);
}

function parseIngredients(analysis: unknown): IngredientDetail[] {
  if (!Array.isArray(analysis)) return [];
  return analysis
    .filter((item: unknown) => typeof item === "object" && item !== null && "name" in item)
    .map((item: Record<string, unknown>) => {
      const consumer = item.consumer as Record<string, unknown> | undefined;
      const professional = item.professional as Record<string, unknown> | undefined;
      return {
        name: String(item.name ?? ""),
        amount: item.amount ? String(item.amount) : undefined,
        whatItDoes: parseText(consumer?.whatItDoes),
        howFast: parseText(consumer?.howFast),
        whoItsFor: parseText(consumer?.whoItsFor),
        whenToAvoid: Array.isArray(consumer?.whenToAvoid)
          ? (consumer!.whenToAvoid as unknown[]).map((w) => parseText(w)).filter(Boolean)
          : [],
        maxPerDay: parseText(consumer?.maxPerDay),
        mechanism: parseText(professional?.mechanism),
        clinicalNotes: parseText(professional?.clinicalNotes),
      };
    });
}

export async function getProductAnalysis(
  slug: string
): Promise<AnalysisPageData> {
  const supabase = await createClient();
  const decoded = decodeURIComponent(slug).replace(/-/g, " ").trim();

  // Try to find in DB
  const { data: med } = await supabase
    .from("medications")
    .select(
      "id, name, slug, generic_name, brand_names, description, image_url, product_type, price_range, verdict, pros, cons, ingredient_analysis, warnings, side_effects"
    )
    .or(`slug.eq.${slug},name.ilike.%${decoded}%`)
    .limit(1)
    .maybeSingle();

  // Load purchase links if found
  let purchaseOptions: PurchaseOption[] = [];
  if (med) {
    const { data: links } = await supabase
      .from("product_purchase_links")
      .select("id, url, price, retailers(name, slug)")
      .eq("medication_id", med.id as number)
      .eq("is_active", true)
      .order("sort_order");

    if (links) {
      purchaseOptions = links.map((l) => {
        const retailers = l.retailers as unknown;
        const retailer = Array.isArray(retailers)
          ? (retailers[0] as { name: string; slug: string } | undefined)
          : (retailers as { name: string; slug: string } | null);
        return {
          linkId: l.id as number,
          retailerName: retailer?.name ?? "Buy",
          retailerSlug: retailer?.slug ?? "",
          url: l.url as string,
          price: l.price ? String(l.price) : undefined,
        };
      });
    }
  }

  // Build retailer search URLs (always available)
  const searchName = med ? (med.name as string) : decoded;
  const { data: retailers } = await supabase
    .from("retailers")
    .select("name, slug")
    .eq("is_active", true);

  const retailerSearchUrls = (retailers ?? [])
    .filter((r) => RETAILER_TEMPLATES[r.slug as string])
    .map((r) => ({
      name: r.name as string,
      url: RETAILER_TEMPLATES[r.slug as string].build(searchName),
      emoji: RETAILER_TEMPLATES[r.slug as string].emoji,
    }));

  if (med) {
    return {
      found: true,
      productName: med.name as string,
      slug: med.slug as string,
      genericName: (med.generic_name as string) ?? null,
      brandNames: (med.brand_names as string[]) ?? null,
      description: (med.description as string) ?? null,
      imageUrl: (med.image_url as string) ?? null,
      productType: (med.product_type as string) ?? "otc_drug",
      priceRange: (med.price_range as string) ?? null,
      verdict: (med.verdict as string) ?? null,
      pros: parseProsCons(med.pros),
      cons: parseProsCons(med.cons),
      ingredients: parseIngredients(med.ingredient_analysis),
      warnings: (med.warnings as string) ?? null,
      sideEffects: (med.side_effects as string) ?? null,
      purchaseOptions,
      retailerSearchUrls,
    };
  }

  // Not found in DB — return shell with search URLs
  return {
    found: false,
    productName: decoded.charAt(0).toUpperCase() + decoded.slice(1),
    slug,
    genericName: null,
    brandNames: null,
    description: null,
    imageUrl: null,
    productType: "unknown",
    priceRange: null,
    verdict: null,
    pros: [],
    cons: [],
    ingredients: [],
    warnings: null,
    sideEffects: null,
    purchaseOptions: [],
    retailerSearchUrls,
  };
}
