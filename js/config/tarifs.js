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

