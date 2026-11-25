import { TARIFS } from '../config/tarifs.js';

/** Distance à vol d'oiseau (km) entre deux points GPS. */
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Extrait un code postal français (5 chiffres) d'une saisie libre. */
export function extractPostcode(text) {
  const m = String(text || '').match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

/**
 * Indique si un lieu est en zone Métropole.
 * @param {{ text?:string, postcode?:string, lat?:number, lon?:number }} place
 * @returns {{ inZone:boolean, reason:string|null }}
 */
export function checkMetropole(place, cfg = TARIFS) {
  const m = cfg.metropole;
  if (!place) return { inZone: false, reason: null };

  if (Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    const d = haversineKm(m.center, { lat: place.lat, lon: place.lon });
    if (d <= m.radiusKm) {
      return { inZone: true, reason: `à ${d.toFixed(1).replace('.', ',')} km du centre de Paris` };
    }
  }

  const postcode = place.postcode || extractPostcode(place.text);
  if (postcode && m.departments.includes(postcode.slice(0, 2))) {
    return { inZone: true, reason: `code postal ${postcode}` };
  }

  if (/^\s*paris\b/i.test(place.text || '') || /\bparis\s*$/i.test(place.text || '')) {
    return { inZone: true, reason: 'Paris' };
  }

  return { inZone: false, reason: null };
}
