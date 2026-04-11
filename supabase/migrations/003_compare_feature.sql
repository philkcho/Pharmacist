-- ============================================================
-- Migration 003: Compare feature foundation
-- ============================================================
-- Adds product comparison columns to `medications` and a new
-- `medication_references` table. Supports the "source-linked,
-- pharmacist-reviewed" differentiation described in
-- docs/compare-feature.md.
--
-- All changes are additive. No existing columns are dropped or
-- renamed, so this migration is safe to run on production.
-- ============================================================

-- 1. Extensions
-- ------------------------------------------------------------
-- pg_trgm powers fuzzy name matching for the Product Lookup
-- feature ("tylonol" → "tylenol" etc.).
create extension if not exists pg_trgm;


-- 2. Source type enum (Tier 1 / 2 / 3 whitelist)
-- ------------------------------------------------------------
-- Every medication_references row must use one of these source
-- types. Prohibited sources (manufacturer marketing, blogs,
-- Wikipedia, retailer pages) are excluded at the DB level.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'medication_source_type') then
    create type public.medication_source_type as enum (
      -- ── Tier 1: Universal primary sources ──
      'fda_label',             -- FDA Drug Label / DailyMed
      'fda_guidance',          -- FDA Guidance Document
      'fda_mocra',             -- FDA MoCRA (cosmetics regulation)
      'pubmed',                -- PubMed peer-reviewed study
      'cochrane',              -- Cochrane systematic review
      'cdc',                   -- CDC recommendation
      'who',                   -- WHO guideline
      'nih_ods',               -- NIH Office of Dietary Supplements
      'nih_medlineplus',       -- NIH MedlinePlus
      'nih_nccih',             -- NIH Center for Complementary & Integrative Health
      'ema',                   -- European Medicines Agency

      -- ── Tier 2: Category-specific expert authorities ──
      'aad',                   -- American Academy of Dermatology
      'dermnet_nz',            -- DermNet NZ
      'cir',                   -- Cosmetic Ingredient Review
      'eu_cosing',             -- EU CosIng Database (INCI)
      'skin_cancer_foundation',-- Skin Cancer Foundation
      'usp',                   -- US Pharmacopeia
      'nsf',                   -- NSF International
      'consumerlab',           -- ConsumerLab.com
      'examine',               -- Examine.com
      'ada_seal',              -- ADA Seal of Acceptance
      'aap',                   -- American Academy of Pediatrics
      'healthychildren',       -- HealthyChildren.org
      'aao',                   -- American Academy of Ophthalmology
      'nih_nei',               -- National Eye Institute
      'aga',                   -- American Gastroenterological Association
      'isapp',                 -- ISAPP (probiotics)
      'red_cross',             -- American Red Cross
      'aha',                   -- American Heart Association
      'aasm',                  -- American Academy of Sleep Medicine

      -- ── Tier 3: Conditional (never cited alone) ──
      'ewg',                   -- EWG Skin Deep Database

      -- ── Fallback ──
      'other_authoritative'    -- Reserved for future whitelisted additions
    );
  end if;
end
$$;


-- 3. Extend `medications` with compare/review fields
-- ------------------------------------------------------------
-- All new columns are nullable or have safe defaults so existing
-- rows keep working without manual backfill.
alter table public.medications
  add column if not exists pros                jsonb       default '[]'::jsonb,
  add column if not exists cons                jsonb       default '[]'::jsonb,
  add column if not exists verdict             text,
  add column if not exists verdict_source_ids  bigint[]    default '{}',
  add column if not exists ingredient_analysis jsonb       default '[]'::jsonb,
  add column if not exists comparison_score    integer,
  add column if not exists scoring_rationale   text,
  add column if not exists is_featured         boolean     not null default false,
  add column if not exists price_range         text,
  add column if not exists price_range_min     numeric(10,2),
  add column if not exists price_range_max     numeric(10,2),
  add column if not exists price_currency      text        default 'USD',
  add column if not exists price_updated_at    timestamptz,
  add column if not exists recommended_for     text[]      default '{}',
  add column if not exists is_ai_drafted       boolean     not null default false,
  add column if not exists reviewed_at         timestamptz,
  add column if not exists reviewed_by         uuid        references public.pharmacist_profiles(id) on delete set null,
  add column if not exists view_count          bigint      not null default 0;

-- Score bounds (0–100). NULL remains allowed for unscored products.
alter table public.medications
  add constraint medications_comparison_score_range
    check (comparison_score is null or (comparison_score >= 0 and comparison_score <= 100))
    not valid;
-- Validate separately so existing rows (all NULL) pass.
alter table public.medications
  validate constraint medications_comparison_score_range;


-- 4. Indexes for comparison lookups + fuzzy search
-- ------------------------------------------------------------
-- Featured products, sorted by score — used by the comparison
-- table on category pages.
create index if not exists idx_medications_featured_score
  on public.medications(is_featured, comparison_score desc nulls last)
  where is_featured = true;

-- Trigram indexes for the Lookup MVP. GIN + gin_trgm_ops lets us
-- ILIKE/similarity-match misspelled product names in O(log n).
create index if not exists idx_medications_name_trgm
  on public.medications using gin (name gin_trgm_ops);

create index if not exists idx_medications_generic_name_trgm
  on public.medications using gin (generic_name gin_trgm_ops);


-- 5. `medication_references` table
-- ------------------------------------------------------------
-- Normalized source registry. Referenced by medications.pros,
-- cons, verdict_source_ids, and ingredient_analysis via bigint
-- id arrays stored in JSONB / array columns.
create table if not exists public.medication_references (
  id             bigint generated always as identity primary key,
  medication_id  bigint not null references public.medications(id) on delete cascade,
  source_type    public.medication_source_type not null,
  tier_level     smallint not null check (tier_level between 1 and 3),
  title          text not null,
  url            text not null,
  authors        text,
  published_at   date,
  accessed_at    timestamptz not null default now(),
  citation_text  text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_medication_references_medication
  on public.medication_references(medication_id);

create index if not exists idx_medication_references_source_type
  on public.medication_references(source_type);

create index if not exists idx_medication_references_tier
  on public.medication_references(tier_level);

-- Reuse the existing moddatetime trigger function from migration 001.
drop trigger if exists handle_medication_references_updated_at
  on public.medication_references;
create trigger handle_medication_references_updated_at
  before update on public.medication_references
  for each row execute procedure extensions.moddatetime(updated_at);


-- 6. Row-Level Security
-- ------------------------------------------------------------
alter table public.medication_references enable row level security;

drop policy if exists "Medication references are publicly readable"
  on public.medication_references;
create policy "Medication references are publicly readable"
  on public.medication_references for select
  to anon, authenticated
  using (true);

drop policy if exists "Pharmacists can manage medication references"
  on public.medication_references;
create policy "Pharmacists can manage medication references"
  on public.medication_references for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());
