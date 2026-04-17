/**
 * Fetch a product image from Pollinations.ai and persist it to Supabase
 * Storage (public-images bucket). Returns the Storage public URL.
 *
 * Why: Pollinations generates on-demand and can be slow (5–30s) or
 * intermittently fail. Storing the bytes once in Supabase Storage gives
 * us a fast, stable CDN URL for subsequent page renders.
 *
 * Idempotent: uses a deterministic path based on product slug + seed, so
 * re-running upserts the same object.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { buildProductImageUrl } from "./generate-product-image";

const STORAGE_BUCKET = "public-images";
const STORAGE_FOLDER = "products";
const FETCH_TIMEOUT_MS = 45_000; // Pollinations cold generation can be slow

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export interface UploadResult {
  url: string;
  /** true = we hit Pollinations + Storage. false = fell back to Pollinations URL directly. */
  persisted: boolean;
}

/**
 * Fetch a Pollinations image and upload it to Supabase Storage.
 * On any failure (timeout, upload error), falls back to returning the raw
 * Pollinations URL so the caller still has *something* to persist.
 */
export async function uploadProductImageToStorage(
  productName: string,
  productType: string
): Promise<UploadResult> {
  const pollinationsUrl = buildProductImageUrl(productName, productType);
  const storagePath = `${STORAGE_FOLDER}/${slugify(productName)}.png`;

  const admin = createAdminClient();

  try {
    // 1. Fetch the generated image bytes from Pollinations
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(pollinationsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(
        `[upload-product-image] Pollinations ${res.status} for "${productName}"`
      );
      return { url: pollinationsUrl, persisted: false };
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const arrayBuffer = await res.arrayBuffer();

    // Guard against garbage (e.g. HTML error page)
    if (arrayBuffer.byteLength < 1024) {
      console.warn(
        `[upload-product-image] Pollinations returned suspiciously small payload (${arrayBuffer.byteLength}B) for "${productName}"`
      );
      return { url: pollinationsUrl, persisted: false };
    }

    // 2. Upload to Supabase Storage (upsert = re-runs overwrite)
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
        cacheControl: "2592000", // 30 days
      });

    if (uploadError) {
      console.warn(
        `[upload-product-image] Storage upload failed for "${productName}":`,
        uploadError.message
      );
      return { url: pollinationsUrl, persisted: false };
    }

    // 3. Get the public URL
    const {
      data: { publicUrl },
    } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    return { url: publicUrl, persisted: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[upload-product-image] Fatal error for "${productName}":`,
      msg.slice(0, 120)
    );
    return { url: pollinationsUrl, persisted: false };
  }
}
