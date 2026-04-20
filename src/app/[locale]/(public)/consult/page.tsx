import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listMyConsults } from "@/lib/actions/consults";
import { enrichRecommendations } from "@/lib/actions/consult-recommendations";
import { enrichDraftProductPicks } from "@/lib/actions/enrich-draft-picks";
import { Button } from "@/components/ui/button";
import { ConsultCard } from "@/components/consult/consult-card";
import type { ConsultDraft } from "@/lib/ai/draft-consult";
import type { ArticleReference } from "@/lib/references/fetch-references";

export const metadata: Metadata = {
  title: "My Questions — Dr.pharmacist",
  description: "Your pharmacist consult history and answers.",
  alternates: { canonical: "/consult" },
  robots: { index: false, follow: false },
};

export default async function MyConsultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/consult")}`);
  }

  const consults = await listMyConsults();

  // Pre-enrich each consult's recommendations so the client card stays lean.
  const prepared = await Promise.all(
    consults.map(async (c) => {
      const finalAnswer = (c.pharmacistFinal as ConsultDraft | null) ?? null;
      const references =
        (c.aiReferences as ArticleReference[] | null) ?? [];
      const rawRecs =
        (c.aiRecommendations as
          | {
              medicationId: number;
              name: string;
              slug: string;
              reason: string;
            }[]
          | null) ?? [];
      const recommendations = finalAnswer
        ? await enrichRecommendations(rawRecs)
        : [];
      const enrichedPicks = finalAnswer
        ? await enrichDraftProductPicks(finalAnswer.productRecommendations ?? [])
        : [];
      return { consult: c, finalAnswer, references, recommendations, enrichedPicks };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your consult history with Younghun Cho, PharmD.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          render={<Link href="/consult/new" />}
        >
          Ask new question
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {prepared.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 space-y-4">
          {prepared.map((item) => (
            <ConsultCard
              key={item.consult.id}
              consult={item.consult}
              finalAnswer={item.finalAnswer}
              references={item.references}
              recommendations={item.recommendations}
              enrichedPicks={item.enrichedPicks}
              defaultOpen={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
      <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
      <p className="mt-3 font-medium">No questions yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit a question to the pharmacist to get your first answer.
      </p>
      <Button
        size="sm"
        className="mt-4 gap-1.5"
        render={<Link href="/consult/new" />}
      >
        Ask a question
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
