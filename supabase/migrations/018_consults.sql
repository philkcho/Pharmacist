-- ============================================================
-- Migration 018: consults — unified Personal Consult + Public Q&A
-- ============================================================
-- ★ Core table for the end-to-end consult workflow:
--   1. Customer submits multi-modal input (text, photos, voice, lab PDF)
--   2. AI 1차 검토: Vision OCR + RAG (FDA + PubMed) + recommendation matching
--   3. Pharmacist (Younghun) reviews AI draft, edits, approves
--   4. Customer receives private answer at /consult/[id]
--   5. (Opt-in) Anonymized version published to /ask/[slug] for SEO + community
--
-- Single table holds every state — private and public live side by side,
-- distinguished by `visibility`.
--
-- Includes pgvector embedding for semantic similarity matching, full-text
-- search index for public browsing, and FK back to user/pharmacist.
-- ============================================================

-- 1. Required extensions
-- ------------------------------------------------------------
create extension if not exists vector;            -- pgvector for semantic search
create extension if not exists pg_trgm;            -- trigram for fuzzy text


-- 2. Enums
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'consult_status') then
    create type public.consult_status as enum (
      'pending',           -- just submitted, awaiting AI draft
      'ai_drafting',       -- AI working on draft
      'ready_for_review',  -- AI draft complete, in pharmacist queue
      'in_review',         -- pharmacist actively editing
      'approved',          -- pharmacist approved + sent to user
      'needs_more_info',   -- pharmacist requested follow-up from user
      'rejected',          -- pharmacist declined (e.g. out of scope)
      'archived'           -- removed from active queue
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'consult_visibility') then
    create type public.consult_visibility as enum (
      'private',           -- default — only owner + admin can read
      'pending_publish',   -- user opted in, awaiting redaction confirm
      'public',            -- redacted, published to /ask/[slug]
      'archived'           -- previously public, taken down
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'consult_category') then
    create type public.consult_category as enum (
      'drug_interactions',
      'skin_care',
      'supplements',
      'symptoms',
      'pregnancy',
      'pediatric',
      'mental_health',
      'general'
    );
  end if;
end
$$;


-- 3. consults table
-- ------------------------------------------------------------
create table if not exists public.consults (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,                              -- /ask/[slug] URL when public

  -- Owner (nullable to allow email-only submission for anonymous users)
  user_id       uuid references auth.users(id) on delete set null,
  email         text,                                     -- for delivery + magic link
  email_verified boolean not null default false,

  -- ── INPUT (multi-modal) ──────────────────────────────────
  raw_input_jsonb     jsonb not null,                     -- {text, photos[], voice_url, lab_pdf_url, ...}
  input_types         text[] not null default '{}',       -- ['text','photo','voice','lab_pdf']
  profile_snapshot    jsonb,                              -- user_profiles snapshot at submission
  stack_snapshot      jsonb,                              -- user_stack snapshot at submission

  -- ── AI 1차 검토 ─────────────────────────────────────────
  ai_draft_jsonb            jsonb,                        -- {analysis, warnings, routine, do_dont}
  ai_references_jsonb       jsonb,                        -- ArticleReference[] (FDA + PubMed)
  ai_recommendations_jsonb  jsonb,                        -- ProductMatch[] from matchProducts()
  ai_completed_at           timestamptz,
  ai_model                  text,                         -- e.g. 'gemini-2.5-flash'

  -- ── 유사 매칭 (pgvector) ────────────────────────────────
  embedding             vector(768),                      -- input + draft embedding
  similar_consult_id    uuid references public.consults(id) on delete set null,
  similarity_score      numeric(4, 3),                    -- 0.000 – 1.000

  -- ── Workflow status ─────────────────────────────────────
  status        public.consult_status not null default 'pending',
  priority      smallint not null default 0,              -- 0 normal, 10+ high-risk
  is_high_risk  boolean not null default false,           -- AI flagged for fast-track

  -- ── 약사 최종 검토 ──────────────────────────────────────
  pharmacist_id            uuid references public.pharmacist_profiles(id) on delete set null,
  pharmacist_final_jsonb   jsonb,                         -- final answer (edited from AI draft)
  pharmacist_edit_summary  text,                          -- what changed (audit)
  pharmacist_time_seconds  integer,                       -- time spent reviewing
  reviewed_at              timestamptz,

  -- ── 공개 (Public Q&A) ───────────────────────────────────
  visibility            public.consult_visibility not null default 'private',
  category              public.consult_category not null default 'general',
  redacted_input_jsonb  jsonb,                            -- PII-removed for public
  redacted_answer_jsonb jsonb,                            -- PII-removed for public
  related_product_ids   bigint[] not null default '{}',   -- /ask/product/[slug] linkage
  published_at          timestamptz,

  -- ── 메트릭 (public Q&A only) ────────────────────────────
  view_count        integer not null default 0,
  helpful_count     integer not null default 0,
  affiliate_clicks  integer not null default 0,

  -- ── Timestamps ──────────────────────────────────────────
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  archive_reason text,

  -- Slug required when published
  constraint consults_published_slug_check
    check (visibility != 'public' or slug is not null)
);


