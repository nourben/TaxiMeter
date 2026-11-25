// Client Supabase minimal (API REST), sans dépendance ni étape de build.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase.js';

const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json',
};

async function request(path, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status} ${detail}`.trim());
  }
  return res.status === 204 ? null : res.json();
}

/** Appelle une fonction SQL exposée (RPC). */
export function rpc(name, args = {}) {
  return request(`/rest/v1/rpc/${name}`, args);
}

/** Ajoute une ligne dans une table (sans relire la ligne créée). */
export function insert(table, row) {
  return request(`/rest/v1/${table}`, row, { Prefer: 'return=minimal' });
}
