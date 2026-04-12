"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  updateReviewRequestStatus,
  type ReviewRequestRow,
  type ReviewRequestStatus,
} from "@/lib/actions/lookup";

const STATUS_TABS: { value: ReviewRequestStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLE: Record<
  ReviewRequestStatus,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200" },
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-900 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200" },
  done: { label: "Done", className: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200" },
  rejected: { label: "Rejected", className: "bg-muted text-muted-foreground hover:bg-muted" },
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

export function ReviewRequestsClient({
  initialRequests,
  currentStatus,
}: {
  initialRequests: ReviewRequestRow[];
  currentStatus: ReviewRequestStatus;
}) {
  return (
    <div className="space-y-6">
      {/* Status filter tabs */}
      <div className="flex gap-2 border-b">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === currentStatus;
          return (
            <Link
              key={tab.value}
              href={`/review-requests?status=${tab.value}`}
              className={
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
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

      {/* Request list */}
      {initialRequests.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No {currentStatus.replace("_", " ")} requests right now.
        </div>
      ) : (
        <div className="space-y-4">
          {initialRequests.map((req) => (
            <ReviewRequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewRequestCard({ request }: { request: ReviewRequestRow }) {
  const [reviewerNote, setReviewerNote] = useState(request.reviewerNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateStatus = (next: ReviewRequestStatus) => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateReviewRequestStatus(
        request.id,
        next,
        reviewerNote || undefined
      );
      if (!result.ok) {
        setError(result.message ?? "Update failed");
      }
    });
  };

  const style = STATUS_STYLE[request.status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{request.queryText}</h3>
              <Badge className={style.className}>{style.label}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(request.createdAt)}
              </span>
              {request.contactEmail && (
                <a
                  href={`mailto:${request.contactEmail}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Mail className="h-3 w-3" />
                  {request.contactEmail}
                </a>
              )}
              <span className="text-muted-foreground/70">
                Lookup #{request.productLookupId}
              </span>
            </div>
          </div>

          {/* Quick-lookup links */}
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(request.queryText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              DailyMed <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(request.queryText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              PubMed <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {request.requesterNote && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              User note
            </p>
            <p className="mt-1 whitespace-pre-wrap">{request.requesterNote}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Internal reviewer note
          </label>
          <Textarea
            value={reviewerNote}
            onChange={(e) => setReviewerNote(e.target.value)}
            placeholder="Add notes for the team (optional)"
            rows={2}
            disabled={isPending}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {request.status !== "in_progress" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus("in_progress")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          {request.status !== "done" && (
            <Button
              size="sm"
              onClick={() => updateStatus("done")}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark done
            </Button>
          )}
          {request.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus("rejected")}
              disabled={isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
          {request.status !== "pending" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateStatus("pending")}
              disabled={isPending}
            >
              Reopen
            </Button>
          )}
        </div>

        {request.completedAt && (
          <p className="text-xs text-muted-foreground">
            Completed {formatDateTime(request.completedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
