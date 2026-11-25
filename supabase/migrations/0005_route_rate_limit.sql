-- TaxiMeter — 0005 : limite des calculs de distance par appareil + cache des itinéraires
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
-- Tables utilisées uniquement par la fonction serveur « route » (clé service_role).

-- Appels récents (IP hachée), purgés après 2 jours
create table if not exists public.route_calls (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists route_calls_ip_created_idx on public.route_calls (ip_hash, created_at);

-- Dépassements de limite et blocages de 24 h
create table if not exists public.route_violations (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index if not exists route_violations_ip_created_idx on public.route_violations (ip_hash, created_at);

create table if not exists public.route_blocks (
  ip_hash       text primary key,
  blocked_until timestamptz not null,
  created_at    timestamptz not null default now()
);

-- Cache des itinéraires (même départ et même destination : pas de nouvel appel à Google pendant 24 h)
create table if not exists public.route_cache (
  key          text primary key,
  distance_km  numeric(7,1) not null,
  duration_min integer not null,
  created_at   timestamptz not null default now()
);

alter table public.route_calls enable row level security;
alter table public.route_violations enable row level security;
alter table public.route_blocks enable row level security;
alter table public.route_cache enable row level security;
-- Aucune politique : ni lecture ni écriture publiques.

/**
 * Vérifie les limites pour une IP hachée et, si l'appel est autorisé, l'enregistre.
 * Limites : 10 / minute, 60 / heure, 200 / 24 h. 3 dépassements en 24 h → blocage de 24 h.
 * Renvoie { allowed: bool, reason?: 'blocked'|'minute'|'hour'|'day', retry_after?: secondes }.
 */
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
  delete from route_cache where created_at < now() - interval '1 day';

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
grant select, insert, update, delete on public.route_cache to service_role;
