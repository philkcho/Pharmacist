import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { renderWelcomeEmail } from "@/lib/email/render-welcome";
import { WelcomeTestSend } from "./welcome-test-send";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

const VARIANTS = [
  {
    mode: "signup" as const,
    label: "Signup",
    description:
      "Sent to a new account holder. Pitches the weekly newsletter with a Subscribe CTA.",
  },
  {
    mode: "subscribed" as const,
    label: "Subscribed (fallback)",
    description:
      "Sent when someone subscribes via the form but the curate pool has no items. Confirms the subscription instead of pitching it.",
  },
];

export default async function WelcomeTemplatePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeMode: "signup" | "subscribed" =
    params.mode === "subscribed" ? "subscribed" : "signup";
  const activeVariant =
    VARIANTS.find((v) => v.mode === activeMode) ?? VARIANTS[0];

  const sample = renderWelcomeEmail({
    email: "preview@example.com",
    unsubscribeUrl: `${SITE_URL}/api/unsubscribe/SAMPLE_TOKEN`,
    mode: activeMode,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/email-templates"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All templates
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Welcome Email</h1>
        <p className="mt-2 text-muted-foreground">
          Sent once per email address on first signup or subscribe. Idempotent
          via <code className="rounded bg-muted px-1 py-0.5 text-xs">email_subscribers.welcome_sent_at</code>.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-1">
        {VARIANTS.map((v) => {
          const active = v.mode === activeMode;
          return (
            <Link
              key={v.mode}
              href={`/email-templates/welcome?mode=${v.mode}`}
              className={
                "flex-1 min-w-[180px] rounded-md px-3 py-2 text-center text-sm font-medium transition-colors " +
                (active
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {activeVariant.description}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <MetaCard label="Subject line" value={sample.subject} />
        <MetaCard
          label="From"
          value={
            (process.env.RESEND_FROM_EMAIL ?? "hello@aipharmcare.com") +
            "  (Resend)"
          }
        />
      </div>

      <section className="mb-6 rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-sm font-semibold">HTML preview</h2>
          <span className="text-xs text-muted-foreground">
            Rendered as the customer&apos;s mail client receives it
          </span>
        </header>
        <iframe
          title="Welcome email HTML preview"
          srcDoc={sample.html}
          className="h-[720px] w-full bg-[#f8fafc]"
          sandbox=""
        />
      </section>

      <section className="mb-6 rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-sm font-semibold">Plain-text fallback</h2>
          <span className="text-xs text-muted-foreground">
            Used by clients that block HTML
          </span>
        </header>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-muted-foreground">
          {sample.text}
        </pre>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Test send</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends a one-off copy of the <strong>{activeVariant.label}</strong>{" "}
          variant to any address. Does not touch the welcome_sent_at gate, so
          the recipient still gets the real welcome on their next
          signup/subscribe if they&apos;re new.
        </p>
        <WelcomeTestSend mode={activeMode} />
      </section>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  );
}
