import {
  Search,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Pill,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listTrendsByStatus, type TrendTopicRow } from "@/lib/actions/trends";
import { getCategories } from "@/lib/actions/categories";
import { HomeSearchBar } from "@/components/home/home-search-bar";

const categoryEmojis: Record<string, string> = {
  "pain-relief": "💊",
  "cold-flu": "🤧",
  "digestive-health": "🫁",
  allergy: "🌸",
  "vitamins-supplements": "🍊",
  "skin-care": "✨",
  "skin-care-beauty": "✨",
  "sleep-relaxation": "😴",
  "first-aid": "🩹",
  "k-beauty": "🇰🇷",
  "k-beauty-cleansers": "🧴",
  "k-beauty-toners-essences": "💧",
  "k-beauty-serums-ampoules": "💜",
  "k-beauty-moisturizers": "🧊",
  "k-beauty-sunscreen": "☀️",
  "k-beauty-masks": "🎭",
  "acne-treatments": "🔬",
  "moisturizing-creams": "🧴",
  multivitamins: "💊",
  "vitamin-c": "🍋",
  glutathione: "✨",
};

export default async function Home() {
  const [trends, categories] = await Promise.all([
    listTrendsByStatus("published", 3),
    getCategories(),
  ]);

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
            Trending in Health &amp; Beauty — AI-analyzed, pharmacist-reviewed
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
              Trending Now
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

      {/* Browse by Category */}
      <section className="border-t bg-muted/30 py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-bold">Browse by Category</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span>{categoryEmojis[cat.slug] ?? "💊"}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendTopicRow }) {
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
        {trend.queryText}
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
