import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortestRoute, fasterAlternative } from '../js/core/route-choice.js';

const r = (distanceKm, durationMin) => ({ distanceKm, durationMin });

test('le plus court en km, le plus rapide à distance égale', () => {
  assert.deepEqual(shortestRoute([r(14, 20), r(12, 30), r(12, 28)]), r(12, 28));
  assert.equal(shortestRoute([]), null);
});

test('alternative retenue : +8 km au plus et gain réel', () => {
  // 12 km / 34 min contre 17,1 km / 22 min : +5,1 km, −12 min (35 %)
  assert.deepEqual(fasterAlternative([r(12, 34), r(17.1, 22)]), r(17.1, 22));
});

test('8 km de plus exactement : accepté ; au-delà : refusé', () => {
  assert.deepEqual(fasterAlternative([r(10, 40), r(18, 20)]), r(18, 20));
  assert.equal(fasterAlternative([r(10, 40), r(18.1, 20)]), null);
});

test('gain trop faible : pas d’alternative', () => {
  assert.equal(fasterAlternative([r(8, 20), r(12, 17)]), null); // −3 min
  assert.equal(fasterAlternative([r(40, 60), r(45, 54)]), null); // −6 min mais 10 % seulement
  assert.deepEqual(fasterAlternative([r(40, 60), r(45, 51)]), r(45, 51)); // −9 min, 15 %
});

test('plusieurs alternatives : la plus rapide', () => {
  assert.deepEqual(fasterAlternative([r(10, 40), r(13, 28), r(16, 24), r(20, 15)]), r(16, 24));
});

test('aucune donnée exploitable', () => {
  assert.equal(fasterAlternative(undefined), null);
  assert.equal(fasterAlternative([r(10, 20)]), null);
});
