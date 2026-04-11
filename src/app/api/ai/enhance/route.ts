import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { content, instruction } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash"),
    maxRetries: 0,
    system: `You are a licensed pharmacist (PharmD) editing an OTC medication recommendation article for a health website called "Dr.pharmacist."

Your task: apply the user's instruction to modify or enhance the existing article content.

Rules:
- Maintain the same professional yet accessible tone
- Keep all existing content unless told to remove something
- Use markdown formatting: ## for sections, ### for subsections, **bold** for drug names
- Focus on OTC medications only
- Include safety warnings where appropriate
- If adding references, use [numbered] citation format
- Return the FULL updated article, not just the changed parts`,
    prompt: `Here is the current article content:

---
${content}
---

Instruction from the pharmacist: "${instruction}"

Apply the instruction and return the full updated article in markdown format.`,
  });

  return result.toTextStreamResponse();
}
