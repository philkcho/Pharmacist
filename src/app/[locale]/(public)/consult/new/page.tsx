import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PersonalConsultHero } from "@/components/home/personal-consult-hero";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Personal Consult — AI PharmCare",
  description:
    "Pharmacist-reviewed personal consult. Share your stack, get cross-checked guidance from a licensed pharmacist within 48 hours.",
  alternates: { canonical: "/consult/new" },
  // Auth-required form — not a public content surface.
  robots: { index: false, follow: false },
};

export default async function NewConsultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/consult/new")}`);
  }

  return (
    <div className="min-h-[calc(100svh-4rem)]">
      <PersonalConsultHero userEmail={user.email ?? ""} />
    </div>
  );
}
