// Découpage du temps pour la page Statistiques (jours, semaines, mois, années).

export const GRANULARITIES = {
  day: { label: 'Jours', count: 10, caption: '10 derniers jours' },
  week: { label: 'Semaines', count: 6, caption: '6 dernières semaines' },
  month: { label: 'Mois', count: 6, caption: '6 derniers mois' },
  year: { label: 'Années', count: 6, caption: '6 dernières années' },
};

const pad = (n) => String(n).padStart(2, '0');

/** Début de la période contenant `date` (heure locale). Semaine = lundi. */
export function periodStart(date, granularity) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (granularity === 'month') d.setDate(1);
  if (granularity === 'year') d.setMonth(0, 1);
  return d;
}

function shift(date, granularity, n) {
  const d = new Date(date);
  if (granularity === 'day') d.setDate(d.getDate() + n);
  if (granularity === 'week') d.setDate(d.getDate() + 7 * n);
  if (granularity === 'month') d.setMonth(d.getMonth() + n);
  if (granularity === 'year') d.setFullYear(d.getFullYear() + n);
  return d;
}

/** Clé AAAA-MM-JJ du début de période, identique à celle renvoyée par la base. */
export function bucketKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function label(start, granularity) {
  if (granularity === 'day') {
    return {
      short: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`,
      long: start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  }
  if (granularity === 'week') {
    const end = shift(start, 'day', 6);
    return {
      short: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`,
      long: `semaine du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
    };
  }
  if (granularity === 'month') {
    return {
      short: start.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
      long: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }
  return { short: String(start.getFullYear()), long: String(start.getFullYear()) };
}

/** Les N dernières périodes, de la plus ancienne à la plus récente (période en cours incluse). */
export function lastBuckets(granularity, now = new Date()) {
  const { count } = GRANULARITIES[granularity];
  const current = periodStart(now, granularity);
  return Array.from({ length: count }, (_, i) => {
    const start = shift(current, granularity, i - (count - 1));
    const { short, long } = label(start, granularity);
    return { key: bucketKey(start), start, short, long, current: i === count - 1 };
  });
}
