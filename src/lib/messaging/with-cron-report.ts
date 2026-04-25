import { sendCronReport } from "./send-cron-report";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: any) => Promise<Response>;

/**
 * Wrap a cron route handler so every run sends an email summary to
 * the operator. Captures the JSON response body verbatim so the email
 * shows exactly what the cron returned ("attempted=12, sent=11" etc).
 *
 * Usage in a cron route file:
 *
 *   async function handler(req: NextRequest) {
 *     // ... existing cron logic, return NextResponse.json(...)
 *   }
 *   export const GET = withCronReport("digest", handler);
 *   export const POST = GET; // if both verbs are needed
 */
export function withCronReport(routeName: string, handler: Handler): Handler {
  return async (req: Request) => {
    const startedAt = new Date();
    let res: Response;
    let summary: Record<string, unknown> = {};
    let ok = false;

    try {
      res = await handler(req);
      try {
        const cloned = res.clone();
        const parsed = await cloned.json();
        summary =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { body: parsed };
      } catch {
        summary = { httpStatus: res.status };
      }
      ok = res.status < 500;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      summary = { error: message, stack };
      ok = false;
      res = new Response(
        JSON.stringify({ ok: false, error: message }, null, 2),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Block on the email so Vercel's serverless runtime doesn't kill the
    // function before the report goes out. Adds 1-3s to the cron response,
    // which is fine for cron callers (GitHub Actions / Vercel scheduler).
    await sendCronReport({
      routeName,
      ok,
      startedAt,
      summary,
    });

    return res;
  };
}
