/**
 * One-off: migrate expert_picks.thumbnail_url from external hosts
 * (image.pollinations.ai, i.ytimg.com) to Supabase Storage so the hero
 * image on /expert/[slug] serves from our CDN instead.
 *
 * Safe to re-run: skips rows whose thumbnail already points at Storage.
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
const supabase = createClient(SUPABASE_URL, pickEnv("SUPABASE_SERVICE_ROLE_KEY"));

const STORAGE_BUCKET = "public-images";
const STORAGE_FOLDER = "expert-picks";
const FETCH_TIMEOUT_MS = 60_000;

function extFromContentType(ct) {
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  return "jpg";
}

async function persist(sourceUrl, slug) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`source ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 1024) throw new Error(`payload too small (${bytes.byteLength}B)`);

    const ext = extFromContentType(contentType);
    const storagePath = `${STORAGE_FOLDER}/${slug}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: true,
        cacheControl: "2592000",
      });
    if (uploadErr) throw new Error(`upload: ${uploadErr.message}`);

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return { url: data.publicUrl, bytes: bytes.byteLength };
  } finally {
    clearTimeout(timeout);
  }
}

const { data: picks, error } = await supabase
  .from("expert_picks")
  .select("id, slug, thumbnail_url")
  .not("thumbnail_url", "is", null);

if (error) {
  console.error("fetch failed:", error.message);
  process.exit(1);
}

console.log(`Found ${picks.length} picks with thumbnails\n`);

let migrated = 0;
let skipped = 0;
let failed = 0;

for (const pick of picks) {
  const url = pick.thumbnail_url;
  if (!url) {
    skipped++;
    continue;
  }
  if (url.startsWith(SUPABASE_URL)) {
    console.log(`  skip  ${pick.slug}  (already on Storage)`);
    skipped++;
    continue;
  }
  try {
    console.log(`  pull  ${pick.slug}  ← ${url.slice(0, 70)}...`);
    const { url: newUrl, bytes } = await persist(url, pick.slug);
    const { error: updErr } = await supabase
      .from("expert_picks")
      .update({ thumbnail_url: newUrl })
      .eq("id", pick.id);
    if (updErr) throw new Error(`update: ${updErr.message}`);
    console.log(`  ok    ${pick.slug}  → ${(bytes / 1024).toFixed(1)} KB`);
    migrated++;
  } catch (e) {
    console.error(`  FAIL  ${pick.slug}:`, e.message);
    failed++;
  }
}

console.log(`\nDone. migrated=${migrated}  skipped=${skipped}  failed=${failed}`);
