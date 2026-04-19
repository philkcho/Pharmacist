/**
 * Download an external image (Pollinations.ai, YouTube i.ytimg.com, etc.)
 * and persist it to Supabase Storage so subsequent page renders come from
 * the Supabase CDN instead of the slow/unstable origin.
 *
 * Why: hero thumbnails are the LCP element on /expert/[slug] pages.
 * Pollinations generates on demand (500ms–3s), serves no cache-control,
 * and its response time is outside our control — bad for Core Web Vitals.
 * Supabase Storage gives us a stable, cache-friendly CDN URL and unlocks
 * Next.js Image optimization (WebP + resize) via the remotePatterns
 * allowlist already configured in `next.config.ts`.
 *
 * Idempotent: deterministic path `expert-picks/<slug>.<ext>` — re-running
 * overwrites the same object without creating duplicates.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = "public-images";
const STORAGE_FOLDER = "expert-picks";
const FETCH_TIMEOUT_MS = 45_000;

export interface PersistThumbnailResult {
  /** The URL to store. Storage CDN when successful, original sourceUrl on failure. */
  url: string;
  /** true = bytes saved to Supabase Storage. false = fell back to sourceUrl. */
  persisted: boolean;
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  // Pollinations defaults to jpeg; YouTube to jpg. Safe fallback.
  return "jpg";
}

export async function persistThumbnailToStorage(
  sourceUrl: string,
  slug: string
): Promise<PersistThumbnailResult> {
  const admin = createAdminClient();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(sourceUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(
        `[persist-thumbnail] Source ${res.status} for slug "${slug}" (${sourceUrl.slice(0, 80)}...)`
      );
      return { url: sourceUrl, persisted: false };
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    // Guard against HTML error pages masquerading as images.
    if (arrayBuffer.byteLength < 1024) {
      console.warn(
        `[persist-thumbnail] Suspiciously small payload (${arrayBuffer.byteLength}B) for "${slug}"`
      );
      return { url: sourceUrl, persisted: false };
    }

    const ext = extFromContentType(contentType);
    const storagePath = `${STORAGE_FOLDER}/${slug}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
        cacheControl: "2592000", // 30 days
      });

    if (uploadError) {
      console.warn(
        `[persist-thumbnail] Storage upload failed for "${slug}":`,
        uploadError.message
      );
      return { url: sourceUrl, persisted: false };
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    return { url: publicUrl, persisted: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[persist-thumbnail] Fatal error for "${slug}":`,
      msg.slice(0, 120)
    );
    return { url: sourceUrl, persisted: false };
  }
}
