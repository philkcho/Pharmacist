import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  FlaskConical,
  ShoppingCart,
  NotebookPen,
  Pill,
} from "lucide-react";
import Link from "next/link";
import {
  getExpertPickBySlug,
  getOrGenerateExpertComparison,
  fetchComparisonProducts,
} from "@/lib/actions/expert-picks";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleJsonLd, BreadcrumbListJsonLd } from "@/components/seo/json-ld";
import { ReferencesSection } from "@/components/seo/references-section";
import { ReviewerByline } from "@/components/ui/reviewer-byline";
import { ArticleHero } from "@/components/expert/article-hero";
import {
  ArticleToc,
  ArticleTocMobile,
  type TocItem,
} from "@/components/expert/article-toc";
import { ReviewerCard } from "@/components/expert/reviewer-card";
import { ProductsAtAGlance } from "@/components/expert/products-at-a-glance";

interface ExpertDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ExpertDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const pick = await getExpertPickBySlug(slug);
  if (!pick) return { title: "Not Found" };

  const title = pick.title;
  const description = pick.summary?.slice(0, 160) ?? "";
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/expert/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      ...(pick.thumbnailUrl
        ? { images: [{ url: pick.thumbnailUrl, width: 1200, height: 675 }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(pick.thumbnailUrl ? { images: [pick.thumbnailUrl] } : {}),
    },
  };
}

