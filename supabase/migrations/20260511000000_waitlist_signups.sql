-- Run in Supabase SQL Editor (or via supabase db push) before going live.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tier text,
  source text not null default 'waitlist',
  created_at timestamptz not null default now(),
  constraint waitlist_signups_tier_check check (
    tier is null or tier in ('free', 'founding')
  ),
  constraint waitlist_signups_source_check check (
    source in ('waitlist', 'identity_gate')
  )
);

create unique index if not exists waitlist_signups_email_lower
  on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

-- No public policies: only the service role (Vercel API route) inserts/reads.

comment on table public.waitlist_signups is 'Owlpo landing waitlist and demo gate emails; accessed via Vercel API using service role.';
