-- Phase 0 — foundation fix.
--
-- Background: the original invitation_codes migration used a *functional* unique
-- index on upper(trim(code)). That prevents case-insensitive duplicates, but it
-- is NOT a column-level UNIQUE constraint, so the foreign key in app_users
-- (invite_code -> invitation_codes.code) silently fails to install — the DO
-- block's EXCEPTION clause only catches duplicate_object, not invalid_foreign_key.
--
-- This migration:
--   1) Defensively normalizes any non-canonical codes (uppercase + trimmed).
--   2) Adds a real column-level UNIQUE on invitation_codes.code.
--   3) Adds a CHECK so future inserts must be canonical.
--   4) Re-attempts the FK on app_users.invite_code now that the target column
--      has a real unique constraint.
--
-- The migration is idempotent: it can be re-run safely.

-- 1) Normalize existing rows (no-op on a fresh DB).
update public.invitation_codes
   set code = upper(trim(code))
 where code is not null
   and code <> upper(trim(code));

-- 2) Real column-level UNIQUE on invitation_codes.code.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.invitation_codes'::regclass
       and conname  = 'invitation_codes_code_unique'
  ) then
    alter table public.invitation_codes
      add constraint invitation_codes_code_unique unique (code);
  end if;
end $$;

-- 3) Future inserts must already be canonical.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.invitation_codes'::regclass
       and conname  = 'invitation_codes_code_canonical_chk'
  ) then
    alter table public.invitation_codes
      add constraint invitation_codes_code_canonical_chk
      check (code = upper(trim(code)));
  end if;
end $$;

-- 4) Re-attempt the FK on app_users.invite_code now that code is uniquely
--    constrained. Idempotent; skipped cleanly if already present or if
--    app_users doesn't exist yet.
do $$
begin
  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'public' and table_name = 'app_users'
  ) and not exists (
    select 1
      from pg_constraint
     where conname  = 'app_users_invite_code_fkey'
       and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_invite_code_fkey
      foreign key (invite_code) references public.invitation_codes(code);
  end if;
end $$;
