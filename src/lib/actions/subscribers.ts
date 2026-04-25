"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function assertPharmacist(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "pharmacist")
    .single();
  if (!data) throw new Error("Pharmacist role required");
}

export type SubscriberFrequency =
  | "weekly"
  | "3x_week"
  | "daily"
  | "critical_only";

export interface SubscriberRow {
  id: number;
  email: string;
  source: string;
  frequency: SubscriberFrequency;
  isConfirmed: boolean;
  userId: string | null;
  welcomeSentAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscribersSnapshot {
  rows: SubscriberRow[];
  totals: {
    all: number;
    active: number;
    unsubscribed: number;
    byFrequency: Record<SubscriberFrequency, number>;
    bySource: Record<string, number>;
    welcomePending: number;
  };
}

const FREQUENCIES: SubscriberFrequency[] = [
  "weekly",
  "3x_week",
  "daily",
  "critical_only",
];

export async function listSubscribers(): Promise<SubscribersSnapshot> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("email_subscribers")
    .select(
      "id, email, source, frequency, is_confirmed, user_id, welcome_sent_at, unsubscribed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !data) {
    return {
      rows: [],
      totals: {
        all: 0,
        active: 0,
        unsubscribed: 0,
        byFrequency: {
          weekly: 0,
          "3x_week": 0,
          daily: 0,
          critical_only: 0,
        },
        bySource: {},
        welcomePending: 0,
      },
    };
  }

  const rows: SubscriberRow[] = data.map((r) => ({
    id: r.id as number,
    email: r.email as string,
    source: (r.source as string) ?? "unknown",
    frequency: (r.frequency as SubscriberFrequency) ?? "weekly",
    isConfirmed: Boolean(r.is_confirmed),
    userId: (r.user_id as string | null) ?? null,
    welcomeSentAt: (r.welcome_sent_at as string | null) ?? null,
    unsubscribedAt: (r.unsubscribed_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));

  const byFrequency = FREQUENCIES.reduce(
    (acc, f) => ({ ...acc, [f]: 0 }),
    {} as Record<SubscriberFrequency, number>
  );
  const bySource: Record<string, number> = {};
  let active = 0;
  let unsubscribed = 0;
  let welcomePending = 0;

  for (const r of rows) {
    if (r.unsubscribedAt) unsubscribed++;
    else {
      active++;
      byFrequency[r.frequency] = (byFrequency[r.frequency] ?? 0) + 1;
    }
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    if (!r.welcomeSentAt && !r.unsubscribedAt) welcomePending++;
  }

  return {
    rows,
    totals: {
      all: rows.length,
      active,
      unsubscribed,
      byFrequency,
      bySource,
      welcomePending,
    },
  };
}

export async function setSubscriberFrequency(
  id: number,
  frequency: SubscriberFrequency
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  if (!FREQUENCIES.includes(frequency)) {
    return { ok: false, error: "Invalid frequency" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_subscribers")
    .update({ frequency, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/subscribers");
  return { ok: true };
}

export async function unsubscribeSubscriber(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("email_subscribers")
    .update({ unsubscribed_at: now, updated_at: now })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/subscribers");
  return { ok: true };
}

export async function reactivateSubscriber(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_subscribers")
    .update({
      unsubscribed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/subscribers");
  return { ok: true };
}

export async function deleteSubscriber(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_subscribers")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/subscribers");
  return { ok: true };
}

export async function exportSubscribersCsv(): Promise<string> {
  await assertPharmacist();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_subscribers")
    .select(
      "email, source, frequency, user_id, welcome_sent_at, unsubscribed_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (error || !data) return "";
  const header = [
    "email",
    "source",
    "frequency",
    "user_id",
    "welcome_sent_at",
    "unsubscribed_at",
    "created_at",
  ];
  const lines = [header.join(",")];
  for (const r of data) {
    const values = header.map((k) => {
      const v = (r as Record<string, unknown>)[k];
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}
