import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

/**
 * Visitor analytics endpoint.
 *
 * POST /api/analytics/pageview
 *
 * Actions:
 *   { action: "view", path, referrer }  → insert page_view, return { id }
 *   { action: "duration", id, durationSeconds } → update duration_seconds
 */

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|mediapartners|prerender|headless|phantom|lighthouse/i;

// Simple in-memory geo cache (IP → { country, region, city }), 1h TTL
const geoCache = new Map<string, { country: string; region: string; city: string; ts: number }>();
const GEO_CACHE_TTL = 3600_000; // 1 hour

async function resolveGeo(
  ip: string,
  headersList: Headers
): Promise<{ country: string | null; region: string | null; city: string | null }> {
  // 1st: Vercel headers (free, instant, production only)
  const vCountry = headersList.get("x-vercel-ip-country");
  if (vCountry) {
    return {
      country: vCountry,
      region: headersList.get("x-vercel-ip-country-region"),
      city: headersList.get("x-vercel-ip-city")
        ? decodeURIComponent(headersList.get("x-vercel-ip-city")!)
        : null,
    };
  }

  // 2nd: Cached result
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) {
    return cached;
  }

  // 3rd: ip-api.com fallback (free, 45 req/min)
  // For localhost IPs, fetch our public IP first
  let resolvedIp = ip;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "unknown") {
    try {
      const pubRes = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(3000),
      });
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        resolvedIp = pubData.ip;
      }
    } catch {
      // Can't resolve public IP — skip geo
    }
  }

  if (resolvedIp && resolvedIp !== "unknown" && resolvedIp !== "127.0.0.1" && resolvedIp !== "::1") {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `http://ip-api.com/json/${resolvedIp}?fields=country,regionName,city`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const entry = {
          country: data.country ?? null,
          region: data.regionName ?? null,
          city: data.city ?? null,
          ts: Date.now(),
        };
        geoCache.set(ip, entry);
        return entry;
      }
    } catch {
      // Timeout or rate limit — skip
    }
  }

  return { country: null, region: null, city: null };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    const headersList = await headers();
    const ua = headersList.get("user-agent") ?? "";

    // Skip bots
    if (BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();

    if (action === "view") {
      const { path, referrer } = body as {
        path: string;
        referrer?: string;
      };

      if (!path) {
        return NextResponse.json({ error: "path required" }, { status: 400 });
      }

      const ip =
        headersList.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
      const visitorId = crypto
        .createHash("sha256")
        .update(`${ip}:${ua}`)
        .digest("hex")
        .slice(0, 16);

      const geo = await resolveGeo(ip, headersList);

      const { data, error } = await admin
        .from("page_views")
        .insert({
          visitor_id: visitorId,
          path,
          referrer: referrer || null,
          user_agent: ua || null,
          ip,
          country: geo.country,
          region: geo.region,
          city: geo.city,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("[analytics] insert failed:", error.message);
        return NextResponse.json({ error: "insert failed" }, { status: 500 });
      }

      return NextResponse.json({ id: data.id });
    }

    if (action === "duration") {
      const { id, durationSeconds } = body as {
        id: number;
        durationSeconds: number;
      };

      if (!id || typeof durationSeconds !== "number") {
        return NextResponse.json({ error: "id + durationSeconds required" }, { status: 400 });
      }

      // Cap at 30 min to ignore stale tabs
      const capped = Math.min(Math.max(0, Math.round(durationSeconds)), 1800);

      await admin
        .from("page_views")
        .update({ duration_seconds: capped })
        .eq("id", id);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
