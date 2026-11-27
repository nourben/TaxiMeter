/**
 * Mise en avant des suggestions d'adresses proches.
 * Centre utilisé : pour la destination, le départ déjà choisi ; sinon le département mémorisé du chauffeur.
 * Les lieux à moins de NEARBY_KM du centre passent en tête, dans leur ordre de pertinence ; les autres suivent.
 */
import { DEPT_CENTERS } from '../config/dept-centers.js';

export const NEARBY_KM = 70;

/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const hasPos = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon);

/**
 * Centre des suggestions : { lat, lon, source } ou null.
 * @param {object} opts
 * @param {object|null} [opts.origin] départ choisi dans les suggestions (pour le champ destination)
 * @param {string|null} [opts.dept] code du département mémorisé
 */
export function suggestCenter({ origin = null, dept = null } = {}) {
  if (hasPos(origin)) return { lat: origin.lat, lon: origin.lon, source: 'départ' };
  const c = dept && DEPT_CENTERS[dept];
  return c ? { lat: c[0], lon: c[1], source: `département ${dept}` } : null;
}

/**
 * Trie les suggestions : d'abord celles à moins de `km` du centre, puis les autres.
 * Chaque groupe garde l'ordre reçu. Sans centre, la liste est rendue telle quelle.
 */
export function prioritizeNearby(items, center, km = NEARBY_KM) {
  if (!center) return items;
  const near = [];
  const far = [];
  for (const it of items) (hasPos(it) && distanceKm(center, it) <= km ? near : far).push(it);
  return [...near, ...far];
}
