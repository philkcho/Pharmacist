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
  /**
   * `signup`     — account creation flow. User is NOT yet on the newsletter,
   *                so we send the plain welcome with a Subscribe CTA. Catch-up
   *                digest is intentionally skipped — they didn't subscribe.
   * `subscribed` — subscribe form flow. Send the catch-up digest if curate
   *                has items, otherwise fall back to a confirmation welcome
   *                that does NOT pitch another subscription.
   */
  mode?: "signup" | "subscribed";
}

interface SendWelcomeResult {
  ok: boolean;
  sent: boolean; // false if already sent earlier (idempotent skip)
  reason?: string;
  emailId?: string;
  digestItems?: number; // how many catch-up items the welcome included
}

// Catch-up digest knobs: how far back we look and how many items to
// include in the very first email so a brand-new subscriber gets value
// immediately instead of waiting until the next Monday.
const CATCHUP_TUNING = { sinceDays: 14, limit: 4 } as const;

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

    // 2) Render + send.
    //    - mode 'signup'     → plain welcome with Subscribe CTA. Catch-up
    //                          digest is intentionally skipped — the user
    //                          hasn't opted into the newsletter yet.
    //    - mode 'subscribed' → catch-up digest if curate has items, else
    //                          a confirmation welcome (no Subscribe CTA).
    const unsubscribeUrl = unsubToken
      ? `${SITE_URL}/api/unsubscribe/${encodeURIComponent(unsubToken)}`
      : undefined;

    const mode = input.mode ?? "signup";

    let items: DigestItem[] = [];
    if (mode === "subscribed") {
      try {
        items = await curateForSubscriber(subscriberId, {
          limit: CATCHUP_TUNING.limit,
          sinceDays: CATCHUP_TUNING.sinceDays,
          dedupeDays: 30,
        });
      } catch (err) {
        // Curate failure shouldn't block the welcome — fall back to the
        // plain confirmation copy below.
        console.error(
          "[send-welcome] curate failed, falling back to confirmation welcome:",
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
        "You're in — here are last week's pharmacist-curated picks to get you started. Your regular weekly digest arrives every Monday from here on.";
      const rendered = renderDigestHtml({
        items,
        unsubscribeUrl: unsubscribeUrl ?? `${SITE_URL}/`,
        frequencyLabel: "weekly",
        greeting,
      });
      subject = `Welcome to AI PharmCare — last week's picks inside`;
      html = rendered.html;
      text = rendered.text;
    } else {
      kind = "welcome";
      const rendered = renderWelcomeEmail({ email, unsubscribeUrl, mode });
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
