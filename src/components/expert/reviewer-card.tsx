import { Mail } from "lucide-react";
import { SITE_AUTHOR } from "@/lib/author";

interface ReviewerCardProps {
  lastReviewedAt?: string | Date | null;
  className?: string;
}

// Deriving initials once from the canonical name keeps the component
// simple — SITE_AUTHOR intentionally exposes name + email only (no photo,
// no credentials) to respect the author's preferred minimal disclosure.
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
            Reviews every article and product analysis on AI PharmCare for
            accuracy against FDA labeling, peer-reviewed literature, and
            current pharmacy practice. AI-assisted drafts are not published
            without this review step.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <a
              href={`mailto:${SITE_AUTHOR.email}`}
              aria-label={`Email ${SITE_AUTHOR.name}`}
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              Email {SITE_AUTHOR.name.split(" ")[0]}
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
