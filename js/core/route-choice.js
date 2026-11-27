// Choix d'itinéraire parmi ceux renvoyés par Google (mode « Itinéraire optimisé », issue #61).
//
// Par défaut on facture l'itinéraire le plus court en km (l'Assurance maladie rembourse le trajet
// le moins onéreux). En mode optimisé, on propose EN PLUS un itinéraire plus rapide, que
// l'utilisateur peut choisir, s'il :
//   - ajoute au plus 8 km (8 inclus),
//   - fait gagner au moins 5 minutes ET au moins 10 % du temps du plus court.
// Ces deux seuils de gain remplacent le ratio « 1 km ≈ 1 min » : ils comparent les itinéraires
// entre eux, donc fonctionnent aussi bien en ville que sur voie rapide, et écartent les
// alternatives qui ne font gagner qu'une ou deux minutes.

export const OPTIMIZED_RULES = { maxExtraKm: 8, minGainMin: 5, minGainRatio: 0.1 };

const valid = (r) => r && Number.isFinite(r.distanceKm) && Number.isFinite(r.durationMin);

/** Itinéraire le plus court en km (le plus rapide à distance égale). */
export function shortestRoute(routes) {
  const list = (routes ?? []).filter(valid);
  if (!list.length) return null;
  return list.reduce((a, b) => (b.distanceKm < a.distanceKm || (b.distanceKm === a.distanceKm && b.durationMin < a.durationMin) ? b : a));
}

/**
 * Itinéraire plus rapide à proposer en plus du plus court, ou null.
 * Parmi les alternatives qui passent les seuils, la plus rapide (la plus courte à temps égal).
 */
export function fasterAlternative(routes, rules = OPTIMIZED_RULES) {
  const shortest = shortestRoute(routes);
  if (!shortest) return null;
  const minGain = Math.max(rules.minGainMin, shortest.durationMin * rules.minGainRatio);
  const ok = (routes ?? []).filter(
    (r) =>
      valid(r) &&
      r !== shortest &&
      r.distanceKm - shortest.distanceKm <= rules.maxExtraKm + 1e-9 &&
      shortest.durationMin - r.durationMin >= minGain - 1e-9,
  );
  if (!ok.length) return null;
  return ok.reduce((a, b) => (b.durationMin < a.durationMin || (b.durationMin === a.durationMin && b.distanceKm < a.distanceKm) ? b : a));
}
