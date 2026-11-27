// Mise à jour automatique du site, utile surtout quand il est installé sur l'écran d'accueil
// (iPhone : pas de bouton « Actualiser » en mode app).
//
// Principe, sans numéro de version à tenir à jour : juste après le chargement, on relit les fichiers
// du site (page, CSS, JS) tels que le navigateur les a en cache, c'est-à-dire la version qui tourne,
// et on en garde une empreinte. À chaque vérification, on les redemande au serveur.
// S'ils diffèrent, une nouvelle version est en ligne : la page se recharge. La requête au serveur
// a déjà mis le cache à jour, le rechargement prend donc bien les nouveaux fichiers.
//
// Vérification : à l'ouverture, au retour dans l'app et toutes les 5 minutes.
// Rechargement immédiat si aucun champ n'est rempli. Si une saisie est en cours, on ne la perd pas :
// rechargement seulement au retour dans l'app après plus de 30 minutes d'absence
// (un aller-retour rapide vers Google Maps ne recharge donc pas la page).

const PERIOD = 5 * 60_000;
const MIN_GAP = 30_000;
const LONG_AWAY = 30 * 60_000;
const RELOAD_KEY = 'taximeter.autoReloadAt';

/** Fichiers du site chargés par la page (même origine), page elle-même comprise. */
function siteFiles() {
  const urls = new Set([location.href.split('#')[0]]);
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name);
    if (u.origin === location.origin && /\.(js|css|html)$/.test(u.pathname)) urls.add(u.href);
  }
  return [...urls];
}

async function fingerprint(urls, cache) {
  const parts = await Promise.all(
    urls.map((u) =>
      fetch(u, { cache })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => null),
    ),
  );
  if (parts.includes(null)) return null; // hors ligne : on ne conclut rien
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\u0000')));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Un trajet est-il en cours de saisie ? (champ texte ou nombre rempli) */
function formInUse() {
  return [...document.querySelectorAll('main input[type="text"], main input[type="number"], main textarea')].some(
    (i) => i.value.trim() !== '',
  );
}

let urls = null;
let baseline = null; // empreinte de la version qui tourne
let running = null;
let lastCheck = 0;
let pending = false;
let hiddenAt = 0;

/** Recharge, au plus une fois toutes les 2 minutes (évite une boucle si le cache reste ancien). */
function reload(force) {
  if (!force && formInUse()) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (last && Date.now() - last < 2 * 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : on recharge quand même */
  }
  location.reload();
}

async function check(force) {
  if (pending) return reload(force);
  if (running || Date.now() - lastCheck < MIN_GAP) return;
  lastCheck = Date.now();
  running = (async () => {
    if (!baseline) {
      urls = siteFiles();
      baseline = await fingerprint(urls, 'force-cache'); // ce qui tourne
      if (!baseline) return;
    }
    const online = await fingerprint(urls, 'no-cache'); // ce qui est en ligne (revalidation)
    if (!online || online === baseline) return;
    pending = true;
    reload(force);
  })().finally(() => {
    running = null;
  });
}

export function startAutoUpdate() {
  if (!window.crypto?.subtle || !window.performance?.getEntriesByType) return;
  // Après le chargement complet, pour connaître tous les fichiers de la page
  const first = () => setTimeout(() => check(false), 1500);
  if (document.readyState === 'complete') first();
  else window.addEventListener('load', first, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    lastCheck = 0;
    check(hiddenAt > 0 && Date.now() - hiddenAt > LONG_AWAY);
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) check(false);
  });
  setInterval(() => document.visibilityState === 'visible' && check(false), PERIOD);
}
