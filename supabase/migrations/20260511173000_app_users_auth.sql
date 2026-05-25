-- Real auth storage for landing-page login/signup.
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  invite_code text,
  seat_number bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists app_users_email_idx on public.app_users (email);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'invitation_codes'
  ) then
    begin
      alter table public.app_users
        add constraint app_users_invite_code_fkey
        foreign key (invite_code) references public.invitation_codes(code);
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;
