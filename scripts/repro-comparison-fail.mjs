import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const env = readFileSync(".env.local", "utf8");
const p = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim();
process.env.GOOGLE_GENERATIVE_AI_API_KEY = p("GOOGLE_GENERATIVE_AI_API_KEY");
const s = createClient(
  p("NEXT_PUBLIC_SUPABASE_URL"),
  p("SUPABASE_SERVICE_ROLE_KEY"),
);

const ComparisonSchema = z.object({
  hook: z.string(),
  quickVerdict: z.object({
    winnerByUse: z
      .array(
        z.object({
          useCase: z.string(),
          winner: z.string(),
          why: z.string(),
        }),
      )
      .min(1)
      .max(6),
  }),
  sideBySide: z
    .array(
      z.object({
        dimension: z.string(),
        productA: z.string(),
        productB: z.string(),
      }),
    )
    .min(2)
    .max(8),
  prosCons: z.object({
    productAPros: z.array(z.string()).min(1).max(5),
    productACons: z.array(z.string()).max(4),
    productBPros: z.array(z.string()).min(1).max(5),
    productBCons: z.array(z.string()).max(4),
  }),
  bottomLine: z.string(),
});

const { data: excedrin } = await s
  .from("medications")
  .select(
    "name, slug, generic_name, active_ingredients, verdict, pros, cons, price_range, product_type",
  )
  .eq("slug", "excedrin-migraine")
  .single();
const { data: tylenol } = await s
  .from("medications")
  .select(
    "name, slug, generic_name, active_ingredients, verdict, pros, cons, price_range, product_type",
  )
  .eq("slug", "tylenol-extra-strength")
  .single();

function fmt(p, label) {
  const prosArr = Array.isArray(p.pros)
    ? p.pros.map((x) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean)
    : [];
  const consArr = Array.isArray(p.cons)
    ? p.cons.map((x) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean)
    : [];
  return `Product ${label}: ${p.name}
  Type: ${p.product_type}
  Generic: ${p.generic_name ?? ""}
  Active ingredients: ${(p.active_ingredients ?? []).join(", ")}
  Verdict: ${p.verdict ?? ""}
  Pros: ${prosArr.join("; ")}
  Cons: ${consArr.join("; ")}
  Price: ${p.price_range ?? ""}`;
}

const prompt = `You are a licensed US pharmacist writing a head-to-head comparison for consumers.

${fmt(excedrin, "A")}

${fmt(tylenol, "B")}

Write a "${excedrin.name} vs ${tylenol.name}" comparison. Rules:

1. **Pick winners per use case.** Don't hedge with "both are good". Specific wins drive SEO featured snippets.
2. **Ground claims in the data above.** Don't invent ingredients or features.
3. **US audience, plain English.** No jargon without explanation.
4. **Fair and evidence-based.**
5. **Pharmacist tone.** No hype.
6. **Practical bottom line.**

Generate all fields of the structured output.`;

console.log("=== Attempting Gemini generation ===");
try {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: ComparisonSchema,
    prompt,
    temperature: 0.4,
  });
  console.log("SUCCESS");
  console.log(JSON.stringify(object, null, 2));
} catch (err) {
  console.log("FAILED");
  console.log("name:", err?.name);
  console.log("message:", err?.message);
  console.log("cause:", err?.cause?.message ?? err?.cause);
  if (err?.cause?.issues) {
    console.log("zod issues:");
    err.cause.issues.forEach((i) =>
      console.log(`  path=${i.path?.join(".")} code=${i.code} msg=${i.message}`),
    );
  }
  console.log("text (preview):", String(err?.text ?? "").slice(0, 2000));
  console.log("responseText:", String(err?.response?.text ?? "").slice(0, 500));
}
