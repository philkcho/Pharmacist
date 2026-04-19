/**
 * Backfill references_jsonb for all approved medications with a verdict
 * (i.e. rows that /analysis/[slug] will actually render). Fetches FDA
 * DailyMed + PubMed review citations via the shared fetchArticleReferences
 * util and persists to the new column.
 *
 * Idempotent: skips rows that already have a non-empty references_jsonb,
 * so re-running only fills gaps. Pass `--force` to overwrite.
 *
 * Run: pnpm exec tsx scripts/backfill-medication-references.ts [--force]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  fetchArticleReferences,
  extractLikelyIngredient,
} from "@/lib/references/fetch-references";

const envText = readFileSync(".env.local", "utf8");
const pick = (k: string): string => {
  const m = envText.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1].trim();
};

const supabase = createClient(
  pick("NEXT_PUBLIC_SUPABASE_URL"),
  pick("SUPABASE_SERVICE_ROLE_KEY"),
);

const force = process.argv.includes("--force");
const SLEEP_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data, error } = await supabase
    .from("medications")
    .select(
      "id, slug, name, generic_name, brand_names, product_type, references_jsonb",
    )
    .eq("approval_status", "approved")
    .not("verdict", "is", null)
    .order("id");
  if (error) throw error;

  const total = data.length;
  console.log(`[medications] ${total} approved products with verdict`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const [i, row] of data.entries()) {
    const existing = row.references_jsonb as unknown;
    if (
      !force &&
      Array.isArray(existing) &&
      existing.length > 0
    ) {
      console.log(`  [${i + 1}/${total}] skip   ${row.slug}`);
      skip++;
      continue;
    }

    const drugTerms = [
      row.generic_name as string | null,
      ...((row.brand_names as string[] | null) ?? []),
      row.name as string,
    ].filter((t): t is string => typeof t === "string" && t.length > 0);

    // PubMed primary: generic if known, else guessed ingredient from name,
    // else the raw product name (last resort, review filter may zero-match).
    const primaryTerm =
      (row.generic_name as string | null) ??
      extractLikelyIngredient(row.name as string) ??
      (row.name as string);

    const fallbackTerms = Array.from(
      new Set([
        ...drugTerms.filter((t) => t !== primaryTerm),
        row.name as string,
      ]),
    );

    try {
      const refs = await fetchArticleReferences({
        primaryTerm,
        fallbackTerms,
        drugTerms,
        limit: 6,
      });
      await supabase
        .from("medications")
        .update({ references_jsonb: refs })
        .eq("id", row.id);
      const pm = refs.filter((r) => r.kind === "pubmed").length;
      const fd = refs.filter((r) => r.kind === "fda").length;
      console.log(
        `  [${i + 1}/${total}] ok     ${row.slug} — pubmed: ${pm}, fda: ${fd}`,
      );
      ok++;
    } catch (e) {
      console.error(
        `  [${i + 1}/${total}] FAIL   ${row.slug}:`,
        e instanceof Error ? e.message : e,
      );
      fail++;
    }
    await sleep(SLEEP_MS);
  }

  console.log(`\nDone. ok=${ok}  skip=${skip}  fail=${fail}  total=${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
