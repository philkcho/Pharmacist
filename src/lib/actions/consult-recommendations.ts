"use server";

/**
 * Enrich AI-generated consult recommendations with product images and
 * verdicts so the consult page can render them as Dr.'s Pick-style cards.
 *
 * AI draft only stores {medicationId, name, slug, reason}; this fetches
 * the rest from the medications table. Approved-only filter applies as
 * a defense-in-depth check.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface EnrichedRecommendation {
  medicationId: number;
  name: string;
  slug: string;
  reason: string;
  imageUrl: string | null;
  verdict: string | null;
  productType: string | null;
  comparisonScore: number | null;
}

export async function enrichRecommendations(
  raw: { medicationId: number; name: string; slug: string; reason: string }[]
): Promise<EnrichedRecommendation[]> {
  if (raw.length === 0) return [];

  const ids = raw.map((r) => r.medicationId);
  const admin = createAdminClient();
  const { data } = await admin
    .from("medications")
    .select("id, slug, name, image_url, verdict, product_type, comparison_score")
    .in("id", ids)
    .eq("approval_status", "approved");

  const byId = new Map(
    (data ?? []).map((row: Record<string, unknown>) => [row.id as number, row])
  );

  return raw
    .map((r) => {
      const row = byId.get(r.medicationId);
      if (!row) return null;
      return {
        medicationId: r.medicationId,
        name: r.name,
        slug: r.slug,
        reason: r.reason,
        imageUrl: (row.image_url as string | null) ?? null,
        verdict: (row.verdict as string | null) ?? null,
        productType: (row.product_type as string | null) ?? null,
        comparisonScore: (row.comparison_score as number | null) ?? null,
      };
    })
    .filter((r): r is EnrichedRecommendation => r !== null);
}
