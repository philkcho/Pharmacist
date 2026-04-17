/**
 * Generate a product image using Pollinations.ai.
 * Produces a realistic product photography style image.
 */

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

const TYPE_STYLE: Record<string, string> = {
  otc_drug:
    "pharmaceutical product box and pills on a clean white pharmacy counter, studio product photography, soft lighting, high detail",
  supplement:
    "supplement bottle with capsules on a marble surface, studio product photography, natural lighting, health and wellness aesthetic",
  cosmetic:
    "skincare product bottle on a minimal white background with soft shadows, beauty product photography, elegant, high quality",
  quasi_drug:
    "healthcare product packaging on a clean surface, product photography, soft lighting, professional",
};

/**
 * Build a deterministic Pollinations image URL without any network I/O.
 * Safe to call from hot render paths — the browser loads the image and
 * Pollinations generates on first request (subsequent loads hit cache).
 */
export function buildProductImageUrl(
  productName: string,
  productType: string
): string {
  const style = TYPE_STYLE[productType] ?? TYPE_STYLE.otc_drug;
  const prompt = `${productName}, ${style}, no text overlay, no logos, no watermark, no human faces, no hands`;
  const seed = hashCode(productName);
  return `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=600&height=600&seed=${seed}&nologo=true`;
}

/**
 * Generate a product image and persist it to Supabase Storage, returning
 * the stable public CDN URL. Use for background jobs (ingestion, cron
 * fill) — the Pollinations fetch + upload can take 5–30s, so don't call
 * from page renders.
 *
 * Falls back to the raw Pollinations URL if the upload step fails, so the
 * caller always gets a usable URL (but one that may be slow/unstable).
 */
export async function generateProductImageUrl(
  productName: string,
  productType: string
): Promise<string> {
  // Dynamic import avoids pulling the admin client into any client bundle
  // that only needs buildProductImageUrl.
  const { uploadProductImageToStorage } = await import("./upload-product-image");
  const { url } = await uploadProductImageToStorage(productName, productType);
  return url;
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
