import { TARIFS } from '../config/tarifs.js';

/** Dimanche de Pâques (calendrier grégorien). */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Jours fériés nationaux (métropole). */
export function isPublicHoliday(date) {
  const y = date.getFullYear();
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  if (['1-1', '5-1', '5-8', '7-14', '8-15', '11-1', '11-11', '12-25'].includes(md)) return true;
  const easter = easterSunday(y);
  return [1, 39, 50].some((offset) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + offset); // lundi de Pâques, Ascension, lundi de Pentecôte
    return d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
  });
}

/**
 * Majoration « nuit / week-end / férié » applicable à un départ (date = heure de prise en charge) ?
 * Samedi après-midi, dimanche et fériés : selon l'heure de prise en charge.
 * @returns {{ active:boolean, reason:string }}
 */
export function nightRateFor(date, cfg = TARIFS, durationMin = null) {
  const N = cfg.majorations.night;
  // Nuit : majoration entière si plus de la moitié du temps en charge est entre 20 h et 8 h,
  // donc on regarde l'heure au milieu du trajet quand la durée est connue.
  const mid = durationMin > 0 ? new Date(date.getTime() + (durationMin * 60_000) / 2) : date;
  const h = mid.getHours();
  const startH = date.getHours();
  if (isPublicHoliday(date)) return { active: true, reason: 'jour férié' };
  if (date.getDay() === 0) return { active: true, reason: 'dimanche' };
  if (date.getDay() === 6 && startH >= N.saturdayFromHour) return { active: true, reason: 'samedi après-midi' };
  if (h >= N.startHour || h < N.endHour) return { active: true, reason: `nuit (${N.startHour} h – ${N.endHour} h)` };
  return { active: false, reason: `jour de semaine (${N.endHour} h – ${N.startHour} h)` };
}
