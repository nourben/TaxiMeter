/**
 * Géocodage via le service public gratuit de l'IGN (Géoplateforme, ex-API Adresse / BAN).
 * Sans clé. Sert uniquement à détecter automatiquement la zone Métropole.
 * En cas d'échec (hors ligne, adresse étrangère…), on retombe sur le code postal saisi.
 */
const ENDPOINT = 'https://data.geopf.fr/geocodage/search';

/** @returns {Promise<{ label:string, postcode:string|null, lat:number, lon:number } | null>} */
export async function geocode(text, { signal } = {}) {
  const q = String(text || '').trim();
  if (q.length < 3) return null;
  try {
    const url = `${ENDPOINT}?${new URLSearchParams({ q, limit: '1' })}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data?.features?.[0];
    if (!f || (f.properties?.score ?? 0) < 0.4) return null;
    const [lon, lat] = f.geometry.coordinates;
    return { label: f.properties.label, postcode: f.properties.postcode ?? null, lat, lon };
  } catch {
    return null;
  }
}
