import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";

/**
 * Phase 1 email capture for daily/weekly digest.
 *
 * Idempotent: re-submitting the same email reactivates an unsubscribed
 * row instead of erroring. Phase 2 will extend with categories + channel
 * endpoints (Telegram chat_id, web push subscription, etc.).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const source = String(body.source ?? "footer");
    // Phase 1: every signup is weekly. Other cadences will come back when we
    // expand digest tooling — until then the cron flow keeps a single rhythm.
    const frequency = "weekly";

    if (!email || !email.includes("@") || email.length > 320) {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 }
      );
    }

    // Attach to the current user if logged in (for later auto-merge).
    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    const admin = await createAdminClient();
    const { error } = await admin
      .from("email_subscribers")
      .upsert(
        {
          email,
          source,
          frequency,
          user_id: user?.id ?? null,
          unsubscribed_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    if (error) {
      console.error("[subscribe] upsert failed:", error.message);
      return NextResponse.json(
        { error: "Subscription failed" },
        { status: 500 }
      );
    }

    // Fire welcome email — idempotent, only sends on first contact.
    // Don't block the response on failure; log and move on so subscribe
    // never fails because of a transient Resend hiccup.
    const welcome = await sendWelcomeEmail({
      email,
      source,
      userId: user?.id ?? null,
      frequency,
      mode: "subscribed",
    });
    if (!welcome.ok) {
      console.error("[subscribe] welcome email failed:", welcome.reason);
    }

    return NextResponse.json({ ok: true, loggedIn: !!user });
  } catch (err) {
    console.error("[subscribe] handler error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
