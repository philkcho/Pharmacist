import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck, ShoppingCart } from "lucide-react";

import { getPublicConsultBySlug } from "@/lib/actions/consults";
import { enrichRecommendations } from "@/lib/actions/consult-recommendations";
import { enrichDraftProductPicks } from "@/lib/actions/enrich-draft-picks";
import { Badge } from "@/components/ui/badge";
import { DraftBody } from "@/components/consult/draft-body";
import { PharmacistPickCard } from "@/components/consult/pharmacist-pick-card";
import { ReferencesSection } from "@/components/seo/references-section";
import { ReviewerByline } from "@/components/ui/reviewer-byline";
import { ArticleJsonLd, BreadcrumbListJsonLd } from "@/components/seo/json-ld";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import type { ArticleReference } from "@/lib/references/fetch-references";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

const CATEGORY_LABEL: Record<string, string> = {
  drug_interactions: "Drug Interactions",
  skin_care: "Skin Care",
  supplements: "Supplements",
  symptoms: "Symptoms",
  pregnancy: "Pregnancy",
  pediatric: "Pediatric",
  mental_health: "Mental Health",
  general: "General",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const consult = await getPublicConsultBySlug(slug);
  if (!consult) return { title: "Not found" };

  const final = consult.pharmacistFinal as ConsultDraft | null;
  const question =
    typeof consult.rawInput.text === "string"
      ? consult.rawInput.text.slice(0, 80)
      : "Pharmacist Q&A";
  const title = `${question} — Pharmacist Answer | Dr.pharmacist`;
  const description = (final?.oneLineSummary ?? question).slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: `/ask/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/ask/${slug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicConsultPage({ params }: PageProps) {
  const { slug } = await params;
  const consult = await getPublicConsultBySlug(slug);
  if (!consult) notFound();

  const final = consult.pharmacistFinal as ConsultDraft | null;
  if (!final) notFound();

  const references =
    (consult.aiReferences as ArticleReference[] | null) ?? [];
  const rawRecs =
    (consult.aiRecommendations as
      | {
          medicationId: number;
          name: string;
          slug: string;
          reason: string;
        }[]
      | null) ?? [];
  const recommendations = await enrichRecommendations(rawRecs);
  const enrichedPicks = await enrichDraftProductPicks(
    final.productRecommendations ?? []
  );

  const questionText =
    typeof consult.rawInput.text === "string"
      ? consult.rawInput.text
      : "(photo submission)";
  const categoryLabel = CATEGORY_LABEL[consult.category] ?? "General";
  const url = `${SITE_URL}/ask/${slug}`;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ArticleJsonLd
        title={questionText.slice(0, 110)}
        description={(final.oneLineSummary ?? "Pharmacist answer").slice(0, 200)}
        url={url}
        datePublished={consult.publishedAt ?? consult.createdAt}
        dateModified={consult.reviewedAt ?? consult.publishedAt ?? consult.createdAt}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Community Q&A", url: `${SITE_URL}/ask` },
          { name: questionText.slice(0, 60), url },
        ]}
      />

      <Link
        href="/ask"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Community Q&amp;A
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {categoryLabel}
        </Badge>
        <Badge className="gap-1 bg-primary/15 text-xs text-primary hover:bg-primary/20">
          <ShieldCheck className="h-3 w-3" />
          Pharmacist Reviewed
        </Badge>
      </div>

      {/* Question */}
      <section className="mt-4">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {questionText}
        </h1>
        {(consult.rawInput.photos?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {consult.rawInput.photos!.map((p, idx) => (
              <a
                key={idx}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-24 w-24 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90 sm:h-28 sm:w-28"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.alt ?? `Question photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Shared by a Dr.pharmacist community member
          {consult.publishedAt
            ? ` on ${formatDate(consult.publishedAt)}`
            : ""}
        </p>
      </section>

      {/* Pharmacist answer */}
      <section className="mt-6 rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <ShieldCheck className="h-4 w-4" />
          Pharmacist-Reviewed Answer
        </div>
        {consult.reviewedAt && (
          <ReviewerByline lastReviewedAt={consult.reviewedAt} />
        )}
        <DraftBody draft={final} enrichedPicks={enrichedPicks} className="mt-4" />
      </section>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Pharmacist&apos;s Picks</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((rec) => (
              <PharmacistPickCard key={rec.medicationId} recommendation={rec} />
            ))}
          </div>
        </section>
      )}

      {/* References */}
      {references.length > 0 && (
        <ReferencesSection references={references} className="mt-8" />
      )}

      {/* Disclosure */}
      <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        Educational guidance only, not a substitute for personal medical advice.
        Always consult your pharmacist or healthcare provider before starting a
        new medication.
      </p>
    </article>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
