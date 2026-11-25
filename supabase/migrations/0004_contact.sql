-- TaxiMeter — 0004 : messages du formulaire de contact
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
-- La table n'est accessible qu'à la fonction serveur « contact » (clé service_role) : ni lecture ni écriture publiques.

create table if not exists public.contact_messages (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  name            text check (char_length(name) <= 100),
  email           text check (char_length(email) <= 200),
  phone           text check (char_length(phone) <= 30),
  subject         text not null check (char_length(subject) between 1 and 150),
  message         text not null check (char_length(message) between 1 and 5000),
  attachment_name text,
  ip_hash         text,
  email_sent      boolean not null default false,
  constraint contact_has_way_back check (coalesce(email, '') <> '' or coalesce(phone, '') <> '')
);

create index if not exists contact_messages_ip_created_idx on public.contact_messages (ip_hash, created_at);

alter table public.contact_messages enable row level security;
-- Aucune politique : le site (clé publique) ne peut ni lire ni écrire directement.

-- Anti-spam : nombre de messages envoyés depuis la même adresse (hachée) sur la dernière heure
create or replace function public.contact_recent_count(p_ip_hash text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.contact_messages
  where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
$$;

revoke all on function public.contact_recent_count(text) from public, anon, authenticated;
grant execute on function public.contact_recent_count(text) to service_role;
grant select, insert, update on public.contact_messages to service_role;
