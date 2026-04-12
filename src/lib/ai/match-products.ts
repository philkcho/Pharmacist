/**
 * Product matching — wires entities from Layer 1 understanding to
 * existing `medications` rows in the DB.
 *
 * Matching strategy (pharma + beauty):
 *
 *   1. Drug name → medications.name / brandNames (ilike)
 *   2. Generic ingredient → medications.genericName (ilike)
 *   3. Symptom / condition → categories mapping → featured meds in
 *      that category, ordered by comparison_score DESC
 *
 * Results are deduped, prefer pharmacist-reviewed rows, and capped
 * at `limit` (default 3, per user requirement).
 *
 * This module uses the admin Supabase client because it's called
 * within `analyzeTrend()` which runs under the service role (cron
 * or admin trigger). Callers must not expose this to public routes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { TopicUnderstanding, ProductMatch } from "./types";
import type { TrendCategory } from "@/lib/trends/category-mapping";

const DEFAULT_LIMIT = 3;

interface MedicationRow {
  id: number;
  name: string;
  slug: string;
  generic_name: string | null;
  brand_names: string[] | null;
  ingredient_analysis: unknown;
  reviewed_at: string | null;
  comparison_score: number | null;
  category_id: number | null;
}

/** Extract ingredient names from the ingredientAnalysis JSONB. */
function extractIngredientNames(analysis: unknown): string[] {
  if (!Array.isArray(analysis)) return [];
  return analysis
    .map((item: unknown) => {
      if (typeof item === "object" && item !== null && "name" in item) {
        return String((item as { name: unknown }).name);
      }
      return null;
    })
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .slice(0, 3);
}

function toProductMatch(
  row: MedicationRow,
  reason: string
): ProductMatch {
  return {
    medicationId: row.id,
    name: row.name,
    slug: row.slug,
    reason,
    ingredientHighlights: extractIngredientNames(row.ingredient_analysis),
  };
}

/**
 * Match medications from the DB using the entities extracted by
 * Layer 1 classification. Returns up to `limit` matches (exactly 3
 * per user spec) sorted by relevance: pharmacist-reviewed first,
 * then by comparison_score descending.
 */
export async function matchProducts(
  understanding: TopicUnderstanding,
  _category: TrendCategory,
  limit: number = DEFAULT_LIMIT
): Promise<ProductMatch[]> {
  const admin = createAdminClient();
  const matchedIds = new Set<number>();
  const matches: ProductMatch[] = [];

  const SELECT_COLS =
    "id, name, slug, generic_name, brand_names, ingredient_analysis, reviewed_at, comparison_score, category_id";

  // Strategy 1: Match by drug/brand name
  for (const drug of understanding.entities.drugs) {
    if (matches.length >= limit) break;
    const trimmed = drug.trim();
    if (!trimmed) continue;

    const { data } = await admin
      .from("medications")
      .select(SELECT_COLS)
      .eq("approval_status", "approved")
      .or(
        `name.ilike.%${trimmed}%,brand_names.cs.{"${trimmed}"}`
      )
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("comparison_score", { ascending: false, nullsFirst: true })
      .limit(limit);

    for (const row of (data as MedicationRow[] | null) ?? []) {
      if (matchedIds.has(row.id) || matches.length >= limit) continue;
      matchedIds.add(row.id);
      matches.push(
        toProductMatch(row, `Matches drug name "${trimmed}"`)
      );
    }
  }

  // Strategy 2: Match by generic ingredient
  for (const ingredient of understanding.entities.genericIngredients) {
    if (matches.length >= limit) break;
    const trimmed = ingredient.trim();
    if (!trimmed) continue;

    const { data } = await admin
      .from("medications")
      .select(SELECT_COLS)
      .eq("approval_status", "approved")
      .ilike("generic_name", `%${trimmed}%`)
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("comparison_score", { ascending: false, nullsFirst: true })
      .limit(limit);

    for (const row of (data as MedicationRow[] | null) ?? []) {
      if (matchedIds.has(row.id) || matches.length >= limit) continue;
      matchedIds.add(row.id);
      matches.push(
        toProductMatch(row, `Contains ingredient "${trimmed}"`)
      );
    }
  }

  // Strategy 3: Category-level featured products (symptom/condition mapping)
  // This catches queries like "headache remedy" that don't name a drug
  // but map to a category full of relevant products.
  if (matches.length < limit && understanding.entities.categorySlugs.length > 0) {
    const { data: categoryRows } = await admin
      .from("categories")
      .select("id")
      .in("slug", understanding.entities.categorySlugs)
      .limit(5);

    const categoryIds = (categoryRows ?? []).map(
      (r: { id: number }) => r.id
    );

    if (categoryIds.length > 0) {
      const remaining = limit - matches.length;
      const { data } = await admin
        .from("medications")
        .select(SELECT_COLS)
        .eq("approval_status", "approved")
        .in("category_id", categoryIds)
        .eq("is_featured", true)
        .order("comparison_score", { ascending: false, nullsFirst: true })
        .limit(remaining + matchedIds.size); // fetch extra to handle dedup

      for (const row of (data as MedicationRow[] | null) ?? []) {
        if (matchedIds.has(row.id) || matches.length >= limit) continue;
        matchedIds.add(row.id);
        matches.push(
          toProductMatch(row, "Featured product in related category")
        );
      }
    }
  }

  return matches;
}
