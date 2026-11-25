// Suivi du projet — modifier ce fichier pour mettre à jour la page « Tâches ».
// status : 'done' (fait) · 'validate' (à valider) · 'todo' (à faire, prochaine étape) · 'later' (plus tard)

export const STATUSES = [
  { key: 'validate', label: 'À valider', description: 'Points à confirmer avant d’aller plus loin', open: true },
  { key: 'todo', label: 'À faire — prochaine étape', description: 'Une fois l’interface validée', open: true },
  { key: 'later', label: 'Plus tard', description: 'Dépend d’un compte ou d’une décision à venir', open: false },
  { key: 'done', label: 'Fait', description: 'Livré dans le premier jet', open: false },
];

export const TASKS = [
  // ---------- Fait ----------
  { status: 'done', area: 'Interface', title: 'Formulaire départ / destination' },
  { status: 'done', area: 'Interface', title: 'Lien Google Maps vers l’itinéraire (départ → destination)' },
  { status: 'done', area: 'Interface', title: 'Champ distance en saisie manuelle (km, décimales acceptées)' },
  { status: 'done', area: 'Interface', title: 'Bouton ↺ pour revenir à la distance calculée (prêt pour l’API)', note: 'Apparaît seulement quand une valeur API existe et a été modifiée.' },
  { status: 'done', area: 'Interface', title: 'Temps de trajet facultatif, affiché avec le prix' },
  { status: 'done', area: 'Interface', title: 'Date et heure de départ, réglées sur maintenant par défaut' },
  { status: 'done', area: 'Tarifs', title: 'Tarif jour / nuit choisi automatiquement selon l’heure (8 h / 20 h), modifiable à la main' },
  { status: 'done', area: 'Tarifs', title: 'Supplément Métropole détecté automatiquement (départ ou destination), modifiable à la main' },
  { status: 'done', area: 'Tarifs', title: 'Choix du tarif kilométrique 1,20 € (défaut) / 1,22 € / 1,07 €' },
  { status: 'done', area: 'Tarifs', title: 'Calcul du prix avec le détail ligne par ligne' },
  { status: 'done', area: 'Tarifs', title: 'Tests automatiques du calcul (exemples 37,00 € / 48,30 € vérifiés)' },
  { status: 'done', area: 'Interface', title: '2e course en parallèle (même départ), prix séparés + total' },
  { status: 'done', area: 'Interface', title: 'Infos contextuelles « i » (horaires, Métropole, km inclus…)' },
  { status: 'done', area: 'Interface', title: 'Thème clair (défaut) / sombre, mémorisé sur l’appareil' },
  { status: 'done', area: 'Interface', title: 'Pied de page : statistiques, CGV, mentions légales, tâches' },
  { status: 'done', area: 'Stockage', title: 'Enregistrement des courses sur l’appareil (en attendant Supabase)' },
  { status: 'done', area: 'Stats', title: 'Page statistiques à partir des courses enregistrées' },
  { status: 'done', area: 'API itinéraire', title: 'Règle de choix d’itinéraire codée et testée (plus court, ou alternative ≤ +10 km si trajet long)' },
  { status: 'done', area: 'API itinéraire', title: 'Squelette de la couche d’abstraction fournisseurs (Google → TomTom)' },

  // ---------- À valider ----------
  { status: 'validate', area: 'Tarifs', title: 'Coefficient jour : appliqué à la distance seule ?', note: 'Votre exemple de jour donne 13 + 19,20 × 1,25 = 37,00 € (coefficient sur la distance), alors que celui de nuit donne (13 + 19,20) × 1,5 = 48,30 € (coefficient sur le total). Le site reproduit les deux exemples tels quels ; un seul paramètre à changer si c’est une erreur.' },
  { status: 'validate', area: 'Tarifs', title: 'Métropole seule = 47,20 € dans l’exemple', note: 'Ce montant correspond à 32,20 + 15 € sans coefficient jour ni nuit. Le site applique toujours jour OU nuit, donc Métropole + jour 20 km = 52,00 € et Métropole + nuit = 63,30 €.' },
  { status: 'validate', area: 'Tarifs', title: 'Zone Métropole : rayon de 11 km autour de Notre-Dame + codes postaux 75/92/93/94', note: 'Paris – Créteil ≈ 10,4 km à vol d’oiseau. Certaines communes de petite couronne dépassent 11 km mais sont incluses par leur code postal.' },
  { status: 'validate', area: 'Tarifs', title: 'Changement d’horaire pendant la course', note: 'Aujourd’hui seul l’horaire de départ compte (ex. départ 19 h 50 = tarif de jour).' },
  { status: 'validate', area: 'Tarifs', title: '2e course : prix plein pour chaque client ou réduction ?', note: 'Actuellement chaque course est calculée séparément au tarif normal.' },
  { status: 'validate', area: 'API itinéraire', title: 'Seuil « trajet long » : durée > distance × 1,3', note: '« Largement plus que 1 km = 1 min » traduit par un ratio de 1,3 (réglable).' },
  { status: 'validate', area: 'Interface', title: 'Valider l’interface (mobile et ordinateur, clair et sombre)' },

  // ---------- À faire (prochaine étape) ----------
  { status: 'todo', area: 'API itinéraire', title: 'Créer une clé Google Maps Platform (Routes API) avec plafond de budget' },
  { status: 'todo', area: 'API itinéraire', title: 'Créer une clé TomTom Routing' },
  { status: 'todo', area: 'API itinéraire', title: 'Fonction serveur qui appelle les API (clés non exposées dans le navigateur)' },
  { status: 'todo', area: 'API itinéraire', title: 'Fournisseur Google : itinéraires alternatifs + trafic à l’heure de départ' },
  { status: 'todo', area: 'API itinéraire', title: 'Fournisseur TomTom : routeType=shortest + alternatives + trafic' },
  { status: 'todo', area: 'API itinéraire', title: 'Compteur de quota mensuel Google → bascule automatique sur TomTom' },
  { status: 'todo', area: 'API itinéraire', title: 'Mode un seul fournisseur si un seul est configuré' },
  { status: 'todo', area: 'API itinéraire', title: 'Remplir distance et durée automatiquement (déjà branché via setRouteResult)' },
  { status: 'todo', area: 'API itinéraire', title: 'Indiquer à l’utilisateur quand une alternative plus rapide a été retenue' },
  { status: 'todo', area: 'API itinéraire', title: 'Garder le lien Google Maps et la saisie manuelle en secours si l’API échoue' },
  { status: 'todo', area: 'Interface', title: 'Autocomplétion des adresses pendant la saisie' },

  // ---------- Plus tard ----------
  { status: 'later', area: 'Supabase', title: 'Créer le projet Supabase (de votre côté)' },
  { status: 'later', area: 'Supabase', title: 'Créer la table des courses (mêmes champs que l’enregistrement actuel)' },
  { status: 'later', area: 'Supabase', title: 'Règles d’accès (RLS) : qui peut lire et écrire les courses' },
  { status: 'later', area: 'Supabase', title: 'Remplacer le stockage de l’appareil par Supabase (storage.js)' },
  { status: 'later', area: 'Supabase', title: 'Connexion des chauffeurs (si plusieurs utilisateurs)' },
  { status: 'later', area: 'Supabase', title: 'Récupérer les courses déjà enregistrées sur l’appareil' },
  { status: 'later', area: 'Stats', title: 'Stats par période (jour, semaine, mois) et export CSV' },
  { status: 'later', area: 'Légal', title: 'Compléter les mentions légales (éditeur, hébergeur, SIRET…)' },
  { status: 'later', area: 'Légal', title: 'Rédiger les CGV définitives' },
  { status: 'later', area: 'Légal', title: 'Politique de confidentialité / RGPD une fois les données stockées en ligne' },
  { status: 'later', area: 'Déploiement', title: 'Publier le site (GitHub Pages, Netlify ou Vercel) et nom de domaine' },
];
