import { TARIFS, MAX_TRIPS, SHARED_TRANSPORT, ALL_RATES, DEPARTMENT_RATES } from '../config/tarifs.js';
import { computeFare, formatEuro, round2, sharedRate, applyDiscount } from '../core/pricing.js';
import { checkMetropole } from '../core/metropole.js';
import { googleMapsDirectionsUrl } from '../services/maps-link.js';
import { geocode, suggest } from '../services/geocoding.js';
import { attachAutocomplete } from '../ui/autocomplete.js';
import { suggestCenter } from '../core/nearby.js';

const DEPT_KEY = 'taximeter.dept';
/** Département choisi dans la recherche de tarif, mémorisé pour centrer les suggestions d'adresses. */
function savedDept() {
  try {
    return localStorage.getItem(DEPT_KEY);
  } catch {
    return null;
  }
}
function saveDept(code) {
  try {
    localStorage.setItem(DEPT_KEY, code);
  } catch {
    /* navigation privée : non mémorisé */
  }
}

// DEBUG TEMPORAIRE : affiche le centre des suggestions sous le prix
function showCenterDebug(key, center) {
  const out = document.getElementById('zone-debug');
  if (out) out.textContent = `Suggestions ${key === 'origin' ? 'départ' : 'destination'} : ${center ? `autour du ${center.source}` : 'aucun centre'}`;
}
import { scheduleEstimateLog, logDistanceCalculation } from '../services/estimates-log.js';
import { computeRoute } from '../services/route.js';
import { initInfoButtons } from '../ui/info.js';
import { attachDeptPicker } from '../ui/dept-picker.js';
import { attachWhenPicker, formatDeparture, futureOrNull } from '../ui/when-picker.js';
import { shortestRoute, fasterAlternative } from '../core/route-choice.js';
import { nightRateFor } from '../core/period.js';
import { encodeShare, decodeShare, shortPlace } from '../core/share-link.js';
import { attachShare } from '../ui/share.js';
import { FEATURES } from '../config/features.js';

const RATE_KEY = 'taximeter.rate';
/** Dernier tarif au km choisi, mémorisé dans le navigateur. */
function preferredRate() {
  try {
    const r = Number(localStorage.getItem(RATE_KEY));
    if (ALL_RATES.includes(r)) return r;
  } catch {
    /* stockage indisponible */
  }
  return TARIFS.defaultRatePerKm;
}
/** Tarif de référence de la page : le tarif mémorisé à l'ouverture, sinon le tarif par défaut. */
const BASE_RATE = preferredRate();

function savePreferredRate(r) {
  try {
    localStorage.setItem(RATE_KEY, String(r));
  } catch {
    /* navigation privée : non mémorisé */
  }
}

const $ = (id) => document.getElementById(id);
const num = (s) => String(s).replace('.', ',');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const el = {
  trips: $('trips'),
  title: $('h-trips'),
  add: $('add-trip'),
  limit: $('trip-limit'),
  priceTitle: $('h-price'),
  priceTotal: $('price-total'),
  priceNote: $('price-note'),
  priceList: $('price-list'),
  reset: $('reset-form'),
  sharedRow: $('shared-row'),
  sharedDetail: $('shared-detail'),
  toast: $('toast'),
};

/* ---------- État ---------- */

let seq = 0;
/**
 * Un trajet. metropole vaut null en mode automatique ; la majoration de nuit se choisit à la main.
 * apiDistance / apiDuration seront remplis par l'API itinéraire.
 */
function newTrip() {
  return {
    id: ++seq,
    origin: '',
    destination: '',
    distance: '',
    apiDistance: null,
    apiDuration: null,
    routes: null, // itinéraires renvoyés par le dernier calcul
    routeChoice: 'shortest', // 'shortest' | 'faster' (mode optimisé)
    night: null, // null : automatique selon l'heure de départ ; true / false : choisi à la main
    hospital: false,
    metropole: null,
    rate: preferredRate(),
    otherRate: null, // dernier tarif choisi hors boutons rapides (liste « Autres » ou recherche par département)
    excluded: false,
    soloLong: false,
    copiedFromFirst: false,
    calculating: false,
    calcKey: null,
    departAt: null,
    lastDepartAt: null, // dernière heure choisie, reprise en décochant « Maintenant »
    routeMsg: null,
    geo: { origin: null, destination: null },
  };
}

/** optimized : mode « Itinéraire optimisé » (non mémorisé : on repart toujours du plus court). */
const state = { trips: [newTrip()], openFares: new Set(), optimized: false };

/* ---------- Calculs dérivés ---------- */

/** Distance écrite à la française dans le champ : 37,4 */
function kmText(km) {
  return String(km).replace('.', ',');
}

