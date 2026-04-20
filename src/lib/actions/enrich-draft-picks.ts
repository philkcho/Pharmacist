"use server";

/**
 * Enrich the free-form productRecommendations from a ConsultDraft with
 * DB matches (image, slug, product type) and purchase links. Falls back
 * to a generic Amazon / iHerb search URL when the product isn't in the
 * medications table — so the customer always has an actionable link.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface DraftPickEnrichment {
  name: string;
  reason: string;
  ingredientFocus?: string;
  match: {
    slug: string;
    imageUrl: string | null;
    productType: string | null;
  } | null;
  purchaseLinks: { linkId: number; retailerName: string }[];
  // Always-on fallback so the user has a path to buy even when we lack DB data
  amazonSearchUrl: string;
  iherbSearchUrl: string;
}

export async function enrichDraftProductPicks(
  picks: { name: string; reason: string; ingredientFocus?: string }[]
): Promise<DraftPickEnrichment[]> {
  if (picks.length === 0) return [];

  const admin = createAdminClient();

  return Promise.all(
    picks.map(async (p) => {
      const amazon = `https://www.amazon.com/s?k=${encodeURIComponent(p.name)}`;
      const iherb = `https://www.iherb.com/search?kw=${encodeURIComponent(p.name)}`;
      const base: DraftPickEnrichment = {
        name: p.name,
        reason: p.reason,
        ingredientFocus: p.ingredientFocus,
        match: null,
        purchaseLinks: [],
        amazonSearchUrl: amazon,
        iherbSearchUrl: iherb,
      };

      try {
        // Fuzzy name lookup — matches brand, generic, or partial words
        const { data: med } = await admin
          .from("medications")
          .select("id, slug, image_url, product_type")
          .or(
            `name.ilike.%${escapeLike(p.name)}%,generic_name.ilike.%${escapeLike(p.name)}%`
          )
          .eq("approval_status", "approved")
          .limit(1)
          .maybeSingle();

        if (!med?.id) return base;

        base.match = {
          slug: med.slug as string,
          imageUrl: (med.image_url as string | null) ?? null,
          productType: (med.product_type as string | null) ?? null,
        };

        const { data: links } = await admin
          .from("product_purchase_links")
          .select("id, retailers(name)")
          .eq("medication_id", med.id)
          .eq("is_active", true)
          .order("sort_order");

        base.purchaseLinks = (links ?? []).map(
          (l: { id: number; retailers: unknown }) => {
            const retailers = l.retailers;
            const retailer = Array.isArray(retailers)
              ? (retailers[0] as { name?: string } | undefined)
              : (retailers as { name?: string } | null);
            return {
              linkId: l.id,
              retailerName: retailer?.name ?? "Buy",
            };
          }
        );
      } catch (err) {
        console.warn(
          "[enrichDraftProductPicks] Lookup failed for",
          p.name,
          err instanceof Error ? err.message : err
        );
      }

      return base;
    })
  );
}

// Supabase's .or() uses comma as a separator, so escape any literal commas
// in the search term. Also escape '%' so users can't inject wildcards.
function escapeLike(s: string): string {
  return s.replace(/[,%]/g, " ").trim();
}
