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
