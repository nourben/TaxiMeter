-- TaxiMeter — 0009 : compter les refus de la mesure d'audience
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
--
-- Une ligne à chaque clic sur « Ne plus être compté » (optout) ou « Accepter d'être compté » (optin),
-- page Confidentialité. Aucun identifiant, aucune IP : seulement le type et la date.
-- Lignes supprimées après 25 mois, comme les visites.

create table if not exists public.audience_optouts (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('optout', 'optin'))
);

alter table public.audience_optouts enable row level security;

-- Le site peut AJOUTER une ligne (date fixée par le serveur), mais ne peut rien lire.
drop policy if exists "anon peut ajouter un refus" on public.audience_optouts;
create policy "anon peut ajouter un refus"
  on public.audience_optouts for insert
  to anon
  with check (created_at > now() - interval '1 minute');

grant insert (kind) on public.audience_optouts to anon;

-- Totaux pour la page Statistiques : refus, réactivations, refus des 30 derniers jours
create or replace function public.audience_optout_stats()
returns table (optouts bigint, optins bigint, optouts_30d bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where kind = 'optout'),
    count(*) filter (where kind = 'optin'),
    count(*) filter (where kind = 'optout' and created_at > now() - interval '30 days')
  from public.audience_optouts;
$$;

revoke all on function public.audience_optout_stats() from public;
grant execute on function public.audience_optout_stats() to anon;

-- Purge après 25 mois
create or replace function public.audience_optouts_purge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.audience_optouts where created_at < now() - interval '25 months';
  return null;
end;
$$;

revoke all on function public.audience_optouts_purge() from public, anon, authenticated;

drop trigger if exists audience_optouts_purge_trigger on public.audience_optouts;
create trigger audience_optouts_purge_trigger
  after insert on public.audience_optouts
  for each statement execute function public.audience_optouts_purge();
