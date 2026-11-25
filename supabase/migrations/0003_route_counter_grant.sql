-- TaxiMeter — 0003 : autorise la fonction serveur « route » (clé service_role) à incrémenter le compteur mensuel.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.
grant execute on function public.increment_api_usage(text) to service_role;
