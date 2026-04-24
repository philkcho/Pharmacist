-- Drop the long-form pharmacist-authored articles feature.
-- Admin UI (/articles, /articles/generate), public pages (/guides, /categories/[slug],
-- /[article-slug], compare "Related guides" section), and /api/articles routes have
-- all been removed. The articles + article_medications tables and the article_status
-- enum are no longer referenced in code.

DROP TABLE IF EXISTS public.article_medications CASCADE;
DROP TABLE IF EXISTS public.articles CASCADE;
DROP TYPE IF EXISTS public.article_status;
