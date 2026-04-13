import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const expertVideoSchema = z.object({
  title: z.string().describe("A catchy, click-worthy title for the analysis (not the original video title)"),
  expertName: z.string().describe("Name of the expert in the video"),
  expertCredential: z.string().describe("Professional credential, e.g. 'Board-Certified Dermatologist', 'PharmD'"),
  category: z.enum(["health", "skin-care", "wellness"]).describe("Primary category"),
  summary: z.string().describe("150-200 word consumer-friendly summary of the video's key message"),
  keyTakeaways: z.array(z.string()).min(3).max(5).describe("3-5 scannable bullet points"),
  analysisSections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    })
  ).describe("Structured analysis sections (e.g. 'What the Expert Says', 'The Science Behind It', 'Who Should Try This')"),
  mentionedProducts: z.array(
    z.object({
      name: z.string().describe("Product or ingredient name mentioned"),
      reason: z.string().describe("Why the expert mentioned it — recommended, warned against, compared, etc."),
    })
  ).describe("Products or ingredients specifically discussed in the video"),
});

export type ExpertVideoAnalysis = z.infer<typeof expertVideoSchema>;

/**
 * Analyze a YouTube expert video transcript using Gemini.
 * Retries up to 3 times with exponential backoff for rate limit errors.
 */
export async function analyzeExpertVideo(
  transcript: string,
  originalTitle?: string
): Promise<ExpertVideoAnalysis> {
  const trimmed = transcript.slice(0, 10000);

  const prompt = `You are a pharmacist content analyst for a health & beauty website targeting 20-30 year old Americans.

Analyze the following YouTube video transcript and produce a structured analysis.

${originalTitle ? `Original video title: "${originalTitle}"` : ""}

Guidelines:
- Write in a conversational but authoritative tone — like a smart friend who happens to be a pharmacist
- The title should be catchy and click-worthy (e.g., "Stop Wasting Money on These Supplements", "The SPF Mistake Everyone Makes")
- Summary should be 150-200 words, consumer-friendly, no jargon
- Key takeaways should be actionable and scannable
- Analysis sections should break down the expert's advice into digestible chunks
- For mentioned products: capture both recommended AND warned-against items
- Identify the expert's name and credentials from context clues in the transcript

TRANSCRIPT:
${trimmed}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
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
        // Wait 20s+ for Gemini free tier rate limit reset
        await new Promise((r) => setTimeout(r, 25000));
      }
    }
  }

  throw new Error(
    `Failed after 3 attempts. Last error: ${lastError?.message}`
  );
}
