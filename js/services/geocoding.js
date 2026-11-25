/**
 * Géocodage et autocomplétion via le service public gratuit de l'IGN
 * (Géoplateforme, ex-API Adresse / BAN). Sans clé ni compte, France uniquement.
 * En cas d'échec (hors ligne, adresse étrangère…), on retombe sur la saisie libre.
 */
const ENDPOINT = 'https://data.geopf.fr/geocodage/search';

const TYPE_LABEL = {
  housenumber: 'Adresse',
  street: 'Rue',
  locality: 'Lieu-dit',
  municipality: 'Commune',
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

/** Suggestions pendant la frappe (adresses, rues, communes). */
export async function suggest(text, signal) {
  const q = String(text || '').trim();
  if (q.length < 3) return [];
  const features = await query({ q, limit: '6', autocomplete: '1' }, signal);
  return (features ?? []).map(toPlace).filter((p) => p.label);
}
