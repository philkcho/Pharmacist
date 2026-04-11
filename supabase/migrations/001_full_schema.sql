-- ============================================================
-- Pharmacist Website - Full Database Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Extensions and Enums
-- ============================================================
create extension if not exists "moddatetime" schema extensions;

create type public.article_status as enum ('draft', 'in_review', 'published', 'archived');
create type public.app_role as enum ('pharmacist', 'user');

-- 2. Categories (hierarchical)
-- ============================================================
create table public.categories (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  parent_id   bigint references public.categories(id) on delete set null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_categories_parent on public.categories(parent_id);

create trigger handle_categories_updated_at
  before update on public.categories
  for each row execute procedure moddatetime(updated_at);

-- 3. Pharmacist Profiles
-- ============================================================
create table public.pharmacist_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null,
  slug            text not null unique,
  title           text,
  bio             text,
  avatar_url      text,
  license_number  text,
  license_state   text,
  specializations text[],
  website_url     text,
  social_links    jsonb default '{}',
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_pharmacist_slug on public.pharmacist_profiles(slug);

create trigger handle_pharmacist_updated_at
  before update on public.pharmacist_profiles
  for each row execute procedure moddatetime(updated_at);

-- 4. Medications
-- ============================================================
create table public.medications (
  id                  bigint generated always as identity primary key,
  name                text not null,
  slug                text not null unique,
  generic_name        text,
  brand_names         text[],
  description         text,
  active_ingredients  jsonb default '[]',
  dosage_forms        text[],
  warnings            text,
  side_effects        text,
  category_id         bigint references public.categories(id) on delete set null,
  image_url           text,
  is_otc              boolean not null default true,
  purchase_links      jsonb default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_medications_slug on public.medications(slug);
create index idx_medications_category on public.medications(category_id);

create trigger handle_medications_updated_at
  before update on public.medications
  for each row execute procedure moddatetime(updated_at);

-- 5. Articles
-- ============================================================
create table public.articles (
  id              bigint generated always as identity primary key,
  title           text not null,
  slug            text not null unique,
  excerpt         text,
  content         text not null default '',
  status          public.article_status not null default 'draft',
  category_id     bigint references public.categories(id) on delete set null,
  author_id       uuid not null references public.pharmacist_profiles(id) on delete restrict,
  featured_image  text,
  seo_title       text,
  seo_description text,
  seo_keywords    text[],
  canonical_url   text,
  published_at    timestamptz,
  reviewed_at     timestamptz,
  reviewed_by     uuid references public.pharmacist_profiles(id),
  is_ai_drafted   boolean not null default false,
  ai_model        text,
  reading_time_minutes int,
  view_count      bigint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_articles_slug on public.articles(slug);
create index idx_articles_status on public.articles(status);
create index idx_articles_author on public.articles(author_id);
create index idx_articles_category on public.articles(category_id);
create index idx_articles_published on public.articles(published_at desc) where status = 'published';

create trigger handle_articles_updated_at
  before update on public.articles
  for each row execute procedure moddatetime(updated_at);

-- Auto-set published_at when status changes to published
create or replace function public.enforce_article_publish_date()
returns trigger as $$
begin
  if NEW.status = 'published' and NEW.published_at is null then
    NEW.published_at = now();
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger set_published_at
  before insert or update on public.articles
  for each row execute function public.enforce_article_publish_date();

-- 6. Article-Medication Junction
-- ============================================================
create table public.article_medications (
  article_id    bigint not null references public.articles(id) on delete cascade,
  medication_id bigint not null references public.medications(id) on delete cascade,
  sort_order    int not null default 0,
  is_recommended boolean not null default true,
  recommendation_note text,
  primary key (article_id, medication_id)
);

create index idx_article_medications_med on public.article_medications(medication_id);

-- 7. User Roles
-- ============================================================
create table public.user_roles (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      public.app_role not null,
  unique (user_id, role)
);

-- 8. Helper function
-- ============================================================
create or replace function public.is_pharmacist()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'pharmacist'
  );
$$;

-- 9. Enable RLS
-- ============================================================
alter table public.categories enable row level security;
alter table public.pharmacist_profiles enable row level security;
alter table public.medications enable row level security;
alter table public.articles enable row level security;
alter table public.article_medications enable row level security;
alter table public.user_roles enable row level security;

-- 10. RLS Policies
-- ============================================================

-- Categories: public read, pharmacist write
create policy "Categories are publicly readable"
  on public.categories for select to anon, authenticated using (true);

create policy "Pharmacists can manage categories"
  on public.categories for all to authenticated
  using (public.is_pharmacist()) with check (public.is_pharmacist());

-- Pharmacist Profiles: public read, owner write
create policy "Pharmacist profiles are publicly readable"
  on public.pharmacist_profiles for select to anon, authenticated using (true);

create policy "Pharmacists can update own profile"
  on public.pharmacist_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Pharmacists can insert own profile"
  on public.pharmacist_profiles for insert to authenticated
  with check (auth.uid() = id and public.is_pharmacist());

-- Medications: public read, pharmacist write
create policy "Medications are publicly readable"
  on public.medications for select to anon, authenticated using (true);

create policy "Pharmacists can manage medications"
  on public.medications for all to authenticated
  using (public.is_pharmacist()) with check (public.is_pharmacist());

-- Articles: published public read, pharmacist CRUD
create policy "Published articles are publicly readable"
  on public.articles for select to anon using (status = 'published');

create policy "Authenticated users see published or own articles"
  on public.articles for select to authenticated
  using (status = 'published' or (public.is_pharmacist() and auth.uid() = author_id));

create policy "Pharmacists can create articles"
  on public.articles for insert to authenticated
  with check (public.is_pharmacist() and auth.uid() = author_id);

create policy "Pharmacists can update own articles"
  on public.articles for update to authenticated
  using (public.is_pharmacist() and auth.uid() = author_id)
  with check (public.is_pharmacist() and auth.uid() = author_id);

create policy "Pharmacists can delete own unpublished articles"
  on public.articles for delete to authenticated
  using (public.is_pharmacist() and auth.uid() = author_id and status in ('draft', 'in_review'));

-- Article-Medications: public read, pharmacist write
create policy "Article-medication links are publicly readable"
  on public.article_medications for select to anon, authenticated using (true);

create policy "Pharmacists can manage article-medication links"
  on public.article_medications for all to authenticated
  using (public.is_pharmacist()) with check (public.is_pharmacist());

-- User roles: only service role can manage (no public access)
create policy "Users can read own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

-- 11. Storage Buckets
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-images',
  'public-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
);

create policy "Public images are readable by everyone"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-images');

create policy "Pharmacists can upload public images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-images' and public.is_pharmacist());

create policy "Pharmacists can delete own public images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-images' and public.is_pharmacist());

-- 12. Seed Categories
-- ============================================================
insert into public.categories (name, slug, description, sort_order) values
  ('Pain Relief', 'pain-relief', 'OTC pain relievers and anti-inflammatory medications', 1),
  ('Cold & Flu', 'cold-flu', 'Cold medicine, decongestants, and flu remedies', 2),
  ('Digestive Health', 'digestive-health', 'Antacids, probiotics, and digestive aids', 3),
  ('Allergy', 'allergy', 'Antihistamines and allergy relief medications', 4),
  ('Vitamins & Supplements', 'vitamins-supplements', 'Daily vitamins, minerals, and dietary supplements', 5),
  ('Skin Care', 'skin-care', 'Topical treatments, moisturizers, and skin health', 6),
  ('Sleep & Relaxation', 'sleep-relaxation', 'Sleep aids and calming supplements', 7),
  ('First Aid', 'first-aid', 'Wound care, antiseptics, and first aid supplies', 8);
