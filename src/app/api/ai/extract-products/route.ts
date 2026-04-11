import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const ProductsSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().describe("Brand name (e.g. Tylenol, Advil)"),
        genericName: z.string().describe("Generic/active ingredient name"),
        pros: z.array(z.string()).describe("3-5 key advantages, each as a short phrase"),
        cons: z.array(z.string()).describe("2-4 key drawbacks or warnings, each as a short phrase"),
        verdict: z
          .string()
          .describe("1-2 sentence pharmacist's verdict on when this product is best"),
        recommended: z
          .boolean()
          .describe("Whether this is recommended by the pharmacist as a top choice"),
      })
    )
    .describe("List of OTC medications mentioned in the article with structured analysis"),
});

export async function POST(req: Request) {
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      maxRetries: 0,
      schema: ProductsSchema,
      system: `You are a licensed pharmacist (PharmD) extracting structured product analysis from an OTC medication article.

Your task: identify all OTC medications mentioned in the article and provide a structured analysis card for each.

For each product:
- Use the actual brand name and generic name
- Provide 3-5 SHORT pros (each 2-6 words)
- Provide 2-4 SHORT cons or warnings (each 2-6 words)
- Write a 1-2 sentence verdict on when it's the best choice
- Mark as "recommended: true" if it's a top choice for the article's main topic, false if it's a secondary mention

Important:
- Only include OTC medications, not prescription drugs
- If the article focuses on a specific category, only extract products in that category
- Maximum 6 products
- Use accurate medication information`,
      prompt: `Extract structured product analysis cards from this OTC medication article:

---
${content}
---

Return up to 6 products with structured pros, cons, verdict, and recommendation status.`,
    });

    return NextResponse.json(object);
  } catch (err) {
    console.error("[extract-products] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to extract products" },
      { status: 500 }
    );
  }
}
