// Supabase Edge Function « route » — calcul de distance via Google Routes API.
//
// Appel : POST {SUPABASE_URL}/functions/v1/route  (en-tête apikey: <clé publishable>)
// Corps : { "origin": { "label": "...", "lat"?: 48.8, "lon"?: 2.3 }, "destination": { ... } }
// Réponse 200 : { distanceKm, durationMin, routes: [...] }  (itinéraire le plus court en km)
// Erreurs : 400 requête invalide · 422 adresse non trouvée · 429 trop de calculs (par appareil) ou quota mensuel atteint
//           · 502 Google indisponible
// Protection : 10 calculs / minute, 60 / heure, 200 / 24 h par adresse IP (hachée), blocage de 24 h après
// 3 dépassements (SQL 0005). Pas de cache des itinéraires : les conditions Google Maps Platform
// n'autorisent à garder que les latitudes / longitudes, pas les distances ni les durées.
//
// Secrets (Supabase → Edge Functions → Secrets) :
//   GOOGLE_MAPS_API_KEY   (obligatoire)
//   GOOGLE_MONTHLY_LIMIT  (facultatif, 4600 par défaut : sous les 5 000 appels gratuits du niveau Pro)
//   IP_HASH_SALT          (recommandé) secret aléatoire pour les empreintes d'IP, même valeur que pour « contact »
// Le compteur (table api_usage, mois en heure de Paris) bloque les calculs au-delà de la limite,
// puisque les quotas de la console Google ne sont pas modifiables pendant l'essai gratuit.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

const ALLOWED_ORIGINS = ['https://nourben.github.io', 'http://localhost:8765', 'http://localhost:3000'];

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

/**
 * Retient toujours l'itinéraire le plus court en km parmi ceux proposés par Google.
 * L'Assurance maladie rembourse sur la base du trajet le moins onéreux et vérifie les km facturés :
 * pas de détour plus long, même plus rapide.
 */
export function selectRoute(routes: Route[]) {
  return routes.reduce((a, b) => (b.distanceKm < a.distanceKm || (b.distanceKm === a.distanceKm && b.durationMin < a.durationMin) ? b : a));
}

async function serviceRpc(name: string, body: unknown) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase non configuré');
  const res = await fetch(`${url}/rest/v1/${name}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Base ${res.status}`);
  return res.status === 204 || res.status === 201 ? null : res.json();
}

/**
 * Empreinte d'une adresse IP : HMAC-SHA256 avec le secret IP_HASH_SALT.
 * Sans ce secret, impossible de retrouver une IP en testant toutes les adresses possibles.
 * (Si le secret n'est pas défini, repli sur un simple SHA-256 préfixé, plus faible.)
 */
async function ipHash(scope: string, ip: string) {
  const salt = Deno.env.get('IP_HASH_SALT');
  const enc = new TextEncoder();
  const data = enc.encode(`${scope}:${ip}`);
  const buf = salt
    ? await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data)
    : await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const WAIT: Record<string, string> = { minute: '1 minute', hour: '1 heure', day: '24 heures', blocked: '24 heures' };

/** Incrémente le compteur mensuel ; renvoie le nombre d'appels du mois (ou null si la base ne répond pas). */
async function incrementUsage(): Promise<number | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/increment_api_usage`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_provider: 'google' }),
    });
    if (!res.ok) return null;
    return Number(await res.json());
  } catch {
    return null;
  }
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

  // Limite par appareil (IP hachée) : 10 / min, 60 / h, 200 / 24 h, blocage de 24 h après 3 dépassements
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  try {
    const check = await serviceRpc('rpc/route_rate_check', { p_ip_hash: await ipHash('taximeter-route', ip) });
    if (!check?.allowed) {
      const wait = WAIT[check?.reason] ?? 'quelques minutes';
      const message =
        check?.reason === 'blocked'
          ? 'Trop de calculs : le calcul de distance est bloqué 24 heures sur cet appareil.'
          : `Trop de calculs en peu de temps : réessayez dans ${wait}.`;
      return json(
        { error: 'rate_limited', reason: check?.reason, retry_after: check?.retry_after, message },
        429,
        origin,
      );
    }
  } catch {
    return json({ error: 'usage_unavailable', message: 'Contrôle indisponible, calcul bloqué par sécurité.' }, 503, origin);
  }

  // Garde-fou : on bloque avant la limite gratuite (le compteur inclut cet appel)
  const limit = Number(Deno.env.get('GOOGLE_MONTHLY_LIMIT') ?? 4600);
  const calls = await incrementUsage();
  if (calls == null) return json({ error: 'usage_unavailable', message: 'Compteur indisponible, calcul bloqué par sécurité.' }, 503, origin);
  if (calls > limit) return json({ error: 'quota', message: 'Limite mensuelle de calculs atteinte.' }, 429, origin);

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

  const route = selectRoute(routes);
  return json({ distanceKm: route.distanceKm, durationMin: route.durationMin, routes }, 200, origin);
}

Deno.serve(handle);
