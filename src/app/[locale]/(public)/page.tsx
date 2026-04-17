import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Pill,
  Sparkles,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPublishedTrendsWithHeadline, type TrendTopicRow } from "@/lib/actions/trends";
import { listPublishedExpertPicks } from "@/lib/actions/expert-picks";
import { HomeSearchBar } from "@/components/home/home-search-bar";



export default async function Home() {
  const [trends, expertPicks] = await Promise.all([
    listPublishedTrendsWithHeadline(3),
    listPublishedExpertPicks(3),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero — compact, search-focused */}
      <section className="bg-gradient-to-b from-primary/5 to-background pb-2 pt-6">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="flex items-center justify-center gap-2">
            <Pill className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Dr.pharmacist
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

      {/* Dr.'s Analysis — Expert-analyzed content from video sources */}
      <section className="pb-2 pt-4">
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
              {expertPicks.map((pick) => {
                const categoryLabel =
                  pick.category === "health"
                    ? "Health"
                    : pick.category === "skin-care"
                      ? "Skin Care"
                      : "Wellness";
                return (
                  <Link
                    key={pick.slug}
                    href={`/expert/${pick.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    {/* Info — title prominent on top */}
                    <div className="p-4">
                      <Badge variant="secondary" className="mb-2 text-xs">
                        {categoryLabel}
                      </Badge>
                      <h3 className="line-clamp-3 font-semibold leading-snug group-hover:text-primary">
                        {pick.title}
                      </h3>
                    </div>
                    {/* Compact Dr.pharmacist brand strip */}
                    <div className="mt-auto flex items-center justify-center gap-1.5 border-t bg-primary/5 px-3 py-2">
                      <Pill className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Dr.&apos;s Analysis
                      </span>
                    </div>
                  </Link>
                );
              })}
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

      {/* Worth the Hype? — Trending topics */}
      <section className="py-2">
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
      {/* Cover image */}
      {trend.imageUrl && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          <img
            src={trend.imageUrl}
            alt={trend.headline ?? trend.queryText}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

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
