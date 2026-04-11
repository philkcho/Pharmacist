"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getBestOtcLabel, type FdaDrugLabel } from "@/lib/fda/client";

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
