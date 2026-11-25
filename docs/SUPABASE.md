# Supabase — mise en place

## Ce qu'on met chez Supabase

| Élément | Type | Qui l'appelle | Rôle |
|---|---|---|---|
| `estimates` | table | le site (clé publique) | une ligne par estimation ; le site peut **ajouter** mais pas **lire** |
| `estimates_per_period(granularity, periods)` | fonction SQL (RPC) | page Statistiques | nombre d'estimations par jour / semaine / mois / année, périodes vides comprises |
| `api_usage` + `increment_api_usage(provider)` | table + fonction SQL | fonction `route` uniquement | compteur mensuel d'appels Google / TomTom |
| `route` | Edge Function (à écrire) | bouton « Calculer la distance » | appelle Google ou TomTom avec les clés secrètes, applique la règle de choix d'itinéraire, renvoie distance et durée |

Le schéma SQL est dans [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) (testé sur PostgreSQL 16).

### Appels depuis le site

```
POST {SUPABASE_URL}/rest/v1/estimates                         → enregistrer une estimation
POST {SUPABASE_URL}/rest/v1/rpc/estimates_per_period          → { "granularity": "day", "periods": 10 }
POST {SUPABASE_URL}/functions/v1/route                        → { "origin": {...}, "destination": {...} }
```

En-têtes : `apikey: <clé publique>` (+ `Authorization: Bearer <clé publique>` pour la fonction).

## Étapes

1. **Créer le projet** — supabase.com → « Start your project » (connexion GitHub possible) → New project : nom `taximeter`, région **West EU (Paris)**, mot de passe de base de données à conserver, offre Free.
2. **Créer les tables** — SQL Editor → New query → coller tout `supabase/migrations/0001_init.sql` → Run.
3. **Récupérer les accès publics** — Project Settings → API : copier **Project URL** et la clé **anon / publishable**. Ces deux valeurs sont publiques (elles iront dans le site) : on peut les envoyer à Claude.
4. **Clé Google** — console.cloud.google.com : créer un projet, activer la facturation, activer **Routes API**, créer une clé API restreinte à Routes API. Dans Budgets & alerts : budget à quelques euros avec alerte.
5. **Clé TomTom** — developer.tomtom.com : créer un compte et une clé (offre gratuite).
6. **Ranger les clés en secret** — Supabase → Edge Functions → Secrets : `GOOGLE_MAPS_API_KEY`, `TOMTOM_API_KEY`. Ne jamais les mettre dans le code ni dans le chat.
7. **Claude branche le site** — configuration Supabase dans le site, enregistrement des estimations, vraies données dans les Statistiques.
8. **Claude écrit la fonction `route`** — déploiement soit depuis l'éditeur de fonctions du tableau de bord Supabase, soit automatiquement par une GitHub Action (secrets GitHub `SUPABASE_ACCESS_TOKEN` et identifiant du projet).

> Offre gratuite : un projet inactif pendant une semaine est mis en pause ; il se relance depuis le tableau de bord.
