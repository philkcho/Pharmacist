import { createClient } from "@supabase/supabase-js";

const c = createClient(
  "https://rlemyrdivdwibooxbugq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZW15cmRpdmR3aWJvb3hidWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxMjk2MCwiZXhwIjoyMDkxMzg4OTYwfQ.CKh85hitF_gYVHrEBy--NGlkbwsBJQL9y8Eh-yzfHOk"
);

async function run() {
  const { data, error } = await c.from("medications").insert({
    name: "CeraVe Moisturizing Cream",
    slug: "cerave-moisturizing-cream",
    generic_name: "Ceramide-based moisturizer",
    brand_names: ["CeraVe"],
    description: "Daily face and body moisturizer with 3 essential ceramides and hyaluronic acid. Developed with dermatologists. Fragrance-free, non-comedogenic.",
    image_url: "https://m.media-amazon.com/images/I/61S7BrCBj7L._SL300_.jpg",
    is_otc: false,
    source: "manual",
    product_type: "cosmetic",
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    country_of_origin: "US",
    price_range: "$14.99 - $18.99",
    recommended_for: ["Dry skin", "Sensitive skin", "Eczema-prone skin", "All ages"],
    dosage_forms: ["Cream", "Tub", "Tube"],
    is_featured: true,
    comparison_score: 92,
    scoring_rationale: "Top-rated by dermatologists, excellent ceramide formula, affordable price point",
    verdict: "A gold-standard daily moisturizer backed by dermatologists — excellent barrier repair at an affordable price.",
    pros: [
      { text: "Contains 3 essential ceramides (1, 3, 6-II) that restore skin barrier", sourceIds: [] },
      { text: "Hyaluronic acid provides long-lasting hydration", sourceIds: [] },
      { text: "MVE technology delivers ingredients over 24 hours", sourceIds: [] },
      { text: "Fragrance-free, non-comedogenic — safe for sensitive skin", sourceIds: [] },
      { text: "Affordable compared to similar ceramide creams", sourceIds: [] },
    ],
    cons: [
      { text: "Thick texture may feel heavy on oily skin types", sourceIds: [] },
      { text: "Tub packaging is less hygienic than pump dispensers", sourceIds: [] },
      { text: "Some users report pilling under makeup", sourceIds: [] },
    ],
    warnings: "For external use only. Avoid contact with eyes. Discontinue use if irritation occurs. Keep out of reach of children.",
    side_effects: "Generally well-tolerated. Rare reports of: mild tingling on first use (usually resolves), breakouts in acne-prone individuals (switch to CeraVe PM if this occurs).",
    ingredient_analysis: [
      {
        name: "Ceramide NP (Ceramide 3)",
        consumer: {
          whatItDoes: { text: "Restores the skin's natural barrier by replenishing lipids lost from cleansing and environmental damage. Think of it as filling the mortar between skin cell bricks." },
          howFast: { text: "Barrier improvement noticeable within 1-2 weeks of daily use" },
          whoItsFor: { text: "Everyone — especially dry, sensitive, or eczema-prone skin" },
          whenToAvoid: [{ text: "No known contraindications — ceramides are naturally present in skin" }],
          maxPerDay: { text: "Apply as needed, typically twice daily (morning and night)" },
        },
        professional: {
          role: "Barrier-repair lipid",
          mechanism: { text: "Intercellular lipid that integrates into the stratum corneum lamellar structure, restoring barrier function and reducing transepidermal water loss (TEWL)." },
          clinicalNotes: { text: "Ceramide-dominant moisturizers shown to improve TEWL by 20-30% in clinical studies. Non-prescription ceramide creams are first-line adjunct therapy for atopic dermatitis per AAD guidelines." },
        },
      },
      {
        name: "Hyaluronic Acid (Sodium Hyaluronate)",
        consumer: {
          whatItDoes: { text: "Holds up to 1000x its weight in water, drawing moisture from the environment into your skin. Provides immediate plumping and hydration." },
          howFast: { text: "Immediate hydration effect; cumulative improvement over 2-4 weeks" },
          whoItsFor: { text: "All skin types — especially dehydrated skin" },
          whenToAvoid: [{ text: "In very dry climates without a sealant on top, it may draw moisture FROM skin instead" }],
          maxPerDay: { text: "Safe for unlimited daily use" },
        },
        professional: {
          role: "Humectant",
          mechanism: { text: "Glycosaminoglycan that binds water molecules via hydrogen bonding. Low-molecular-weight HA penetrates epidermis; high-molecular-weight HA forms a moisture-retaining film on the surface." },
          clinicalNotes: { text: "Cochrane review confirms HA-containing moisturizers significantly improve skin hydration scores. Synergistic with ceramides for barrier repair." },
        },
      },
      {
        name: "Cholesterol",
        consumer: {
          whatItDoes: { text: "Works with ceramides to strengthen the skin barrier. Essential component of healthy skin lipids." },
          howFast: { text: "Gradual improvement as part of the ceramide complex" },
          whoItsFor: { text: "All skin types — critical for mature or compromised skin" },
          whenToAvoid: [],
          maxPerDay: { text: "No limit — naturally present in skin" },
        },
        professional: {
          role: "Barrier lipid / Emollient",
          mechanism: { text: "Physiological lipid that co-assembles with ceramides and fatty acids in the stratum corneum intercellular lamellae. Optimal barrier function requires a ~1:1:1 molar ratio of ceramides:cholesterol:free fatty acids." },
          clinicalNotes: { text: "Deficiency in cholesterol disrupts lamellar body secretion and barrier formation. Topical cholesterol shown to accelerate barrier recovery in murine models." },
        },
      },
      {
        name: "MVE Technology (MultiVesicular Emulsion)",
        consumer: {
          whatItDoes: { text: "CeraVe's patented delivery system that slowly releases moisturizing ingredients over 24 hours, so you stay hydrated all day." },
          howFast: { text: "Sustained release over 24 hours after single application" },
          whoItsFor: { text: "Anyone who wants long-lasting hydration without frequent reapplication" },
          whenToAvoid: [],
          maxPerDay: { text: "Applied with each use of the product" },
        },
        professional: {
          role: "Controlled-release delivery system",
          mechanism: { text: "Concentric lipid bilayer spheres (vesicle-in-vesicle) that sequentially release encapsulated actives as outer layers erode. Sustained ceramide release over 24h vs. bolus delivery in conventional emulsions." },
          clinicalNotes: { text: "Clinical trial data published in JAAD showed MVE-formulated ceramide cream maintained lower TEWL at 24h vs. comparator ceramide cream." },
        },
      },
    ],
    inci_list: "Aqua/Water, Glycerin, Cetearyl Alcohol, Capric/Caprylic Triglycerides, Cetyl Alcohol, Ceteareth-20, Petrolatum, Potassium Phosphate, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Behentrimonium Methosulfate, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Disodium EDTA, Dipotassium Phosphate, Tocopherol, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin",
    skin_types: ["dry", "normal", "sensitive", "combination"],
    skin_concerns: ["dryness", "eczema", "barrier repair", "hydration"],
    texture: "Rich cream",
    volume_weight: "16 oz (453g) / 12 oz / 8 oz",
    images: [{ url: "https://m.media-amazon.com/images/I/61S7BrCBj7L._SL300_.jpg", alt: "CeraVe Moisturizing Cream", isPrimary: true, sortOrder: 0 }],
  }).select("id").single();

  if (error) { console.log("insert error:", error.message); return; }
  console.log("Inserted CeraVe, id:", data.id);

  // Purchase links
  const { data: retailers } = await c.from("retailers").select("id, slug").eq("is_active", true);
  const urls = {
    amazon: "https://www.amazon.com/CeraVe-Moisturizing-Cream-Daily-Moisturizer/dp/B00TTD9BRC",
    iherb: "https://www.iherb.com/pr/cerave-moisturizing-cream/82792",
    stylekorean: "https://www.stylekorean.com/shop/search/result.php?search_str=cerave+moisturizing+cream",
    yesstyle: "https://www.yesstyle.com/en/search?q=cerave+moisturizing+cream",
  };
  for (const r of retailers || []) {
    const url = urls[r.slug];
    if (!url) continue;
    const { error: linkErr } = await c.from("product_purchase_links").insert({
      medication_id: data.id,
      retailer_id: r.id,
      url,
      is_active: true,
      sort_order: Object.keys(urls).indexOf(r.slug),
    });
    if (linkErr) console.log("  link error:", r.slug, linkErr.message);
    else console.log("  link:", r.slug, "OK");
  }
}

run().catch(console.error);
