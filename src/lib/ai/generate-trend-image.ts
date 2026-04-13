/**
 * Generate a cover image for a trend topic using Pollinations.ai.
 *
 * Pollinations is 100 % free, requires no API key, and returns an
 * image URL that can be used directly as an <img> src.
 */

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

/**
 * Map common health/beauty keywords to concrete visual subjects.
 * This ensures the generated image actually depicts the topic.
 */
const KEYWORD_VISUALS: Record<string, string> = {
  // Health
  b12: "vitamin B12 supplement bottle and red capsules on a clean white surface",
  vitamin: "colorful vitamin supplement capsules and pills arranged neatly",
  supplement: "dietary supplement bottles and capsules on a pharmacy shelf",
  headache: "aspirin tablets and a glass of water on a bedside table",
  cold: "cold medicine box, tissues, and a warm cup of tea",
  flu: "flu medicine, thermometer, and tissues on a table",
  allergy: "allergy medication box with spring flowers in background",
  sleep: "melatonin supplement bottle on a nightstand with dim lighting",
  pain: "pain relief gel tube and tablets on a clean surface",
  heartburn: "antacid tablets and a glass of water",
  cough: "cough syrup bottle with a measuring spoon",
  digestive: "probiotic supplement capsules with yogurt",

  // Beauty / Skincare
  moisturizer: "luxury moisturizer jar with a dropper and dewy leaves",
  sunscreen: "sunscreen bottles with SPF label on a sandy beach towel",
  "mineral sunscreen": "mineral sunscreen tube with zinc oxide powder and a sun hat",
  "chemical sunscreen": "chemical sunscreen spray bottle next to a pool",
  acne: "acne treatment serum bottle with a clear dropper",
  "anti-aging": "anti-aging retinol serum bottle with golden drops",
  retinol: "retinol serum dropper bottle with a soft glow",
  "hyaluronic acid": "hyaluronic acid serum bottle with water droplets",
  "vitamin c": "vitamin C serum bottle with orange slices",
  niacinamide: "niacinamide serum bottle on a marble surface",
  cleanser: "facial cleanser foam pump bottle with bubbles",
  toner: "facial toner bottle with cotton pads",
  serum: "skincare serum dropper with golden liquid",
  "k-beauty": "Korean skincare products lined up in a 10-step routine",
  spf: "SPF sunscreen bottles on a bright summer background",
  collagen: "collagen supplement powder and a smoothie",
  glutathione: "glutathione supplement capsules with lemon water",
};

/**
 * Find the best visual description for a given query.
 */
function findVisualSubject(query: string, headline?: string | null): string {
  const text = `${query} ${headline ?? ""}`.toLowerCase();

  // Try exact multi-word matches first, then single-word
  const sortedKeys = Object.keys(KEYWORD_VISUALS).sort(
    (a, b) => b.length - a.length
  );

  for (const key of sortedKeys) {
    if (text.includes(key)) {
      return KEYWORD_VISUALS[key];
    }
  }

  // Fallback: use the headline/query directly
  return headline ?? query;
}

/**
 * Build the image generation prompt.
 */
function buildPrompt(
  query: string,
  category: string,
  headline?: string | null
): string {
  const subject = findVisualSubject(query, headline);

  const style =
    category === "beauty_fitness"
      ? "product photography, soft natural lighting, pastel background, clean minimal aesthetic, high quality"
      : "medical product photography, soft blue-white tones, clean minimal aesthetic, pharmacy style, high quality";

  return `${subject}, ${style}, no text, no logos, no watermark, no human faces, no hands`;
}

/**
 * Build the Pollinations image URL.
 */
function buildImageUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_BASE}/${encoded}?width=800&height=450&seed=${seed}&nologo=true`;
}

/**
 * Generate a trend cover image URL and pre-warm the Pollinations cache.
 */
export async function generateTrendImageUrl(
  query: string,
  category: string,
  headline?: string | null
): Promise<string> {
  const prompt = buildPrompt(query, category, headline);
  const seed = hashCode(query);
  const url = buildImageUrl(prompt, seed);

  // Pre-warm: fire and wait so image is cached for browser
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    console.log("[generate-trend-image] Pre-warmed:", query);
  } catch {
    console.warn(
      "[generate-trend-image] Pre-warm failed (will retry on browser load):",
      query
    );
  }

  return url;
}

/** Simple string hash for deterministic seed. */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
