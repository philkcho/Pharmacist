"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SkinType =
  | "oily"
  | "dry"
  | "combination"
  | "sensitive"
  | "normal"
  | "unknown";

export type PregnancyStatus =
  | "not_applicable"
  | "trying"
  | "pregnant"
  | "breastfeeding";

export type DigestFrequency = "weekly" | "monthly" | "off";

export interface UserProfile {
  userId: string;
  displayName: string | null;
  ageRange: string | null;
  pregnancyStatus: PregnancyStatus;
  skinType: SkinType;
  conditions: string[];
  allergies: string[];
  primaryConcerns: string[];
  emailOptIn: boolean;
  pushOptIn: boolean;
  digestFrequency: DigestFrequency;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  displayName?: string | null;
  ageRange?: string | null;
  pregnancyStatus?: PregnancyStatus;
  skinType?: SkinType;
  conditions?: string[];
  allergies?: string[];
  primaryConcerns?: string[];
  emailOptIn?: boolean;
  pushOptIn?: boolean;
  digestFrequency?: DigestFrequency;
}

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    userId: row.user_id as string,
    displayName: (row.display_name as string | null) ?? null,
    ageRange: (row.age_range as string | null) ?? null,
    pregnancyStatus: row.pregnancy_status as PregnancyStatus,
    skinType: row.skin_type as SkinType,
    conditions: (row.conditions as string[] | null) ?? [],
    allergies: (row.allergies as string[] | null) ?? [],
    primaryConcerns: (row.primary_concerns as string[] | null) ?? [],
    emailOptIn: row.email_opt_in as boolean,
    pushOptIn: row.push_opt_in as boolean,
    digestFrequency: row.digest_frequency as DigestFrequency,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Get the current authenticated user's profile, creating an empty
// row on first call so callers always get a record back.
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return rowToProfile(existing);

  const { data: created, error } = await supabase
    .from("user_profiles")
    .insert({ user_id: user.id })
    .select("*")
    .single();

  if (error || !created) return null;
  return rowToProfile(created);
}

export async function updateProfile(
  input: UpdateProfileInput
): Promise<{ ok: boolean; error?: string; profile?: UserProfile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const updates: Record<string, unknown> = {};
  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.ageRange !== undefined) updates.age_range = input.ageRange;
  if (input.pregnancyStatus !== undefined)
    updates.pregnancy_status = input.pregnancyStatus;
  if (input.skinType !== undefined) updates.skin_type = input.skinType;
  if (input.conditions !== undefined) updates.conditions = input.conditions;
  if (input.allergies !== undefined) updates.allergies = input.allergies;
  if (input.primaryConcerns !== undefined)
    updates.primary_concerns = input.primaryConcerns;
  if (input.emailOptIn !== undefined) updates.email_opt_in = input.emailOptIn;
  if (input.pushOptIn !== undefined) updates.push_opt_in = input.pushOptIn;
  if (input.digestFrequency !== undefined)
    updates.digest_frequency = input.digestFrequency;

  // Upsert so first call creates the row, subsequent calls update.
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed" };

  revalidatePath("/account");
  return { ok: true, profile: rowToProfile(data) };
}
