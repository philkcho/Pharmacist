-- ============================================================
-- Migration 005: Three-Layer Trend Pipeline
-- ============================================================
-- Adds the weekly Google Trends ingestion + analysis pipeline.
-- Supports the framework redefinition described in
-- `docs/compare-feature.md` + the plan file
-- `.claude/plans/harmonic-soaring-marble.md`.
--
-- Two new tables:
--   1. trend_topics   — one row per distinct trending query per week
--   2. trend_analyses — one row per analyzed trend (1:1 with topics)
--
-- Pages auto-publish with an amber "AI draft — pending pharmacist
-- review" banner. Pharmacist edits happen post-publish via the
-- `pharmacist_reviewed` boolean, not via a blocking review state.
--
-- All changes are additive. No existing tables are touched.
-- ============================================================


-- 1. Enums
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'trend_source') then
    create type public.trend_source as enum (
      'google_trends'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'trend_category') then
    create type public.trend_category as enum (
      'health',          -- Google Trends "Health" (cat 45) — drugs, conditions, symptoms
      'beauty_fitness',  -- Google Trends "Beauty & Fitness" (cat 44) — skincare
      'other'            -- fallback bucket for future expansion
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'trend_rank_type') then
    create type public.trend_rank_type as enum (
      'top',    -- Top popular queries
      'rising'  -- Rising / breakout queries
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'trend_status') then
    create type public.trend_status as enum (
      'pending',    -- ingested, not yet analyzed
      'analyzing',  -- worker picked it up, analysis in progress
      'published',  -- analysis complete and live on /trending
      'rejected',   -- pharmacist declined post-publish
      'archived'    -- delisted from public /trending but retained for analytics
    );
  end if;
end
$$;


-- 2. trend_topics — one row per distinct trending query per week
-- ------------------------------------------------------------
create table if not exists public.trend_topics (
  id                bigint generated always as identity primary key,
  source            public.trend_source not null default 'google_trends',
  category          public.trend_category not null,
  rank_type         public.trend_rank_type not null,
  rank_position     smallint,                             -- 1 = top of its bucket
  query_text        text not null,                        -- as returned by the source
  normalized_query  text not null,                        -- lowercased, trimmed, diacritic-stripped
  volume_score      integer,                              -- provider-specific search-volume indicator
  detected_week     date not null,                        -- Monday of the ingestion week
  detected_at       timestamptz not null default now(),
  raw_payload       jsonb,                                -- raw provider response for debugging

  status            public.trend_status not null default 'pending',
  analyzed_at       timestamptz,
  analysis_error    text,                                 -- populated on analysis failure
  published_at      timestamptz,
  slug              text,                                 -- assigned at publish time

  -- Post-publish pharmacist review overlay
  pharmacist_reviewed  boolean not null default false,
  reviewed_at          timestamptz,
  reviewed_by          uuid references public.pharmacist_profiles(id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Dedup: same query can only be ingested once per (source, week)
  constraint trend_topics_unique_per_week
    unique (source, normalized_query, detected_week),
  constraint trend_topics_slug_unique
    unique (slug)
);

create index if not exists idx_trend_topics_status_created
  on public.trend_topics(status, created_at desc);

create index if not exists idx_trend_topics_category_rank
  on public.trend_topics(category, rank_type, detected_week desc);

create index if not exists idx_trend_topics_dedupe
  on public.trend_topics(normalized_query, detected_at desc);

create index if not exists idx_trend_topics_published_slug
  on public.trend_topics(slug)
  where status = 'published';

-- Reuse the moddatetime trigger function from migration 001
drop trigger if exists handle_trend_topics_updated_at on public.trend_topics;
create trigger handle_trend_topics_updated_at
  before update on public.trend_topics
  for each row execute procedure extensions.moddatetime(updated_at);


-- 3. trend_analyses — one row per analyzed trend
-- ------------------------------------------------------------
-- 1:1 with trend_topics. Separate table keeps the large JSONB blobs
-- out of the hot-path trend_topics queries (admin lists, cron
-- picks, status filters).
create table if not exists public.trend_analyses (
  trend_topic_id       bigint primary key
                         references public.trend_topics(id) on delete cascade,
  understanding_jsonb  jsonb not null,      -- Layer 1: { topicType, entities, intent }
  sources_jsonb        jsonb not null,      -- Layer 2: SourceFragment[]
  synthesis_jsonb      jsonb,               -- Layer 3: { answer, claims, confidence, ... }
  product_matches_jsonb jsonb,              -- matched medications with ingredient analyses
  market_reaction_jsonb jsonb,              -- related queries / news mentions (optional)
  ai_model             text not null,      -- e.g. 'gemini-2.5-flash'
  generated_at         timestamptz not null default now(),

  -- Pharmacist edit overlay (non-destructive). When present,
  -- UI prefers pharmacist_overrides.<field> over the ai output.
  pharmacist_notes     text,
  pharmacist_overrides jsonb,

  updated_at           timestamptz not null default now()
);

drop trigger if exists handle_trend_analyses_updated_at on public.trend_analyses;
create trigger handle_trend_analyses_updated_at
  before update on public.trend_analyses
  for each row execute procedure extensions.moddatetime(updated_at);


-- 4. Row-Level Security
-- ------------------------------------------------------------

-- trend_topics
alter table public.trend_topics enable row level security;

-- Public read: only published rows
drop policy if exists "Published trends are publicly readable"
  on public.trend_topics;
create policy "Published trends are publicly readable"
  on public.trend_topics for select
  to anon, authenticated
  using (status = 'published');

-- Pharmacists: full access for management
drop policy if exists "Pharmacists can manage all trends"
  on public.trend_topics;
create policy "Pharmacists can manage all trends"
  on public.trend_topics for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());

-- trend_analyses
alter table public.trend_analyses enable row level security;

-- Public read: only when parent trend is published
drop policy if exists "Trend analyses readable if parent trend is published"
  on public.trend_analyses;
create policy "Trend analyses readable if parent trend is published"
  on public.trend_analyses for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.trend_topics t
      where t.id = trend_analyses.trend_topic_id
        and t.status = 'published'
    )
  );

-- Pharmacists: full access
drop policy if exists "Pharmacists can manage trend analyses"
  on public.trend_analyses;
create policy "Pharmacists can manage trend analyses"
  on public.trend_analyses for all
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());
