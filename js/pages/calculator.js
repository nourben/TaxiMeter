import { TARIFS, MAX_TRIPS, SHARED_TRANSPORT } from '../config/tarifs.js';
import { computeFare, formatEuro, round2, sharedRate, applyDiscount } from '../core/pricing.js';
import { nightRateFor } from '../core/period.js';
import { checkMetropole } from '../core/metropole.js';
import { googleMapsDirectionsUrl } from '../services/maps-link.js';
import { geocode, suggest } from '../services/geocoding.js';
import { attachAutocomplete } from '../ui/autocomplete.js';
import { scheduleEstimateLog, logDistanceCalculation } from '../services/estimates-log.js';
import { computeRoute } from '../services/route.js';
import { initInfoButtons } from '../ui/info.js';

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
 * Un trajet. night / metropole valent null en mode automatique.
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
    night: null,
    hospital: false,
    metropole: null,
    rate: TARIFS.defaultRatePerKm,
    excluded: false,
    soloLong: false,
    copiedFromFirst: false,
    calculating: false,
    routeMsg: null,
    geo: { origin: null, destination: null },
  };
}

const state = { trips: [newTrip()], openFares: new Set() };

/* ---------- Calculs dérivés ---------- */

function readKm(value) {
  const raw = String(value).trim().replace(',', '.');
  if (raw === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function effectiveNight(t) {
  return t.night ?? nightRateFor(new Date()).active;
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
      const nd = r === TARIFS.defaultRatePerKm ? '' : ' class="nondefault"';
      return `<input type="radio" name="rate-${t.id}" id="${id}" value="${r}" data-f="rate"${nd} /><label for="${id}">${num(r.toFixed(2))} €</label>`;
    })
    .join('');
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
      <div class="route">
          <div class="route-line from"><input type="text" data-f="origin" placeholder="Départ" aria-label="Départ (adresse ou ville)" enterkeyhint="next" /></div>
          <div class="route-line to"><input type="text" data-f="destination" placeholder="Destination" aria-label="Destination (adresse ou ville)" enterkeyhint="next" /></div>
      </div>
      <div class="route-actions">
          <button type="button" class="calc-btn" data-a="calc" data-o="calc" disabled>
            ${ICON_ROUTE}
            <span data-o="calc-label">Calculer la distance<small>itinéraire le plus court</small></span>
          </button>
          <a class="maps-btn" data-o="maps" target="_blank" rel="noopener">
            ${PIN}
            <span class="maps-label"><span>Relever la distance<span class="wide-only"> en km</span></span><span><span class="narrow-only">en km </span>sur Google Maps</span></span>
          </a>
      </div>
      <p class="route-msg hidden" data-o="route-msg" role="status"></p>
      <div class="opt-row opt-km">
      <div class="km-field opt-wide">
        <input type="number" data-f="distance" inputmode="decimal" min="0" step="0.1" placeholder="Distance" aria-label="Distance en km" />
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
          <button type="button" class="chip opt-wide chip-icon" data-a="night" aria-pressed="false">${ICON_NIGHT}<span data-o="night-label">Nuit / WE / férié</span></button>
          <button class="info-btn" data-info="nuit" aria-label="Aide sur la majoration nuit, week-end et jours fériés">i</button>
          <button type="button" class="link-btn auto-link hidden" data-a="night-auto" data-o="night-auto" title="Repasser en automatique">↺ auto</button>
        </div>
        <div class="opt-row opt-hosp">
          <button type="button" class="chip opt-wide chip-icon" data-a="hospital" aria-pressed="false">${ICON_HOSP}<span data-o="hosp-label">Hospitalisation</span></button>
          <button class="info-btn" data-info="hospital" aria-label="Aide sur la majoration hospitalisation">i</button>
        </div>
        <div class="opt-row opt-metro">
          <button type="button" class="chip opt-wide" data-a="metro" aria-pressed="false">Métropole</button>
          <button class="info-btn" data-info="metropole" aria-label="Aide sur la zone Métropole">i</button>
          <button type="button" class="link-btn auto-link hidden" data-a="metro-auto" data-o="metro-auto" title="Repasser en automatique">↺ auto</button>
        </div>
        <div class="opt-row opt-rate">
          <div class="segmented seg-sm opt-wide" role="radiogroup" aria-label="Tarif kilométrique">${rates}</div>
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
  // État auto / manuel affiché en tête de l'info contextuelle de chaque option
  for (const [info, out] of [
    ['nuit', 'hint-night'],
    ['metropole', 'hint-metro'],
  ]) {
    const panel = document.getElementById(node.querySelector(`[data-info="${info}"]`).getAttribute('aria-controls'));
    panel.insertAdjacentHTML('afterbegin', `<p class="info-status" data-o="${out}"></p>`);
  }
  for (const key of ['origin', 'destination']) {
    const input = node.querySelector(`[data-f="${key}"]`);
    attachAutocomplete(input, {
      fetch: suggest,
      onSelect: (place) => {
        input.value = place.label;
        t[key] = place.label;
        t.geo[key] = { ...place, query: place.label };
        clearTimeout(geoTimers.get(`${t.id}-${key}`));
        update();
      },
    });
  }
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


  const calc = o('calc');
  const ready = t.origin.trim().length >= 2 && t.destination.trim().length >= 2;
  calc.disabled = !ready || t.calculating;
  o('calc-label').innerHTML = t.calculating
    ? 'Calcul en cours…<small>interrogation de Google</small>'
    : 'Calculer la distance<small>itinéraire le plus court</small>';
  const msg = o('route-msg');
  msg.classList.toggle('hidden', !t.routeMsg);
  msg.classList.toggle('is-error', !!t.routeMsg?.error);
  const dur = !t.routeMsg?.error && Number.isFinite(t.routeMsg?.durationMin) ? formatDuration(t.routeMsg.durationMin) : '';
  msg.innerHTML = t.routeMsg
    ? `<span>${esc(t.routeMsg.text)}</span>${dur ? `<span class="route-time" title="Temps de trajet estimé">⏱ ${dur}</span>` : ''}`
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
    ? `✓ Hospitalisation +${Math.round((longHosp ? H.longRate : H.rate) * 100)} %`
    : 'Hospitalisation';
  const metro = effectiveMetro(t);
  const chip = node.querySelector('[data-a="metro"]');
  chip.setAttribute('aria-pressed', String(metro));
  chip.textContent = metro ? `✓ Métropole +${num(TARIFS.metropole.supplement)} €` : 'Métropole';
  for (const radio of node.querySelectorAll('[data-f="rate"]')) radio.checked = Number(radio.value) === t.rate;

  const auto = nightRateFor(new Date());
  o('hint-night').textContent =
    t.night == null
      ? `Auto : ${auto.active ? 'active' : 'inactive'} en ce moment (${auto.reason})`
      : `Réglée à la main : ${t.night ? 'active' : 'inactive'}`;
  o('night-auto').classList.toggle('hidden', t.night == null);

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

  const ctxShared = sharedContext();
  const soloRow = o('solo-row');
  soloRow.classList.toggle('hidden', !(ctxShared.rate && !t.excluded));
  const soloInput = soloRow.querySelector('[data-f="soloLong"]');
  const longEnough = (readKm(t.distance) ?? 0) >= SHARED_TRANSPORT.soloLong.minKm;
  soloInput.checked = t.soloLong && longEnough;
  soloInput.disabled = !longEnough;
  soloRow.querySelector('.solo-chip').classList.toggle('is-disabled', !longEnough);
  soloRow.querySelector('.solo-chip').classList.toggle('is-on', t.soloLong && longEnough);

  const rateHint = o('hint-rate');
  const nonDefault = t.rate !== TARIFS.defaultRatePerKm;
  rateHint.classList.toggle('hidden', !nonDefault);
  rateHint.innerHTML = nonDefault
    ? `<span class="warn-text">Tarif ${num(t.rate.toFixed(2))} €/km au lieu de ${num(TARIFS.defaultRatePerKm.toFixed(2))} €</span>`
    : '';
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
  if (params.ratePerKm !== TARIFS.defaultRatePerKm) bits.push(`${num(params.ratePerKm.toFixed(2))} €/km`);
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
  tripNode(t)?.remove();
  update();
}

