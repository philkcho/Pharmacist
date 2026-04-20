-- ============================================================
-- Migration 017: user_stack — what the user actually takes / uses
-- ============================================================
-- Stores the current list of medications, supplements, and
-- cosmetics each user is using. Powers Personal Consult input,
-- FDA recall alerts, drug-interaction warnings, and refill
-- reminders.
--
-- Two-tier matching:
--   1. medication_id (bigint) — matched to public.medications row
--      (preferred — enables interaction checks, recall alerts,
--      affiliate buy links)
--   2. unmatched_name (text) — free-text fallback for items not
--      yet in the catalog. Backfill job upgrades these to
--      medication_id once ensureProductComplete() runs.
-- ============================================================

-- 1. Enum for stack item type
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stack_item_type') then
    create type public.stack_item_type as enum (
      'medication',     -- OTC drug or prescription
      'supplement',     -- vitamin, mineral, herbal
      'cosmetic'        -- skincare, makeup
    );
  end if;
end
$$;


-- 2. user_stack table
-- ------------------------------------------------------------
create table if not exists public.user_stack (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  item_type       public.stack_item_type not null,

  -- Resolved product (preferred path)
  medication_id   bigint references public.medications(id) on delete set null,

  -- Fallback for unmatched items (backfilled later)
  unmatched_name  text,

  -- Usage details
  dosage          text,                       -- '500mg', '1 capsule', 'pea-sized amount'
  frequency       text,                       -- 'daily', 'twice daily', 'PM only', 'as needed'
  timing_notes    text,                       -- 'with food', '4hr after thyroid med', 'PM only'
  started_at      date,
  notes           text,                       -- user's own notes

  -- Source attribution (helps with provenance and re-onboarding)
  source          text,                       -- 'manual', 'photo_ocr', 'rx_label', 'consult_extraction'
  source_attachment_url text,                 -- if added via photo

  is_active       boolean not null default true,
  archived_at     timestamptz,
  archive_reason  text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Either resolved or unmatched, never both null
  constraint user_stack_resolution_check
    check (medication_id is not null or unmatched_name is not null)
);

create index if not exists idx_user_stack_user_active
  on public.user_stack(user_id, is_active)
  where is_active = true;

create index if not exists idx_user_stack_medication
  on public.user_stack(medication_id)
  where medication_id is not null;

create index if not exists idx_user_stack_unmatched
  on public.user_stack(user_id)
  where medication_id is null and unmatched_name is not null;


-- 3. moddatetime trigger
-- ------------------------------------------------------------
drop trigger if exists handle_user_stack_updated_at on public.user_stack;
create trigger handle_user_stack_updated_at
  before update on public.user_stack
  for each row execute procedure extensions.moddatetime(updated_at);


-- 4. RLS — owner-only
-- ------------------------------------------------------------
alter table public.user_stack enable row level security;

create policy "Users manage own stack"
  on public.user_stack for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Pharmacists read all stacks for support"
  on public.user_stack for select
  to authenticated
  using (public.is_pharmacist());


comment on table public.user_stack is
  'Per-user list of currently used medications, supplements, and cosmetics. Two-tier matching: medication_id (resolved) or unmatched_name (free text, upgraded later). Powers Personal Consult, recall alerts, interaction warnings, refill reminders.';
