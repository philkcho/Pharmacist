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

export interface CategoryWidgetEntry {
  id: number;
  slug: string;
  name: string;
  productCount: number;
}

/**
 * Child categories under the "vitamins-supplements" parent, each with
 * approved-product count. Empty categories are filtered out (productCount === 0).
 * Ordered by sort_order.
 *
 * Used by the homepage left-side category widget.
 */
export async function listSupplementChildCategories(): Promise<
  CategoryWidgetEntry[]
> {
  const supabase = await createClient();

  // 1) resolve parent id
  const { data: parent, error: parentErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "vitamins-supplements")
    .maybeSingle();

  if (parentErr || !parent) {
    console.error(
      "[categories] supplement parent lookup failed:",
      parentErr?.message ?? "not found"
    );
    return [];
  }

  // 2) children
  const { data: children, error: childErr } = await supabase
    .from("categories")
    .select("id, slug, name")
    .eq("parent_id", parent.id)
    .order("sort_order");

  if (childErr || !children || children.length === 0) {
    return [];
  }

  // 3) approved product counts per child — single query with filter
  const childIds = children.map((c) => c.id as number);
  const { data: countRows } = await supabase
    .from("medications")
    .select("category_id", { count: "exact", head: false })
    .in("category_id", childIds)
    .eq("approval_status", "approved");

  const countByCategoryId = new Map<number, number>();
  for (const row of countRows ?? []) {
    const cid = row.category_id as number;
    countByCategoryId.set(cid, (countByCategoryId.get(cid) ?? 0) + 1);
  }

  const entries: CategoryWidgetEntry[] = children
    .map((c) => ({
      id: c.id as number,
      slug: c.slug as string,
      name: c.name as string,
      productCount: countByCategoryId.get(c.id as number) ?? 0,
    }))
    .filter((c) => c.productCount > 0);

  return entries;
}
