-- 010: Visitor analytics — page views with geolocation
-- ============================================================

CREATE TABLE public.page_views (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id   text        NOT NULL,
  session_id   text,
  path         text        NOT NULL,
  referrer     text,
  user_agent   text,
  ip           text,
  country      text,
  region       text,
  city         text,
  duration_seconds integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_created  ON public.page_views (created_at);
CREATE INDEX idx_page_views_path     ON public.page_views (path, created_at);
CREATE INDEX idx_page_views_country  ON public.page_views (country, created_at);
CREATE INDEX idx_page_views_visitor  ON public.page_views (visitor_id, created_at);
