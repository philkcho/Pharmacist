import { SITE_AUTHOR } from "@/lib/author";

interface ReviewerCardProps {
  lastReviewedAt?: string | Date | null;
  className?: string;
}

// Deriving initials once from the canonical name keeps the component
// simple (SITE_AUTHOR currently exposes only name + linkedinUrl by
// design — no photo, no credentials shown to respect the author's
// preferred minimal disclosure).
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || name.slice(0, 2).toUpperCase();
}

function formatDate(value: string | Date): string | null {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

// Full reviewer attribution block for the article footer. Mirrors the
// Article.author / reviewedBy JSON-LD emitted upstream so the on-page
// signal matches the structured data Google indexes.
export function ReviewerCard({
  lastReviewedAt,
  className = "",
}: ReviewerCardProps) {
  const reviewedDate = lastReviewedAt ? formatDate(lastReviewedAt) : null;
  const initials = initialsFrom(SITE_AUTHOR.name);

  return (
    <section
      className={`rounded-2xl border bg-muted/20 p-6 sm:p-7 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        About the Reviewer
      </p>
      <div className="mt-4 flex items-start gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold leading-tight">
            {SITE_AUTHOR.name}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Reviews every article and product analysis on Dr.pharmacist for
            accuracy against FDA labeling, peer-reviewed literature, and
            current pharmacy practice. AI-assisted drafts are not published
            without this review step.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <a
              href={SITE_AUTHOR.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <LinkedinIcon className="h-3.5 w-3.5" />
              LinkedIn profile
            </a>
            {reviewedDate && (
              <>
                <span className="text-muted-foreground" aria-hidden="true">
                  ·
                </span>
                <span className="text-muted-foreground">
                  Last reviewed {reviewedDate}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
