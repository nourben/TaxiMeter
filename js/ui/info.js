// Infos contextuelles : bouton « i » qui déplie un panneau explicatif.
// Usage HTML : <button class="info-btn" data-info="cle">i</button> + contenu dans INFO_CONTENT.

import { TARIFS } from '../config/tarifs.js';

const n = (x) => String(x).replace('.', ',');
const t = TARIFS;

export const INFO_CONTENT = {
  trajet: `
    <p>Une course peut compter jusqu’à 20 trajets : chacun a sa distance, ses options et son prix ; le module Prix fait le total.</p>
    <p>Le lien Google Maps ouvre l’itinéraire : relevez les km et saisissez-les. Plus tard, l’API remplira la distance et le temps de trajet ; la distance restera modifiable (↺ pour revenir à la valeur calculée).</p>
    <p>Les <strong>${t.includedKm} premiers km</strong> sont compris dans la prise en charge de ${n(t.pickup)} €.</p>`,
  options: `
    <p><strong>Jour</strong> (${t.periods.jour.startHour} h–${t.periods.nuit.startHour} h) : × ${n(t.periods.jour.multiplier)} sur la distance. <strong>Nuit</strong> (${t.periods.nuit.startHour} h–${t.periods.jour.startHour} h) : × ${n(t.periods.nuit.multiplier)} sur le total. Choisi selon l’heure actuelle ; changez-le pour préparer un trajet du soir ou du lendemain.</p>
    <p><strong>Métropole</strong> : + ${n(t.metropole.supplement)} €, cumulable. Auto si le départ ou la destination est à moins de ${t.metropole.radiusKm} km à vol d’oiseau du centre de Paris (≈ Paris – Créteil) ou en ${t.metropole.departments.join(', ')}.</p>
    <p><strong>Tarif au km</strong> : ${t.ratesPerKm.map((r) => `${n(r.toFixed(2))} €`).join(' · ')} (${n(t.defaultRatePerKm.toFixed(2))} € par défaut, les autres s’affichent en couleur).</p>`,
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
    const anchor = btn.closest('.switch-row, .opts') ?? btn.closest('.label-row, .card-head') ?? btn;
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
