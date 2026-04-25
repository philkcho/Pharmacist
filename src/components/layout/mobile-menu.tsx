"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Menu,
  X,
  Sparkles,
  FileText,
  LayoutGrid,
  MessageCircleQuestion,
  Stethoscope,
  Bell,
  Info,
  MessageSquare,
  LogIn,
  LogOut,
  Settings,
  ChevronRight,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";

interface MobileMenuProps {
  showAdmin?: boolean;
  userEmail?: string | null;
}

export function MobileMenu({ showAdmin, userEmail }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while drawer is open + close on Esc.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  // Drawer body — rendered via portal so the parent <header>'s
  // backdrop-blur stacking context can't clip or reposition the
  // fixed-position drawer on mobile.
  const drawer = (
    <>
      {/* Backdrop */}
      <button
        type="button"
        onClick={close}
        aria-label="Close menu"
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
      />

      {/* Drawer panel — full viewport height via dvh; min-h-0 on the nav
          inside lets the menu scroll on short viewports. */}
      <div
        className="fixed right-0 top-0 z-[70] flex h-dvh w-[300px] max-w-[85vw] flex-col bg-background shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Menu</span>
          <button
            onClick={close}
            className="rounded-full p-1.5 hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userEmail && (
          <div className="border-b px-4 py-3 text-xs">
            <p className="text-muted-foreground">Signed in as</p>
            <p className="mt-0.5 truncate font-medium" title={userEmail}>
              {userEmail}
            </p>
          </div>
        )}

        <nav
          className="min-h-0 flex-1 overflow-y-auto py-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Group 1: Discover */}
          <GroupLabel>Discover</GroupLabel>
          <MenuLink href="/trending" icon={Sparkles} onClick={close}>
            Worth the Hype?
          </MenuLink>
          <MenuLink href="/expert" icon={FileText} onClick={close}>
            Dr.&apos;s Analysis
          </MenuLink>
          <MenuLink href="/categories" icon={LayoutGrid} onClick={close}>
            Popular Categories
          </MenuLink>
          <MenuLink
            href="/ask"
            icon={MessageCircleQuestion}
            onClick={close}
          >
            Community Q&amp;A
          </MenuLink>

          <Divider />

          {/* Group 2: Get help */}
          <GroupLabel>Get help</GroupLabel>
          <MenuLink href="/consult" icon={Stethoscope} onClick={close}>
            Ask your pharmacist
          </MenuLink>
          <MenuLink href="/subscribe" icon={Bell} onClick={close}>
            Get pharmacist-curated picks
          </MenuLink>

          <Divider />

          {/* Group 3: Account */}
          <GroupLabel>Account</GroupLabel>
          <MenuLink href="/about" icon={Info} onClick={close}>
            About
          </MenuLink>
          {userEmail && (
            <MenuLink href="/consult" icon={MessageSquare} onClick={close}>
              My questions
            </MenuLink>
          )}
          {showAdmin && (
            <MenuLink href="/dashboard" icon={Settings} onClick={close}>
              Admin
            </MenuLink>
          )}
          {userEmail ? (
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-3">
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  <span>Sign out</span>
                </span>
              </button>
            </form>
          ) : (
            <MenuLink href="/login" icon={LogIn} onClick={close}>
              Sign in
            </MenuLink>
          )}
        </nav>

        <div
          className="border-t px-4 py-3 text-[11px] text-muted-foreground"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          Pharmacist-reviewed health & beauty analysis.
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="-mr-2 rounded-lg p-2 transition-colors hover:bg-muted lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && open && createPortal(drawer, document.body)}
    </>
  );
}

// ── Internal pieces ─────────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-2 border-t" />;
}

interface MenuLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  children: React.ReactNode;
}

function MenuLink({ href, icon: Icon, onClick, children }: MenuLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{children}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
    </Link>
  );
}
