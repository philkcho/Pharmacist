import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSession, isPharmacist } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  const pharmacist = await isPharmacist();
  if (!pharmacist) {
    redirect("/");
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-6">{children}</div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
