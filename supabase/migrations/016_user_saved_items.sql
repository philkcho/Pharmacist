-- ============================================================
-- Migration 016: User saved items (bookmarks)
-- ============================================================
-- Generic save/bookmark across content types — medications,
-- articles, expert picks, and consults. Powers /saved page,
-- "Save for later" star button, and cross-device sync from
-- localStorage on first sign-in.
--
-- Loose foreign-key handling: item_id is a text column rather
-- than a typed FK because items live in tables with mixed PK
-- types (bigint medications, expert_picks; uuid consults).
-- App-layer enforces existence; orphan rows are tolerated and
-- swept by a periodic job.
-- ============================================================

-- 1. Enum for item type
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'saved_item_type') then
    create type public.saved_item_type as enum (
      'medication',
      'article',
      'expert_pick',
      'trend',
      'consult',
      'qa'           -- public Q&A (consult with visibility='public')
    );
  end if;
end
$$;


-- 2. user_saved_items table
-- ------------------------------------------------------------
create table if not exists public.user_saved_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_type   public.saved_item_type not null,
  item_id     text not null,                 -- accepts both bigint::text and uuid::text
  notes       text,
  created_at  timestamptz not null default now(),

  constraint user_saved_items_unique unique (user_id, item_type, item_id)
);

create index if not exists idx_user_saved_items_user
  on public.user_saved_items(user_id, created_at desc);

create index if not exists idx_user_saved_items_item
  on public.user_saved_items(item_type, item_id);


-- 3. RLS — owner-only
-- ------------------------------------------------------------
alter table public.user_saved_items enable row level security;

create policy "Users manage own saved items"
  on public.user_saved_items for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


comment on table public.user_saved_items is
  'Generic bookmarks across content types. item_id is text to support both bigint and uuid PKs from referenced tables; FK integrity enforced at the application layer.';
