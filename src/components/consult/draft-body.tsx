/**
 * Renders a ConsultDraft in the customer-facing format.
 * Shared between /consult/[id] (user view) and /admin/consult-queue
 * (pharmacist preview), so the pharmacist sees exactly what the user
 * will see and can edit JSON beneath the preview.
 */

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Pill, ShoppingCart, Search } from "lucide-react";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import type { DraftPickEnrichment } from "@/lib/actions/enrich-draft-picks";

export function DraftBody({
  draft,
  enrichedPicks,
  className = "",
}: {
  draft: ConsultDraft;
  enrichedPicks?: DraftPickEnrichment[];
  className?: string;
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      {draft.oneLineSummary && (
        <p className="text-base font-medium">{draft.oneLineSummary}</p>
      )}

      {draft.interactions.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Interactions found
          </h3>
          <ul className="space-y-3">
            {draft.interactions.map((i, idx) => (
              <li
                key={idx}
                className={`rounded-md border p-3 text-sm ${
                  i.severity === "high"
                    ? "border-destructive/40 bg-destructive/5"
                    : i.severity === "moderate"
                      ? "border-amber-300/60 bg-amber-50/60"
                      : "border-muted bg-muted/40"
                }`}
              >
                <div className="font-medium">
                  {i.items.join(" + ")}{" "}
                  <span className="text-xs font-normal uppercase text-muted-foreground">
                    · {i.severity}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{i.description}</p>
                <p className="mt-1">
                  <span className="font-medium">What to do: </span>
                  {i.mitigation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.stackReview.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your stack — pharmacist take
          </h3>
          <ul className="space-y-2 text-sm">
            {draft.stackReview.map((s, idx) => (
              <li key={idx}>
                <span className="font-medium">{s.item}: </span>
                {s.verdict}
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.routine.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Optimal routine
          </h3>
          <ul className="space-y-1 text-sm">
            {draft.routine.map((r, idx) => (
              <li key={idx}>
                <span className="font-medium capitalize">
                  {r.time.replace("_", " ")}:{" "}
                </span>
                {r.action}
                {r.rationale && (
                  <span className="text-muted-foreground"> — {r.rationale}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(draft.doRecommendations.length > 0 ||
        draft.dontRecommendations.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.doRecommendations.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-600">
                Do
              </h3>
              <ul className="space-y-1 text-sm">
                {draft.doRecommendations.map((d, idx) => (
                  <li key={idx} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft.dontRecommendations.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-destructive">
                Avoid
              </h3>
              <ul className="space-y-1 text-sm">
                {draft.dontRecommendations.map((d, idx) => (
                  <li key={idx} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {draft.productRecommendations.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pharmacist&apos;s product picks
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {draft.productRecommendations.map((p, idx) => {
              const enriched = enrichedPicks?.[idx];
              return (
                <ProductPickCard
                  key={idx}
                  pick={p}
                  enriched={enriched}
                />
              );
            })}
          </ul>
        </div>
      )}

      {draft.followUpQuestions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pharmacist may ask
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {draft.followUpQuestions.map((q, idx) => (
              <li key={idx}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.disclaimer && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {draft.disclaimer}
        </p>
      )}
    </div>
  );
}

function ProductPickCard({
  pick,
  enriched,
}: {
  pick: { name: string; reason: string; ingredientFocus?: string };
  enriched?: DraftPickEnrichment;
}) {
  const match = enriched?.match;
  const dbLinks = enriched?.purchaseLinks ?? [];
  const amazonUrl = enriched?.amazonSearchUrl;
  const iherbUrl = enriched?.iherbSearchUrl;

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex gap-3 p-3">
        {/* Image or placeholder */}
        {match?.imageUrl ? (
          <Link
            href={`/analysis/${match.slug}`}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
          >
            <Image
              src={match.imageUrl}
              alt={pick.name}
              fill
              sizes="80px"
              className="object-cover"
            />
          </Link>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted">
            <Pill className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {match ? (
            <Link
              href={`/analysis/${match.slug}`}
              className="line-clamp-2 block text-sm font-semibold leading-snug hover:text-primary"
            >
              {pick.name}
            </Link>
          ) : (
            <p className="line-clamp-2 text-sm font-semibold leading-snug">
              {pick.name}
            </p>
          )}
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
            {pick.reason}
          </p>
          {pick.ingredientFocus && (
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Key: {pick.ingredientFocus}
            </p>
          )}
        </div>
      </div>

      {/* Purchase links */}
      <div className="flex gap-2 border-t bg-muted/20 p-2 text-xs">
        {dbLinks.length > 0
          ? dbLinks.map((l) => (
              <a
                key={l.linkId}
                href={`/api/click/${l.linkId}?ref=consult_answer`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ShoppingCart className="h-3 w-3" />
                {l.retailerName}
              </a>
            ))
          : (
              <>
                {amazonUrl && (
                  <a
                    href={amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Search className="h-3 w-3" />
                    Amazon
                  </a>
                )}
                {iherbUrl && (
                  <a
                    href={iherbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Search className="h-3 w-3" />
                    iHerb
                  </a>
                )}
              </>
            )}
      </div>
    </li>
  );
}
