import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
function pickEnv(key) {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${key}`);
  return m[1].trim();
}

const supabase = createClient(
  pickEnv("NEXT_PUBLIC_SUPABASE_URL"),
  pickEnv("SUPABASE_SERVICE_ROLE_KEY"),
);

async function countQ(q) {
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

const [
  approved,
  approvedWithVerdict,
  safety,
  comparisons,
  ingredients,
  trends,
  experts,
  totalProducts,
  draftProducts,
] = await Promise.all([
  countQ(supabase.from("medications").select("id", { count: "exact", head: true }).eq("approval_status", "approved")),
  countQ(supabase.from("medications").select("id", { count: "exact", head: true }).eq("approval_status", "approved").not("verdict", "is", null)),
  countQ(supabase.from("medications").select("id", { count: "exact", head: true }).not("safety_article_jsonb", "is", null)),
  countQ(supabase.from("product_comparisons").select("*", { count: "exact", head: true })),
  countQ(supabase.from("ingredient_guides").select("*", { count: "exact", head: true })),
  countQ(supabase.from("trend_topics").select("id", { count: "exact", head: true }).eq("status", "published")),
  countQ(supabase.from("expert_picks").select("id", { count: "exact", head: true }).eq("status", "published")),
  countQ(supabase.from("medications").select("id", { count: "exact", head: true })),
  countQ(supabase.from("medications").select("id", { count: "exact", head: true }).eq("approval_status", "draft")),
]);

const [lastSafety, lastCmp, lastIng] = await Promise.all([
  supabase.from("medications").select("name, safety_article_generated_at").not("safety_article_generated_at", "is", null).order("safety_article_generated_at", { ascending: false }).limit(3),
  supabase.from("product_comparisons").select("slug_a, slug_b, generated_at").order("generated_at", { ascending: false }).limit(3),
  supabase.from("ingredient_guides").select("slug, generated_at").order("generated_at", { ascending: false }).limit(3),
]);

for (const [label, res] of [["safety", lastSafety], ["comparisons", lastCmp], ["ingredients", lastIng]]) {
  if (res.error) console.error(`[WARN] ${label} query error:`, res.error.message);
}

console.log("== Products ==");
console.log(`  total:                    ${totalProducts}`);
console.log(`  draft:                    ${draftProducts}`);
console.log(`  approved:                 ${approved}`);
console.log(`  approved w/ verdict:      ${approvedWithVerdict}  (eligible for SEO gen)`);
console.log();
console.log("== SEO Content ==");
console.log(`  safety articles:          ${safety} / ${approvedWithVerdict}`);
console.log(`  product comparisons:      ${comparisons}`);
console.log(`  ingredient guides:        ${ingredients}`);
console.log();
console.log("== Other Content ==");
console.log(`  published trends:         ${trends}`);
console.log(`  published expert picks:   ${experts}`);
console.log();
console.log("== Recent SEO Generation ==");
console.log("  Last 3 safety articles:");
(lastSafety.data ?? []).forEach((r) => console.log(`    ${r.safety_article_generated_at}  ${r.name}`));
console.log("  Last 3 comparisons:");
(lastCmp.data ?? []).forEach((r) => console.log(`    ${r.generated_at}  ${r.slug_a} vs ${r.slug_b}`));
console.log("  Last 3 ingredient guides:");
(lastIng.data ?? []).forEach((r) => console.log(`    ${r.generated_at}  ${r.slug}`));
