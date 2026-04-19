-- Migration 014: add citation storage for Dr.'s Analysis articles.
-- Mirrors the pattern already used for medications/safety/ingredients/
-- comparisons so /expert/[slug] can render a Tier 1 FDA + Tier 2 PubMed
-- References section, matching the other YMYL content types.
--
-- Shape matches `ArticleReference[]` from
--   src/lib/references/fetch-references.ts
-- [{ title, url, kind: 'pubmed' | 'fda', citation?, year? }, ...]

alter table public.expert_picks
  add column if not exists references_jsonb jsonb;

comment on column public.expert_picks.references_jsonb is
  'Array<ArticleReference> — FDA DailyMed + PubMed citations rendered in References section on /expert/[slug]. Populated at pick creation and by backfill script. RLS: reuses existing expert_picks public-read policy.';
