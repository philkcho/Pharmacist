-- Migration 012: SEO content tables for comparison & ingredient pages
-- ============================================================
-- Powers two SEO-focused content types:
--   1. /compare/[slug-a]-vs-[slug-b] — product comparison pages
--   2. /ingredients/[slug] — ingredient guide pages
--
-- Each row is an AI-generated article cached for SEO + speed.
-- First request triggers generation; subsequent requests read from cache.

-- ── Product comparison articles ─────────────────────────────
create table if not exists public.product_comparisons (
  id bigint primary key generated always as identity,
  -- Alphabetically sorted (slug_a < slug_b) so "a-vs-b" == "b-vs-a"
  slug_a text not null,
  slug_b text not null,
  article_jsonb jsonb not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug_a, slug_b)
);

create index if not exists idx_product_comparisons_lookup
  on public.product_comparisons(slug_a, slug_b);

-- RLS: publicly readable, admin-only write
alter table public.product_comparisons enable row level security;

create policy "comparisons_public_read"
  on public.product_comparisons for select
  to anon, authenticated
  using (true);

create policy "comparisons_admin_write"
  on public.product_comparisons for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());

-- ── Ingredient guide articles ──────────────────────────────
create table if not exists public.ingredient_guides (
  id bigint primary key generated always as identity,
  slug text not null unique,          -- e.g. "niacinamide", "hyaluronic-acid"
  name text not null,                 -- Display name (e.g. "Niacinamide")
  article_jsonb jsonb not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ingredient_guides_slug
  on public.ingredient_guides(slug);

alter table public.ingredient_guides enable row level security;

create policy "ingredient_guides_public_read"
  on public.ingredient_guides for select
  to anon, authenticated
  using (true);

create policy "ingredient_guides_admin_write"
  on public.ingredient_guides for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());
