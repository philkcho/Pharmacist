"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Search,
  RotateCcw,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  UserCircle2,
} from "lucide-react";
import {
  setSubscriberFrequency,
  unsubscribeSubscriber,
  reactivateSubscriber,
  deleteSubscriber,
  exportSubscribersCsv,
  type SubscribersSnapshot,
  type SubscriberFrequency,
  type SubscriberRow,
} from "@/lib/actions/subscribers";

const FREQUENCY_LABELS: Record<SubscriberFrequency, string> = {
  weekly: "Weekly",
  "3x_week": "3× / week",
  daily: "Daily",
  critical_only: "Critical only",
};

type StatusFilter = "all" | "active" | "unsubscribed";
type FrequencyFilter = "all" | SubscriberFrequency;

interface Props {
  initialSnapshot: SubscribersSnapshot;
}

export function SubscribersClient({ initialSnapshot }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [frequencyFilter, setFrequencyFilter] =
    useState<FrequencyFilter>("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const { rows, totals } = initialSnapshot;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "active" && r.unsubscribedAt) return false;
      if (statusFilter === "unsubscribed" && !r.unsubscribedAt) return false;
      if (frequencyFilter !== "all" && r.frequency !== frequencyFilter)
        return false;
      if (q && !r.email.toLowerCase().includes(q) && !r.source.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, query, statusFilter, frequencyFilter]);

  function runAction(id: number, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      setBusyId(null);
      router.refresh();
    });
  }

  function handleFrequencyChange(id: number, frequency: SubscriberFrequency) {
    runAction(id, () => setSubscriberFrequency(id, frequency));
  }

  function handleUnsubscribe(id: number, email: string) {
    if (!confirm(`Unsubscribe ${email}? They will stop receiving the digest.`))
      return;
    runAction(id, () => unsubscribeSubscriber(id));
  }

  function handleReactivate(id: number) {
    runAction(id, () => reactivateSubscriber(id));
  }

  function handleDelete(id: number, email: string) {
    if (
      !confirm(
        `Permanently delete ${email}? This cannot be undone (the row is removed entirely, not just unsubscribed).`
      )
    )
      return;
    runAction(id, () => deleteSubscriber(id));
  }

  async function handleExport() {
    setError(null);
    try {
      const csv = await exportSubscribersCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={totals.all} />
        <StatCard label="Active" value={totals.active} accent="emerald" />
        <StatCard
          label="Unsubscribed"
          value={totals.unsubscribed}
          accent="rose"
        />
        <StatCard
          label="Welcome pending"
          value={totals.welcomePending}
          hint="Will receive welcome on next subscribe API call"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(FREQUENCY_LABELS) as SubscriberFrequency[]).map((f) => (
          <StatCard
            key={f}
            label={FREQUENCY_LABELS[f]}
            value={totals.byFrequency[f] ?? 0}
            small
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-md border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search email or source…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="active">Active only</option>
          <option value="unsubscribed">Unsubscribed only</option>
          <option value="all">All</option>
        </select>
        <select
          value={frequencyFilter}
          onChange={(e) =>
            setFrequencyFilter(e.target.value as FrequencyFilter)
          }
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All frequencies</option>
          {(Object.keys(FREQUENCY_LABELS) as SubscriberFrequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          className="gap-1"
        >
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Frequency</th>
              <th className="px-3 py-2">Welcome</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Row
                key={row.id}
                row={row}
                busy={isPending && busyId === row.id}
                onFrequency={(f) => handleFrequencyChange(row.id, f)}
                onUnsubscribe={() => handleUnsubscribe(row.id, row.email)}
                onReactivate={() => handleReactivate(row.id)}
                onDelete={() => handleDelete(row.id, row.email)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No subscribers match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  busy,
  onFrequency,
  onUnsubscribe,
  onReactivate,
  onDelete,
}: {
  row: SubscriberRow;
  busy: boolean;
  onFrequency: (f: SubscriberFrequency) => void;
  onUnsubscribe: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const isUnsubscribed = !!row.unsubscribedAt;
  return (
    <tr
      className={`border-t transition-colors ${
        isUnsubscribed ? "bg-rose-50/30 text-muted-foreground" : "hover:bg-muted/30"
      }`}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{row.email}</span>
          {isUnsubscribed && (
            <Badge variant="outline" className="text-[10px] text-rose-600">
              Unsubscribed
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className="text-[10px]">
          {row.source}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <select
          value={row.frequency}
          onChange={(e) => onFrequency(e.target.value as SubscriberFrequency)}
          disabled={busy || isUnsubscribed}
          className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-60"
        >
          {(Object.keys(FREQUENCY_LABELS) as SubscriberFrequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-xs">
        {row.welcomeSentAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {new Date(row.welcomeSentAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <XCircle className="h-3.5 w-3.5" />
            pending
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.userId ? (
          <span
            className="inline-flex items-center gap-1 text-emerald-600"
            title={row.userId}
          >
            <UserCircle2 className="h-3.5 w-3.5" />
            linked
          </span>
        ) : (
          <span className="text-muted-foreground">guest</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isUnsubscribed ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onReactivate}
              disabled={busy}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reactivate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onUnsubscribe}
              disabled={busy}
            >
              Unsubscribe
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={busy}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            title="Delete row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  accent,
  hint,
  small,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "rose";
  hint?: string;
  small?: boolean;
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "rose"
        ? "text-rose-600"
        : "";
  return (
    <div
      className={`rounded-lg border bg-background p-3 ${small ? "" : "p-4"}`}
      title={hint}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 ${small ? "text-lg" : "text-2xl"} font-semibold ${tone}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
