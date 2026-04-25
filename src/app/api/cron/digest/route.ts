import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curateForSubscriber, type DigestItem } from "@/lib/digest/curate";
import { renderDigestHtml } from "@/lib/digest/render-email";
import { sendEmail } from "@/lib/messaging/send-email";
import { withCronReport } from "@/lib/messaging/with-cron-report";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Vercel hobby limit

interface RowSubscriber {
  id: number;
  email: string;
  frequency: string;
  unsub_token: string;
  user_id: string | null;
}

const PICKS_PER_FREQUENCY: Record<string, number> = {
  weekly: 4,
  "3x_week": 1,
  daily: 1,
  critical_only: 0, // handled by separate cron
};

// 0=Sun, 1=Mon, 2=Tue, ... 6=Sat (UTC-based; KST 09:00 = UTC 00:00 same day)
function shouldSendToday(frequency: string, todayUtcDay: number): boolean {
  switch (frequency) {
    case "weekly":
      return todayUtcDay === 1; // Monday
    case "3x_week":
      return todayUtcDay === 1 || todayUtcDay === 3 || todayUtcDay === 5;
    case "daily":
      return true;
    case "critical_only":
      return false;
    default:
      return false;
  }
}

function frequencyLabel(f: string): string {
  switch (f) {
    case "weekly":
      return "weekly";
    case "3x_week":
      return "tri-weekly";
    case "daily":
      return "daily";
    default:
      return "";
  }
}

async function digestHandler(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayUtcDay = new Date().getUTCDay();
  const admin = await createAdminClient();

  // Active subscribers due today by frequency
  const { data: subs, error: subErr } = await admin
    .from("email_subscribers")
    .select("id, email, frequency, unsub_token, user_id")
    .is("unsubscribed_at", null);
  if (subErr) {
    return NextResponse.json(
      { error: subErr.message, stage: "load_subscribers" },
      { status: 500 }
    );
  }

  const due = (subs ?? []).filter((s) =>
    shouldSendToday(s.frequency as string, todayUtcDay)
  ) as unknown as RowSubscriber[];

  let attempted = 0;
  let sent = 0;
  let skippedNoItems = 0;
  const failures: { email: string; error: string }[] = [];

  for (const sub of due) {
    attempted++;
    const limit = PICKS_PER_FREQUENCY[sub.frequency] ?? 1;

    let items: DigestItem[] = [];
    try {
      items = await curateForSubscriber(sub.id, {
        limit,
        sinceDays: sub.frequency === "weekly" ? 14 : 7,
        dedupeDays: 30,
      });
    } catch (err) {
      failures.push({
        email: sub.email,
        error: `curate: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    if (items.length === 0) {
      skippedNoItems++;
      continue;
    }

    const unsubUrl = `${SITE_URL}/api/unsubscribe/${encodeURIComponent(sub.unsub_token)}`;
    const { subject, html, text } = renderDigestHtml({
      items,
      unsubscribeUrl: unsubUrl,
      frequencyLabel: frequencyLabel(sub.frequency),
    });

    const result = await sendEmail({
      to: sub.email,
      subject,
      html,
      text,
      unsubscribeUrl: unsubUrl,
      tags: [
        { name: "kind", value: "digest" },
        { name: "frequency", value: sub.frequency },
      ],
    });

    if (!result.ok) {
      failures.push({ email: sub.email, error: result.error ?? "unknown" });
      continue;
    }

    // Log every item we successfully sent so we don't repeat for 30 days.
    const logRows = items.map((it) => ({
      subscriber_id: sub.id,
      item_url: it.url,
      item_kind: it.kind,
      item_slug: it.slug,
      channel: "email",
      resend_email_id: result.id ?? null,
    }));
    const { error: logErr } = await admin.from("digest_log").insert(logRows);
    if (logErr) {
      // Sent but logging failed — surface for monitoring but don't fail the run.
      failures.push({
        email: sub.email,
        error: `log_insert: ${logErr.message}`,
      });
    }
    sent++;
  }

  return NextResponse.json({
    ok: true,
    todayUtcDay,
    attempted,
    sent,
    skippedNoItems,
    failureCount: failures.length,
    failures: failures.slice(0, 20),
  });
}

export const GET = withCronReport("digest", digestHandler);
