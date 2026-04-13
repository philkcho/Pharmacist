-- Expert Picks: YouTube expert video analysis
-- Pharmacist-curated summaries of health/beauty expert videos

CREATE TABLE expert_picks (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text UNIQUE NOT NULL,
  youtube_url   text NOT NULL,
  youtube_id    text NOT NULL,
  title         text NOT NULL,
  expert_name   text NOT NULL,
  expert_credential text,
  thumbnail_url text,
  duration      text,
  category      text NOT NULL DEFAULT 'health',

  -- Transcript & AI analysis
  transcript    text,
  summary       text,
  key_takeaways jsonb,           -- string[]
  analysis_sections jsonb,       -- { title: string, content: string }[]
  mentioned_products jsonb,      -- { name: string, slug?: string, reason: string }[]

  -- Status workflow
  status        text NOT NULL DEFAULT 'draft',
  published_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_expert_picks_status ON expert_picks(status);
CREATE INDEX idx_expert_picks_category ON expert_picks(category);
CREATE INDEX idx_expert_picks_published_at ON expert_picks(published_at DESC);
