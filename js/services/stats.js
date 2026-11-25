/**
 * Nombre d'estimations par période.
 *
 * Aujourd'hui : données FICTIVES (pour valider l'affichage).
 * Avec Supabase : appel de la fonction SQL `estimates_per_period(granularity, periods)`
 * (voir supabase/migrations/0001_init.sql), qui renvoie [{ bucket: 'AAAA-MM-JJ', count }].
 */
import { lastBuckets } from '../core/periods.js';

export const USING_DEMO_DATA = true;

/** Générateur pseudo-aléatoire déterministe : mêmes chiffres à chaque visite. */
function seeded(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const DEMO_SCALE = { day: [4, 22], week: [40, 120], month: [180, 420], year: [900, 4200] };

function demoCount(key, granularity) {
  const [min, max] = DEMO_SCALE[granularity];
  return Math.round(min + seeded(`${granularity}:${key}`) * (max - min));
}

/** @returns {Promise<Array<{ key, start, short, long, current, count }>>} */
export async function estimatesPerPeriod(granularity, now = new Date()) {
  const buckets = lastBuckets(granularity, now);
  // Plus tard :
  // const { data } = await supabase.rpc('estimates_per_period', { granularity, periods: buckets.length });
  // const byKey = new Map(data.map((r) => [r.bucket, r.count]));
  return buckets.map((b) => ({ ...b, count: demoCount(b.key, granularity) }));
}
