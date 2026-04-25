import type { Metadata } from "next";
import { Bell, ShieldCheck, Mail, Sparkles } from "lucide-react";
import { SubscribeForm } from "@/components/subscribe/subscribe-form";
import { SITE_AUTHOR } from "@/lib/author";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const metadata: Metadata = {
  title: "Get Pharmacist-Curated Picks — AI PharmCare",
  description:
    "A weekly digest of trending health and beauty products, reviewed by a real pharmacist. No spam — unsubscribe in one click.",
  alternates: { canonical: `${SITE_URL}/subscribe` },
  openGraph: {
    title: "Get Pharmacist-Curated Picks — AI PharmCare",
    description:
      "Weekly digest of pharmacist-reviewed health & beauty products. Free.",
    url: `${SITE_URL}/subscribe`,
    type: "website",
  },
};

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Get pharmacist-curated picks
        </h1>
        <p className="mt-4 text-muted-foreground">
          A short, smart digest of trending health and beauty products —
          reviewed by a real pharmacist. We read the science so you don&apos;t
          have to.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border bg-card p-6 sm:p-8">
        <SubscribeForm source="subscribe_page" />
      </div>

      <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
        <li className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Reviewed by <strong>{SITE_AUTHOR.displayName}</strong>. Every pick
            cites FDA data and PubMed research where applicable.
          </span>
        </li>
        <li className="flex gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong>Weekly is the default</strong> (Monday delivery).
            You can switch to daily or critical-only later in settings.
          </span>
        </li>
        <li className="flex gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            One-click unsubscribe at the bottom of every email. No spam, no
            list-selling — ever.
          </span>
        </li>
      </ul>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        By subscribing you agree to our{" "}
        <a href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/terms" className="underline hover:text-foreground">
          Terms
        </a>
        .
      </p>
    </div>
  );
}
