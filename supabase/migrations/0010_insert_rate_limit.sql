-- TaxiMeter — 0010 : limite d'ajouts par minute pour les statistiques
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
--
-- Pourquoi : la clé publique du site permet à n'importe qui d'AJOUTER des lignes dans les tables
-- de statistiques (estimates, visits, audience_optouts), y compris des milliers d'un coup en une
-- seule requête. Elle ne permet ni de lire, ni de modifier, ni de supprimer quoi que ce soit.
--
-- Ce script :
--   1. empêche le site de choisir la date d'une estimation (comme pour les visites) ;
--   2. limite les ajouts par minute, par adresse IP et au total, pour chaque table.
--
-- Vie privée : l'adresse IP n'est jamais enregistrée. On garde seulement une empreinte
-- (HMAC-SHA256 avec un secret propre à la base, qui change chaque jour), effacée au bout d'une heure.

-- ─────────────────────────────────────────────────────────────
-- 1. Estimations : colonnes autorisées et date fixée par le serveur
-- ─────────────────────────────────────────────────────────────
revoke insert on public.estimates from anon;
grant insert (kind, trips_count, total_eur, distance_km, distance_source) on public.estimates to anon;

drop policy if exists "anon peut ajouter une estimation" on public.estimates;
create policy "anon peut ajouter une estimation"
  on public.estimates for insert
  to anon
  with check (created_at > now() - interval '1 minute');

-- ─────────────────────────────────────────────────────────────
-- 2. Secret des empreintes d'IP (illisible par le site : RLS sans règle, aucun droit)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.private_settings (
  key   text primary key,
  value text not null
);
alter table public.private_settings enable row level security;
revoke all on public.private_settings from public, anon, authenticated;

insert into public.private_settings (key, value)
values ('ip_salt', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3. Compteur d'ajouts par minute
-- ─────────────────────────────────────────────────────────────
create table if not exists public.insert_rate (
  ip_hash text        not null, -- empreinte du jour, ou « * » pour le total toutes IP confondues
  kind    text        not null, -- table concernée
  minute  timestamptz not null,
  hits    int         not null default 1,
  primary key (ip_hash, kind, minute)
);
alter table public.insert_rate enable row level security;
revoke all on public.insert_rate from public, anon, authenticated;

/** Empreinte du jour de l'IP de la requête (en-têtes transmis par l'API Supabase). */
create or replace function public.client_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  h    json;
  ip   text;
  salt text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    h := null;
  end;
  ip := coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', split_part(h ->> 'x-forwarded-for', ',', 1), 'inconnue');
  select value into salt from public.private_settings where key = 'ip_salt';
  return encode(hmac(trim(ip) || '|' || current_date::text, coalesce(salt, ''), 'sha256'), 'hex');
end;
$$;

revoke all on function public.client_ip_hash() from public, anon, authenticated;

/**
 * Déclencheur : compte chaque ligne ajoutée ; au-delà de la limite, la requête entière est refusée
 * (rien n'est ajouté). Arguments : limite par IP et par minute, limite totale par minute.
 */
create or replace function public.insert_rate_guard()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  per_ip int := tg_argv[0]::int;
  per_all int := tg_argv[1]::int;
  m timestamptz := date_trunc('minute', now());
  n_ip int;
  n_all int;
begin
  insert into public.insert_rate as r (ip_hash, kind, minute)
  values (public.client_ip_hash(), tg_table_name, m)
  on conflict (ip_hash, kind, minute) do update set hits = r.hits + 1
  returning hits into n_ip;

  insert into public.insert_rate as r (ip_hash, kind, minute)
  values ('*', tg_table_name, m)
  on conflict (ip_hash, kind, minute) do update set hits = r.hits + 1
  returning hits into n_all;

  if n_ip > per_ip or n_all > per_all then
    raise exception 'Trop d''ajouts : réessayez dans une minute' using errcode = 'P0001';
  end if;

  -- Ménage de temps en temps : compteurs de plus d'une heure
  if random() < 0.02 then
    delete from public.insert_rate where minute < now() - interval '1 hour';
  end if;
  return new;
end;
$$;

revoke all on function public.insert_rate_guard() from public, anon, authenticated;

-- Limites : par IP et par minute / total par minute
--   visites : 30 / 600 · estimations et calculs : 30 / 600 · refus de mesure : 5 / 60
drop trigger if exists visits_rate_guard on public.visits;
create trigger visits_rate_guard
  before insert on public.visits
  for each row execute function public.insert_rate_guard(30, 600);

drop trigger if exists estimates_rate_guard on public.estimates;
create trigger estimates_rate_guard
  before insert on public.estimates
  for each row execute function public.insert_rate_guard(30, 600);

drop trigger if exists audience_optouts_rate_guard on public.audience_optouts;
create trigger audience_optouts_rate_guard
  before insert on public.audience_optouts
  for each row execute function public.insert_rate_guard(5, 60);
