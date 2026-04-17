/**
 * Fetch REAL product images for Dr.'s Analysis mentioned products.
 *
 * Strategy: Bing Image Search → prefer Amazon/retailer images →
 *           download → upload to Supabase Storage → update DB.
 *
 * No API key needed — uses Bing web search results.
 *
 * Usage: node scripts/fetch-real-product-images.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ── Load env ────────────────────────────────────────────────
const envText = readFileSync(".env.local", "utf8");
function pickEnv(key) {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${key} in .env.local`);
  return m[1].trim();
}

const SUPABASE_URL = pickEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = pickEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = "public-images";
const FOLDER = "products";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

// ── Bing Image Search ───────────────────────────────────────
const PREFERRED_HOSTS = [
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "cloudinary.images-iherb.com",
  "i5.walmartimages.com",
  "vitacost.com",
  "cdn.shopify.com",
];

async function searchBingImages(productName) {
  const query = encodeURIComponent(`${productName} supplement product photo`);
  const url = `https://www.bing.com/images/search?q=${query}&form=HDRSC2&first=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) throw new Error(`Bing ${res.status}`);
  const html = await res.text();

  // Extract image URLs from Bing's murl (media URL) metadata
  const matches = html.match(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g) || [];
  const urls = matches
    .map((m) => {
      const u = m.match(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/);
      return u ? decodeURIComponent(u[1]) : null;
    })
    .filter(Boolean)
    .filter((u) => !u.includes("sprite") && !u.includes("icon") && !u.includes("logo"));

  // Prefer retail/known product image sources
  for (const host of PREFERRED_HOSTS) {
    const match = urls.find((u) => u.includes(host));
    if (match) return match;
  }

  // Fallback: first image with reasonable URL
  return urls[0] ?? null;
}

// ── Download + Upload to Storage ────────────────────────────
async function downloadAndUpload(imageUrl, productName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  const res = await fetch(imageUrl, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`Download ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());

  if (bytes.byteLength < 2048) throw new Error(`Too small: ${bytes.byteLength}B`);

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const storagePath = `${FOLDER}/${slugify(productName)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: true,
    cacheControl: "2592000",
  });

  if (error) throw new Error(`Upload: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Main ────────────────────────────────────────────────────
(async () => {
  console.log("[fetch-images] Loading Dr.'s Analysis mentioned products...\n");

  const { data: picks } = await supabase
    .from("expert_picks")
    .select("title, mentioned_products");

  const productSlugs = [];
  for (const pick of picks ?? []) {
    if (Array.isArray(pick.mentioned_products)) {
      for (const mp of pick.mentioned_products) {
        if (mp.slug) productSlugs.push(mp.slug);
      }
    }
  }

  const { data: meds } = await supabase
    .from("medications")
    .select("id, name, slug, image_url")
    .in("slug", productSlugs);

  const products = meds ?? [];
  console.log(`Found ${products.length} products to process\n`);

  let success = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`[${i + 1}/${products.length}] ${p.name}`);

    try {
      // 1. Search Bing for real product image
      const imageUrl = await searchBingImages(p.name);
      if (!imageUrl) {
        console.log("  ✗ No image found");
        failures.push(p.name);
        failed++;
        continue;
      }

      const source = new URL(imageUrl).hostname;
      console.log(`  → Found from ${source}`);

      // 2. Download and upload to Supabase Storage
      const storageUrl = await downloadAndUpload(imageUrl, p.name);

      // 3. Update DB
      const { error } = await supabase
        .from("medications")
        .update({ image_url: storageUrl })
        .eq("id", p.id);

      if (error) {
        console.log(`  ✗ DB error: ${error.message}`);
        failures.push(p.name);
        failed++;
      } else {
        console.log(`  ✓ Saved (${storageUrl.split("/").pop()})`);
        success++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${msg.slice(0, 100)}`);
      failures.push(p.name);
      failed++;
    }

    // Pace: avoid rate limiting
    if (i < products.length - 1) await sleep(2000);
  }

  console.log(`\n[fetch-images] Done: ${success}/${products.length} succeeded, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailed products:");
    failures.forEach((n) => console.log(`  - ${n}`));
  }
})();
