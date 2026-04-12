"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface RetailerRow {
  id: number;
  name: string;
  slug: string;
  websiteUrl: string;
  logoUrl: string | null;
  country: string;
  isActive: boolean;
  affiliateNetwork: string | null;
  affiliateBaseUrl: string | null;
  commissionRate: string | null;
  cookieDays: number | null;
  createdAt: string;
}

export interface PurchaseLinkRow {
  id: number;
  medicationId: number;
  retailerId: number;
  url: string;
  affiliateUrl: string | null;
  price: string | null;
  priceCurrency: string;
  isActive: boolean;
  sortOrder: number;
  retailerName?: string;
  retailerSlug?: string;
}

// ============================================================
// Auth helper
// ============================================================

async function assertPharmacist(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data } = await supabase.rpc("is_pharmacist");
  if (data !== true) throw new Error("Pharmacist role required");
}

// ============================================================
// Retailers CRUD
// ============================================================

export async function listRetailers(): Promise<RetailerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retailers")
    .select("*")
    .order("name");

  if (error) {
    console.error("[retailers] list failed:", error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    websiteUrl: r.website_url as string,
    logoUrl: (r.logo_url as string) ?? null,
    country: r.country as string,
    isActive: r.is_active as boolean,
    affiliateNetwork: (r.affiliate_network as string) ?? null,
    affiliateBaseUrl: (r.affiliate_base_url as string) ?? null,
    commissionRate: r.commission_rate != null ? String(r.commission_rate) : null,
    cookieDays: (r.cookie_days as number) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function createRetailer(input: {
  name: string;
  slug: string;
  websiteUrl: string;
  country: string;
  affiliateNetwork?: string;
  commissionRate?: number;
}): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const supabase = await createClient();

  const { error } = await supabase.from("retailers").insert({
    name: input.name,
    slug: input.slug,
    website_url: input.websiteUrl,
    country: input.country,
    affiliate_network: input.affiliateNetwork ?? null,
    commission_rate: input.commissionRate ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/retailers");
  return { ok: true };
}

export async function deleteRetailer(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const supabase = await createClient();
  const { error } = await supabase.from("retailers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/retailers");
  return { ok: true };
}

// ============================================================
// Purchase Links CRUD
// ============================================================

export async function listPurchaseLinks(
  medicationId: number
): Promise<PurchaseLinkRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_purchase_links")
    .select("*, retailers(name, slug)")
    .eq("medication_id", medicationId)
    .order("sort_order");

  if (error) {
    console.error("[purchase-links] list failed:", error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => {
    const retailer = r.retailers as { name: string; slug: string } | null;
    return {
      id: r.id as number,
      medicationId: r.medication_id as number,
      retailerId: r.retailer_id as number,
      url: r.url as string,
      affiliateUrl: (r.affiliate_url as string) ?? null,
      price: r.price != null ? String(r.price) : null,
      priceCurrency: (r.price_currency as string) ?? "USD",
      isActive: r.is_active as boolean,
      sortOrder: r.sort_order as number,
      retailerName: retailer?.name,
      retailerSlug: retailer?.slug,
    };
  });
}

export async function upsertPurchaseLink(input: {
  medicationId: number;
  retailerId: number;
  url: string;
  affiliateUrl?: string;
  price?: number;
  priceCurrency?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const supabase = await createClient();

  const { error } = await supabase.from("product_purchase_links").upsert(
    {
      medication_id: input.medicationId,
      retailer_id: input.retailerId,
      url: input.url,
      affiliate_url: input.affiliateUrl ?? null,
      price: input.price ?? null,
      price_currency: input.priceCurrency ?? "USD",
    },
    { onConflict: "medication_id,retailer_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/retailers");
  revalidatePath("/medications");
  return { ok: true };
}

export async function deletePurchaseLink(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_purchase_links")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/retailers");
  return { ok: true };
}
