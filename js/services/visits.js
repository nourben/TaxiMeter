// Mesure d'audience maison (sans cookie ni outil tiers) : une ligne par page affichée dans Supabase.
// Voir la politique de confidentialité, section « Mesure d'audience ».
import { resolveVisitor, pageName } from '../core/visitor.js';
import { insert } from './supabase.js';

const ID_KEY = 'taximeter.visitor';
const OPT_OUT_KEY = 'taximeter.audience.optout';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', ''];

export function isOptedOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return true; // stockage indisponible : on ne compte pas
  }
}

/** Compte un clic sur le bouton de refus / réactivation (sans identifiant ni IP). */
function logOptOut(optOut) {
  if (LOCAL_HOSTS.includes(location.hostname)) return;
  insert('audience_optouts', { kind: optOut ? 'optout' : 'optin' }).catch(() => {});
}

export function setOptOut(optOut) {
  logOptOut(optOut);
  try {
    if (optOut) {
      localStorage.setItem(OPT_OUT_KEY, '1');
      localStorage.removeItem(ID_KEY);
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
    }
  } catch {
    /* rien */
  }
}

function visitorId() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(ID_KEY) || 'null');
  } catch {
    /* valeur illisible : nouvel identifiant */
  }
  const v = resolveVisitor(stored, Date.now(), () => crypto.randomUUID());
  if (v.renewed) localStorage.setItem(ID_KEY, JSON.stringify({ id: v.id, createdAt: v.createdAt }));
  return v.id;
}

export function trackPageView() {
  if (LOCAL_HOSTS.includes(location.hostname) || isOptedOut() || !globalThis.crypto?.randomUUID) return;
  try {
    insert('visits', { visitor_id: visitorId(), page: pageName(location.pathname) }).catch(() => {});
  } catch {
    /* stockage indisponible : visite non comptée */
  }
}
