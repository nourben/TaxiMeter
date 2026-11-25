# Supabase — mise en place

## Ce qu'on met chez Supabase

| Élément | Type | Qui l'appelle | Rôle |
|---|---|---|---|
| `estimates` | table | le site (clé publique) | une ligne par événement, colonne `kind` : `price` (estimation de prix) ou `distance` (calcul de distance) ; le site peut **ajouter** mais pas **lire** |
| `estimates_per_period(granularity, periods, kind)` | fonction SQL (RPC) | page Statistiques | nombre d'événements d'un type par jour / semaine / mois / année, périodes vides comprises |
| `api_usage` + `increment_api_usage(provider)` | table + fonction SQL | fonction `route` uniquement | compteur mensuel d'appels Google, pour bloquer avant la limite gratuite |
| `route` | Edge Function (à écrire) | bouton « Calculer la distance » | appelle Google Routes avec la clé secrète, applique la règle de choix d'itinéraire, renvoie distance et durée |

Le schéma SQL est dans [`supabase/migrations/`](../supabase/migrations/), à exécuter dans l'ordre : `0001_init.sql`, puis `0002_distance_calculations.sql` (testés sur PostgreSQL 16).

### Appels depuis le site

```
POST {SUPABASE_URL}/rest/v1/estimates                         → enregistrer une estimation
POST {SUPABASE_URL}/rest/v1/rpc/estimates_per_period          → { "granularity": "day", "periods": 10, "kind": "price" }
POST {SUPABASE_URL}/functions/v1/route                        → { "origin": {...}, "destination": {...} }
```

En-têtes : `apikey: <clé publique>` (+ `Authorization: Bearer <clé publique>` pour la fonction).

## Étapes

1. **Créer le projet** — supabase.com → « Start your project » (connexion GitHub possible) → New project : nom `taximeter`, région **West EU (Paris)**, mot de passe de base de données à conserver, offre Free.
2. **Créer les tables** — SQL Editor → New query → coller tout `supabase/migrations/0001_init.sql` → Run.
3. **Récupérer les accès publics** — Project Settings → API : copier **Project URL** et la clé **anon / publishable**. Ces deux valeurs sont publiques (elles iront dans le site) : on peut les envoyer à Claude.
4. **Mettre à jour la base** — SQL Editor → coller `supabase/migrations/0002_distance_calculations.sql` → Run.
5. **Clé Google** — voir « Activer Google Routes API » ci-dessous.
6. **Ranger la clé en secret** — Supabase → Edge Functions → Secrets : `GOOGLE_MAPS_API_KEY`. Ne jamais la mettre dans le code ni dans le chat.
7. **Claude branche le site** — fait : configuration Supabase, enregistrement des estimations, vraies données dans les Statistiques.
8. **Claude écrit la fonction `route`** — déploiement soit depuis l'éditeur de fonctions du tableau de bord Supabase, soit automatiquement par une GitHub Action (secrets GitHub `SUPABASE_ACCESS_TOKEN` et identifiant du projet).

> Offre gratuite : un projet inactif pendant une semaine est mis en pause ; il se relance depuis le tableau de bord.

## Activer Google Routes API

1. console.cloud.google.com → créer un projet (ex. `taximeter`).
2. Facturation → associer un compte de facturation (carte bancaire, obligatoire même pour rester dans le gratuit).
3. APIs et services → Bibliothèque → chercher **Routes API** → Activer.
4. APIs et services → Identifiants → Créer des identifiants → Clé API → Modifier la clé : *Restrictions d'API* = Routes API uniquement.
5. **Garde-fou** : APIs et services → Routes API → Quotas → baisser « requêtes par jour » (ex. 150/jour ≈ 4 500/mois, sous les 5 000 gratuits du niveau Pro). Au-delà, Google refuse les appels au lieu de les facturer.
6. Facturation → Budgets et alertes → budget de 5 € avec alertes à 50 / 90 / 100 % (une alerte prévient mais ne bloque pas).
