/**
 * Zone approximative du chauffeur, estimée d'après son adresse IP (service freeipapi.com),
 * pour mettre en avant les adresses proches dans les suggestions (si aucun département n'est mémorisé).
 * Une seule demande par visite : le résultat (latitude / longitude arrondies, pays) est gardé
 * le temps de la visite (sessionStorage). L'adresse IP n'est enregistrée nulle part par le site.
 * Hors de France, ou si le service ne répond pas, aucune zone : suggestions dans l'ordre habituel.
 */
import { validZone } from '../core/nearby.js';

const ENDPOINT = 'https://free.freeipapi.com/api/json';
const KEY = 'taximeter.zone.v3';
const TIMEOUT_MS = 2500;

let pending = null;

// DEBUG TEMPORAIRE : infos brutes de la dernière estimation (ville, département…) pour vérifier la zone
const DEBUG_KEY = 'taximeter.zone.debug';
function setDebug(info) {
  try { sessionStorage.setItem(DEBUG_KEY, JSON.stringify(info)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('taximeter:zone-debug', { detail: info }));
}
export function getZoneDebug() {
  try { return JSON.parse(sessionStorage.getItem(DEBUG_KEY)); } catch { return null; }
}

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
    if (!res.ok) { setDebug({ error: `HTTP ${res.status}` }); return undefined; }
    const d = await res.json();
    setDebug({ city: d.cityName, postal: d.zipCode, region: d.regionName, country: d.countryCode, lat: d.latitude, lon: d.longitude });
    const zone = validZone({ lat: d.latitude, lon: d.longitude, country: d.countryCode });
    // Arrondi à ~1 km : seule une zone approximative est utile
    return zone && { lat: Math.round(zone.lat * 100) / 100, lon: Math.round(zone.lon * 100) / 100, country: zone.country };
  } catch (e) {
    setDebug({ error: e?.name === 'AbortError' ? 'délai dépassé' : 'requête bloquée' });
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Zone du chauffeur en France ({lat, lon, country}) ou null. */
export function getZone() {
  const cached = readCache();
  if (cached !== undefined) return Promise.resolve(validZone(cached));
  pending ??= fetchZone().then((zone) => {
    // Service injoignable : rien en cache, on réessaiera à la prochaine saisie
    if (zone === undefined) { pending = null; return null; }
    writeCache(zone);
    return zone;
  });
  return pending;
}
