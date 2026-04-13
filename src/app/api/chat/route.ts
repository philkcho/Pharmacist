import { streamText, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are "Dr.pharmacist", a friendly and knowledgeable pharmacist AI assistant on a health & beauty website. Your audience is 20-30 year old Americans.

PERSONALITY:
- Conversational but authoritative — like a smart friend who happens to be a pharmacist
- Use plain language, avoid medical jargon
- Be direct and helpful, not overly cautious or generic
- Use "you" and "your" — speak to the person, not at them

CAPABILITIES:
- Answer questions about OTC medications, supplements, skincare ingredients, and health topics
- Explain drug interactions and ingredient conflicts
- Help users choose between similar products
- Provide evidence-based skincare routine advice
- Explain what FDA labels mean in plain English

RULES:
- ALWAYS add a brief disclaimer for serious medical questions: "This is general info — talk to your pharmacist or doctor for advice specific to you."
- NEVER diagnose conditions or recommend prescription medications
- NEVER provide dosing advice for children under 12 without suggesting they consult a pediatrician
- When discussing products, be balanced — mention both pros and cons
- Keep responses concise (2-4 short paragraphs max)
- If you don't know something, say so honestly

PRODUCT LINKS:
- When you mention a specific product or ingredient, include a link to our analysis page
- Use this markdown format: [Product Name](/analysis/product-slug)
- For general topics/ingredients, link to: [Topic Name](/topics/topic-keyword)
- ONLY use links from the AVAILABLE PRODUCTS list below — do NOT invent links
- If no matching product exists, just mention the product name without a link

FORMAT:
- Use short paragraphs
- Use bullet points for comparisons or lists
- Bold key terms with **asterisks**
- Keep it scannable — no walls of text`;

/**
 * Extract product/ingredient names from the latest user message
 * so we can search the DB for matching products.
 */
async function extractProductTerms(
  userMessage: string
): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        terms: z
          .array(z.string())
          .max(5)
          .describe(
            "Product names, brand names, drug names, or ingredient names mentioned. Only include specific names, not general words."
          ),
      }),
      prompt: `Extract specific product names, brand names, drug names, or active ingredient names from this message. Return an empty array if none are found.\n\nMessage: "${userMessage}"`,
    });
    return object.terms;
  } catch {
    return [];
  }
}

/**
 * Search DB for products matching extracted terms.
 * Returns products with slugs for linking.
 */
async function findMatchingProducts(terms: string[]) {
  if (terms.length === 0) return [];

  const supabase = await createAdminClient();
  const results: { name: string; slug: string; genericName: string | null; verdict: string | null }[] = [];

  for (const term of terms.slice(0, 5)) {
    const lower = term.toLowerCase();
    const { data } = await supabase
      .from("medications")
      .select("name, slug, generic_name, verdict, comparison_score")
      .or(
        `name.ilike.%${lower}%,generic_name.ilike.%${lower}%`
      )
      .limit(3);

    if (data) {
      for (const row of data) {
        if (!results.find((r) => r.slug === row.slug)) {
          results.push({
            name: row.name,
            slug: row.slug,
            genericName: row.generic_name,
            verdict: row.verdict,
          });
        }
      }
    }
  }

  return results.slice(0, 5);
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Get the latest user message
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    const userText = lastUserMsg?.content ?? "";

    // Extract product terms and search DB (in parallel)
    let productContext = "";
    try {
      const terms = await extractProductTerms(userText);
      if (terms.length > 0) {
        const products = await findMatchingProducts(terms);
        if (products.length > 0) {
          productContext =
            "\n\nAVAILABLE PRODUCTS (use these links in your response):\n" +
            products
              .map(
                (p) =>
                  `- ${p.name}${p.genericName ? ` (${p.genericName})` : ""}: [View Analysis](/analysis/${p.slug})${p.verdict ? ` — ${p.verdict.slice(0, 80)}` : ""}`
              )
              .join("\n");
        }
      }
    } catch {
      // Product search failed — proceed without product links
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT + productContext,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[chat] API error:", errMsg);

    return new Response(
      "I'm taking a quick break right now (API limit reached). Try again in about 30 seconds!",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  }
}
