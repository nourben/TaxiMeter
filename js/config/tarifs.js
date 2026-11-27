// Paramètres tarifaires — toute la grille est ici, rien n'est codé en dur ailleurs.
// Modifier une valeur ici suffit à mettre à jour le calcul ET les infos contextuelles.

export const TARIFS = {
  currency: 'EUR',

  /** Forfait de prise en charge (€) */
  pickup: 13,

  /** Kilomètres inclus dans la prise en charge */
  includedKm: 4,

  /** Tarifs kilométriques proposés (€/km), selon le département de la licence — le premier est la valeur par défaut
   *  (1,07 € : 77, 78, 91 à 95… ; 1,22 € : Paris…) */
  ratesPerKm: [1.07, 1.22], // boutons rapides ; les autres tarifs sont dans la liste « Autres »
  defaultRatePerKm: 1.07,

  /**
   * Majorations de la convention-cadre taxis (JO du 8 août 2025), indépendantes et cumulables :
   * - nuit / week-end / férié : + 50 % sur l'ensemble du montant (prise en charge, grande ville, kilomètres
   *   y compris leur majoration hospitalisation)
   *   Nuit = de 20 h à 8 h ; week-end = du samedi 12 h au dimanche minuit ; jours fériés.
   * - hospitalisation avec aller ou retour à vide : + 25 % sur le tarif kilométrique, + 50 % à partir de 50 km.
   * Exemples (20 km à 1,20 €) : hospitalisation 37,00 € · nuit 48,30 € · grande ville seule 47,20 €.
   * Exemples (30 km à 1,07 €) : nuit 61,23 € · hospitalisation 47,78 € · hospitalisation + nuit 71,67 €.
   */
  majorations: {
    night: { label: 'Nuit / week-end / férié', rate: 0.5, startHour: 20, endHour: 8, saturdayFromHour: 12 },
    hospital: { label: 'Hospitalisation (retour à vide)', rate: 0.25, longRate: 0.5, longFromKm: 50 },
  },

  /**
   * Supplément Métropole = forfait « grande ville » de la convention-cadre taxis :
   * prise en charge et/ou dépose à Paris, dans une commune du 92, 93 ou 94, ou dans une grande ville listée.
   */
  metropole: {
    supplement: 15,
    departments: ['75', '92', '93', '94'],
    cities: ['Paris', 'Marseille', 'Nice', 'Toulouse', 'Lyon', 'Strasbourg', 'Montpellier', 'Rennes', 'Bordeaux', 'Lille', 'Grenoble', 'Nantes'],
  },
};

/**
 * Transport partagé (patients transportés ensemble, convention-cadre taxis CPAM, JO du 8 août 2025) :
 * abattement sur la totalité de chaque trajet (majorations et Métropole comprises).
 * Un patient seul dans le véhicule sur au moins soloLong.minKm a un abattement réduit (5 %).
 */
export const SHARED_TRANSPORT = {
  rates: { 2: 0.23, 3: 0.35, 4: 0.37 }, // 4 patients ou plus : 37 %
  soloLong: { minKm: 30, rate: 0.05 },
};

/** Nombre maximum de trajets dans une même course */
export const MAX_TRIPS = 20;


/**
 * Tarif kilométrique par département de la licence (convention-cadre taxis, JO du 8 août 2025, Annexe 2,
 * applicable au 1er novembre 2025) : [numéro, nom, €/km].
 */
