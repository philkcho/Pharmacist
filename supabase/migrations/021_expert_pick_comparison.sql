-- Add comparison_jsonb to expert_picks for cached AI-generated
-- "Products at a Glance" comparison. Populated lazily on first view
-- of an /expert/[slug] page with >= 2 mentioned products, or eagerly
-- during createExpertPick() if products are available at analysis time.
--
-- Shape: see ExpertComparison type in src/lib/ai/generate-expert-comparison.ts.

ALTER TABLE expert_picks
  ADD COLUMN IF NOT EXISTS comparison_jsonb jsonb;

COMMENT ON COLUMN expert_picks.comparison_jsonb IS
'Cached AI-generated "Products at a Glance" comparison across mentioned_products. Shape: { ingredientSummary, efficacyVerdicts, valuePick, overallTakeaway }. Nullable — backfilled on first public view or admin regeneration.';
