/**
 * ConsultMobileCta — inline CTA shown on homepage above Dr.'s Analysis,
 * mobile only. Desktop users already see ConsultSidebar in layout.
 *
 * Link destination depends on auth:
 *  - Signed in: /consult/new (PersonalConsultHero form page)
 *  - Signed out: /login?next=/consult/new (account gate)
 */

import Link from "next/link";
import { ArrowRight, ShieldCheck, LogIn } from "lucide-react";

interface ConsultMobileCtaProps {
  isAuthed: boolean;
}

export function ConsultMobileCta({ isAuthed }: ConsultMobileCtaProps) {
  const href = isAuthed
    ? "/consult/new"
    : `/login?next=${encodeURIComponent("/consult/new")}`;
  const ctaLabel = isAuthed ? "Ask now" : "Sign in to ask";
  const Icon = isAuthed ? ArrowRight : LogIn;

  return (
    <section className="px-4 pt-4 sm:px-6 lg:hidden">
      <div className="mx-auto max-w-4xl">
        <Link
          href={href}
          className="group flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-5 transition-colors hover:bg-primary/10"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Ask your pharmacist</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Your meds, supplements &amp; skincare — professionally reviewed by a
            licensed pharmacist.
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Reviewed by Younghun Cho, PharmD · Free
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2">
              <Icon className="h-4 w-4" />
              {ctaLabel}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
