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
  Trash2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendCover } from "@/components/trending/trend-cover";
import {
  triggerTrendIngestion,
  triggerTrendAnalysis,
  triggerSingleAnalysis,
  deleteTrend,
  publishTrend,
  unpublishTrend,
  rejectTrend,
  backfillTrendProductMatches,
  type IngestionResult,
  type AnalysisBatchResult,
  type BackfillResult,
  type AdminTrendFilter,
  type AdminTrendRow,
} from "@/lib/actions/trends";

const FILTER_TABS: { value: AdminTrendFilter; label: string }[] = [
  { value: "pending", label: "Pending Ingestion" },
  { value: "pending_review", label: "Pending Review" },
  { value: "live", label: "Publishing" },
  { value: "rejected", label: "Rejected" },
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastIngestionResult, setLastIngestionResult] =
    useState<IngestionResult | null>(null);
  const [lastAnalysisResult, setLastAnalysisResult] =
    useState<AnalysisBatchResult | null>(null);
  const [lastBackfillResult, setLastBackfillResult] =
    useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showSelection = currentFilter === "pending";
  const allSelected =
    showSelection && trends.length > 0 && selected.size === trends.length;

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(trends.map((t) => t.id)));
    }
  };

  const handleAnalyzeOne = (id: number) => {
    setError(null);
    startTransition(async () => {
      const res = await triggerSingleAnalysis(id);
      if (res.outcome !== "failed") {
        removeLocally(id);
      } else {
        setError(res.reason ?? "Analysis failed");
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  const handleDeleteOne = (id: number) => {
    if (!confirm("Delete this trend permanently? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTrend(id);
      if (res.success) {
        removeLocally(id);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        setError(res.error ?? "Delete failed");
      }
    });
  };

  const handleAnalyzeSelected = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setError(null);
    startTransition(async () => {
      for (const id of ids) {
        const res = await triggerSingleAnalysis(id);
        if (res.outcome !== "failed") {
          removeLocally(id);
        }
      }
      setSelected(new Set());
    });
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} trend${ids.length === 1 ? "" : "s"} permanently? This cannot be undone.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      for (const id of ids) {
        await deleteTrend(id);
        removeLocally(id);
      }
      setSelected(new Set());
    });
  };

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
        setLastBackfillResult(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Analysis failed. Try again."
        );
      }
    });
  };

  const handleBackfillProducts = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await backfillTrendProductMatches(100);
        setLastBackfillResult(result);
        setLastIngestionResult(null);
        setLastAnalysisResult(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Backfill failed. Try again."
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
      <div className="grid gap-3 md:grid-cols-3">
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

        <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">Backfill product matches</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Re-runs product matching on every analyzed trend with the new
              top-5 cap. One click covers all articles already on the
              homepage. Idempotent · no AI cost.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleBackfillProducts}
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
            Backfill all articles
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
      {lastBackfillResult && <BackfillResultCard result={lastBackfillResult} />}

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

      {/* Bulk action toolbar — visible only on Pending (raw) tab */}
      {showSelection && trends.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-input"
            />
            <span>
              {selected.size === 0
                ? `Select all (${trends.length})`
                : `${selected.size} of ${trends.length} selected`}
            </span>
          </label>
          {selected.size > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDeleteSelected}
                disabled={isPending}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete selected
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAnalyzeSelected}
                disabled={isPending}
              >
                <Zap className="mr-1 h-3.5 w-3.5" />
                Analyze selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Trend list */}
      {trends.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No {FILTER_TABS.find((t) => t.value === currentFilter)?.label ?? ""} trends right now.
        </div>
      ) : currentFilter === "pending" || currentFilter === "rejected" ? (
        <div className="overflow-hidden rounded-md border">
          {trends.map((trend, idx) => (
            <TrendListRow
              key={trend.id}
              trend={trend}
              filter={currentFilter}
              disabled={isPending}
              selected={selected.has(trend.id)}
              isLast={idx === trends.length - 1}
              onToggleSelect={toggleSelect}
              onAnalyzeOne={handleAnalyzeOne}
              onDeleteOne={handleDeleteOne}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {trends.map((trend) => (
            <TrendReviewCard
              key={trend.id}
              trend={trend}
              filter={currentFilter}
              disabled={isPending}
              selected={selected.has(trend.id)}
              showSelection={showSelection}
              onToggleSelect={toggleSelect}
              onAnalyzeOne={handleAnalyzeOne}
              onDeleteOne={handleDeleteOne}
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

function TrendListRow({
  trend,
  filter,
  disabled,
  selected,
  isLast,
  onToggleSelect,
  onAnalyzeOne,
  onDeleteOne,
}: {
  trend: AdminTrendRow;
  filter: AdminTrendFilter;
  disabled: boolean;
  selected: boolean;
  isLast: boolean;
  onToggleSelect: (id: number) => void;
  onAnalyzeOne: (id: number) => void;
  onDeleteOne: (id: number) => void;
}) {
  const isPending = filter === "pending";
  const isRejected = filter === "rejected";

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
        isLast ? "" : "border-b"
      } ${selected ? "bg-primary/5" : "hover:bg-muted/30"}`}
    >
      {/* Selection — pending tab only (bulk actions) */}
      {isPending && (
        <label className="flex shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(trend.id)}
            className="h-4 w-4 cursor-pointer rounded border-input"
            aria-label={`Select ${trend.queryText}`}
          />
        </label>
      )}

      {/* Rank + category badges */}
      <div className="flex shrink-0 gap-1.5">
        {isRejected && (
          <Badge className="bg-muted text-[10px] text-muted-foreground">
            Rejected
          </Badge>
        )}
        {trend.rankType === "rising" ? (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <TrendingUp className="h-2.5 w-2.5" />
            Rising
            {trend.rankPosition != null ? ` #${trend.rankPosition}` : ""}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <ArrowUpRight className="h-2.5 w-2.5" />
            Top
            {trend.rankPosition != null ? ` #${trend.rankPosition}` : ""}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px]">
          {CATEGORY_LABEL[trend.category]}
        </Badge>
      </div>

      {/* Query text — takes remaining space */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{trend.queryText}</p>
        {trend.analysisError && (
          <p
            className={`truncate text-xs ${
              isRejected ? "text-muted-foreground" : "text-destructive"
            }`}
          >
            {isRejected ? "Reason: " : ""}
            {trend.analysisError}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
        <span>Week {trend.detectedWeek}</span>
        {trend.volumeScore !== null && <span>Vol {trend.volumeScore}</span>}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDateTime(trend.detectedAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onDeleteOne(trend.id)}
          disabled={disabled}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
        {isPending && (
          <Button
            type="button"
            size="sm"
            onClick={() => onAnalyzeOne(trend.id)}
            disabled={disabled}
          >
            <Zap className="mr-1 h-3.5 w-3.5" />
            Analyze
          </Button>
        )}
      </div>
    </div>
  );
}

function TrendReviewCard({
  trend,
  filter,
  disabled,
  selected,
  showSelection,
  onToggleSelect,
  onAnalyzeOne,
  onDeleteOne,
  onPublish,
  onUnpublish,
  onReject,
}: {
  trend: AdminTrendRow;
  filter: AdminTrendFilter;
  disabled: boolean;
  selected: boolean;
  showSelection: boolean;
  onToggleSelect: (id: number) => void;
  onAnalyzeOne: (id: number) => void;
  onDeleteOne: (id: number) => void;
  onPublish: (id: number) => void;
  onUnpublish: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(filter === "pending_review");
  const hasPreview = trend.headline !== null || trend.answer !== null;
  const title = trend.headline ?? trend.queryText;
  const categoryKey: "health" | "beauty_fitness" =
    trend.category === "beauty_fitness" ? "beauty_fitness" : "health";

  const CoverWrapper = trend.slug
    ? ({ children }: { children: React.ReactNode }) => (
        <Link
          href={`/trending/${trend.slug}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${title} detail in a new tab`}
          className="group block overflow-hidden"
        >
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="overflow-hidden">{children}</div>
      );

  return (
    <Card
      className={`overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
    >
      {/* Cover — mirrors homepage TrendCard aesthetic */}
      <CoverWrapper>
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {trend.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trend.imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <TrendCover category={categoryKey} />
          )}

          {/* Selection checkbox — only in Pending (raw) tab */}
          {showSelection && (
            <label
              className="absolute left-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-background/90 p-1.5 shadow-sm backdrop-blur"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(trend.id)}
                className="h-4 w-4 cursor-pointer rounded border-input"
                aria-label={`Select ${trend.queryText}`}
              />
            </label>
          )}

          {/* Overlay badges — shifted right when checkbox present */}
          <div
            className={`pointer-events-none absolute ${showSelection ? "left-12" : "left-2"} top-2 flex flex-wrap items-center gap-1.5`}
          >
            <StatusBadge trend={trend} />
            {trend.rankType === "rising" ? (
              <Badge
                variant="outline"
                className="gap-1 bg-background/90 text-xs backdrop-blur"
              >
                <TrendingUp className="h-3 w-3" />
                Rising
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 bg-background/90 text-xs backdrop-blur"
              >
                <ArrowUpRight className="h-3 w-3" />
                Top
              </Badge>
            )}
          </div>
          {trend.confidence && (
            <div className="absolute right-2 top-2">
              <ConfidenceBadge level={trend.confidence} />
            </div>
          )}
        </div>
      </CoverWrapper>

      <CardContent className="space-y-3 p-4">
        {/* Headline (click → detail) */}
        {trend.slug ? (
          <Link
            href={`/trending/${trend.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <h3 className="line-clamp-2 text-base font-semibold leading-snug hover:text-primary">
              {title}
            </h3>
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">
            {title}
          </h3>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">
            {CATEGORY_LABEL[trend.category]}
          </Badge>
          <span>Week {trend.detectedWeek}</span>
          {trend.rankPosition !== null && (
            <span>Rank #{trend.rankPosition}</span>
          )}
          {trend.volumeScore !== null && <span>Vol {trend.volumeScore}</span>}
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
          <p
            className={`text-xs ${
              trend.status === "rejected"
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {trend.status === "rejected" ? "Reason: " : "Analysis error: "}
            {trend.analysisError}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
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
              Open detail
            </Button>
          )}

          {filter === "pending" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDeleteOne(trend.id)}
                disabled={disabled}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onAnalyzeOne(trend.id)}
                disabled={disabled}
                className="ml-auto"
              >
                <Zap className="mr-1 h-3.5 w-3.5" />
                Analyze
              </Button>
            </>
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
                className="ml-auto"
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
              className="ml-auto"
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Unpublish
            </Button>
          )}

          {filter === "rejected" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDeleteOne(trend.id)}
              disabled={disabled}
              className="ml-auto"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
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
  const OUTCOME_LABEL: Record<
    AnalysisBatchResult["results"][number]["outcome"],
    { label: string; className: string }
  > = {
    published: {
      label: "Draft ready",
      className:
        "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200",
    },
    rejected: {
      label: "Rejected",
      className: "bg-muted text-muted-foreground",
    },
    failed: {
      label: "Failed",
      className:
        "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200",
    },
  };

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
      <CardContent className="space-y-3 pt-0 text-sm">
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
          <ul className="divide-y rounded-md border bg-muted/30 text-xs">
            {result.results.map((r) => {
              const outcomeStyle = OUTCOME_LABEL[r.outcome];
              return (
                <li key={r.trendId} className="flex items-start gap-2 p-2.5">
                  <Badge className={`shrink-0 ${outcomeStyle.className}`}>
                    {outcomeStyle.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {r.queryText ?? `#${r.trendId}`}
                    </p>
                    {r.headline && r.headline !== r.queryText && (
                      <p className="mt-0.5 truncate text-muted-foreground">
                        → {r.headline}
                      </p>
                    )}
                    {r.slug && (
                      <Link
                        href={`/trending/${r.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        /trending/{r.slug}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                    {r.reason && (
                      <p className="mt-0.5 text-muted-foreground">
                        {r.reason}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BackfillResultCard({ result }: { result: BackfillResult }) {
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
            Product backfill completed · {result.scanned} scanned
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span>
            Updated:{" "}
            <strong className="text-foreground">{result.updated}</strong>
          </span>
          <span>
            Skipped (no change):{" "}
            <strong className="text-foreground">{result.skipped}</strong>
          </span>
          <span>
            Errors:{" "}
            <strong className="text-foreground">{result.errors.length}</strong>
          </span>
        </div>
        {result.updated === 0 && result.skipped > 0 && !hasErrors && (
          <p className="text-xs text-muted-foreground">
            All scanned trends already have the latest top-5 matches.
          </p>
        )}
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
      <CardContent className="space-y-3 pt-0 text-sm">
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
        {result.insertedTrends.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New keywords this run
            </p>
            <ul className="divide-y rounded-md border bg-muted/30 text-xs">
              {result.insertedTrends.map((t, i) => (
                <li key={i} className="flex items-center gap-2 p-2.5">
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 text-[10px]"
                  >
                    {t.rankType === "rising" ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    )}
                    {t.rankType === "rising" ? "Rising" : "Top"}
                    {t.rankPosition != null ? ` #${t.rankPosition}` : ""}
                  </Badge>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {CATEGORY_LABEL[t.category]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {t.queryText}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
