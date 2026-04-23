/**
 * Seed list of popular OTC drugs, supplements, and beauty products.
 *
 * The daily cron picks the next N unprocessed items and creates
 * medication records with full AI analysis.
 *
 * ~300 products ÷ 20/day = ~15 days to fully populate.
 */

export interface SeedProduct {
  name: string;
  genericName?: string;
  productType: "otc_drug" | "supplement" | "cosmetic" | "quasi_drug";
  category: string; // slug matching categories table
}

export const PRODUCT_SEED_LIST: SeedProduct[] = [
  // ──────────────────────────────────────────────
  // Pain Relief
  // ──────────────────────────────────────────────
  { name: "Tylenol Extra Strength", genericName: "acetaminophen", productType: "otc_drug", category: "pain-relief" },
  { name: "Advil", genericName: "ibuprofen", productType: "otc_drug", category: "pain-relief" },
  { name: "Aleve", genericName: "naproxen sodium", productType: "otc_drug", category: "pain-relief" },
  { name: "Excedrin Migraine", genericName: "acetaminophen/aspirin/caffeine", productType: "otc_drug", category: "pain-relief" },
  { name: "Motrin IB", genericName: "ibuprofen", productType: "otc_drug", category: "pain-relief" },
  { name: "Bayer Aspirin", genericName: "aspirin", productType: "otc_drug", category: "pain-relief" },
  { name: "Biofreeze", genericName: "menthol", productType: "otc_drug", category: "pain-relief" },
  { name: "Icy Hot", genericName: "menthol/methyl salicylate", productType: "otc_drug", category: "pain-relief" },
  { name: "Bengay Ultra Strength", genericName: "menthol/methyl salicylate/camphor", productType: "otc_drug", category: "pain-relief" },
  { name: "Salonpas Pain Patch", genericName: "menthol/methyl salicylate", productType: "otc_drug", category: "pain-relief" },

  // ──────────────────────────────────────────────
  // Cold & Flu
  // ──────────────────────────────────────────────
  { name: "DayQuil", genericName: "acetaminophen/dextromethorphan/phenylephrine", productType: "otc_drug", category: "cold-flu" },
  { name: "NyQuil", genericName: "acetaminophen/dextromethorphan/doxylamine", productType: "otc_drug", category: "cold-flu" },
  { name: "Mucinex DM", genericName: "guaifenesin/dextromethorphan", productType: "otc_drug", category: "cold-flu" },
  { name: "Theraflu", genericName: "acetaminophen/phenylephrine/pheniramine", productType: "otc_drug", category: "cold-flu" },
  { name: "Robitussin", genericName: "dextromethorphan/guaifenesin", productType: "otc_drug", category: "cold-flu" },
  { name: "Sudafed PE", genericName: "phenylephrine", productType: "otc_drug", category: "cold-flu" },
  { name: "Zicam Cold Remedy", genericName: "zincum gluconicum", productType: "otc_drug", category: "cold-flu" },
  { name: "Coricidin HBP", genericName: "chlorpheniramine/dextromethorphan", productType: "otc_drug", category: "cold-flu" },
  { name: "Delsym 12 Hour", genericName: "dextromethorphan polistirex", productType: "otc_drug", category: "cold-flu" },
  { name: "Emergen-C", genericName: "vitamin C", productType: "supplement", category: "cold-flu" },

  // ──────────────────────────────────────────────
  // Allergy
  // ──────────────────────────────────────────────
  { name: "Claritin", genericName: "loratadine", productType: "otc_drug", category: "allergy" },
  { name: "Zyrtec", genericName: "cetirizine", productType: "otc_drug", category: "allergy" },
  { name: "Allegra", genericName: "fexofenadine", productType: "otc_drug", category: "allergy" },
  { name: "Benadryl", genericName: "diphenhydramine", productType: "otc_drug", category: "allergy" },
  { name: "Flonase", genericName: "fluticasone propionate", productType: "otc_drug", category: "allergy" },
  { name: "Nasacort", genericName: "triamcinolone acetonide", productType: "otc_drug", category: "allergy" },
  { name: "Xyzal", genericName: "levocetirizine", productType: "otc_drug", category: "allergy" },
  { name: "Zaditor Eye Drops", genericName: "ketotifen fumarate", productType: "otc_drug", category: "allergy" },

  // ──────────────────────────────────────────────
  // Digestive Health
  // ──────────────────────────────────────────────
  { name: "Pepto-Bismol", genericName: "bismuth subsalicylate", productType: "otc_drug", category: "digestive-health" },
  { name: "Tums", genericName: "calcium carbonate", productType: "otc_drug", category: "digestive-health" },
  { name: "Prilosec OTC", genericName: "omeprazole", productType: "otc_drug", category: "digestive-health" },
  { name: "Nexium 24HR", genericName: "esomeprazole", productType: "otc_drug", category: "digestive-health" },
  { name: "Pepcid AC", genericName: "famotidine", productType: "otc_drug", category: "digestive-health" },
  { name: "Imodium AD", genericName: "loperamide", productType: "otc_drug", category: "digestive-health" },
  { name: "Gas-X", genericName: "simethicone", productType: "otc_drug", category: "digestive-health" },
  { name: "Dulcolax", genericName: "bisacodyl", productType: "otc_drug", category: "digestive-health" },
  { name: "Miralax", genericName: "polyethylene glycol 3350", productType: "otc_drug", category: "digestive-health" },
  { name: "Culturelle Probiotic", genericName: "lactobacillus rhamnosus GG", productType: "supplement", category: "digestive-health" },
  { name: "Align Probiotic", genericName: "bifidobacterium 35624", productType: "supplement", category: "digestive-health" },

  // ──────────────────────────────────────────────
  // Sleep Aids
  // ──────────────────────────────────────────────
  { name: "ZzzQuil", genericName: "diphenhydramine", productType: "otc_drug", category: "sleep-relaxation" },
  { name: "Unisom SleepTabs", genericName: "doxylamine succinate", productType: "otc_drug", category: "sleep-relaxation" },
  { name: "Natrol Melatonin", genericName: "melatonin", productType: "supplement", category: "sleep-relaxation" },
  { name: "Olly Sleep Gummies", genericName: "melatonin/L-theanine", productType: "supplement", category: "sleep-relaxation" },
  { name: "Nature Made Melatonin", genericName: "melatonin", productType: "supplement", category: "sleep-relaxation" },

  // ──────────────────────────────────────────────
  // Vitamins & Supplements
  // ──────────────────────────────────────────────
  { name: "Nature Made Vitamin D3", genericName: "cholecalciferol", productType: "supplement", category: "vitamins-supplements" },
  { name: "Nature's Bounty Fish Oil", genericName: "omega-3 fatty acids", productType: "supplement", category: "vitamins-supplements" },
  { name: "Garden of Life Multivitamin", genericName: "multivitamin", productType: "supplement", category: "vitamins-supplements" },
  { name: "Centrum Silver", genericName: "multivitamin/multimineral", productType: "supplement", category: "vitamins-supplements" },
  { name: "One A Day Women's", genericName: "multivitamin", productType: "supplement", category: "vitamins-supplements" },
  { name: "Nordic Naturals Ultimate Omega", genericName: "omega-3 EPA/DHA", productType: "supplement", category: "vitamins-supplements" },
  { name: "NOW Vitamin B12", genericName: "methylcobalamin", productType: "supplement", category: "vitamins-supplements" },
  { name: "Thorne Magnesium Bisglycinate", genericName: "magnesium bisglycinate", productType: "supplement", category: "vitamins-supplements" },
  { name: "Vital Proteins Collagen Peptides", genericName: "hydrolyzed collagen", productType: "supplement", category: "vitamins-supplements" },
  { name: "Athletic Greens AG1", genericName: "greens blend", productType: "supplement", category: "vitamins-supplements" },
  { name: "Jarrow Formulas Glutathione", genericName: "reduced glutathione", productType: "supplement", category: "vitamins-supplements" },
  { name: "Nature Made Vitamin C", genericName: "ascorbic acid", productType: "supplement", category: "vitamins-supplements" },
  { name: "Solgar Vitamin B Complex", genericName: "B-complex vitamins", productType: "supplement", category: "vitamins-supplements" },
  { name: "Life Extension CoQ10", genericName: "ubiquinone", productType: "supplement", category: "vitamins-supplements" },
  { name: "Jarrow Formulas Probiotics", genericName: "multi-strain probiotic", productType: "supplement", category: "vitamins-supplements" },
  { name: "NOW Foods Ashwagandha", genericName: "withania somnifera extract", productType: "supplement", category: "vitamins-supplements" },
  { name: "Sports Research Vitamin K2+D3", genericName: "menaquinone-7/cholecalciferol", productType: "supplement", category: "vitamins-supplements" },

  // ──────────────────────────────────────────────
  // First Aid
  // ──────────────────────────────────────────────
  { name: "Neosporin", genericName: "bacitracin/neomycin/polymyxin B", productType: "otc_drug", category: "first-aid" },
  { name: "Hydrocortisone Cream", genericName: "hydrocortisone", productType: "otc_drug", category: "first-aid" },
  { name: "Aquaphor Healing Ointment", genericName: "petrolatum", productType: "otc_drug", category: "first-aid" },
  { name: "Bactine MAX", genericName: "lidocaine/benzalkonium chloride", productType: "otc_drug", category: "first-aid" },
  { name: "Band-Aid Hydro Seal", genericName: "hydrocolloid bandage", productType: "otc_drug", category: "first-aid" },

  // ──────────────────────────────────────────────
  // Eye Care
  // ──────────────────────────────────────────────
  { name: "Systane Ultra", genericName: "polyethylene glycol/propylene glycol", productType: "otc_drug", category: "eye-care" },
  { name: "Refresh Tears", genericName: "carboxymethylcellulose sodium", productType: "otc_drug", category: "eye-care" },
  { name: "Visine Original", genericName: "tetrahydrozoline", productType: "otc_drug", category: "eye-care" },
  { name: "Pataday Once Daily", genericName: "olopatadine", productType: "otc_drug", category: "eye-care" },
  { name: "Blink Tears Lubricating Eye Drops", genericName: "polyethylene glycol 400", productType: "otc_drug", category: "eye-care" },

  // ──────────────────────────────────────────────
  // Sunscreen & SPF
  // ──────────────────────────────────────────────
  { name: "Neutrogena Ultra Sheer SPF 70", genericName: "avobenzone/homosalate/octisalate/octocrylene", productType: "cosmetic", category: "sunscreen" },
  { name: "La Roche-Posay Anthelios SPF 60", genericName: "avobenzone/homosalate/octisalate/octocrylene", productType: "cosmetic", category: "sunscreen" },
  { name: "EltaMD UV Clear SPF 46", genericName: "zinc oxide/octinoxate", productType: "cosmetic", category: "sunscreen" },
  { name: "Supergoop Unseen Sunscreen SPF 40", genericName: "avobenzone/homosalate/octisalate/octocrylene", productType: "cosmetic", category: "sunscreen" },
  { name: "CeraVe Hydrating Sunscreen SPF 30", genericName: "zinc oxide/titanium dioxide", productType: "cosmetic", category: "sunscreen" },
  { name: "Blue Lizard Sensitive SPF 50", genericName: "zinc oxide/titanium dioxide", productType: "cosmetic", category: "sunscreen" },
  { name: "Sun Bum Original SPF 50", genericName: "avobenzone/homosalate/octisalate/octocrylene", productType: "cosmetic", category: "sunscreen" },

  // ──────────────────────────────────────────────
  // Acne & Skin Care
  // ──────────────────────────────────────────────
  { name: "Differin Gel", genericName: "adapalene 0.1%", productType: "otc_drug", category: "acne-treatments" },
  { name: "CeraVe Acne Foaming Cleanser", genericName: "benzoyl peroxide 4%", productType: "otc_drug", category: "acne-treatments" },
  { name: "Clean & Clear Persa-Gel 10", genericName: "benzoyl peroxide 10%", productType: "otc_drug", category: "acne-treatments" },
  { name: "Stridex Maximum Pads", genericName: "salicylic acid 2%", productType: "otc_drug", category: "acne-treatments" },
  { name: "Paula's Choice 2% BHA Exfoliant", genericName: "salicylic acid 2%", productType: "cosmetic", category: "acne-treatments" },
  { name: "The Ordinary Niacinamide 10%", genericName: "niacinamide", productType: "cosmetic", category: "acne-treatments" },
  { name: "CeraVe Moisturizing Cream", genericName: "ceramides/hyaluronic acid", productType: "cosmetic", category: "moisturizing-creams" },
  { name: "Cetaphil Moisturizing Cream", genericName: "glycerin/petrolatum", productType: "cosmetic", category: "moisturizing-creams" },
  { name: "Neutrogena Hydro Boost Water Gel", genericName: "hyaluronic acid/glycerin", productType: "cosmetic", category: "moisturizing-creams" },
  { name: "Eucerin Advanced Repair Cream", genericName: "urea/ceramide-3", productType: "cosmetic", category: "moisturizing-creams" },
  { name: "First Aid Beauty Ultra Repair Cream", genericName: "colloidal oatmeal/shea butter", productType: "cosmetic", category: "moisturizing-creams" },
  { name: "CeraVe Hydrating Cleanser", genericName: "ceramides/hyaluronic acid", productType: "cosmetic", category: "skin-care" },
  { name: "Cetaphil Gentle Cleanser", genericName: "cetyl alcohol/propylene glycol", productType: "cosmetic", category: "skin-care" },
  { name: "Vanicream Moisturizing Cream", genericName: "petrolatum/sorbitol", productType: "cosmetic", category: "skin-care" },
  { name: "La Roche-Posay Toleriane", genericName: "niacinamide/ceramides", productType: "cosmetic", category: "skin-care" },

  // ──────────────────────────────────────────────
  // Anti-Aging & Serums
  // ──────────────────────────────────────────────
  { name: "The Ordinary Retinol 0.5%", genericName: "retinol", productType: "cosmetic", category: "anti-aging" },
  { name: "RoC Retinol Correxion", genericName: "retinol", productType: "cosmetic", category: "anti-aging" },
  { name: "Neutrogena Rapid Wrinkle Repair", genericName: "retinol/hyaluronic acid", productType: "cosmetic", category: "anti-aging" },
  { name: "Olay Regenerist Retinol24", genericName: "retinol/niacinamide", productType: "cosmetic", category: "anti-aging" },
  { name: "Paula's Choice 1% Retinol Booster", genericName: "retinol", productType: "cosmetic", category: "anti-aging" },
  { name: "The Ordinary Hyaluronic Acid 2%", genericName: "hyaluronic acid", productType: "cosmetic", category: "skin-care" },
  { name: "The Ordinary Vitamin C Suspension 23%", genericName: "ascorbic acid", productType: "cosmetic", category: "skin-care" },
  { name: "SkinCeuticals C E Ferulic", genericName: "L-ascorbic acid/alpha tocopherol/ferulic acid", productType: "cosmetic", category: "skin-care" },
  { name: "Drunk Elephant C-Firma", genericName: "L-ascorbic acid", productType: "cosmetic", category: "skin-care" },

  // ──────────────────────────────────────────────
  // K-Beauty
  // ──────────────────────────────────────────────
  { name: "COSRX Snail Mucin Essence", genericName: "snail secretion filtrate", productType: "cosmetic", category: "k-beauty" },
  { name: "COSRX Low pH Cleanser", genericName: "tea tree oil/BHA", productType: "cosmetic", category: "k-beauty" },
  { name: "Laneige Water Sleeping Mask", genericName: "hydro ionized mineral water", productType: "cosmetic", category: "k-beauty" },
  { name: "Laneige Lip Sleeping Mask", genericName: "berry complex/vitamin C", productType: "cosmetic", category: "k-beauty" },
  { name: "COSRX AHA/BHA Clarifying Toner", genericName: "glycolic acid/betaine salicylate", productType: "cosmetic", category: "k-beauty" },
  { name: "Innisfree Green Tea Seed Serum", genericName: "green tea extract", productType: "cosmetic", category: "k-beauty" },
  { name: "MISSHA Time Revolution Essence", genericName: "saccharomyces ferment filtrate", productType: "cosmetic", category: "k-beauty" },
  { name: "Banila Co Clean It Zero", genericName: "sherbet cleansing balm", productType: "cosmetic", category: "k-beauty" },
  { name: "Some By Mi AHA BHA PHA Toner", genericName: "glycolic/salicylic/gluconolactone", productType: "cosmetic", category: "k-beauty" },
  { name: "Etude House SoonJung Barrier Cream", genericName: "panthenol/madecassoside", productType: "cosmetic", category: "k-beauty" },
  { name: "Beauty of Joseon Glow Serum", genericName: "propolis/niacinamide", productType: "cosmetic", category: "k-beauty" },
  { name: "Torriden Dive-In Serum", genericName: "5 types hyaluronic acid", productType: "cosmetic", category: "k-beauty" },
  { name: "Anua Heartleaf Toner", genericName: "houttuynia cordata extract", productType: "cosmetic", category: "k-beauty" },
  { name: "Skin1004 Madagascar Centella Ampoule", genericName: "centella asiatica extract", productType: "cosmetic", category: "k-beauty" },
  { name: "Round Lab Dokdo Cleanser", genericName: "ulleungdo deep sea water", productType: "cosmetic", category: "k-beauty" },
];
