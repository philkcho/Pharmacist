import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, MessageCircle } from "lucide-react";

import {
  getConsultForReview,
  getConsultQueueCounts,
  listQueueByStatus,
} from "@/lib/actions/consult-admin";
import { Badge } from "@/components/ui/badge";
import type { ConsultRecord, ConsultStatus } from "@/lib/actions/consults";
import { ConsultDetailPanel } from "./detail-panel";
import { DeleteAllConsultsButton } from "./delete-all-button";

interface PageProps {
  searchParams: Promise<{ status?: string; id?: string }>;
}

const VALID_STATUSES: readonly ConsultStatus[] = [
  "ready_for_review",
  "in_review",
  "needs_more_info",
  "pending",
  "ai_drafting",
  "approved",
  "rejected",
];

const TAB_LABEL: Record<ConsultStatus, string> = {
  pending: "Pending",
  ai_drafting: "AI Drafting",
  ready_for_review: "Ready for Review",
  in_review: "In Review",
  needs_more_info: "Needs More Info",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};

function parseStatus(raw: string | undefined): ConsultStatus {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as ConsultStatus;
  }
  return "ready_for_review";
}

export default async function ConsultQueuePage({ searchParams }: PageProps) {
  const { status: rawStatus, id: selectedId } = await searchParams;
  const status = parseStatus(rawStatus);

  const [counts, items, selected] = await Promise.all([
    getConsultQueueCounts(),
    listQueueByStatus(status),
    selectedId ? getConsultForReview(selectedId) : Promise.resolve(null),
  ]);

  // Default to first item in list when nothing selected
  const activeId = selectedId ?? items[0]?.id ?? null;
  const activeConsult =
    selected ?? (activeId ? items.find((i) => i.id === activeId) ?? null : null);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consult Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 1차 검토 결과를 검토하고 승인하면 사용자에게 발송됩니다.
          </p>
        </div>
        <DeleteAllConsultsButton />
      </div>

      {/* Top stat strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Ready for Review"
          value={counts.ready_for_review}
          tone="primary"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="In Review"
          value={counts.in_review}
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Needs More Info"
          value={counts.needs_more_info}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Approved (24h)"
          value={counts.approved_today}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Tabs */}
      <nav className="mb-4 flex flex-wrap gap-1 border-b">
        {VALID_STATUSES.map((s) => {
          const active = s === status;
          const count = countFor(counts, s);
          return (
            <Link
              key={s}
              href={`/consult-queue?status=${s}`}
              className={`rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABEL[s]}{" "}
              {count !== null && (
                <span className="text-xs text-muted-foreground">({count})</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Inbox-style split: left list + right detail */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Left tab: consult list */}
        <aside className="lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto">
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No consults in this state.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((c) => (
                <ConsultListItem
                  key={c.id}
                  consult={c}
                  isActive={c.id === activeId}
                  status={status}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* Right panel: question + AI draft + actions */}
        <main className="min-w-0">
          {activeConsult ? (
            <ConsultDetailPanel consult={activeConsult} />
          ) : (
            <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              Select a consult on the left to review.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ConsultListItem({
  consult,
  isActive,
  status,
}: {
  consult: ConsultRecord;
  isActive: boolean;
  status: ConsultStatus;
}) {
  const text = (consult.rawInput.text as string | undefined) ?? "(photo only)";
  const submittedLabel = new Date(consult.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const photos = (consult.rawInput.photos as { url: string }[] | undefined) ?? [];

  return (
    <li>
      <Link
        href={`/consult-queue?status=${status}&id=${consult.id}`}
        className={`block rounded-md border p-3 transition-colors ${
          isActive
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {consult.email ?? consult.userId?.slice(0, 8) ?? "anon"}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm">{text}</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{submittedLabel}</span>
              {photos.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  📷 {photos.length}
                </Badge>
              )}
              <span className="capitalize">
                {consult.category.replace("_", " ")}
              </span>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {consult.isHighRisk && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" /> High
              </Badge>
            )}
            {consult.aiCompletedAt && (
              <Badge variant="outline" className="text-[10px]">
                AI ✓
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "primary" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "success"
        ? "border-emerald-300/40 bg-emerald-50/60"
        : "";
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function countFor(
  counts: Awaited<ReturnType<typeof getConsultQueueCounts>>,
  status: ConsultStatus
): number | null {
  switch (status) {
    case "pending":
      return counts.pending;
    case "ai_drafting":
      return counts.ai_drafting;
    case "ready_for_review":
      return counts.ready_for_review;
    case "in_review":
      return counts.in_review;
    case "needs_more_info":
      return counts.needs_more_info;
    default:
      return null;
  }
}
