// Accès Supabase côté site. Ces deux valeurs sont PUBLIQUES par conception :
// la clé « publishable » ne permet que ce que les règles RLS autorisent
// (ajouter une estimation, lire les statistiques agrégées).
// Les clés secrètes (Google, service_role) ne vont JAMAIS ici.
export const SUPABASE_URL = 'https://sthsedzqvnxxhdgswuyi.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Aml0pyf63bGyDL0lQJjiKA_1zYP9ZGx';
