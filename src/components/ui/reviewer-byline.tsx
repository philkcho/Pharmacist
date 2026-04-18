import { SITE_AUTHOR } from "@/lib/author";

// Reviewer credit line shown on every article-type page.
// Renders name + optional "Last reviewed" date + LinkedIn icon link.
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

// Inline LinkedIn glyph — lucide-react doesn't ship brand icons.
function LinkedinIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.37-1.852 3.602 0 4.268 2.37 4.268 5.455v6.288zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
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
          href={SITE_AUTHOR.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
        >
          {SITE_AUTHOR.name}
          <LinkedinIcon className="h-3.5 w-3.5" />
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
