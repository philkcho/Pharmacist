-- ============================================================
-- Migration 019: consult_followups — same-thread follow-up Q&A
-- ============================================================
-- Allows the user to ask additional questions about an existing
-- consult, and the pharmacist (or AI) to respond — without
-- creating a new top-level consult. Keeps the conversation
-- threaded so context is preserved.
--
-- Used for "Request more info" pharmacist action and "Ask a
-- follow-up" button on the user's /consult/[id] page.
-- ============================================================

-- 1. Enum for message role
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'consult_message_role') then
    create type public.consult_message_role as enum (
      'user',
      'pharmacist',
      'ai',
      'system'
    );
  end if;
end
$$;


-- 2. consult_followups table
-- ------------------------------------------------------------
create table if not exists public.consult_followups (
  id          bigint generated always as identity primary key,
  consult_id  uuid not null references public.consults(id) on delete cascade,

  role        public.consult_message_role not null,
  author_id   uuid references auth.users(id) on delete set null,

  message     text not null,
  attachments jsonb,                          -- [{type, url, ...}] photos/files in follow-up

  -- Email send tracking (when pharmacist sends a follow-up to the user)
  sent_email  boolean not null default false,
  sent_email_at timestamptz,

  created_at  timestamptz not null default now()
);

create index if not exists idx_consult_followups_consult_created
  on public.consult_followups(consult_id, created_at);


-- 3. RLS — owner of consult + pharmacists
-- ------------------------------------------------------------
alter table public.consult_followups enable row level security;

create policy "Users read followups on own consult"
  on public.consult_followups for select
  to authenticated
  using (
    exists (
      select 1 from public.consults c
      where c.id = consult_followups.consult_id
        and (c.user_id = auth.uid() or public.is_pharmacist())
    )
  );

create policy "Users insert followups on own consult"
  on public.consult_followups for insert
  to authenticated
  with check (
    role = 'user'
    and author_id = auth.uid()
    and exists (
      select 1 from public.consults c
      where c.id = consult_followups.consult_id
        and c.user_id = auth.uid()
    )
  );

create policy "Pharmacists insert any followup"
  on public.consult_followups for insert
  to authenticated
  with check (public.is_pharmacist());


comment on table public.consult_followups is
  'Threaded follow-up messages on a consult. Used for "Request more info" from pharmacist and "Ask a follow-up" from user. Preserves conversation context within a single consult thread.';
