CREATE TYPE "public"."app_role" AS ENUM('pharmacist', 'user');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'in_review', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "article_medications" (
	"article_id" bigint NOT NULL,
	"medication_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_recommended" boolean DEFAULT true NOT NULL,
	"recommendation_note" text,
	CONSTRAINT "article_medications_article_id_medication_id_pk" PRIMARY KEY("article_id","medication_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"category_id" bigint,
	"author_id" uuid NOT NULL,
	"featured_image" text,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text[],
	"canonical_url" text,
	"published_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"is_ai_drafted" boolean DEFAULT false NOT NULL,
	"ai_model" text,
	"reading_time_minutes" integer,
	"view_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "medications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"generic_name" text,
	"brand_names" text[],
	"description" text,
	"active_ingredients" jsonb DEFAULT '[]'::jsonb,
	"dosage_forms" text[],
	"warnings" text,
	"side_effects" text,
	"category_id" bigint,
	"image_url" text,
	"is_otc" boolean DEFAULT true NOT NULL,
	"purchase_links" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pharmacist_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"bio" text,
	"avatar_url" text,
	"license_number" text,
	"license_state" text,
	"specializations" text[],
	"website_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pharmacist_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_medications" ADD CONSTRAINT "article_medications_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_medications" ADD CONSTRAINT "article_medications_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_pharmacist_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."pharmacist_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_reviewed_by_pharmacist_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."pharmacist_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_article_medications_med" ON "article_medications" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "idx_articles_status" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_articles_author" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_articles_category" ON "articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_articles_published" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_medications_category" ON "medications" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_pharmacist_slug" ON "pharmacist_profiles" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_roles_unique" ON "user_roles" USING btree ("user_id","role");