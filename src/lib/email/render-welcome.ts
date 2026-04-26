import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

interface RenderInput {
  email: string;
  unsubscribeUrl?: string;
  /**
   * `signup`     — account created, NOT yet on the newsletter. CTA pushes
   *                the user to opt into the weekly digest.
   * `subscribed` — fallback for subscribe-form flow when curate is empty.
   *                Confirms the subscription instead of asking for it.
   */
  mode?: "signup" | "subscribed";
}

/**
 * Welcome email — sent once per email address on first signup or
 * subscribe. Inline styles only (no <style> blocks) so it survives
 * Gmail/Outlook rewriting. Mobile-friendly via max-width:600px.
 *
 * Voice: independent research / pharmacist-curated tone (matches the
 * site's Dr.'s Analysis voice rules — no Korean-specific framing,
 * no "overseas/foreign" phrasing).
 *
 * Note: account signup does NOT auto-subscribe to the newsletter. The
 * primary CTA in this email is the Subscribe button — opting in is
 * how the user starts receiving regular pharmacist-curated digests.
 */
export function renderWelcomeEmail({
  email,
  unsubscribeUrl,
  mode = "signup",
}: RenderInput): { subject: string; html: string; text: string } {
  const subject =
    mode === "subscribed"
      ? `You're in — your weekly ${BRAND.name} digest is set`
      : `Welcome to ${BRAND.name} — your pharmacist-led health & beauty hub`;
  const subscribeUrl = `${SITE_URL}/en/subscribe`;
  const trendingUrl = `${SITE_URL}/en/trending`;
  const expertUrl = `${SITE_URL}/en/expert`;
  const askUrl = `${SITE_URL}/en/ask`;

  const unsubLine = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:32px 24px 16px 24px;text-align:center;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:14px;font-weight:700;color:#6366f1;letter-spacing:0.04em;">${escapeHtml(BRAND.name.toUpperCase())}</div>
            <h1 style="margin:14px 0 6px 0;font-size:22px;line-height:1.3;color:#0f172a;">Welcome aboard 👋</h1>
            <div style="font-size:14px;color:#64748b;">${escapeHtml(BRAND.tagline)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            ${
              mode === "subscribed"
                ? `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#0f172a;">
              You're now subscribed to the <strong>${escapeHtml(BRAND.name)}</strong> weekly digest at <strong>${escapeHtml(email)}</strong>. Every Monday you'll get pharmacist-curated picks — trending product alerts, in-depth analysis, and any recall or safety updates you should know about — cross-checked against FDA labels, FAERS adverse-event data, and PubMed research.
            </p>

            <div style="margin:20px 0 8px 0;padding:16px 20px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;color:#065f46;font-size:14px;line-height:1.5;">
              ✅ <strong>You're all set.</strong> Your first weekly digest will arrive on the next Monday.
            </div>`
                : `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#0f172a;">
              Thanks for creating your account at <strong>${escapeHtml(BRAND.name)}</strong>. You now have a pharmacist in your corner for the health and beauty products you actually use — premium ingredient breakdowns, safety analysis, and product reviews cross-checked against FDA labels, FAERS adverse-event data, and PubMed research.
            </p>

            <div style="margin:20px 0 8px 0;padding:18px 20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
              <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Want updates straight to your inbox?</div>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#475569;">
                Signing up for an account doesn't subscribe you to our newsletter. <strong>Subscribe separately</strong> to get our <strong>weekly</strong> pharmacist-curated digest — trending product alerts, in-depth analysis, and any recall or safety updates you should know about, delivered every Monday.
              </p>
              <div style="text-align:center;">
                <a href="${escapeHtml(subscribeUrl)}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">📬 Subscribe to the weekly digest</a>
              </div>
              <div style="margin-top:10px;text-align:center;font-size:12px;color:#94a3b8;">
                Free · weekly · unsubscribe anytime · We'll use ${escapeHtml(email)}
              </div>
            </div>`
            }

            <h2 style="margin:28px 0 10px 0;font-size:16px;line-height:1.4;color:#0f172a;">${mode === "subscribed" ? "Start exploring" : "In the meantime, explore"}</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                  <a href="${escapeHtml(trendingUrl)}" style="color:#0f172a;text-decoration:none;font-weight:600;font-size:15px;">🔥 Worth the Hype?</a>
                  <div style="font-size:13px;color:#64748b;margin-top:4px;">The viral health & beauty trends — checked against the evidence so you know which ones to actually try.</div>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                  <a href="${escapeHtml(expertUrl)}" style="color:#0f172a;text-decoration:none;font-weight:600;font-size:15px;">🧪 Dr.'s Analysis</a>
                  <div style="font-size:13px;color:#64748b;margin-top:4px;">Premium product breakdowns — ingredients explained, real pros and cons, safety flags you'd otherwise miss.</div>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;">
                  <a href="${escapeHtml(askUrl)}" style="color:#0f172a;text-decoration:none;font-weight:600;font-size:15px;">💬 Community Q&A</a>
                  <div style="font-size:13px;color:#64748b;margin-top:4px;">Real pharmacist-reviewed answers to questions about medications, supplements, and skincare.</div>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
              Reviewed by <strong>${escapeHtml(SITE_AUTHOR.displayName)}</strong>. Educational content — not a substitute for individualized medical advice. Always check with your healthcare provider before starting a new product.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 24px 24px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;line-height:1.6;text-align:center;">
            <a href="${escapeHtml(SITE_URL)}" style="color:#6366f1;text-decoration:none;">${escapeHtml(BRAND.domain)}</a>
            ${unsubLine ? `&nbsp;·&nbsp;${unsubLine}` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const intro =
    mode === "subscribed"
      ? `You're now subscribed to the ${BRAND.name} weekly digest at ${email}.\n` +
        `Every Monday you'll get pharmacist-curated picks — trending product alerts, in-depth\n` +
        `analysis, and any recall or safety updates you should know about — cross-checked\n` +
        `against FDA labels, FAERS adverse-event data, and PubMed research.\n\n` +
        `✅ You're all set. Your first weekly digest arrives on the next Monday.\n\n`
      : `Thanks for creating your account. You now have a pharmacist in your corner for the\n` +
        `health and beauty products you actually use — premium ingredient breakdowns, safety\n` +
        `analysis, and product reviews cross-checked against FDA labels, FAERS adverse-event\n` +
        `data, and PubMed research.\n\n` +
        `── Want updates straight to your inbox? ──\n` +
        `Signing up for an account doesn't subscribe you to our newsletter. Subscribe separately\n` +
        `to get our weekly pharmacist-curated digest — trending alerts, in-depth analysis, and\n` +
        `any recall or safety updates you should know about, delivered every Monday.\n\n` +
        `Subscribe → ${subscribeUrl}\n` +
        `(Free · weekly · unsubscribe anytime · we'll use ${email})\n\n`;

  const text =
    `Welcome to ${BRAND.name} 👋\n\n` +
    intro +
    `${mode === "subscribed" ? "Start exploring" : "In the meantime, explore"}:\n` +
    `• Worth the Hype? — viral trends checked against the evidence — ${trendingUrl}\n` +
    `• Dr.'s Analysis — premium product breakdowns and safety flags — ${expertUrl}\n` +
    `• Community Q&A — pharmacist-reviewed answers to real questions — ${askUrl}\n\n` +
    `Reviewed by ${SITE_AUTHOR.displayName}. Educational content — not a substitute for individualized medical advice.` +
    (unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : "");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
