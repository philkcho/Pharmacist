import { BookOpen, ExternalLink } from "lucide-react";
import type { ArticleReference } from "@/lib/references/fetch-references";

interface ReferencesSectionProps {
  references: ArticleReference[] | null | undefined;
  className?: string;
}

// Shared References block for /is-safe, /ingredients, /vs, and any
// other YMYL article type. Renders a numbered ol with the retrieved
// PubMed / FDA citations. Null-safe so older cached articles without
// a `references` field simply render nothing.
export function ReferencesSection({
  references,
  className = "",
}: ReferencesSectionProps) {
  if (!references || references.length === 0) return null;

  return (
    <section className={`mb-8 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
        <BookOpen className="h-5 w-5 text-primary" />
        References
      </h2>
      <ol className="space-y-3 text-sm">
        {references.map((ref, i) => (
          <li key={`${ref.url}-${i}`} className="flex gap-3">
            <span className="font-semibold text-muted-foreground">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1 font-medium text-foreground hover:text-primary hover:underline"
              >
                {ref.title}
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              </a>
              {ref.citation && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ref.citation}
                  {" · "}
                  <span className="uppercase tracking-wider">
                    {ref.kind === "pubmed" ? "PubMed" : "FDA"}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
