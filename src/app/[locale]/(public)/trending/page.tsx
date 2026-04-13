import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { listPublishedTrendsWithHeadline, type TrendTopicRow } from "@/lib/actions/trends";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trending Health & Beauty Topics — Dr.pharmacist",
  description:
    "This week's trending OTC medication, supplement, and skincare topics analyzed by AI with pharmacist oversight.",
};

export default async function TrendingIndexPage() {
  const trends = await listPublishedTrendsWithHeadline(50);

  const healthTrends = trends.filter((t) => t.category === "health");
  const beautyTrends = trends.filter((t) => t.category === "beauty_fitness");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Trending This Week
        </h1>
        <p className="mt-2 text-muted-foreground">
          What people are searching for in health and beauty — analyzed by AI,
          reviewed by pharmacists.
        </p>
      </div>

      {trends.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <TrendingUp className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-2">No published trends yet.</p>
          <p className="text-sm">
            Check back after the weekly analysis pipeline runs.
          </p>
        </div>
      )}

      {healthTrends.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Health & Medication</h2>
          <div className="space-y-3">
            {healthTrends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        </section>
      )}

      {beautyTrends.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Beauty & Skincare</h2>
          <div className="space-y-3">
            {beautyTrends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
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
      href={`/en/trending/${trend.slug}`}
      className="group block rounded-lg border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-medium group-hover:text-blue-600 group-hover:underline">
            {trend.headline ?? trend.queryText}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="mr-1 h-3 w-3" />
              {trend.rankType === "rising" ? "Rising" : "Top"}
              {trend.rankPosition != null ? ` #${trend.rankPosition}` : ""}
            </Badge>
            <span className="text-xs text-muted-foreground">
              <Clock className="mr-1 inline h-3 w-3" />
              Week of {trend.detectedWeek}
            </span>
            {!trend.pharmacistReviewed && (
              <Badge
                variant="outline"
                className="border-amber-300 text-xs text-amber-700"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                AI draft
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
