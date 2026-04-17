import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
const p = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim();
const s = createClient(
  p("NEXT_PUBLIC_SUPABASE_URL"),
  p("SUPABASE_SERVICE_ROLE_KEY"),
);

// category_id population
const { data: cats } = await s
  .from("medications")
  .select("category_id, product_type")
  .eq("approval_status", "approved")
  .not("verdict", "is", null);
const catStats = {};
cats.forEach((r) => {
  const k = `${r.product_type}/${r.category_id ?? "null"}`;
  catStats[k] = (catStats[k] ?? 0) + 1;
});
console.log("== product_type / category_id distribution ==");
Object.entries(catStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));

// categories table
const { data: catTable } = await s.from("categories").select("id, name, slug");
console.log("\n== categories table ==");
(catTable ?? []).forEach((c) =>
  console.log(`  id=${c.id}  slug=${c.slug}  name=${c.name}`),
);

// generic_name grouping for approved products
const { data: generics } = await s
  .from("medications")
  .select("generic_name, product_type, name, slug")
  .eq("approval_status", "approved")
  .not("verdict", "is", null)
  .not("generic_name", "is", null);

const groups = {};
generics.forEach((r) => {
  const key = `${r.product_type}::${r.generic_name.toLowerCase().split(/[/,; ]/)[0]}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push(r.slug);
});
const multi = Object.entries(groups).filter(([, v]) => v.length >= 2);
console.log(`\n== groups with 2+ products (by type::generic_name[0]) ==`);
console.log(`Total multi-groups: ${multi.length}`);
multi.slice(0, 25).forEach(([k, v]) =>
  console.log(`  [${v.length}] ${k}\n      ${v.slice(0, 4).join(", ")}`),
);
