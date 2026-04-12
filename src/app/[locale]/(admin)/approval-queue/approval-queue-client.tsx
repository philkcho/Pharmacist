"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Check,
  X,
  Loader2,
  Pill,
  Sparkles,
  FlaskConical,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import {
  approveProduct,
  rejectProduct,
  type ApprovalQueueRow,
  type ApprovalStatus,
} from "@/lib/actions/medications";

interface Props {
  initialProducts: ApprovalQueueRow[];
  currentStatus: ApprovalStatus;
  counts: Record<ApprovalStatus, number>;
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  otc_drug: "OTC Drug",
  supplement: "Supplement",
  cosmetic: "Cosmetic",
  quasi_drug: "Quasi-drug",
};

const PRODUCT_TYPE_COLORS: Record<string, string> = {
  otc_drug: "border-blue-300 text-blue-700",
  supplement: "border-green-300 text-green-700",
  cosmetic: "border-pink-300 text-pink-700",
  quasi_drug: "border-purple-300 text-purple-700",
};

export function ApprovalQueueClient({
  initialProducts,
  currentStatus,
  counts,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApprove(id: number) {
    startTransition(async () => {
      const result = await approveProduct(id);
      if (result.ok) router.refresh();
    });
  }

  function handleReject(id: number) {
    if (!confirm("Reject this product? It will not be shown to users."))
      return;
    startTransition(async () => {
      const result = await rejectProduct(id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      {/* Status tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as ApprovalStatus[]).map((s) => (
          <Link
            key={s}
            href={`/approval-queue?status=${s}`}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              s === currentStatus
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {STATUS_LABELS[s]}{" "}
            <span className="ml-1 font-mono text-xs opacity-70">
              {counts[s]}
            </span>
          </Link>
        ))}
      </div>

      {/* Product cards */}
      {initialProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Pill className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2">
              No products with status &ldquo;{STATUS_LABELS[currentStatus]}
              &rdquo;
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {initialProducts.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.genericName && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {p.genericName}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${PRODUCT_TYPE_COLORS[p.productType] ?? ""}`}
                      >
                        {PRODUCT_TYPE_LABELS[p.productType] ?? p.productType}
                      </Badge>
                      {p.categoryName && (
                        <Badge variant="secondary" className="text-xs">
                          {p.categoryName}
                        </Badge>
                      )}
                      {p.source && (
                        <Badge variant="outline" className="text-xs">
                          {p.source === "fda" ? (
                            <>
                              <Pill className="mr-1 h-3 w-3" /> FDA
                            </>
                          ) : p.externalSource === "obf" ? (
                            <>
                              <Sparkles className="mr-1 h-3 w-3" /> Open Beauty
                              Facts
                            </>
                          ) : (
                            p.source
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Image thumbnail */}
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-16 w-16 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {/* Details */}
                <div className="space-y-2 text-sm">
                  {p.description && (
                    <p className="text-muted-foreground">
                      {p.description.length > 200
                        ? p.description.slice(0, 200) + "..."
                        : p.description}
                    </p>
                  )}
                  {p.brandNames && p.brandNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.brandNames.map((b, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {p.inciList && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        <FlaskConical className="mr-1 inline h-3 w-3" />
                        INCI:
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.inciList.length > 200
                          ? p.inciList.slice(0, 200) + "..."
                          : p.inciList}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Added{" "}
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  {(currentStatus === "draft" ||
                    currentStatus === "pending_review" ||
                    currentStatus === "rejected") && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(p.id)}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                  )}
                  {currentStatus !== "rejected" &&
                    currentStatus !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(p.id)}
                        disabled={isPending}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    )}
                  <Link
                    href={`/medications`}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="mr-1 inline h-3 w-3" />
                    Edit details
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
