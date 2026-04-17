/**
 * Migrate product image_url values from Pollinations.ai on-demand URLs
 * to persistent Supabase Storage public URLs.
 *
 * For each product whose image_url points at image.pollinations.ai:
 *   1. Fetch the generated PNG from Pollinations
 *   2. Upload to public-images/products/<slug>.png (upsert)
 *   3. Update medications.image_url to the Storage public URL
 *
 * Idempotent: re-running skips products already on Storage.
 *
 * Usage: node scripts/migrate-images-to-storage.mjs
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

// ── Config ──────────────────────────────────────────────────
const BUCKET = "public-images";
const FOLDER = "products";
const CONCURRENCY = 1;            // Pollinations free tier is strict (429 at >1 rps)
const FETCH_TIMEOUT_MS = 60_000;  // cold generation can take ~30s
const PER_REQUEST_DELAY_MS = 1500; // breathing room between requests
const MAX_RETRIES = 4;            // for 429 / transient failures
const BASE_BACKOFF_MS = 8_000;    // doubled each retry (8s → 16s → 32s → 64s)
const STORAGE_HOST = new URL(SUPABASE_URL).host; // rlemyrdivdwibooxbugq.supabase.co

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function isPollinationsUrl(url) {
  return typeof url === "string" && url.includes("image.pollinations.ai");
}

function isStorageUrl(url) {
  return typeof url === "string" && url.includes(STORAGE_HOST) && url.includes("/storage/");
}

// ── Fetch with retry on 429 / transient errors ──────────────
async function fetchPollinationsWithRetry(url, name) {
  let attempt = 0;
  let lastErr = "";
  while (attempt <= MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) return { ok: true, res };

      // Retryable: 429 (rate limit), 5xx
      if (res.status === 429 || res.status >= 500) {
        lastErr = `${res.status}`;
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`      ↻ ${res.status} on "${name}", retrying in ${wait / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(wait);
        attempt++;
        continue;
      }

      // Non-retryable HTTP error
      return { ok: false, reason: `pollinations ${res.status}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErr = msg.slice(0, 80);
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.log(`      ↻ error on "${name}" (${lastErr}), retrying in ${wait / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(wait);
      attempt++;
    }
  }
  return { ok: false, reason: `exhausted retries (last: ${lastErr})` };
}

// ── Worker ──────────────────────────────────────────────────
async function migrateOne(row) {
  const { id, name, image_url } = row;
  const storagePath = `${FOLDER}/${slugify(name)}.png`;

  const fetched = await fetchPollinationsWithRetry(image_url, name);
  if (!fetched.ok) return { id, name, ok: false, reason: fetched.reason };

  try {
    const contentType = fetched.res.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await fetched.res.arrayBuffer());

    if (bytes.byteLength < 1024) {
      return { id, name, ok: false, reason: `payload too small (${bytes.byteLength}B)` };
    }

    // Upload to Storage
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: true,
        cacheControl: "2592000",
      });

    if (upErr) return { id, name, ok: false, reason: `upload: ${upErr.message}` };

    // Get public URL
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = pub.publicUrl;

    // Update DB
    const { error: dbErr } = await supabase
      .from("medications")
      .update({ image_url: publicUrl })
      .eq("id", id);

    if (dbErr) return { id, name, ok: false, reason: `db: ${dbErr.message}` };

    return { id, name, ok: true, url: publicUrl, bytes: bytes.byteLength };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id, name, ok: false, reason: msg.slice(0, 120) };
  }
}

// ── Pool runner ─────────────────────────────────────────────
async function runPool(items, worker, concurrency) {
  const results = [];
  let idx = 0;
  async function pull() {
    while (idx < items.length) {
      const i = idx++;
      const out = await worker(items[i]);
      const tag = out.ok ? "✓" : "✗";
      console.log(
        `  ${tag} [${i + 1}/${items.length}] ${out.name}${out.ok ? ` (${(out.bytes / 1024).toFixed(1)}KB)` : ` — ${out.reason}`}`
      );
      results.push(out);
      // Pace requests so we don't immediately trip Pollinations rate limit
      if (idx < items.length) await sleep(PER_REQUEST_DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, pull));
  return results;
}

// ── Main ────────────────────────────────────────────────────
(async () => {
  console.log("[migrate-images] Fetching products with Pollinations URLs...");

  const { data, error } = await supabase
    .from("medications")
    .select("id, name, image_url")
    .not("image_url", "is", null)
    .ilike("image_url", "%pollinations.ai%")
    .order("id");

  if (error) {
    console.error("DB query failed:", error.message);
    process.exit(1);
  }

  const targets = (data ?? []).filter((r) => isPollinationsUrl(r.image_url));

  // Also catch anyone stuck at null — migrate skips these (no source URL),
  // but worth logging
  const { count: nullCount } = await supabase
    .from("medications")
    .select("id", { count: "exact", head: true })
    .is("image_url", null);

  const { count: storageCount } = await supabase
    .from("medications")
    .select("id", { count: "exact", head: true })
    .ilike("image_url", `%${STORAGE_HOST}%`);

  console.log(`  Pollinations URLs: ${targets.length}`);
  console.log(`  Storage URLs already: ${storageCount ?? 0}`);
  console.log(`  NULL image_url: ${nullCount ?? 0}`);
  console.log("");

  if (targets.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  console.log(`[migrate-images] Migrating ${targets.length} images (concurrency=${CONCURRENCY})...\n`);
  const start = Date.now();

  const results = await runPool(targets, migrateOne, CONCURRENCY);

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[migrate-images] Done in ${elapsed}s: ${ok}/${results.length} succeeded`);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name} (id=${f.id}): ${f.reason}`);
  }
})();