function readKm(value) {
  const raw = String(value).trim().replace(',', '.');
  if (raw === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** Majoration nuit / WE / férié déduite de l'heure de départ (heure choisie, sinon maintenant). */
function autoNight(t) {
  const at = futureOrNull(t.departAt) ?? Date.now();
  return nightRateFor(new Date(at), TARIFS, t.apiDuration);
}

function effectiveNight(t) {
  return t.night ?? autoNight(t).active;
}

function placeFor(t, key) {
  const text = t[key].trim();
  if (!text) return null;
  const g = t.geo[key];
  return g && g.query === text ? { text, ...g } : { text };
}

function detectMetro(t) {
  const o = checkMetropole(placeFor(t, 'origin'));
  if (o.inZone) return { inZone: true, reason: `départ, ${o.reason}` };
  const d = checkMetropole(placeFor(t, 'destination'));
  if (d.inZone) return { inZone: true, reason: `destination, ${d.reason}` };
  return { inZone: false, reason: null };
}

function effectiveMetro(t) {
  return t.metropole ?? detectMetro(t).inZone;
}

/** Transport partagé : nombre de patients (trajets inclus avec une distance) et taux d'abattement. */
function sharedContext() {
  const patients = state.trips.filter((t) => !t.excluded && readKm(t.distance) != null).length;
  return { patients, rate: sharedRate(patients) }; // imposé dès 2 patients
}

const pct = (rate) => `${Math.round(rate * 100)} %`;

function fareOf(t) {
  const distanceKm = readKm(t.distance);
  if (distanceKm == null) return null;
  const params = { distanceKm, ratePerKm: t.rate, night: effectiveNight(t), hospital: t.hospital, metropole: effectiveMetro(t), discount: 0 };
  let fare = computeFare(params);
  const ctx = sharedContext();
  if (!t.excluded && ctx.rate) {
    const solo = t.soloLong && distanceKm >= SHARED_TRANSPORT.soloLong.minKm;
    params.discount = solo ? SHARED_TRANSPORT.soloLong.rate : ctx.rate;
    fare = solo
      ? applyDiscount(fare, params.discount, 'Patient seul ≥ 30 km', `− ${pct(params.discount)}`)
      : applyDiscount(fare, params.discount, 'Transport partagé', `− ${pct(params.discount)} · ${ctx.patients} patients`);
  }
  return { params, fare };
}

/* ---------- Rendu d'un trajet (créé une fois, puis mis à jour) ---------- */

const PIN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const ICON_HOSP =
  '<svg class="period-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M12 7.5v9M7.5 12h9"/></svg>';
const ICON_NIGHT =
  '<svg class="period-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M14.8 6.6a5.6 5.6 0 1 0 2.6 9.6 4.6 4.6 0 0 1-2.6-9.6z"/></svg>';

const ICON_ROUTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/></svg>';
const ICON_SWAP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5"/></svg>';
const ICON_CLOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_CLEAR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
const ICON_TRASH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>';
const ICON_EYE_OFF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.4-1.1"/></svg>';
const ICON_EYE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></svg>';

function tripTemplate(t) {
  const rates = TARIFS.ratesPerKm
    .map((r) => {
      const id = `rate-${t.id}-${String(r).replace('.', '')}`;
      const nd = r === BASE_RATE ? '' : ' class="nondefault"';
      return `<input type="radio" name="rate-${t.id}" id="${id}" value="${r}" data-f="rate"${nd} /><label for="${id}">${num(r.toFixed(2))} €</label>`;
    })
    .join('');
  const others = ALL_RATES.map((r) => `<option value="${r}">${num(r.toFixed(2))} €</option>`).join('');
  const otherRate = `<span class="seg-other" data-o="rate-other-wrap"><span class="seg-other-label" data-o="rate-other-label" aria-hidden="true">Autres ▾</span><select data-f="rate-other" aria-label="Autres tarifs au km"><option value="" disabled>Autres tarifs</option>${others}</select></span>`;
  return `
    <div class="trip-head">
      <span class="trip-title" data-o="title"></span>
      <span class="trip-price" data-o="price"></span>
      <div class="trip-actions">
        <button type="button" class="btn btn-sm" data-a="exclude"></button>
        <button type="button" class="btn btn-sm btn-danger" data-a="remove" aria-label="Supprimer ce trajet" title="Supprimer ce trajet">${ICON_TRASH}<span class="btn-label">Supprimer ce trajet</span></button>
      </div>
    </div>
    <div class="trip-body">
      <div class="route-row">
        <div class="route">
            <div class="route-line from"><input type="text" data-f="origin" placeholder="Départ" aria-label="Départ (adresse ou ville)" enterkeyhint="next" /><button type="button" class="field-clear hidden" data-a="clear-place" data-key="origin" aria-label="Vider le départ" title="Vider le départ">×</button></div>
            <div class="route-line to"><input type="text" data-f="destination" placeholder="Destination" aria-label="Destination (adresse ou ville)" enterkeyhint="next" /><button type="button" class="field-clear hidden" data-a="clear-place" data-key="destination" aria-label="Vider la destination" title="Vider la destination">×</button></div>
        </div>
        <button type="button" class="swap-btn" data-a="swap" data-o="swap" aria-label="Inverser départ et destination" title="Inverser départ et destination" disabled>${ICON_SWAP}</button>
      </div>
      <div class="when-field">
        <button type="button" class="when-btn">
          ${ICON_CLOCK}
          <span class="when-label"><span class="wide-only">Départ </span><strong data-o="when">Maintenant</strong></span>
          <span class="when-caret" aria-hidden="true">▾</span>
        </button>
        <label class="when-now hidden" data-o="when-now" title="Calculer pour un départ immédiat">
          <input type="checkbox" data-f="departNow" />
          <span>Maintenant</span>
        </label>
      </div>
      <div class="route-actions">
          <button type="button" class="calc-btn" data-a="calc" data-o="calc" disabled>
            ${ICON_ROUTE}
            <span data-o="calc-label">Calculer la distance<small>itinéraire le plus court</small></span>
          </button>
          <a class="maps-btn" data-o="maps" target="_blank" rel="noopener">
            ${PIN}
            <span class="maps-label"><span>Afficher le trajet</span><span>sur Google Maps</span></span>
          </a>
      </div>
      <p class="route-msg hidden" data-o="route-msg" role="status"></p>
      <div class="route-choices hidden" data-o="choices" role="radiogroup" aria-label="Itinéraire facturé"></div>
      <div class="opt-row opt-km">
      <div class="km-field opt-wide">
        <input type="text" data-f="distance" inputmode="decimal" placeholder="Distance" aria-label="Distance en km" />
        <button type="button" class="km-reset hidden" data-a="reset-km" aria-label="Revenir à la distance calculée" title="Revenir à la distance calculée">↺</button>
        <span class="suffix">km</span>
      </div>
      <button type="button" class="icon-mini" data-a="clear-km" data-o="clear-km" aria-label="Vider la distance" title="Vider la distance">${ICON_CLEAR}</button>
      <div class="trip-meta opt-side">
        <button type="button" class="link-btn same-km" data-a="same-km">Même km que le trajet 1</button>
      </div>
      </div>
      <p class="copy-note hidden" data-o="copy-note">Métropole activée comme pour le trajet 1 (même kilométrage repris).</p>
      <div class="opts">
        <h3 class="opts-title">Tarification</h3>
        <div class="opt-row">
          <button type="button" class="chip opt-wide chip-icon" data-a="hospital" aria-pressed="false">${ICON_HOSP}<span data-o="hosp-label">Hospitalisation (HDJ)</span></button>
          <button class="info-btn" data-info="hospital" aria-label="Aide sur la majoration hospitalisation">i</button>
        </div>
        <div class="opt-row opt-night">
          <button type="button" class="chip opt-wide chip-icon" data-a="night" aria-pressed="false">${ICON_NIGHT}<span data-o="night-label">Nuit / WE / férié</span></button>
          <button class="info-btn" data-info="nuit" aria-label="Aide sur la majoration nuit, week-end et jours fériés">i</button>
          <button type="button" class="link-btn auto-link hidden" data-a="night-auto" data-o="night-auto" title="Repasser en automatique selon l’heure de départ">↺ auto</button>
        </div>
        <div class="opt-row opt-metro">
          <button type="button" class="chip opt-wide" data-a="metro" aria-pressed="false">Métropole</button>
          <button class="info-btn" data-info="metropole" aria-label="Aide sur la zone Métropole">i</button>
          <button type="button" class="link-btn auto-link hidden" data-a="metro-auto" data-o="metro-auto" title="Repasser en automatique">↺ auto</button>
        </div>
        <div class="opt-row opt-rate">
          <div class="segmented seg-sm opt-wide" role="radiogroup" aria-label="Tarif kilométrique">${rates}${otherRate}</div>
          <button class="info-btn" data-info="tarifkm" aria-label="Aide sur le tarif kilométrique">i</button>
          <p class="trip-hint opt-side hidden" data-o="hint-rate"></p>
        </div>
        <div class="opt-row opt-solo hidden" data-o="solo-row">
          <label class="chip opt-wide solo-chip">
            <input type="checkbox" data-f="soloLong" />
            <span>Patient seul sur 30 km ou plus (− 5 %)</span>
          </label>
          <button class="info-btn" data-info="partage" aria-label="Aide sur le transport partagé">i</button>
        </div>
      </div>
    </div>`;
}

function tripNode(t) {
  return el.trips.querySelector(`.trip[data-id="${t.id}"]`);
}

function mountTrip(t) {
  const node = document.createElement('div');
  node.className = 'trip';
  node.dataset.id = t.id;
  node.innerHTML = tripTemplate(t);
  for (const f of ['origin', 'destination', 'distance']) node.querySelector(`[data-f="${f}"]`).value = t[f];
  el.trips.appendChild(node);
  initInfoButtons(node);
  node.querySelectorAll('.dept-pick').forEach(attachDeptPicker);
  // État auto / manuel affiché en tête de l'info contextuelle de chaque option
  for (const [info, out] of [
    ['metropole', 'hint-metro'],
    ['nuit', 'hint-night'],
  ]) {
    const panel = document.getElementById(node.querySelector(`[data-info="${info}"]`).getAttribute('aria-controls'));
    panel.insertAdjacentHTML('afterbegin', `<p class="info-status" data-o="${out}"></p>`);
  }
  for (const key of ['origin', 'destination']) {
    const input = node.querySelector(`[data-f="${key}"]`);
    attachAutocomplete(input, {
      // Destination : autour du départ choisi ; sinon autour du département mémorisé
      fetch: (q, signal) => {
        const g = t.geo.origin;
        const origin = key === 'destination' && g && g.query === t.origin.trim() ? g : null;
        const center = suggestCenter({ origin, dept: savedDept() });
        showCenterDebug(key, center);
        return suggest(q, signal, center);
      },
      onSelect: (place) => {
        input.value = place.label;
        t[key] = place.label;
        t.geo[key] = { ...place, query: place.label };
        clearTimeout(geoTimers.get(`${t.id}-${key}`));
        update();
      },
    });
  }
  pickers.set(
    t.id,
    attachWhenPicker(node.querySelector('.when-field'), {
      get: () => t.departAt,
      set: (ms) => {
        t.departAt = ms;
        if (ms != null) t.lastDepartAt = ms;
        t.night = null; // nouvelle heure : la majoration nuit repasse en automatique
        update();
      },
    }),
  );
  return node;
}

function updateTrip(t, index, count) {
  const node = tripNode(t);
  const o = (k) => node.querySelector(`[data-o="${k}"]`);
  const multi = count > 1;

  node.querySelector('.trip-head').classList.toggle('hidden', !multi);
  o('title').textContent = `Trajet ${index + 1}`;
  node.querySelector('.trip-actions').classList.toggle('hidden', index === 0);
  const excludeBtn = node.querySelector('[data-a="exclude"]');
  excludeBtn.innerHTML = t.excluded
    ? `${ICON_EYE}<span class="btn-label">Inclure dans le prix</span>`
    : `${ICON_EYE_OFF}<span class="btn-label">Exclure du prix</span>`;
  excludeBtn.setAttribute('aria-label', t.excluded ? 'Inclure dans le prix' : 'Exclure du prix');
  excludeBtn.title = excludeBtn.getAttribute('aria-label');
  excludeBtn.setAttribute('aria-pressed', String(!!t.excluded));
  node.classList.toggle('excluded', !!t.excluded);
  const r = fareOf(t);
  o('price').textContent = t.excluded ? 'exclu' : r ? formatEuro(r.fare.total) : '';

  // Distance : bouton ↺ seulement si l'API a donné une valeur et qu'elle a été modifiée
  const km = readKm(t.distance);
  node.querySelector('[data-a="reset-km"]').classList.toggle('hidden', t.apiDistance == null || km === t.apiDistance);

  o('clear-km').classList.toggle('is-invisible', !String(t.distance).trim());
  o('copy-note').classList.toggle('hidden', !(index > 0 && t.copiedFromFirst && effectiveMetro(t)));
  const sameKm = node.querySelector('[data-a="same-km"]');
  const firstKm = readKm(state.trips[0].distance);
  sameKm.classList.toggle('hidden', index === 0 || firstKm == null || firstKm === km);


  o('swap').disabled = !t.origin.trim() && !t.destination.trim();
  for (const b of node.querySelectorAll('[data-a="clear-place"]')) b.classList.toggle('hidden', !t[b.dataset.key]);
  // Une heure dépassée (ou l'heure actuelle) repasse en « Maintenant »
  const departAt = futureOrNull(t.departAt);
  o('when').textContent = formatDeparture(departAt);
  o('when-now').classList.toggle('hidden', t.lastDepartAt == null);
  o('when-now').querySelector('input').checked = departAt == null;

  // Calcul : désactivé une fois fait, réactivé dès que départ, destination ou heure changent
  const calc = o('calc');
  const ready = t.origin.trim().length >= 2 && t.destination.trim().length >= 2;
  const done = t.calcKey != null && t.calcKey === calcKeyOf(t);
  calc.disabled = !ready || t.calculating || done;
  calc.classList.toggle('is-done', done && !t.calculating);
  o('calc-label').innerHTML = t.calculating
    ? 'Calcul en cours…<small>interrogation de Google</small>'
    : 'Calculer la distance<small>itinéraire le plus court</small>';
  // Mode optimisé : le plus court et l'alternative plus rapide côte à côte, au choix
  const choice = routeOptions(t);
  const choices = o('choices');
  choices.classList.toggle('hidden', !choice);
  choices.innerHTML = choice ? choicesHtml(t, choice) : '';

  const msg = o('route-msg');
  msg.classList.toggle('hidden', !t.routeMsg || !!choice);
  msg.classList.toggle('is-error', !!t.routeMsg?.error);
  const dur = !t.routeMsg?.error && Number.isFinite(t.routeMsg?.durationMin) ? formatDuration(t.routeMsg.durationMin) : '';
  const at = t.routeMsg?.departAt ? `<small>départ ${esc(formatDeparture(t.routeMsg.departAt).replace(/^Aujourd’hui à /, ''))}</small>` : '';
  const noAlt = state.optimized && !t.routeMsg?.error && t.routes ? ' · pas d’itinéraire plus rapide intéressant' : '';
  msg.innerHTML = t.routeMsg
    ? `<span>${esc(t.routeMsg.text)}${noAlt}</span>${dur ? `<span class="route-time" title="Temps de trajet estimé, trafic compris">⏱ ${dur}${at}</span>` : ''}`
    : '';

  const maps = o('maps');
  if (t.origin.trim() && t.destination.trim()) {
    maps.href = googleMapsDirectionsUrl(t.origin, t.destination);
    maps.removeAttribute('aria-disabled');
  } else {
    maps.removeAttribute('href');
    maps.setAttribute('aria-disabled', 'true');
  }

  // Options
  const night = effectiveNight(t);
  const nightChip = node.querySelector('[data-a="night"]');
  nightChip.setAttribute('aria-pressed', String(night));
  o('night-label').textContent = night ? '✓ Nuit / WE / férié' : 'Nuit / WE / férié';
  const hospChip = node.querySelector('[data-a="hospital"]');
  hospChip.setAttribute('aria-pressed', String(t.hospital));
  const H = TARIFS.majorations.hospital;
  const longHosp = (readKm(t.distance) ?? 0) >= H.longFromKm;
  o('hosp-label').textContent = t.hospital
    ? `✓ HDJ +${Math.round((longHosp ? H.longRate : H.rate) * 100)} % sur les km`
    : 'Hospitalisation (HDJ)';
  const metro = effectiveMetro(t);
  const chip = node.querySelector('[data-a="metro"]');
  chip.setAttribute('aria-pressed', String(metro));
  chip.textContent = metro ? `✓ Métropole +${num(TARIFS.metropole.supplement)} €` : 'Métropole';
  for (const radio of node.querySelectorAll('[data-f="rate"]')) radio.checked = Number(radio.value) === t.rate;


  let metroText;
  if (t.metropole == null) {
    const det = detectMetro(t);
    if (det.inZone) metroText = `Métropole auto : détectée (${esc(det.reason)})`;
    else if (t.origin.trim() || t.destination.trim()) metroText = 'Métropole auto : non détectée';
    else metroText = 'Métropole auto : selon le départ et la destination';
  } else {
    metroText = `Métropole ${t.metropole ? 'ajoutée' : 'retirée'} à la main`;
  }
  o('hint-metro').innerHTML = metroText;
  o('metro-auto').classList.toggle('hidden', t.metropole == null);

  const autoN = autoNight(t);
  o('hint-night').textContent = t.night == null
    ? `Automatique : ${autoN.active ? 'activée' : 'non activée'}, ${autoN.reason}`
    : `${t.night ? 'Activée' : 'Retirée'} à la main`;
  o('night-auto').classList.toggle('hidden', t.night == null);

  const ctxShared = sharedContext();
  const soloRow = o('solo-row');
  soloRow.classList.toggle('hidden', !(ctxShared.rate && !t.excluded));
  const soloInput = soloRow.querySelector('[data-f="soloLong"]');
  const longEnough = (readKm(t.distance) ?? 0) >= SHARED_TRANSPORT.soloLong.minKm;
  soloInput.checked = t.soloLong && longEnough;
  soloInput.disabled = !longEnough;
  soloRow.querySelector('.solo-chip').classList.toggle('is-disabled', !longEnough);
  soloRow.querySelector('.solo-chip').classList.toggle('is-on', t.soloLong && longEnough);

  // Tarif hors boutons rapides : affiché dans « Autres »
  const quick = TARIFS.ratesPerKm.includes(t.rate);
  if (!quick) t.otherRate = t.rate;
  const other = quick ? t.otherRate : t.rate; // tarif gardé dans « Autres » même quand un bouton rapide est choisi
  const otherSel = node.querySelector('[data-f="rate-other"]');
  otherSel.value = other != null ? String(other) : '';
  o('rate-other-label').textContent = other != null ? `${num(other.toFixed(2))} € ▾` : 'Autres ▾';
  o('rate-other-wrap').classList.toggle('is-on', !quick);
  o('rate-other-wrap').classList.toggle('nondefault', !quick && t.rate !== BASE_RATE);
  const dept = node.querySelector('[data-f="dept"]');
  const deptOut = node.querySelector('[data-o="dept-rate"]');
  if (dept && deptOut) {
    const found = DEPARTMENT_RATES.find(([code]) => code === dept.value);
    const applied = found && found[2] === t.rate;
    o('dept-label').textContent = found ? `${found[0]} – ${found[1]}` : 'Choisir un département';
    deptOut.classList.toggle('hidden', !found);
    deptOut.classList.toggle('is-applied', !!applied);
    deptOut.innerHTML = !found ? '' : applied
      ? `✓ Tarif appliqué à ce trajet : <strong>${num(found[2].toFixed(2))} €/km</strong>`
      : `Tarif du département : <strong>${num(found[2].toFixed(2))} €/km</strong>`;
  }

  const rateHint = o('hint-rate');
  const nonDefault = t.rate !== BASE_RATE;
  rateHint.classList.toggle('hidden', !nonDefault);
  rateHint.innerHTML = nonDefault
    ? `<span class="warn-text">Tarif ${num(t.rate.toFixed(2))} €/km au lieu de ${num(BASE_RATE.toFixed(2))} €</span>`
    : '';
}

/** Mode optimisé : { shortest, faster } si une alternative plus rapide mérite d'être proposée, sinon null. */
function routeOptions(t) {
  if (!state.optimized || !t.routes || t.routeMsg?.error) return null;
  const faster = fasterAlternative(t.routes);
  return faster ? { shortest: shortestRoute(t.routes), faster } : null;
}

function fareFor(t, km) {
  return fareOf({ ...t, distance: String(km) })?.fare.total ?? null;
}

function choicesHtml(t, { shortest, faster }) {
  const extraKm = round2(faster.distanceKm - shortest.distanceKm);
  const gain = shortest.durationMin - faster.durationMin;
  const a = fareFor(t, shortest.distanceKm);
  const b = fareFor(t, faster.distanceKm);
  const euros = a != null && b != null ? ` · +${formatEuro(round2(b - a))}` : '';
  const card = (key, title, r, detail) => {
    const on = t.routeChoice === key;
    return `<button type="button" class="route-choice${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-a="choose" data-choice="${key}">
      <span class="rc-title">${title}</span>
      <span class="rc-main">${fmtKm(r.distanceKm)} · ${formatDuration(r.durationMin)}</span>
      <span class="rc-detail">${detail}</span>
    </button>`;
  };
  return (
    card('shortest', 'Le plus court', shortest, 'distance de référence') +
    card('faster', 'Plus rapide', faster, `+${num(extraKm)} km · −${formatDuration(gain)}${euros}`)
  );
}

/** Applique l'itinéraire choisi (distance et durée) à un trajet. */
function applyChoice(t, key) {
  const opts = routeOptions(t);
  const r = key === 'faster' && opts ? opts.faster : shortestRoute(t.routes);
  if (!r) return;
  t.routeChoice = key === 'faster' && opts ? 'faster' : 'shortest';
  t.apiDistance = r.distanceKm;
  t.apiDuration = r.durationMin;
  t.distance = kmText(r.distanceKm);
  t.copiedFromFirst = false;
  tripNode(t).querySelector('[data-f="distance"]').value = t.distance;
}

/** Bascule du mode « Itinéraire optimisé » ; en le quittant, chaque trajet revient au plus court. */
function setOptimized(on) {
  state.optimized = on;
  const btn = $('optimized-toggle');
  btn?.setAttribute('aria-checked', String(on));
  for (const t of state.trips) if (t.routeChoice === 'faster' && !on) applyChoice(t, 'shortest');
  update();
}

/** Ce qui détermine un calcul : départ, destination et heure de départ (une heure passée vaut « maintenant »). */
function calcKeyOf(t) {
  const at = futureOrNull(t.departAt) ?? 'now';
  return `${t.origin.trim()}|${t.destination.trim()}|${at}`;
}

function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/* ---------- Module prix ---------- */

function breakdownTable(fare) {
  const rows = fare.lines
    .map(
      (l) =>
        `<tr${l.key === 'discount' ? ' class="discount"' : ''}><td>${l.label} <span class="detail">${l.detail}</span></td><td>${l.key === 'discount' ? '− ' + formatEuro(-l.amount) : (l.key === 'pickup' || l.key === 'distance' ? '' : '+ ') + formatEuro(l.amount)}</td></tr>`,
    )
    .join('');
  return `<table class="breakdown"><tbody>${rows}</tbody></table>`;
}

function summaryLabel(params) {
  const bits = [`${num(params.distanceKm)} km`];
  if (params.night) bits.push('Nuit/WE/férié');
  if (params.hospital) bits.push('Hospitalisation');
  if (params.metropole) bits.push('Métropole');
  if (params.ratePerKm !== BASE_RATE) bits.push(`${num(params.ratePerKm.toFixed(2))} €/km`);
  if (params.discount) bits.push(`− ${pct(params.discount)}`);
  return bits.join(' · ');
}

/** Statistiques : signale le prix affiché (enregistré s'il reste stable 3 s). */
function logEstimate(valid, total) {
  if (!valid.length) return scheduleEstimateLog(null);
  const distance = round2(valid.reduce((s, x) => s + x.r.params.distanceKm, 0));
  const fromApi = valid.every((x) => x.t.apiDistance != null && readKm(x.t.distance) === x.t.apiDistance);
  scheduleEstimateLog({
    signature: JSON.stringify(valid.map((x) => x.r.params)),
    trips_count: valid.length,
    total_eur: total,
    distance_km: distance,
    distance_source: fromApi ? 'api' : 'manual',
  });
}

let share = null; // bouton « Partager » (créé au démarrage)

function renderPrice() {
  const results = state.trips.map((t) => ({ t, r: fareOf(t) }));
  const valid = results.filter((x) => x.r && !x.t.excluded);
  const multi = state.trips.length > 1;

  el.priceTitle.textContent = multi ? 'Prix total' : 'Prix estimé';
  const total = round2(valid.reduce((s, x) => s + x.r.fare.total, 0));
  el.priceTotal.textContent = valid.length ? formatEuro(total) : '—';

  const excludedCount = results.filter((x) => x.t.excluded).length;
  const missing = results.filter((x) => !x.r && !x.t.excluded).length;
  const notes = [];
  if (missing) notes.push(`${missing} trajet${missing > 1 ? 's' : ''} sans distance`);
  if (excludedCount) notes.push(`${excludedCount} trajet${excludedCount > 1 ? 's' : ''} exclu${excludedCount > 1 ? 's' : ''}`);
  el.priceNote.classList.toggle('hidden', !(multi && valid.length && notes.length));
  el.priceNote.textContent = notes.length ? `Non compté${missing + excludedCount > 1 ? 's' : ''} : ${notes.join(', ')}.` : '';

  logEstimate(valid, total);
  share?.refresh(valid.length > 0);

  const ctx = sharedContext();
  el.sharedRow.classList.toggle('hidden', ctx.patients < 2);
  el.sharedDetail.textContent = ctx.patients >= 2 ? `${ctx.patients} patients ensemble : − ${pct(sharedRate(ctx.patients))} sur chaque trajet` : '';

  if (!valid.length) {
    el.priceList.innerHTML = '<p class="empty-state">Indiquez la distance pour obtenir le prix.</p>';
    return;
  }

  if (!multi) {
    const { r } = valid[0];
    el.priceList.innerHTML = `<p class="fare-summary">${summaryLabel(r.params)}</p>${breakdownTable(r.fare)}`;
    return;
  }

  el.priceList.innerHTML = results
    .map(({ t, r }, i) => {
      if (t.excluded) return `<div class="fare-row muted"><span>Trajet ${i + 1}</span><span>exclu</span></div>`;
      if (!r) return `<div class="fare-row muted"><span>Trajet ${i + 1}</span><span>—</span></div>`;
      const open = state.openFares.has(t.id) ? ' open' : '';
      return `<details class="fare" data-id="${t.id}"${open}>
        <summary><span><strong>Trajet ${i + 1}</strong> <span class="muted">${summaryLabel(r.params)}</span></span><span class="fare-amount">${formatEuro(r.fare.total)}</span></summary>
        ${breakdownTable(r.fare)}
      </details>`;
    })
    .join('');
}

/* ---------- Mise à jour globale ---------- */

function update() {
  const count = state.trips.length;
  state.trips.forEach((t, i) => updateTrip(t, i, count));
  el.title.textContent = count > 1 ? 'Trajets' : 'Trajet';
  const full = count >= MAX_TRIPS;
  el.add.classList.toggle('hidden', full);
  el.limit.classList.toggle('hidden', !full);
  el.limit.textContent = `${MAX_TRIPS} trajets maximum`;
  renderPrice();
}

/* ---------- Actions ---------- */

function tripFromEvent(e) {
  const node = e.target.closest('.trip');
  return node ? state.trips.find((t) => t.id === Number(node.dataset.id)) : null;
}

const geoTimers = new Map();
const pickers = new Map();
function scheduleGeocode(t, key) {
  const k = `${t.id}-${key}`;
  clearTimeout(geoTimers.get(k));
  geoTimers.set(
    k,
    setTimeout(async () => {
      const query = t[key].trim();
      if (query.length < 3) return;
      const result = await geocode(query);
      if (t[key].trim() !== query || !state.trips.includes(t)) return;
      t.geo[key] = result ? { ...result, query } : null;
      update();
    }, 600),
  );
}

function addTrip() {
  if (state.trips.length >= MAX_TRIPS) return;
  const t = newTrip();
  state.trips.push(t);
  mountTrip(t);
  update();
  tripNode(t).querySelector('[data-f="origin"]').focus();
}

function removeTrip(t) {
  state.trips = state.trips.filter((x) => x !== t);
  state.openFares.delete(t.id);
  pickers.delete(t.id);
  tripNode(t)?.remove();
  update();
}

/** Croix d'un champ départ / destination : vide le champ et remet le curseur dedans. */
function clearPlace(t, key) {
  t[key] = '';
  t.geo[key] = null;
  clearTimeout(geoTimers.get(`${t.id}-${key}`));
  t.routeMsg = null;
  t.routes = null;
  const input = tripNode(t).querySelector(`[data-f="${key}"]`);
  input.value = '';
  input.focus();
}

/** Inverse départ et destination (texte et coordonnées déjà trouvées). */
function swapPlaces(t) {
  [t.origin, t.destination] = [t.destination, t.origin];
  t.geo = { origin: t.geo.destination, destination: t.geo.origin };
  for (const key of ['origin', 'destination']) {
    clearTimeout(geoTimers.get(`${t.id}-${key}`));
    tripNode(t).querySelector(`[data-f="${key}"]`).value = t[key];
  }
  t.routeMsg = null;
  t.routes = null;
}

function resetAll() {
  el.trips.innerHTML = '';
  pickers.clear();
  state.trips = [newTrip()];
  state.openFares.clear();
  mountTrip(state.trips[0]);
  update();
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function bind() {
  el.trips.addEventListener('input', (e) => {
    const t = tripFromEvent(e);
    const f = e.target.dataset.f;
    if (!t || !['origin', 'destination', 'distance'].includes(f)) return;
    if (f === 'distance' && e.target.value.includes('.')) {
      // Virgule française dans tous les cas, même si le clavier tape un point
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.replace(/\./g, ',');
      e.target.setSelectionRange(pos, pos);
    }
    t[f] = e.target.value;
    if (f === 'distance') t.copiedFromFirst = false;
    if (f !== 'distance') {
      scheduleGeocode(t, f);
      t.routeMsg = null;
      t.routes = null;
    }
    update();
  });

  // Liste « Autres » refermée sans changement (tarif gardé re-sélectionné) : on l'applique quand même
  el.trips.addEventListener('focusout', (e) => {
    if (e.target.dataset?.f !== 'rate-other' || !e.target.value) return;
    const t = tripFromEvent(e);
    const v = Number(e.target.value);
    if (!t || v === t.rate) return;
    t.rate = v;
    savePreferredRate(t.rate);
    update();
  });

  el.trips.addEventListener('change', (e) => {
    const t = tripFromEvent(e);
    const f = e.target.dataset.f;
    if (!t) return;
    if (f === 'rate' || (f === 'rate-other' && e.target.value)) {
      t.rate = Number(e.target.value);
      savePreferredRate(t.rate);
    }
    else if (f === 'dept') {
      // Recherche par département : le tarif trouvé s'applique à ce trajet
      const found = DEPARTMENT_RATES.find(([code]) => code === e.target.value);
      if (!found) return;
      t.rate = found[2];
      savePreferredRate(t.rate);
      saveDept(found[0]);
    }
    else if (f === 'soloLong') t.soloLong = e.target.checked;
    else if (f === 'departNow') {
      t.night = null;
      if (e.target.checked) t.departAt = null;
      else if (futureOrNull(t.lastDepartAt) != null) t.departAt = t.lastDepartAt;
      else {
        // Heure mémorisée dépassée : on ouvre le sélecteur pour en choisir une nouvelle
        e.target.checked = true;
        pickers.get(t.id)?.open();
        return;
      }
    }
    else return;
    update();
  });

  el.trips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-a]');
    const maps = e.target.closest('.maps-btn');
    if (maps && maps.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      toast('Renseignez le départ et la destination');
      return;
    }
    if (!btn) return;
    const t = tripFromEvent(e);
    if (!t) return;
    const node = tripNode(t);
    switch (btn.dataset.a) {
      case 'remove':
        removeTrip(t);
        return;
      case 'reset-km':
        t.distance = kmText(t.apiDistance);
        node.querySelector('[data-f="distance"]').value = t.distance;
        break;
      case 'clear-km':
        t.distance = '';
        t.copiedFromFirst = false;
        node.querySelector('[data-f="distance"]').value = '';
        node.querySelector('[data-f="distance"]').focus();
        break;
      case 'same-km':
        t.distance = state.trips[0].distance;
        node.querySelector('[data-f="distance"]').value = t.distance;
        // Même course que le trajet 1 : la Métropole suit
        t.copiedFromFirst = effectiveMetro(state.trips[0]);
        if (t.copiedFromFirst) t.metropole = true;
        break;
      case 'calc':
        calculateDistance(t);
        return;
      case 'choose':
        applyChoice(t, btn.dataset.choice);
        break;
      case 'clear-place':
        clearPlace(t, btn.dataset.key);
        break;
      case 'swap':
        swapPlaces(t);
        break;
      case 'exclude':
        t.excluded = !t.excluded;
        break;
      case 'metro':
        t.metropole = !effectiveMetro(t);
        t.copiedFromFirst = false;
        break;
      case 'metro-auto':
        t.metropole = null;
        t.copiedFromFirst = false;
        break;
      case 'night':
        t.night = !effectiveNight(t);
        break;
      case 'night-auto':
        t.night = null;
        break;
      case 'hospital':
        t.hospital = !t.hospital;
        break;
      default:
        return;
    }
    update();
  });

  // Mémorise les détails de prix ouverts entre deux rafraîchissements
  el.priceList.addEventListener(
    'toggle',
    (e) => {
      const id = Number(e.target.dataset?.id);
      if (!id) return;
      if (e.target.open) state.openFares.add(id);
      else state.openFares.delete(id);
    },
    true,
  );

  el.add.addEventListener('click', addTrip);

  el.reset.addEventListener('click', resetAll);

  $('optimized-toggle')?.addEventListener('click', () => setOptimized(!state.optimized));

  // L'horaire automatique suit l'heure courante
  setInterval(update, 60_000);
}

