import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { listPublicConsults, type ConsultRecord } from "@/lib/actions/consults";
import { Badge } from "@/components/ui/badge";
import type { ConsultDraft } from "@/lib/ai/draft-consult";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const metadata: Metadata = {
  title: "Community Q&A — AI PharmCare",
  description:
    "Pharmacist-reviewed questions and answers shared by the AI PharmCare community. Real medication, supplement, and skincare questions with science-backed answers.",
  alternates: { canonical: "/ask" },
  openGraph: {
    title: "Community Q&A — AI PharmCare",
    description:
      "Real pharmacist-reviewed answers to questions about medications, supplements, and skincare.",
    url: `${SITE_URL}/ask`,
    type: "website",
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  drug_interactions: "Drug Interactions",
  skin_care: "Skin Care",
  supplements: "Supplements",
  symptoms: "Symptoms",
  pregnancy: "Pregnancy",
  pediatric: "Pediatric",
  mental_health: "Mental Health",
  general: "General",
};

export default async function AskIndexPage() {
  const consults = await listPublicConsults({ limit: 50 });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <MessageCircleQuestion className="mt-1 h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Q&amp;A</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real questions from customers, answered by Younghun Cho, PharmD.
            Shared with permission to help others.
          </p>
        </div>
      </div>

      {consults.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-6 space-y-3">
          {consults.map((c) => (
            <QuestionRow key={c.id} consult={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
      <MessageCircleQuestion className="mx-auto h-10 w-10 text-muted-foreground/50" />
      <p className="mt-3 font-medium">No public questions yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Be the first to share your pharmacist consult publicly.
      </p>
    </div>
  );
}

function QuestionRow({ consult }: { consult: ConsultRecord }) {
  const final = consult.pharmacistFinal as ConsultDraft | null;
  const summary = final?.oneLineSummary ?? "Pharmacist-reviewed answer";
  const questionText =
    typeof consult.rawInput.text === "string"
      ? consult.rawInput.text
      : "(photo submission)";
  const categoryLabel = CATEGORY_LABEL[consult.category] ?? "General";

  return (
    <li>
      <Link
        href={`/ask/${consult.slug}`}
        className="group flex flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {categoryLabel}
          </Badge>
          <Badge className="gap-1 bg-primary/15 text-xs text-primary hover:bg-primary/20">
            <ShieldCheck className="h-3 w-3" />
            Pharmacist Reviewed
          </Badge>
          {consult.publishedAt && (
            <span className="text-xs text-muted-foreground">
              {formatDate(consult.publishedAt)}
            </span>
          )}
        </div>
        <h2 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
          {questionText.slice(0, 160)}
        </h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {summary}
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          Read full answer
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
