import { ROUTING_RULES } from '../config/tarifs.js';

/**
 * Choisit l'itinéraire à retenir parmi ceux renvoyés par l'API (indépendant du fournisseur).
 *
 * Règle :
 * 1. On part de l'itinéraire le plus court en km.
 * 2. S'il est « long » (durée > distance × slowRatio), on cherche une alternative
 *    plus rapide qui fait au plus maxDetourKm de plus.
 * 3. Sans alternative valable, on garde le plus court.
 *
 * @param {Array<{distanceKm:number, durationMin:number}>} routes
 * @returns {{ route:object, shortest:object, reason:'shortest'|'faster-alternative'|'no-alternative' } | null}
 */
export function selectRoute(routes, rules = ROUTING_RULES) {
  const valid = (routes || []).filter(
    (r) => Number.isFinite(r?.distanceKm) && Number.isFinite(r?.durationMin) && r.distanceKm >= 0,
  );
  if (valid.length === 0) return null;

  const shortest = valid.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
  const isSlow = shortest.durationMin > shortest.distanceKm * rules.slowRatio;
  if (!isSlow) return { route: shortest, shortest, reason: 'shortest' };

  const candidates = valid.filter(
    (r) =>
      r !== shortest &&
      r.distanceKm <= shortest.distanceKm + rules.maxDetourKm &&
      r.durationMin < shortest.durationMin,
  );
  if (candidates.length === 0) return { route: shortest, shortest, reason: 'no-alternative' };

  const fastest = candidates.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));
  return { route: fastest, shortest, reason: 'faster-alternative' };
}
