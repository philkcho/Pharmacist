import { Badge } from "@/components/ui/badge";
import { Play, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { listPublishedExpertPicks } from "@/lib/actions/expert-picks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dr.'s Analysis | Dr.pharmacist",
  description:
    "Expert health & beauty videos analyzed and summarized by pharmacists. Key insights and product recommendations you can trust.",
};

export default async function ExpertIndexPage() {
  const picks = await listPublishedExpertPicks(50);

  const categories = ["all", "health", "skin-care", "wellness"] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Play className="h-6 w-6 text-primary" />
          Dr.&apos;s Analysis
        </h1>
        <p className="mt-2 text-muted-foreground">
          Expert videos analyzed &amp; summarized — key insights + product
          recommendations
        </p>
      </div>

      {/* Content */}
      {picks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Play className="mx-auto h-10 w-10 opacity-50" />
          <p className="mt-3 text-lg font-medium">Coming soon</p>
          <p className="mt-1 text-sm">
            Expert video analyses are being curated. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <ExpertPickCard key={pick.id} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpertPickCard({
  pick,
}: {
  pick: Awaited<ReturnType<typeof listPublishedExpertPicks>>[number];
}) {
  const categoryLabel =
    pick.category === "health"
      ? "Health"
      : pick.category === "skin-care"
        ? "Skin Care"
        : "Wellness";

  return (
    <Link
      href={`/expert/${pick.slug}`}
      className="group overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        {pick.thumbnailUrl ? (
          <img
            src={pick.thumbnailUrl}
            alt={pick.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
          <div className="rounded-full bg-black/60 p-3 transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
        {pick.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {pick.duration}
          </span>
        )}
        <Badge variant="secondary" className="absolute left-2 top-2 text-xs">
          {categoryLabel}
        </Badge>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
          {pick.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          1-min summary + ingredient analysis + where to buy
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            Rx
          </div>
          <div>
            <p className="text-xs font-medium">{pick.expertName}</p>
            {pick.expertCredential && (
              <p className="text-[11px] text-muted-foreground">
                {pick.expertCredential}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
