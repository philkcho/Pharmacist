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
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  triggerTrendIngestion,
  triggerTrendAnalysis,
  type IngestionResult,
  type AnalysisBatchResult,
  type TrendStatus,
  type TrendTopicRow,
} from "@/lib/actions/trends";

const STATUS_TABS: { value: TrendStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "analyzing", label: "Analyzing" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

const STATUS_STYLE: Record<
  TrendStatus,
  { label: string; className: string }
> = {
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
  published: {
    label: "Published",
    className:
      "bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200",
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

const CATEGORY_LABEL: Record<TrendTopicRow["category"], string> = {
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
  currentStatus,
}: {
  initialTrends: TrendTopicRow[];
  currentStatus: TrendStatus;
}) {
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
        setLastIngestionResult(null);
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
        setLastAnalysisResult(null);
      }
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
              Runs Layer 1 → 2 → 3 on up to 3 pending trends. Published
              trends get an amber "AI draft" banner until reviewed.
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

      {lastIngestionResult && <IngestionResultCard result={lastIngestionResult} />}
      {lastAnalysisResult && <AnalysisResultCard result={lastAnalysisResult} />}

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto border-b">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === currentStatus;
          return (
            <Link
              key={tab.value}
              href={`/trends?status=${tab.value}`}
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
      {initialTrends.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No {currentStatus} trends right now.
        </div>
      ) : (
        <div className="grid gap-3">
          {initialTrends.map((trend) => (
            <TrendRowCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </div>
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
            Published:{" "}
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
                      ? "text-emerald-700 dark:text-emerald-300"
                      : r.outcome === "rejected"
                        ? "text-muted-foreground"
                        : "text-destructive"
                  }
                >
                  {r.outcome}
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

function TrendRowCard({ trend }: { trend: TrendTopicRow }) {
  const style = STATUS_STYLE[trend.status];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">
              {trend.queryText}
            </h3>
            <Badge className={style.className}>{style.label}</Badge>
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
          </div>
          {trend.analysisError && (
            <p className="mt-2 text-xs text-destructive">
              Analysis error: {trend.analysisError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
