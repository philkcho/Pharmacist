-- Add image_url column to trend_topics for auto-generated cover images
ALTER TABLE trend_topics ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN trend_topics.image_url IS 'Auto-generated cover image URL (Pollinations.ai) set during analyzeTrend pipeline';