export const DEPARTMENT_RATES = [
  ['01', 'Ain', 1.13],
  ['02', 'Aisne', 1.20],
  ['03', 'Allier', 1.19],
  ['04', 'Alpes-de-Haute-Provence', 1.14],
  ['05', 'Hautes-Alpes', 1.18],
  ['06', 'Alpes-Maritimes', 1.27],
  ['07', 'Ardèche', 1.17],
  ['08', 'Ardennes', 1.17],
  ['09', 'Ariège', 1.15],
  ['10', 'Aube', 1.13],
  ['11', 'Aude', 1.08],
  ['12', 'Aveyron', 1.16],
  ['13', 'Bouches-du-Rhône', 1.10],
  ['14', 'Calvados', 1.07],
  ['15', 'Cantal', 1.13],
  ['16', 'Charente', 1.12],
  ['17', 'Charente-Maritime', 1.10],
  ['18', 'Cher', 1.26],
  ['19', 'Corrèze', 1.16],
  ['2A', 'Corse-du-Sud', 1.27],
  ['2B', 'Haute-Corse', 1.27],
  ['21', 'Côte-d’Or', 1.12],
  ['22', 'Côtes-d’Armor', 1.13],
  ['23', 'Creuse', 1.18],
  ['24', 'Dordogne', 1.11],
  ['25', 'Doubs', 1.08],
  ['26', 'Drôme', 1.16],
  ['27', 'Eure', 1.21],
  ['28', 'Eure-et-Loir', 1.19],
  ['29', 'Finistère', 1.07],
  ['30', 'Gard', 1.08],
  ['31', 'Haute-Garonne', 1.10],
  ['32', 'Gers', 1.19],
  ['33', 'Gironde', 1.07],
  ['34', 'Hérault', 1.07],
  ['35', 'Ille-et-Vilaine', 1.07],
  ['36', 'Indre', 1.25],
  ['37', 'Indre-et-Loire', 1.18],
  ['38', 'Isère', 1.22],
  ['39', 'Jura', 1.11],
  ['40', 'Landes', 1.13],
  ['41', 'Loir-et-Cher', 1.13],
  ['42', 'Loire', 1.08],
  ['43', 'Haute-Loire', 1.24],
  ['44', 'Loire-Atlantique', 1.08],
  ['45', 'Loiret', 1.07],
  ['46', 'Lot', 1.13],
  ['47', 'Lot-et-Garonne', 1.11],
  ['48', 'Lozère', 1.25],
  ['49', 'Maine-et-Loire', 1.08],
  ['50', 'Manche', 1.16],
  ['51', 'Marne', 1.12],
  ['52', 'Haute-Marne', 1.26],
  ['53', 'Mayenne', 1.09],
  ['54', 'Meurthe-et-Moselle', 1.09],
  ['55', 'Meuse', 1.12],
  ['56', 'Morbihan', 1.07],
  ['57', 'Moselle', 1.14],
  ['58', 'Nièvre', 1.27],
  ['59', 'Nord', 1.20],
  ['60', 'Oise', 1.20],
  ['61', 'Orne', 1.17],
  ['62', 'Pas-de-Calais', 1.20],
  ['63', 'Puy-de-Dôme', 1.08],
  ['64', 'Pyrénées-Atlantiques', 1.14],
  ['65', 'Hautes-Pyrénées', 1.07],
  ['66', 'Pyrénées-Orientales', 1.18],
  ['67', 'Bas-Rhin', 1.07],
  ['68', 'Haut-Rhin', 1.07],
  ['69', 'Rhône', 1.07],
  ['70', 'Haute-Saône', 1.08],
  ['71', 'Saône-et-Loire', 1.10],
  ['72', 'Sarthe', 1.07],
  ['73', 'Savoie', 1.15],
  ['74', 'Haute-Savoie', 1.22],
  ['75', 'Paris', 1.22],
  ['76', 'Seine-Maritime', 1.18],
  ['77', 'Seine-et-Marne', 1.07],
  ['78', 'Yvelines', 1.07],
  ['79', 'Deux-Sèvres', 1.08],
  ['80', 'Somme', 1.15],
  ['81', 'Tarn', 1.07],
  ['82', 'Tarn-et-Garonne', 1.07],
  ['83', 'Var', 1.16],
  ['84', 'Vaucluse', 1.20],
  ['85', 'Vendée', 1.07],
  ['86', 'Vienne', 1.11],
  ['87', 'Haute-Vienne', 1.10],
  ['88', 'Vosges', 1.10],
  ['89', 'Yonne', 1.11],
  ['90', 'Territoire de Belfort', 1.08],
  ['91', 'Essonne', 1.07],
  ['92', 'Hauts-de-Seine', 1.07],
  ['93', 'Seine-Saint-Denis', 1.07],
  ['94', 'Val-de-Marne', 1.07],
  ['95', 'Val-d’Oise', 1.07],
  ['971', 'Guadeloupe', 1.07],
  ['972', 'Martinique', 1.20],
  ['973', 'Guyane', 1.10],
  ['974', 'La Réunion', 1.22],
  ['976', 'Mayotte', 1.10],
];

/** Tous les tarifs kilométriques possibles, du plus bas au plus haut. */
export const ALL_RATES = [...new Set(DEPARTMENT_RATES.map(([, , r]) => r))].sort((a, b) => a - b);
