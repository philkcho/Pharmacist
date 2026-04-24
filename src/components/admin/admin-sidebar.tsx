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
  FolderOpen,
  Pill,
  ExternalLink,
  Inbox,
  TrendingUp,
  Store,
  ShieldCheck,
  Play,
  LogOut,
  Users,
  MessageSquare,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";

// Groups mirror the public homepage layout: first the surfaces a visitor
// actually sees (Dr.'s Analysis → Consult → Articles → Trends), then the
// supporting master data and operations screens the admin needs to maintain
// those surfaces.
const menuGroups: {
  label: string;
  items: { title: string; href: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Homepage Content",
    items: [
      { title: "Dr.'s Analysis", href: "/expert-picks", icon: Play },
      { title: "Consult Queue", href: "/consult-queue", icon: MessageSquare },
      { title: "Trends", href: "/trends", icon: TrendingUp },
    ],
  },
  {
    label: "Master Data",
    items: [
      { title: "Medications", href: "/medications", icon: Pill },
      { title: "Categories", href: "/categories", icon: FolderOpen },
      { title: "Retailers", href: "/retailers", icon: Store },
    ],
  },
  {
    label: "Moderation",
    items: [
      { title: "Approval Queue", href: "/approval-queue", icon: ShieldCheck },
      { title: "Review Requests", href: "/review-requests", icon: Inbox },
    ],
  },
  {
    label: "Administration",
    items: [{ title: "Users", href: "/users", icon: Users }],
  },
];

// `usePathname()` returns the locale-prefixed path (e.g. /en/trends). Strip
// that prefix before matching.
function isActiveRoute(pathname: string, href: string): boolean {
  const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  return stripped === href || stripped.startsWith(href + "/");
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">AI PharmCare</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              Admin
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Go to Homepage"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActiveRoute(pathname, item.href)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-4 pb-6 space-y-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          View Site
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
