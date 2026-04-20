import Link from "next/link";
import { AlertTriangle, Clock, Pill } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ConsultRecord } from "@/lib/actions/consults";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import type { ArticleReference } from "@/lib/references/fetch-references";
import { enrichRecommendations } from "@/lib/actions/consult-recommendations";
import { ConsultReviewForm } from "./[id]/review-form";
import { DeleteConsultButton } from "./delete-button";

interface Props {
  consult: ConsultRecord;
}

export async function ConsultDetailPanel({ consult }: Props) {
  const text = (consult.rawInput.text as string) ?? "";
  const photos =
    (consult.rawInput.photos as { url: string }[] | undefined) ?? [];
  const draft = (consult.aiDraft as ConsultDraft | null) ?? null;
  const references =
    (consult.aiReferences as ArticleReference[] | null) ?? [];
  const recommendations =
    (consult.aiRecommendations as
      | { medicationId: number; name: string; slug: string; reason: string }[]
      | null) ?? [];
  const enriched = await enrichRecommendations(recommendations);

  return (
    <article className="rounded-md border bg-card">
      <header className="flex items-center justify-between gap-3 border-b p-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {consult.email ?? consult.userId?.slice(0, 8) ?? "anon"} ·{" "}
            {new Date(consult.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {consult.isHighRisk && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> High Risk
            </Badge>
          )}
          <Badge variant="outline" className="capitalize">
            {consult.status.replace(/_/g, " ")}
          </Badge>
          <DeleteConsultButton consultId={consult.id} />
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {/* LEFT: User input + photos + references + matched products */}
        <section className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Question
            </h3>
            {text ? (
              <p className="whitespace-pre-wrap text-sm">{text}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">(no text)</p>
            )}
          </div>

          {photos.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attached photos ({photos.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, idx) => (
                  <a
                    key={idx}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square overflow-hidden rounded-md border hover:border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Attachment ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {consult.profileSnapshot ? (
            <details className="rounded-md border bg-muted/30 p-2">
              <summary className="cursor-pointer text-xs font-medium">
                Profile at submission
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px]">
                {JSON.stringify(consult.profileSnapshot, null, 2)}
              </pre>
            </details>
          ) : null}

          {consult.stackSnapshot ? (
            <details className="rounded-md border bg-muted/30 p-2">
              <summary className="cursor-pointer text-xs font-medium">
                Stack at submission
              </summary>
              <pre className="mt-2 overflow-x-auto text-[10px]">
                {JSON.stringify(consult.stackSnapshot, null, 2)}
              </pre>
            </details>
          ) : null}

          {references.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                References gathered ({references.length})
              </h3>
              <ul className="space-y-1 text-xs">
                {references.map((r, idx) => (
                  <li key={idx}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      [{r.kind}] {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Product matches ({recommendations.length})
              </h3>
              <ul className="space-y-2 text-xs">
                {recommendations.map((r) => (
                  <li
                    key={r.medicationId}
                    className="flex items-start gap-2 rounded-md border bg-muted/30 p-2"
                  >
                    <Pill className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div>
                      <Link
                        href={`/analysis/${r.slug}`}
                        target="_blank"
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <p className="text-muted-foreground">{r.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* RIGHT: AI draft + edit + actions */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI draft answer (edit before approving)
          </h3>
          {!draft ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <Clock className="mx-auto mb-2 h-5 w-5 animate-pulse" />
              AI draft not ready yet. Reload in a moment.
            </div>
          ) : (
            <ConsultReviewForm
              consultId={consult.id}
              initialDraft={draft}
              enrichedRecommendations={enriched}
            />
          )}
        </section>
      </div>
    </article>
  );
}
