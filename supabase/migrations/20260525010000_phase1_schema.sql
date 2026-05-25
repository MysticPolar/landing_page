-- ============================================================================
-- Phase 1 — full backend schema for Owlpo landing.
--
-- Drops the pre-launch app_users table (no production data yet) and replaces
-- it with the long-term shape:
--
--   users                  one row per account, holds seat + tier + auth state
--   sessions               server-side session storage, cookie carries the token
--   invitation_codes       extended: code_type, owner_user_id, used_by_user_id
--   seat_boosts            audit log of every effective_seat_number change
--   email_log              every transactional email send + delivery state
--   login_attempts         security forensics for auth-login
--   rate_limit_buckets     Postgres-backed throttling
--   founding_code_batches  tracks 10-at-a-time founding-code mints (100 cap)
--
-- Plus two sequences (free_seat_seq, founding_seat_seq) and two helper
-- functions (apply_seat_boost, claim_personal_code).
--
-- All tables enable RLS with no public policies — only the service role
-- (Vercel API routes) can read or write. Anon/authenticated keys see nothing.
--
-- The migration is idempotent: re-running is safe.
-- ============================================================================

----------------------------------------------------------------------
-- 0. Tear down the bootstrap app_users table.
--    Safe in pre-launch; this also removes the FK from Phase 0.
----------------------------------------------------------------------
drop table if exists public.app_users cascade;


----------------------------------------------------------------------
-- 1. Sequences. Free + founding have independent numbering.
----------------------------------------------------------------------
create sequence if not exists public.free_seat_seq     start 1 increment 1;
create sequence if not exists public.founding_seat_seq start 1 increment 1;


----------------------------------------------------------------------
-- 2. users — the single source of truth for accounts.
----------------------------------------------------------------------
create table if not exists public.users (
  id                      uuid primary key default gen_random_uuid(),
  email                   text not null,
  email_canonical         text generated always as (lower(trim(email))) stored,
  password_hash           text not null,
  display_name            text,
  tier                    text not null default 'free'
    check (tier in ('free','founding')),
  free_seat_number        bigint,   -- NULL once a free user upgrades to founding
  founding_seat_number    bigint unique,
  effective_seat_number   bigint not null,  -- displayed seat; boost-mutated
  preferred_language      text not null default 'en'
    check (preferred_language in ('en','zh')),
  email_verified_at       timestamptz,
  stripe_customer_id      text unique,
  enrolled_at             timestamptz not null default now(),
  last_login_at           timestamptz,

  -- Per-tier seat invariants:
  --   free users must have a free seat and no founding seat.
  --   founding users must have a founding seat.
  --   Free-then-upgraded users have founding_seat_number set and
  --   free_seat_number = NULL (per business rule).
  constraint users_seat_invariant check (
    (tier = 'free'
       and free_seat_number is not null
       and founding_seat_number is null)
    or
    (tier = 'founding'
       and founding_seat_number is not null)
  ),
  constraint users_effective_seat_positive check (effective_seat_number >= 1)
);

create unique index if not exists users_email_canonical_unique
  on public.users (email_canonical);
create index if not exists users_tier_idx
  on public.users (tier);
create index if not exists users_effective_seat_idx
  on public.users (tier, effective_seat_number, enrolled_at);
create index if not exists users_founding_seat_idx
  on public.users (founding_seat_number)
  where founding_seat_number is not null;
create index if not exists users_free_seat_idx
  on public.users (free_seat_number)
  where free_seat_number is not null;

alter table public.users enable row level security;

comment on table public.users is
  'Account records. Free seat # and founding seat # use independent sequences. effective_seat_number is the displayed value and is mutated by seat_boosts.';


----------------------------------------------------------------------
-- 3. sessions — server-side session storage.
--    Cookie carries the raw token; we store SHA-256(token).
----------------------------------------------------------------------
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  token_hash   text not null unique,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);

create index if not exists sessions_user_id_idx    on public.sessions (user_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at)
  where revoked_at is null;

alter table public.sessions enable row level security;

comment on table public.sessions is
  'Active login sessions. token_hash is SHA-256 of the raw cookie token; raw token is never stored.';


----------------------------------------------------------------------
-- 4. invitation_codes — extend with type + ownership + usage tracking.
----------------------------------------------------------------------
alter table public.invitation_codes
  add column if not exists code_type text not null default 'system'
    check (code_type in ('system','personal_free','personal_founding'));

