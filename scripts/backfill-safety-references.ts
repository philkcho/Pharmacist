/**
 * One-shot backfill: patch existing safety_article_jsonb rows with
 * freshly fetched PubMed + FDA references.
 *
 * Preserves the article body (hookAnswer, whoShouldAvoid, faq, etc.);
 * only replaces the `references` field. Idempotent — re-running just
 * refreshes citations with the latest PubMed/FDA data.
 *
 * Usage:
 *   npx tsx scripts/backfill-safety-references.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * `.env.local`. Pauses 1.2 s between rows to respect PubMed eutils
 * and openFDA free-tier rate limits.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  fetchSafetyReferences,
  type SafetyArticle,
  type GenerateSafetyInput,
} from "@/lib/ai/generate-safety-article";

const envText = readFileSync(".env.local", "utf8");
function pickEnv(key: string): string {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${key} in .env.local`);
  return m[1].trim();
}

// Some downstream libraries (openFDA client, etc.) read env via
// `process.env.X`, so copy the values we parsed there too.
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PUBMED_API_KEY",
  "OPENFDA_API_KEY",
]) {
  try {
    process.env[key] = pickEnv(key);
  } catch {
    // Optional keys (PUBMED_API_KEY, OPENFDA_API_KEY) — silently skip.
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Row = {
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { data, error } = await supabase
    .from("medications")
    .select(
      "id, slug, name, product_type, generic_name, active_ingredients, warnings, side_effects, verdict, safety_article_jsonb"
    )
    .eq("approval_status", "approved")
    .not("safety_article_jsonb", "is", null)
    .order("id", { ascending: true });

  if (error) {
    console.error("Failed to load rows:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  console.log(`Backfilling references for ${rows.length} safety article(s).\n`);

  let pubmedHits = 0;
  let fdaHits = 0;
  let failures = 0;

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
      const pubmed = references.filter((r) => r.kind === "pubmed").length;
      const fda = references.filter((r) => r.kind === "fda").length;
      pubmedHits += pubmed;
      fdaHits += fda;

      const merged: SafetyArticle = {
        ...row.safety_article_jsonb,
        references,
      };

      const { error: upErr } = await supabase
        .from("medications")
        .update({ safety_article_jsonb: merged })
        .eq("id", row.id);

      if (upErr) {
        console.log(`${label} — write failed: ${upErr.message}`);
        failures++;
      } else {
        console.log(`${label} — pubmed: ${pubmed}, fda: ${fda} ✓`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${label} — ⚠ ${msg}`);
      failures++;
    }

    // Rate-limit to be polite to PubMed eutils + openFDA.
    if (i < rows.length - 1) await sleep(1200);
  }

  console.log(
    `\nDone. ${rows.length - failures}/${rows.length} succeeded. ` +
      `Total refs: pubmed=${pubmedHits}, fda=${fdaHits}.`
  );
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
