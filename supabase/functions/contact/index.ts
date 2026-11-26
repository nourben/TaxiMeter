// Supabase Edge Function « contact » — formulaire de contact du site.
//
// Appel : POST {SUPABASE_URL}/functions/v1/contact  (multipart/form-data, en-tête apikey: <clé publishable>)
// Champs : name?, email?, phone? (email OU téléphone obligatoire), subject, message, attachment? (fichier),
//          website (piège à robots, doit rester vide), started_at (horodatage d'ouverture du formulaire),
//          cf-turnstile-response (si Cloudflare Turnstile est activé)
// Réponses : 200 { ok: true } · 400 champ invalide · 403 vérification anti-robot échouée · 413 fichier trop lourd
//            · 429 trop de messages · 500/502 erreur serveur
//
// Secrets (Supabase → Edge Functions → Secrets) :
//   RESEND_API_KEY     clé de l'API Resend (envoi de l'e-mail)               — obligatoire
//   CONTACT_TO_EMAIL   adresse qui reçoit les messages                         — obligatoire
//   CONTACT_FROM_EMAIL expéditeur (par défaut « TaxiMeter <onboarding@resend.dev> »)
//   TURNSTILE_SECRET   clé secrète Cloudflare Turnstile (anti-robot)           — facultatif
//   IP_HASH_SALT       secret aléatoire pour les empreintes d'IP (même valeur pour route et contact) — recommandé
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

const ALLOWED_ORIGINS = ['https://nourben.github.io', 'http://localhost:8765', 'http://localhost:3000'];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MIN_FILL_MS = 3000; // un humain met plus de 3 s à remplir le formulaire
const MAX_PER_HOUR = 5; // messages par adresse IP et par heure

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

const str = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max);
/** Texte sur une ligne (sujet, nom, coordonnées) : pas de retour à la ligne ni de caractère de contrôle. */
const line = (v: FormDataEntryValue | null, max: number) => str(v, max).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

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

/** Vérifie le vrai format du fichier d'après ses premiers octets (le type déclaré par le navigateur peut mentir). */
function realType(b: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heif'].includes(ascii(8, 12))) return 'image/heic';
  return null;
}

/** Nom de fichier sans chemin ni caractères de contrôle. */
const safeName = (n: string) => n.replace(/[\\/\u0000-\u001f\u007f]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'piece-jointe';

function toBase64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function db(path: string, init: RequestInit) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase non configuré');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Base ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function verifyTurnstile(token: string, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) return true; // anti-robot Cloudflare non activé
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'bad_request', message: 'Formulaire illisible.' }, 400, origin);
  }

  // 1. Pièges à robots : réponse « ok » sans rien enregistrer
  const startedAt = Number(form.get('started_at'));
  if (str(form.get('website'), 200) !== '' || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return json({ ok: true }, 200, origin);
  }

  // 2. Validation des champs
  const name = line(form.get('name'), 100);
  const email = line(form.get('email'), 200);
  const phone = line(form.get('phone'), 30);
  const subject = line(form.get('subject'), 150);
  const message = str(form.get('message'), 5000);
  const emailOk = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const phoneOk = phone === '' || phone.replace(/[^\d]/g, '').length >= 9;
  if (!email && !phone) return json({ error: 'bad_request', message: 'Indiquez un e-mail ou un téléphone.' }, 400, origin);
  if (!emailOk) return json({ error: 'bad_request', message: 'E-mail invalide.' }, 400, origin);
  if (!phoneOk) return json({ error: 'bad_request', message: 'Téléphone invalide.' }, 400, origin);
  if (!subject) return json({ error: 'bad_request', message: 'Sujet obligatoire.' }, 400, origin);
  if (message.length < 5) return json({ error: 'bad_request', message: 'Message trop court.' }, 400, origin);

  const file = form.get('attachment');
  let attachment: { filename: string; content: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return json({ error: 'too_large', message: 'Pièce jointe trop lourde (5 Mo maximum).' }, 413, origin);
    if (!ALLOWED_TYPES.includes(file.type)) return json({ error: 'bad_request', message: 'Format de pièce jointe non accepté (PDF ou image).' }, 400, origin);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!realType(bytes)) return json({ error: 'bad_request', message: 'Le fichier ne semble pas être un PDF ou une image.' }, 400, origin);
    attachment = { filename: safeName(file.name), content: toBase64(bytes) };
  }

  // 3. Anti-robot Cloudflare Turnstile (si activé) et limite de fréquence par IP
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  if (!(await verifyTurnstile(str(form.get('cf-turnstile-response'), 2048), ip))) {
    return json({ error: 'captcha', message: 'Vérification anti-robot échouée, réessayez.' }, 403, origin);
  }
  const ipKey = await ipHash('taximeter', ip);
  try {
    const recent = Number(await db('rpc/contact_recent_count', { method: 'POST', body: JSON.stringify({ p_ip_hash: ipKey }) }));
    if (recent >= MAX_PER_HOUR) return json({ error: 'rate_limited', message: 'Trop de messages envoyés, réessayez dans une heure.' }, 429, origin);
  } catch {
    return json({ error: 'server', message: 'Service momentanément indisponible.' }, 500, origin);
  }

  // 4. Enregistrement dans Supabase
  let id: number;
  try {
    const rows = await db('contact_messages', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: name || null, email: email || null, phone: phone || null, subject, message, attachment_name: attachment?.filename ?? null, ip_hash: ipKey }),
    });
    id = rows[0].id;
  } catch {
    return json({ error: 'server', message: 'Enregistrement impossible.' }, 500, origin);
  }

  // 5. E-mail de notification (Resend)
  const to = Deno.env.get('CONTACT_TO_EMAIL');
  const key = Deno.env.get('RESEND_API_KEY');
  if (!to || !key) return json({ ok: true, emailed: false }, 200, origin); // message gardé dans Supabase (30 jours max)
  const text = [
    `Nouveau message depuis le formulaire de contact TaxiMeter (n° ${id})`,
    '',
    `Nom : ${name || '—'}`,
    `E-mail : ${email || '—'}`,
    `Téléphone : ${phone || '—'}`,
    `Sujet : ${subject}`,
    '',
    message,
    '',
    attachment ? `Pièce jointe : ${attachment.filename}` : 'Pas de pièce jointe',
  ].join('\n');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('CONTACT_FROM_EMAIL') ?? 'TaxiMeter <onboarding@resend.dev>',
      to: [to],
      ...(email ? { reply_to: email } : {}),
      subject: `[TaxiMeter] ${subject}`,
      text,
      ...(attachment ? { attachments: [attachment] } : {}),
    }),
  }).catch(() => null);

  if (res?.ok) {
    // E-mail parti : on efface le contenu du message. Il ne reste que la date et l'empreinte d'IP (anti-spam).
    await db(`contact_messages?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ email_sent: true, name: null, email: null, phone: null, subject: null, message: null, attachment_name: null }),
    }).catch(() => {});
  }
  // Si l'e-mail échoue, le message reste dans Supabase (30 jours au maximum) : on répond « ok » à l'utilisateur
  return json({ ok: true, emailed: !!res?.ok }, 200, origin);
}

Deno.serve(handle);
