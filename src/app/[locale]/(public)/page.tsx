import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Pill,
  Sparkles,
  FileText,
  MessageCircleQuestion,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPublishedTrendsWithHeadline, type TrendTopicRow } from "@/lib/actions/trends";
import { listPublishedExpertPicks } from "@/lib/actions/expert-picks";
import { listPublicConsults, type ConsultRecord } from "@/lib/actions/consults";
import { HomeSearchBar } from "@/components/home/home-search-bar";
import { ExpertPickCard } from "@/components/expert/expert-pick-card";
import { TrendCover } from "@/components/trending/trend-cover";
import { ConsultMobileCta } from "@/components/consult/consult-mobile-cta";
import { createClient } from "@/lib/supabase/server";
import type { ConsultDraft } from "@/lib/ai/draft-consult";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const metadata: Metadata = {
  title: "AI PharmCare — Pharmacist-Reviewed Supplements, OTC & Skincare",
  description:
    "Real pharmacist analysis of trending supplements, OTC medications, and skincare. Backed by FDA data, PubMed research, and ingredient science. Is it worth the hype? We read the science so you don't have to.",
  keywords: [
    "pharmacist reviews",
    "supplement analysis",
    "OTC medication guide",
    "skincare ingredients",
    "is it safe",
    "worth the hype",
    "FDA reviewed",
  ],
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "AI PharmCare — Pharmacist-Reviewed Health & Beauty Analysis",
    description:
      "Real pharmacist analysis of trending products. FDA data + PubMed research + ingredient science. Find out what's worth the hype.",
    url: `${SITE_URL}/`,
    type: "website",
    siteName: "AI PharmCare",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "AI PharmCare — Pharmacist-Reviewed Health & Beauty Analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI PharmCare — Is It Worth the Hype?",
    description:
      "Pharmacist-reviewed supplements, OTC meds, and skincare. Science-backed answers.",
  },
};

export default async function Home() {
  const supabase = await createClient();
  const [trends, expertPicks, publicConsults, { data: { user } }] = await Promise.all([
    listPublishedTrendsWithHeadline(3),
    listPublishedExpertPicks(3),
    listPublicConsults({ limit: 6 }),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero — compact, search-focused */}
      <section className="bg-gradient-to-b from-primary/5 to-background pb-2 pt-6">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="flex items-center justify-center gap-2">
            <Pill className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI PharmCare
            </h1>
          </div>
          <p className="mt-3 text-lg text-muted-foreground">
            We read the science so you don&apos;t have to
          </p>

          {/* Hero search bar */}
          <div className="mx-auto mt-6 max-w-xl">
            <HomeSearchBar />
          </div>
        </div>
      </section>

      {/* Worth the Hype? — Trending topics */}
      <section id="worth-the-hype" className="scroll-mt-24 pb-2 pt-4">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              Worth the Hype?
            </h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/trending" />}
            >
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {trends.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trends.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <TrendingUp className="mx-auto h-8 w-8 opacity-50" />
              <p className="mt-2">No trends published yet.</p>
              <p className="text-sm">
                Check back soon — new trends are analyzed weekly.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Dr.'s Analysis — Expert-analyzed content from video sources */}
      <section id="drs-analysis" className="scroll-mt-24 pb-2 pt-4">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <FileText className="h-5 w-5 text-primary" />
              Dr.&apos;s Analysis
            </h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/expert" />}
            >
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {expertPicks.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {expertPicks.map((pick) => (
                <ExpertPickCard
                  key={pick.slug}
                  slug={pick.slug}
                  title={pick.title}
                  category={pick.category}
                  thumbnailUrl={pick.thumbnailUrl}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 opacity-50" />
              <p className="mt-2">Expert analyses coming soon.</p>
              <p className="text-sm">
                Pharmacist-reviewed video breakdowns are being curated.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Mobile-only Consult CTA — sits right above Community Q&A so the
          ask flow is colocated with the public answers gallery. Desktop
          users already see ConsultSidebar in the layout. */}
      <ConsultMobileCta isAuthed={!!user} />

      {/* Community Q&A — public pharmacist-reviewed consults */}
      {publicConsults.length > 0 && (
        <section id="community-qa" className="scroll-mt-24 pb-2 pt-4">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <MessageCircleQuestion className="h-5 w-5 text-primary" />
                Community Q&amp;A
              </h2>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/ask" />}
              >
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Real questions from customers, answered by Younghun Cho, PharmD.
            </p>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {publicConsults.slice(0, 4).map((c) => (
                <CommunityQaCard key={c.id} consult={c} />
              ))}
            </ul>
          </div>
        </section>
      )}

    </div>
  );
}

function TrendCard({ trend }: { trend: TrendTopicRow & { headline?: string | null } }) {
  if (!trend.slug) return null;

  return (
    <Link
      href={`/trending/${trend.slug}`}
      className="group block overflow-hidden rounded-lg border transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Cover — real photo if present, else branded AI PharmCare cover */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {trend.imageUrl ? (
          <img
            src={trend.imageUrl}
            alt={trend.headline ?? trend.queryText}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <TrendCover category={trend.category ?? "health"} />
        )}
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <TrendingUp className="mr-1 h-3 w-3" />
            {trend.rankType === "rising" ? "Rising" : "Top"}
          </Badge>
          <Badge
            variant="secondary"
            className="text-xs"
          >
            {trend.category === "health" ? "Health" : "Beauty"}
          </Badge>
          {!trend.pharmacistReviewed && (
            <Badge
              variant="outline"
              className="border-amber-300 text-xs text-amber-700"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              AI
            </Badge>
          )}
        </div>

        <h3 className="mt-3 font-semibold leading-snug group-hover:text-primary">
          {trend.headline ?? trend.queryText}
        </h3>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>~1 min read</span>
          <span>·</span>
          <span>Week of {trend.detectedWeek}</span>
        </div>
      </div>
    </Link>
  );
}

const CONSULT_CATEGORY_LABEL: Record<string, string> = {
  drug_interactions: "Drug Interactions",
  skin_care: "Skin Care",
  supplements: "Supplements",
  symptoms: "Symptoms",
  pregnancy: "Pregnancy",
  pediatric: "Pediatric",
  mental_health: "Mental Health",
  general: "General",
};

function CommunityQaCard({ consult }: { consult: ConsultRecord }) {
  if (!consult.slug) return null;
  const final = consult.pharmacistFinal as ConsultDraft | null;
  const questionText =
    typeof consult.rawInput.text === "string"
      ? consult.rawInput.text
      : "Pharmacist-reviewed answer";
  const summary = final?.oneLineSummary ?? "";
  const categoryLabel =
    CONSULT_CATEGORY_LABEL[consult.category] ?? "General";

  return (
    <li>
      <Link
        href={`/ask/${consult.slug}`}
        className="group flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
      >
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {categoryLabel}
          </Badge>
          <Badge className="gap-1 bg-primary/15 text-[10px] text-primary hover:bg-primary/20">
            <ShieldCheck className="h-2.5 w-2.5" />
            Pharmacist Reviewed
          </Badge>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
          {questionText.slice(0, 140)}
        </h3>
        {summary && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {summary}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
          Read answer
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}
