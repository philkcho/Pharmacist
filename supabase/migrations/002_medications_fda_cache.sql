-- Add FDA cache fields to medications
alter table public.medications
  add column if not exists fda_spl_id text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists source text not null default 'manual';

-- Helpful indexes for FDA lookup + staleness checks
create index if not exists idx_medications_fda_spl_id
  on public.medications(fda_spl_id);

create index if not exists idx_medications_last_synced_at
  on public.medications(last_synced_at);

create index if not exists idx_medications_name_lower
  on public.medications((lower(name)));

create index if not exists idx_medications_generic_name_lower
  on public.medications((lower(generic_name)));
