"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Pill,
  ExternalLink,
  Sparkles,
  Inbox,
  TrendingUp,
  Store,
  ShieldCheck,
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Generate Article",
    href: "/articles/generate",
    icon: Sparkles,
  },
  {
    title: "Articles",
    href: "/articles",
    icon: FileText,
  },
  {
    title: "Categories",
    href: "/categories",
    icon: FolderOpen,
  },
  {
    title: "Medications",
    href: "/medications",
    icon: Pill,
  },
  {
    title: "Trends",
    href: "/trends",
    icon: TrendingUp,
  },
  {
    title: "Approval Queue",
    href: "/approval-queue",
    icon: ShieldCheck,
  },
  {
    title: "Retailers",
    href: "/retailers",
    icon: Store,
  },
  {
    title: "Review Requests",
    href: "/review-requests",
    icon: Inbox,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">Dr.pharmacist</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            Admin
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Content Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.includes(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          View Site
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
