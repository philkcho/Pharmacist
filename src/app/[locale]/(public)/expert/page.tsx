import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { listPublishedExpertPicks } from "@/lib/actions/expert-picks";
import { ExpertPickCard } from "@/components/expert/expert-pick-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dr.'s Analysis | AI PharmCare",
  description:
    "Expert health & beauty videos analyzed and summarized by pharmacists. Key insights and product recommendations you can trust.",
  alternates: { canonical: "/expert" },
};

export default async function ExpertIndexPage() {
  const picks = await listPublishedExpertPicks(50);

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
            <ExpertPickCard
              key={pick.id}
              slug={pick.slug}
              title={pick.title}
              category={pick.category}
              thumbnailUrl={pick.thumbnailUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
