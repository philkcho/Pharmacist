-- ============================================================
-- Migration 015: User profiles for personalization
-- ============================================================
-- 1:1 with auth.users — stores zero-party data the visitor
-- explicitly provides (skin type, conditions, allergies, etc.)
-- Powers Personal Consult input, ingredient warnings, "For You"
-- feed, and digest email curation.
--
-- Sensitive health data — RLS strictly limits read/write to the
-- owning user (and pharmacists for support).
-- ============================================================

-- 1. Enums
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'skin_type') then
    create type public.skin_type as enum (
      'oily', 'dry', 'combination', 'sensitive', 'normal', 'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'pregnancy_status') then
    create type public.pregnancy_status as enum (
      'not_applicable', 'trying', 'pregnant', 'breastfeeding'
    );
  end if;
end
$$;


-- 2. user_profiles table
-- ------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  display_name text,

  -- Demographics (optional)
  age_range text,                              -- '18-24', '25-34', etc.
  pregnancy_status public.pregnancy_status not null default 'not_applicable',

  -- Health context (zero-party, all optional)
  skin_type public.skin_type not null default 'unknown',
  conditions text[] not null default '{}',     -- ['acne', 'eczema', 'thyroid']
  allergies text[] not null default '{}',      -- ['sulfa', 'penicillin', 'fragrance']
  primary_concerns text[] not null default '{}',-- ['anti-aging', 'sleep', 'energy']

  -- Communication preferences
  email_opt_in boolean not null default false,
  push_opt_in boolean not null default false,
  digest_frequency text not null default 'weekly',   -- 'weekly' | 'monthly' | 'off'

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_email_opt_in
  on public.user_profiles(email_opt_in)
  where email_opt_in = true;


-- 3. moddatetime trigger
-- ------------------------------------------------------------
drop trigger if exists handle_user_profiles_updated_at on public.user_profiles;
create trigger handle_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure extensions.moddatetime(updated_at);


-- 4. RLS — owner-only with pharmacist read for support
-- ------------------------------------------------------------
alter table public.user_profiles enable row level security;

create policy "Users read own profile"
  on public.user_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.is_pharmacist());

create policy "Users insert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own profile"
  on public.user_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete own profile"
  on public.user_profiles for delete
  to authenticated
  using (user_id = auth.uid());


comment on table public.user_profiles is
  'Per-user health context (skin type, conditions, allergies) and communication preferences. Powers Personal Consult, ingredient warnings, and digest emails. Owner-only RLS.';
