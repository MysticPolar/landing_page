-- Invitation codes for private access / referrals (optional on signup).

create table if not exists public.invitation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  max_uses int,
  uses_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint invitation_codes_uses_ok check (
    max_uses is null or uses_count <= max_uses
  )
);

create unique index if not exists invitation_codes_code_upper
  on public.invitation_codes (upper(trim(code)));

alter table public.invitation_codes enable row level security;

alter table public.waitlist_signups
  add column if not exists invite_code text;

comment on table public.invitation_codes is 'Private invitation strings; validate via Vercel API; manage via SQL or /api/invite-generate.';
