import { sendEmail } from "./send-email";
import { BRAND } from "@/lib/brand";

const NOTIFY_EMAIL =
  process.env.CRON_REPORT_EMAIL ?? "aipharmcare@gmail.com";

export interface CronReportInput {
  /** Short route identifier shown in the subject. */
  routeName: string;
  /** Whether the run met its goal. */
  ok: boolean;
  /** When this run started — used to compute duration. */
  startedAt: Date;
  /** Free-form summary object — JSON-stringified into the body. */
  summary?: Record<string, unknown>;
  /** Optional human-readable message shown above the JSON dump. */
  message?: string;
}

/**
 * Send a quick cron-report email so the operator (Younghun) gets visibility
 * into every automated run, success or failure. Failures send anyway so
 * silent breakage is impossible. Throws are swallowed so a flaky email
 * service can't fail an otherwise-successful cron run.
 */
export async function sendCronReport(input: CronReportInput): Promise<void> {
  // Allow disabling site-wide via env without touching code.
  if (process.env.CRON_REPORT_DISABLED === "1") return;

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - input.startedAt.getTime();
  const durationSec = (durationMs / 1000).toFixed(1);
  const status = input.ok ? "✅ OK" : "❌ FAIL";

  const subject = `[${status}] ${BRAND.name} cron — ${input.routeName} (${durationSec}s)`;

  const summaryJson = input.summary
    ? JSON.stringify(input.summary, null, 2)
    : "(no summary)";

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#0f172a;background:#f8fafc;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <div style="font-size:12px;color:${input.ok ? "#10b981" : "#ef4444"};font-weight:700;letter-spacing:0.05em;">
      ${status}
    </div>
    <h2 style="margin:6px 0 16px 0;font-size:18px;">${input.routeName}</h2>
    <table style="font-size:13px;color:#475569;border-collapse:collapse;margin-bottom:16px;">
      <tr><td style="padding:2px 12px 2px 0;">Started</td><td>${input.startedAt.toISOString()}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;">Finished</td><td>${finishedAt.toISOString()}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;">Duration</td><td>${durationSec}s</td></tr>
    </table>
    ${input.message ? `<p style="margin:0 0 12px 0;font-size:14px;">${escapeHtml(input.message)}</p>` : ""}
    <pre style="background:#f1f5f9;border-radius:8px;padding:12px;font-size:12px;overflow-x:auto;color:#0f172a;">${escapeHtml(summaryJson)}</pre>
  </div>
</body></html>`;

  const text =
    `${status} — ${input.routeName}\n` +
    `Started:  ${input.startedAt.toISOString()}\n` +
    `Finished: ${finishedAt.toISOString()}\n` +
    `Duration: ${durationSec}s\n` +
    (input.message ? `\n${input.message}\n` : "") +
    `\n${summaryJson}`;

  try {
    await sendEmail({
      to: NOTIFY_EMAIL,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "cron_report" },
        { name: "route", value: input.routeName },
        { name: "ok", value: input.ok ? "1" : "0" },
      ],
    });
  } catch (err) {
    // Last-resort: log and move on so the cron itself doesn't fail.
    console.error(
      "[sendCronReport] failed to send report:",
      err instanceof Error ? err.message : err
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
