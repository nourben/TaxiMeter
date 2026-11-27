/**
 * Mise en avant des suggestions d'adresses proches du chauffeur.
 * Les lieux à moins de NEARBY_KM de sa zone (estimée d'après son adresse IP) passent en tête,
 * dans leur ordre de pertinence ; les autres suivent, dans le même ordre.
 */
export const NEARBY_KM = 70;

// Codes pays renvoyés par la géolocalisation IP pour la France (métropole et outre-mer)
const FRANCE_CODES = new Set(['FR', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'NC', 'PF', 'WF']);

export function isFrance(countryCode) {
  return FRANCE_CODES.has(String(countryCode ?? '').toUpperCase());
}

/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Zone utilisable : une position en France, sinon null (pas de mise en avant). */
export function validZone(z) {
  if (!z || !isFrance(z.country)) return null;
  const lat = Number(z.lat);
  const lon = Number(z.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, country: String(z.country).toUpperCase() };
}

/**
 * Trie les suggestions : d'abord celles à moins de `km` de la zone, puis les autres.
 * Chaque groupe garde l'ordre reçu. Sans zone, la liste est rendue telle quelle.
 */
export function prioritizeNearby(items, zone, km = NEARBY_KM) {
  if (!zone) return items;
  const near = [];
  const far = [];
  for (const it of items) {
    const ok = Number.isFinite(it?.lat) && Number.isFinite(it?.lon) && distanceKm(zone, it) <= km;
    (ok ? near : far).push(it);
  }
  return [...near, ...far];
}
