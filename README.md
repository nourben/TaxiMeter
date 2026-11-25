# TaxiMeter

**🌐 Site en ligne : https://nourben.github.io/TaxiMeter/**

Estimation du prix d’une course de taxi : jusqu’à 20 trajets par course, distance (saisie ou relevée sur Google Maps), tarif jour/nuit automatique,
supplément Métropole et tarif au km réglables par trajet, prix total et détail par trajet.

Site statique (HTML/CSS/JS sans framework, sans build), publié par GitHub Pages depuis la branche `main`.

- Suivi du projet : [issues GitHub](https://github.com/nourben/TaxiMeter/issues) (une issue par tâche, étiquettes de statut et de domaine), affichées dans le tableau GitHub Project « TaxiMeter »
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
| `js/core/` | Logique pure, testée : `pricing.js`, `period.js` (jours fériés), `metropole.js`, `periods.js` (statistiques) |
| `js/services/` | Lien Google Maps, géocodage et autocomplétion (IGN, gratuit), Supabase (statistiques) |
| `js/ui/` | En-tête/pied de page/thème, infos contextuelles |
| `js/pages/` | Script de chaque page |
| `tests/` | Tests `node --test` |

## Calcul (convention-cadre taxis, JO du 8 août 2025)

```
socle          = 13 € (4 km inclus) + (distance − 4) × tarif km (1,07 / 1,20 / 1,22) [+ 15 € Métropole / grande ville]
hospitalisation (aller ou retour à vide) : + 25 % du coût des km, + 50 % à partir de 50 km
nuit / week-end / férié                  : + 50 % du socle
transport partagé (2 / 3 / 4+ patients)  : − 23 % / − 35 % / − 37 % sur chaque trajet (− 5 % : patient seul ≥ 30 km)
```

Exemples vérifiés par les tests (20 km à 1,20 €) : hospitalisation 37,00 €, nuit 48,30 €, grande ville seule 47,20 €.

## Calcul de distance

Le bouton « Calculer la distance » appelle la fonction Supabase `route` (Google Routes), qui retient toujours l'itinéraire le plus court en km : l'Assurance maladie rembourse sur la base du trajet le moins onéreux. Voir [docs/SUPABASE.md](docs/SUPABASE.md).
