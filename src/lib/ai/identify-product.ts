import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

/**
 * Structured output from the vision identification call.
 *
 * `confidence` is the most important field — we gate the downstream
 * DB/FDA lookup on it. "none" means Gemini couldn't read the label
 * reliably and we should not pretend we know what the product is.
 */
export const ProductIdentificationSchema = z.object({
  productName: z
    .string()
    .describe(
      "Best brand or generic name visible on the packaging. Empty string if unreadable."
    ),
  alternateNames: z
    .array(z.string())
    .describe("Other likely names or variants (optional)."),
  category: z
    .string()
    .describe(
      "Rough category guess, e.g. 'Pain Relief', 'Allergy', 'Vitamins', 'Skin Care'. Empty if unsure."
    ),
  confidence: z
    .enum(["high", "medium", "low", "none"])
    .describe(
      "How confident the identification is. 'high' = label is clearly readable; 'none' = image does not show an OTC product or label is unreadable."
    ),
  reasoning: z
    .string()
    .describe(
      "Short explanation of what you see (visible text, packaging cues). One or two sentences."
    ),
});

export type ProductIdentification = z.infer<typeof ProductIdentificationSchema>;

const SYSTEM_PROMPT = `You are a clinical pharmacist identifying an over-the-counter (OTC) medication, supplement, or cosmetic from a user-submitted photo.

Rules:
- Focus ONLY on visible text and packaging details (brand name, generic name, active ingredient, dosage, manufacturer).
- If the image does not clearly show an OTC product, or the label is blurry / partial / unreadable, set confidence to "none" and leave productName empty. Do NOT guess.
- Prefer the brand name (e.g. "Tylenol Extra Strength") over the generic name when both are visible, because our database keys off brand.
- Never fabricate product names. If you can only read part of the label, report what you see in the reasoning field, not as a productName.
- Be concise — one or two sentences of reasoning is enough.`;

/**
 * Ask Gemini Flash multimodal to identify an OTC product from a user-
 * uploaded image. Returns a structured identification result.
 *
 * Uses maxRetries: 0 to avoid burning the free-tier quota on 429s —
 * same policy as the other AI routes in this project.
 */
export async function identifyProductFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ProductIdentification> {
  const { object } = await generateObject({
    model: google("gemini-2.5-pro"),
    maxRetries: 0,
    schema: ProductIdentificationSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: SYSTEM_PROMPT },
          {
            type: "image",
            image: `data:${mimeType};base64,${imageBase64}`,
          },
        ],
      },
    ],
  });
  return object;
}
