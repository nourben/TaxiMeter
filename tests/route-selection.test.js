import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRoute } from '../js/core/route-selection.js';

test('trajet fluide : on garde le plus court', () => {
  const r = selectRoute([
    { distanceKm: 20, durationMin: 22 },
    { distanceKm: 24, durationMin: 18 },
  ]);
  assert.equal(r.reason, 'shortest');
  assert.equal(r.route.distanceKm, 20);
});

test('trajet long : alternative plus rapide avec ≤ 10 km de plus', () => {
  const r = selectRoute([
    { distanceKm: 20, durationMin: 45 },
    { distanceKm: 27, durationMin: 30 },
    { distanceKm: 26, durationMin: 35 },
  ]);
  assert.equal(r.reason, 'faster-alternative');
  assert.equal(r.route.distanceKm, 27);
});

test('trajet long, alternative trop longue (> 10 km) : on garde le plus court', () => {
  const r = selectRoute([
    { distanceKm: 20, durationMin: 45 },
    { distanceKm: 31, durationMin: 25 },
  ]);
  assert.equal(r.reason, 'no-alternative');
  assert.equal(r.route.distanceKm, 20);
});

test('aucun itinéraire valide', () => {
  assert.equal(selectRoute([]), null);
  assert.equal(selectRoute([{ distanceKm: NaN, durationMin: 3 }]), null);
});
