import {
  pgTable,
  bigint,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
  smallint,
  numeric,
  date,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "in_review",
  "published",
  "archived",
]);

export const appRoleEnum = pgEnum("app_role", ["pharmacist", "user"]);

// Lookup result classification (matches migration 004).
export const lookupResultTypeEnum = pgEnum("lookup_result_type", [
  "pharmacist_reviewed",
  "fda_only",
  "miss",
]);

// Review request lifecycle.
export const reviewRequestStatusEnum = pgEnum("review_request_status", [
  "pending",
  "in_progress",
  "done",
  "rejected",
]);

// Source type whitelist for medication_references.
// Kept in lockstep with migration 003's public.medication_source_type
// enum and the TypeScript union in src/lib/references/category-source-map.ts.
export const medicationSourceTypeEnum = pgEnum("medication_source_type", [
  // Tier 1 — Universal
  "fda_label",
  "fda_guidance",
  "fda_mocra",
  "pubmed",
  "cochrane",
  "cdc",
  "who",
  "nih_ods",
  "nih_medlineplus",
  "nih_nccih",
  "ema",
  // Tier 2 — Category-specific
  "aad",
  "dermnet_nz",
  "cir",
  "eu_cosing",
  "skin_cancer_foundation",
  "usp",
  "nsf",
  "consumerlab",
  "examine",
  "ada_seal",
  "aap",
  "healthychildren",
  "aao",
  "nih_nei",
  "aga",
  "isapp",
  "red_cross",
  "aha",
  "aasm",
  // Tier 3 — Conditional
  "ewg",
  // Fallback
  "other_authoritative",
]);

// Product classification + approval (matches migration 006).
export const productTypeEnum = pgEnum("product_type", [
  "otc_drug",
  "supplement",
  "cosmetic",
  "quasi_drug",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
]);

// Trend pipeline enums (matches migration 005).
export const trendSourceEnum = pgEnum("trend_source", ["google_trends"]);

export const trendCategoryEnum = pgEnum("trend_category", [
  "health",
  "beauty_fitness",
  "other",
]);

export const trendRankTypeEnum = pgEnum("trend_rank_type", ["top", "rising"]);

export const trendStatusEnum = pgEnum("trend_status", [
  "pending",
  "analyzing",
  "published",
  "rejected",
  "archived",
]);

