// Calcul de distance via la fonction serveur Supabase « route » (Google Routes API).
// La clé Google reste côté serveur ; le site n'envoie que la clé publique Supabase.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase.js';

export class RouteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not_found' | 'quota' | 'network' | 'error'
  }
}

/**
 * @param {{ label:string, lat?:number, lon?:number }} origin
 * @param {{ label:string, lat?:number, lon?:number }} destination
 * @returns {Promise<{ distanceKm:number, durationMin:number, reason:string, shortest:{ distanceKm:number, durationMin:number } }>}
 */
export async function computeRoute(origin, destination) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/route`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
  } catch {
    throw new RouteError('network', 'Service de calcul injoignable.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  if (res.status === 422) throw new RouteError('not_found', data.message);
  if (res.status === 429) throw new RouteError('quota', data.message);
  throw new RouteError('error', data.message || `Erreur ${res.status}`);
}
