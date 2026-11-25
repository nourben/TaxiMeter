/**
 * Statistiques enregistrées dans Supabase (table `estimates`, colonne `kind`).
 * - 'price' : estimation de prix, comptée quand une distance est saisie et que le prix
 *   reste affiché 3 secondes sans changement (le temps de finir de taper) ; une fois par prix.
 * - 'distance' : demande de calcul de distance (bouton « Calculer la distance »).
 */
import { insert } from './supabase.js';

const STABLE_MS = 3000;
let timer;
let lastSignature = null;

/**
 * @param {{ signature:string, trips_count:number, total_eur:number, distance_km:number, distance_source:'manual'|'api' } | null} estimate
 *        null quand aucun prix n'est affiché
 */
export function scheduleEstimateLog(estimate) {
  clearTimeout(timer);
  if (!estimate || estimate.signature === lastSignature) return;
  timer = setTimeout(() => {
    const { signature, ...row } = estimate;
    lastSignature = signature;
    insert('estimates', { kind: 'price', ...row }).catch(() => {
      lastSignature = null; // nouvel essai au prochain changement
    });
  }, STABLE_MS);
}

/** Enregistre une demande de calcul de distance (clic sur « Calculer la distance »). */
export function logDistanceCalculation() {
  insert('estimates', { kind: 'distance', distance_source: 'api' }).catch(() => {});
}
