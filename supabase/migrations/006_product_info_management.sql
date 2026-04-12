-- ============================================================
-- Migration 006: Product Information Management
-- ============================================================
-- Extends medications table with product type classification,
-- pharmacist approval workflow, K-beauty fields, and e-commerce
-- infrastructure (retailers, purchase links, click tracking).
--
-- All changes are additive. No existing columns are dropped.
-- Existing 4 medication rows are backfilled with safe defaults.
-- ============================================================


-- 1. New Enums
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_type') then
    create type public.product_type as enum (
      'otc_drug',      -- FDA-regulated OTC medication
      'supplement',    -- Dietary supplement (vitamins, minerals, etc.)
      'cosmetic',      -- Cosmetic / K-beauty skincare
      'quasi_drug'     -- Medicated cosmetic (SPF sunscreen, acne treatment)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type public.approval_status as enum (
      'draft',           -- Auto-fetched or AI-created, not publicly visible
      'pending_review',  -- Queued for pharmacist approval
      'approved',        -- Pharmacist approved, publicly visible
      'rejected'         -- Pharmacist rejected
    );
  end if;
end
$$;


-- 2. Extend medications table
-- ------------------------------------------------------------

-- Product classification + safety gate
alter table public.medications
  add column if not exists product_type public.product_type not null default 'otc_drug';
alter table public.medications
  add column if not exists approval_status public.approval_status not null default 'draft';
alter table public.medications
  add column if not exists approved_at timestamptz;
alter table public.medications
  add column if not exists approved_by uuid references public.pharmacist_profiles(id) on delete set null;

-- E-commerce identifiers
alter table public.medications
  add column if not exists barcode text;
alter table public.medications
  add column if not exists sku text;
alter table public.medications
  add column if not exists country_of_origin text;

-- K-beauty / cosmetic specific fields
alter table public.medications
  add column if not exists inci_list text;
alter table public.medications
  add column if not exists skin_types text[];
alter table public.medications
  add column if not exists skin_concerns text[];
alter table public.medications
  add column if not exists texture text;
alter table public.medications
  add column if not exists volume_weight text;
alter table public.medications
  add column if not exists k_beauty_brand text;

-- Multi-image support
alter table public.medications
  add column if not exists images jsonb default '[]';

-- External source tracking (OBF, etc.)
alter table public.medications
  add column if not exists obf_barcode text;
alter table public.medications
  add column if not exists external_source text;
alter table public.medications
  add column if not exists external_id text;
alter table public.medications
  add column if not exists last_external_sync timestamptz;

-- New indexes
create index if not exists idx_medications_product_type
  on public.medications(product_type);
create index if not exists idx_medications_approval
  on public.medications(approval_status);
create index if not exists idx_medications_barcode
  on public.medications(barcode) where barcode is not null;
create unique index if not exists idx_medications_obf_barcode
  on public.medications(obf_barcode) where obf_barcode is not null;


-- 3. Backfill existing rows
-- ------------------------------------------------------------
-- Rows with reviewed_at set → approved; otherwise draft.
update public.medications
  set approval_status = 'approved',
      approved_at = reviewed_at
  where reviewed_at is not null
    and approval_status = 'draft';

-- All existing rows are OTC drugs (the only type until now).
-- product_type default is already 'otc_drug', so no update needed.


-- 4. Update RLS — public can only see approved medications
-- ------------------------------------------------------------
drop policy if exists "Medications are publicly readable"
  on public.medications;

create policy "Approved medications are publicly readable"
  on public.medications for select
  to anon, authenticated
  using (approval_status = 'approved' or public.is_pharmacist());


-- 5. Retailers table
-- ------------------------------------------------------------
create table if not exists public.retailers (
  id              bigint generated always as identity primary key,
  name            text not null,
  slug            text not null unique,
  website_url     text not null,
  logo_url        text,
  country         text not null default 'US',
  is_active       boolean not null default true,

  -- Affiliate program
  affiliate_network   text,
  affiliate_base_url  text,
  commission_rate     numeric(5,2),
  cookie_days         integer,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed retailers
insert into public.retailers (name, slug, website_url, country, affiliate_network) values
  ('Amazon',       'amazon',       'https://www.amazon.com',       'US', 'amazon_associates'),
  ('iHerb',        'iherb',        'https://www.iherb.com',        'US', 'impact'),
  ('StyleKorean',  'stylekorean',  'https://www.stylekorean.com',  'KR', null),
  ('YesStyle',     'yesstyle',     'https://www.yesstyle.com',     'US', 'impact')
on conflict (slug) do nothing;

-- RLS for retailers (public read, pharmacist write)
alter table public.retailers enable row level security;

create policy "Retailers are publicly readable"
  on public.retailers for select
  to anon, authenticated
  using (true);

create policy "Pharmacists can manage retailers"
  on public.retailers for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());

-- moddatetime trigger
drop trigger if exists handle_retailers_updated_at on public.retailers;
create trigger handle_retailers_updated_at
  before update on public.retailers
  for each row execute procedure extensions.moddatetime(updated_at);


-- 6. Product purchase links table
-- ------------------------------------------------------------
create table if not exists public.product_purchase_links (
  id              bigint generated always as identity primary key,
  medication_id   bigint not null references public.medications(id) on delete cascade,
  retailer_id     bigint not null references public.retailers(id) on delete cascade,
  url             text not null,
  affiliate_url   text,
  price           numeric(10,2),
  price_currency  text default 'USD',
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  last_price_check timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint product_purchase_links_unique
    unique (medication_id, retailer_id)
);

create index if not exists idx_product_purchase_links_med
  on public.product_purchase_links(medication_id);

-- RLS: public read (only for approved products), pharmacist write
alter table public.product_purchase_links enable row level security;

create policy "Purchase links readable for approved products"
  on public.product_purchase_links for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.medications m
      where m.id = product_purchase_links.medication_id
        and (m.approval_status = 'approved' or public.is_pharmacist())
    )
  );

