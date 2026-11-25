// Supabase Edge Function « route » — calcul de distance via Google Routes API.
//
// Appel : POST {SUPABASE_URL}/functions/v1/route  (en-tête apikey: <clé publishable>)
// Corps : { "origin": { "label": "...", "lat"?: 48.8, "lon"?: 2.3 }, "destination": { ... } }
// Réponse 200 : { distanceKm, durationMin, reason, shortest, routes: [...] }
// Erreurs : 400 requête invalide · 422 adresse non trouvée · 429 quota Google atteint · 502 Google indisponible
//
// Secret (Supabase → Edge Functions → Secrets) : GOOGLE_MAPS_API_KEY
// Les dépenses sont plafonnées côté Google (quotas de la console + carte à montant limité).

const ALLOWED_ORIGINS = ['https://nourben.github.io', 'http://localhost:8765', 'http://localhost:3000'];

/** Mêmes règles que js/config/tarifs.js (ROUTING_RULES) */
const SLOW_RATIO = 1.3; // trajet « long » si durée (min) > distance (km) × 1,3
const MAX_DETOUR_KM = 10; // alternative acceptée avec au plus 10 km de plus

type Place = { label?: string; lat?: number; lon?: number };
type Route = { distanceKm: number; durationMin: number };

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

function toWaypoint(p: Place) {
  if (Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) {
    return { location: { latLng: { latitude: p.lat, longitude: p.lon } } };
  }
  return { address: String(p?.label ?? '').trim() };
}

function validPlace(p: Place) {
  return (Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) || String(p?.label ?? '').trim().length >= 2;
}

/** Plus court en km ; si trajet long, alternative plus rapide avec ≤ 10 km de plus. */
export function selectRoute(routes: Route[]) {
  const shortest = routes.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
  if (shortest.durationMin <= shortest.distanceKm * SLOW_RATIO) return { route: shortest, shortest, reason: 'shortest' };
  const candidates = routes.filter(
    (r) => r !== shortest && r.distanceKm <= shortest.distanceKm + MAX_DETOUR_KM && r.durationMin < shortest.durationMin,
  );
  if (!candidates.length) return { route: shortest, shortest, reason: 'no-alternative' };
  const fastest = candidates.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));
  return { route: fastest, shortest, reason: 'faster-alternative' };
}

async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  let body: { origin?: Place; destination?: Place };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', message: 'Corps JSON invalide.' }, 400, origin);
  }
  if (!validPlace(body.origin as Place) || !validPlace(body.destination as Place)) {
    return json({ error: 'bad_request', message: 'Départ et destination obligatoires.' }, 400, origin);
  }

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'not_configured', message: 'Clé Google absente.' }, 500, origin);

  let res: Response;
  try {
    res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: toWaypoint(body.origin as Place),
        destination: toWaypoint(body.destination as Place),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: true,
        languageCode: 'fr-FR',
        regionCode: 'FR',
        units: 'METRIC',
      }),
    });
  } catch {
    return json({ error: 'upstream', message: 'Google ne répond pas.' }, 502, origin);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data?.error?.message ?? '');
    if (res.status === 429) {
      return json({ error: 'quota', message: 'Quota Google atteint.', detail: msg }, 429, origin);
    }
    if (res.status === 400 || res.status === 404) {
      return json({ error: 'not_found', message: 'Adresse de départ ou de destination non reconnue.', detail: msg }, 422, origin);
    }
    return json({ error: 'upstream', message: 'Erreur Google.', detail: msg }, 502, origin);
  }

  const routes: Route[] = (data.routes ?? [])
    .filter((r: { distanceMeters?: number }) => Number.isFinite(r?.distanceMeters))
    .map((r: { distanceMeters: number; duration?: string }) => ({
      distanceKm: Math.round(r.distanceMeters / 100) / 10,
      durationMin: Math.round(parseInt(String(r.duration ?? '0'), 10) / 60),
    }));
  if (!routes.length) {
    return json({ error: 'not_found', message: 'Aucun itinéraire trouvé entre ces deux adresses.' }, 422, origin);
  }

  const { route, shortest, reason } = selectRoute(routes);
  return json({ distanceKm: route.distanceKm, durationMin: route.durationMin, reason, shortest, routes }, 200, origin);
}

Deno.serve(handle);
