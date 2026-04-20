"use client";

/**
 * ConsultCard — a single row on /consult (My questions).
 *
 * Header + question are always visible. For answered consults, the full
 * pharmacist answer (DraftBody + picks + references + publish toggle) is
 * collapsible behind a "View answer" toggle to keep a long list scannable.
 * Auto-expands when the URL hash matches the card id or when the card is
 * marked defaultOpen (e.g. the most recent answered consult).
 */

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DraftBody } from "@/components/consult/draft-body";
import { PharmacistPickCard } from "@/components/consult/pharmacist-pick-card";
import { ReferencesSection } from "@/components/seo/references-section";
import { ReviewerByline } from "@/components/ui/reviewer-byline";
import { PublishToggle } from "@/app/[locale]/(public)/consult/[id]/publish-toggle";
import type { ConsultRecord } from "@/lib/actions/consults";
import type { EnrichedRecommendation } from "@/lib/actions/consult-recommendations";
import type { DraftPickEnrichment } from "@/lib/actions/enrich-draft-picks";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import type { ArticleReference } from "@/lib/references/fetch-references";

interface ConsultCardProps {
  consult: ConsultRecord;
  finalAnswer: ConsultDraft | null;
  references: ArticleReference[];
  recommendations: EnrichedRecommendation[];
  enrichedPicks: DraftPickEnrichment[];
  defaultOpen: boolean;
}

export function ConsultCard({
  consult,
  finalAnswer,
  references,
  recommendations,
  enrichedPicks,
  defaultOpen,
}: ConsultCardProps) {
  const answered = !!finalAnswer;
  const [open, setOpen] = useState(defaultOpen);
  const photos = consult.rawInput.photos ?? [];

  // Auto-expand when landing via /consult#<id>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (hash && hash === consult.id) {
      setOpen(true);
      // Smooth scroll into view after expansion renders
      requestAnimationFrame(() => {
        document.getElementById(consult.id)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [consult.id]);

  return (
    <article
      id={consult.id}
      className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-sm"
    >
      {/* Header: status + date */}
      <div className="flex flex-wrap items-center gap-2">
        {answered ? (
          <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20">
            <CheckCircle2 className="h-3 w-3" />
            Answered
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3 animate-pulse" />
            Awaiting pharmacist
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {formatDate(consult.createdAt)}
        </span>
      </div>

      {/* Question body */}
      <div className="mt-3 rounded-xl bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground">You asked</p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm">
          {(consult.rawInput.text as string) ?? "(photo or voice submission)"}
        </p>
        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.map((p, idx) => (
              <a
                key={idx}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-20 w-20 overflow-hidden rounded-md border bg-background transition-opacity hover:opacity-90"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.alt ?? `Question photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Answer (collapsible) or waiting block */}
      {answered ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-4 inline-flex w-full items-center justify-between rounded-lg border bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            aria-expanded={open}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              {open ? "Hide pharmacist's answer" : "View pharmacist's answer"}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <div className="mt-4">
              <div className="rounded-xl border-2 border-primary/40 bg-background p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  Pharmacist-Reviewed Answer
                </div>
                {consult.reviewedAt && (
                  <ReviewerByline lastReviewedAt={consult.reviewedAt} />
                )}
                <DraftBody
                  draft={finalAnswer!}
                  enrichedPicks={enrichedPicks}
                  className="mt-4"
                />
              </div>

              {recommendations.length > 0 && (
                <section className="mt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-bold">
                      Pharmacist&apos;s Picks for You
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recommendations.map((rec) => (
                      <PharmacistPickCard
                        key={rec.medicationId}
                        recommendation={rec}
                      />
                    ))}
                  </div>
                </section>
              )}

              {references.length > 0 && (
                <ReferencesSection references={references} className="mt-6" />
              )}

              {(consult.visibility === "private" ||
                consult.visibility === "public") && (
                <PublishToggle
                  consultId={consult.id}
                  visibility={consult.visibility}
                  slug={consult.slug}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed bg-muted/20 p-4 text-center">
          <Clock className="mx-auto h-5 w-5 animate-pulse text-primary" />
          <p className="mt-2 text-sm font-medium">Waiting for the pharmacist</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Younghun Cho, PharmD, will reply within 48 hours. We&apos;ll email
            you the moment it&apos;s ready.
          </p>
        </div>
      )}
    </article>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
