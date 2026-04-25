/**
 * Phase 0.2 — Seeds the top N representative products per category.
 *
 * Uses ensureProductComplete() (memory policy: lazy fetch over batch).
 * Idempotent: skips a category once it already has ≥ skipThreshold approved.
 *
 * Run via: pnpm exec tsx scripts/seed-category-tops.ts
 *   --per-category=3   # how many to seed per category (default 3)
 *   --skip-threshold=5 # don't seed if already has N approved (default 5)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { ensureProductComplete } from "@/lib/actions/ensure-product-complete";
import { PRODUCT_SEED_LIST } from "@/lib/data/product-seed-list";

const envText = readFileSync(".env.local", "utf8");
function envPick(k: string): string {
  const m = envText.match(new RegExp(`^${k}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1].trim();
}

// Bridge env vars so server-side helpers (createAdminClient) work in this script
process.env.NEXT_PUBLIC_SUPABASE_URL ??= envPick("NEXT_PUBLIC_SUPABASE_URL");
process.env.SUPABASE_SERVICE_ROLE_KEY ??= envPick("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PER_CATEGORY = Number(
  process.argv.find((a) => a.startsWith("--per-category="))?.split("=")[1] ?? 3
);
const SKIP_THRESHOLD = Number(
  process.argv.find((a) => a.startsWith("--skip-threshold="))?.split("=")[1] ?? 5
);

async function main() {
  const byCategory = new Map<string, typeof PRODUCT_SEED_LIST>();
  for (const item of PRODUCT_SEED_LIST) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  console.log(`Categories in seed list: ${byCategory.size}`);
  console.log(`Per category: ${PER_CATEGORY}, skip threshold: ${SKIP_THRESHOLD}`);
  console.log("");

  let totalAdded = 0;
  let totalPartial = 0;
  let totalFailed = 0;

  for (const [categorySlug, items] of byCategory) {
    const { data: catRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (!catRow) {
      console.log(`[skip] category not in DB: ${categorySlug}`);
      continue;
    }

    const { count } = await supabase
      .from("medications")
      .select("id", { count: "exact", head: true })
      .eq("category_id", catRow.id as number)
      .eq("approval_status", "approved");

    const current = count ?? 0;
    if (current >= SKIP_THRESHOLD) {
      console.log(`[skip] ${categorySlug}: already ${current} approved (≥${SKIP_THRESHOLD})`);
      continue;
    }

    const needed = Math.min(PER_CATEGORY, items.length);
    console.log(`\n[${categorySlug}] current=${current}, seeding ${needed}...`);

    for (let i = 0; i < needed; i++) {
      const seed = items[i];
      try {
        const result = await ensureProductComplete({
          name: seed.name,
          genericName: seed.genericName ?? null,
          productType: seed.productType,
          categorySlug: seed.category,
        });

        if (!result) {
          totalFailed++;
          console.error(`  ✗ ${seed.name}: ensureProductComplete returned null`);
        } else if (result.hasAnalysis) {
          totalAdded++;
          console.log(`  ✓ ${seed.name} (id=${result.id}, image=${result.imageUrl ? "yes" : "no"})`);
        } else {
          totalPartial++;
          console.log(`  ~ ${seed.name} (id=${result.id}) — partial: no AI analysis (quota?)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ ${seed.name}: ${msg.slice(0, 120)}`);
        totalFailed++;
      }

      // Throttle to avoid Gemini quota burst
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Fully analyzed: ${totalAdded}`);
  console.log(`Partial (no AI): ${totalPartial}`);
  console.log(`Failed:         ${totalFailed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
