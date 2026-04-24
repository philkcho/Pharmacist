"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  X,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  triggerTrendIngestion,
  triggerTrendAnalysis,
  publishTrend,
  unpublishTrend,
  rejectTrend,
  type IngestionResult,
  type AnalysisBatchResult,
  type AdminTrendFilter,
  type AdminTrendRow,
} from "@/lib/actions/trends";

const FILTER_TABS: { value: AdminTrendFilter; label: string }[] = [
  { value: "pending_review", label: "Pending Review" },
  { value: "live", label: "Live" },
  { value: "pending", label: "Pending (raw)" },
  { value: "analyzing", label: "Analyzing" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

const CATEGORY_LABEL: Record<AdminTrendRow["category"], string> = {
  health: "Health",
  beauty_fitness: "Beauty & Fitness",
  other: "Other",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrendsClient({
  initialTrends,
  currentFilter,
}: {
  initialTrends: AdminTrendRow[];
  currentFilter: AdminTrendFilter;
}) {
  const [trends, setTrends] = useState<AdminTrendRow[]>(initialTrends);
  const [lastIngestionResult, setLastIngestionResult] =
    useState<IngestionResult | null>(null);
  const [lastAnalysisResult, setLastAnalysisResult] =
    useState<AnalysisBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRunIngestion = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await triggerTrendIngestion();
        setLastIngestionResult(result);
        setLastAnalysisResult(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ingestion failed. Try again."
        );
      }
    });
  };

  const handleRunAnalysis = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await triggerTrendAnalysis(3);
        setLastAnalysisResult(result);
        setLastIngestionResult(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Analysis failed. Try again."
        );
      }
    });
  };

  const removeLocally = (id: number) => {
    setTrends((rows) => rows.filter((r) => r.id !== id));
  };

  const handlePublish = (id: number) => {
    startTransition(async () => {
      const res = await publishTrend(id);
      if (res.success) removeLocally(id);
      else setError(res.error ?? "Publish failed");
    });
  };

  const handleUnpublish = (id: number) => {
    startTransition(async () => {
      const res = await unpublishTrend(id);
      if (res.success) removeLocally(id);
      else setError(res.error ?? "Unpublish failed");
    });
  };

  const handleReject = (id: number) => {
    if (!confirm("Reject this trend? It will be removed from the queue.")) return;
    startTransition(async () => {
      const res = await rejectTrend(id);
      if (res.success) removeLocally(id);
      else setError(res.error ?? "Reject failed");
    });
  };

  return (
    <div className="space-y-6">
      {/* Manual triggers */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">Run weekly ingestion</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pulls Google Trends for Health &amp; Beauty &amp; Fitness.
              Dedupes against the last 4 weeks.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRunIngestion}
            disabled={isPending}
            variant="outline"
            size="sm"
            className="self-start"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Run ingestion
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">Analyze pending trends</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs Layer 1 → 2 → 3 on up to 3 pending trends. Analyzed trends
              land in <strong>Pending Review</strong> — they stay hidden from
              the public until a pharmacist approves.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isPending}
            size="sm"
            className="self-start"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Run analysis
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastIngestionResult && (
        <IngestionResultCard result={lastIngestionResult} />
      )}
      {lastAnalysisResult && <AnalysisResultCard result={lastAnalysisResult} />}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto border-b">
        {FILTER_TABS.map((tab) => {
          const isActive = tab.value === currentFilter;
          return (
            <Link
              key={tab.value}
              href={`/trends?filter=${tab.value}`}
              className={
                "shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
                (isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Trend list */}
      {trends.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No {FILTER_TABS.find((t) => t.value === currentFilter)?.label ?? ""} trends right now.
        </div>
      ) : (
        <div className="grid gap-3">
          {trends.map((trend) => (
            <TrendReviewCard
              key={trend.id}
              trend={trend}
              filter={currentFilter}
              disabled={isPending}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendReviewCard({
  trend,
  filter,
  disabled,
  onPublish,
  onUnpublish,
  onReject,
}: {
  trend: AdminTrendRow;
  filter: AdminTrendFilter;
  disabled: boolean;
  onPublish: (id: number) => void;
  onUnpublish: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(filter === "pending_review");
  const hasPreview = trend.headline !== null || trend.answer !== null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold">
                {trend.queryText}
              </h3>
              <StatusBadge trend={trend} />
              {trend.rankType === "rising" ? (
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Rising
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Top
                </Badge>
              )}
              {trend.confidence && (
                <ConfidenceBadge level={trend.confidence} />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{CATEGORY_LABEL[trend.category]}</span>
              <span>Week {trend.detectedWeek}</span>
              {trend.rankPosition !== null && (
                <span>Rank #{trend.rankPosition}</span>
              )}
              {trend.volumeScore !== null && (
                <span>Volume {trend.volumeScore}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(trend.detectedAt)}
              </span>
              {trend.sourceCount > 0 && (
                <span>{trend.sourceCount} sources</span>
              )}
              {trend.productMatchCount > 0 && (
                <span>{trend.productMatchCount} products</span>
              )}
            </div>
            {trend.analysisError && (
              <p className="mt-2 text-xs text-destructive">
                Analysis error: {trend.analysisError}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {trend.slug && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                render={
                  <Link
                    href={`/trending/${trend.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Preview
              </Button>
            )}

            {filter === "pending_review" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(trend.id)}
                  disabled={disabled}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onPublish(trend.id)}
                  disabled={disabled}
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Publish
                </Button>
              </>
            )}

            {filter === "live" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onUnpublish(trend.id)}
                disabled={disabled}
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                Unpublish
              </Button>
            )}
          </div>
        </div>

        {/* Expandable synthesis preview */}
        {hasPreview && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide AI draft
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Show AI draft
                </>
              )}
            </button>

            {expanded && (
              <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
                {trend.headline && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Headline
                    </p>
                    <p className="mt-1 font-medium">{trend.headline}</p>
                  </div>
                )}
                {trend.answer && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Answer
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">
                      {trend.answer}
                    </p>
                  </div>
                )}
                {trend.leadExplanation && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      1-minute read
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {trend.leadExplanation}
                    </p>
                  </div>
                )}
                {trend.keyTakeaways.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Key takeaways
                    </p>
                    <ul className="mt-1 space-y-1">
                      {trend.keyTakeaways.slice(0, 5).map((t, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm leading-snug"
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trend.redFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                      Red flags
                    </p>
                    <ul className="mt-1 space-y-1">
                      {trend.redFlags.slice(0, 5).map((f, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm leading-snug"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ trend }: { trend: AdminTrendRow }) {
  if (trend.status === "published") {
    return trend.pharmacistReviewed ? (
      <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200">
        Live
      </Badge>
    ) : (
      <Badge className="bg-violet-100 text-violet-900 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200">
        Pending Review
      </Badge>
    );
  }
  const map: Record<string, { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className:
        "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200",
    },
    analyzing: {
      label: "Analyzing",
      className:
        "bg-blue-100 text-blue-900 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200",
    },
    rejected: {
      label: "Rejected",
      className: "bg-muted text-muted-foreground hover:bg-muted",
    },
    archived: {
      label: "Archived",
      className: "bg-muted text-muted-foreground hover:bg-muted",
    },
  };
  const style = map[trend.status] ?? map.pending;
  return <Badge className={style.className}>{style.label}</Badge>;
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const colors = {
    high: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300",
    medium:
      "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300",
    low: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[level]}`}>
      {level} confidence
    </Badge>
  );
}

function AnalysisResultCard({ result }: { result: AnalysisBatchResult }) {
  const hasFailures = result.failedCount > 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {hasFailures ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          <p className="text-sm font-semibold">
            Analysis batch completed · {result.pickedCount} picked
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span>
            Ready for review:{" "}
            <strong className="text-foreground">
              {result.publishedCount}
            </strong>
          </span>
          <span>
            Rejected:{" "}
            <strong className="text-foreground">{result.rejectedCount}</strong>
          </span>
          <span>
            Failed:{" "}
            <strong className="text-foreground">{result.failedCount}</strong>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Drafts land in the <strong>Pending Review</strong> tab — they stay
          hidden from the public until approved.
        </p>
        {result.results.length > 0 && (
          <ul className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
            {result.results.map((r) => (
              <li key={r.trendId} className="flex gap-2">
                <span className="font-mono text-muted-foreground">
                  #{r.trendId}
                </span>
                <span
                  className={
                    r.outcome === "published"
                      ? "text-violet-700 dark:text-violet-300"
                      : r.outcome === "rejected"
                        ? "text-muted-foreground"
                        : "text-destructive"
                  }
                >
                  {r.outcome === "published" ? "draft ready" : r.outcome}
                  {r.slug ? ` → /${r.slug}` : ""}
                  {r.reason ? ` — ${r.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function IngestionResultCard({ result }: { result: IngestionResult }) {
  const hasErrors = result.errors.length > 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          <p className="text-sm font-semibold">
            Ingestion completed · week of {result.detectedWeek}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span>
            Inserted:{" "}
            <strong className="text-foreground">{result.insertedCount}</strong>
          </span>
          <span>
            Skipped (dup):{" "}
            <strong className="text-foreground">
              {result.skippedDuplicateCount}
            </strong>
          </span>
          <span>
            Skipped (empty):{" "}
            <strong className="text-foreground">
              {result.skippedEmptyCount}
            </strong>
          </span>
          <span>
            Errors:{" "}
            <strong className="text-foreground">{result.errors.length}</strong>
          </span>
        </div>
        {hasErrors && (
          <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
            {result.errors.map((msg, i) => (
              <li key={i} className="text-amber-900 dark:text-amber-200">
                {msg}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
