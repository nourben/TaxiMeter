-- TaxiMeter — 0008 : suppression du cache des itinéraires (annule 0007 et la partie cache de 0005)
-- Les conditions Google Maps Platform n'autorisent à garder que les latitudes / longitudes, pas les distances ni les durées.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.

-- 1. Limite par appareil, sans purge du cache
create or replace function public.route_rate_check(p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
  v_min int;
  v_hour int;
  v_day int;
  v_reason text;
  v_retry int;
  v_viol int;
begin
  -- Purge des anciennes données
  delete from route_calls where created_at < now() - interval '2 days';
  delete from route_violations where created_at < now() - interval '2 days';
  delete from route_blocks where blocked_until < now();

  select blocked_until into v_until from route_blocks where ip_hash = p_ip_hash;
  if v_until is not null then
    return jsonb_build_object('allowed', false, 'reason', 'blocked',
      'retry_after', ceil(extract(epoch from v_until - now()))::int);
  end if;

  select
    count(*) filter (where created_at > now() - interval '1 minute'),
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*)
  into v_min, v_hour, v_day
  from route_calls
  where ip_hash = p_ip_hash and created_at > now() - interval '1 day';

  if v_min >= 10 then v_reason := 'minute'; v_retry := 60;
  elsif v_hour >= 60 then v_reason := 'hour'; v_retry := 3600;
  elsif v_day >= 200 then v_reason := 'day'; v_retry := 86400;
  end if;

  if v_reason is not null then
    insert into route_violations (ip_hash, reason) values (p_ip_hash, v_reason);
    select count(*) into v_viol from route_violations
      where ip_hash = p_ip_hash and created_at > now() - interval '1 day';
    if v_viol >= 3 then
      insert into route_blocks (ip_hash, blocked_until) values (p_ip_hash, now() + interval '24 hours')
      on conflict (ip_hash) do update set blocked_until = excluded.blocked_until;
      return jsonb_build_object('allowed', false, 'reason', 'blocked', 'retry_after', 86400);
    end if;
    return jsonb_build_object('allowed', false, 'reason', v_reason, 'retry_after', v_retry);
  end if;

  insert into route_calls (ip_hash) values (p_ip_hash);
  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.route_rate_check(text) from public, anon, authenticated;
grant execute on function public.route_rate_check(text) to service_role;

-- 2. Suppression de la table et de son contenu
drop table if exists public.route_cache;
