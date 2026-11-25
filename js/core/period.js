import { TARIFS } from '../config/tarifs.js';

/**
 * Renvoie la période tarifaire pour une date donnée.
 * Jour : de periods.jour.startHour (8h) inclus à periods.nuit.startHour (20h) exclu. Nuit sinon.
 */
export function periodForDate(date, cfg = TARIFS) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const dayStart = cfg.periods.jour.startHour * 60;
  const nightStart = cfg.periods.nuit.startHour * 60;
  return minutes >= dayStart && minutes < nightStart ? 'jour' : 'nuit';
}
