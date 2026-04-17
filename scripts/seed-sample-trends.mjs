import { createClient } from "@supabase/supabase-js";

const c = createClient(
  "https://rlemyrdivdwibooxbugq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZW15cmRpdmR3aWJvb3hidWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxMjk2MCwiZXhwIjoyMDkxMzg4OTYwfQ.CKh85hitF_gYVHrEBy--NGlkbwsBJQL9y8Eh-yzfHOk"
);

const now = new Date().toISOString();

const samples = [
  {
    id: 9,
    slug: "b12-supplement-t9",
    understanding: {
      originalQuery: "b12 supplement",
      normalizedQuery: "b12 supplement",
      topicType: "product_info",
      entities: {
        drugs: [],
        genericIngredients: ["vitamin b12", "cyanocobalamin", "methylcobalamin"],
        symptoms: ["fatigue", "weakness"],
        populations: ["vegetarians", "elderly"],
        conditions: [],
        substances: [],
        categorySlugs: ["vitamins-supplements"],
      },
      intent: "User wants to know about B12 supplements",
    },
    synthesis: {
      answer:
        "Vitamin B12 is essential for nerve function and red blood cell production [0]. Deficiency is common in vegetarians and older adults. Supplements come in cyanocobalamin and methylcobalamin forms, both effective for most people.",
      claims: [
        {
          text: "Vitamin B12 is essential for nerve function and red blood cell production.",
          sourceIndexes: [0],
          isInference: false,
        },
      ],
      confidence: "medium",
      limitations: ["Limited data on optimal dosing for different populations"],
      followUpQuestions: [
        "What is the best form of B12?",
        "How much B12 do I need daily?",
        "Can you take too much B12?",
      ],
      leadExplanation:
        "Vitamin B12 (cobalamin) is a water-soluble vitamin critical for nerve function, DNA synthesis, and red blood cell formation [0]. It has been trending as more people explore plant-based diets, which naturally lack B12 sources. Vegetarians, vegans, and adults over 50 are at higher risk of deficiency because absorption decreases with age and the vitamin is found primarily in animal products. Current evidence supports supplementation for at-risk groups, with both cyanocobalamin and methylcobalamin forms being effective. The recommended daily intake is 2.4 mcg for most adults. Signs of deficiency include fatigue, weakness, numbness, and cognitive difficulties. If you suspect a deficiency, a simple blood test can confirm it. Most over-the-counter B12 supplements are safe and well-tolerated, but consulting a pharmacist about the right dosage for your situation is always recommended.",
      keyTakeaways: [
        "B12 is essential for nerve and blood cell health [0]",
        "Vegetarians and adults over 50 are most at risk",
        "Both cyanocobalamin and methylcobalamin forms work",
        "Recommended daily intake: 2.4 mcg for most adults",
      ],
      redFlags: [
        "Numbness or tingling in hands and feet",
        "Severe fatigue that does not improve with rest",
        "Difficulty walking or balance problems",
      ],
      trendDrivers: ["Growing interest in plant-based diets"],
    },
  },
  {
    id: 14,
    slug: "mineral-sunscreen-t14",
    understanding: {
      originalQuery: "mineral sunscreen",
      normalizedQuery: "mineral sunscreen",
      topicType: "product_info",
      entities: {
        drugs: [],
        genericIngredients: ["zinc oxide", "titanium dioxide"],
        symptoms: ["sunburn"],
        populations: ["sensitive skin"],
        conditions: [],
        substances: [],
        categorySlugs: ["skin-care-beauty"],
      },
      intent: "User wants to know about mineral sunscreens",
    },
    synthesis: {
      answer:
        "Mineral sunscreens use zinc oxide and titanium dioxide to physically block UV rays [0]. They are generally better tolerated by sensitive skin compared to chemical sunscreens. Look for SPF 30+ and broad-spectrum protection.",
      claims: [
        {
          text: "Mineral sunscreens use zinc oxide and titanium dioxide to physically block UV rays.",
          sourceIndexes: [0],
          isInference: false,
        },
      ],
      confidence: "high",
      limitations: ["May leave a white cast on darker skin tones"],
      followUpQuestions: [
        "Mineral vs chemical sunscreen?",
        "Best sunscreen for sensitive skin?",
        "How often should I reapply sunscreen?",
      ],
      leadExplanation:
        "Mineral sunscreens, also known as physical sunscreens, use active ingredients like zinc oxide and titanium dioxide to sit on top of the skin and physically deflect UV rays [0]. Unlike chemical sunscreens that absorb UV radiation, mineral formulas start working immediately upon application. They have been trending as consumers increasingly seek clean beauty products with fewer synthetic chemicals. Dermatologists often recommend mineral sunscreens for people with sensitive or acne-prone skin because they are less likely to cause irritation. The American Academy of Dermatology recommends choosing a broad-spectrum sunscreen with SPF 30 or higher and reapplying every two hours. Modern mineral sunscreens have improved significantly — many now use micronized particles to reduce the white cast that was once a common complaint. When shopping, look for water-resistant formulas if you plan to swim or sweat.",
      keyTakeaways: [
        "Zinc oxide and titanium dioxide physically block UV rays [0]",
        "Better for sensitive and acne-prone skin",
        "Choose SPF 30+ broad-spectrum, reapply every 2 hours",
        "Modern formulas minimize white cast",
      ],
      redFlags: ["Severe sunburn with blistering", "New or changing moles after sun exposure"],
      trendDrivers: ["Growing clean beauty movement"],
    },
  },
  {
    id: 18,
    slug: "face-moisturizer-t18",
    understanding: {
      originalQuery: "face moisturizer",
      normalizedQuery: "face moisturizer",
      topicType: "product_info",
      entities: {
        drugs: [],
        genericIngredients: ["hyaluronic acid", "ceramides", "niacinamide"],
        symptoms: ["dry skin"],
        populations: [],
        conditions: ["eczema"],
        substances: [],
        categorySlugs: ["skin-care-beauty", "k-beauty-moisturizers"],
      },
      intent: "User wants to find a good face moisturizer",
    },
    synthesis: {
      answer:
        "A good face moisturizer should contain humectants like hyaluronic acid, emollients, and barrier-strengthening ceramides [0]. Choose based on your skin type — gel for oily, cream for dry skin.",
      claims: [
        {
          text: "A good face moisturizer should contain humectants like hyaluronic acid, emollients, and barrier-strengthening ceramides.",
          sourceIndexes: [0],
          isInference: false,
        },
      ],
      confidence: "high",
      limitations: ["Individual skin responses vary"],
      followUpQuestions: [
        "Best moisturizer for oily skin?",
        "Do I need a separate eye cream?",
        "How does hyaluronic acid work?",
        "K-beauty moisturizer routine?",
      ],
      leadExplanation:
        "Face moisturizers are a cornerstone of any skincare routine, helping maintain the skin barrier and prevent transepidermal water loss [0]. The best moisturizers combine three types of ingredients: humectants (like hyaluronic acid and glycerin) that draw water into the skin, emollients that smooth and soften, and occlusives (like ceramides and squalane) that lock moisture in. Your skin type should guide your choice — lightweight gel-creams work well for oily or combination skin, while richer creams suit dry or mature skin. K-beauty has popularized layering techniques and innovative textures like sleeping masks and essence-infused creams. Look for fragrance-free options if you have sensitive skin, and consider products with niacinamide for added brightening and pore-minimizing benefits. Apply moisturizer to slightly damp skin for maximum absorption, morning and night.",
      keyTakeaways: [
        "Look for hyaluronic acid + ceramides + niacinamide [0]",
        "Gel-cream for oily skin, rich cream for dry skin",
        "Apply to damp skin for better absorption",
        "Fragrance-free is safer for sensitive skin",
      ],
      redFlags: [
        "Persistent redness or burning after applying moisturizer",
        "Skin that remains extremely dry despite regular moisturizing",
      ],
      trendDrivers: ["K-beauty moisturizer trends"],
    },
  },
];

async function run() {
  for (const s of samples) {
    await c.from("trend_topics").update({
      status: "published",
      slug: s.slug,
      published_at: now,
      analyzed_at: now,
      analysis_error: null,
    }).eq("id", s.id);

    await c.from("trend_analyses").upsert({
      trend_topic_id: s.id,
      understanding_jsonb: s.understanding,
      sources_jsonb: [
        {
          id: 0, tier: 1, sourceType: "pubmed",
          title: "Evidence-based review article",
          url: "https://pubmed.ncbi.nlm.nih.gov/",
          quote: "Comprehensive review of current evidence.",
          citation: "PubMed Review, 2024",
          retrievedAt: now,
          relevanceScore: 80,
        },
      ],
      synthesis_jsonb: s.synthesis,
      product_matches_jsonb: [],
      market_reaction_jsonb: { relatedQueries: [] },
      ai_model: "sample-data",
      generated_at: now,
    }, { onConflict: "trend_topic_id" });

    console.log("Published:", s.id, s.slug);
  }
}

run().catch(console.error);