// Categories
export const categories = pgTable(
  "categories",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    description: text(),
    parentId: bigint("parent_id", { mode: "number" }).references(
      (): any => categories.id,
      { onDelete: "set null" }
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_categories_parent").on(table.parentId)]
);

// Pharmacist Profiles
export const pharmacistProfiles = pgTable(
  "pharmacist_profiles",
  {
    id: uuid().primaryKey(), // references auth.users(id)
    displayName: text("display_name").notNull(),
    slug: text().notNull().unique(),
    title: text(), // e.g. "PharmD, RPh"
    bio: text(),
    avatarUrl: text("avatar_url"),
    licenseNumber: text("license_number"),
    licenseState: text("license_state"),
    specializations: text().array(),
    websiteUrl: text("website_url"),
    socialLinks: jsonb("social_links").default({}),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_pharmacist_slug").on(table.slug)]
);

// Medications
export const medications = pgTable(
  "medications",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    genericName: text("generic_name"),
    brandNames: text("brand_names").array(),
    description: text(),
    activeIngredients: jsonb("active_ingredients").default([]),
    dosageForms: text("dosage_forms").array(),
    warnings: text(),
    sideEffects: text("side_effects"),
    categoryId: bigint("category_id", { mode: "number" }).references(
      () => categories.id,
      { onDelete: "set null" }
    ),
    imageUrl: text("image_url"),
    isOtc: boolean("is_otc").notNull().default(true),
    purchaseLinks: jsonb("purchase_links").default([]),
    fdaSplId: text("fda_spl_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    source: text().notNull().default("manual"),

    // Compare feature fields (added in migration 003)
    // pros/cons are jsonb arrays of { text, sourceIds: number[] }
    pros: jsonb().default([]),
    cons: jsonb().default([]),
    verdict: text(),
    verdictSourceIds: bigint("verdict_source_ids", { mode: "number" })
      .array()
      .default(sql`'{}'::bigint[]`),
    ingredientAnalysis: jsonb("ingredient_analysis").default([]),
    comparisonScore: integer("comparison_score"),
    scoringRationale: text("scoring_rationale"),
    isFeatured: boolean("is_featured").notNull().default(false),
    priceRange: text("price_range"),
    priceRangeMin: numeric("price_range_min", { precision: 10, scale: 2 }),
    priceRangeMax: numeric("price_range_max", { precision: 10, scale: 2 }),
    priceCurrency: text("price_currency").default("USD"),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    recommendedFor: text("recommended_for")
      .array()
      .default(sql`'{}'::text[]`),
    isAiDrafted: boolean("is_ai_drafted").notNull().default(false),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => pharmacistProfiles.id, {
      onDelete: "set null",
    }),
    viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),

    // Product classification + approval gate (migration 006)
    productType: productTypeEnum("product_type").notNull().default("otc_drug"),
    approvalStatus: approvalStatusEnum("approval_status")
      .notNull()
      .default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => pharmacistProfiles.id, {
      onDelete: "set null",
    }),

    // E-commerce identifiers
    barcode: text(),
    sku: text(),
    countryOfOrigin: text("country_of_origin"),

    // K-beauty / cosmetic specific
    inciList: text("inci_list"),
    skinTypes: text("skin_types").array(),
    skinConcerns: text("skin_concerns").array(),
    texture: text(),
    volumeWeight: text("volume_weight"),
    kBeautyBrand: text("k_beauty_brand"),

    // Multi-image support
    images: jsonb().default([]),

    // External source tracking
    obfBarcode: text("obf_barcode"),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    lastExternalSync: timestamp("last_external_sync", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_medications_category").on(table.categoryId),
    index("idx_medications_fda_spl_id").on(table.fdaSplId),
    index("idx_medications_last_synced_at").on(table.lastSyncedAt),
    index("idx_medications_featured_score").on(
      table.isFeatured,
      table.comparisonScore
    ),
    index("idx_medications_product_type").on(table.productType),
    index("idx_medications_approval").on(table.approvalStatus),
    check(
      "medications_comparison_score_range",
      sql`${table.comparisonScore} is null or (${table.comparisonScore} >= 0 and ${table.comparisonScore} <= 100)`
    ),
  ]
);

// Medication References — normalized source registry for compare feature.
// Each row represents one authoritative citation for a medication's
// pros, cons, verdict, or ingredient_analysis claim. Referenced by
// bigint id from the respective JSONB/array fields on `medications`.
export const medicationReferences = pgTable(
  "medication_references",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    medicationId: bigint("medication_id", { mode: "number" })
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    sourceType: medicationSourceTypeEnum("source_type").notNull(),
    tierLevel: smallint("tier_level").notNull(),
    title: text().notNull(),
    url: text().notNull(),
    authors: text(),
    publishedAt: date("published_at"),
    accessedAt: timestamp("accessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    citationText: text("citation_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_medication_references_medication").on(table.medicationId),
    index("idx_medication_references_source_type").on(table.sourceType),
    index("idx_medication_references_tier").on(table.tierLevel),
    check(
      "medication_references_tier_range",
      sql`${table.tierLevel} between 1 and 3`
    ),
  ]
);

