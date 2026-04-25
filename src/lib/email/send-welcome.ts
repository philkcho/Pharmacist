import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/messaging/send-email";
import { renderWelcomeEmail } from "./render-welcome";
import { curateForSubscriber, type DigestItem } from "@/lib/digest/curate";
import { renderDigestHtml } from "@/lib/digest/render-email";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

interface SendWelcomeInput {
  email: string;
  source: string; // 'signup' | 'footer' | 'sheet' | 'card' | 'subscribe_page' | ...
  userId?: string | null;
  frequency?: string; // defaults to 'weekly'
}

interface SendWelcomeResult {
  ok: boolean;
  sent: boolean; // false if already sent earlier (idempotent skip)
  reason?: string;
  emailId?: string;
  digestItems?: number; // how many catch-up items the welcome included
}

// Catch-up digest knobs per frequency: how far back we look and how many
// items to include in the very first email so the user gets value
// immediately instead of waiting for the next cron cycle.
const CATCHUP_TUNING: Record<string, { sinceDays: number; limit: number }> = {
  weekly: { sinceDays: 14, limit: 4 },
  "3x_week": { sinceDays: 7, limit: 2 },
  daily: { sinceDays: 7, limit: 2 },
  critical_only: { sinceDays: 14, limit: 0 },
};

/**
 * Idempotent welcome email dispatcher.
 *
 * Ensures an email_subscribers row exists for `email` (creating one
 * with the given source if missing), then sends the welcome email
 * exactly once per address — guarded by `welcome_sent_at`.
 *
 * Safe to call from both /api/subscribe and /auth/callback. Failures
 * never throw upstream so the signup flow stays unblocked.
 */
export async function sendWelcomeEmail(
  input: SendWelcomeInput
): Promise<SendWelcomeResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, sent: false, reason: "invalid_email" };
  }

  const admin = createAdminClient();

  try {
    // 1) Ensure a subscriber row exists. If it already exists, leave
    //    the existing source/frequency intact (don't overwrite a user's
    //    explicit "daily" preference with "weekly" just because they
    //    later signed in). user_id is filled in if we have it.
    const { data: existing, error: lookupErr } = await admin
      .from("email_subscribers")
      .select("id, welcome_sent_at, unsub_token, user_id")
      .eq("email", email)
      .maybeSingle();

    if (lookupErr) {
      return { ok: false, sent: false, reason: `lookup: ${lookupErr.message}` };
    }

    let subscriberId: number;
    let unsubToken: string | null;

    if (!existing) {
      const { data: inserted, error: insertErr } = await admin
        .from("email_subscribers")
        .insert({
          email,
          source: input.source,
          frequency: input.frequency ?? "weekly",
          user_id: input.userId ?? null,
        })
        .select("id, welcome_sent_at, unsub_token")
        .single();

      if (insertErr || !inserted) {
        return {
          ok: false,
          sent: false,
          reason: `insert: ${insertErr?.message ?? "no row"}`,
        };
      }
      subscriberId = inserted.id as number;
      unsubToken = (inserted.unsub_token as string | null) ?? null;
    } else {
      subscriberId = existing.id as number;
      unsubToken = (existing.unsub_token as string | null) ?? null;

      // Idempotent skip — already welcomed.
      if (existing.welcome_sent_at) {
        return { ok: true, sent: false, reason: "already_sent" };
      }

      // Backfill user_id if we now have one and the row was anonymous.
      if (input.userId && !existing.user_id) {
        await admin
          .from("email_subscribers")
          .update({ user_id: input.userId })
          .eq("id", subscriberId);
      }
    }

    // 2) Render + send. Try a catch-up digest first so the user gets
    //    last week's picks immediately; fall back to a plain welcome
    //    if the curate pool is empty (e.g. brand-new install with no
    //    published content).
    const unsubscribeUrl = unsubToken
      ? `${SITE_URL}/api/unsubscribe/${encodeURIComponent(unsubToken)}`
      : undefined;

    const frequency = input.frequency ?? "weekly";
    const tuning = CATCHUP_TUNING[frequency] ?? CATCHUP_TUNING.weekly;

    let items: DigestItem[] = [];
    if (tuning.limit > 0) {
      try {
        items = await curateForSubscriber(subscriberId, {
          limit: tuning.limit,
          sinceDays: tuning.sinceDays,
          dedupeDays: 30,
        });
      } catch (err) {
        // Curate failure shouldn't block the welcome — just fall back.
        console.error(
          "[send-welcome] curate failed, falling back to plain welcome:",
          err instanceof Error ? err.message : err
        );
      }
    }

    let subject: string;
    let html: string;
    let text: string;
    let kind: "welcome" | "welcome_catchup";

    if (items.length > 0) {
      kind = "welcome_catchup";
      const greeting =
        "Welcome — you're in! Here are last week's pharmacist-curated picks to get you started. Your regular digest will follow on its normal schedule.";
      const rendered = renderDigestHtml({
        items,
        unsubscribeUrl: unsubscribeUrl ?? `${SITE_URL}/`,
        frequencyLabel: frequency === "weekly" ? "weekly" : frequency,
        greeting,
      });
      // Override the subject so the very first email reads like a welcome,
      // not yet another digest edition.
      subject = `Welcome to AI PharmCare — last week's picks inside`;
      html = rendered.html;
      text = rendered.text;
    } else {
      kind = "welcome";
      const rendered = renderWelcomeEmail({ email, unsubscribeUrl });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      unsubscribeUrl,
      tags: [
        { name: "kind", value: kind },
        { name: "source", value: input.source.replace(/[^a-zA-Z0-9_-]/g, "_") },
      ],
    });

    if (!result.ok) {
      return { ok: false, sent: false, reason: result.error };
    }

    // 3) Stamp welcome_sent_at so we never re-send the welcome edition,
    //    and log every catch-up item against the subscriber so the
    //    next regular digest cycle won't repeat them (30-day dedup).
    await admin
      .from("email_subscribers")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", subscriberId);

    if (items.length > 0) {
      const logRows = items.map((it) => ({
        subscriber_id: subscriberId,
        item_url: it.url,
        item_kind: it.kind,
        item_slug: it.slug,
        channel: "email",
        resend_email_id: result.id ?? null,
      }));
      const { error: logErr } = await admin.from("digest_log").insert(logRows);
      if (logErr) {
        console.error(
          "[send-welcome] digest_log insert failed:",
          logErr.message
        );
      }
    }

    return {
      ok: true,
      sent: true,
      emailId: result.id,
      digestItems: items.length,
    };
  } catch (err) {
    return {
      ok: false,
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
