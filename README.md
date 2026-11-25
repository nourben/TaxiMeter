# TaxiMeter

**🌐 Site en ligne : https://nourben.github.io/TaxiMeter/**

Estimation du prix d’une course de taxi : jusqu’à 20 trajets par course, distance (saisie ou relevée sur Google Maps), tarif jour/nuit automatique,
supplément Métropole et tarif au km réglables par trajet, prix total et détail par trajet.

Site statique (HTML/CSS/JS sans framework, sans build), publié par GitHub Pages depuis la branche `main`.

- Suivi du projet (fait / à faire / à vérifier) : [page Tâches](https://nourben.github.io/TaxiMeter/taches.html)
- Statut : premier jet de l'interface — API itinéraire et base Supabase à venir
- Mise en place de Supabase : [docs/SUPABASE.md](docs/SUPABASE.md)

## Lancer en local

Les modules JavaScript ne fonctionnent pas en ouvrant le fichier directement (`file://`) : il faut un petit serveur.

```bash
npx serve .          # ou : python3 -m http.server 8000
npm test             # tests du calcul tarifaire et du choix d'itinéraire
```

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `js/config/tarifs.js` | **Toute la grille tarifaire** (prise en charge, km inclus, coefficients, horaires, Métropole) et les règles d'itinéraire |
| `js/core/` | Logique pure, testée : `pricing.js`, `period.js` (jour/nuit), `metropole.js`, `route-selection.js` |
| `js/services/` | Lien Google Maps, géocodage (IGN, gratuit), stockage (localStorage → Supabase), squelette `routing/` |
| `js/ui/` | En-tête/pied de page/thème, infos contextuelles |
| `js/pages/` | Script de chaque page |
| `js/data/tasks-data.js` | Contenu de la page « Tâches » |
| `tests/` | Tests `node --test` |

## Calcul

```
km facturés = max(0, distance − 4)
distance    = km facturés × tarif km (1,20 / 1,22 / 1,07)
jour (8h–20h)  : 13 + distance × 1,25
nuit (20h–8h)  : (13 + distance) × 1,5
Métropole      : + 15 € (cumulable)
```

Exemples vérifiés par les tests : 20 km jour = 37,00 €, nuit = 48,30 €.

## Brancher l'API itinéraire (plus tard)

`window.TaxiMeter.setRouteResult(1, { distanceKm, durationMin })` remplit la distance et active le bouton ↺.
La règle de choix entre itinéraires est dans `js/core/route-selection.js`.
