/**
 * Backfill `references` for existing ingredient_guides + product_comparisons
 * rows cached before the references feature landed. Idempotent: re-running
 * overwrites with fresh PubMed/FDA data without touching body content.
 *
 * Also tops up safety_article_jsonb rows that still have no references
 * (should be at most 1-2 edge cases given the earlier safety backfill).
 *
 * Run via: pnpm exec tsx scripts/backfill-article-references.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fetchIngredientReferences } from "@/lib/ai/generate-ingredient-guide";
import { fetchComparisonReferences } from "@/lib/ai/generate-comparison";
import { fetchSafetyReferences } from "@/lib/ai/generate-safety-article";

const envText = readFileSync(".env.local", "utf8");
function envPick(k: string): string {
  const m = envText.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1].trim();
}

const supabase = createClient(
  envPick("NEXT_PUBLIC_SUPABASE_URL"),
  envPick("SUPABASE_SERVICE_ROLE_KEY"),
);

// openFDA + PubMed eutils are generous but throttled — stagger to
// ~1 req/sec per API to avoid sporadic 429s over a 50-row backfill.
const SLEEP_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backfillIngredients() {
  const { data, error } = await supabase
    .from("ingredient_guides")
    .select("id, slug, name, article_jsonb");
  if (error) throw error;

  console.log(`\n[ingredients] ${data.length} rows`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const [i, row] of data.entries()) {
    const article = row.article_jsonb as { references?: unknown[] };
    if (Array.isArray(article?.references) && article.references.length > 0) {
      console.log(`  [${i + 1}/${data.length}] skip   ${row.slug} (already has refs)`);
      skip++;
      continue;
    }
    try {
      const refs = await fetchIngredientReferences({ name: row.name });
      await supabase
        .from("ingredient_guides")
        .update({ article_jsonb: { ...article, references: refs } })
        .eq("id", row.id);
      console.log(
        `  [${i + 1}/${data.length}] ok     ${row.slug} — pubmed: ${refs.filter((r) => r.kind === "pubmed").length}, fda: ${refs.filter((r) => r.kind === "fda").length}`
      );
      ok++;
    } catch (e) {
      console.error(
        `  [${i + 1}/${data.length}] FAIL   ${row.slug}:`,
        e instanceof Error ? e.message : e
      );
      fail++;
    }
    await sleep(SLEEP_MS);
  }
  console.log(`[ingredients] done. ok=${ok}  skip=${skip}  fail=${fail}`);
}

async function backfillComparisons() {
  const { data, error } = await supabase
    .from("product_comparisons")
    .select("id, slug_a, slug_b, article_jsonb");
  if (error) throw error;

  console.log(`\n[comparisons] ${data.length} rows`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const [i, row] of data.entries()) {
    const article = row.article_jsonb as { references?: unknown[] };
    if (Array.isArray(article?.references) && article.references.length > 0) {
      console.log(
        `  [${i + 1}/${data.length}] skip   ${row.slug_a}-vs-${row.slug_b} (already has refs)`
      );
      skip++;
      continue;
    }
    // Load both products for generic/active-ingredient hints
    const { data: prods } = await supabase
      .from("medications")
      .select("slug, name, product_type, generic_name, brand_names")
      .in("slug", [row.slug_a, row.slug_b]);
    const byslug = new Map((prods ?? []).map((p) => [p.slug as string, p]));
    const pa = byslug.get(row.slug_a);
    const pb = byslug.get(row.slug_b);
    if (!pa || !pb) {
      console.warn(
        `  [${i + 1}/${data.length}] MISS   ${row.slug_a}-vs-${row.slug_b} (product not found)`
      );
      fail++;
      continue;
    }

    try {
      const refs = await fetchComparisonReferences({
        productA: {
          name: pa.name as string,
          slug: pa.slug as string,
          productType: (pa.product_type as string) ?? "otc_drug",
          genericName: (pa.generic_name as string | null) ?? undefined,
        },
        productB: {
          name: pb.name as string,
          slug: pb.slug as string,
          productType: (pb.product_type as string) ?? "otc_drug",
          genericName: (pb.generic_name as string | null) ?? undefined,
        },
      });
      await supabase
        .from("product_comparisons")
        .update({ article_jsonb: { ...article, references: refs } })
        .eq("id", row.id);
      console.log(
        `  [${i + 1}/${data.length}] ok     ${row.slug_a}-vs-${row.slug_b} — pubmed: ${refs.filter((r) => r.kind === "pubmed").length}, fda: ${refs.filter((r) => r.kind === "fda").length}`
      );
      ok++;
    } catch (e) {
      console.error(
        `  [${i + 1}/${data.length}] FAIL   ${row.slug_a}-vs-${row.slug_b}:`,
        e instanceof Error ? e.message : e
      );
      fail++;
    }
    await sleep(SLEEP_MS);
  }
  console.log(`[comparisons] done. ok=${ok}  skip=${skip}  fail=${fail}`);
}

async function backfillSafetyGaps() {
  // Top up rows that still have no references (e.g. non-drug products
  // that zero-matched both FDA and PubMed on the first pass).
  const { data, error } = await supabase
    .from("medications")
    .select("id, slug, name, generic_name, product_type, safety_article_jsonb")
    .not("safety_article_jsonb", "is", null);
  if (error) throw error;

  const missing = (data ?? []).filter((r) => {
    const refs = (r.safety_article_jsonb as { references?: unknown[] } | null)
      ?.references;
    return !Array.isArray(refs) || refs.length === 0;
  });

  console.log(`\n[safety] ${missing.length} rows missing references`);

  for (const [i, row] of missing.entries()) {
    try {
      const refs = await fetchSafetyReferences({
        productName: row.name as string,
        genericName: (row.generic_name as string | null) ?? undefined,
        productType: (row.product_type as string) ?? "otc_drug",
      });
      const article = row.safety_article_jsonb as Record<string, unknown>;
      await supabase
        .from("medications")
        .update({ safety_article_jsonb: { ...article, references: refs } })
        .eq("id", row.id);
      console.log(
        `  [${i + 1}/${missing.length}] ok     ${row.slug} — pubmed: ${refs.filter((r) => r.kind === "pubmed").length}, fda: ${refs.filter((r) => r.kind === "fda").length}`
      );
    } catch (e) {
      console.error(
        `  [${i + 1}/${missing.length}] FAIL   ${row.slug}:`,
        e instanceof Error ? e.message : e
      );
    }
    await sleep(SLEEP_MS);
  }
  console.log(`[safety] done.`);
}

// Sequential — avoid saturating openFDA / eutils with 3 concurrent pools.
async function main() {
  await backfillIngredients();
  await backfillComparisons();
  await backfillSafetyGaps();
  console.log("\nAll backfills complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
