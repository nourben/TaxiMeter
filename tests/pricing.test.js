import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFare } from '../js/core/pricing.js';
import { periodForDate } from '../js/core/period.js';

const base = { distanceKm: 20, ratePerKm: 1.2 };

test('exemple jour 20 km = 37,00 €', () => {
  assert.equal(computeFare({ ...base, period: 'jour', metropole: false }).total, 37);
});

test('exemple nuit 20 km = 48,30 €', () => {
  assert.equal(computeFare({ ...base, period: 'nuit', metropole: false }).total, 48.3);
});

test('métropole ajoute 15 € (jour et nuit)', () => {
  assert.equal(computeFare({ ...base, period: 'jour', metropole: true }).total, 52);
  assert.equal(computeFare({ ...base, period: 'nuit', metropole: true }).total, 63.3);
});

test('distance ≤ 4 km : seule la prise en charge', () => {
  assert.equal(computeFare({ distanceKm: 3, ratePerKm: 1.2, period: 'jour', metropole: false }).total, 13);
  assert.equal(computeFare({ distanceKm: 4, ratePerKm: 1.2, period: 'nuit', metropole: false }).total, 19.5);
});

test('autres tarifs kilométriques', () => {
  // 13 + 16 × 1,07 × 1,25 = 13 + 17,12 + 4,28 = 34,40
  assert.equal(computeFare({ distanceKm: 20, ratePerKm: 1.07, period: 'jour', metropole: false }).total, 34.4);
  // 13 + 16 × 1,22 = 32,52 → × 1,25 sur distance : 13 + 19,52 + 4,88 = 37,40
  assert.equal(computeFare({ distanceKm: 20, ratePerKm: 1.22, period: 'jour', metropole: false }).total, 37.4);
});

test('la somme des lignes = total', () => {
  const r = computeFare({ distanceKm: 37.4, ratePerKm: 1.22, period: 'nuit', metropole: true });
  const sum = Math.round(r.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  assert.equal(sum, r.total);
});

test('distance invalide refusée', () => {
  assert.throws(() => computeFare({ distanceKm: -1, ratePerKm: 1.2, period: 'jour' }));
  assert.throws(() => computeFare({ distanceKm: NaN, ratePerKm: 1.2, period: 'jour' }));
});

test('période : 8h00 jour, 19h59 jour, 20h00 nuit, 7h59 nuit', () => {
  const at = (h, m) => new Date(2026, 0, 1, h, m);
  assert.equal(periodForDate(at(8, 0)), 'jour');
  assert.equal(periodForDate(at(19, 59)), 'jour');
  assert.equal(periodForDate(at(20, 0)), 'nuit');
  assert.equal(periodForDate(at(7, 59)), 'nuit');
  assert.equal(periodForDate(at(0, 30)), 'nuit');
});
