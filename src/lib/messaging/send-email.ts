import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY missing");
    _resend = new Resend(key);
  }
  return _resend;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? `hello@${BRAND.domain}`;

/**
 * Send a transactional/digest email via Resend.
 * Adds RFC-8058 List-Unsubscribe headers when unsubscribeUrl is provided so
 * Gmail/Outlook show a one-click unsubscribe button.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const headers: Record<string, string> = {};
    if (input.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const { data, error } = await getResend().emails.send({
      from: `${BRAND.name} <${FROM}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      tags: input.tags,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
