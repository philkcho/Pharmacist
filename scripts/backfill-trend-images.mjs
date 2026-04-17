/**
 * Backfill image_url for existing published trends with topic-specific visuals.
 * Also pre-warms Pollinations cache by fetching each URL.
 *
 * Usage: node scripts/backfill-trend-images.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rlemyrdivdwibooxbugq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZW15cmRpdmR3aWJvb3hidWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxMjk2MCwiZXhwIjoyMDkxMzg4OTYwfQ.CKh85hitF_gYVHrEBy--NGlkbwsBJQL9y8Eh-yzfHOk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

const KEYWORD_VISUALS = {
  b12: "vitamin B12 supplement bottle and red capsules on a clean white surface",
  vitamin: "colorful vitamin supplement capsules and pills arranged neatly",
  supplement: "dietary supplement bottles and capsules on a pharmacy shelf",
  moisturizer: "luxury moisturizer jar with a dropper and dewy leaves",
  sunscreen: "sunscreen bottles with SPF label on a sandy beach towel",
  "mineral sunscreen": "mineral sunscreen tube with zinc oxide powder and a sun hat",
  acne: "acne treatment serum bottle with a clear dropper",
  retinol: "retinol serum dropper bottle with a soft glow",
  "hyaluronic acid": "hyaluronic acid serum bottle with water droplets",
  "vitamin c": "vitamin C serum bottle with orange slices",
  collagen: "collagen supplement powder and a smoothie",
  glutathione: "glutathione supplement capsules with lemon water",
  "k-beauty": "Korean skincare products lined up in a 10-step routine",
  spf: "SPF sunscreen bottles on a bright summer background",
};

function hashCode(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function findVisualSubject(query, headline) {
  const text = `${query} ${headline ?? ""}`.toLowerCase();
  const sortedKeys = Object.keys(KEYWORD_VISUALS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (text.includes(key)) return KEYWORD_VISUALS[key];
  }
  return headline ?? query;
}

function generateImageUrl(queryText, category, headline) {
  const subject = findVisualSubject(queryText, headline);
  const style = category === "beauty_fitness"
    ? "product photography, soft natural lighting, pastel background, clean minimal aesthetic, high quality"
    : "medical product photography, soft blue-white tones, clean minimal aesthetic, pharmacy style, high quality";
  const prompt = `${subject}, ${style}, no text, no logos, no watermark, no human faces, no hands`;
  const seed = hashCode(queryText);
  return `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=800&height=450&seed=${seed}&nologo=true`;
}

async function main() {
  const { data: trends, error } = await supabase
    .from("trend_topics")
    .select("id, query_text, category, trend_analyses(synthesis_jsonb)")
    .eq("status", "published");

  if (error) {
    console.error("Failed to fetch trends:", error.message);
    process.exit(1);
  }

  console.log(`Found ${trends.length} published trends\n`);

  for (const trend of trends) {
    const synth = trend.trend_analyses?.synthesis_jsonb;
    const headline = synth?.headline ?? null;
    const imageUrl = generateImageUrl(trend.query_text, trend.category, headline);

    const { error: updateError } = await supabase
      .from("trend_topics")
      .update({ image_url: imageUrl })
      .eq("id", trend.id);

    if (updateError) {
      console.error(`✗ Failed trend ${trend.id}:`, updateError.message);
      continue;
    }

    console.log(`⏳ [${trend.id}] ${trend.query_text} — warming cache...`);
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(45000) });
      const bytes = (await res.arrayBuffer()).byteLength;
      console.log(`✓ Done (${(bytes / 1024).toFixed(0)}KB)\n`);
    } catch {
      console.log(`⚠ Timed out — will load on first browser visit\n`);
    }
  }

  console.log("All done! Refresh your browser.");
}

main();
