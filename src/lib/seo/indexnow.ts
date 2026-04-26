import { BRAND } from "@/lib/brand";

const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Notify Bing / Yandex / Seznam (IndexNow consortium) that a list of
 * URLs has been published or updated. Free, key-based, no auth headers.
 *
 * Google does not honor IndexNow yet, but ChatGPT Search and Copilot
 * read Bing's index, so this materially shortens "publish → AI answer
 * citation" latency for new content.
 *
 * No-op when INDEXNOW_KEY is unset (dev / preview environments).
 * Failures are logged and swallowed — never let an indexing ping break
 * the publish flow.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return;
  if (urls.length === 0) return;

  // Always submit absolute URLs scoped to BRAND.url so we never leak
  // localhost or preview hostnames into a public index.
  const host = new URL(BRAND.url).host;
  const absolute = urls
    .map((u) => {
      if (/^https?:\/\//.test(u)) return u;
      return `${BRAND.url}${u.startsWith("/") ? u : `/${u}`}`;
    })
    .filter((u) => {
      try {
        return new URL(u).host === host;
      } catch {
        return false;
      }
    });
  if (absolute.length === 0) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${BRAND.url}/api/indexnow/key`,
        urlList: absolute,
      }),
    });
    if (!res.ok) {
      console.error(
        `[indexnow] non-2xx response: ${res.status} for ${absolute.length} url(s)`
      );
    }
  } catch (err) {
    console.error(
      "[indexnow] submit failed:",
      err instanceof Error ? err.message : err
    );
  }
}
