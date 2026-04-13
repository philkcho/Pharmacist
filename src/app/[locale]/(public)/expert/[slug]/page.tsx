import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  ArrowLeft,
  ExternalLink,
  Check,
  FlaskConical,
  User,
} from "lucide-react";
import Link from "next/link";
import { getExpertPickBySlug } from "@/lib/actions/expert-picks";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface ExpertDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ExpertDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const pick = await getExpertPickBySlug(slug);
  if (!pick) return { title: "Not Found" };

  return {
    title: `${pick.title} | Dr.pharmacist`,
    description: pick.summary?.slice(0, 160) ?? "",
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href="/expert"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Expert Analysis
      </Link>

      {/* Header */}
      <div className="mb-6">
        <Badge variant="secondary" className="mb-3">
          {categoryLabel}
        </Badge>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {pick.title}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            Rx
          </div>
          <div>
            <p className="text-sm font-medium">{pick.expertName}</p>
            {pick.expertCredential && (
              <p className="text-xs text-muted-foreground">
                {pick.expertCredential}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* YouTube Embed */}
      <div className="mb-8 overflow-hidden rounded-xl">
        <div className="relative aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${pick.youtubeId}`}
            title={pick.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>

      {/* 1-Minute Summary */}
      {pick.summary && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">TL;DR</h2>
          <div className="rounded-lg border bg-muted/30 p-5">
            <p className="leading-relaxed text-foreground/90">{pick.summary}</p>
          </div>
        </section>
      )}

      {/* Key Takeaways */}
      {pick.keyTakeaways && pick.keyTakeaways.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Key Takeaways</h2>
          <ul className="space-y-2">
            {pick.keyTakeaways.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Analysis Sections */}
      {pick.analysisSections && pick.analysisSections.length > 0 && (
        <section className="mb-8 space-y-6">
          {pick.analysisSections.map((section, i) => (
            <div key={i}>
              <h2 className="mb-2 text-lg font-bold">{section.title}</h2>
              <p className="leading-relaxed text-foreground/80">
                {section.content}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Mentioned Products */}
      {pick.mentionedProducts && pick.mentionedProducts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <FlaskConical className="h-5 w-5" />
            Products & Ingredients Mentioned
          </h2>
          <div className="space-y-3">
            {pick.mentionedProducts.map((product, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {product.reason}
                  </p>
                  {product.slug && (
                    <Link
                      href={`/topics/${product.slug}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Learn more <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Source */}
      <section className="rounded-lg border bg-muted/20 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Play className="h-4 w-4" />
          <span>Source video:</span>
          <a
            href={pick.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Watch on YouTube
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          This analysis was generated by AI based on the video transcript and
          reviewed for accuracy. Always consult your pharmacist or healthcare
          provider for personalized advice.
        </p>
      </section>
    </div>
  );
}