// Articles
export const articles = pgTable(
  "articles",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    excerpt: text(),
    content: jsonb().notNull().default({}),
    status: articleStatusEnum().notNull().default("draft"),
    categoryId: bigint("category_id", { mode: "number" }).references(
      () => categories.id,
      { onDelete: "set null" }
    ),
    authorId: uuid("author_id")
      .notNull()
      .references(() => pharmacistProfiles.id, { onDelete: "restrict" }),
    featuredImage: text("featured_image"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoKeywords: text("seo_keywords").array(),
    canonicalUrl: text("canonical_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => pharmacistProfiles.id),
    isAiDrafted: boolean("is_ai_drafted").notNull().default(false),
    aiModel: text("ai_model"),
    readingTimeMinutes: integer("reading_time_minutes"),
    viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_articles_status").on(table.status),
    index("idx_articles_author").on(table.authorId),
    index("idx_articles_category").on(table.categoryId),
    index("idx_articles_published").on(table.publishedAt),
  ]
);

// Article-Medication Junction
export const articleMedications = pgTable(
  "article_medications",
  {
    articleId: bigint("article_id", { mode: "number" })
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    medicationId: bigint("medication_id", { mode: "number" })
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isRecommended: boolean("is_recommended").notNull().default(true),
    recommendationNote: text("recommendation_note"),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.medicationId] }),
    index("idx_article_medications_med").on(table.medicationId),
  ]
);

// Product Lookups — every lookup attempt from the home widget.
// Used for analytics, miss-rate tracking, and as the seed table for
// lookup_review_requests below. Anonymous users can INSERT (to log
// their own lookups), but only pharmacists can SELECT.
export const productLookups = pgTable(
  "product_lookups",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    queryText: text("query_text").notNull(),
    resultType: lookupResultTypeEnum("result_type").notNull(),
    matchedMedicationId: bigint("matched_medication_id", {
      mode: "number",
    }).references(() => medications.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_product_lookups_query").on(table.queryText),
    index("idx_product_lookups_created").on(table.createdAt),
    index("idx_product_lookups_result").on(table.resultType),
  ]
);

// Lookup Review Requests — users asking us to curate a product.
// Populated by the "Request pharmacist review" button on the Lookup
// result card. The admin review queue reads from this table.
export const lookupReviewRequests = pgTable(
  "lookup_review_requests",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    productLookupId: bigint("product_lookup_id", { mode: "number" })
      .notNull()
      .references(() => productLookups.id, { onDelete: "cascade" }),
    queryText: text("query_text").notNull(),
    contactEmail: text("contact_email"),
    requesterNote: text("requester_note"),
    status: reviewRequestStatusEnum().notNull().default("pending"),
    assignedTo: uuid("assigned_to").references(() => pharmacistProfiles.id, {
      onDelete: "set null",
    }),
    reviewerNote: text("reviewer_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_review_requests_status").on(table.status, table.createdAt),
    index("idx_review_requests_assigned").on(table.assignedTo),
  ]
);

// User Roles (for Supabase Auth Custom Access Token Hook)
export const userRoles = pgTable(
  "user_roles",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").notNull(),
    role: appRoleEnum().notNull(),
  },
  (table) => [uniqueIndex("idx_user_roles_unique").on(table.userId, table.role)]
);

