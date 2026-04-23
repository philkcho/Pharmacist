-- Ingredient-level supplement child categories.
--
-- Motivation: the homepage "Popular Categories" widget needs granular
-- categories (Fish Oil, Creatine, Vitamin D3+K2, …) that match how users
-- actually search. The existing parent "vitamins-supplements" stays as
-- a fallback bucket for products that don't match any child.
--
-- Safe to run multiple times:
--   - INSERT uses ON CONFLICT (slug) DO NOTHING
--   - UPDATE filters are explicit, idempotent re-tagging

-- 1) Insert 11 child categories under `vitamins-supplements`
DO $$
DECLARE
  parent_id bigint;
BEGIN
  SELECT id INTO parent_id FROM categories WHERE slug = 'vitamins-supplements';

  IF parent_id IS NULL THEN
    RAISE EXCEPTION 'parent category "vitamins-supplements" not found — cannot seed child categories';
  END IF;

  INSERT INTO categories (name, slug, parent_id, sort_order, description)
  VALUES
    ('Fish Oil',           'fish-oil',     parent_id, 1,  'Omega-3 EPA/DHA supplements'),
    ('Creatine',           'creatine',     parent_id, 2,  'Creatine monohydrate and variants'),
    ('Vitamin D',          'vitamin-d',    parent_id, 3,  'Vitamin D3 / D2 supplements'),
    ('Vitamin D3 + K2',    'vitamin-d-k2', parent_id, 4,  'Combined D3 and K2 formulas'),
    ('Magnesium',          'magnesium',    parent_id, 5,  'Magnesium glycinate, citrate, oxide'),
    ('Probiotics',         'probiotics',   parent_id, 6,  'Multi-strain probiotic blends'),
    ('Multivitamin',       'multivitamin', parent_id, 7,  'Daily multivitamins'),
    ('Collagen',           'collagen',     parent_id, 8,  'Hydrolyzed collagen peptides'),
    ('Turmeric Curcumin',  'turmeric',     parent_id, 9,  'Curcumin formulas with bioavailability enhancers'),
    ('Vitamin C',          'vitamin-c',    parent_id, 10, 'Ascorbic acid supplements'),
    ('Vitamin B12',        'vitamin-b12',  parent_id, 11, 'Cyano/methylcobalamin B12')
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- 2) Re-tag existing medications to the narrowest matching child.
-- Order matters: more specific matches (vitamin-d-k2) run before
-- the broader siblings (vitamin-d) so combo products land in the
-- combo bucket rather than being overwritten.

-- Vitamin D3 + K2 (combo) — match first so D3 alone doesn't clobber
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='vitamin-d-k2')
  WHERE approval_status = 'approved'
    AND (
      (generic_name ILIKE '%d3%' AND generic_name ILIKE '%k2%')
      OR (name ILIKE '%d3%' AND name ILIKE '%k2%')
    );

-- Fish Oil
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='fish-oil')
  WHERE approval_status = 'approved'
    AND (
      generic_name ILIKE '%omega-3%'
      OR generic_name ILIKE '%fish oil%'
      OR name ILIKE '%fish oil%'
      OR name ILIKE '%omega-3%'
      OR generic_name ILIKE '%epa%'
      OR generic_name ILIKE '%dha%'
    );

-- Creatine
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='creatine')
  WHERE approval_status = 'approved'
    AND (generic_name ILIKE '%creatine%' OR name ILIKE '%creatine%');

-- Vitamin D (solo — skip rows already tagged as D+K2)
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='vitamin-d')
  WHERE approval_status = 'approved'
    AND category_id IS DISTINCT FROM (SELECT id FROM categories WHERE slug='vitamin-d-k2')
    AND (
      generic_name ILIKE '%cholecalciferol%'
      OR generic_name ILIKE '%ergocalciferol%'
      OR generic_name ILIKE '%vitamin d%'
      OR name ILIKE '%vitamin d%'
    );

-- Magnesium
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='magnesium')
  WHERE approval_status = 'approved'
    AND (generic_name ILIKE '%magnesium%' OR name ILIKE '%magnesium%');

-- Probiotics
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='probiotics')
  WHERE approval_status = 'approved'
    AND (
      generic_name ILIKE '%probiotic%'
      OR generic_name ILIKE '%lactobacillus%'
      OR generic_name ILIKE '%bifidobacterium%'
      OR name ILIKE '%probiotic%'
    );

-- Multivitamin (must be supplement product_type to avoid false hits)
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='multivitamin')
  WHERE approval_status = 'approved'
    AND product_type = 'supplement'
    AND (
      generic_name ILIKE '%multivitamin%'
      OR name ILIKE '%multivitamin%'
      OR name ILIKE '%multi-vitamin%'
    );

-- Collagen
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='collagen')
  WHERE approval_status = 'approved'
    AND (generic_name ILIKE '%collagen%' OR name ILIKE '%collagen%');

-- Turmeric / Curcumin
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='turmeric')
  WHERE approval_status = 'approved'
    AND (
      generic_name ILIKE '%turmeric%'
      OR generic_name ILIKE '%curcumin%'
      OR name ILIKE '%turmeric%'
      OR name ILIKE '%curcumin%'
    );

-- Vitamin C (supplement only — skin-care vitamin C serums stay put)
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='vitamin-c')
  WHERE approval_status = 'approved'
    AND product_type = 'supplement'
    AND (
      generic_name ILIKE '%ascorbic acid%'
      OR generic_name ILIKE '%vitamin c%'
      OR name ILIKE '%vitamin c%'
    );

-- Vitamin B12
UPDATE medications SET category_id = (SELECT id FROM categories WHERE slug='vitamin-b12')
  WHERE approval_status = 'approved'
    AND (
      generic_name ILIKE '%cyanocobalamin%'
      OR generic_name ILIKE '%methylcobalamin%'
      OR generic_name ILIKE '%b12%'
      OR name ILIKE '%b12%'
      OR name ILIKE '%vitamin b-12%'
      OR name ILIKE '%vitamin b12%'
    );
