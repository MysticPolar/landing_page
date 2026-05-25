-- Phase 6 — atomic rate-limit bumper.
--
-- The application passes a bucket_key (like 'ip:1.2.3.4:auth-login') and a
-- window size in seconds. The RPC computes the current window_start by
-- flooring epoch seconds to the window boundary, then upserts the
-- (bucket_key, window_start) row with count+1.
--
-- Returns the new count after the bump. The Node side compares this
-- against the endpoint-specific limit and returns 429 if exceeded.

create or replace function public.bump_rate_limit(
  p_key            text,
  p_window_seconds int default 60
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  if p_window_seconds <= 0 then
    raise exception 'bump_rate_limit: window_seconds must be positive';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets (bucket_key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (bucket_key, window_start)
    do update set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return v_count;
end;
$$;
