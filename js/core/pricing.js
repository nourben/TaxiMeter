import { TARIFS } from '../config/tarifs.js';

/** Arrondi au centime, sans erreurs de flottants (ex. 0,1 + 0,2). */
export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule le prix d'une course.
 * @param {object} p
 * @param {number} p.distanceKm   distance du trajet
 * @param {number} p.ratePerKm    tarif kilométrique (€/km)
 * @param {'jour'|'nuit'} p.period
 * @param {boolean} p.metropole   supplément Métropole
 * @returns {{ total:number, lines:Array<{label:string, detail:string, amount:number}>, billableKm:number }}
 */
export function computeFare({ distanceKm, ratePerKm, period, metropole }, cfg = TARIFS) {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) throw new RangeError('Distance invalide');
  const p = cfg.periods[period];
  if (!p) throw new RangeError(`Période inconnue : ${period}`);

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

  const long = p.longDistance && km >= p.longDistance.fromKm;
  const multiplier = long ? p.longDistance.multiplier : p.multiplier;
  const longNote = long ? ` (≥ ${p.longDistance.fromKm} km)` : '';

  let subtotal;
  if (p.appliesTo === 'distance') {
    const majoration = round2(distanceCost * (multiplier - 1));
    subtotal = cfg.pickup + distanceCost + majoration;
    lines.push({
      key: 'period',
      label: `Tarif ${p.label.toLowerCase()}`,
      detail: `× ${fmtNum(multiplier)} sur la distance${longNote}`,
      amount: majoration,
    });
  } else {
    const base = cfg.pickup + distanceCost;
    const majoration = round2(base * (multiplier - 1));
    subtotal = base + majoration;
    lines.push({
      key: 'period',
      label: `Tarif ${p.label.toLowerCase()}`,
      detail: `× ${fmtNum(multiplier)} sur le total${longNote}`,
      amount: majoration,
    });
  }

  if (metropole) {
    lines.push({ key: 'metropole', label: 'Métropole', detail: 'supplément', amount: cfg.metropole.supplement });
    subtotal += cfg.metropole.supplement;
  }

  return { total: round2(subtotal), lines, billableKm };
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
