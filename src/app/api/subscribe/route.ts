import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    const frequency = String(body.frequency ?? "weekly");

    if (!email || !email.includes("@") || email.length > 320) {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 }
      );
    }
    if (!["weekly", "3x_week", "daily", "critical_only"].includes(frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency" },
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribe] handler error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
