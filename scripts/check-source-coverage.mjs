// Audit which content types have authoritative source citations wired up.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const pick = (k) => envText.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim();
const supabase = createClient(
  pick("NEXT_PUBLIC_SUPABASE_URL"),
  pick("SUPABASE_SERVICE_ROLE_KEY"),
);

async function count(query) {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// Trending — sources_jsonb is an array of {kind, ...} fragments
const { data: trends } = await supabase
  .from("trend_analyses")
  .select("sources_jsonb, trend_topics!inner(status)")
  .eq("trend_topics.status", "published");

// Trending sources use `tier` (1/2/3) + url-based classification
const trendsWithFda = (trends ?? []).filter((t) =>
  Array.isArray(t.sources_jsonb) &&
  t.sources_jsonb.some((s) => typeof s.url === "string" && /fda\.gov|dailymed/i.test(s.url))
).length;
const trendsWithPubmed = (trends ?? []).filter((t) =>
  Array.isArray(t.sources_jsonb) &&
  t.sources_jsonb.some((s) => typeof s.url === "string" && /pubmed|ncbi/i.test(s.url))
).length;
const trendsWithAny = (trends ?? []).filter((t) =>
  Array.isArray(t.sources_jsonb) && t.sources_jsonb.length > 0
).length;

// Safety articles — medications.safety_article_jsonb with references
const { data: safety } = await supabase
  .from("medications")
  .select("name, safety_article_jsonb")
  .not("safety_article_jsonb", "is", null);

let safetyWithRefs = 0;
let safetyWithFdaRef = 0;
let safetyWithPubmedRef = 0;
for (const row of safety ?? []) {
  const refs = row.safety_article_jsonb?.references;
  if (Array.isArray(refs) && refs.length > 0) {
    safetyWithRefs++;
    if (refs.some((r) => r.kind === "fda")) safetyWithFdaRef++;
    if (refs.some((r) => r.kind === "pubmed")) safetyWithPubmedRef++;
  }
}

// Ingredient guides
const { data: ing } = await supabase
  .from("ingredient_guides")
  .select("article_jsonb");
const ingTotal = ing?.length ?? 0;
const ingWithRefs = (ing ?? []).filter((r) =>
  Array.isArray(r.article_jsonb?.references) && r.article_jsonb.references.length > 0
).length;

// Product comparisons
const { data: cmp } = await supabase
  .from("product_comparisons")
  .select("article_jsonb");
const cmpTotal = cmp?.length ?? 0;
const cmpWithRefs = (cmp ?? []).filter((r) =>
  Array.isArray(r.article_jsonb?.references) && r.article_jsonb.references.length > 0
).length;

// Expert picks
const expertTotal = await count(
  supabase.from("expert_picks").select("id", { count: "exact", head: true }).eq("status", "published")
);

// Product analyses (medications with verdict)
const productTotal = await count(
  supabase.from("medications").select("id", { count: "exact", head: true }).eq("approval_status", "approved").not("verdict", "is", null)
);

console.log("Content type         | total | FDA  | PubMed | any refs");
console.log("-".repeat(62));
console.log(`Trending articles    | ${String(trends?.length ?? 0).padEnd(5)} | ${String(trendsWithFda).padEnd(4)} | ${String(trendsWithPubmed).padEnd(6)} | ${trendsWithAny}`);
console.log(`Safety articles      | ${String(safety?.length ?? 0).padEnd(5)} | ${String(safetyWithFdaRef).padEnd(4)} | ${String(safetyWithPubmedRef).padEnd(6)} | ${safetyWithRefs}`);
console.log(`Ingredient guides    | ${String(ingTotal).padEnd(5)} | —    | —      | ${ingWithRefs}`);
console.log(`Product comparisons  | ${String(cmpTotal).padEnd(5)} | —    | —      | ${cmpWithRefs}`);
console.log(`Expert picks         | ${String(expertTotal).padEnd(5)} | —    | —      | 0 (no schema)`);
console.log(`Product analyses     | ${String(productTotal).padEnd(5)} | —    | —      | 0 (FDA in body)`);
