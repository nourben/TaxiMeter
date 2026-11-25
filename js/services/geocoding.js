/**
 * Géocodage et autocomplétion (adresses + points d'intérêt) via le service public gratuit de l'IGN
 * (Géoplateforme, ex-API Adresse / BAN). Sans clé ni compte, France uniquement.
 * En cas d'échec (hors ligne, adresse étrangère…), on retombe sur la saisie libre.
 */
const ENDPOINT = 'https://data.geopf.fr/geocodage/search';

const TYPE_LABEL = {
  housenumber: 'Adresse',
  street: 'Rue',
  locality: 'Lieu-dit',
  municipality: 'Commune',
  poi: 'Lieu',
};

function toPlace(f) {
  const p = f.properties ?? {};
  const [lon, lat] = f.geometry?.coordinates ?? [];
  return {
    label: p.label,
    postcode: p.postcode ?? null,
    city: p.city ?? null,
    type: p.type ?? null,
    lat,
    lon,
    // ex. « Commune · 94, Val-de-Marne, Île-de-France »
    detail: [TYPE_LABEL[p.type], p.context].filter(Boolean).join(' · '),
  };
}

async function query(params, signal) {
  try {
    const res = await fetch(`${ENDPOINT}?${new URLSearchParams(params)}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.features) ? data.features : null;
  } catch {
    return null; // requête annulée ou service indisponible
  }
}

/** Meilleur résultat pour une saisie libre (détection Métropole). */
export async function geocode(text, { signal } = {}) {
  const q = String(text || '').trim();
  if (q.length < 3) return null;
  const features = await query({ q, limit: '1' }, signal);
  const f = features?.[0];
  if (!f || (f.properties?.score ?? 0) < 0.4) return null;
  return toPlace(f);
}

/** Point d'intérêt IGN (hôpital, clinique, gare, mairie…) au même format qu'une adresse. */
function poiToPlace(f) {
  const p = f.properties ?? {};
  const [lon, lat] = f.geometry?.coordinates ?? [];
  const first = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
  const name = p.toponym || first(p.name);
  const city = first(p.city);
  const postcode = first(p.postcode);
  const category = first(p.category);
  return {
    label: city && name && !name.includes(city) ? `${name}, ${city}` : name,
    postcode,
    city,
    type: 'poi',
    lat,
    lon,
    score: p.score ?? 0,
    // ex. « Hôpital · Créteil (94000) »
    detail: [category && category[0].toUpperCase() + category.slice(1), city && `${city}${postcode ? ` (${postcode})` : ''}`]
      .filter(Boolean)
      .join(' · '),
  };
}

/**
 * Suggestions pendant la frappe : adresses / rues / communes ET points d'intérêt
 * (deux requêtes en parallèle, fusionnées par pertinence).
 */
export async function suggest(text, signal) {
  const q = String(text || '').trim();
  if (q.length < 3) return [];
  const [addresses, pois] = await Promise.all([
    query({ q, limit: '5', autocomplete: '1' }, signal),
    query({ q, limit: '4', index: 'poi' }, signal),
  ]);
  const a = (addresses ?? []).map((f) => ({ ...toPlace(f), score: f.properties?.score ?? 0 }));
  const p = (pois ?? []).map(poiToPlace).filter((x) => x.score >= 0.3);
  const seen = new Set();
  return [...a, ...p]
    .filter((x) => x.label && !seen.has(x.label) && seen.add(x.label))
    .sort((x, y) => y.score - x.score)
    .slice(0, 7);
}
