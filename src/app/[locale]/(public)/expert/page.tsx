import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft, Pill } from "lucide-react";
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
          <FileText className="h-6 w-6 text-primary" />
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
          <FileText className="mx-auto h-10 w-10 opacity-50" />
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
}
