import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// Shared voice rule snippet — keep descriptions concise but unmistakable.
const VOICE_RULE =
  "Write as Dr.pharmacist's own research. No video/speaker/channel references. No 'overseas/foreign/imported' framing (US audience). See system rules.";

const expertVideoSchema = z.object({
  title: z
    .string()
    .describe(
      `Catchy click-worthy title for the analysis (not the original video title). ${VOICE_RULE}`
    ),
  expertName: z
    .string()
    .describe(
      "Name of the expert in the video — ADMIN METADATA ONLY. Never referenced in public body fields."
    ),
  expertCredential: z
    .string()
    .describe(
      "Professional credential, e.g. 'Board-Certified Dermatologist', 'PharmD' — ADMIN METADATA ONLY."
    ),
  category: z
    .enum(["health", "skin-care", "wellness"])
    .describe("Primary category"),
  summary: z
    .string()
    .describe(
      `150-200 word consumer-friendly TL;DR written as independent pharmacist research. ${VOICE_RULE}`
    ),
  keyTakeaways: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe(
      `3-5 actionable bullet points as Dr.pharmacist's own recommendations. ${VOICE_RULE}`
    ),
  cleanTranscript: z
    .string()
    .describe(
      "EXCEPTION FIELD — this is the only place the original speaker's voice is preserved. Clean up filler words (um, uh, like, you know) and fix grammar but keep the speaker's wording. Shown as a collapsed 'source material' accordion on the public page."
    ),
  properNotes: z
    .array(
      z.object({
        heading: z.string().describe("Research note section heading"),
        bullets: z
          .array(z.string())
          .describe("Bullet-point research notes under this heading"),
      })
    )
    .min(3)
    .max(6)
    .describe(
      `Dr.pharmacist's structured research notes (heading + bullets). ${VOICE_RULE}`
    ),
  analysisSections: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            `Section heading — neutral, research-oriented (e.g. 'What the Research Shows', 'The Science Behind It', 'Who Should Try This'). NOT 'What the Expert Says' or similar video-extract phrasing.`
          ),
        content: z
          .string()
          .describe(
            `Long-form editorial body for this section. ${VOICE_RULE}`
          ),
      })
    )
    .describe(
      `Main article body, written as Dr.pharmacist's original editorial. ${VOICE_RULE}`
    ),
  mentionedProducts: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Full product name with brand (e.g. 'Jarrow Dophilus EPS', 'CeraVe Moisturizing Cream'). NOT standalone ingredients like 'retinol' or 'ceramides' — only actual purchasable branded products."
          ),
        reason: z
          .string()
          .describe(
            `One-sentence factual note on why this product matters (recommended, cautionary, comparison). No geographic framing. ${VOICE_RULE}`
          ),
        shopKeyword: z
          .string()
          .describe(
            "Short URL-friendly keyword for the product category to shop for (e.g. 'probiotics', 'face moisturizer', 'retinol serum', 'b12 supplement', 'sunscreen'). Lowercase, 1-3 words. Used to navigate to /topics/[keyword] page where related products from multiple retailers are shown."
          ),
      })
    )
    .describe(
      "Branded PRODUCTS only — not standalone ingredients. Each entry must be an actual purchasable product with a brand name. Skip pure ingredient mentions (e.g. 'hyaluronic acid') unless tied to a specific product."
    ),
});

export type ExpertVideoAnalysis = z.infer<typeof expertVideoSchema>;

/**
 * Analyze a YouTube expert video transcript using Gemini.
 * Retries up to 3 times with backoff for rate limit errors.
 */
export async function analyzeExpertVideo(
  transcript: string,
  originalTitle?: string
): Promise<ExpertVideoAnalysis> {
  const trimmed = transcript.slice(0, 10000);

  const prompt = `You are a staff pharmacist at Dr.pharmacist (a US health & beauty research site for 20-30 year old Americans) writing an ORIGINAL research article.

The transcript below is ONE source of information. Your job is to publish Dr.pharmacist-voiced content — NOT a video recap.

${originalTitle ? `Source reference (do NOT mention in any body text): "${originalTitle}"` : ""}

=============================================
CRITICAL VOICE RULES — APPLY TO EVERY FIELD
EXCEPT \`cleanTranscript\`
=============================================

RULE 1 — NO VIDEO / SPEAKER / CHANNEL REFERENCES
The reader must have NO IDEA this came from a video. Write as Dr.pharmacist's own research.

Forbidden phrases include (but are not limited to):
- "In this video/guide/episode..."
- "Pharmacist Ko explains/argues/says..."
- "from 'Pharmacist's Supplements Story'" or any channel name
- "He/she recommends..." (when referring to the speaker)
- "The speaker discusses..."
- "According to the expert..."
- "This video covers..."
- "In his experience..."
- "He shares..." / "She demonstrates..."

Use instead:
- "Dr.pharmacist recommends..."
- "Our research shows..."
- "The evidence suggests..."
- "We found..."
- Neutral third-person: "Probiotics work by..." (no speaker attribution)

RULE 2 — NO "OVERSEAS / FOREIGN / IMPORTED" FRAMING
The source may be Korean and label non-Korean products as "overseas" or "imported". Our audience is American. Those products are domestic for them. Drop geographic framing entirely.

Forbidden: "overseas probiotics", "foreign brands", "imported supplements", "from abroad", "non-domestic", "international brand" (as a qualifier).

Use instead: describe products on their own merits — ingredients, strain count, brand, efficacy — with no geographic qualifier. "A well-researched probiotic..." not "A popular overseas probiotic...".

RULE 3 — NO KOREA-SPECIFIC CULTURAL FRAMING
Unless genuinely useful (e.g. "K-beauty" as an established category), skip Korean market references, Korean pricing, Korean regulatory bodies, Korean retail names.

RULE 4 — EXPERT METADATA IS ADMIN-ONLY
\`expertName\` and \`expertCredential\` are for admin records only. Never weave them into summary/keyTakeaways/analysisSections/properNotes/mentionedProducts.

RULE 5 — \`cleanTranscript\` IS THE ONLY EXCEPTION
Preserve the original speaker's wording there (remove filler words, fix grammar). This field is a collapsed "source material" accordion, so the video-extract voice is appropriate.

=============================================
CONTENT STYLE
=============================================
- Tone: conversational but authoritative — a smart pharmacist friend, not an academic
- Title: click-worthy, topic-focused (e.g. "The 4 Probiotics Actually Worth Buying", "Stop Wasting Money on These Supplements")
- Summary (150-200 words): consumer-friendly, no jargon
- Key Takeaways: 3-5 actionable bullets
- Analysis Sections: long-form editorial; section titles are neutral research headings ("What the Research Shows", not "What the Expert Says")
- Proper Notes: research-note format (heading + bullets)
- Mentioned Products: ONLY branded, purchasable products (e.g. "Jarrow Dophilus EPS"). Do NOT list standalone ingredients ("retinol", "hyaluronic acid") unless tied to a specific branded product. Each entry is a factual one-liner with no geographic qualifiers.

TRANSCRIPT:
${trimmed}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-pro"),
        schema: expertVideoSchema,
        prompt,
      });
      return object;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(
        `[analyze-expert-video] Attempt ${attempt + 1} failed:`,
        lastError.message
      );
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 25000));
      }
    }
  }

  throw new Error(
    `Failed after 3 attempts. Last error: ${lastError?.message}`
  );
}