const fmtKm = (km) => `${num(round2(km))} km`;

/** Lieu à envoyer au calcul : coordonnées si l'adresse vient de l'autocomplétion, sinon le texte. */
function placeForRoute(t, key) {
  const label = t[key].trim();
  const g = t.geo[key];
  return g && g.query === label && Number.isFinite(g.lat) ? { label, lat: g.lat, lon: g.lon } : { label };
}

/** Bouton « Calculer la distance » : appelle la fonction serveur, remplit la distance. */
async function calculateDistance(t) {
  if (t.calculating) return;
  t.calculating = true;
  t.routeMsg = null;
  const key = calcKeyOf(t);
  update();
  logDistanceCalculation(); // statistiques : une demande de calcul de distance
  try {
    const departAt = futureOrNull(t.departAt); // null : appel sans heure (départ immédiat)
    const r = await computeRoute(placeForRoute(t, 'origin'), placeForRoute(t, 'destination'), departAt);
    if (!state.trips.includes(t)) return;
    const index = state.trips.indexOf(t);
    t.calcKey = key;
    t.night = null; // nouvelle recherche : la majoration nuit suit de nouveau l'heure de départ
    t.routes = Array.isArray(r.routes) && r.routes.length ? r.routes : [{ distanceKm: r.distanceKm, durationMin: r.durationMin }];
    t.routeChoice = 'shortest';
    t.routeMsg = {
      durationMin: r.durationMin,
      // Heure affichée seulement si le serveur l'a bien prise en compte
      departAt: r.departureTime ? Date.parse(r.departureTime) : null,
      text: `Distance calculée : ${fmtKm(r.distanceKm)}`,
    };
    t.calculating = false;
    setRouteResult(index, { distanceKm: r.distanceKm, durationMin: r.durationMin });
    revealPricing(t);
  } catch (err) {
    const text = {
      not_found: 'Départ ou destination non reconnu : vérifiez l’adresse ou relevez la distance sur Google Maps.',
      quota: 'Limite mensuelle de calculs atteinte : relevez la distance sur Google Maps.',
      rate_limited: `${err.message} En attendant, relevez la distance sur Google Maps.`,
    }[err.code] ?? 'Calcul impossible pour le moment : relevez la distance sur Google Maps.';
    t.routeMsg = { text, error: true };
    t.routes = null;
    t.calculating = false;
    update();
  }
}

