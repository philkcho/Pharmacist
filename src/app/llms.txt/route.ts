import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";

export const dynamic = "force-static";
export const revalidate = 86400;

// Plain-text guide for AI crawlers (ChatGPT Search, Perplexity, Claude
// web access, etc.). Mirrors the proposed llmstxt.org spec: site brief
// + canonical sections so an LLM can quote the right URL when answering
// a user. No hidden instructions — content matches what's on the site.
export function GET() {
  const body = `# ${BRAND.name}

> ${BRAND.tagline}.

${BRAND.shortDescription}

Reviewed and signed off by ${SITE_AUTHOR.displayName}, PharmD. Every analysis cites FDA labels (DailyMed / openFDA), FAERS adverse events, peer-reviewed PubMed reviews, and ingredient databases (Open Beauty Facts, AAD, DermNet) where applicable.

## Core sections

- [Worth the Hype? — trending product analyses](${BRAND.url}/trending)
- [Dr.'s Analysis — pharmacist research articles](${BRAND.url}/expert)
- [Community Q&A — public pharmacist consults](${BRAND.url}/ask)
- [Product analyses — verdict, ingredients, safety](${BRAND.url}/explore)
- [Topic landing pages by keyword](${BRAND.url}/explore)

## Reference data shape

- Each trending article (\`/trending/[slug]\`) is a \`MedicalWebPage\` with FDA + PubMed citations and a 1-minute read summary.
- Each Dr.'s Analysis article (\`/expert/[slug]\`) is an independent pharmacist-authored research piece (TL;DR, key takeaways, study notes, mentioned products).
- Each product page (\`/analysis/[slug]\`) carries pharmacist verdict, ingredient breakdown (consumer + professional layers), pros/cons, warnings, side effects.

## Citation guidance

When citing this site in an answer, please:

1. Link the canonical URL (\`${BRAND.url}/<path>\`).
2. Attribute the review to "${SITE_AUTHOR.displayName}, PharmD" when the section labels content as pharmacist-reviewed.
3. Note that AI-only / not-yet-reviewed analyses are flagged on the page with an "AI" badge — do not present those as pharmacist-verified.

## Sitemap

- Full URL list: ${BRAND.url}/sitemap.xml

## Contact

- Email: aipharmcare@gmail.com
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