-- 4. Indexes
-- ------------------------------------------------------------
-- Owner queries (My Consults page)
create index if not exists idx_consults_user
  on public.consults(user_id, created_at desc)
  where user_id is not null;

-- Pharmacist queue (admin/consult-queue)
create index if not exists idx_consults_status_priority
  on public.consults(status, priority desc, created_at)
  where status in ('pending', 'ai_drafting', 'ready_for_review', 'in_review', 'needs_more_info');

-- Public Q&A browse
create index if not exists idx_consults_public
  on public.consults(visibility, published_at desc)
  where visibility = 'public';

-- Category browse
create index if not exists idx_consults_public_category
  on public.consults(category, published_at desc)
  where visibility = 'public';

-- Product-linked Q&A
create index if not exists idx_consults_related_products
  on public.consults using gin (related_product_ids)
  where visibility = 'public';

-- Slug lookup
create unique index if not exists idx_consults_slug_unique
  on public.consults(slug)
  where slug is not null;

-- Full-text search (English) on redacted public content
create index if not exists idx_consults_fts
  on public.consults using gin (
    to_tsvector('english',
      coalesce(redacted_input_jsonb::text, '') || ' ' ||
      coalesce(redacted_answer_jsonb::text, '')
    )
  )
  where visibility = 'public';

-- pgvector HNSW for semantic similarity matching
create index if not exists idx_consults_embedding_hnsw
  on public.consults using hnsw (embedding vector_cosine_ops)
  where embedding is not null;


-- 5. moddatetime trigger
-- ------------------------------------------------------------
drop trigger if exists handle_consults_updated_at on public.consults;
create trigger handle_consults_updated_at
  before update on public.consults
  for each row execute procedure extensions.moddatetime(updated_at);


-- 6. RLS — owner-only for private; public read for published
-- ------------------------------------------------------------
alter table public.consults enable row level security;

-- Public can read published consults (no PII in redacted_*)
create policy "Public consults are publicly readable"
  on public.consults for select
  to anon, authenticated
  using (visibility = 'public');

-- Owners read their own (any visibility)
create policy "Users read own consults"
  on public.consults for select
  to authenticated
  using (user_id = auth.uid());

-- Pharmacists read everything (for queue + support)
create policy "Pharmacists read all consults"
  on public.consults for select
  to authenticated
  using (public.is_pharmacist());

-- Owners create their own consults
create policy "Users insert own consults"
  on public.consults for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Anonymous email-only submissions (user_id null, email required)
create policy "Anonymous users insert email-only consults"
  on public.consults for insert
  to anon
  with check (user_id is null and email is not null);

-- Owners update own consults (limited fields enforced at app layer)
create policy "Users update own consults"
  on public.consults for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pharmacists update for review workflow
create policy "Pharmacists manage all consults"
  on public.consults for update
  to authenticated
  using (public.is_pharmacist())
  with check (public.is_pharmacist());

-- Pharmacists delete (e.g. spam, takedown)
create policy "Pharmacists delete consults"
  on public.consults for delete
  to authenticated
  using (public.is_pharmacist());


-- 7. View counter increment helper (public Q&A)
-- ------------------------------------------------------------
create or replace function public.increment_consult_view(consult_uuid uuid)
returns void as $$
begin
  update public.consults
    set view_count = view_count + 1
    where id = consult_uuid and visibility = 'public';
end;
$$ language plpgsql security definer;

revoke all on function public.increment_consult_view from public;
grant execute on function public.increment_consult_view to anon, authenticated;


comment on table public.consults is
  'Unified personal consult + public Q&A. Single record covers full lifecycle: customer input → AI 1차 검토 → pharmacist review → customer answer → optional anonymized publish. Visibility column distinguishes private/public; redacted_* fields hold PII-removed copies for public exposure.';

comment on column public.consults.embedding is
  'pgvector(768) of input + answer for semantic similarity matching. Generated by AI draft job. Indexed via HNSW for fast nearest-neighbor lookup when matching new questions to existing public Q&A (>0.80 cosine triggers redirect).';

comment on column public.consults.visibility is
  'private = default, owner only. pending_publish = user opted in, awaiting redaction confirm. public = redacted answer published to /ask/[slug]. archived = previously public, removed.';
