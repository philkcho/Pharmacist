import {
  Search,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Pill,
  Sparkles,
  Play,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPublishedTrendsWithHeadline, type TrendTopicRow } from "@/lib/actions/trends";
import { HomeSearchBar } from "@/components/home/home-search-bar";

const healthTopics = [
  { slug: "headache", label: "Headache Relief", emoji: "🤕", productCount: 12 },
  { slug: "cold-flu", label: "Cold & Flu", emoji: "🤧", productCount: 18 },
  { slug: "allergy", label: "Allergies", emoji: "🌸", productCount: 15 },
  { slug: "digestive", label: "Digestive Health", emoji: "🫁", productCount: 9 },
  { slug: "sleep-aid", label: "Sleep Aids", emoji: "😴", productCount: 8 },
  { slug: "muscle-pain", label: "Muscle & Joint Pain", emoji: "💪", productCount: 11 },
  { slug: "cough", label: "Cough & Sore Throat", emoji: "🗣️", productCount: 7 },
  { slug: "heartburn", label: "Heartburn & Acid Reflux", emoji: "🔥", productCount: 6 },
];

const beautyTopics = [
  { slug: "acne", label: "Acne & Breakouts", emoji: "🔬", productCount: 14 },
  { slug: "sunscreen", label: "Sunscreen & SPF", emoji: "☀️", productCount: 10 },
  { slug: "anti-aging", label: "Anti-Aging", emoji: "✨", productCount: 8 },
  { slug: "dry-skin", label: "Dry & Sensitive Skin", emoji: "💧", productCount: 9 },
  { slug: "k-beauty", label: "K-Beauty Essentials", emoji: "🇰🇷", productCount: 13 },
  { slug: "vitamins", label: "Vitamins & Supplements", emoji: "🍊", productCount: 16 },
];

const expertPicks = [
  {
    slug: "dermatologist-spf-guide",
    title: "A Dermatologist's Honest SPF Tier List",
    expert: "Dr. Shereene Idriss",
    credential: "Board-Certified Dermatologist",
    thumbnail: "/images/placeholder-video-1.jpg",
    duration: "12:34",
    category: "Skin Care" as const,
  },
  {
    slug: "pharmacist-cold-medicine",
    title: "Cold Medicines That Actually Work (and Ones That Don't)",
    expert: "Dr. pharmacist",
    credential: "PharmD, RPh",
    thumbnail: "/images/placeholder-video-2.jpg",
    duration: "8:21",
    category: "Health" as const,
  },
  {
    slug: "vitamin-supplements-worth-it",
    title: "Stop Wasting Money on These Supplements",
    expert: "Dr. Andrea Suarez",
    credential: "Board-Certified Dermatologist",
    thumbnail: "/images/placeholder-video-3.jpg",
    duration: "15:07",
    category: "Wellness" as const,
  },
];

export default async function Home() {
  const trends = await listPublishedTrendsWithHeadline(3);

  return (
    <div className="flex flex-col">
      {/* Hero — compact, search-focused */}
      <section className="bg-gradient-to-b from-primary/5 to-background pb-2 pt-10">
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

      {/* Today's Trends */}
      <section className="py-10">
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
      <section className="py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Play className="h-5 w-5 text-primary" />
                Dr.&apos;s Analysis
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Expert videos analyzed &amp; summarized — key insights + product
                recommendations
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/expert" />}
            >
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {expertPicks.map((pick) => (
              <Link
                key={pick.slug}
                href={`/expert/${pick.slug}`}
                className="group overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/30 hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-full bg-black/60 p-3 transition-transform group-hover:scale-110">
                      <Play className="h-6 w-6 fill-white text-white" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                    {pick.duration}
                  </span>
                  <Badge
                    variant="secondary"
                    className="absolute left-2 top-2 text-xs"
                  >
                    {pick.category}
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
                      <p className="text-xs font-medium">{pick.expert}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {pick.credential}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* What Are You Looking For? */}
      <section className="border-t bg-muted/30 py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-bold">
            What Are You Looking For?
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Pick a topic — we&apos;ll show you the top products, analyzed by pharmacists
          </p>

          {/* Health Topics */}
          <div className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Pill className="h-4 w-4" />
              Health
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {healthTopics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topics/${topic.slug}`}
                  className="group flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <span className="text-2xl">{topic.emoji}</span>
                  <span className="text-sm font-medium group-hover:text-primary">
                    {topic.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {topic.productCount} products
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Beauty & Wellness Topics */}
          <div className="mt-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Beauty &amp; Wellness
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {beautyTopics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topics/${topic.slug}`}
                  className="group flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <span className="text-2xl">{topic.emoji}</span>
                  <span className="text-sm font-medium group-hover:text-primary">
                    {topic.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {topic.productCount} products
                  </span>
                </Link>
              ))}
            </div>
          </div>
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
      className="group block rounded-lg border p-5 transition-all hover:border-primary/30 hover:shadow-md"
    >
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
    </Link>
  );
}
