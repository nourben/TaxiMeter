import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastBuckets, periodStart } from '../js/core/periods.js';

const now = new Date(2026, 10, 25, 15, 0); // mercredi 25 novembre 2026

test('10 derniers jours, du plus ancien au jour en cours', () => {
  const b = lastBuckets('day', now);
  assert.equal(b.length, 10);
  assert.equal(b[0].key, '2026-11-16');
  assert.equal(b[9].key, '2026-11-25');
  assert.equal(b[9].current, true);
});

test('semaines commençant le lundi', () => {
  assert.equal(periodStart(now, 'week').getDate(), 23);
  const b = lastBuckets('week', now);
  assert.deepEqual(b.map((x) => x.key), ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
});

test('6 derniers mois et 6 dernières années', () => {
  assert.deepEqual(lastBuckets('month', now).map((x) => x.key), [
    '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01',
  ]);
  assert.deepEqual(lastBuckets('year', now).map((x) => x.short), ['2021', '2022', '2023', '2024', '2025', '2026']);
});

test('changement d’année pour les mois', () => {
  const b = lastBuckets('month', new Date(2026, 1, 10));
  assert.equal(b[0].key, '2025-09-01');
});
