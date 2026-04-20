import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ConsultSidebar } from "@/components/consult/consult-sidebar";
import { isPharmacist } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [showAdmin, { data: { user } }] = await Promise.all([
    isPharmacist(),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <Header showAdmin={showAdmin} userEmail={user?.email ?? null} />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 lg:px-6">
        <ConsultSidebar userEmail={user?.email ?? null} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </>
  );
}
