// Paramètres tarifaires — toute la grille est ici, rien n'est codé en dur ailleurs.
// Modifier une valeur ici suffit à mettre à jour le calcul ET les infos contextuelles.

export const TARIFS = {
  currency: 'EUR',

  /** Forfait de prise en charge (€) */
  pickup: 13,

  /** Kilomètres inclus dans la prise en charge */
  includedKm: 4,

  /** Tarifs kilométriques proposés (€/km) — le premier est la valeur par défaut */
  ratesPerKm: [1.2, 1.22, 1.07],
  defaultRatePerKm: 1.2,

  /**
   * Périodes tarifaires. C'est soit jour, soit nuit (jamais les deux).
   * appliesTo :
   *  - 'distance' → le coefficient s'applique uniquement au coût kilométrique
   *  - 'total'    → le coefficient s'applique à (prise en charge + distance)
   * Ces choix reproduisent exactement les exemples fournis :
   *  jour 20 km : 13 + 19,20 × 1,25   = 37,00 €
   *  nuit 20 km : (13 + 19,20) × 1,5  = 48,30 €
   */
  periods: {
    jour: { label: 'Jour', startHour: 8, multiplier: 1.25, appliesTo: 'distance' },
    nuit: { label: 'Nuit', startHour: 20, multiplier: 1.5, appliesTo: 'total' },
  },

  /** Supplément Métropole (cumulable avec jour ou nuit) */
  metropole: {
    supplement: 15,
    /** Centre de référence : Paris (parvis Notre-Dame) */
    center: { lat: 48.853, lon: 2.3499, label: 'Paris (Notre-Dame)' },
    /** Rayon à vol d'oiseau ≈ distance Paris – Créteil */
    radiusKm: 11,
    /** Départements de la petite couronne (+ Paris), utilisés via le code postal */
    departments: ['75', '92', '93', '94'],
  },
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
