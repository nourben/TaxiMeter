// Suivi du projet — modifier ce fichier pour mettre à jour la page « Tâches ».
// status : 'check' (erreur à vérifier) · 'done' (fait) · 'validate' (à valider) · 'todo' (à faire, prochaine étape) · 'later' (plus tard)

export const STATUSES = [
  { key: 'check', label: 'Erreurs à vérifier', description: 'Incohérences relevées dans les exemples de tarifs fournis', open: true },
  { key: 'validate', label: 'À valider', description: 'Points à confirmer avant d’aller plus loin', open: true },
  { key: 'todo', label: 'À faire', description: 'Une fois l’interface validée', open: true },
  { key: 'later', label: 'Plus tard', description: 'Dépend d’un compte ou d’une décision à venir', open: false },
  { key: 'done', label: 'Fait', description: 'Livré', open: false },
];

export const TASKS = [
  // ---------- Fait ----------
  { status: 'done', area: 'Interface', title: 'Module Trajet : départ / destination et distance' },
  { status: 'done', area: 'Interface', title: 'Autocomplétion des adresses et villes (IGN Géoplateforme, gratuit) ; l’adresse choisie fiabilise la détection Métropole' },
  { status: 'done', area: 'Interface', title: 'Autocomplétion : points d’intérêt IGN en plus des adresses (hôpitaux, cliniques, gares, mairies…) — vérifiée en ligne' },
  { status: 'done', area: 'Interface', title: 'Jusqu’à 20 trajets dans une même course (lien « + Ajouter un trajet »)' },
  { status: 'done', area: 'Interface', title: 'Titre « Trajet » → « Trajets » et numérotation Trajet 1, 2, 3… dès le 2e trajet' },
  { status: 'done', area: 'Interface', title: 'Bouton « Relever la distance en km sur Google Maps » à droite du départ / destination' },
  { status: 'done', area: 'Interface', title: 'Trajets supplémentaires : boutons « Exclure du prix » / « Inclure dans le prix » (trajet grisé) et « Supprimer ce trajet »' },
  { status: 'done', area: 'Interface', title: 'Distance et options à largeur égale ; infos « i » sur Jour/Nuit et Métropole avec l’état auto / manuel' },
  { status: 'done', area: 'Interface', title: 'Bouton « Même km que le trajet 1 » sur les trajets suivants' },
  { status: 'done', area: 'Interface', title: 'Bouton ↺ pour revenir à la distance calculée (prêt pour l’API)', note: 'Apparaît seulement quand une valeur API existe et a été modifiée.' },
  { status: 'done', area: 'Tarifs', title: 'Options par trajet : jour / nuit, Métropole, tarif au km' },
  { status: 'done', area: 'Tarifs', title: 'Horaire auto selon l’heure actuelle, modifiable (trajet du soir ou du lendemain)', note: 'Corrige le bug où le choix manuel était annulé.' },
  { status: 'done', area: 'Tarifs', title: 'Métropole détectée automatiquement (départ ou destination), modifiable' },
  { status: 'done', area: 'Tarifs', title: 'Tarif au km 1,20 € par défaut ; 1,22 € et 1,07 € mis en couleur quand ils sont choisis' },
  { status: 'done', area: 'Tarifs', title: 'Module Prix : total de la course + prix de chaque trajet avec son détail' },
  { status: 'done', area: 'Tarifs', title: 'Tests automatiques du calcul (exemples 37,00 € / 48,30 € vérifiés)' },
  { status: 'done', area: 'Tarifs', title: 'Tarif jour à × 1,5 à partir de 50 km (au lieu de × 1,25)' },
  { status: 'done', area: 'Interface', title: 'Infos contextuelles « i » (horaires, Métropole, km inclus…)' },
  { status: 'done', area: 'Interface', title: 'Thème clair (défaut) / sombre, mémorisé sur l’appareil' },
  { status: 'done', area: 'Interface', title: 'Interface resserrée (moins de place sur mobile)' },
  { status: 'done', area: 'Interface', title: 'Pied de page : statistiques, CGV, mentions légales, tâches' },
  { status: 'done', area: 'API itinéraire', title: 'Règle de choix d’itinéraire codée et testée (plus court, ou alternative ≤ +10 km si trajet long)' },
  { status: 'done', area: 'Déploiement', title: 'Code poussé sur GitHub (branche main) et README avec le lien du site' },
  { status: 'done', area: 'Stats', title: 'Page Statistiques : diagramme en barres jours / semaines / mois / années, branché sur Supabase' },
  { status: 'done', area: 'Supabase', title: 'Projet Supabase relié au site ; estimations enregistrées anonymement quand un prix reste affiché 3 s sans changer (règle validée)' },
  { status: 'done', area: 'Stats', title: 'Calculs de distance comptés à part (clic sur « Calculer la distance »), 2e module replié sur la page Statistiques' },
  { status: 'done', area: 'Stats', title: 'Statistiques vérifiées en ligne avec Supabase' },
  { status: 'done', area: 'Supabase', title: 'Schéma SQL prêt et testé : estimations, statistiques par période, compteur d’appels API' },

  // ---------- À valider ----------
  { status: 'check', area: 'Tarifs', title: 'Exemples jour / nuit : le coefficient ne s’applique pas au même montant', note: 'Votre exemple de jour donne 13 + 19,20 × 1,25 = 37,00 € (coefficient sur la distance), alors que celui de nuit donne (13 + 19,20) × 1,5 = 48,30 € (coefficient sur le total). Le site reproduit les deux exemples tels quels ; un seul paramètre à changer si c’est une erreur.' },
  { status: 'check', area: 'Tarifs', title: 'Exemple Métropole à 47,20 € calculé sans tarif de jour ni de nuit', note: 'Ce montant correspond à 32,20 + 15 € sans coefficient jour ni nuit. Le site applique toujours jour OU nuit, donc Métropole + jour 20 km = 52,00 € et Métropole + nuit = 63,30 €.' },
  { status: 'validate', area: 'Tarifs', title: 'Zone Métropole : rayon de 11 km autour de Notre-Dame + codes postaux 75/92/93/94', note: 'Paris – Créteil ≈ 10,4 km à vol d’oiseau. Certaines communes de petite couronne dépassent 11 km mais sont incluses par leur code postal.' },
  { status: 'validate', area: 'Tarifs', title: 'Trajets supplémentaires : prise en charge de 13 € comptée à chaque trajet ?', note: 'Aujourd’hui chaque trajet est calculé comme une course complète (prise en charge et 4 km inclus compris), puis les montants sont additionnés.' },
  { status: 'validate', area: 'API itinéraire', title: 'Seuil « trajet long » : durée > distance × 1,3', note: '« Largement plus que 1 km = 1 min » traduit par un ratio de 1,3 (réglable).' },
  { status: 'validate', area: 'Tarifs', title: 'Règle des 50 km de jour : × 1,5 sur toute la distance ou seulement au-delà de 50 km ?', note: 'Confirmé : 50 km pile compte comme longue distance. Aujourd’hui tout le trajet passe à × 1,5 sur la distance ; la nuit n’est pas concernée.' },
  { status: 'validate', area: 'Interface', title: 'Valider l’interface (mobile et ordinateur, clair et sombre)' },

  // ---------- À faire (prochaine étape) ----------
  { status: 'done', area: 'API itinéraire', title: 'Clé Google Routes API créée et rangée dans les secrets Supabase' },
  { status: 'done', area: 'API itinéraire', title: 'Fonction serveur « route » : Google Routes (trafic + alternatives), règle du plus court / alternative ≤ +10 km' },
  { status: 'done', area: 'API itinéraire', title: 'Garde-fou des dépenses côté Google : quotas de la console et carte bancaire virtuelle à montant limité' },
  { status: 'done', area: 'API itinéraire', title: 'Bouton « Calculer la distance » actif : remplit la distance (modifiable, ↺), indique si un itinéraire plus rapide est retenu' },
  { status: 'done', area: 'API itinéraire', title: 'Message si départ / destination non reconnu, quota atteint ou erreur, avec repli sur Google Maps' },
  { status: 'todo', area: 'API itinéraire', title: 'Afficher le temps de trajet estimé renvoyé par l’API', note: 'Retiré de l’interface en attendant ; la valeur est déjà prévue dans setRouteResult.' },
  { status: 'later', area: 'API itinéraire', title: 'URGENT à la fin de l’essai Google (≈ fin février 2027) : plafonner Routes API (console Google → APIs et services → Routes API → Quotas)', note: 'Bloqué pendant l’essai gratuit de 3 mois. « Directions - ComputeRoutes per request quota per day » : Illimité → 150 (150 × 31 jours ≈ 4 650 calculs, sous les 5 000 gratuits par mois). « Directions - ComputeRoutes per request quota per minute » : 3 000 → 30 (évite qu’un abus ou un bug épuise le quota du jour en quelques secondes). « DistanceMatrix - ComputeRouteMatrix per-element quota per day » : Illimité → 0 (le site ne s’en sert pas). Rappel par e-mail programmé du 20 au 26 février 2027.' },
  { status: 'check', area: 'API itinéraire', title: 'Déployer la fonction « route » dans Supabase et désactiver « Verify JWT » (étapes 8 et 9 de docs/SUPABASE.md)', note: 'Redéployer après chaque modification de supabase/functions/route/index.ts. Puis tester « Calculer la distance » sur le site en ligne.' },

  // ---------- Plus tard ----------
  { status: 'later', area: 'Réflexion', title: 'Transformer le site en outil de suivi des courses de taxi ?', note: 'À réfléchir : les chauffeurs ne saisiront pas forcément toutes leurs courses ici.' },
  { status: 'later', area: 'Suivi', title: 'Date et heure de départ, enregistrement des courses, comptes utilisateurs', note: 'Retiré de l’interface pour l’instant ; le code de stockage local reste prêt.' },
  { status: 'later', area: 'Tarifs', title: 'Vérifier s’il faut proposer un tarif qui n’est ni jour ni nuit', note: 'Pas sûr que les utilisateurs en aient besoin : à voir avec eux dans un second temps (ex. l’exemple Métropole à 47,20 € sans coefficient).' },
  { status: 'later', area: 'Supabase', title: 'Règles d’accès (RLS) : qui peut lire et écrire les courses' },
  { status: 'later', area: 'Supabase', title: 'Remplacer le stockage de l’appareil par Supabase (storage.js)' },
  { status: 'later', area: 'Supabase', title: 'Connexion des chauffeurs (si plusieurs utilisateurs)' },
  { status: 'later', area: 'Stats', title: 'Export CSV des statistiques' },
  { status: 'later', area: 'Légal', title: 'Compléter les mentions légales (éditeur, hébergeur, SIRET…)' },
  { status: 'later', area: 'Légal', title: 'Rédiger les CGV définitives' },
  { status: 'later', area: 'Légal', title: 'Politique de confidentialité / RGPD une fois les données stockées en ligne' },
  { status: 'later', area: 'Déploiement', title: 'Nom de domaine personnalisé' },
];
