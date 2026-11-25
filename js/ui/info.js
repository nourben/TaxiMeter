// Infos contextuelles : bouton « i » qui déplie un panneau explicatif.
// Usage HTML : <button class="info-btn" data-info="cle">i</button> + contenu dans INFO_CONTENT.

import { TARIFS } from '../config/tarifs.js';

const n = (x) => String(x).replace('.', ',');
const t = TARIFS;

const jour = t.periods.jour;
const nuit = t.periods.nuit;

export const INFO_CONTENT = {
  trajet: `
    <p>Une course peut compter jusqu’à 20 trajets : chacun a sa distance, ses options et son prix ; le module « Prix estimé » fait le total.</p>
    <p>Le bouton Google Maps ouvre l’itinéraire : relevez les km et saisissez-les. Plus tard, l’API remplira la distance et le temps de trajet ; la distance restera modifiable (↺ pour revenir à la valeur calculée).</p>
    <p>Les <strong>${t.includedKm} premiers km</strong> sont compris dans la prise en charge de ${n(t.pickup)} €.</p>`,
  horaire: `
    <p><strong>Jour</strong> (${jour.startHour} h–${nuit.startHour} h) : × ${n(jour.multiplier)} sur la distance, × ${n(jour.longDistance.multiplier)} à partir de ${jour.longDistance.fromKm} km.</p>
    <p><strong>Nuit</strong> (${nuit.startHour} h–${jour.startHour} h) : × ${n(nuit.multiplier)} sur le total.</p>
    <p>Choisi selon l’heure actuelle ; changez-le pour préparer un trajet du soir ou du lendemain.</p>`,
  metropole: `
    <p>+ ${n(t.metropole.supplement)} €, cumulable avec jour ou nuit.</p>
    <p>Auto si le départ ou la destination est à moins de ${t.metropole.radiusKm} km à vol d’oiseau du centre de Paris (≈ Paris – Créteil) ou en ${t.metropole.departments.join(', ')}. Modifiable à la main.</p>`,
  tarifKm: `
    <p>Prix par km au-delà des ${t.includedKm} km inclus : ${t.ratesPerKm.map((r) => `${n(r.toFixed(2))} €`).join(' · ')}.</p>
    <p>${n(t.defaultRatePerKm.toFixed(2))} € par défaut ; les autres s’affichent en couleur pour éviter une erreur.</p>`,
};

let counter = 0;

export function initInfoButtons(root = document) {
  root.querySelectorAll('.info-btn[data-info]').forEach((btn) => {
    if (btn.dataset.ready) return;
    btn.dataset.ready = '1';
    const key = btn.dataset.info;
    const panel = document.createElement('div');
    panel.className = 'info-panel hidden';
    panel.id = `info-${key}-${++counter}`;
    panel.innerHTML = INFO_CONTENT[key] ?? '';
    // Le panneau se place juste après la ligne du label
    const anchor = btn.closest('.switch-row, .opt-row') ?? btn.closest('.label-row, .card-head') ?? btn;
    anchor.insertAdjacentElement('afterend', panel);

    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', panel.id);
    btn.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Plus d’informations');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.classList.toggle('hidden', open);
    });
  });
}
