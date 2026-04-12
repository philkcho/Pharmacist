import {
  getApprovalQueue,
  getApprovalCounts,
  type ApprovalStatus,
} from "@/lib/actions/medications";
import { ApprovalQueueClient } from "./approval-queue-client";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const VALID: readonly ApprovalStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
];

function parseStatus(raw: string | undefined): ApprovalStatus {
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as ApprovalStatus;
  }
  return "draft";
}

export default async function ApprovalQueuePage({
  searchParams,
}: PageProps) {
  const { status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);
  const [products, counts] = await Promise.all([
    getApprovalQueue(status),
    getApprovalCounts(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
        <p className="mt-2 text-muted-foreground">
          Review and approve products before they appear on the public site.
          Only approved products are shown to users.
        </p>
      </div>
      <ApprovalQueueClient
        initialProducts={products}
        currentStatus={status}
        counts={counts}
      />
    </div>
  );
}
