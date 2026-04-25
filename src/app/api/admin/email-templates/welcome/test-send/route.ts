import { NextRequest, NextResponse } from "next/server";
import { isPharmacist } from "@/lib/actions/auth";
import { renderWelcomeEmail } from "@/lib/email/render-welcome";
import { sendEmail } from "@/lib/messaging/send-email";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

/**
 * Admin-only one-off welcome email send. Bypasses the welcome_sent_at
 * idempotency gate so the operator can preview the template in their
 * own inbox without affecting customer-facing send state.
 */
export async function POST(req: NextRequest) {
  const allowed = await isPharmacist();
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { subject, html, text } = renderWelcomeEmail({
    email,
    unsubscribeUrl: `${SITE_URL}/api/unsubscribe/SAMPLE_TOKEN`,
  });

  const result = await sendEmail({
    to: email,
    subject: `[TEST] ${subject}`,
    html,
    text,
    tags: [
      { name: "kind", value: "welcome" },
      { name: "mode", value: "admin_test" },
    ],
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}
