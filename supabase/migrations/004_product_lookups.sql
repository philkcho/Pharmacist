-- ============================================================
-- Migration 004: Product Lookup tracking + review request queue
-- ============================================================
-- Adds two tables that power the home Lookup widget:
--   1. product_lookups      — audit log of every lookup attempt
--   2. lookup_review_requests — leads from users asking us to curate
--                               a product that wasn't in the DB
--
-- Anonymous users can INSERT both (for logging and submitting their
-- own lookups), but only pharmacists can SELECT — the analytics and
-- review queue are admin-only.
-- ============================================================

-- 1. Enums
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lookup_result_type') then
    create type public.lookup_result_type as enum (
      'pharmacist_reviewed', -- DB hit, fully curated by a pharmacist
      'fda_only',            -- DB hit, FDA-label data only, no pharmacist review
      'miss'                 -- No data found in DB or openFDA
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'review_request_status') then
    create type public.review_request_status as enum (
      'pending',
      'in_progress',
      'done',
      'rejected'
    );
  end if;
end
$$;


-- 2. product_lookups — every lookup attempt
-- ------------------------------------------------------------
-- Serves three purposes:
--   (a) Analytics — which queries are popular? what's the miss rate?
--   (b) Cache key — identical queries within N minutes can be skipped
--                   (implemented in app code, not SQL)
--   (c) Review queue seed — review requests link back to the lookup
--       row so pharmacists see what the user actually typed.
create table if not exists public.product_lookups (
  id                    bigint generated always as identity primary key,
  query_text            text not null,
  result_type           public.lookup_result_type not null,
  matched_medication_id bigint references public.medications(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists idx_product_lookups_query
  on public.product_lookups(query_text);

create index if not exists idx_product_lookups_created
  on public.product_lookups(created_at desc);

create index if not exists idx_product_lookups_result
  on public.product_lookups(result_type);


-- 3. lookup_review_requests — user-submitted review requests
-- ------------------------------------------------------------
-- When the Lookup widget returns "miss" or "fda_only", the user can
-- click "Request pharmacist review" to push this product into the
-- curation queue. This is a critical content pipeline input.
create table if not exists public.lookup_review_requests (
  id                 bigint generated always as identity primary key,
  product_lookup_id  bigint not null references public.product_lookups(id) on delete cascade,
  query_text         text not null,            -- denormalized for easy admin list view
  contact_email      text,                     -- optional — for completion notification
  requester_note     text,                     -- "what do you want to know?"
  status             public.review_request_status not null default 'pending',
  assigned_to        uuid references public.pharmacist_profiles(id) on delete set null,
  reviewer_note      text,                     -- admin-only internal notes
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists idx_review_requests_status
  on public.lookup_review_requests(status, created_at desc);

create index if not exists idx_review_requests_assigned
  on public.lookup_review_requests(assigned_to)
  where assigned_to is not null;

-- Reuse moddatetime trigger
drop trigger if exists handle_lookup_review_requests_updated_at
  on public.lookup_review_requests;
create trigger handle_lookup_review_requests_updated_at
  before update on public.lookup_review_requests
  for each row execute procedure extensions.moddatetime(updated_at);


-- 4. Row-Level Security
-- ------------------------------------------------------------

-- product_lookups
alter table public.product_lookups enable row level security;

drop policy if exists "Anyone can log a lookup" on public.product_lookups;
create policy "Anyone can log a lookup"
  on public.product_lookups for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Pharmacists can read all lookups" on public.product_lookups;
create policy "Pharmacists can read all lookups"
  on public.product_lookups for select
  to authenticated
  using (public.is_pharmacist());

-- lookup_review_requests
alter table public.lookup_review_requests enable row level security;

drop policy if exists "Anyone can submit a review request"
  on public.lookup_review_requests;
create policy "Anyone can submit a review request"
  on public.lookup_review_requests for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Pharmacists can read review requests"
  on public.lookup_review_requests;
create policy "Pharmacists can read review requests"
  on public.lookup_review_requests for select
  to authenticated
  using (public.is_pharmacist());

drop policy if exists "Pharmacists can update review requests"
  on public.lookup_review_requests;
create policy "Pharmacists can update review requests"
  on public.lookup_review_requests for update
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());