/**
 * Sur mobile, après un calcul : si le prix n'est pas entièrement visible, fait défiler la page
 * pour amener le champ distance en haut de l'écran (tarification et prix visibles ensemble).
 */
function revealPricing(t) {
  const mobile = window.matchMedia('(max-width: 600px), (pointer: coarse)').matches;
  if (!mobile) return;
  const price = document.getElementById('price-total');
  if (price && price.getBoundingClientRect().bottom <= window.innerHeight) return;
  const km = tripNode(t)?.querySelector('.opt-km');
  if (!km) return;
  const top = window.scrollY + km.getBoundingClientRect().top - 8;
  if (top > window.scrollY) window.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Remplit distance et durée d'un trajet après un calcul d'itinéraire
 * (index à partir de 0) et mémorise la distance pour le bouton ↺.
 */
function setRouteResult(index, { distanceKm, durationMin }) {
  const t = state.trips[index];
  if (!t) return;
  t.apiDistance = distanceKm;
  t.apiDuration = durationMin ?? null;
  t.distance = kmText(distanceKm);
  tripNode(t).querySelector('[data-f="distance"]').value = t.distance;
  update();
}

/* ---------- Partage ---------- */

function amountText(l) {
  if (l.key === 'discount') return `− ${formatEuro(-l.amount)}`;
  return `${l.key === 'pickup' || l.key === 'distance' ? '' : '+ '}${formatEuro(l.amount)}`;
}

/** Données de partage : image, texte et lien (null s'il n'y a pas de prix). */
function shareSnapshot() {
  const valid = state.trips.map((t) => ({ t, r: fareOf(t) })).filter((x) => x.r && !x.t.excluded);
  if (!valid.length) return null;
  const total = round2(valid.reduce((s, x) => s + x.r.fare.total, 0));
  const ctx = sharedContext();

  const trips = valid.map(({ t, r }) => {
    const p = r.params;
    const departAt = futureOrNull(t.departAt);
    const duration = t.apiDuration != null && readKm(t.distance) === t.apiDistance ? t.apiDuration : null;
    return {
      from: shortPlace(t.origin, placeFor(t, 'origin')),
      to: shortPlace(t.destination, placeFor(t, 'destination')),
      km: p.distanceKm,
      rate: p.ratePerKm,
      durationMin: duration,
      departAt,
      hospital: p.hospital,
      night: p.night,
      metropole: p.metropole,
      soloLong: t.soloLong,
      fare: r.fare,
    };
  });

  const link = `${location.origin}${location.pathname}?c=${encodeShare(trips)}`;
  const when = (ms) => formatDeparture(ms).replace(/^Aujourd’hui/, 'aujourd’hui').replace(/^Demain/, 'demain');
  const opts = (x) => [x.hospital && 'Hospitalisation', x.night && 'Nuit/WE/férié', x.metropole && 'Métropole'].filter(Boolean);

  const lines = trips.length === 1
    ? trips[0].fare.lines.map((l) => {
        if (l.key === 'distance') {
          const b = trips[0].fare.billableKm;
          return [b > 0 ? `Distance (${num(b)} km × ${num(trips[0].rate.toFixed(2))} €)` : `Distance (${TARIFS.includedKm} premiers km inclus)`, amountText(l)];
        }
        return [l.detail ? `${l.label} (${l.detail})` : l.label, amountText(l)];
      })
    : trips.map((x, i) => [`Trajet ${i + 1} · ${x.from} → ${x.to}`, formatEuro(x.fare.total)]);
  if (trips.length > 1 && ctx.rate) lines.push([`Transport partagé : ${ctx.patients} patients`, `− ${pct(ctx.rate)} / trajet`]);

  const image = {
    total: formatEuro(total),
    lines,
    link,
    linkLabel: `${location.host}${location.pathname.replace(/index\.html$/, '').replace(/\/$/, '')}`,
    trips: trips.map((x) => ({
      from: x.from,
      to: x.to,
      chips: [
        x.departAt && { text: `📅 ${when(x.departAt)}` },
        { text: `${num(x.km)} km${x.durationMin ? ` · ${formatDuration(x.durationMin)}` : ''}` },
        ...opts(x).map((o) => ({ text: o, on: true })),
        { text: `${num(x.rate.toFixed(2))} €/km` },
      ].filter(Boolean),
    })),
  };

  const text = (kind) => {
    const first = trips[0];
    const head = kind === 'course'
      ? `🚕 Course disponible${first.departAt ? ` ${when(first.departAt)}` : ''}`
      : '🚕 Estimation taxi conventionné';
    const body = trips.map((x) => `${x.from || 'Départ'} → ${x.to || 'Destination'}\n${[`${num(x.km)} km`, x.durationMin && formatDuration(x.durationMin), ...opts(x)].filter(Boolean).join(' · ')}`);
    return [
      head,
      ...body,
      trips.length > 1 ? `${ctx.patients} patients (transport partagé)` : null,
      `${kind === 'course' ? 'Estimation' : 'Prix estimé'} : ${formatEuro(total)}`,
      kind === 'course' ? 'Quelqu’un est intéressé ?' : null,
      '',
      `Détail du calcul : ${link}`,
    ].filter((l) => l != null).join('\n');
  };

  return { image, text };
}

/** Lien de partage ouvert (?c=…) : remplit les trajets et affiche le prix détaillé. */
function applySharedLink() {
  const params = new URLSearchParams(location.search);
  const shared = params.has('c') ? decodeShare(params.get('c')) : null;
  if (!shared) return false;
  state.trips = shared.map((x) => {
    const t = newTrip();
    t.origin = x.from;
    t.destination = x.to;
    t.distance = kmText(x.km);
    t.rate = x.rate;
    t.hospital = x.hospital;
    t.night = x.night; // fixés comme à l'envoi : même prix à l'ouverture
    t.metropole = x.metropole;
    t.excluded = x.excluded;
    t.soloLong = x.soloLong;
    t.departAt = futureOrNull(x.departAt);
    if (t.departAt) t.lastDepartAt = t.departAt;
    t.apiDistance = x.durationMin ? x.km : null;
    t.apiDuration = x.durationMin;
    return t;
  });
  history.replaceState(null, '', location.pathname); // un rechargement repart d'une page vide
  return true;
}

/* ---------- Démarrage ---------- */

const fromLink = applySharedLink();
state.trips.forEach(mountTrip);
initInfoButtons();
if (FEATURES.shareButton) share = attachShare({ anchor: el.priceList, snapshot: shareSnapshot, toast });
bind();
update();
if (fromLink) toast('Calcul partagé ouvert : vérifiez les options avant de facturer.');

window.TaxiMeter = { setRouteResult };
