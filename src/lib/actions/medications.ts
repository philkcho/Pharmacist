"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getBestOtcLabel, type FdaDrugLabel } from "@/lib/fda/client";
import { submitToIndexNow } from "@/lib/seo/indexnow";

/** Consider a synced FDA record stale after 90 days. */
const STALE_MS = 90 * 24 * 60 * 60 * 1000;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface CachedMedication {
  id: number;
  name: string;
  slug: string;
  generic_name: string | null;
  brand_names: string[] | null;
  description: string | null;
  active_ingredients: unknown;
  dosage_forms: string[] | null;
  warnings: string | null;
  side_effects: string | null;
  is_otc: boolean;
  fda_spl_id: string | null;
  last_synced_at: string | null;
  source: string;
}

function isStale(row: CachedMedication): boolean {
  if (!row.last_synced_at) return true;
  return Date.now() - new Date(row.last_synced_at).getTime() > STALE_MS;
}

function labelToMedicationRow(label: FdaDrugLabel, fallbackName: string) {
  const name = label.brandName ?? label.genericName ?? fallbackName;
  return {
    name,
    slug: slugify(name),
    generic_name: label.genericName,
    brand_names: label.brandName ? [label.brandName] : [],
    description: label.purpose ?? label.indications,
    active_ingredients: label.activeIngredients,
    dosage_forms: label.dosageForms,
    warnings: label.warnings,
    side_effects: label.sideEffects,
    is_otc: true,
    fda_spl_id: label.splId || null,
    last_synced_at: new Date().toISOString(),
    source: "fda" as const,
  };
}

/**
 * Look up a medication by brand/generic name.
 * Hybrid strategy: DB cache first, fall back to openFDA + upsert on miss/stale.
 *
 * Uses the admin Supabase client for the write path so the cache works
 * regardless of the caller's auth context (e.g. server actions triggered
 * during article generation).
 */
export async function getOrFetchMedication(
  term: string
): Promise<CachedMedication | null> {
  const trimmed = term.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const lower = trimmed.toLowerCase();

  // 1) DB cache lookup — match against name, generic_name, or brand_names
  const { data: existing } = await supabase
    .from("medications")
    .select("*")
    .or(
      `name.ilike.${lower},generic_name.ilike.${lower},brand_names.cs.{${lower}}`
    )
    .limit(1)
    .maybeSingle<CachedMedication>();

  if (existing && !isStale(existing)) return existing;

  // 2) Cache miss or stale → fetch from openFDA
  const label = await getBestOtcLabel(trimmed);
  if (!label) return existing ?? null; // return stale over nothing

  const row = labelToMedicationRow(label, trimmed);

  // 3) Upsert into the cache. RLS allows pharmacists to write; if the caller
  //    isn't authenticated (e.g. an anonymous endpoint), the upsert will fail
  //    silently and we return the fresh label without caching.
  const { data: upserted, error: upsertError } = await supabase
    .from("medications")
    .upsert(row, { onConflict: "slug" })
    .select("*")
    .single<CachedMedication>();

  if (upsertError) {
    console.warn(
      "[medications] upsert skipped (likely RLS):",
      upsertError.message
    );
    // Synthesize a row-like object from the label so callers still get data
    return {
      id: existing?.id ?? -1,
      ...row,
      active_ingredients: row.active_ingredients,
      description: row.description ?? null,
    } as unknown as CachedMedication;
  }

  // Auto-generate purchase links for newly cached FDA products
  if (upserted && (!existing || existing.id !== upserted.id)) {
    import("@/lib/actions/purchase-links")
      .then(({ autoGeneratePurchaseLinks }) =>
        autoGeneratePurchaseLinks(
          upserted.id,
          upserted.name,
          "otc_drug"
        )
      )
      .catch((err) =>
        console.warn(
          "[medications] auto-link failed:",
          err instanceof Error ? err.message : err
        )
      );
  }

  return upserted;
}

/**
 * Bulk variant: resolve a list of names (e.g. extracted from an article topic)
 * and return the ones that hit either the cache or openFDA.
 */
export async function getOrFetchMedications(
  terms: string[]
): Promise<CachedMedication[]> {
  const unique = Array.from(
    new Set(terms.map((t) => t.trim()).filter(Boolean))
  );
  const results = await Promise.all(unique.map((t) => getOrFetchMedication(t)));
  return results.filter((r): r is CachedMedication => r !== null);
}

