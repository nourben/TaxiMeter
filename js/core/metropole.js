import { TARIFS } from '../config/tarifs.js';

/** Extrait un code postal français (5 chiffres) d'une saisie libre. */
export function extractPostcode(text) {
  const m = String(text || '').match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

/** Minuscules sans accents, pour comparer des noms de communes. */
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Ville de la liste citée dans la saisie (mot entier, ex. « 12 rue X, Lyon » ou « Marseille 8e »). */
function cityInText(text, cities) {
  const t = norm(text);
  return cities.find((c) => new RegExp(`(^|[^a-z-])${norm(c)}($|[^a-z-])`).test(t)) ?? null;
}

/**
 * Indique si un lieu est en zone Métropole (forfait « grande ville »).
 * Règle : Paris, une commune du 92 / 93 / 94, ou l'une des grandes villes de la convention.
 * @param {{ text?:string, postcode?:string, city?:string }} place
 * @returns {{ inZone:boolean, reason:string|null }}
 */
export function checkMetropole(place, cfg = TARIFS) {
  const m = cfg.metropole;
  if (!place) return { inZone: false, reason: null };

  const postcode = place.postcode || extractPostcode(place.text);
  if (postcode && m.departments.includes(postcode.slice(0, 2))) {
    return { inZone: true, reason: postcode.startsWith('75') ? 'Paris' : `département ${postcode.slice(0, 2)}` };
  }

  // Commune renvoyée par l'autocomplétion : comparaison exacte
  if (place.city) {
    const c = m.cities.find((x) => norm(x) === norm(place.city));
    if (c) return { inZone: true, reason: c };
  }

  const c = cityInText(place.text, m.cities);
  if (c) return { inZone: true, reason: c };

  return { inZone: false, reason: null };
}
