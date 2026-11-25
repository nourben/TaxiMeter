/**
 * Nombre d'événements par période, lu dans Supabase via la fonction SQL
 * `estimates_per_period(granularity, periods, kind)` (voir supabase/migrations/).
 * kind : 'price' (estimations de prix) ou 'distance' (calculs de distance).
 */
import { lastBuckets } from '../core/periods.js';
import { rpc } from './supabase.js';

/** @returns {Promise<Array<{ key, start, short, long, current, count }>>} */
export async function estimatesPerPeriod(granularity, kind = 'price', now = new Date()) {
  const buckets = lastBuckets(granularity, now);
  const rows = await rpc('estimates_per_period', { granularity, periods: buckets.length, kind });
  const byKey = new Map((rows ?? []).map((r) => [String(r.bucket).slice(0, 10), Number(r.count)]));
  return buckets.map((b) => ({ ...b, count: byKey.get(b.key) ?? 0 }));
}