create policy "Pharmacists can manage purchase links"
  on public.product_purchase_links for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());

drop trigger if exists handle_product_purchase_links_updated_at
  on public.product_purchase_links;
create trigger handle_product_purchase_links_updated_at
  before update on public.product_purchase_links
  for each row execute procedure extensions.moddatetime(updated_at);


-- 7. Purchase click events (append-only analytics log)
-- ------------------------------------------------------------
create table if not exists public.purchase_click_events (
  id              bigint generated always as identity primary key,
  link_id         bigint not null references public.product_purchase_links(id) on delete cascade,
  medication_id   bigint not null,
  retailer_id     bigint not null,
  referrer_type   text not null,
  referrer_id     bigint,
  session_id      text,
  clicked_at      timestamptz not null default now()
);

create index if not exists idx_click_events_link
  on public.purchase_click_events(link_id, clicked_at);
create index if not exists idx_click_events_med
  on public.purchase_click_events(medication_id, clicked_at);

-- RLS: only pharmacists can read analytics; insert allowed for anyone (via API route)
alter table public.purchase_click_events enable row level security;

create policy "Click events are insertable by anyone"
  on public.purchase_click_events for insert
  to anon, authenticated
  with check (true);

create policy "Pharmacists can read click events"
  on public.purchase_click_events for select
  to authenticated
  using (public.is_pharmacist());


-- 8. Category seeds — K-beauty + subcategories
-- ------------------------------------------------------------

-- K-beauty parent
insert into public.categories (name, slug, description, sort_order)
values ('K-Beauty', 'k-beauty', 'Korean beauty and skincare products', 10)
on conflict (slug) do nothing;

-- K-beauty subcategories
insert into public.categories (name, slug, description, parent_id, sort_order)
select name, slug, description, (select id from public.categories where slug = 'k-beauty'), sort_order
from (values
  ('K-Beauty Cleansers',          'k-beauty-cleansers',         'Double cleansing, oil cleansers, foam cleansers',                   1),
  ('K-Beauty Toners & Essences',  'k-beauty-toners-essences',   'Hydrating toners, first essences, treatment essences',              2),
  ('K-Beauty Serums & Ampoules',  'k-beauty-serums-ampoules',   'Concentrated treatments, vitamin C, niacinamide, peptides',         3),
  ('K-Beauty Moisturizers',       'k-beauty-moisturizers',       'Gel creams, sleeping masks, barrier creams',                        4),
  ('K-Beauty Sunscreen',          'k-beauty-sunscreen',          'UV protection, SPF, tone-up sun creams',                            5),
  ('K-Beauty Masks',              'k-beauty-masks',              'Sheet masks, wash-off masks, clay masks',                           6)
) as v(name, slug, description, sort_order)
on conflict (slug) do nothing;

-- Subcategories under existing Skin Care
insert into public.categories (name, slug, description, parent_id, sort_order)
select name, slug, description,
  (select id from public.categories where slug in ('skin-care', 'skin-care-beauty') limit 1),
  sort_order
from (values
  ('Acne Treatments',      'acne-treatments',      'OTC acne medications, benzoyl peroxide, salicylic acid',   1),
  ('Moisturizing Creams',  'moisturizing-creams',   'Facial and body moisturizers, barrier repair',             2)
) as v(name, slug, description, sort_order)
where exists (select 1 from public.categories where slug in ('skin-care', 'skin-care-beauty'))
on conflict (slug) do nothing;

-- Subcategories under existing Vitamins & Supplements
insert into public.categories (name, slug, description, parent_id, sort_order)
select name, slug, description,
  (select id from public.categories where slug = 'vitamins-supplements'),
  sort_order
from (values
  ('Multivitamins',  'multivitamins',  'Daily multivitamin formulas',                      1),
  ('Vitamin C',      'vitamin-c',      'Ascorbic acid supplements and immune support',      2),
  ('Glutathione',    'glutathione',    'Glutathione and antioxidant supplements',            3)
) as v(name, slug, description, sort_order)
where exists (select 1 from public.categories where slug = 'vitamins-supplements')
on conflict (slug) do nothing;
