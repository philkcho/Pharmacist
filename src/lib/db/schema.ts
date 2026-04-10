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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "in_review",
  "published",
  "archived",
]);

export const appRoleEnum = pgEnum("app_role", ["pharmacist", "user"]);

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_medications_category").on(table.categoryId)]
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
}));

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
