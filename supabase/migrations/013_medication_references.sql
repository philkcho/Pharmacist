-- Migration 013: store per-product citations (FDA + PubMed) for the
-- Research & References section on /analysis/[slug]. Decouples analysis
-- references from /is-safe's safety_article_jsonb so either page can
-- stand on its own — important because Google indexes them as distinct
-- canonical URLs and thin-content-without-citations hurts YMYL ranking.
--
-- Shape matches `ArticleReference[]` from src/lib/references/fetch-references.ts:
--   [{ title, url, kind: 'pubmed' | 'fda', citation?, year? }, ...]

alter table public.medications
  add column if not exists references_jsonb jsonb;

comment on column public.medications.references_jsonb is
  'Array<ArticleReference> — FDA DailyMed + PubMed citations rendered in Research & References section on /analysis/[slug]. Populated by backfill and on future re-analysis. RLS: reuses existing medications policy (public read of approved rows).';
