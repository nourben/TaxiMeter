// Infos contextuelles : bouton « i » qui déplie un panneau explicatif.
// Usage HTML : <button class="info-btn" data-info="cle">i</button> + contenu dans INFO_CONTENT.

import { TARIFS } from '../config/tarifs.js';

const n = (x) => String(x).replace('.', ',');
const t = TARIFS;


export const INFO_CONTENT = {
  trajet: `
    <p>Une course peut compter jusqu’à 20 trajets : chacun a sa distance, ses options et son prix ; le module « Prix estimé » fait le total.</p>
    <p>Le bouton Google Maps ouvre l’itinéraire : relevez les km et saisissez-les. Plus tard, l’API remplira la distance et le temps de trajet ; la distance restera modifiable (↺ pour revenir à la valeur calculée).</p>
    <p>Les <strong>${t.includedKm} premiers km</strong> sont compris dans la prise en charge de ${n(t.pickup)} €.</p>`,
  nuit: `
    <p><strong>+ ${n(t.majorations.night.rate * 100)} %</strong> sur l’ensemble du montant : prise en charge, forfait grande ville et kilomètres, majoration hospitalisation comprise.</p>
    <p>S’applique la nuit (${t.majorations.night.startHour} h – ${t.majorations.night.endHour} h), du samedi ${t.majorations.night.saturdayFromHour} h au dimanche soir et les jours fériés. À activer à la main selon l’heure de la course.</p>
    <p>Cumulable avec la majoration hospitalisation.</p>`,
  hospital: `
    <p>Transport lié à une hospitalisation (entrée, sortie, hôpital de jour, chimiothérapie, radiothérapie, dialyse…) avec l’aller ou le retour à vide.</p>
    <p><strong>+ ${n(t.majorations.hospital.rate * 100)} %</strong> sur le tarif kilométrique, <strong>+ ${n(t.majorations.hospital.longRate * 100)} %</strong> si le trajet fait ${t.majorations.hospital.longFromKm} km ou plus.</p>`,
  metropole: `
    <p>+ ${n(t.metropole.supplement)} €, majoré lui aussi la nuit, le week-end et les jours fériés.</p>
    <p>Forfait « grande ville », activé automatiquement si le départ ou la destination est à Paris, dans le 92, 93 ou 94, ou à ${t.metropole.cities.filter((c) => c !== 'Paris').join(', ')}. Modifiable à la main.</p>`,
  partage: `
    <p><strong>Transport partagé</strong> (patients transportés ensemble) : chaque trajet reçoit obligatoirement un abattement de 23 % pour 2 patients, 35 % pour 3, 37 % pour 4 ou plus, sur la totalité de son prix. Un trajet fait séparément doit être exclu du prix.</p>
    <p>Un patient <strong>seul dans le véhicule sur 30 km ou plus</strong> n’a qu’un abattement de 5 %, sur sa facture uniquement.</p>
    <p>Source : convention-cadre nationale des taxis conventionnés (JO du 8 août 2025).</p>`,
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
