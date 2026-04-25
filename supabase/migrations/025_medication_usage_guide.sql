-- Migration 025: Add usage_guide_jsonb column to medications
--
-- Stores the practical "Usage Guide & Precautions" section content
-- displayed on /analysis/[slug] below the pros & cons block.
--
-- Shape:
-- {
--   "howToUse":    "string — when/how to take or apply (1-2 sentences)",
--   "storage":     "string — storage instructions (1-2 sentences)",
--   "precautions": "string — key precautions and interactions (1-3 sentences)",
--   "tip":         "string (optional) — pharmacist tip (1-2 sentences)"
-- }
--
-- NULL when AI has not generated this section yet. UI hides the section
-- entirely for rows without data so existing products are unaffected
-- until they are re-analyzed.

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS usage_guide_jsonb JSONB DEFAULT NULL;

COMMENT ON COLUMN medications.usage_guide_jsonb IS
  'Usage Guide & Precautions section: { howToUse, storage, precautions, tip? }. NULL hides the section in UI.';
