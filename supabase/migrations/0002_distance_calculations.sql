-- TaxiMeter — 0002 : distinguer les estimations de prix et les calculs de distance
-- À coller dans Supabase > SQL Editor > New query, puis « Run » (après 0001_init.sql).
-- Peut être relancé sans risque.

-- 1. Type d'événement : 'price' = estimation de prix, 'distance' = calcul de distance (bouton « Calculer la distance »)
alter table public.estimates
  add column if not exists kind text not null default 'price';

alter table public.estimates drop constraint if exists estimates_kind_check;
alter table public.estimates
  add constraint estimates_kind_check check (kind in ('price', 'distance'));

create index if not exists estimates_kind_created_at_idx on public.estimates (kind, created_at);

-- 2. Statistiques par période, filtrées par type
drop function if exists public.estimates_per_period(text, int);
drop function if exists public.estimates_per_period(text, int, text);

create function public.estimates_per_period(granularity text, periods int default 10, kind text default 'price')
returns table (bucket date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      granularity as g,
      kind as k,
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
    where e.kind = (select k from params)
      and e.created_at >= (select min(bucket) from series)::timestamp at time zone 'Europe/Paris'
    group by 1
  )
  select s.bucket, coalesce(c.count, 0) as count
  from series s
  left join counts c using (bucket)
  order by s.bucket;
$$;

revoke all on function public.estimates_per_period(text, int, text) from public;
grant execute on function public.estimates_per_period(text, int, text) to anon;

-- 3. Compteur d'appels API : Google uniquement pour l'instant
alter table public.api_usage drop constraint if exists api_usage_provider_check;
alter table public.api_usage
  add constraint api_usage_provider_check check (provider in ('google'));
