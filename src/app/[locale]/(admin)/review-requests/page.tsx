import { listReviewRequests, type ReviewRequestStatus } from "@/lib/actions/lookup";
import { ReviewRequestsClient } from "./review-requests-client";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const VALID_STATUSES: readonly ReviewRequestStatus[] = [
  "pending",
  "in_progress",
  "done",
  "rejected",
] as const;

function parseStatus(raw: string | undefined): ReviewRequestStatus {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as ReviewRequestStatus;
  }
  return "pending";
}

export default async function ReviewRequestsPage({ searchParams }: PageProps) {
  const { status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);
  const requests = await listReviewRequests(status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Review Requests</h1>
        <p className="mt-2 text-muted-foreground">
          User-submitted products waiting for pharmacist curation. Each row
          links back to the exact query that failed or returned only FDA data.
        </p>
      </div>

      <ReviewRequestsClient
        initialRequests={requests}
        currentStatus={status}
      />
    </div>
  );
}
