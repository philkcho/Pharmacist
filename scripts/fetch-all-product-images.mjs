/**
 * Fetch real product images for ALL medications in DB.
 * Skips products that already have Supabase Storage URLs.
 *
 * Uses Bing Image Search (no API key needed) with Amazon/iHerb preference.
 *
 * Usage: node scripts/fetch-all-product-images.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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
const STORAGE_HOST = new URL(SUPABASE_URL).host;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

const PREFERRED_HOSTS = [
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "cloudinary.images-iherb.com",
  "i5.walmartimages.com",
  "vitacost.com",
  "cdn.shopify.com",
];

async function searchBingImages(productName) {
  const query = encodeURIComponent(`${productName} product photo`);
  const url = `https://www.bing.com/images/search?q=${query}&form=HDRSC2&first=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return null;

  const html = await res.text();
  const matches = html.match(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g) || [];
  const urls = matches
    .map((m) => { const u = m.match(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/); return u ? decodeURIComponent(u[1]) : null; })
    .filter((u) => u && !u.includes("sprite") && !u.includes("icon") && !u.includes("logo"));

  for (const host of PREFERRED_HOSTS) {
    const match = urls.find((u) => u.includes(host));
    if (match) return match;
  }
  return urls[0] ?? null;
}

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
    contentType, upsert: true, cacheControl: "2592000",
  });
  if (error) throw new Error(`Upload: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Main ────────────────────────────────────────────────────
(async () => {
  console.log("[fetch-all-images] Loading medications...\n");

  const { data: meds, error } = await supabase
    .from("medications")
    .select("id, name, slug, image_url")
    .order("id");

  if (error) { console.error("Query failed:", error.message); process.exit(1); }

  // Skip products already on Supabase Storage
  const toProcess = (meds ?? []).filter((m) => {
    if (!m.image_url) return true; // null → need image
    return !m.image_url.includes(STORAGE_HOST); // not yet on Storage
  });

  const alreadyDone = (meds ?? []).length - toProcess.length;
  console.log(`Total: ${(meds ?? []).length}, already on Storage: ${alreadyDone}, to process: ${toProcess.length}\n`);

  if (toProcess.length === 0) { console.log("Nothing to do!"); return; }

  let success = 0, failed = 0;
  const failures = [];
  const start = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${p.name.slice(0, 50).padEnd(50)} `);

    try {
      const imageUrl = await searchBingImages(p.name);
      if (!imageUrl) { console.log("✗ no results"); failures.push(p.name); failed++; continue; }

      const storageUrl = await downloadAndUpload(imageUrl, p.name);
      const { error: dbErr } = await supabase.from("medications").update({ image_url: storageUrl }).eq("id", p.id);

      if (dbErr) { console.log(`✗ DB: ${dbErr.message}`); failures.push(p.name); failed++; }
      else { console.log(`✓ ${new URL(imageUrl).hostname}`); success++; }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${msg.slice(0, 60)}`);
      failures.push(p.name);
      failed++;
    }

    if (i < toProcess.length - 1) await sleep(2000);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  console.log(`\n[fetch-all-images] Done in ${elapsed}s: ${success}/${toProcess.length} succeeded, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailed:");
    failures.forEach((n) => console.log(`  - ${n}`));
  }
})();
