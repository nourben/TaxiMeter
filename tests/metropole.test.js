import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMetropole, haversineKm, extractPostcode } from '../js/core/metropole.js';
import { TARIFS } from '../js/config/tarifs.js';

test('Créteil est dans le rayon Métropole', () => {
  const d = haversineKm(TARIFS.metropole.center, { lat: 48.7904, lon: 2.4556 });
  assert.ok(d > 9 && d < TARIFS.metropole.radiusKm, `distance ${d}`);
  assert.equal(checkMetropole({ lat: 48.7904, lon: 2.4556 }).inZone, true);
});

test('Évry (91) hors zone', () => {
  assert.equal(checkMetropole({ text: 'Évry-Courcouronnes 91000', lat: 48.6291, lon: 2.4410 }).inZone, false);
});

test('repli sur le code postal sans coordonnées', () => {
  assert.equal(checkMetropole({ text: '12 rue X, 93200 Saint-Denis' }).inZone, true);
  assert.equal(checkMetropole({ text: '5 av Y, 77100 Meaux' }).inZone, false);
  assert.equal(checkMetropole({ text: 'Paris' }).inZone, true);
});

test('extraction du code postal', () => {
  assert.equal(extractPostcode('3 rue Z 94000 Créteil'), '94000');
  assert.equal(extractPostcode('Créteil'), null);
});
