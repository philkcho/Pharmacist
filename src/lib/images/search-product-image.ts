/**
 * Real product image search — fetches actual product photos from
 * Google Custom Search (1st) or Bing Image Search (2nd fallback).
 *
 * No AI-generated images — a placeholder is better than a misleading photo.
 *
 * Priority:
 *   1. Google CSE API (100 free/day, stable, official)
 *   2. Bing Image Search (web scrape fallback, no API key needed)
 *
 * Setup (see .env.local):
 *   GOOGLE_CSE_API_KEY — API key from Google Cloud Console
 *   GOOGLE_CSE_CX      — Search Engine ID from programmablesearchengine.google.com
 */

import { createAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = "public-images";
const STORAGE_FOLDER = "products";

// Preferred retail image sources (in order)
const PREFERRED_HOSTS = [
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "cloudinary.images-iherb.com",
  "i5.walmartimages.com",
  "vitacost.com",
  "cdn.shopify.com",
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// ── Google CSE ──────────────────────────────────────────────

interface CseItem {
  link: string;
  displayLink?: string;
  image?: { contextLink?: string; width?: number; height?: number };
}

async function searchGoogleCSE(productName: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) return null;

  const query = `${productName} product photo`;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "5");
  url.searchParams.set("imgSize", "medium");
  url.searchParams.set("safe", "active");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as { items?: CseItem[]; error?: { message?: string } };
    if (data.error || !data.items?.length) return null;

    // Prefer retail sources
    for (const host of PREFERRED_HOSTS) {
      const match = data.items.find(
        (item) =>
          item.link?.includes(host) ||
          item.displayLink?.includes(host) ||
          item.image?.contextLink?.includes(host)
      );
      if (match?.link) return match.link;
    }

    // Fallback: first result with reasonable size
    const first = data.items.find(
      (item) =>
        (item.image?.width ?? 0) >= 200 && (item.image?.height ?? 0) >= 200
    );
    return first?.link ?? data.items[0]?.link ?? null;
  } catch {
    return null;
  }
}

// ── Bing Image Search (web scrape fallback) ─────────────────

async function searchBingImages(productName: string): Promise<string | null> {
  const query = encodeURIComponent(`${productName} supplement product photo`);
  const url = `https://www.bing.com/images/search?q=${query}&form=HDRSC2&first=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();

    // Extract image URLs from Bing's murl (media URL) metadata
    const matches =
      html.match(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g) || [];
    const urls = matches
      .map((m) => {
        const u = m.match(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/);
        return u ? decodeURIComponent(u[1]) : null;
      })
      .filter(
        (u): u is string =>
          !!u &&
          !u.includes("sprite") &&
          !u.includes("icon") &&
          !u.includes("logo")
      );

    // Prefer retail/known product image sources
    for (const host of PREFERRED_HOSTS) {
      const match = urls.find((u) => u.includes(host));
      if (match) return match;
    }

    return urls[0] ?? null;
  } catch {
    return null;
  }
}

// ── Download + Upload to Storage ────────────────────────────

async function downloadAndUploadToStorage(
  imageUrl: string,
  productName: string
): Promise<string | null> {
  const admin = createAdminClient();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    // Guard against garbage (HTML error pages, tiny placeholders)
    if (arrayBuffer.byteLength < 2048) return null;

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const storagePath = `${STORAGE_FOLDER}/${slugify(productName)}.${ext}`;

    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
        cacheControl: "2592000", // 30 days
      });

    if (error) {
      console.warn(
        `[product-image] Storage upload failed for "${productName}":`,
        error.message
      );
      return null;
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    return publicUrl;
  } catch {
    return null;
  }
}

// ── Main export ─────────────────────────────────────────────

/**
 * Search for a real product image, download it, and persist to
 * Supabase Storage. Returns the Storage public URL, or null if
 * no image could be found/downloaded.
 *
 * Call this from ensureProductComplete, expert-picks creation,
 * trend analysis product matching, etc.
 *
 * Priority: Google CSE → Bing → null (no AI fallback).
 */
export async function fetchRealProductImage(
  productName: string
): Promise<string | null> {
  // 1. Try Google CSE (official, stable)
  let imageUrl = await searchGoogleCSE(productName);
  const source = imageUrl ? "google-cse" : null;

  // 2. Fallback to Bing
  if (!imageUrl) {
    imageUrl = await searchBingImages(productName);
  }

  if (!imageUrl) {
    console.warn(
      `[product-image] No real image found for "${productName}"`
    );
    return null;
  }

  // 3. Download and persist to Supabase Storage
  const storageUrl = await downloadAndUploadToStorage(imageUrl, productName);

  if (storageUrl) {
    console.log(
      `[product-image] ✓ ${productName} — ${source ?? "bing"} → storage`
    );
  }

  return storageUrl;
}