// Trend Topics — one row per distinct trending query per weekly
// ingestion. Populated by the weekly cron ingestion job from
// Google Trends. Deduped at insert time via the unique constraint
// on (source, normalized_query, detected_week).
export const trendTopics = pgTable(
  "trend_topics",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    source: trendSourceEnum().notNull().default("google_trends"),
    category: trendCategoryEnum().notNull(),
    rankType: trendRankTypeEnum("rank_type").notNull(),
    rankPosition: smallint("rank_position"),
    queryText: text("query_text").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    volumeScore: integer("volume_score"),
    detectedWeek: date("detected_week").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rawPayload: jsonb("raw_payload"),

    status: trendStatusEnum().notNull().default("pending"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    analysisError: text("analysis_error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    slug: text(),

    // Auto-generated cover image (Pollinations.ai)
    imageUrl: text("image_url"),

    // Post-publish pharmacist review overlay
    pharmacistReviewed: boolean("pharmacist_reviewed")
      .notNull()
      .default(false),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => pharmacistProfiles.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("trend_topics_unique_per_week").on(
      table.source,
      table.normalizedQuery,
      table.detectedWeek
    ),
    uniqueIndex("trend_topics_slug_unique").on(table.slug),
    index("idx_trend_topics_status_created").on(table.status, table.createdAt),
    index("idx_trend_topics_category_rank").on(
      table.category,
      table.rankType,
      table.detectedWeek
    ),
    index("idx_trend_topics_dedupe").on(table.normalizedQuery, table.detectedAt),
  ]
);

// Trend Analyses — 1:1 with trend_topics. Large JSONB blobs kept out
// of the hot-path trend_topics queries. Populated by the analysis
// worker running Layer 1 (classify) + Layer 2 (retrieve) + Layer 3
// (synthesize) on each pending topic.
export const trendAnalyses = pgTable("trend_analyses", {
  trendTopicId: bigint("trend_topic_id", { mode: "number" })
    .primaryKey()
    .references(() => trendTopics.id, { onDelete: "cascade" }),
  understandingJsonb: jsonb("understanding_jsonb").notNull(),
  sourcesJsonb: jsonb("sources_jsonb").notNull(),
  synthesisJsonb: jsonb("synthesis_jsonb"),
  productMatchesJsonb: jsonb("product_matches_jsonb"),
  marketReactionJsonb: jsonb("market_reaction_jsonb"),
  aiModel: text("ai_model").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  // Pharmacist edit overlay
  pharmacistNotes: text("pharmacist_notes"),
  pharmacistOverrides: jsonb("pharmacist_overrides"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, { relationName: "categoryHierarchy" }),
  articles: many(articles),
  medications: many(medications),
}));

export const pharmacistProfilesRelations = relations(
  pharmacistProfiles,
  ({ many }) => ({
    articles: many(articles),
  })
);

export const medicationsRelations = relations(medications, ({ one, many }) => ({
  category: one(categories, {
    fields: [medications.categoryId],
    references: [categories.id],
  }),
  articleMedications: many(articleMedications),
  references: many(medicationReferences),
  purchaseLinks: many(productPurchaseLinks),
  reviewedBy: one(pharmacistProfiles, {
    fields: [medications.reviewedBy],
    references: [pharmacistProfiles.id],
  }),
}));

export const medicationReferencesRelations = relations(
  medicationReferences,
  ({ one }) => ({
    medication: one(medications, {
      fields: [medicationReferences.medicationId],
      references: [medications.id],
    }),
  })
);

export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  author: one(pharmacistProfiles, {
    fields: [articles.authorId],
    references: [pharmacistProfiles.id],
  }),
  articleMedications: many(articleMedications),
}));

export const articleMedicationsRelations = relations(
  articleMedications,
  ({ one }) => ({
    article: one(articles, {
      fields: [articleMedications.articleId],
      references: [articles.id],
    }),
    medication: one(medications, {
      fields: [articleMedications.medicationId],
      references: [medications.id],
    }),
  })
);

export const productLookupsRelations = relations(
  productLookups,
  ({ one, many }) => ({
    matchedMedication: one(medications, {
      fields: [productLookups.matchedMedicationId],
      references: [medications.id],
    }),
    reviewRequests: many(lookupReviewRequests),
  })
);

export const lookupReviewRequestsRelations = relations(
  lookupReviewRequests,
  ({ one }) => ({
    productLookup: one(productLookups, {
      fields: [lookupReviewRequests.productLookupId],
      references: [productLookups.id],
    }),
    assignedTo: one(pharmacistProfiles, {
      fields: [lookupReviewRequests.assignedTo],
      references: [pharmacistProfiles.id],
    }),
  })
);

export const trendTopicsRelations = relations(
  trendTopics,
  ({ one }) => ({
    analysis: one(trendAnalyses, {
      fields: [trendTopics.id],
      references: [trendAnalyses.trendTopicId],
    }),
    reviewedBy: one(pharmacistProfiles, {
      fields: [trendTopics.reviewedBy],
      references: [pharmacistProfiles.id],
    }),
  })
);

