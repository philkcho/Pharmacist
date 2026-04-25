import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

interface Params {
  params: Promise<{ token: string }>;
}

async function handle(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("email_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsub_token", decoded)
    .select("email")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }

  if (!data) {
    return new NextResponse(unsubscribePage("invalid"), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(unsubscribePage("ok", data.email as string), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// RFC 8058 one-click unsubscribe — Gmail/Outlook send a POST.
export async function POST(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}

// Manual link click from the email — browser GET.
export async function GET(req: NextRequest, ctx: Params) {
  return handle(req, ctx);
}

function unsubscribePage(state: "ok" | "invalid", email?: string): string {
  const isOk = state === "ok";
  const heading = isOk ? "You're unsubscribed." : "Link not recognized";
  const body = isOk
    ? `<strong>${escapeHtml(email ?? "")}</strong> won't receive any more digests from us. Sorry to see you go — feel free to come back any time.`
    : "This unsubscribe link looks invalid or has already been used. If you keep getting emails, reply to one and we'll handle it manually.";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${heading} — AI PharmCare</title>
<style>
  html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a}
  .wrap{max-width:520px;margin:48px auto;padding:32px 24px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;text-align:center}
  h1{font-size:24px;margin:0 0 12px}
  p{font-size:15px;line-height:1.55;color:#475569;margin:0 0 16px}
  a.btn{display:inline-block;margin-top:16px;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px}
</style>
</head><body>
<div class="wrap">
  <h1>${heading}</h1>
  <p>${body}</p>
  <a class="btn" href="${SITE_URL}/">Visit AI PharmCare</a>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
