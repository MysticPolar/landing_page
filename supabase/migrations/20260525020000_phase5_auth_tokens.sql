-- Phase 5 — single-use tokens for email verification + password reset.
--
-- Stored as SHA-256 hashes; raw tokens are emailed exactly once and never
-- persisted. Tokens are bound to a user_id and a purpose; the API checks
-- both before consuming.

create table if not exists public.auth_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  purpose       text not null check (purpose in ('email_verify','password_reset')),
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists auth_tokens_user_purpose_idx
  on public.auth_tokens (user_id, purpose, expires_at);

alter table public.auth_tokens enable row level security;

comment on table public.auth_tokens is
  'Single-use tokens for email_verify and password_reset. token_hash stores SHA-256; raw token is only ever in transit.';

-- Extend cleanup helper to remove expired tokens.
create or replace function public.cleanup_expired()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sessions
   where expires_at < now() - interval '7 days';
  delete from public.rate_limit_buckets
   where window_start < now() - interval '24 hours';
  delete from public.login_attempts
   where attempted_at < now() - interval '30 days';
  delete from public.auth_tokens
   where expires_at < now() - interval '7 days';
end;
$$;