export const trendAnalysesRelations = relations(
  trendAnalyses,
  ({ one }) => ({
    topic: one(trendTopics, {
      fields: [trendAnalyses.trendTopicId],
      references: [trendTopics.id],
    }),
  })
);

// ============================================================
// Retailers + Purchase Links + Click Tracking (migration 006)
// ============================================================

export const retailers = pgTable("retailers", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  websiteUrl: text("website_url").notNull(),
  logoUrl: text("logo_url"),
  country: text().notNull().default("US"),
  isActive: boolean("is_active").notNull().default(true),
  affiliateNetwork: text("affiliate_network"),
  affiliateBaseUrl: text("affiliate_base_url"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  cookieDays: integer("cookie_days"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productPurchaseLinks = pgTable(
  "product_purchase_links",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    medicationId: bigint("medication_id", { mode: "number" })
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    retailerId: bigint("retailer_id", { mode: "number" })
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    url: text().notNull(),
    affiliateUrl: text("affiliate_url"),
    price: numeric({ precision: 10, scale: 2 }),
    priceCurrency: text("price_currency").default("USD"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    lastPriceCheck: timestamp("last_price_check", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_product_purchase_links_med").on(table.medicationId),
    uniqueIndex("product_purchase_links_unique").on(
      table.medicationId,
      table.retailerId
    ),
  ]
);

export const purchaseClickEvents = pgTable(
  "purchase_click_events",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    linkId: bigint("link_id", { mode: "number" })
      .notNull()
      .references(() => productPurchaseLinks.id, { onDelete: "cascade" }),
    medicationId: bigint("medication_id", { mode: "number" }).notNull(),
    retailerId: bigint("retailer_id", { mode: "number" }).notNull(),
    referrerType: text("referrer_type").notNull(),
    referrerId: bigint("referrer_id", { mode: "number" }),
    sessionId: text("session_id"),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_click_events_link").on(table.linkId, table.clickedAt),
    index("idx_click_events_med").on(table.medicationId, table.clickedAt),
  ]
);

// Relations for new tables
export const retailersRelations = relations(retailers, ({ many }) => ({
  purchaseLinks: many(productPurchaseLinks),
}));

export const productPurchaseLinksRelations = relations(
  productPurchaseLinks,
  ({ one }) => ({
    medication: one(medications, {
      fields: [productPurchaseLinks.medicationId],
      references: [medications.id],
    }),
    retailer: one(retailers, {
      fields: [productPurchaseLinks.retailerId],
      references: [retailers.id],
    }),
  })
);

// ─── Expert Picks ──────────────────────────────────────────────────
export const expertPicks = pgTable("expert_picks", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  slug: text().unique().notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  youtubeId: text("youtube_id").notNull(),
  title: text().notNull(),
  expertName: text("expert_name").notNull(),
  expertCredential: text("expert_credential"),
  thumbnailUrl: text("thumbnail_url"),
  duration: text(),
  category: text().notNull().default("health"),

  transcript: text(),
  cleanTranscript: text("clean_transcript"),
  summary: text(),
  keyTakeaways: jsonb("key_takeaways").$type<string[]>(),
  properNotes: jsonb("proper_notes").$type<
    { heading: string; bullets: string[] }[]
  >(),
  analysisSections: jsonb("analysis_sections").$type<
    { title: string; content: string }[]
  >(),
  mentionedProducts: jsonb("mentioned_products").$type<
    { name: string; slug?: string; reason: string }[]
  >(),

  status: text().notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Page Views (Analytics) ───────────────────────────────────────
export const pageViews = pgTable(
  "page_views",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id"),
    path: text().notNull(),
    referrer: text(),
    userAgent: text("user_agent"),
    ip: text(),
    country: text(),
    region: text(),
    city: text(),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_page_views_created").on(table.createdAt),
    index("idx_page_views_path").on(table.path, table.createdAt),
    index("idx_page_views_country").on(table.country, table.createdAt),
    index("idx_page_views_visitor").on(table.visitorId, table.createdAt),
  ]
);
