// Infos contextuelles : bouton « i » qui déplie un panneau explicatif.
// Usage HTML : <button class="info-btn" data-info="cle">i</button> + contenu dans INFO_CONTENT.

import { TARIFS, ROUTING_RULES } from '../config/tarifs.js';

const n = (x) => String(x).replace('.', ',');
const t = TARIFS;

export const INFO_CONTENT = {
  trajet: `
    <p>Saisissez une adresse complète ou simplement une ville.</p>
    <p>Le bouton Google Maps ouvre l’itinéraire en voiture : relevez le nombre de km et reportez-le dans le champ Distance.</p>`,
  distance: `
    <p>Distance du trajet en kilomètres (décimales acceptées, ex. 18,6).</p>
    <p>Les <strong>${t.includedKm} premiers km</strong> sont compris dans la prise en charge de ${n(t.pickup)} €.</p>
    <p>Plus tard, ce champ sera rempli automatiquement par le calcul d’itinéraire ; vous pourrez toujours le corriger, et un bouton ↺ permettra de revenir à la valeur calculée.</p>`,
  duree: `
    <p>Facultatif : temps de trajet indiqué par Google Maps. Il n’entre pas dans le prix, il est affiché à titre d’information.</p>
    <p>Avec l’API, si le trajet est nettement plus long que « 1 km = 1 min » (seuil × ${n(ROUTING_RULES.slowRatio)}), on cherchera un itinéraire plus rapide de ${ROUTING_RULES.maxDetourKm} km de plus maximum ; sinon on garde le plus court.</p>`,
  horaire: `
    <p><strong>Jour</strong> : de ${t.periods.jour.startHour} h à ${t.periods.nuit.startHour} h — coefficient × ${n(t.periods.jour.multiplier)} appliqué à la distance.</p>
    <p><strong>Nuit</strong> : de ${t.periods.nuit.startHour} h à ${t.periods.jour.startHour} h — coefficient × ${n(t.periods.nuit.multiplier)} appliqué au total (prise en charge + distance).</p>
    <p>Le tarif est choisi automatiquement selon l’heure de départ. Vous pouvez le forcer à la main.</p>`,
  metropole: `
    <p>Supplément de <strong>${n(t.metropole.supplement)} €</strong>, cumulable avec le tarif de jour ou de nuit.</p>
    <p>Activé automatiquement si le <strong>départ ou la destination</strong> est à moins de ${t.metropole.radiusKm} km à vol d’oiseau du centre de Paris (≈ distance Paris – Créteil), ou dans Paris / petite couronne (${t.metropole.departments.join(', ')}).</p>
    <p>Vous pouvez l’activer ou le désactiver à la main.</p>`,
  tarifKm: `
    <p>Prix par kilomètre au-delà des ${t.includedKm} km inclus.</p>
    <p>${t.ratesPerKm.map((r) => `${n(r.toFixed(2))} €`).join(' · ')} — ${n(t.defaultRatePerKm.toFixed(2))} € par défaut.</p>`,
  secondeCourse: `
    <p>Pour un 2e client qui part du même endroit vers une destination proche.</p>
    <p>Chaque course est calculée séparément avec le même horaire et le même tarif au km ; la Métropole est vérifiée pour chacune.</p>`,
};

export function initInfoButtons(root = document) {
  root.querySelectorAll('.info-btn[data-info]').forEach((btn, i) => {
    if (btn.dataset.ready) return;
    btn.dataset.ready = '1';
    const key = btn.dataset.info;
    const panel = document.createElement('div');
    panel.className = 'info-panel hidden';
    panel.id = `info-${key}-${i}`;
    panel.innerHTML = INFO_CONTENT[key] ?? '';
    // Le panneau se place juste après la ligne du label
    const anchor = btn.closest('.switch-row') ?? btn.closest('.label-row, .card-head') ?? btn;
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