/**
 * Admin utility: fetch a medication by name, showing exactly which path was
 * taken (DB cache hit vs fresh FDA fetch) so the operator can verify the
 * hybrid cache is working. Revalidates /medications so the table refreshes
 * when a new row lands.
 */
export async function previewMedicationFromFda(term: string): Promise<{
  ok: boolean;
  source: "cache" | "fda" | "none";
  medication: CachedMedication | null;
  error?: string;
}> {
  const trimmed = term.trim();
  if (!trimmed) {
    return { ok: false, source: "none", medication: null, error: "Name required" };
  }

  const supabase = await createClient();
  const lower = trimmed.toLowerCase();

  const { data: existing } = await supabase
    .from("medications")
    .select("*")
    .or(
      `name.ilike.${lower},generic_name.ilike.${lower},brand_names.cs.{${lower}}`
    )
    .limit(1)
    .maybeSingle<CachedMedication>();

  if (existing && !isStale(existing)) {
    return { ok: true, source: "cache", medication: existing };
  }

  const label = await getBestOtcLabel(trimmed);
  if (!label) {
    return {
      ok: false,
      source: "none",
      medication: existing ?? null,
      error: "No FDA label found for this name",
    };
  }

  const row = labelToMedicationRow(label, trimmed);
  const { data: upserted, error: upsertError } = await supabase
    .from("medications")
    .upsert(row, { onConflict: "slug" })
    .select("*")
    .single<CachedMedication>();

  if (upsertError) {
    return {
      ok: false,
      source: "fda",
      medication: null,
      error: `Upsert failed: ${upsertError.message}`,
    };
  }

  revalidatePath("/medications");
  return { ok: true, source: "fda", medication: upserted };
}

export async function getMedications() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*, category:categories(name)")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function createMedication(formData: {
  name: string;
  slug: string;
  generic_name: string;
  brand_names: string[];
  category_id: number | null;
  is_otc: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("medications").insert(formData);

  if (error) throw new Error(error.message);
  revalidatePath("/medications");
}

