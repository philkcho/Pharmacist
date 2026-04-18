"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  label: string;
}

interface ArticleTocProps {
  items: TocItem[];
}

// Sticky outline with IntersectionObserver-based active tracking.
// Desktop-only (consumer controls visibility via wrapper).
// Uses rootMargin biased toward the top so an item is considered
// "current" as soon as it crosses the upper third of the viewport,
// not when it reaches the very top.
export function ArticleToc({ items }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;

    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Collect all entries currently intersecting and pick the one
        // closest to the top of the viewport — avoids flickering between
        // two adjacent sections both partially in view.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        );
        setActiveId(visible[0].target.id);
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Article contents"
      className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto lg:block"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block border-l-2 py-1.5 pl-3 text-sm leading-snug transition-colors ${
                  isActive
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Simple collapsible native HTML TOC for mobile. No JS needed.
export function ArticleTocMobile({ items }: ArticleTocProps) {
  if (items.length === 0) return null;
  return (
    <details className="mb-8 rounded-lg border bg-muted/20 open:pb-3 lg:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">
        <span className="select-none">Contents</span>
        <span className="float-right text-muted-foreground">
          <ChevronDown />
        </span>
      </summary>
      <ul className="space-y-1 px-4">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ChevronDown() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
