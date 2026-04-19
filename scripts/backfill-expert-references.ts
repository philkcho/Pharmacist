/**
 * Backfill references_jsonb for existing expert_picks rows.
 *
 * For each pick we use:
 *   - mentionedProducts[].name  →  FDA drug-term lookup
 *   - analysis title/summary    →  PubMed primary term (via
 *                                   extractLikelyIngredient to bias
 *                                   toward a known ingredient)
 *
 * Idempotent: skips rows that already have a non-empty references_jsonb.
 * Pass `--force` to overwrite.
 *
 * Run: pnpm exec tsx scripts/backfill-expert-references.ts [--force]
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data, error } = await supabase
    .from("expert_picks")
    .select(
      "id, slug, title, summary, category, mentioned_products, references_jsonb",
    );
  if (error) throw error;

  const total = data.length;
  console.log(`[expert_picks] ${total} rows`);

  for (const [i, row] of data.entries()) {
    const existing = row.references_jsonb as unknown;
    if (
      !force &&
      Array.isArray(existing) &&
      existing.length > 0
    ) {
      console.log(`  [${i + 1}/${total}] skip   ${row.slug}`);
      continue;
    }

    const products = (row.mentioned_products as
      | { name: string }[]
      | null) ?? [];
    const drugTerms = Array.from(
      new Set(products.map((p) => p.name).filter(Boolean)),
    );
    const title = (row.title as string) ?? "";
    const summary = (row.summary as string) ?? "";
    const category = (row.category as string) ?? "";
    const primaryTerm =
      extractLikelyIngredient(title) ??
      extractLikelyIngredient(summary) ??
      title;
    const fallbackTerms = [title, category].filter(
      (t): t is string => typeof t === "string" && t.length > 0,
    );

    try {
      const refs = await fetchArticleReferences({
        primaryTerm,
        fallbackTerms,
        drugTerms,
        limit: 6,
      });
      await supabase
        .from("expert_picks")
        .update({ references_jsonb: refs })
        .eq("id", row.id);
      const pm = refs.filter((r) => r.kind === "pubmed").length;
      const fd = refs.filter((r) => r.kind === "fda").length;
      console.log(
        `  [${i + 1}/${total}] ok     ${row.slug} — pubmed: ${pm}, fda: ${fd}`,
      );
    } catch (e) {
      console.error(
        `  [${i + 1}/${total}] FAIL   ${row.slug}:`,
        e instanceof Error ? e.message : e,
      );
    }
    await sleep(1200);
  }

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
