"use server";

import { createClient } from "@/lib/supabase/server";
import type { ArticleReference } from "@/lib/references/fetch-references";

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

export interface UsageGuide {
  howToUse: string;
  storage: string;
  precautions: string;
  tip?: string;
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
  usageGuide: UsageGuide | null;
  warnings: string | null;
  sideEffects: string | null;
  purchaseOptions: PurchaseOption[];
  references: ArticleReference[];
}

const RETAILER_EMOJI: Record<string, string> = {
  amazon: "🛒",
  iherb: "🌿",
  stylekorean: "🇰🇷",
  yesstyle: "✨",
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

function parseUsageGuide(raw: unknown): UsageGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const howToUse = parseText(obj.howToUse);
  const storage = parseText(obj.storage);
  const precautions = parseText(obj.precautions);
  const tip = parseText(obj.tip);
  // Require at least the three core fields; tip is optional.
  if (!howToUse && !storage && !precautions) return null;
  return {
    howToUse,
    storage,
    precautions,
    ...(tip ? { tip } : {}),
  };
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
      "id, name, slug, generic_name, brand_names, description, image_url, product_type, price_range, verdict, pros, cons, ingredient_analysis, usage_guide_jsonb, warnings, side_effects, references_jsonb"
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
      usageGuide: parseUsageGuide(med.usage_guide_jsonb),
      warnings: (med.warnings as string) ?? null,
      sideEffects: (med.side_effects as string) ?? null,
      purchaseOptions,
      references: Array.isArray(med.references_jsonb)
        ? (med.references_jsonb as ArticleReference[])
        : [],
    };
  }

  // Not found in DB — return shell without purchase links
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
    usageGuide: null,
    warnings: null,
    sideEffects: null,
    purchaseOptions: [],
    references: [],
  };
}
