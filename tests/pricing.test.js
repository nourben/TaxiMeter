import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFare, sharedRate, applyDiscount } from '../js/core/pricing.js';
import { nightRateFor, isPublicHoliday } from '../js/core/period.js';

const km20 = { distanceKm: 20, ratePerKm: 1.2 };
const total = (p) => computeFare(p).total;

test('exemples fournis : hospitalisation 37,00 €, nuit 48,30 €, grande ville seule 47,20 €', () => {
  assert.equal(total({ ...km20, hospital: true }), 37);
  assert.equal(total({ ...km20, night: true }), 48.3);
  assert.equal(total({ ...km20, metropole: true }), 47.2);
});

test('sans majoration : prise en charge + distance', () => {
  assert.equal(total(km20), 32.2);
});

test('la nuit majore aussi le forfait grande ville', () => {
  assert.equal(total({ ...km20, night: true, metropole: true }), 70.8); // (13 + 15 + 19,20) × 1,5
});

test('hospitalisation : + 25 % sur les km, + 50 % à partir de 50 km', () => {
  assert.equal(total({ distanceKm: 49.9, ratePerKm: 1.2, hospital: true }), 81.85);
  assert.equal(total({ distanceKm: 50, ratePerKm: 1.2, hospital: true }), 95.8);
});

test('majorations cumulables : la nuit s’applique aussi à la majoration hospitalisation', () => {
  assert.equal(total({ ...km20, night: true, hospital: true }), 55.5); // (32,20 + 4,80) × 1,5
});

test('exemples vérifiés par l’utilisateur : 30 km à 1,07 €', () => {
  const km30 = { distanceKm: 30, ratePerKm: 1.07 };
  assert.equal(total({ ...km30, night: true }), 61.23);
  assert.equal(total({ ...km30, hospital: true }), 47.78);
  assert.equal(total({ ...km30, hospital: true, night: true }), 71.67);
  // ≥ 50 km : hospitalisation + 50 %, puis nuit
  assert.equal(total({ distanceKm: 60, ratePerKm: 1.07, hospital: true, night: true }), 154.32); // (13 + 59,92 + 29,96) × 1,5
});

test('nuit + hospitalisation + Métropole', () => {
  assert.equal(total({ distanceKm: 30, ratePerKm: 1.07, hospital: true, night: true, metropole: true }), 94.17); // (13 + 27,82 + 15 + 6,96) × 1,5
});

test('distance ≤ 4 km : seule la prise en charge (majorée la nuit)', () => {
  assert.equal(total({ distanceKm: 3, ratePerKm: 1.07 }), 13);
  assert.equal(total({ distanceKm: 4, ratePerKm: 1.07, night: true }), 19.5);
});

test('autres tarifs kilométriques', () => {
  assert.equal(total({ distanceKm: 20, ratePerKm: 1.07, hospital: true }), 34.4);
  assert.equal(total({ distanceKm: 20, ratePerKm: 1.22, hospital: true }), 37.4);
});

test('la somme des lignes = total', () => {
  const r = computeFare({ distanceKm: 57.3, ratePerKm: 1.22, night: true, hospital: true, metropole: true });
  assert.equal(Math.round(r.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, r.total);
});

test('distance invalide refusée', () => {
  assert.throws(() => computeFare({ distanceKm: -1, ratePerKm: 1.2 }));
  assert.throws(() => computeFare({ distanceKm: NaN, ratePerKm: 1.2 }));
});

test('nuit / week-end / férié selon la date', () => {
  const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);
  assert.equal(nightRateFor(at(2026, 11, 25, 19, 59)).active, false); // mercredi
  assert.equal(nightRateFor(at(2026, 11, 25, 20, 0)).active, true);
  assert.equal(nightRateFor(at(2026, 11, 26, 7, 59)).active, true);
  assert.equal(nightRateFor(at(2026, 11, 26, 8, 0)).active, false);
  assert.equal(nightRateFor(at(2026, 11, 28, 11, 59)).active, false); // samedi matin
  assert.equal(nightRateFor(at(2026, 11, 28, 12, 0)).active, true); // samedi 12 h
  assert.equal(nightRateFor(at(2026, 11, 29, 10, 0)).active, true); // dimanche
  assert.equal(nightRateFor(at(2026, 11, 11, 10, 0)).active, true); // 11 novembre
});

test('nuit : plus de la moitié du trajet entre 20 h et 8 h (durée connue)', () => {
  const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);
  assert.equal(nightRateFor(at(2026, 11, 25, 19, 40), undefined, 60).active, true); // milieu à 20:10
  assert.equal(nightRateFor(at(2026, 11, 25, 19, 40), undefined, 30).active, false); // milieu à 19:55
  assert.equal(nightRateFor(at(2026, 11, 26, 7, 40), undefined, 60).active, false); // milieu à 08:10
  assert.equal(nightRateFor(at(2026, 11, 28, 11, 40), undefined, 60).active, false); // samedi : heure de prise en charge
});

test('jours fériés mobiles', () => {
  assert.equal(isPublicHoliday(new Date(2027, 2, 29)), true); // lundi de Pâques 2027
  assert.equal(isPublicHoliday(new Date(2027, 4, 6)), true); // Ascension 2027
  assert.equal(isPublicHoliday(new Date(2027, 4, 17)), true); // lundi de Pentecôte 2027
  assert.equal(isPublicHoliday(new Date(2027, 2, 30)), false);
});

test('transport partagé : 23 % / 35 % / 37 % (4 et plus)', () => {
  assert.equal(sharedRate(1), 0);
  assert.equal(sharedRate(2), 0.23);
  assert.equal(sharedRate(3), 0.35);
  assert.equal(sharedRate(4), 0.37);
  assert.equal(sharedRate(7), 0.37);
});

test('abattement appliqué sur le total du trajet (majorations comprises)', () => {
  const base = computeFare({ ...km20, hospital: true, metropole: true }); // 52,00
  const r = applyDiscount(base, 0.23, 'Transport partagé', '2 patients');
  assert.equal(r.total, 40.04);
  assert.equal(Math.round(r.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, r.total);
  assert.equal(applyDiscount(base, 0.05, 'x', 'y').total, 49.4);
});

test('détail distance sous les km inclus : pas de soustraction négative', () => {
  const line = computeFare({ distanceKm: 3.8, ratePerKm: 1.07 }).lines.find((l) => l.key === 'distance');
  assert.equal(line.detail, '4 premiers km inclus');
  assert.equal(line.amount, 0);
});
