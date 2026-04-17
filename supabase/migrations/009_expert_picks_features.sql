-- Popular Features for Dr.'s Analysis
-- Expands expert_picks with additional AI-generated content types

ALTER TABLE expert_picks
  ADD COLUMN IF NOT EXISTS clean_transcript text,           -- Filler words removed
  ADD COLUMN IF NOT EXISTS proper_notes jsonb,              -- Structured study notes { heading: string; bullets: string[] }[]
  ADD COLUMN IF NOT EXISTS feature_sections jsonb;          -- Categorized content: { category: string; items: { title: string; content: string }[] }[]