function resetAll() {
  el.trips.innerHTML = '';
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
    t[f] = e.target.value;
    if (f === 'distance') t.copiedFromFirst = false;
    if (f !== 'distance') {
      scheduleGeocode(t, f);
      t.routeMsg = null;
    }
    update();
  });

  el.trips.addEventListener('change', (e) => {
    const t = tripFromEvent(e);
    const f = e.target.dataset.f;
    if (!t) return;
    if (f === 'rate') t.rate = Number(e.target.value);
    else if (f === 'soloLong') t.soloLong = e.target.checked;
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
        t.distance = String(t.apiDistance);
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
  update();
  logDistanceCalculation(); // statistiques : une demande de calcul de distance
  try {
    const r = await computeRoute(placeForRoute(t, 'origin'), placeForRoute(t, 'destination'));
    if (!state.trips.includes(t)) return;
    const index = state.trips.indexOf(t);
    const detour = round2(r.distanceKm - r.shortest.distanceKm);
    t.routeMsg = {
      durationMin: r.durationMin,
      text:
        r.reason === 'faster-alternative'
          ? `Distance calculée : ${fmtKm(r.distanceKm)}. Le plus court (${fmtKm(r.shortest.distanceKm)}) était chargé : itinéraire plus rapide retenu, ${fmtKm(detour)} de plus.`
          : `Distance calculée : ${fmtKm(r.distanceKm)} (itinéraire le plus court).`,
    };
    t.calculating = false;
    setRouteResult(index, { distanceKm: r.distanceKm, durationMin: r.durationMin });
  } catch (err) {
    const text = {
      not_found: 'Départ ou destination non reconnu : vérifiez l’adresse ou relevez la distance sur Google Maps.',
      quota: 'Limite mensuelle de calculs atteinte : relevez la distance sur Google Maps.',
    }[err.code] ?? 'Calcul impossible pour le moment : relevez la distance sur Google Maps.';
    t.routeMsg = { text, error: true };
    t.calculating = false;
    update();
  }
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
  t.distance = String(distanceKm);
  tripNode(t).querySelector('[data-f="distance"]').value = t.distance;
  update();
}

/* ---------- Démarrage ---------- */

mountTrip(state.trips[0]);
initInfoButtons();
bind();
update();

window.TaxiMeter = { setRouteResult };
