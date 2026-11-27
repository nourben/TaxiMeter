import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare, shortPlace } from '../js/core/share-link.js';

test('lien de partage : aller-retour encodage / décodage', () => {
  const trips = [
    { from: 'Créteil (94)', to: 'Hôpital Henri-Mondor, Créteil', km: 12.5, rate: 1.07, durationMin: 22, departAt: Date.UTC(2026, 10, 28, 7, 0), hospital: true, night: false, metropole: true },
    { from: 'Melun (77)', to: 'Paris (75)', km: 48.2, rate: 1.27, hospital: false, night: true, metropole: true, soloLong: true },
  ];
  const back = decodeShare(encodeShare(trips));
  assert.equal(back.length, 2);
  assert.equal(back[0].from, 'Créteil (94)');
  assert.equal(back[0].km, 12.5);
  assert.equal(back[0].durationMin, 22);
  assert.equal(back[0].departAt, Date.UTC(2026, 10, 28, 7, 0));
  assert.deepEqual([back[0].hospital, back[0].night, back[0].metropole], [true, false, true]);
  assert.deepEqual([back[1].night, back[1].soloLong, back[1].departAt], [true, true, null]);
});

test('lien de partage invalide ignoré', () => {
  assert.equal(decodeShare('n-importe-quoi'), null);
  assert.equal(decodeShare(''), null);
});

test('nom court : jamais l’adresse exacte', () => {
  assert.equal(shortPlace('12 rue de la Paix, 94000 Créteil', { type: 'housenumber', city: 'Créteil', postcode: '94000' }), 'Créteil (94)');
  assert.equal(shortPlace('Hôpital Henri-Mondor, Créteil', { type: 'poi', label: 'Hôpital Henri-Mondor, Créteil', city: 'Créteil' }), 'Hôpital Henri-Mondor, Créteil');
  assert.equal(shortPlace('12 rue de la Paix, 94000 Créteil', null), 'Créteil');
  assert.equal(shortPlace('Saint-Denis', { type: 'municipality', city: 'Saint-Denis', postcode: '97400' }), 'Saint-Denis (974)');
});
