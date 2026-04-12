import { listTrendsByStatus, type TrendStatus } from "@/lib/actions/trends";
import { TrendsClient } from "./trends-client";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const VALID_STATUSES: readonly TrendStatus[] = [
  "pending",
  "analyzing",
  "published",
  "rejected",
  "archived",
] as const;

function parseStatus(raw: string | undefined): TrendStatus {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as TrendStatus;
  }
  return "pending";
}

export default async function TrendsAdminPage({ searchParams }: PageProps) {
  const { status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);
  const trends = await listTrendsByStatus(status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Trends</h1>
        <p className="mt-2 text-muted-foreground">
          Weekly Google Trends ingestion queue. Phase B shows raw pending
          rows; Phase E will auto-analyze and auto-publish them.
        </p>
      </div>

      <TrendsClient initialTrends={trends} currentStatus={status} />
    </div>
  );
}
