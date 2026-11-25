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
  { status: 'done', area: 'Interface', title: 'Module Trajet : départ / destination, distance, temps de trajet estimé (affichage)' },
  { status: 'done', area: 'Interface', title: 'Autocomplétion des adresses et villes (IGN Géoplateforme, gratuit) ; l’adresse choisie fiabilise la détection Métropole' },
  { status: 'done', area: 'Interface', title: 'Jusqu’à 20 trajets dans une même course (lien « + Ajouter un trajet »)' },
  { status: 'done', area: 'Interface', title: 'Titre « Trajet » → « Trajets » et numérotation Trajet 1, 2, 3… dès le 2e trajet' },
  { status: 'done', area: 'Interface', title: 'Bouton « Relever la distance en km sur Google Maps » à droite du départ / destination' },
  { status: 'done', area: 'Interface', title: 'Trajets supplémentaires : boutons « Exclure du prix » / « Inclure dans le prix » (trajet grisé) et « Supprimer ce trajet »' },
  { status: 'done', area: 'Interface', title: 'Distance et options à largeur égale (Jour/Nuit, Métropole, tarif au km), chacune avec son info « i »' },
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
  { status: 'done', area: 'API itinéraire', title: 'Squelette de la couche d’abstraction fournisseurs (Google → TomTom)' },
  { status: 'done', area: 'Déploiement', title: 'Code poussé sur GitHub (branche main) et README avec le lien du site' },

  // ---------- À valider ----------
  { status: 'check', area: 'Tarifs', title: 'Exemples jour / nuit : le coefficient ne s’applique pas au même montant', note: 'Votre exemple de jour donne 13 + 19,20 × 1,25 = 37,00 € (coefficient sur la distance), alors que celui de nuit donne (13 + 19,20) × 1,5 = 48,30 € (coefficient sur le total). Le site reproduit les deux exemples tels quels ; un seul paramètre à changer si c’est une erreur.' },
  { status: 'check', area: 'Tarifs', title: 'Exemple Métropole à 47,20 € calculé sans tarif de jour ni de nuit', note: 'Ce montant correspond à 32,20 + 15 € sans coefficient jour ni nuit. Le site applique toujours jour OU nuit, donc Métropole + jour 20 km = 52,00 € et Métropole + nuit = 63,30 €.' },
  { status: 'validate', area: 'Tarifs', title: 'Zone Métropole : rayon de 11 km autour de Notre-Dame + codes postaux 75/92/93/94', note: 'Paris – Créteil ≈ 10,4 km à vol d’oiseau. Certaines communes de petite couronne dépassent 11 km mais sont incluses par leur code postal.' },
  { status: 'validate', area: 'Tarifs', title: 'Trajets supplémentaires : prise en charge de 13 € comptée à chaque trajet ?', note: 'Aujourd’hui chaque trajet est calculé comme une course complète (prise en charge et 4 km inclus compris), puis les montants sont additionnés.' },
  { status: 'validate', area: 'API itinéraire', title: 'Seuil « trajet long » : durée > distance × 1,3', note: '« Largement plus que 1 km = 1 min » traduit par un ratio de 1,3 (réglable).' },
  { status: 'validate', area: 'Tarifs', title: 'Règle des 50 km de jour : × 1,5 sur toute la distance ou seulement au-delà de 50 km ?', note: 'Confirmé : 50 km pile compte comme longue distance. Aujourd’hui tout le trajet passe à × 1,5 sur la distance ; la nuit n’est pas concernée.' },
  { status: 'validate', area: 'Interface', title: 'Valider l’interface (mobile et ordinateur, clair et sombre)' },

  // ---------- À faire (prochaine étape) ----------
  { status: 'todo', area: 'API itinéraire', title: 'Créer une clé Google Maps Platform (Routes API) avec plafond de budget' },
  { status: 'todo', area: 'API itinéraire', title: 'Créer une clé TomTom Routing' },
  { status: 'todo', area: 'API itinéraire', title: 'Fonction serveur qui appelle les API (clés non exposées dans le navigateur)' },
  { status: 'todo', area: 'API itinéraire', title: 'Fournisseur Google : itinéraires alternatifs + trafic à l’heure de départ' },
  { status: 'todo', area: 'API itinéraire', title: 'Fournisseur TomTom : routeType=shortest + alternatives + trafic' },
  { status: 'todo', area: 'API itinéraire', title: 'Compteur de quota mensuel Google → bascule automatique sur TomTom' },
  { status: 'todo', area: 'API itinéraire', title: 'Mode un seul fournisseur si un seul est configuré' },
  { status: 'todo', area: 'API itinéraire', title: 'Remplir distance et temps de trajet de chaque trajet automatiquement (déjà branché via setRouteResult)' },
  { status: 'todo', area: 'API itinéraire', title: 'Indiquer à l’utilisateur quand une alternative plus rapide a été retenue' },
  { status: 'todo', area: 'API itinéraire', title: 'Garder le lien Google Maps et la saisie manuelle en secours si l’API échoue' },
  { status: 'todo', area: 'API itinéraire', title: 'Activer le bouton « Calculer la distance » (grisé pour l’instant)' },
  { status: 'todo', area: 'API itinéraire', title: 'Signaler quand la ville / l’adresse de départ ou de destination n’est pas reconnue', note: 'Message sous le champ concerné, en proposant de corriger la saisie ou de passer par Google Maps.' },
  { status: 'check', area: 'Interface', title: 'Tester l’autocomplétion sur le site en ligne', note: 'Testée avec des réponses simulées : le service IGN n’est pas joignable depuis l’environnement de Claude. À vérifier sur GitHub Pages (adresse, rue, commune, choix au clavier et au doigt).' }

  // ---------- Plus tard ----------
  { status: 'later', area: 'Réflexion', title: 'Transformer le site en outil de suivi des courses de taxi ?', note: 'À réfléchir : les chauffeurs ne saisiront pas forcément toutes leurs courses ici.' },
  { status: 'later', area: 'Suivi', title: 'Date et heure de départ, enregistrement des courses, comptes utilisateurs', note: 'Retiré de l’interface pour l’instant ; le code de stockage local reste prêt.' },
  { status: 'later', area: 'Tarifs', title: 'Vérifier s’il faut proposer un tarif qui n’est ni jour ni nuit', note: 'Pas sûr que les utilisateurs en aient besoin : à voir avec eux dans un second temps (ex. l’exemple Métropole à 47,20 € sans coefficient).' },
  { status: 'later', area: 'Supabase', title: 'Créer le projet Supabase (de votre côté)' },
  { status: 'later', area: 'Supabase', title: 'Créer la table des courses (mêmes champs que l’enregistrement actuel)' },
  { status: 'later', area: 'Supabase', title: 'Règles d’accès (RLS) : qui peut lire et écrire les courses' },
  { status: 'later', area: 'Supabase', title: 'Remplacer le stockage de l’appareil par Supabase (storage.js)' },
  { status: 'later', area: 'Supabase', title: 'Connexion des chauffeurs (si plusieurs utilisateurs)' },
  { status: 'later', area: 'Stats', title: 'Stats par période (jour, semaine, mois) et export CSV' },
  { status: 'later', area: 'Légal', title: 'Compléter les mentions légales (éditeur, hébergeur, SIRET…)' },
  { status: 'later', area: 'Légal', title: 'Rédiger les CGV définitives' },
  { status: 'later', area: 'Légal', title: 'Politique de confidentialité / RGPD une fois les données stockées en ligne' },
  { status: 'todo', area: 'Déploiement', title: 'Activer GitHub Pages (Settings → Pages → branche main, dossier racine)', note: 'Réglage bloqué depuis Claude : à faire une fois à la main.' },
  { status: 'later', area: 'Déploiement', title: 'Nom de domaine personnalisé' },
];
