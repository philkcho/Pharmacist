-- Curate top-5 per category by marking is_featured = true.
--
-- Widget sort: is_featured DESC, comparison_score DESC NULLS LAST, name ASC.
-- So 5 featured products per category surface as top-5 in the homepage
-- category widget. Non-featured remain accessible via compare page full list.
--
-- Idempotent: uses name-based WHERE, safe to run multiple times.
-- Products not yet ingested (missing from medications table) are silently
-- skipped. Re-run after processProductBatch() fills new seed entries.
--
-- Curation rationale: balance of efficacy, brand reputation, and
-- real-world US retailer availability. Pharmacist-reviewed where possible.

-- ─── Pharmaceutical (OTC drugs + supplements) ────────────────

-- Pain Relief
UPDATE medications SET is_featured = true WHERE name IN (
  'Tylenol Extra Strength',
  'Advil',
  'Aleve',
  'Excedrin Migraine',
  'Biofreeze'
);

-- Cold & Flu
UPDATE medications SET is_featured = true WHERE name IN (
  'DayQuil',
  'NyQuil',
  'Mucinex DM',
  'Sudafed PE',
  'Emergen-C'
);

-- Allergy
UPDATE medications SET is_featured = true WHERE name IN (
  'Claritin',
  'Zyrtec',
  'Allegra',
  'Flonase',
  'Benadryl'
);

-- Digestive Health
UPDATE medications SET is_featured = true WHERE name IN (
  'Pepto-Bismol',
  'Tums',
  'Prilosec OTC',
  'Culturelle Probiotic',
  'Miralax'
);

-- Sleep & Relaxation
UPDATE medications SET is_featured = true WHERE name IN (
  'ZzzQuil',
  'Natrol Melatonin',
  'Olly Restful Sleep',
  'Unisom SleepTabs',
  'Hyland''s Calms Forté'
);

-- First Aid
UPDATE medications SET is_featured = true WHERE name IN (
  'Neosporin',
  'Hydrocortisone Cream',
  'Aquaphor Healing Ointment',
  'Bactine MAX',
  'Band-Aid Hydro Seal'
);

-- Eye Care
UPDATE medications SET is_featured = true WHERE name IN (
  'Systane Ultra',
  'Refresh Tears',
  'Pataday Once Daily',
  'Visine Original',
  'Blink Tears Lubricating Eye Drops'
);

-- Vitamins & Supplements (general parent — shows across ingredient children too)
UPDATE medications SET is_featured = true WHERE name IN (
  'Nature Made Vitamin D3',
  'Nordic Naturals Ultimate Omega',
  'Thorne Magnesium Bisglycinate',
  'Jarrow Formulas Probiotics',
  'Vital Proteins Collagen Peptides'
);

-- ─── Beauty (cosmetic + quasi_drug) ──────────────────────────

-- Skin Care
UPDATE medications SET is_featured = true WHERE name IN (
  'CeraVe Hydrating Cleanser',
  'Cetaphil Gentle Cleanser',
  'Vanicream Moisturizing Cream',
  'La Roche-Posay Toleriane',
  'SkinCeuticals C E Ferulic'
);

-- Acne Treatments
UPDATE medications SET is_featured = true WHERE name IN (
  'Differin Gel',
  'CeraVe Acne Foaming Cleanser',
  'Paula''s Choice 2% BHA Exfoliant',
  'The Ordinary Niacinamide 10%',
  'Clean & Clear Persa-Gel 10'
);

-- Anti-Aging
UPDATE medications SET is_featured = true WHERE name IN (
  'The Ordinary Retinol 0.5%',
  'Neutrogena Rapid Wrinkle Repair',
  'RoC Retinol Correxion',
  'Olay Regenerist Retinol24',
  'Paula''s Choice 1% Retinol Booster'
);

-- Moisturizing Creams
UPDATE medications SET is_featured = true WHERE name IN (
  'CeraVe Moisturizing Cream',
  'Cetaphil Moisturizing Cream',
  'Neutrogena Hydro Boost Water Gel',
  'Eucerin Advanced Repair Cream',
  'First Aid Beauty Ultra Repair Cream'
);

-- Sunscreen
UPDATE medications SET is_featured = true WHERE name IN (
  'EltaMD UV Clear SPF 46',
  'La Roche-Posay Anthelios SPF 60',
  'Neutrogena Ultra Sheer SPF 70',
  'CeraVe Hydrating Sunscreen SPF 30',
  'Supergoop Unseen Sunscreen SPF 40'
);

-- K-Beauty
UPDATE medications SET is_featured = true WHERE name IN (
  'COSRX Snail Mucin Essence',
  'Laneige Water Sleeping Mask',
  'Beauty of Joseon Glow Serum',
  'Anua Heartleaf Toner',
  'Skin1004 Madagascar Centella Ampoule'
);
