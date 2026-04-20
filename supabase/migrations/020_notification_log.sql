-- ============================================================
-- Migration 020: notification_log — outbound email/push tracking
-- ============================================================
-- Audit log for every notification sent to a user. Tracks
-- delivery, opens, clicks, and errors so we can:
--   1. Avoid spamming (don't re-send the same digest)
--   2. Debug delivery failures (Resend bounces)
--   3. Measure open/click rates per template
--   4. Honor opt-out (respect email_opt_in/push_opt_in)
-- ============================================================

-- 1. Enums
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum (
      'email',
      'push',
      'sms'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type public.notification_status as enum (
      'queued',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'bounced',
      'failed',
      'unsubscribed'
    );
  end if;
end
$$;


-- 2. notification_log table
-- ------------------------------------------------------------
create table if not exists public.notification_log (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete set null,
  email           text,                                  -- captured even if user_id null

  channel         public.notification_channel not null,
  template        text not null,                         -- 'consult-received', 'consult-ready', 'weekly-digest', ...
  subject         text,
  payload_jsonb   jsonb,                                 -- template variables + metadata

  -- Provider linkage (Resend message id, etc.)
  provider        text,                                  -- 'resend', 'web_push', ...
  provider_id     text,                                  -- e.g. resend message id

  -- Reference back to triggering object
  consult_id      uuid references public.consults(id) on delete set null,

  status          public.notification_status not null default 'queued',
  status_at       timestamptz not null default now(),
  error_message   text,

  -- Engagement tracking
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,

  created_at      timestamptz not null default now()
);

create index if not exists idx_notification_log_user_created
  on public.notification_log(user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_notification_log_template_status
  on public.notification_log(template, status, created_at desc);

create index if not exists idx_notification_log_provider_id
  on public.notification_log(provider, provider_id)
  where provider_id is not null;

create index if not exists idx_notification_log_consult
  on public.notification_log(consult_id)
  where consult_id is not null;


-- 3. RLS — owner read, pharmacist read all (for ops/debug)
-- ------------------------------------------------------------
alter table public.notification_log enable row level security;

create policy "Users read own notifications"
  on public.notification_log for select
  to authenticated
  using (user_id = auth.uid() or public.is_pharmacist());


comment on table public.notification_log is
  'Audit log for all outbound notifications (email/push/sms). Used to prevent duplicate sends, debug delivery, measure engagement, and honor opt-outs. Insert/update is service-role only — clients never write directly.';
