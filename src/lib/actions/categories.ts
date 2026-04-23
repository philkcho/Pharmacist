"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");

  if (error) throw new Error(error.message);
  return data;
}

export async function createCategory(formData: {
  name: string;
  slug: string;
  description: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert(formData);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

export async function updateCategory(
  id: number,
  formData: { name: string; slug: string; description: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update(formData)
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

export async function deleteCategory(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

// ─── Homepage category widget ───────────────────────────────

export type CategoryDomain = "pharmaceutical" | "beauty";

export interface CategoryWidgetEntry {
  id: number;
  slug: string;
  name: string;
  domain: CategoryDomain;
  productCount: number;
}

/**
 * Parent slugs that anchor each domain. A category is in the matching
 * domain if its own slug is in the parent set, or any ancestor is.
 * Categories outside both sets default to pharmaceutical (safer — OTC
 * drugs shouldn't leak into a beauty-focused UI).
 */
const BEAUTY_PARENT_SLUGS = new Set<string>([
  "skin-care",
  "skin-care-beauty",
  "k-beauty",
  "acne-treatments",
  "anti-aging",
  "moisturizing-creams",
  "sunscreen",
  "eye-care",
]);

const PHARMACEUTICAL_PARENT_SLUGS = new Set<string>([
  "pain-relief",
  "cold-flu",
  "allergy",
  "digestive-health",
  "sleep-relaxation",
  "first-aid",
  "vitamins-supplements",
]);

type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  sort_order: number;
};

function resolveDomain(
  cat: CategoryRow,
  bySlug: Map<string, CategoryRow>,
  byId: Map<number, CategoryRow>
): CategoryDomain {
  // Walk up the parent chain until we hit a known bucket.
  let cursor: CategoryRow | undefined = cat;
  const visited = new Set<number>();
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    if (BEAUTY_PARENT_SLUGS.has(cursor.slug)) return "beauty";
    if (PHARMACEUTICAL_PARENT_SLUGS.has(cursor.slug)) return "pharmaceutical";
    if (cursor.parent_id == null) break;
    cursor = byId.get(cursor.parent_id);
  }
  // Fallback — pharmaceutical is the safer default for unclassified.
  return "pharmaceutical";
  void bySlug; // reserved for future slug-lookup logic
}

/**
 * All categories (top-level + children) with approved-product counts,
 * plus a computed `domain` (pharmaceutical | beauty). Zero-product
 * categories are filtered out so the widget doesn't show dead rows.
 *
 * Used by the homepage left-side category widget — filtered client-side
 * by the radio toggle between Pharmaceutical and Beauty.
 */
export async function listWidgetCategories(): Promise<CategoryWidgetEntry[]> {
  const supabase = await createClient();

  // 1) all categories with hierarchy info
  const { data: rows, error: catErr } = await supabase
    .from("categories")
    .select("id, slug, name, parent_id, sort_order")
    .order("sort_order");

  if (catErr || !rows || rows.length === 0) {
    if (catErr) console.error("[categories] list failed:", catErr.message);
    return [];
  }

  const all = rows as CategoryRow[];
  const bySlug = new Map<string, CategoryRow>();
  const byId = new Map<number, CategoryRow>();
  for (const r of all) {
    bySlug.set(r.slug, r);
    byId.set(r.id, r);
  }

  // 2) approved product counts (one query, grouped in JS)
  const { data: medRows } = await supabase
    .from("medications")
    .select("category_id")
    .not("category_id", "is", null)
    .eq("approval_status", "approved");

  const countByCategoryId = new Map<number, number>();
  for (const row of medRows ?? []) {
    const cid = row.category_id as number;
    countByCategoryId.set(cid, (countByCategoryId.get(cid) ?? 0) + 1);
  }

  // 3) assemble — skip categories with 0 approved products
  const entries: CategoryWidgetEntry[] = [];
  for (const r of all) {
    const count = countByCategoryId.get(r.id) ?? 0;
    if (count === 0) continue;
    entries.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      domain: resolveDomain(r, bySlug, byId),
      productCount: count,
    });
  }

  return entries;
}

/**
 * @deprecated Use listWidgetCategories() which covers both domains.
 * Kept for backward compatibility with any direct callers.
 */
export async function listSupplementChildCategories(): Promise<
  CategoryWidgetEntry[]
> {
  const all = await listWidgetCategories();
  // Match prior behavior: only children of vitamins-supplements.
  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "vitamins-supplements")
    .maybeSingle();
  if (!parent) return [];

  const { data: childRows } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", parent.id);
  const childIds = new Set((childRows ?? []).map((r) => r.id as number));
  return all.filter((c) => childIds.has(c.id));
}
