import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

/**
 * Purchase link click-through tracker.
 *
 * GET /api/click/[linkId]?ref=trend_article&rid=42
 *
 * 1. Logs a click event to `purchase_click_events`
 * 2. 302-redirects to the affiliate URL (or raw URL if no affiliate)
 *
 * Query params:
 *   - ref: referrer type ('trend_article', 'compare_page', 'lookup')
 *   - rid: referrer ID (trend_topic.id, article.id, etc.)
 */

interface ClickRouteParams {
  params: Promise<{ linkId: string }>;
}

export async function GET(
  req: Request,
  { params }: ClickRouteParams
) {
  const { linkId: rawLinkId } = await params;
  const linkId = parseInt(rawLinkId, 10);
  if (Number.isNaN(linkId)) {
    return NextResponse.json({ error: "Invalid link ID" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the purchase link
  const { data: link, error } = await admin
    .from("product_purchase_links")
    .select("id, medication_id, retailer_id, url, affiliate_url, is_active")
    .eq("id", linkId)
    .maybeSingle();

  if (error || !link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (!link.is_active) {
    return NextResponse.json(
      { error: "This link is no longer active" },
      { status: 410 }
    );
  }

  // Parse query params for referrer context
  const url = new URL(req.url);
  const referrerType = url.searchParams.get("ref") ?? "unknown";
  const referrerId = url.searchParams.get("rid");

  // Generate anonymous session fingerprint (no PII stored)
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  const ua = headersList.get("user-agent") ?? "unknown";
  const sessionId = crypto
    .createHash("sha256")
    .update(`${ip}:${ua}`)
    .digest("hex")
    .slice(0, 16);

  // Log click event (fire-and-forget, don't block the redirect)
  admin
    .from("purchase_click_events")
    .insert({
      link_id: link.id,
      medication_id: link.medication_id,
      retailer_id: link.retailer_id,
      referrer_type: referrerType,
      referrer_id: referrerId ? parseInt(referrerId, 10) : null,
      session_id: sessionId,
    })
    .then(({ error: insertError }) => {
      if (insertError) {
        console.warn("[click] failed to log click event:", insertError.message);
      }
    });

  // Redirect to affiliate URL (preferred) or raw product URL
  const redirectUrl = link.affiliate_url ?? link.url;
  return NextResponse.redirect(redirectUrl, 302);
}
