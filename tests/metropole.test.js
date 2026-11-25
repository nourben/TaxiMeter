import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMetropole, extractPostcode } from '../js/core/metropole.js';

test('Paris et petite couronne par le code postal', () => {
  assert.equal(checkMetropole({ text: '12 rue de Rivoli 75004 Paris' }).inZone, true);
  assert.equal(checkMetropole({ text: '3 rue X, 94000 Créteil' }).inZone, true);
  assert.equal(checkMetropole({ text: '12 rue X, 93200 Saint-Denis' }).inZone, true);
  assert.equal(checkMetropole({ text: 'Nanterre', postcode: '92000' }).inZone, true);
});

test('grande couronne hors zone', () => {
  assert.equal(checkMetropole({ text: 'Évry-Courcouronnes 91000' }).inZone, false);
  assert.equal(checkMetropole({ text: '5 av Y, 77100 Meaux' }).inZone, false);
  assert.equal(checkMetropole({ text: 'Versailles', postcode: '78000', city: 'Versailles' }).inZone, false);
});

test('grandes villes de la convention', () => {
  assert.equal(checkMetropole({ text: 'Lyon' }).inZone, true);
  assert.equal(checkMetropole({ text: '10 La Canebière 13001 Marseille', city: 'Marseille', postcode: '13001' }).inZone, true);
  assert.equal(checkMetropole({ text: 'gare de Nantes' }).inZone, true);
  assert.equal(checkMetropole({ text: 'Paris' }).inZone, true);
});

test('pas de faux positif sur un nom proche', () => {
  assert.equal(checkMetropole({ text: 'Lillebonne 76170' }).inZone, false);
  assert.equal(checkMetropole({ text: 'Villeneuve-lès-Avignon' }).inZone, false);
  assert.equal(checkMetropole({ text: 'Lyons-la-Forêt' }).inZone, false);
});

test('extraction du code postal', () => {
  assert.equal(extractPostcode('3 rue Z 94000 Créteil'), '94000');
  assert.equal(extractPostcode('Créteil'), null);
});