export async function updateMedication(
  id: number,
  formData: {
    name: string;
    slug: string;
    generic_name: string;
    brand_names: string[];
    category_id: number | null;
    is_otc: boolean;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("medications")
    .update(formData)
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/medications");
}

export async function deleteMedication(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("medications").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/medications");
}

// ============================================================
// Approval queue
// ============================================================

export type ApprovalStatus = "draft" | "pending_review" | "approved" | "rejected";

export interface ApprovalQueueRow {
  id: number;
  name: string;
  slug: string;
  genericName: string | null;
  brandNames: string[] | null;
  description: string | null;
  imageUrl: string | null;
  productType: string;
  approvalStatus: string;
  source: string;
  categoryName: string | null;
  inciList: string | null;
  externalSource: string | null;
  createdAt: string;
}

export async function getApprovalQueue(
  status: ApprovalStatus = "draft",
  limit = 50
): Promise<ApprovalQueueRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*, category:categories(name)")
    .eq("approval_status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[medications] approval queue failed:", error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    genericName: (r.generic_name as string) ?? null,
    brandNames: (r.brand_names as string[]) ?? null,
    description: (r.description as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    productType: (r.product_type as string) ?? "otc_drug",
    approvalStatus: (r.approval_status as string) ?? "draft",
    source: (r.source as string) ?? "manual",
    categoryName: (r.category as { name: string } | null)?.name ?? null,
    inciList: (r.inci_list as string) ?? null,
    externalSource: (r.external_source as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function approveProduct(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("medications")
    .update({
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/approval-queue");
  revalidatePath("/medications");
  if (data?.slug) {
    revalidatePath(`/analysis/${data.slug}`);
    void submitToIndexNow([`/analysis/${data.slug}`]);
  }
  return { ok: true };
}

export async function rejectProduct(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("medications")
    .update({ approval_status: "rejected" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/approval-queue");
  return { ok: true };
}

export async function getApprovalCounts(): Promise<
  Record<ApprovalStatus, number>
> {
  const supabase = await createClient();
  const counts: Record<ApprovalStatus, number> = {
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
  };

  for (const status of Object.keys(counts) as ApprovalStatus[]) {
    const { count } = await supabase
      .from("medications")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", status);
    counts[status] = count ?? 0;
  }

  return counts;
}

// ============================================================
// Public compare page queries
// ============================================================

/**
 * Row shape returned by the public compare page. Includes the compare
 * feature fields added in migration 003 (pros/cons/verdict/etc.) in
 * addition to the base medication fields.
 */
export interface CompareMedicationRow {
  id: number;
  name: string;
  slug: string;
  generic_name: string | null;
  brand_names: string[] | null;
  description: string | null;
  active_ingredients: unknown;
  dosage_forms: string[] | null;
  warnings: string | null;
  side_effects: string | null;
  image_url: string | null;
  is_otc: boolean;
  source: string;
  fda_spl_id: string | null;
  category_id: number | null;
  purchase_links: unknown;
  // Compare feature fields (migration 003)
  pros: unknown;
  cons: unknown;
  verdict: string | null;
  verdict_source_ids: number[] | null;
  ingredient_analysis: unknown;
  comparison_score: number | null;
  scoring_rationale: string | null;
  is_featured: boolean;
  price_range: string | null;
  price_range_min: string | null;
  price_range_max: string | null;
  price_currency: string | null;
  price_updated_at: string | null;
  recommended_for: string[] | null;
  is_ai_drafted: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  view_count: number;
}

/**
 * Get all medications in a given category, sorted by comparison_score
 * (featured + highest score first). Pharmacist-reviewed rows outrank
 * FDA-only rows within the same score band.
 *
 * Used by `/compare/[category-slug]` — the public compare page.
 */
export async function getMedicationsByCategorySlug(
  categorySlug: string
): Promise<CompareMedicationRow[]> {
  const supabase = await createClient();

  // Resolve category → id first (clearer query, indexable)
  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("slug", categorySlug)
    .maybeSingle();

  if (catError) {
    console.error("[medications] category lookup failed:", catError);
    return [];
  }
  if (!category) return [];

  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("category_id", category.id)
    .eq("approval_status", "approved")
    .order("is_featured", { ascending: false })
    .order("comparison_score", { ascending: false, nullsFirst: false })
    .order("name");

  if (error) {
    console.error("[medications] byCategory failed:", error);
    return [];
  }

  return (data ?? []) as CompareMedicationRow[];
}

// ─── Homepage category widget — top-N by category ──────────

export interface CategoryTopProduct {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceRange: string | null;
  /** Highest-priority retailer purchase link, if any. */
  purchaseUrl: string | null;
  retailerName: string | null;
}

/**
 * Top N approved products in a category slug, ranked by is_featured then
 * comparison_score. For each product, attaches its highest-priority
 * (lowest sort_order) active purchase link if one exists.
 *
 * Used by the homepage left-side category widget.
 */
export async function getCategoryTopProducts(
  slug: string,
  limit = 5
): Promise<CategoryTopProduct[]> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) return [];

  const { data: meds, error } = await supabase
    .from("medications")
    .select("id, slug, name, image_url, price_range")
    .eq("category_id", category.id)
    .eq("approval_status", "approved")
    .order("is_featured", { ascending: false })
    .order("comparison_score", { ascending: false, nullsFirst: false })
    .order("name")
    .limit(limit);

  if (error || !meds || meds.length === 0) {
    return [];
  }

  // Fetch best active purchase link per medication in one query.
  const medIds = meds.map((m) => m.id as number);
  const { data: links } = await supabase
    .from("product_purchase_links")
    .select("medication_id, url, affiliate_url, sort_order, retailers(name)")
    .in("medication_id", medIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Group by medication_id and keep first (lowest sort_order) wins.
  const bestLinkByMed = new Map<
    number,
    { url: string; retailerName: string | null }
  >();
  for (const link of links ?? []) {
    const mid = link.medication_id as number;
    if (bestLinkByMed.has(mid)) continue;
    const retailer = link.retailers as { name?: string } | null;
    bestLinkByMed.set(mid, {
      url: (link.affiliate_url as string | null) ?? (link.url as string),
      retailerName: retailer?.name ?? null,
    });
  }

  return meds.map((m) => {
    const mid = m.id as number;
    const best = bestLinkByMed.get(mid);
    return {
      id: mid,
      slug: m.slug as string,
      name: m.name as string,
      imageUrl: (m.image_url as string | null) ?? null,
      priceRange: (m.price_range as string | null) ?? null,
      purchaseUrl: best?.url ?? null,
      retailerName: best?.retailerName ?? null,
    };
  });
}

/**
 * Get only the featured medications across all categories, globally
 * sorted by comparison_score. Used by the `/compare` hub page's
 * "Editor's Picks" section.
 */
export async function getFeaturedMedications(
  limit = 12
): Promise<CompareMedicationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("is_featured", true)
    .eq("approval_status", "approved")
    .order("comparison_score", { ascending: false, nullsFirst: false })
    .order("name")
    .limit(limit);

  if (error) {
    console.error("[medications] featured failed:", error);
    return [];
  }
  return (data ?? []) as CompareMedicationRow[];
}

/**
 * Get a single medication by slug for the product detail page
 * `/compare/[category-slug]/[medication-slug]`. Returns null if
 * the slug doesn't match or RLS blocks the read.
 */
export async function getMedicationBySlug(
  slug: string
): Promise<CompareMedicationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[medications] bySlug failed:", error);
    return null;
  }
  return (data as CompareMedicationRow | null) ?? null;
}

/**
 * Row shape for medication_references, matching migration 003.
 * All fields use snake_case to mirror the DB; the UI layer can
 * re-alias if needed.
 */
export interface MedicationReferenceRow {
  id: number;
  medication_id: number;
  source_type: string;
  tier_level: number;
  title: string;
  url: string;
  authors: string | null;
  published_at: string | null;
  accessed_at: string | null;
  citation_text: string | null;
  sort_order: number;
}

/**
 * Fetch all references for a medication, sorted for display.
 * RLS allows public SELECT on `medication_references`.
 */
export async function getMedicationReferences(
  medicationId: number
): Promise<MedicationReferenceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medication_references")
    .select("*")
    .eq("medication_id", medicationId)
    .order("tier_level", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[medications] references failed:", error);
    return [];
  }
  return (data ?? []) as MedicationReferenceRow[];
}

/**
 * Fetch the pharmacist profile for the reviewer of a medication.
 * Used to render "Last reviewed by Dr. X" in the trust bar.
 */
export async function getMedicationReviewer(
  reviewedBy: string | null
): Promise<{ display_name: string; title: string | null; slug: string } | null> {
  if (!reviewedBy) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pharmacist_profiles")
    .select("display_name, title, slug")
    .eq("id", reviewedBy)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Count medications per category, for the `/compare` hub grid.
 */
export async function getMedicationCountsByCategory(): Promise<
  Record<number, number>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("category_id");

  if (error) {
    console.error("[medications] counts failed:", error);
    return {};
  }

  const counts: Record<number, number> = {};
  for (const row of data ?? []) {
    const id = (row as { category_id: number | null }).category_id;
    if (id !== null && id !== undefined) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Import SAMPLE_PRODUCTS from topics.ts into DB with AI-generated
 * analysis, images, and purchase links. Skips products already in DB.
 */
export async function importSampleProducts(): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  const { SAMPLE_PRODUCTS } = await import("@/lib/data/sample-products");
  const { generateProductAnalysis } = await import(
    "@/lib/ai/generate-product-analysis"
  );
  const { fetchRealProductImage } = await import(
    "@/lib/images/search-product-image"
  );
  const { autoGeneratePurchaseLinks } = await import(
    "@/lib/actions/purchase-links"
  );

  const supabase = await createClient();

  // Flatten SAMPLE_PRODUCTS into a unique list by product name
  const seen = new Set<string>();
  const allProducts: {
    name: string;
    imageUrl: string;
    description: string;
    retailerSlug: string;
    productUrl: string;
    keyword: string;
  }[] = [];

  for (const [keyword, retailerMap] of Object.entries(SAMPLE_PRODUCTS)) {
    for (const [retailerSlug, products] of Object.entries(retailerMap)) {
      for (const p of products) {
        if (seen.has(p.name.toLowerCase())) continue;
        seen.add(p.name.toLowerCase());
        allProducts.push({
          name: p.name,
          imageUrl: p.imageUrl,
          description: p.description,
          retailerSlug,
          productUrl: p.url,
          keyword,
        });
      }
    }
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of allProducts) {
    try {
      // Check if already in DB
      const productSlug = slugify(product.name);
      const { data: existing } = await supabase
        .from("medications")
        .select("id")
        .eq("slug", productSlug)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Infer product_type from keyword
      const productType = inferProductType(product.keyword);

      // Generate AI analysis
      const analysis = await generateProductAnalysis(
        product.name,
        productType,
        product.description
      );

      // Real product image via Google Custom Search (null → placeholder)
      const imageUrl = await fetchRealProductImage(product.name);

      // Insert product
      const { data: inserted, error: insertError } = await supabase
        .from("medications")
        .insert({
          name: product.name,
          slug: productSlug,
          description: product.description,
          image_url: imageUrl,
          product_type: productType,
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          source: "manual",
          is_otc: true,
          verdict: analysis.verdict,
          pros: analysis.pros,
          cons: analysis.cons,
          ingredient_analysis: analysis.ingredientAnalysis,
          usage_guide_jsonb: analysis.usageGuide,
          recommended_for: analysis.recommendedFor,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error(
          `[import] Insert failed for ${product.name}:`,
          insertError?.message
        );
        errors++;
        continue;
      }

      // Generate purchase links based on product type
      await autoGeneratePurchaseLinks(
        inserted.id as number,
        product.name,
        productType
      );

      imported++;
    } catch (e) {
      console.error(
        `[import] Failed for ${product.name}:`,
        e instanceof Error ? e.message : e
      );
      errors++;
    }
  }

  revalidatePath("/medications");
  revalidatePath("/");
  revalidatePath("/topics", "layout");

  return {
    success: true,
    imported,
    skipped,
    errors,
    message: `Imported ${imported} products (${skipped} already existed, ${errors} errors)`,
  };
}

function inferProductType(keyword: string): string {
  const lower = keyword.toLowerCase();
  if (
    lower.includes("sunscreen") ||
    lower.includes("spf")
  )
    return "quasi_drug";
  if (
    lower.includes("moisturizer") ||
    lower.includes("cream") ||
    lower.includes("serum") ||
    lower.includes("cleanser") ||
    lower.includes("toner") ||
    lower.includes("k-beauty") ||
    lower.includes("acne")
  )
    return "cosmetic";
  if (
    lower.includes("vitamin") ||
    lower.includes("supplement") ||
    lower.includes("b12") ||
    lower.includes("melatonin") ||
    lower.includes("collagen")
  )
    return "supplement";
  return "otc_drug";
}

/**
 * Fetch real product images via Google Custom Search for products that
 * currently have NO image OR have a legacy AI-generated image
 * (Pollinations). Skips products that already have a non-AI URL.
 *
 * Respects Google CSE's 100/day free tier — on quota exhaustion the
 * search returns null and this function skips that product quietly.
 * Re-run the next day to continue.
 */
export async function generateMissingProductImages(): Promise<{
  success: boolean;
  generated: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  const { fetchRealProductImage } = await import(
    "@/lib/images/search-product-image"
  );
  const supabase = await createClient();

  const { data: products, error: fetchError } = await supabase
    .from("medications")
    .select("id, name, product_type, image_url");

  if (fetchError) {
    return {
      success: false,
      generated: 0,
      skipped: 0,
      errors: 0,
      message: fetchError.message,
    };
  }

  if (!products || products.length === 0) {
    return {
      success: true,
      generated: 0,
      skipped: 0,
      errors: 0,
      message: "No products in DB.",
    };
  }

  // Targets: missing images + legacy AI (Pollinations) images.
  // Real CDN URLs (retailer CDNs, googleusercontent, etc.) are kept.
  const missing = products.filter((p) => {
    const url = (p.image_url as string | null) ?? "";
    if (url.trim() === "") return true;
    if (url.includes("pollinations.ai")) return true;
    return false;
  });

  if (missing.length === 0) {
    return {
      success: true,
      generated: 0,
      skipped: products.length,
      errors: 0,
      message: "All products already have images.",
    };
  }

  let generated = 0;
  let errors = 0;

  for (const product of missing) {
    try {
      const imageUrl = await fetchRealProductImage(product.name as string);
      if (!imageUrl) {
        // No match — skip (don't overwrite with null, don't count as error)
        continue;
      }

      const { error: updateError } = await supabase
        .from("medications")
        .update({ image_url: imageUrl })
        .eq("id", product.id as number);

      if (updateError) {
        console.error(
          `[image-gen] Failed to update product ${product.id}:`,
          updateError.message
        );
        errors++;
      } else {
        generated++;
      }
    } catch (e) {
      console.error(
        `[image-gen] Search failed for product ${product.id}:`,
        e instanceof Error ? e.message : e
      );
      errors++;
    }
  }

  revalidatePath("/medications");
  revalidatePath("/");

  return {
    success: true,
    generated,
    skipped: products.length - missing.length,
    errors,
    message: `Generated ${generated} images (${errors} errors, ${products.length - missing.length} skipped)`,
  };
}
