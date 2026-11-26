import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVisitor, pageName, VISITOR_MAX_AGE_DAYS } from '../js/core/visitor.js';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const NEW = '00000000-0000-4000-8000-000000000000';
const day = 86400000;
const now = Date.UTC(2026, 10, 26);

test('garde un identifiant valide', () => {
  assert.deepEqual(resolveVisitor({ id: ID, createdAt: now - 10 * day }, now, () => NEW), { id: ID, createdAt: now - 10 * day, renewed: false });
});

test('renouvelle au bout de 13 mois, si absent ou invalide', () => {
  assert.equal(resolveVisitor({ id: ID, createdAt: now - VISITOR_MAX_AGE_DAYS * day }, now, () => NEW).id, NEW);
  assert.equal(resolveVisitor(null, now, () => NEW).renewed, true);
  assert.equal(resolveVisitor({ id: 'abc', createdAt: now }, now, () => NEW).id, NEW);
  assert.equal(resolveVisitor({ id: ID, createdAt: now + day }, now, () => NEW).id, NEW);
});

test('nom de page', () => {
  assert.equal(pageName('/TaxiMeter/'), 'index');
  assert.equal(pageName('/TaxiMeter/stats.html'), 'stats');
  assert.equal(pageName('/TaxiMeter/cgv.html'), 'autre');
});
