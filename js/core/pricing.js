import { TARIFS, SHARED_TRANSPORT } from '../config/tarifs.js';

/** Arrondi au centime, sans erreurs de flottants (ex. 0,1 + 0,2). */
export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule le prix d'un trajet.
 * @param {object} p
 * @param {number}  p.distanceKm  distance du trajet
 * @param {number}  p.ratePerKm   tarif kilométrique (€/km)
 * @param {boolean} p.night       majoration nuit / week-end / férié
 * @param {boolean} p.hospital    majoration hospitalisation (aller ou retour à vide)
 * @param {boolean} p.metropole   forfait grande ville (Métropole)
 * @returns {{ total:number, lines:Array<{key:string, label:string, detail:string, amount:number}>, billableKm:number }}
 */
export function computeFare({ distanceKm, ratePerKm, night = false, hospital = false, metropole = false }, cfg = TARIFS) {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) throw new RangeError('Distance invalide');
  const { night: N, hospital: H } = cfg.majorations;

  const billableKm = Math.max(0, round2(km - cfg.includedKm));
  const distanceCost = round2(billableKm * ratePerKm);

  const lines = [
    { key: 'pickup', label: 'Prise en charge', detail: `${fmtKm(cfg.includedKm)} inclus`, amount: cfg.pickup },
    {
      key: 'distance',
      label: 'Distance',
      detail: `(${fmtKm(km)} − ${cfg.includedKm}) × ${fmtNum(ratePerKm)} €`,
      amount: distanceCost,
    },
  ];
  let socle = cfg.pickup + distanceCost;
  if (metropole) {
    lines.push({ key: 'metropole', label: 'Métropole', detail: 'forfait grande ville', amount: cfg.metropole.supplement });
    socle += cfg.metropole.supplement;
  }

  let total = socle;
  if (hospital) {
    const long = km >= H.longFromKm;
    const rate = long ? H.longRate : H.rate;
    const amount = round2(distanceCost * rate);
    lines.push({
      key: 'hospital',
      label: 'Hospitalisation',
      detail: `+ ${pctNum(rate)} sur la distance${long ? ` (≥ ${H.longFromKm} km)` : ''}`,
      amount,
    });
    total += amount;
  }
  if (night) {
    // La nuit majore tout le montant, y compris la majoration hospitalisation (qui fait partie du tarif kilométrique)
    const amount = round2(total * N.rate);
    lines.push({ key: 'night', label: 'Nuit / week-end / férié', detail: `+ ${pctNum(N.rate)} sur le total`, amount });
    total += amount;
  }

  return { total: round2(total), lines, billableKm };
}

function pctNum(rate) {
  return `${Math.round(rate * 100)} %`;
}
function fmtNum(n) {
  return String(n).replace('.', ',');
}
function fmtKm(n) {
  return `${fmtNum(round2(n))} km`;
}

/** Format monétaire français : 37,00 € */
export function formatEuro(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

/** Taux d'abattement « transport partagé » selon le nombre de patients (0 si un seul). */
export function sharedRate(patients, cfg = SHARED_TRANSPORT) {
  if (patients < 2) return 0;
  const keys = Object.keys(cfg.rates).map(Number).sort((a, b) => a - b);
  const key = keys.filter((k) => k <= patients).pop();
  return cfg.rates[key];
}

/**
 * Applique un abattement (ex. 0.23) au prix d'un trajet : ajoute une ligne négative et recalcule le total.
 * @returns {{ total:number, lines:Array, billableKm:number }}
 */
export function applyDiscount(fare, rate, label, detail) {
  if (!rate) return fare;
  const amount = -round2(fare.total * rate);
  return {
    ...fare,
    lines: [...fare.lines, { key: 'discount', label, detail, amount }],
    total: round2(fare.total + amount),
  };
}
