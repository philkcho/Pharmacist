"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Auth guard ──────────────────────────────────────────────

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

// ── Types ───────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  provider: string;
  createdAt: string;
  lastSignIn: string | null;
  isPharmacist: boolean;
}

// ── List users ──────────────────────────────────────────────

export async function listUsers(): Promise<UserRow[]> {
  await assertPharmacist();
  const admin = createAdminClient();

  // Fetch all auth users
  const {
    data: { users },
    error,
  } = await admin.auth.admin.listUsers({ perPage: 500 });

  if (error || !users) return [];

  // Fetch all pharmacist roles
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, role")
    .eq("role", "pharmacist");

  const pharmacistIds = new Set(
    (roles ?? []).map((r) => r.user_id as string)
  );

  return users.map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    provider: u.app_metadata?.provider ?? "email",
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
    isPharmacist: pharmacistIds.has(u.id),
  }));
}

// ── Grant pharmacist role ───────────────────────────────────

export async function grantPharmacistRole(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { error } = await admin
    .from("user_roles")
    .upsert(
      { user_id: userId, role: "pharmacist" },
      { onConflict: "user_id,role" }
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/users");
  return { ok: true };
}

// ── Revoke pharmacist role ──────────────────────────────────

export async function revokePharmacistRole(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  const { error } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "pharmacist");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/users");
  return { ok: true };
}

// ── Invite user (create in Supabase Auth + optional role) ───

export async function inviteAdmin(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  await assertPharmacist();
  const admin = createAdminClient();

  // Create user via admin API (sends invite email)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);

  if (error) {
    // User might already exist
    if (error.message.includes("already been registered")) {
      // Find existing user and grant role
      const {
        data: { users },
      } = await admin.auth.admin.listUsers();
      const existing = (users ?? []).find((u) => u.email === email);
      if (existing) {
        return grantPharmacistRole(existing.id);
      }
    }
    return { ok: false, error: error.message };
  }

  if (data.user) {
    await admin
      .from("user_roles")
      .upsert(
        { user_id: data.user.id, role: "pharmacist" },
        { onConflict: "user_id,role" }
      );
  }

  revalidatePath("/users");
  return { ok: true };
}
