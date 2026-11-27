/**
 * Zone approximative du chauffeur, estimée d'après son adresse IP (service ipapi.co),
 * pour mettre en avant les adresses proches dans les suggestions.
 * Une seule demande par visite : le résultat (latitude / longitude arrondies, pays) est gardé
 * le temps de la visite (sessionStorage). L'adresse IP n'est enregistrée nulle part par le site.
 * Hors de France, ou si le service ne répond pas, aucune zone : suggestions dans l'ordre habituel.
 */
import { validZone } from '../core/nearby.js';

const ENDPOINT = 'https://ipapi.co/json/';
const KEY = 'taximeter.zone.v1';
const TIMEOUT_MS = 2500;

let pending = null;

function readCache() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeCache(zone) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(zone));
  } catch {
    /* stockage indisponible : on redemandera */
  }
}

async function fetchZone() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.error) return null;
    const zone = validZone({ lat: d.latitude, lon: d.longitude, country: d.country_code });
    // Arrondi à ~1 km : seule une zone approximative est utile
    return zone && { lat: Math.round(zone.lat * 100) / 100, lon: Math.round(zone.lon * 100) / 100, country: zone.country };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Zone du chauffeur en France ({lat, lon, country}) ou null. */
export function getZone() {
  const cached = readCache();
  if (cached !== undefined) return Promise.resolve(validZone(cached));
  pending ??= fetchZone().then((zone) => {
    writeCache(zone);
    return zone;
  });
  return pending;
}
