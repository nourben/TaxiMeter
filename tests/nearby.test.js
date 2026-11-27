import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, prioritizeNearby, suggestCenter } from '../js/core/nearby.js';
import { DEPT_CENTERS } from '../js/config/dept-centers.js';
import { DEPARTMENT_RATES } from '../js/config/tarifs.js';

const LYON = { lat: 45.764, lon: 4.8357 };
const VIENNE = { label: 'Vienne', lat: 45.525, lon: 4.874 }; // ~27 km
const GRENOBLE = { label: 'Grenoble', lat: 45.188, lon: 5.724 }; // ~95 km
const PARIS = { label: 'Paris', lat: 48.857, lon: 2.352 };

test('distance à vol d’oiseau', () => {
  assert.ok(Math.abs(distanceKm(LYON, PARIS) - 392) < 5);
  assert.ok(distanceKm(LYON, VIENNE) < 70);
  assert.ok(distanceKm(LYON, GRENOBLE) > 70);
});

test('lieux à moins de 70 km en tête, ordre conservé dans chaque groupe', () => {
  const out = prioritizeNearby([PARIS, GRENOBLE, VIENNE, { label: 'Sans position' }], LYON);
  assert.deepEqual(out.map((x) => x.label), ['Vienne', 'Paris', 'Grenoble', 'Sans position']);
  const items = [PARIS, VIENNE];
  assert.equal(prioritizeNearby(items, null), items);
});

test('centre : départ choisi, sinon département mémorisé, sinon aucun', () => {
  assert.equal(suggestCenter({ origin: LYON, dept: '91' }).source, 'départ');
  const c = suggestCenter({ origin: { label: 'texte libre' }, dept: '91' });
  assert.equal(c.source, 'département 91');
  assert.ok(distanceKm(c, { lat: 48.63, lon: 2.44 }) < 5); // Évry
  assert.equal(suggestCenter({ dept: 'XX' }), null);
  assert.equal(suggestCenter(), null);
});

test('chaque département du sélecteur a un centre', () => {
  for (const [code] of DEPARTMENT_RATES) assert.ok(DEPT_CENTERS[code], code);
});
