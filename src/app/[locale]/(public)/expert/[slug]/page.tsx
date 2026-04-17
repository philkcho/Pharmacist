import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  FlaskConical,
  ShoppingCart,
  Clock,
  FileText,
  NotebookPen,
  Zap,
  Pill,
} from "lucide-react";
import Link from "next/link";
import { getExpertPickBySlug } from "@/lib/actions/expert-picks";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleJsonLd, BreadcrumbListJsonLd } from "@/components/seo/json-ld";

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
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com"}/expert/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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

  const expertUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com"}/expert/${slug}`;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ArticleJsonLd
        title={pick.title}
        description={pick.summary?.slice(0, 200) ?? ""}
        url={expertUrl}
        datePublished={pick.publishedAt}
        dateModified={pick.createdAt}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com"}/` },
          { name: "Dr.'s Analysis", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com"}/expert` },
          { name: pick.title, url: expertUrl },
        ]}
      />
      {/* Back link */}
      <Link
        href="/expert"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Dr.&apos;s Analysis
      </Link>

      {/* Header */}
      <header className="mb-8">
        <Badge variant="secondary" className="mb-3">
          {categoryLabel}
        </Badge>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {pick.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs">~{readMinutes} min read</span>
          </div>
        </div>
      </header>


      {/* Popular Features — at-a-glance feature tiles */}
      <section className="mb-10 rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:from-amber-950/20 dark:to-orange-950/20">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20">
            <Zap className="h-4 w-4 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold">Popular Features</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FeatureTile
            href="#summary"
            icon={FileText}
            title="Summary"
            description="Jump to overview"
            available={!!pick.summary}
          />
          <FeatureTile
            href="#notes"
            icon={NotebookPen}
            title="Study Notes"
            description="Jump to notes"
            available={!!pick.properNotes?.length}
          />
          <FeatureTile
            href="#products"
            icon={FlaskConical}
            title="Products Mentioned"
            description="Jump to products"
            available={
              !!pick.mentionedProducts && pick.mentionedProducts.length > 0
            }
          />
        </div>
      </section>

      {/* Summary (TL;DR) */}
      {pick.summary && (
        <section id="summary" className="mb-10 scroll-mt-20">
          <div className="rounded-xl border-l-4 border-primary bg-muted/30 p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              TL;DR
            </p>
            <p className="leading-relaxed text-foreground/90">{pick.summary}</p>
          </div>
        </section>
      )}

      {/* Key Takeaways */}
      {pick.keyTakeaways && pick.keyTakeaways.length > 0 && (
        <section id="takeaways" className="mb-10">
          <h2 className="mb-4 text-xl font-bold">Key Takeaways</h2>
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
        <div className="mb-10 space-y-8">
          {pick.analysisSections.map((section, i) => (
            <section key={i}>
              <h2 className="mb-3 text-xl font-bold">{section.title}</h2>
              <p className="leading-relaxed text-foreground/85">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      )}

      {/* Proper Notes */}
      {pick.properNotes && pick.properNotes.length > 0 && (
        <section id="notes" className="mb-10 scroll-mt-20">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <NotebookPen className="h-5 w-5 text-primary" />
            Study Notes
          </h2>
          <div className="rounded-xl border bg-muted/20 p-5">
            {pick.properNotes.map((note, i) => (
              <div key={i} className={i > 0 ? "mt-5" : ""}>
                <h3 className="mb-2 font-semibold">{note.heading}</h3>
                <ul className="space-y-1.5 pl-4">
                  {note.bullets.map((bullet, j) => (
                    <li key={j} className="list-disc text-sm leading-relaxed">
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
        <section
          id="products"
          className="mb-10 scroll-mt-20 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FlaskConical className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Products Mentioned</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyzed by Dr.pharmacist — click to see ingredient breakdown or
              shop
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pick.mentionedProducts.map((product, i) => (
              <ProductCard
                key={i}
                product={product}
                index={i}
                fromSlug={pick.slug}
              />
            ))}
          </div>
        </section>
      )}

      {/* Disclosure */}
      <section className="rounded-lg border bg-muted/20 p-5 text-xs text-muted-foreground">
        <p>
          This analysis was AI-generated and reviewed for accuracy. Always
          consult your pharmacist or healthcare provider for personalized
          advice. Product links may earn us a small commission at no extra cost
          to you.
        </p>
      </section>
    </article>
  );
}

function FeatureTile({
  href,
  icon: Icon,
  title,
  description,
  available,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  description: string;
  available: boolean;
}) {
  if (!available) {
    return (
      <div className="rounded-xl bg-background p-4 text-center opacity-40">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {description}
        </p>
      </div>
    );
  }

  return (
    <a
      href={href}
      className="group rounded-xl bg-background p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 transition-colors group-hover:bg-amber-200 dark:bg-amber-900/30 dark:group-hover:bg-amber-900/50">
        <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="text-sm font-semibold group-hover:text-primary">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
    </a>
  );
}

function ProductCard({
  product,
  index,
  fromSlug,
}: {
  product: {
    name: string;
    slug?: string;
    reason: string;
    shopKeyword?: string;
    imageUrl?: string | null;
  };
  index: number;
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
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
      {/* Header: number + image + name */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
          {index + 1}
        </div>
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
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {product.reason}
          </p>
        </div>
      </div>

      {/* Action buttons — clearly clickable */}
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
