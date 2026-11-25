/**
 * Enregistre une estimation dans Supabase (table `estimates`).
 * Règle : un prix compte comme estimation quand il reste affiché 3 secondes
 * sans changement ; la même estimation n'est enregistrée qu'une fois.
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
    insert('estimates', row).catch(() => {
      lastSignature = null; // nouvel essai au prochain changement
    });
  }, STABLE_MS);
}