alter table public.invitation_codes
  add column if not exists owner_user_id uuid
    references public.users(id) on delete cascade;

alter table public.invitation_codes
  add column if not exists used_by_user_id uuid
    references public.users(id) on delete set null;

alter table public.invitation_codes
  add column if not exists used_at timestamptz;

create index if not exists invitation_codes_owner_idx
  on public.invitation_codes (owner_user_id)
  where owner_user_id is not null;
create index if not exists invitation_codes_type_idx
  on public.invitation_codes (code_type);
create index if not exists invitation_codes_unused_personal_idx
  on public.invitation_codes (owner_user_id, code_type)
  where used_at is null
    and code_type in ('personal_free','personal_founding');

-- Personal codes are single-use by construction.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.invitation_codes'::regclass
       and conname  = 'invitation_codes_personal_single_use_chk'
  ) then
    alter table public.invitation_codes
      add constraint invitation_codes_personal_single_use_chk
      check (
        code_type = 'system'
        or max_uses = 1
      );
  end if;
end $$;

comment on column public.invitation_codes.code_type is
  '''system'' = admin/bootstrap codes (multi-use allowed). ''personal_free'' = 3 codes minted to each free user. ''personal_founding'' = 10 codes minted to each founding member.';


----------------------------------------------------------------------
-- 5. seat_boosts — audit log of every effective_seat_number change.
----------------------------------------------------------------------
create table if not exists public.seat_boosts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  delta          int  not null,   -- negative = moved forward in the queue
  reason         text not null,
  source_code_id uuid references public.invitation_codes(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists seat_boosts_user_id_idx
  on public.seat_boosts (user_id, created_at desc);

alter table public.seat_boosts enable row level security;

comment on table public.seat_boosts is
  'Audit log of every seat boost. delta is negative when the user moved forward in the queue. Sum of deltas for a user = effective_seat_number - original_seat_number (modulo clamp at 1).';


----------------------------------------------------------------------
-- 6. email_log — every transactional email send + delivery result.
----------------------------------------------------------------------
create table if not exists public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  to_email            text not null,
  user_id             uuid references public.users(id) on delete set null,
  kind                text not null,
    -- 'signup_free' | 'signup_founding' | 'code_used' | 'email_verify'
    -- | 'password_reset' | 'codes_minted' | 'admin_resend'
  language            text not null default 'en'
    check (language in ('en','zh')),
  subject             text,
  provider_message_id text,
  status              text not null default 'pending'
    check (status in ('pending','sent','failed','bounced')),
  error               text,
  attempt_count       int  not null default 0,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists email_log_status_pending_idx
  on public.email_log (created_at)
  where status = 'pending';
create index if not exists email_log_to_idx
  on public.email_log (to_email, created_at desc);
create index if not exists email_log_user_idx
  on public.email_log (user_id, created_at desc)
  where user_id is not null;

alter table public.email_log enable row level security;


----------------------------------------------------------------------
-- 7. login_attempts — forensics + rate-limiting basis for auth-login.
----------------------------------------------------------------------
create table if not exists public.login_attempts (
  id             uuid primary key default gen_random_uuid(),
  email          text,
  ip             inet,
  succeeded      boolean not null,
  failure_reason text,
  attempted_at   timestamptz not null default now()
);

create index if not exists login_attempts_email_recent_idx
  on public.login_attempts (email, attempted_at desc);
create index if not exists login_attempts_ip_recent_idx
  on public.login_attempts (ip, attempted_at desc);

alter table public.login_attempts enable row level security;


----------------------------------------------------------------------
-- 8. rate_limit_buckets — per-IP/per-email throttling counters.
----------------------------------------------------------------------
create table if not exists public.rate_limit_buckets (
  bucket_key   text not null,            -- 'ip:1.2.3.4:auth-login'
  window_start timestamptz not null,     -- truncated to the window size
  count        int not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;

comment on table public.rate_limit_buckets is
  'Sliding-window rate limit counters. Old rows can be safely deleted with a periodic cleanup.';


----------------------------------------------------------------------
-- 9. founding_code_batches — tracks the 10-at-a-time founding-code mints.
----------------------------------------------------------------------
create table if not exists public.founding_code_batches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  batch_size int  not null default 10 check (batch_size > 0),
  created_at timestamptz not null default now()
);

create index if not exists founding_code_batches_user_idx
  on public.founding_code_batches (user_id, created_at);

alter table public.founding_code_batches enable row level security;

comment on table public.founding_code_batches is
  'One row per mint event of founding personal codes. Initial signup mint = batch 1 (10 codes). Each ''request more'' = a new batch. SUM(batch_size) is capped at 100 per user.';


----------------------------------------------------------------------
-- 10. Helper functions.
----------------------------------------------------------------------

-- Apply a seat boost. Negative delta = move forward in queue.
-- Clamps effective_seat_number to >= 1 and writes a seat_boosts row.
create or replace function public.apply_seat_boost(
  p_user_id        uuid,
  p_delta          int,
  p_reason         text,
  p_source_code_id uuid default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_seat bigint;
begin
  update public.users
     set effective_seat_number = greatest(1, effective_seat_number + p_delta)
   where id = p_user_id
   returning effective_seat_number into v_new_seat;

  if v_new_seat is null then
    raise exception 'apply_seat_boost: user % not found', p_user_id
      using errcode = 'P0002';
  end if;

  insert into public.seat_boosts (user_id, delta, reason, source_code_id)
  values (p_user_id, p_delta, p_reason, p_source_code_id);

  return v_new_seat;
end;
$$;

-- Atomically claim an invitation code. Row-locks the code, validates type
-- and usage state, marks it used (for personal codes) or bumps uses_count
-- (for system codes). Raises an exception with a known errcode on any
-- failure so the calling code can map to a clean error message.
--
-- Returns the code row as it was BEFORE the update (so the caller can read
-- the owner_user_id, code_type, etc.).
create or replace function public.claim_invitation_code(
  p_code         text,
  p_activator_id uuid
) returns public.invitation_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invitation_codes;
begin
  select * into v_row
    from public.invitation_codes
   where code = upper(trim(p_code))
   for update;

  if not found then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  if not v_row.active then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    raise exception 'expired_code' using errcode = '22023';
  end if;

  if v_row.code_type in ('personal_free','personal_founding') then
    if v_row.used_at is not null then
      raise exception 'used_code' using errcode = '22023';
    end if;
    if v_row.owner_user_id is not null
       and v_row.owner_user_id = p_activator_id then
      raise exception 'self_code' using errcode = '22023';
    end if;
    update public.invitation_codes
       set used_by_user_id = p_activator_id,
           used_at         = now(),
           uses_count      = uses_count + 1
     where id = v_row.id;
  else
    -- system code: respect max_uses if set
    if v_row.max_uses is not null and v_row.uses_count >= v_row.max_uses then
      raise exception 'used_code' using errcode = '22023';
    end if;
    update public.invitation_codes
       set uses_count = uses_count + 1
     where id = v_row.id;
  end if;

  return v_row;
end;
$$;

----------------------------------------------------------------------
-- 11. Personal-code minting helpers.
----------------------------------------------------------------------

-- Mint N personal codes for a user. Generates random codes; retries on
-- collision. Returns the generated code strings as a text[].
--
-- Random codes use the alphabet 23456789ABCDEFGHJKLMNPQRSTUVWXYZ (32 chars,
-- no easily-confused symbols), 8 chars after the OWL- prefix → 32^8 ≈ 1e12.
create or replace function public.mint_personal_codes(
  p_owner_user_id uuid,
  p_count         int,
  p_code_type     text   -- 'personal_free' or 'personal_founding'
) returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet   constant text   := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_codes      text[]          := array[]::text[];
  v_candidate  text;
  v_i          int;
  v_j          int;
  v_attempt    int;
begin
  if p_code_type not in ('personal_free','personal_founding') then
    raise exception 'mint_personal_codes: invalid code_type %', p_code_type
      using errcode = '22023';
  end if;

  for v_i in 1..p_count loop
    v_attempt := 0;
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 20 then
        raise exception 'mint_personal_codes: could not find unique code after 20 attempts'
          using errcode = 'P0001';
      end if;

      v_candidate := 'OWL-';
      for v_j in 1..8 loop
        v_candidate := v_candidate
          || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
      end loop;

      begin
        insert into public.invitation_codes
              (code, code_type, owner_user_id, max_uses, uses_count, active)
        values (v_candidate, p_code_type, p_owner_user_id, 1, 0, true);
        v_codes := array_append(v_codes, v_candidate);
        exit;
      exception when unique_violation then
        -- collision, retry with a new candidate
        null;
      end;
    end loop;
  end loop;

  return v_codes;
end;
$$;


----------------------------------------------------------------------
-- 12. Signup orchestration — one RPC call = one transaction.
--
-- The Node API hashes the password and calls this with:
--   p_email, p_password_hash, p_display_name, p_language, p_invite_code (nullable)
--
-- Returns a single-row jsonb document with everything the frontend needs.
-- Raises an exception with a known errcode on any validation failure.
----------------------------------------------------------------------
create or replace function public.signup_user(
  p_email         text,
  p_password_hash text,
  p_display_name  text,
  p_language      text,
  p_invite_code   text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid;
  v_email_canon   text;
  v_tier          text := 'free';
  v_free_seat     bigint;
  v_founding_seat bigint;
  v_effective     bigint;
  v_code_row      public.invitation_codes;
  v_owner_id      uuid;
  v_owner_tier    text;
  v_codes_minted  text[];
begin
  v_email_canon := lower(trim(p_email));

  if v_email_canon is null or v_email_canon = '' or v_email_canon !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if exists (select 1 from public.users where email_canonical = v_email_canon) then
    raise exception 'email_taken' using errcode = '23505';
  end if;

  if p_language not in ('en','zh') then
    p_language := 'en';
  end if;

  ----------------------------------------------------------------
  -- If an invite code is provided, claim it. This row-locks the code
  -- so concurrent claims fail predictably.
  ----------------------------------------------------------------
  if p_invite_code is not null and trim(p_invite_code) <> '' then
    -- Pass NULL as activator_id since we haven't created the user yet;
    -- self-code check is impossible for first-time signup.
    v_code_row := public.claim_invitation_code(p_invite_code, null);

    -- Determine the tier for the new account based on the code type.
    if v_code_row.code_type = 'personal_founding' then
      v_tier := 'founding';
    else
      v_tier := 'free';
    end if;
  end if;

  ----------------------------------------------------------------
  -- Allocate seat numbers + create the user.
  ----------------------------------------------------------------
  if v_tier = 'free' then
    v_free_seat := nextval('public.free_seat_seq');
    v_effective := v_free_seat;
    insert into public.users
          (email, password_hash, display_name, tier,
           free_seat_number, effective_seat_number, preferred_language)
    values (p_email, p_password_hash, p_display_name, 'free',
           v_free_seat, v_effective, p_language)
    returning id into v_user_id;
  else
    v_founding_seat := nextval('public.founding_seat_seq');
    v_effective := v_founding_seat;
    insert into public.users
          (email, password_hash, display_name, tier,
           founding_seat_number, effective_seat_number, preferred_language)
    values (p_email, p_password_hash, p_display_name, 'founding',
           v_founding_seat, v_effective, p_language)
    returning id into v_user_id;
  end if;

  ----------------------------------------------------------------
  -- If we claimed a personal code, retroactively set used_by_user_id
  -- and apply boosts per the business rules.
  ----------------------------------------------------------------
  if v_code_row.id is not null then
    update public.invitation_codes
       set used_by_user_id = v_user_id
     where id = v_code_row.id;

    if v_code_row.code_type = 'personal_free' then
      -- Activator (the new user, free tier): -5 boost
      v_effective := public.apply_seat_boost(
        v_user_id, -5, 'code_activator:personal_free', v_code_row.id);

      -- Owner: -5 boost, but only if they still have a free seat
      if v_code_row.owner_user_id is not null then
        select tier into v_owner_tier
          from public.users
         where id = v_code_row.owner_user_id;
        if v_owner_tier = 'free' then
          perform public.apply_seat_boost(
            v_code_row.owner_user_id, -5,
            'code_owner:personal_free', v_code_row.id);
        end if;
      end if;

    elsif v_code_row.code_type = 'personal_founding' then
      -- Activator is brand-new founding member; their seat is already
      -- the next founding number. No additional activator boost.
      -- Owner: -1 boost (founding members boost each other less, by design).
      if v_code_row.owner_user_id is not null then
        perform public.apply_seat_boost(
          v_code_row.owner_user_id, -1,
          'code_owner:personal_founding', v_code_row.id);
      end if;
    end if;
  end if;

  ----------------------------------------------------------------
  -- Mint this user's personal codes (3 for free, 10 for founding).
  ----------------------------------------------------------------
  if v_tier = 'free' then
    v_codes_minted := public.mint_personal_codes(v_user_id, 3, 'personal_free');
  else
    v_codes_minted := public.mint_personal_codes(v_user_id, 10, 'personal_founding');
    insert into public.founding_code_batches (user_id, batch_size)
    values (v_user_id, 10);
  end if;

  ----------------------------------------------------------------
  -- Return everything the API needs.
  ----------------------------------------------------------------
  return jsonb_build_object(
    'user_id',               v_user_id,
    'email',                 p_email,
    'display_name',          p_display_name,
    'tier',                  v_tier,
    'free_seat_number',      v_free_seat,
    'founding_seat_number',  v_founding_seat,
    'effective_seat_number', v_effective,
    'preferred_language',    p_language,
    'codes',                 to_jsonb(v_codes_minted),
    'used_invite_code',      coalesce(v_code_row.code, null)
  );
end;
$$;


----------------------------------------------------------------------
-- 13. Founding upgrade (called by Stripe webhook).
----------------------------------------------------------------------
create or replace function public.upgrade_to_founding(
  p_user_id            uuid,
  p_stripe_customer_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing      public.users;
  v_founding_seat bigint;
  v_codes_minted  text[];
begin
  select * into v_existing from public.users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if v_existing.tier = 'founding' then
    -- Idempotent: already upgraded. Return current state, do not re-mint.
    return jsonb_build_object(
      'user_id',               v_existing.id,
      'tier',                  v_existing.tier,
      'founding_seat_number',  v_existing.founding_seat_number,
      'effective_seat_number', v_existing.effective_seat_number,
      'already_founding',      true
    );
  end if;

  v_founding_seat := nextval('public.founding_seat_seq');

  update public.users
     set tier                   = 'founding',
         free_seat_number       = null,      -- per business rule
         founding_seat_number   = v_founding_seat,
         effective_seat_number  = v_founding_seat,
         stripe_customer_id     = coalesce(p_stripe_customer_id, stripe_customer_id)
   where id = p_user_id;

  v_codes_minted := public.mint_personal_codes(p_user_id, 10, 'personal_founding');
  insert into public.founding_code_batches (user_id, batch_size)
  values (p_user_id, 10);

  return jsonb_build_object(
    'user_id',               p_user_id,
    'tier',                  'founding',
    'founding_seat_number',  v_founding_seat,
    'effective_seat_number', v_founding_seat,
    'codes',                 to_jsonb(v_codes_minted),
    'already_founding',      false
  );
end;
$$;


----------------------------------------------------------------------
-- 14. Founding "request more codes" — enforces unused=0 and 100 lifetime cap.
----------------------------------------------------------------------
create or replace function public.request_more_founding_codes(
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user           public.users;
  v_unused_count   int;
  v_lifetime_count int;
  v_codes_minted   text[];
begin
  select * into v_user from public.users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_user.tier <> 'founding' then
    raise exception 'not_founding' using errcode = '42501';
  end if;

  select count(*) into v_unused_count
    from public.invitation_codes
   where owner_user_id = p_user_id
     and code_type     = 'personal_founding'
     and used_at       is null
     and active        = true;

  if v_unused_count > 0 then
    raise exception 'codes_remaining' using errcode = '22023';
  end if;

  select coalesce(sum(batch_size), 0) into v_lifetime_count
    from public.founding_code_batches
   where user_id = p_user_id;

  if v_lifetime_count >= 100 then
    raise exception 'lifetime_cap_reached' using errcode = '22023';
  end if;

  v_codes_minted := public.mint_personal_codes(p_user_id, 10, 'personal_founding');
  insert into public.founding_code_batches (user_id, batch_size)
  values (p_user_id, 10);

  return jsonb_build_object(
    'codes',               to_jsonb(v_codes_minted),
    'new_lifetime_total',  v_lifetime_count + 10
  );
end;
$$;


----------------------------------------------------------------------
-- 15. Periodic cleanup helper (call from a cron or a maintenance route).
----------------------------------------------------------------------
create or replace function public.cleanup_expired()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Expired sessions
  delete from public.sessions
   where expires_at < now() - interval '7 days';

  -- Old rate-limit buckets (older than 24h are safe to discard)
  delete from public.rate_limit_buckets
   where window_start < now() - interval '24 hours';

  -- Old login attempts (keep ~30 days for forensics)
  delete from public.login_attempts
   where attempted_at < now() - interval '30 days';
end;
$$;
