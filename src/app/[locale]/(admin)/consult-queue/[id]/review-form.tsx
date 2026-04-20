"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  MessageSquare,
  X,
  Loader2,
  Eye,
  Code2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DraftBody } from "@/components/consult/draft-body";
import { PharmacistPickCard } from "@/components/consult/pharmacist-pick-card";
import {
  approveAsIs,
  approveWithEdits,
  requestMoreInfo,
  rejectConsult,
} from "@/lib/actions/consult-admin";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import type { EnrichedRecommendation } from "@/lib/actions/consult-recommendations";

interface Props {
  consultId: string;
  initialDraft: ConsultDraft;
  enrichedRecommendations?: EnrichedRecommendation[];
}

type ViewMode = "preview" | "edit";

// Pharmacist's editor: shows the customer-facing rendering by default
// (so Younghun reviews exactly what the user will see), with a JSON
// edit mode for adjustments. Edit summary is required when approving
// with changes so we have an audit trail.
export function ConsultReviewForm({
  consultId,
  initialDraft,
  enrichedRecommendations = [],
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [draftJson, setDraftJson] = useState(() =>
    JSON.stringify(initialDraft, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [moreInfoQ, setMoreInfoQ] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const startTime = useState(() => Date.now())[0];

  // Parse the JSON each render so the preview stays in sync with edits.
  let parsedDraft: ConsultDraft | null = null;
  try {
    parsedDraft = JSON.parse(draftJson) as ConsultDraft;
    if (parseError) setParseError(null);
  } catch (err) {
    if (!parseError) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  const wasEdited = draftJson !== JSON.stringify(initialDraft, null, 2);

  function timeSpentSeconds(): number {
    return Math.round((Date.now() - startTime) / 1000);
  }

  function handleApproveAsIs() {
    setError(null);
    startTransition(async () => {
      const result = await approveAsIs(consultId, timeSpentSeconds());
      if (!result.ok) {
        setError(result.error ?? "Failed");
        return;
      }
      // Hard navigate so apex→www redirect stays clean and the queue
      // page re-fetches with the now-approved row in its new tab.
      window.location.href = "/consult-queue?status=approved";
    });
  }

  function handleApproveWithEdits() {
    setError(null);
    if (!parsedDraft) {
      setError("Fix the JSON before approving");
      return;
    }
    if (!editSummary.trim()) {
      setError("Add a one-line summary of what you changed");
      return;
    }
    startTransition(async () => {
      const result = await approveWithEdits(
        consultId,
        parsedDraft,
        editSummary.trim(),
        timeSpentSeconds()
      );
      if (!result.ok) {
        setError(result.error ?? "Failed");
        return;
      }
      // Hard navigate so apex→www redirect stays clean and the queue
      // page re-fetches with the now-approved row in its new tab.
      window.location.href = "/consult-queue?status=approved";
    });
  }

  function handleRequestMoreInfo() {
    setError(null);
    if (!moreInfoQ.trim()) {
      setError("Type the question you need answered");
      return;
    }
    startTransition(async () => {
      const result = await requestMoreInfo(consultId, moreInfoQ.trim());
      if (!result.ok) {
        setError(result.error ?? "Failed");
        return;
      }
      // Hard navigate so apex→www redirect stays clean and the queue
      // page re-fetches with the now-approved row in its new tab.
      window.location.href = "/consult-queue?status=approved";
    });
  }

  function handleReject() {
    setError(null);
    if (!rejectReason.trim()) {
      setError("Add a reason");
      return;
    }
    startTransition(async () => {
      const result = await rejectConsult(consultId, rejectReason.trim());
      if (!result.ok) {
        setError(result.error ?? "Failed");
        return;
      }
      // Hard navigate so apex→www redirect stays clean and the queue
      // page re-fetches with the now-approved row in its new tab.
      window.location.href = "/consult-queue?status=approved";
    });
  }

  return (
    <div className="space-y-3">
      {/* Top: red flags from AI */}
      {parsedDraft?.isEmergency && (
        <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          AI flagged this as an emergency.
        </div>
      )}
      {parsedDraft?.isHighRisk && !parsedDraft?.isEmergency && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          AI flagged this as high-risk.
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={viewMode === "preview" ? "default" : "outline"}
          onClick={() => setViewMode("preview")}
        >
          <Eye className="h-3.5 w-3.5" />
          Customer view
        </Button>
        <Button
          size="sm"
          variant={viewMode === "edit" ? "default" : "outline"}
          onClick={() => setViewMode("edit")}
        >
          <Code2 className="h-3.5 w-3.5" />
          Edit JSON
          {wasEdited && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              edited
            </Badge>
          )}
        </Button>
      </div>

      {/* Preview pane */}
      {viewMode === "preview" && parsedDraft && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
              ↓ This is what the user will see
            </p>
            <DraftBody draft={parsedDraft} />
          </div>

          {enrichedRecommendations.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                ↓ Pharmacist&apos;s Picks (also shown to user)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {enrichedRecommendations.map((rec) => (
                  <PharmacistPickCard key={rec.medicationId} recommendation={rec} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "preview" && !parsedDraft && (
        <div className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          JSON is invalid — switch to Edit mode to fix.
          <div className="mt-1 text-xs">{parseError}</div>
        </div>
      )}

      {/* Edit pane */}
      {viewMode === "edit" && (
        <Textarea
          value={draftJson}
          onChange={(e) => setDraftJson(e.target.value)}
          rows={20}
          className="font-mono text-xs"
          disabled={isPending}
        />
      )}
      {viewMode === "edit" && parseError && (
        <p className="text-xs text-destructive">JSON error: {parseError}</p>
      )}

      {/* Edit summary — only required when approving with edits */}
      {wasEdited && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Edit summary (what changed?)
          </label>
          <input
            type="text"
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder='e.g. "Strengthened iron + thyroid timing guidance, removed weak claim about magnesium"'
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            disabled={isPending}
          />
        </div>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {!wasEdited ? (
          <Button onClick={handleApproveAsIs} disabled={isPending || !parsedDraft}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve and send to user
          </Button>
        ) : (
          <Button onClick={handleApproveWithEdits} disabled={isPending || !parsedDraft}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve edits and send
          </Button>
        )}

        <Button
          onClick={() => setShowMoreInfo((s) => !s)}
          disabled={isPending}
          variant="outline"
        >
          <MessageSquare className="h-4 w-4" />
          Request more info
        </Button>
        <Button
          onClick={() => setShowReject((s) => !s)}
          disabled={isPending}
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>

      {showMoreInfo && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <label className="text-xs font-medium">
            Question to send to user
          </label>
          <Textarea
            value={moreInfoQ}
            onChange={(e) => setMoreInfoQ(e.target.value)}
            rows={3}
            placeholder="e.g. What time of day do you take your levothyroxine? Are you also taking calcium?"
          />
          <Button onClick={handleRequestMoreInfo} disabled={isPending} size="sm">
            Send question
          </Button>
        </div>
      )}

      {showReject && (
        <div className="space-y-2 rounded-md border bg-destructive/5 p-3">
          <label className="text-xs font-medium text-destructive">
            Reason for rejection (sent to user)
          </label>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder='e.g. "This question requires direct examination by your prescribing doctor."'
          />
          <Button
            onClick={handleReject}
            disabled={isPending}
            size="sm"
            variant="destructive"
          >
            Confirm reject
          </Button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Time spent reviewing is tracked automatically.
      </p>
    </div>
  );
}