export default async function ExpertDetailPage({ params }: ExpertDetailProps) {
  const { slug } = await params;
  const pick = await getExpertPickBySlug(slug);

  if (!pick || pick.status !== "published") {
    notFound();
  }

  const categoryLabel =
    pick.category === "health"
      ? "Health"
      : pick.category === "skin-care"
        ? "Skin Care"
        : "Wellness";

  const readMinutes = Math.max(
    1,
    Math.round(
      ((pick.summary?.length ?? 0) +
        (pick.analysisSections?.reduce((sum, s) => sum + s.content.length, 0) ??
          0)) /
        1000
    )
  );

  const expertUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/expert/${slug}`;

  // "Products at a Glance" — lazy-generated, skipped when <2 products.
  const mentionedSlugs =
    pick.mentionedProducts
      ?.map((m) => m.slug)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .slice(0, 5) ?? [];
  const [comparison, comparisonProducts] =
    mentionedSlugs.length >= 2
      ? await Promise.all([
          getOrGenerateExpertComparison(slug),
          fetchComparisonProducts(mentionedSlugs),
        ])
      : [null, []];
  const showComparison =
    comparison !== null && comparisonProducts.length >= 2;

  // Build TOC — only include sections that will actually render.
  const tocItems: TocItem[] = [];
  if (pick.summary) tocItems.push({ id: "summary", label: "Summary" });
  if (pick.keyTakeaways && pick.keyTakeaways.length > 0) {
    tocItems.push({ id: "takeaways", label: "Key takeaways" });
  }
  if (pick.analysisSections) {
    pick.analysisSections.forEach((s, i) => {
      tocItems.push({ id: `section-${i}`, label: s.title });
    });
  }
  if (pick.properNotes && pick.properNotes.length > 0) {
    tocItems.push({ id: "notes", label: "Study notes" });
  }
  if (pick.mentionedProducts && pick.mentionedProducts.length > 0) {
    tocItems.push({ id: "products", label: "Products mentioned" });
  }
  if (showComparison) {
    tocItems.push({ id: "comparison", label: "At a glance" });
  }
  if (pick.references && pick.references.length > 0) {
    tocItems.push({ id: "references", label: "References" });
  }

  const lastReviewedAt = pick.publishedAt ?? pick.createdAt;

  return (
    <article>
      <ArticleJsonLd
        title={pick.title}
        description={pick.summary?.slice(0, 200) ?? ""}
        url={expertUrl}
        datePublished={pick.publishedAt}
        dateModified={pick.createdAt}
        imageUrl={pick.thumbnailUrl}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/` },
          { name: "Dr.'s Analysis", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/expert` },
          { name: pick.title, url: expertUrl },
        ]}
      />

      {/* Full-bleed hero */}
      <ArticleHero
        title={pick.title}
        category={pick.category}
        categoryLabel={categoryLabel}
        readMinutes={readMinutes}
        thumbnailUrl={pick.thumbnailUrl}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        {/* Back link + byline strip */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <Link
            href="/expert"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Dr.&apos;s Analysis
          </Link>
          <ReviewerByline lastReviewedAt={lastReviewedAt} />
        </div>

        {/* TOC grid: sticky sidebar on desktop, details fallback on mobile */}
        <div className="gap-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-16">
          {tocItems.length > 0 && <ArticleToc items={tocItems} />}

          <div className="min-w-0">
            {tocItems.length > 0 && <ArticleTocMobile items={tocItems} />}

            {/* Summary — elevated lead */}
            {pick.summary && (
              <section id="summary" className="mb-10 scroll-mt-24">
                <div className="rounded-xl border-l-4 border-primary bg-muted/30 p-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    Summary
                  </p>
                  <p className="text-lg italic leading-relaxed text-foreground/90">
                    {pick.summary}
                  </p>
                </div>
              </section>
            )}

            {/* Key Takeaways */}
            {pick.keyTakeaways && pick.keyTakeaways.length > 0 && (
              <section id="takeaways" className="mb-12 scroll-mt-24">
                <SectionHeading>Key Takeaways</SectionHeading>
                <ul className="space-y-3">
                  {pick.keyTakeaways.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Analysis Sections — article body */}
            {pick.analysisSections && pick.analysisSections.length > 0 && (
              <div className="mb-12 space-y-10">
                {pick.analysisSections.map((section, i) => (
                  <section
                    key={i}
                    id={`section-${i}`}
                    className="scroll-mt-24"
                  >
                    <SectionHeading>{section.title}</SectionHeading>
                    <p
                      className={`leading-[1.75] text-foreground/85 ${
                        i === 0 ? "text-lg text-foreground/90" : ""
                      }`}
                    >
                      {section.content}
                    </p>
                  </section>
                ))}
              </div>
            )}

            {/* Proper Notes */}
            {pick.properNotes && pick.properNotes.length > 0 && (
              <section id="notes" className="mb-12 scroll-mt-24">
                <SectionHeading icon={NotebookPen}>Study Notes</SectionHeading>
                <div className="rounded-xl border bg-muted/20 p-6">
                  {pick.properNotes.map((note, i) => (
                    <div key={i} className={i > 0 ? "mt-6" : ""}>
                      <h3 className="mb-2 font-semibold">{note.heading}</h3>
                      <ul className="space-y-1.5 pl-4">
                        {note.bullets.map((bullet, j) => (
                          <li
                            key={j}
                            className="list-disc text-sm leading-relaxed"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Mentioned Products — core CTA section */}
            {pick.mentionedProducts && pick.mentionedProducts.length > 0 && (
              <section id="products" className="mb-12 scroll-mt-24">
                <SectionHeading icon={FlaskConical}>
                  Products Mentioned
                </SectionHeading>
                <p className="mb-5 text-sm text-muted-foreground">
                  Analyzed by AI PharmCare — tap through for the ingredient
                  breakdown or shop across retailers.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {pick.mentionedProducts.map((product, i) => (
                    <ProductCard
                      key={i}
                      product={product}
                      fromSlug={pick.slug}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Products at a Glance — AI-generated N-product comparison */}
            {showComparison && comparison && (
              <section id="comparison" className="mb-12 scroll-mt-24">
                <ProductsAtAGlance
                  products={comparisonProducts}
                  comparison={comparison}
                />
              </section>
            )}

            {/* References — regulator + peer-reviewed sources */}
            {pick.references && pick.references.length > 0 && (
              <div id="references" className="scroll-mt-24">
                <ReferencesSection
                  references={pick.references}
                  className="mt-10"
                />
              </div>
            )}

            {/* About the Reviewer — editorial authority re-anchor */}
            <ReviewerCard lastReviewedAt={lastReviewedAt} className="mt-14" />

            {/* Disclosure */}
            <p className="mt-8 border-t pt-6 text-xs text-muted-foreground">
              This analysis was AI-drafted and reviewed for accuracy. Always
              consult your pharmacist or healthcare provider for personalized
              advice. Product links may earn us a small commission at no extra
              cost to you.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

// Small accent-bar heading used across every major body section
// (Key Takeaways, analysisSections H2s, Study Notes, Products).
// A 2px primary bar above the title gives every section a consistent
// editorial marker without leaning on loud background boxes.
function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: typeof FlaskConical;
}) {
  return (
    <div className="mb-4">
      <div className="mb-3 h-0.5 w-10 bg-primary" />
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        {children}
      </h2>
    </div>
  );
}

function ProductCard({
  product,
  fromSlug,
}: {
  product: {
    name: string;
    slug?: string;
    reason: string;
    shopKeyword?: string;
    imageUrl?: string | null;
  };
  fromSlug: string;
}) {
  const analysisHref = product.slug
    ? `/analysis/${product.slug}`
    : `/search?q=${encodeURIComponent(product.name)}`;
  // Shop link → /topics/[keyword]?from=[expertSlug]
  // The topics page uses `from` to fetch this expert pick's mentioned
  // products and list them at the top, so the user sees exactly what was
  // referenced on the previous page.
  const shopHref = product.shopKeyword
    ? `/topics/${encodeURIComponent(product.shopKeyword)}?from=${encodeURIComponent(fromSlug)}`
    : `/search?q=${encodeURIComponent(product.name)}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-lg border bg-muted object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted">
            <Pill className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold leading-snug">{product.name}</h3>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {product.reason}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={analysisHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <FlaskConical className="h-4 w-4" />
          View Analysis
        </Link>
        <Link
          href={shopHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
        >
          <ShoppingCart className="h-4 w-4" />
          Shop Options
        </Link>
      </div>
    </div>
  );
}
