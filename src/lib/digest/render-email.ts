import type { DigestItem } from "./curate";
import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

interface RenderInput {
  items: DigestItem[];
  unsubscribeUrl: string;
  frequencyLabel: string; // e.g. "weekly", "daily"
  greeting?: string;
}

/**
 * Plain-HTML digest email. Inline styles only (no <style> blocks) so it
 * survives Gmail/Outlook rewriting. Mobile-friendly via max-width:600px
 * + responsive font sizes.
 */
export function renderDigestHtml({
  items,
  unsubscribeUrl,
  frequencyLabel,
  greeting,
}: RenderInput): { subject: string; html: string; text: string } {
  const headline =
    items[0]?.title?.slice(0, 70) ?? "This week's pharmacist picks";
  const subject = `${BRAND.name}: ${headline}`;

  const intro = greeting ?? `Your ${frequencyLabel} pharmacist-curated picks.`;

  const cardsHtml = items
    .map((item) => {
      const img = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="" width="140" style="display:block;width:140px;height:auto;border-radius:8px;border:1px solid #e5e7eb;" />`
        : "";
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="padding:16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${img ? `<td valign="top" style="padding-right:16px;width:140px;">${img}</td>` : ""}
          <td valign="top">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6366f1;font-weight:600;margin-bottom:6px;">${kindLabel(item.kind)}</div>
            <a href="${escapeHtml(item.url)}" style="color:#0f172a;text-decoration:none;font-size:18px;font-weight:700;line-height:1.3;display:block;margin-bottom:8px;">${escapeHtml(item.title)}</a>
            <p style="margin:0 0 12px 0;color:#475569;font-size:14px;line-height:1.5;">${escapeHtml(item.description)}</p>
            <a href="${escapeHtml(item.url)}" style="display:inline-block;padding:8px 14px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Read full →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    })
    .join("");

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
          <td style="padding:28px 24px 8px 24px;text-align:center;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:14px;font-weight:700;color:#6366f1;letter-spacing:0.04em;">${escapeHtml(BRAND.name.toUpperCase())}</div>
            <div style="margin-top:6px;font-size:13px;color:#64748b;">${escapeHtml(intro)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            ${cardsHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 24px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;line-height:1.6;">
            <p style="margin:0 0 8px 0;">Reviewed by <strong>${escapeHtml(SITE_AUTHOR.displayName)}</strong>. Every pick cites FDA labels and PubMed where applicable.</p>
            <p style="margin:0 0 8px 0;">Educational content — not a substitute for individualized medical advice.</p>
            <p style="margin:0;">
              <a href="${escapeHtml(SITE_URL)}" style="color:#6366f1;text-decoration:none;">Visit ${escapeHtml(BRAND.domain)}</a>
              &nbsp;·&nbsp;
              <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text =
    `${BRAND.name} — ${intro}\n\n` +
    items
      .map(
        (i) =>
          `• ${i.title}\n  ${i.description}\n  ${i.url}\n`
      )
      .join("\n") +
    `\n— Reviewed by ${SITE_AUTHOR.displayName}. Unsubscribe: ${unsubscribeUrl}`;

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

function kindLabel(k: DigestItem["kind"]): string {
  return k === "trend"
    ? "Worth the Hype?"
    : k === "expert"
      ? "Dr.'s Analysis"
      : "Product Review";
}
