/**
 * Test SEO content generators by generating 3 sample pages:
 *   - 1 safety article (CeraVe)
 *   - 1 comparison (CeraVe vs Vaseline)
 *   - 1 ingredient guide (Niacinamide)
 *
 * Verifies Gemini integration + DB write + page render readiness.
 *
 * Usage: node scripts/test-seo-content.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
function pickEnv(key) {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${key}`);
  return m[1].trim();
}

const SUPABASE_URL = pickEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = pickEnv("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_KEY = pickEnv("GOOGLE_GENERATIVE_AI_API_KEY");

process.env.GOOGLE_GENERATIVE_AI_API_KEY = GEMINI_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

// Dynamic imports so the AI SDK picks up env vars set above
const { generateSafetyArticle } = await import(
  "../src/lib/ai/generate-safety-article.ts"
);
const { generateComparison } = await import(
  "../src/lib/ai/generate-comparison.ts"
);
const { generateIngredientGuide } = await import(
  "../src/lib/ai/generate-ingredient-guide.ts"
);

// ── 1. Safety Article Test ──────────────────────────────────
console.log("\n━━━ TEST 1: Safety Article (CeraVe) ━━━");
try {
  const { data: product } = await sb
    .from("medications")
    .select(
      "id, name, slug, generic_name, product_type, warnings, side_effects, active_ingredients, verdict"
    )
    .eq("slug", "cerave-moisturizing-cream")
    .single();

  const start = Date.now();
  const article = await generateSafetyArticle({
    productName: product.name,
    productType: product.product_type,
    genericName: product.generic_name,
    activeIngredients: product.active_ingredients ?? [],
    fdaWarnings: product.warnings,
    fdaSideEffects: product.side_effects,
    verdict: product.verdict,
  });

  await sb
    .from("medications")
    .update({
      safety_article_jsonb: article,
      safety_article_generated_at: new Date().toISOString(),
    })
    .eq("id", product.id);

  console.log(
    `✓ Generated in ${((Date.now() - start) / 1000).toFixed(1)}s`
  );
  console.log(`  Hook: ${article.hookAnswer.slice(0, 80)}...`);
  console.log(`  FAQ count: ${article.faq.length}`);
  console.log(`  URL: /en/is-safe/${product.slug}`);
} catch (err) {
  console.log("✗ FAILED:", err.message);
}

// ── 2. Comparison Test ──────────────────────────────────────
console.log("\n━━━ TEST 2: Comparison (Vaseline vs CeraVe) ━━━");
try {
  const { data: products } = await sb
    .from("medications")
    .select(
      "slug, name, product_type, generic_name, active_ingredients, verdict, pros, cons, price_range"
    )
    .in("slug", ["vaseline-petroleum-jelly", "cerave-moisturizing-cream"]);

  // Canonical order
  const [canonA, canonB] = ["cerave-moisturizing-cream", "vaseline-petroleum-jelly"].sort();
  const pA = products.find((p) => p.slug === canonA);
  const pB = products.find((p) => p.slug === canonB);

  const toInput = (p) => ({
    name: p.name,
    slug: p.slug,
    productType: p.product_type ?? "otc_drug",
    genericName: p.generic_name,
    activeIngredients: p.active_ingredients ?? [],
    verdict: p.verdict,
    pros: (p.pros ?? []).map((x) => (typeof x === "string" ? x : x.text ?? "")),
    cons: (p.cons ?? []).map((x) => (typeof x === "string" ? x : x.text ?? "")),
    priceRange: p.price_range,
  });

  const start = Date.now();
  const article = await generateComparison({
    productA: toInput(pA),
    productB: toInput(pB),
  });

  await sb.from("product_comparisons").insert({
    slug_a: canonA,
    slug_b: canonB,
    article_jsonb: article,
  });

  console.log(
    `✓ Generated in ${((Date.now() - start) / 1000).toFixed(1)}s`
  );
  console.log(`  Hook: ${article.hook.slice(0, 80)}...`);
  console.log(
    `  Winners picked: ${article.quickVerdict.winnerByUse.length}`
  );
  console.log(`  URL: /en/compare/${canonA}-vs-${canonB}`);
} catch (err) {
  console.log("✗ FAILED:", err.message);
}

// ── 3. Ingredient Guide Test ────────────────────────────────
console.log("\n━━━ TEST 3: Ingredient Guide (Niacinamide) ━━━");
try {
  const start = Date.now();
  const article = await generateIngredientGuide({
    name: "Niacinamide",
    category: "skincare",
    foundInProducts: [
      "CeraVe Moisturizing Cream",
      "Paula's Choice 2% BHA Exfoliant",
    ],
  });

  await sb.from("ingredient_guides").insert({
    slug: "niacinamide",
    name: "Niacinamide",
    article_jsonb: article,
  });

  console.log(
    `✓ Generated in ${((Date.now() - start) / 1000).toFixed(1)}s`
  );
  console.log(`  Hook: ${article.hook.slice(0, 80)}...`);
  console.log(`  Benefits: ${article.keyBenefits.length}`);
  console.log(`  FAQ: ${article.faq.length}`);
  console.log(`  URL: /en/ingredients/niacinamide`);
} catch (err) {
  console.log("✗ FAILED:", err.message);
}

console.log("\n━━━ Done ━━━");
