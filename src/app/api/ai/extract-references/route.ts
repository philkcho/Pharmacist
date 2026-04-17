import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const ReferencesSchema = z.object({
  references: z
    .array(
      z.object({
        title: z.string().describe("Full title of the study, guideline, or article"),
        url: z.string().describe("URL to the source. Use real PubMed/FDA/CDC URLs when possible"),
        sourceType: z
          .enum(["pubmed", "fda", "cdc", "who", "other"])
          .describe("Type of source"),
      })
    )
    .describe("List of suggested authoritative references"),
});

export async function POST(req: Request) {
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-pro"),
      maxRetries: 0,
      schema: ReferencesSchema,
      system: `You are a medical research librarian helping a pharmacist find authoritative references for an OTC medication article.

Your task: analyze the article content and suggest 3-6 high-quality, real references that support the claims made.

Prioritize:
1. PubMed studies (https://pubmed.ncbi.nlm.nih.gov/...)
2. FDA drug labels and guidelines (https://www.fda.gov/...)
3. CDC recommendations (https://www.cdc.gov/...)
4. WHO guidelines (https://www.who.int/...)
5. Other reputable medical sources

Important:
- Use REAL, well-known studies and guidelines that actually exist
- Provide accurate titles
- Use real URLs (don't fabricate PubMed IDs)
- If you're not sure of an exact URL, use a general topic page rather than guessing
- Focus on references that directly support the medications and claims in the article`,
      prompt: `Analyze this OTC medication article and suggest authoritative references:

---
${content}
---

Suggest 3-6 real, high-quality references.`,
    });

    return NextResponse.json(object);
  } catch (err) {
    console.error("[extract-references] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to extract references" },
      { status: 500 }
    );
  }
}
