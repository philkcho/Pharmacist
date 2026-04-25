import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

interface TemplateMeta {
  slug: string;
  title: string;
  description: string;
  trigger: string;
}

const TEMPLATES: TemplateMeta[] = [
  {
    slug: "welcome",
    title: "Welcome Email",
    description:
      "Sent automatically the first time a customer registers — covers both auth signup and the email subscribe form.",
    trigger:
      "Triggers: POST /api/subscribe and /auth/callback (idempotent via welcome_sent_at).",
  },
];

async function getWelcomeStats() {
  const admin = createAdminClient();

  const [{ count: totalSubscribers }, { count: welcomedCount }] =
    await Promise.all([
      admin
        .from("email_subscribers")
        .select("id", { count: "exact", head: true })
        .is("unsubscribed_at", null),
      admin
        .from("email_subscribers")
        .select("id", { count: "exact", head: true })
        .not("welcome_sent_at", "is", null),
    ]);

  return {
    activeSubscribers: totalSubscribers ?? 0,
    welcomedTotal: welcomedCount ?? 0,
  };
}

export default async function EmailTemplatesPage() {
  const stats = await getWelcomeStats();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
        <p className="mt-2 text-muted-foreground">
          Preview the transactional emails the site sends to customers. Use the
          test send button on each template to verify rendering in your inbox.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatBox label="Active subscribers" value={stats.activeSubscribers} />
        <StatBox
          label="Welcome emails sent"
          value={stats.welcomedTotal}
          sub="all-time"
        />
      </div>

      <div className="space-y-3">
        {TEMPLATES.map((tpl) => (
          <Link
            key={tpl.slug}
            href={`/email-templates/${tpl.slug}`}
            className="group flex items-start justify-between gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{tpl.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tpl.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {tpl.trigger}
                </p>
              </div>
            </div>
            <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
