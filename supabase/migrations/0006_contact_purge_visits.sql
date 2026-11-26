-- TaxiMeter — 0006 : purge des messages de contact + mesure d'audience (visiteurs)
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
-- À exécuter AVANT de redéployer la fonction « contact ».

-- ─────────────────────────────────────────────────────────────
-- 1. Formulaire de contact : le contenu est effacé dès que l'e-mail est parti.
--    Il ne reste que l'empreinte d'IP et la date (anti-spam, 1 h utile), purgées après 1 jour.
--    Un message dont l'e-mail a échoué est gardé 30 jours au maximum.
-- ─────────────────────────────────────────────────────────────
alter table public.contact_messages alter column subject drop not null;
alter table public.contact_messages alter column message drop not null;
alter table public.contact_messages drop constraint if exists contact_has_way_back;

grant delete on public.contact_messages to service_role;

create or replace function public.contact_recent_count(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from contact_messages
  where (email_sent and created_at < now() - interval '1 day')
     or created_at < now() - interval '30 days';

  select count(*)::int into v_count from contact_messages
  where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  return v_count;
end;
$$;

revoke all on function public.contact_recent_count(text) from public, anon, authenticated;
grant execute on function public.contact_recent_count(text) to service_role;

-- Effacement immédiat du contenu des messages déjà envoyés
update public.contact_messages
set name = null, email = null, phone = null, subject = null, message = null, attachment_name = null
where email_sent;

-- ─────────────────────────────────────────────────────────────
-- 2. Mesure d'audience : une ligne par page affichée.
--    visitor_id = identifiant aléatoire stocké dans le navigateur (renouvelé tous les 13 mois).
--    Données supprimées après 25 mois (recommandation CNIL).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  page       text not null check (page in ('index', 'stats', 'contact', 'cgu', 'mentions-legales', 'confidentialite', 'autre'))
);

create index if not exists visits_created_idx on public.visits (created_at);
create index if not exists visits_visitor_created_idx on public.visits (visitor_id, created_at);

alter table public.visits enable row level security;

-- Le site peut AJOUTER une visite (date fixée par le serveur), mais ne peut rien lire.
drop policy if exists "anon peut ajouter une visite" on public.visits;
create policy "anon peut ajouter une visite"
  on public.visits for insert
  to anon
  with check (created_at > now() - interval '1 minute');

grant insert (visitor_id, page) on public.visits to anon;

/**
 * Visiteurs par période (heure de Paris, semaines commençant le lundi).
 * visitors  : visiteurs distincts sur la période
 * returning_visitors : parmi eux, ceux déjà venus avant la période
 * views     : pages affichées
 */
create or replace function public.visits_per_period(granularity text, periods int default 10)
returns table (bucket date, visitors bigint, returning_visitors bigint, views bigint)
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
  first_seen as (
    select visitor_id, min(created_at) as first_at from public.visits group by visitor_id
  ),
  v as (
    select date_trunc((select g from params), x.created_at at time zone 'Europe/Paris')::date as bucket,
           x.visitor_id, f.first_at
    from public.visits x
    join first_seen f using (visitor_id)
    where x.created_at >= (select min(bucket) from series)::timestamp at time zone 'Europe/Paris'
  ),
  counts as (
    select bucket,
           count(distinct visitor_id) as visitors,
           count(distinct visitor_id) filter (where first_at < bucket::timestamp at time zone 'Europe/Paris') as returning_visitors,
           count(*) as views
    from v
    group by bucket
  )
  select s.bucket, coalesce(c.visitors, 0), coalesce(c.returning_visitors, 0), coalesce(c.views, 0)
  from series s
  left join counts c using (bucket)
  order by s.bucket;
$$;

revoke all on function public.visits_per_period(text, int) from public;
grant execute on function public.visits_per_period(text, int) to anon;

/**
 * Fidélité sur les 30 derniers jours : nombre de visiteurs selon le nombre de jours
 * différents où ils sont venus (1, 2-3, 4-9, 10 et plus).
 */
create or replace function public.visitor_frequency()
returns table (bracket text, visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select visitor_id, count(distinct (created_at at time zone 'Europe/Paris')::date) as n
    from public.visits
    where created_at > now() - interval '30 days'
    group by visitor_id
  ),
  b as (
    select case when n = 1 then '1' when n <= 3 then '2-3' when n <= 9 then '4-9' else '10+' end as bracket
    from days
  )
  select k.bracket, count(b.bracket)
  from (values ('1', 1), ('2-3', 2), ('4-9', 3), ('10+', 4)) as k(bracket, ord)
  left join b using (bracket)
  group by k.bracket, k.ord
  order by k.ord;
$$;

revoke all on function public.visitor_frequency() from public;
grant execute on function public.visitor_frequency() to anon;

-- Purge des visites de plus de 25 mois, faite de temps en temps lors d'un ajout (environ 1 fois sur 100)
create or replace function public.visits_purge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if random() < 0.01 then
    delete from public.visits where created_at < now() - interval '25 months';
  end if;
  return null;
end;
$$;

revoke all on function public.visits_purge() from public, anon, authenticated;

drop trigger if exists visits_purge_trigger on public.visits;
create trigger visits_purge_trigger
  after insert on public.visits
  for each statement execute function public.visits_purge();
