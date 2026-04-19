/**
 * One-shot backfill for every cached YMYL article — safety, ingredient
 * guides, and product comparisons — adding real PubMed + FDA citations
 * to rows generated before the references feature shipped.
 *
 * Article body is preserved; only the `references` field is replaced.
 * Idempotent — re-running simply refreshes with the latest sources.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-references.ts
 *     → backfills all three tables
 *
 *   pnpm exec tsx scripts/backfill-references.ts safety
 *   pnpm exec tsx scripts/backfill-references.ts ingredients
 *   pnpm exec tsx scripts/backfill-references.ts comparisons
 *     → backfill a single table only
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  fetchSafetyReferences,
  type GenerateSafetyInput,
  type SafetyArticle,
} from "@/lib/ai/generate-safety-article";
import {
  fetchIngredientReferences,
  type IngredientGuide,
} from "@/lib/ai/generate-ingredient-guide";
import {
  fetchComparisonReferences,
  type ComparisonArticle,
  type ComparisonProductInput,
} from "@/lib/ai/generate-comparison";

const envText = readFileSync(".env.local", "utf8");
function pickEnv(key: string): string {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${key} in .env.local`);
  return m[1].trim();
}

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PUBMED_API_KEY",
  "OPENFDA_API_KEY",
]) {
  try {
    process.env[key] = pickEnv(key);
  } catch {
    // optional keys
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Safety articles ───────────────────────────────────────────

type SafetyRow = {
  id: number;
  slug: string;
  name: string;
  product_type: string | null;
  generic_name: string | null;
  active_ingredients: string[] | null;
  warnings: string | null;
  side_effects: string | null;
  verdict: string | null;
  safety_article_jsonb: SafetyArticle;
};

async function backfillSafety() {
  const { data, error } = await supabase
    .from("medications")
    .select(
      "id, slug, name, product_type, generic_name, active_ingredients, warnings, side_effects, verdict, safety_article_jsonb"
    )
    .eq("approval_status", "approved")
    .not("safety_article_jsonb", "is", null)
    .order("id", { ascending: true });

  if (error) throw new Error(`safety load: ${error.message}`);
  const rows = (data ?? []) as SafetyRow[];

  console.log(`\n== Safety articles (${rows.length}) ==`);
  let fail = 0;
  let totals = { pubmed: 0, fda: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] ${row.slug}`;
    const input: GenerateSafetyInput = {
      productName: row.name,
      productType: row.product_type ?? "otc_drug",
      genericName: row.generic_name,
      activeIngredients: Array.isArray(row.active_ingredients)
        ? row.active_ingredients
        : undefined,
      fdaWarnings: row.warnings,
      fdaSideEffects: row.side_effects,
      verdict: row.verdict,
    };
    try {
      const references = await fetchSafetyReferences(input);
      totals.pubmed += references.filter((r) => r.kind === "pubmed").length;
      totals.fda += references.filter((r) => r.kind === "fda").length;
      const merged: SafetyArticle = { ...row.safety_article_jsonb, references };
      const { error: upErr } = await supabase
        .from("medications")
        .update({ safety_article_jsonb: merged })
        .eq("id", row.id);
      if (upErr) {
        fail++;
        console.log(`${label} — write failed: ${upErr.message}`);
      } else {
        console.log(
          `${label} — pubmed: ${references.filter((r) => r.kind === "pubmed").length}, fda: ${references.filter((r) => r.kind === "fda").length} ✓`
        );
      }
    } catch (err) {
      fail++;
      console.log(`${label} — ⚠ ${err instanceof Error ? err.message : err}`);
    }
    if (i < rows.length - 1) await sleep(1200);
  }

  console.log(
    `Safety done. ${rows.length - fail}/${rows.length} ok. refs: pubmed=${totals.pubmed}, fda=${totals.fda}.`
  );
  return fail;
}

// ── Ingredient guides ─────────────────────────────────────────

type IngredientRow = {
  id: number;
  slug: string;
  name: string;
  article_jsonb: IngredientGuide;
};

async function backfillIngredients() {
  const { data, error } = await supabase
    .from("ingredient_guides")
    .select("id, slug, name, article_jsonb")
    .order("id", { ascending: true });

  if (error) throw new Error(`ingredients load: ${error.message}`);
  const rows = (data ?? []) as IngredientRow[];

  console.log(`\n== Ingredient guides (${rows.length}) ==`);
  let fail = 0;
  let totals = { pubmed: 0, fda: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] ${row.slug}`;
    try {
      const references = await fetchIngredientReferences({ name: row.name });
      totals.pubmed += references.filter((r) => r.kind === "pubmed").length;
      totals.fda += references.filter((r) => r.kind === "fda").length;
      const merged: IngredientGuide = { ...row.article_jsonb, references };
      const { error: upErr } = await supabase
        .from("ingredient_guides")
        .update({ article_jsonb: merged })
        .eq("id", row.id);
      if (upErr) {
        fail++;
        console.log(`${label} — write failed: ${upErr.message}`);
      } else {
        console.log(
          `${label} — pubmed: ${references.filter((r) => r.kind === "pubmed").length}, fda: ${references.filter((r) => r.kind === "fda").length} ✓`
        );
      }
    } catch (err) {
      fail++;
      console.log(`${label} — ⚠ ${err instanceof Error ? err.message : err}`);
    }
    if (i < rows.length - 1) await sleep(1200);
  }

  console.log(
    `Ingredients done. ${rows.length - fail}/${rows.length} ok. refs: pubmed=${totals.pubmed}, fda=${totals.fda}.`
  );
  return fail;
}

// ── Comparisons ───────────────────────────────────────────────

type ComparisonRow = {
  id: number;
  slug_a: string;
  slug_b: string;
  article_jsonb: ComparisonArticle;
};

async function backfillComparisons() {
  const { data, error } = await supabase
    .from("product_comparisons")
    .select("id, slug_a, slug_b, article_jsonb")
    .order("id", { ascending: true });

  if (error) throw new Error(`comparisons load: ${error.message}`);
  const rows = (data ?? []) as ComparisonRow[];

  if (rows.length === 0) {
    console.log("\n== Comparisons (0) ==\nNothing to backfill.");
    return 0;
  }

  // Load product metadata in one shot for reference fetching.
  const slugs = Array.from(new Set(rows.flatMap((r) => [r.slug_a, r.slug_b])));
  const { data: prodData, error: prodErr } = await supabase
    .from("medications")
    .select("slug, name, product_type, generic_name, active_ingredients")
    .in("slug", slugs);
  if (prodErr) throw new Error(`comparison product load: ${prodErr.message}`);

  const bySlug = new Map<string, ComparisonProductInput>();
  for (const p of prodData ?? []) {
    bySlug.set(p.slug as string, {
      name: p.name as string,
      slug: p.slug as string,
      productType: (p.product_type as string) ?? "otc_drug",
      genericName: (p.generic_name as string | null) ?? null,
      activeIngredients: Array.isArray(p.active_ingredients)
        ? (p.active_ingredients as string[])
        : undefined,
    });
  }

  console.log(`\n== Comparisons (${rows.length}) ==`);
  let fail = 0;
  let totals = { pubmed: 0, fda: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] ${row.slug_a}-vs-${row.slug_b}`;
    const pa = bySlug.get(row.slug_a);
    const pb = bySlug.get(row.slug_b);
    if (!pa || !pb) {
      fail++;
      console.log(`${label} — ⚠ product metadata missing, skipping`);
      continue;
    }
    try {
      const references = await fetchComparisonReferences({
        productA: pa,
        productB: pb,
      });
      totals.pubmed += references.filter((r) => r.kind === "pubmed").length;
      totals.fda += references.filter((r) => r.kind === "fda").length;
      const merged: ComparisonArticle = { ...row.article_jsonb, references };
      const { error: upErr } = await supabase
        .from("product_comparisons")
        .update({ article_jsonb: merged })
        .eq("id", row.id);
      if (upErr) {
        fail++;
        console.log(`${label} — write failed: ${upErr.message}`);
      } else {
        console.log(
          `${label} — pubmed: ${references.filter((r) => r.kind === "pubmed").length}, fda: ${references.filter((r) => r.kind === "fda").length} ✓`
        );
      }
    } catch (err) {
      fail++;
      console.log(`${label} — ⚠ ${err instanceof Error ? err.message : err}`);
    }
    if (i < rows.length - 1) await sleep(1200);
  }

  console.log(
    `Comparisons done. ${rows.length - fail}/${rows.length} ok. refs: pubmed=${totals.pubmed}, fda=${totals.fda}.`
  );
  return fail;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2];
  const targets =
    arg && ["safety", "ingredients", "comparisons"].includes(arg)
      ? [arg]
      : ["safety", "ingredients", "comparisons"];

  let totalFail = 0;
  for (const t of targets) {
    if (t === "safety") totalFail += await backfillSafety();
    else if (t === "ingredients") totalFail += await backfillIngredients();
    else if (t === "comparisons") totalFail += await backfillComparisons();
  }

  if (totalFail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
