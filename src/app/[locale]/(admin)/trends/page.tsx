import {
  listAdminTrends,
  type AdminTrendFilter,
} from "@/lib/actions/trends";
import { TrendsClient } from "./trends-client";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

const VALID_FILTERS: readonly AdminTrendFilter[] = [
  "pending_review",
  "live",
  "pending",
  "analyzing",
  "rejected",
  "archived",
] as const;

function parseFilter(raw: string | undefined): AdminTrendFilter {
  if (raw && (VALID_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminTrendFilter;
  }
  return "pending_review";
}

export default async function TrendsAdminPage({ searchParams }: PageProps) {
  const { filter: rawFilter } = await searchParams;
  const filter = parseFilter(rawFilter);
  const trends = await listAdminTrends(filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Trends</h1>
        <p className="mt-2 text-muted-foreground">
          AI analyzes Google Trends queries, then posts wait for pharmacist
          approval before appearing on the homepage. Review each draft, then
          Publish or Reject.
        </p>
      </div>

      <TrendsClient initialTrends={trends} currentFilter={filter} />
    </div>
  );
}
