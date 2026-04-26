export const dynamic = "force-static";
export const revalidate = 86400;

// IndexNow ownership verification endpoint. The submit payload (see
// src/lib/seo/indexnow.ts) advertises this URL as `keyLocation`, and
// the receiving search engine fetches it to confirm we own the key.
export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return new Response("INDEXNOW_KEY not configured", { status: 404 });
  }
  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
