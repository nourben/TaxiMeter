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

/**
 * Visiteurs par période (fonction SQL `visits_per_period`).
 * count = visiteurs distincts, returning = déjà venus avant la période, views = pages affichées.
 */
export async function visitsPerPeriod(granularity, now = new Date()) {
  const buckets = lastBuckets(granularity, now);
  const rows = await rpc('visits_per_period', { granularity, periods: buckets.length });
  const byKey = new Map((rows ?? []).map((r) => [String(r.bucket).slice(0, 10), r]));
  return buckets.map((b) => {
    const r = byKey.get(b.key);
    return { ...b, count: Number(r?.visitors ?? 0), returning: Number(r?.returning_visitors ?? 0), views: Number(r?.views ?? 0) };
  });
}

/** Visiteurs des 30 derniers jours selon le nombre de jours de visite : [{ bracket, visitors }]. */
export async function visitorFrequency() {
  const rows = await rpc('visitor_frequency');
  return (rows ?? []).map((r) => ({ bracket: r.bracket, visitors: Number(r.visitors) }));
}
