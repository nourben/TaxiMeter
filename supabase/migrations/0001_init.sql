-- TaxiMeter — schéma initial Supabase
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».

-- ─────────────────────────────────────────────────────────────
-- 1. Estimations (une ligne par estimation de prix affichée)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.estimates (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  trips_count   smallint    not null default 1 check (trips_count between 1 and 20),
  total_eur     numeric(8,2) check (total_eur >= 0),
  distance_km   numeric(7,1) check (distance_km >= 0),
  distance_source text check (distance_source in ('manual', 'api'))
);

create index if not exists estimates_created_at_idx on public.estimates (created_at);

alter table public.estimates enable row level security;

-- Le site (clé publique « anon ») peut AJOUTER une estimation, mais ne peut rien lire.
drop policy if exists "anon peut ajouter une estimation" on public.estimates;
create policy "anon peut ajouter une estimation"
  on public.estimates for insert
  to anon
  with check (true);

grant insert on public.estimates to anon;

-- ─────────────────────────────────────────────────────────────
-- 2. Statistiques : nombre d'estimations par période
--    granularity : 'day' | 'week' | 'month' | 'year'
--    Renvoie aussi les périodes à 0 ; semaines commençant le lundi ; heure de Paris.
-- ─────────────────────────────────────────────────────────────
create or replace function public.estimates_per_period(granularity text, periods int default 10)
returns table (bucket date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      granularity as g,
      least(greatest(periods, 1), 60) as n,
      (case granularity
         when 'day' then interval '1 day'
         when 'week' then interval '1 week'
         when 'month' then interval '1 month'
         when 'year' then interval '1 year'
       end) as step
  ),
  series as (
    select generate_series(
             date_trunc(p.g, now() at time zone 'Europe/Paris') - p.step * (p.n - 1),
             date_trunc(p.g, now() at time zone 'Europe/Paris'),
             p.step
           )::date as bucket
    from params p
    where p.step is not null
  ),
  counts as (
    select date_trunc((select g from params), e.created_at at time zone 'Europe/Paris')::date as bucket,
           count(*) as count
    from public.estimates e
    where e.created_at >= (select min(bucket) from series)::timestamp at time zone 'Europe/Paris'
    group by 1
  )
  select s.bucket, coalesce(c.count, 0) as count
  from series s
  left join counts c using (bucket)
  order by s.bucket;
$$;

revoke all on function public.estimates_per_period(text, int) from public;
grant execute on function public.estimates_per_period(text, int) to anon;

-- ─────────────────────────────────────────────────────────────
-- 3. Compteur d'appels à l'API itinéraire (Google), pour bloquer avant la limite gratuite
--    Utilisé uniquement par la fonction serveur « route » (clé service_role).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.api_usage (
  provider text not null check (provider in ('google')),
  month    date not null,
  calls    integer not null default 0,
  primary key (provider, month)
);

alter table public.api_usage enable row level security;
-- Aucune politique : ni le site ni le public ne peuvent lire ou écrire cette table.

create or replace function public.increment_api_usage(p_provider text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.api_usage (provider, month, calls)
  values (p_provider, date_trunc('month', now() at time zone 'Europe/Paris')::date, 1)
  on conflict (provider, month) do update set calls = api_usage.calls + 1
  returning calls;
$$;

revoke all on function public.increment_api_usage(text) from public, anon, authenticated;
