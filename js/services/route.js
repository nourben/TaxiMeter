// Calcul de distance via la fonction serveur Supabase « route » (Google Routes API).
// La clé Google reste côté serveur ; le site n'envoie que la clé publique Supabase.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase.js';

export class RouteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not_found' | 'quota' | 'rate_limited' | 'network' | 'error'
  }
}

/**
 * @param {{ label:string, lat?:number, lon?:number }} origin
 * @param {{ label:string, lat?:number, lon?:number }} destination
 * @param {number|null} [departAt] heure de départ (ms) ; absente ou passée : départ immédiat
 * @returns {Promise<{ distanceKm:number, durationMin:number, departureTime:string|null, routes:Array }>}
 */
export async function computeRoute(origin, destination, departAt = null) {
  const departureTime = departAt && departAt > Date.now() + 60_000 ? new Date(departAt).toISOString() : undefined;
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/route`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, departureTime }),
    });
  } catch {
    throw new RouteError('network', 'Service de calcul injoignable.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  if (res.status === 422) throw new RouteError('not_found', data.message);
  if (res.status === 429) throw new RouteError(data.error === 'rate_limited' ? 'rate_limited' : 'quota', data.message);
  throw new RouteError('error', data.message || `Erreur ${res.status}`);
}
