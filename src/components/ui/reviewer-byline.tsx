import { Mail } from "lucide-react";
import { SITE_AUTHOR } from "@/lib/author";

// Reviewer credit line shown on every article-type page.
// Renders name + optional "Last reviewed" date + email mailto link.
// Paired with Article.author / Article.reviewedBy JSON-LD so the
// on-page signal matches the structured data Google reads.

interface ReviewerBylineProps {
  lastReviewedAt?: string | Date | null;
  className?: string;
}

function formatReviewedDate(value: string | Date): string | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ReviewerByline({ lastReviewedAt, className = "" }: ReviewerBylineProps) {
  const reviewedDate = lastReviewedAt ? formatReviewedDate(lastReviewedAt) : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground ${className}`}
    >
      <span>
        Reviewed by{" "}
        <a
          href={`mailto:${SITE_AUTHOR.email}`}
          aria-label={`Email ${SITE_AUTHOR.honorific} ${SITE_AUTHOR.name}`}
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
        >
          {SITE_AUTHOR.honorific} {SITE_AUTHOR.name}
          <Mail className="h-3.5 w-3.5" />
        </a>
      </span>
      {reviewedDate && (
        <>
          <span aria-hidden="true">·</span>
          <span>Last reviewed {reviewedDate}</span>
        </>
      )}
    </div>
  );
}
