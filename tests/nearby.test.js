import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, isFrance, prioritizeNearby, validZone } from '../js/core/nearby.js';

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
  const zone = validZone({ ...LYON, country: 'FR' });
  const out = prioritizeNearby([PARIS, GRENOBLE, VIENNE, { label: 'Sans position' }], zone);
  assert.deepEqual(out.map((x) => x.label), ['Vienne', 'Paris', 'Grenoble', 'Sans position']);
});

test('pas de zone hors de France ni sans position', () => {
  assert.equal(validZone({ ...LYON, country: 'DE' }), null);
  assert.equal(validZone({ country: 'FR' }), null);
  assert.equal(validZone(null), null);
  assert.ok(validZone({ lat: -21.1, lon: 55.5, country: 're' })); // La Réunion
  assert.equal(isFrance('US'), false);
  const items = [PARIS, VIENNE];
  assert.equal(prioritizeNearby(items, null), items);
});
