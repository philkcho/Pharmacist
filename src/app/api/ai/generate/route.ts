import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { getOrFetchMedications } from "@/lib/actions/medications";

export const maxDuration = 60;

/** Truncate to keep the context window small. */
function clip(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

interface MedicationLike {
  name: string;
  generic_name: string | null;
  active_ingredients: unknown;
  warnings: string | null;
  side_effects: string | null;
  dosage_forms: string[] | null;
}

/**
 * Build a concise FDA-label context block the model can ground answers in.
 * Each medication gets ~200-300 tokens worth of curated fields, not the full
 * SPL — Gemini doesn't need the entire warning section to write a 600-word
 * article.
 */
function buildFdaContext(meds: MedicationLike[]): string {
  if (meds.length === 0) return "";
  const blocks = meds.map((med) => {
    const ai = Array.isArray(med.active_ingredients)
      ? (med.active_ingredients as string[]).slice(0, 5).join(", ")
      : "";
    const forms = med.dosage_forms?.slice(0, 3).join(", ") ?? "";
    return [
      `### ${med.name}`,
      med.generic_name ? `Generic: ${med.generic_name}` : null,
      ai ? `Active ingredients: ${ai}` : null,
      forms ? `Dosage forms: ${forms}` : null,
      med.warnings ? `FDA warnings: ${clip(med.warnings, 600)}` : null,
      med.side_effects
        ? `Adverse reactions: ${clip(med.side_effects, 300)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return `\n\nFDA label reference data (use this to ground your claims — do NOT invent warnings, ingredients, or dosages beyond what's listed here):\n\n${blocks.join("\n\n")}`;
}

export async function POST(req: Request) {
  const {
    topic,
    category,
    articleType,
    medications: medicationNames = [],
  } = (await req.json()) as {
    topic: string;
    category: string;
    articleType: string;
    medications?: string[];
  };

  // Hybrid cache: DB first, fall back to openFDA + upsert on miss.
  // Failures here are non-fatal — we still generate the article without the
  // grounding context.
  let fdaContext = "";
  if (medicationNames.length > 0) {
    try {
      const meds = await getOrFetchMedications(medicationNames);
      fdaContext = buildFdaContext(meds);
    } catch (err) {
      console.warn("[generate] FDA lookup failed:", err);
    }
  }

  const result = streamText({
    model: google("gemini-2.5-pro"),
    maxRetries: 0,
    system: `You are a licensed pharmacist (PharmD) writing expert OTC medication recommendation articles for a health information website called "Dr.pharmacist."

Your writing style:
- Professional yet accessible to general consumers
- Evidence-based, citing FDA guidelines and clinical studies where relevant
- Practical and actionable advice
- Always include safety warnings and when to see a doctor
- Use markdown formatting: ## for sections, ### for subsections, **bold** for drug names, - for lists
- Never make claims beyond FDA-approved labeling

Article structure:
1. ## Quick Answer — A concise 2-3 sentence summary with the top recommendation
2. Main body with multiple ## sections covering the topic thoroughly
3. Specific product recommendations with dosing info
4. ## What to Avoid — Common mistakes or ineffective products
5. ## When to See a Doctor — Red flags that need professional attention
6. ## The Bottom Line — Brief closing summary

Important:
- Focus on OTC (over-the-counter) medications only
- Include generic names with brand names in parentheses
- Mention key side effects and drug interactions
- Target a ~3 minute read: aim for 550-650 words total. Be concise in every section; prioritize the most actionable information over exhaustive coverage. The reading time is calculated at 200 words/minute, so staying within this range is important.${fdaContext}`,
    prompt: `Write a concise ~3 minute read (550-650 words) pharmacist recommendation article about: "${topic}"

Category: ${category}
Article type: ${articleType}

Write the full article body in markdown format. Do NOT include the title — just the body content starting with ## Quick Answer. Keep the total under ~650 words.`,
  });

  return result.toTextStreamResponse();
}
