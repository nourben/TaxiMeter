// Identifiant de mesure d'audience : aléatoire, stocké dans le navigateur, renouvelé au bout de 13 mois.

export const VISITOR_MAX_AGE_DAYS = 395; // ≈ 13 mois (recommandation CNIL)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Renvoie l'identifiant à utiliser à partir de ce qui est stocké ({ id, createdAt } ou null).
 * @returns {{ id: string, createdAt: number, renewed: boolean }}
 */
export function resolveVisitor(stored, now, newId) {
  const valid =
    stored &&
    UUID_RE.test(stored.id ?? '') &&
    Number.isFinite(stored.createdAt) &&
    stored.createdAt <= now &&
    now - stored.createdAt < VISITOR_MAX_AGE_DAYS * 86400000;
  if (valid) return { id: stored.id, createdAt: stored.createdAt, renewed: false };
  return { id: newId(), createdAt: now, renewed: true };
}

const PAGES = ['index', 'stats', 'contact', 'cgu', 'mentions-legales', 'confidentialite'];

/** Nom de page enregistré (« autre » si inconnu). */
export function pageName(pathname) {
  const file = (pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  return PAGES.includes(file) ? file : 'autre';
}
