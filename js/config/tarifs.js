// Paramètres tarifaires — toute la grille est ici, rien n'est codé en dur ailleurs.
// Modifier une valeur ici suffit à mettre à jour le calcul ET les infos contextuelles.

export const TARIFS = {
  currency: 'EUR',

  /** Forfait de prise en charge (€) */
  pickup: 13,

  /** Kilomètres inclus dans la prise en charge */
  includedKm: 4,

  /** Tarifs kilométriques proposés (€/km), selon le département de la licence — le premier est la valeur par défaut
   *  (convention-cadre : 1,07 € notamment en 77, 78, 91, 92, 93, 94, 95 ; 1,22 € à Paris) */
  ratesPerKm: [1.07, 1.2, 1.22],
  defaultRatePerKm: 1.07,

  /**
   * Périodes tarifaires. C'est soit jour, soit nuit (jamais les deux).
   * appliesTo :
   *  - 'distance' → le coefficient s'applique uniquement au coût kilométrique
   *  - 'total'    → le coefficient s'applique à (prise en charge + distance)
   * Ces choix reproduisent exactement les exemples fournis :
   *  jour 20 km : 13 + 19,20 × 1,25   = 37,00 €
   *  jour ≥ 50 km : coefficient × 1,5 au lieu de × 1,25
   *  nuit 20 km : (13 + 19,20) × 1,5  = 48,30 €
   */
  periods: {
    jour: {
      label: 'Jour',
      startHour: 8,
      multiplier: 1.25,
      appliesTo: 'distance',
      /** Longue distance : à partir de fromKm (inclus), le coefficient de jour passe à multiplier */
      longDistance: { fromKm: 50, multiplier: 1.5 },
    },
    nuit: { label: 'Nuit', startHour: 20, multiplier: 1.5, appliesTo: 'total' },
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

/** Règles de choix d'itinéraire (utilisées quand l'API sera branchée) */
export const ROUTING_RULES = {
  /** Trajet jugé « long » si durée (min) > distance (km) × ce ratio. 1 km = 1 min → 1 ; « largement » → 1,3 */
  slowRatio: 1.3,
  /** Détour maximum accepté pour un itinéraire alternatif (km) */
  maxDetourKm: 10,
};
