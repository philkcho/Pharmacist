import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Pill, ExternalLink, Play, MessageCircleQuestion, Sparkles } from "lucide-react";
import {
  getRecommendationsDetail,
  getRecommendationsSummary,
  type RecommendationSurface,
} from "@/lib/actions/recommendations";

const SURFACE_META: Record<
  RecommendationSurface,
  { label: string; icon: typeof Play; tone: string }
> = {
  expert: {
    label: "Dr.'s Analysis",
    icon: Play,
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  consult: {
    label: "Consult",
    icon: MessageCircleQuestion,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  trending: {
    label: "Article",
    icon: Sparkles,
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

export default async function RecommendationsPage() {
  const [summary, products] = await Promise.all([
    getRecommendationsSummary(),
    getRecommendationsDetail(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Recommended Products</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Products registered as related-product recommendations on the public
          site. {summary.uniqueProductCount} unique products across{" "}
          {summary.totalPlacements} placements.
        </p>
      </div>

      {/* Surface breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["expert", summary.bySurface.expert],
            ["consult", summary.bySurface.consult],
            ["trending", summary.bySurface.trending],
          ] as const
        ).map(([surface, count]) => {
          const meta = SURFACE_META[surface];
          const Icon = meta.icon;
          return (
            <Card key={surface}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">
                      placements
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Product table */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No products are registered as recommendations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((p) => {
            const productKey = p.productSlug ?? `id-${p.productId ?? p.productName}`;
            return (
              <Card key={productKey}>
                <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-start">
                  {/* Product column */}
                  <div className="flex items-center gap-3 md:w-72 md:shrink-0">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.productName}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Pill className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {p.productName}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {p.approvalStatus && (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                              p.approvalStatus === "approved"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {p.approvalStatus}
                          </span>
                        )}
                        <span>{p.sources.length} placement{p.sources.length === 1 ? "" : "s"}</span>
                      </div>
                      {p.productSlug && (
                        <Link
                          href={`/analysis/${p.productSlug}`}
                          target="_blank"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View analysis
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Placements column */}
                  <div className="flex-1 space-y-2">
                    {p.sources.map((s, i) => {
                      const meta = SURFACE_META[s.surface];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={`${s.pageSlug}-${i}`}
                          className="flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2"
                        >
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.tone}`}
                          >
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={s.pagePath}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                            >
                              {s.pageTitle}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </Link>
                            {s.reason && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {s.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
