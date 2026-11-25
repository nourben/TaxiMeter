import { TARIFS, MAX_TRIPS } from '../config/tarifs.js';
import { computeFare, formatEuro, round2 } from '../core/pricing.js';
import { periodForDate } from '../core/period.js';
import { checkMetropole } from '../core/metropole.js';
import { googleMapsDirectionsUrl } from '../services/maps-link.js';
import { geocode } from '../services/geocoding.js';
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
  toast: $('toast'),
};

/* ---------- État ---------- */

let seq = 0;
/**
 * Un trajet. period / metropole valent null en mode automatique.
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
    period: null,
    metropole: null,
    rate: TARIFS.defaultRatePerKm,
    excluded: false,
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

function autoPeriod() {
  return periodForDate(new Date());
}

function effectivePeriod(t) {
  return t.period ?? autoPeriod();
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

function fareOf(t) {
  const distanceKm = readKm(t.distance);
  if (distanceKm == null) return null;
  const params = { distanceKm, ratePerKm: t.rate, period: effectivePeriod(t), metropole: effectiveMetro(t) };
  return { params, fare: computeFare(params) };
}

/* ---------- Rendu d'un trajet (créé une fois, puis mis à jour) ---------- */

const PIN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const ICON_DAY =
  '<svg class="period-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="11"/><circle cx="12" cy="12" r="3.2"/><path d="M12 5.5v1.6M12 16.9v1.6M5.5 12h1.6M16.9 12h1.6M7.4 7.4l1.1 1.1M15.5 15.5l1.1 1.1M7.4 16.6l1.1-1.1M15.5 8.5l1.1-1.1"/></svg>';
const ICON_NIGHT =
  '<svg class="period-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M14.8 6.6a5.6 5.6 0 1 0 2.6 9.6 4.6 4.6 0 0 1-2.6-9.6z"/></svg>';

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
        <button type="button" class="btn btn-sm btn-danger" data-a="remove">${ICON_TRASH}<span>Supprimer ce trajet</span></button>
      </div>
    </div>
    <div class="trip-body">
      <div class="route-wrap">
        <div class="route">
          <div class="route-line from"><input type="text" data-f="origin" placeholder="Départ" aria-label="Départ (adresse ou ville)" enterkeyhint="next" /></div>
          <div class="route-line to"><input type="text" data-f="destination" placeholder="Destination" aria-label="Destination (adresse ou ville)" enterkeyhint="next" /></div>
        </div>
        <a class="maps-btn" data-o="maps" target="_blank" rel="noopener">
          ${PIN}
          <span>Relever la distance en km<br />sur Google Maps</span>
        </a>
      </div>
      <div class="km-field opt-wide">
        <input type="number" data-f="distance" inputmode="decimal" min="0" step="0.1" placeholder="Distance" aria-label="Distance en km" />
        <button type="button" class="km-reset hidden" data-a="reset-km" aria-label="Revenir à la distance calculée" title="Revenir à la distance calculée">↺</button>
        <span class="suffix">km</span>
      </div>
      <div class="trip-meta">
        Temps de trajet estimé : <strong data-o="duration">—</strong>
        <span class="soon" data-o="soon" title="Le temps de trajet et la distance seront calculés automatiquement quand le calcul d’itinéraire sera branché">calcul auto à venir</span>
        <button type="button" class="link-btn same-km" data-a="same-km">Même km que le trajet 1</button>
      </div>
      <div class="opts">
        <div class="opt-row">
          <div class="segmented seg-sm opt-wide" role="radiogroup" aria-label="Horaire">
            <input type="radio" name="period-${t.id}" id="p-${t.id}-jour" value="jour" data-f="period" /><label for="p-${t.id}-jour">${ICON_DAY} Jour</label>
            <input type="radio" name="period-${t.id}" id="p-${t.id}-nuit" value="nuit" data-f="period" /><label for="p-${t.id}-nuit">${ICON_NIGHT} Nuit</label>
          </div>
          <button class="info-btn" data-info="horaire" aria-label="Aide sur les horaires jour et nuit">i</button>
        </div>
        <p class="trip-hint" data-o="hint-period"></p>
        <div class="opt-row opt-metro">
          <button type="button" class="chip opt-wide" data-a="metro" aria-pressed="false">Métropole</button>
          <button class="info-btn" data-info="metropole" aria-label="Aide sur la zone Métropole">i</button>
        </div>
        <p class="trip-hint" data-o="hint-metro"></p>
        <div class="opt-row opt-rate">
          <div class="segmented seg-sm opt-wide" role="radiogroup" aria-label="Tarif kilométrique">${rates}</div>
          <button class="info-btn" data-info="tarifKm" aria-label="Aide sur le tarif kilométrique">i</button>
        </div>
        <p class="trip-hint hidden" data-o="hint-rate"></p>
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
  excludeBtn.innerHTML = t.excluded ? `${ICON_EYE}<span>Inclure dans le prix</span>` : `${ICON_EYE_OFF}<span>Exclure du prix</span>`;
  excludeBtn.setAttribute('aria-pressed', String(!!t.excluded));
  node.classList.toggle('excluded', !!t.excluded);
  const r = fareOf(t);
  o('price').textContent = t.excluded ? 'exclu' : r ? formatEuro(r.fare.total) : '';

  // Distance : bouton ↺ seulement si l'API a donné une valeur et qu'elle a été modifiée
  const km = readKm(t.distance);
  node.querySelector('[data-a="reset-km"]').classList.toggle('hidden', t.apiDistance == null || km === t.apiDistance);

  const sameKm = node.querySelector('[data-a="same-km"]');
  const firstKm = readKm(state.trips[0].distance);
  sameKm.classList.toggle('hidden', index === 0 || firstKm == null || firstKm === km);

  o('duration').textContent = t.apiDuration != null ? formatDuration(t.apiDuration) : '—';
  o('soon').classList.toggle('hidden', t.apiDuration != null);

  const maps = o('maps');
  if (t.origin.trim() && t.destination.trim()) {
    maps.href = googleMapsDirectionsUrl(t.origin, t.destination);
    maps.removeAttribute('aria-disabled');
  } else {
    maps.removeAttribute('href');
    maps.setAttribute('aria-disabled', 'true');
  }

  // Options
  const period = effectivePeriod(t);
  node.querySelector(`#p-${t.id}-${period}`).checked = true;
  const metro = effectiveMetro(t);
  const chip = node.querySelector('[data-a="metro"]');
  chip.setAttribute('aria-pressed', String(metro));
  chip.textContent = metro ? `✓ Métropole (+${num(TARIFS.metropole.supplement)} €)` : 'Métropole';
  for (const radio of node.querySelectorAll('[data-f="rate"]')) radio.checked = Number(radio.value) === t.rate;

  const p = TARIFS.periods;
  o('hint-period').innerHTML =
    t.period == null
      ? `Horaire auto : ${period === 'jour' ? `jour (${p.jour.startHour} h–${p.nuit.startHour} h)` : `nuit (${p.nuit.startHour} h–${p.jour.startHour} h)`}`
      : `Horaire choisi : ${period} · <button type="button" class="link-btn" data-a="period-auto">repasser en auto</button>`;

  let metroText;
  if (t.metropole == null) {
    const det = detectMetro(t);
    if (det.inZone) metroText = `Métropole auto : détectée (${esc(det.reason)})`;
    else if (t.origin.trim() || t.destination.trim()) metroText = 'Métropole auto : non détectée';
    else metroText = 'Métropole auto : selon le départ et la destination';
  } else {
    metroText = `Métropole ${t.metropole ? 'ajoutée' : 'retirée'} à la main · <button type="button" class="link-btn" data-a="metro-auto">repasser en auto</button>`;
  }
  o('hint-metro').innerHTML = metroText;

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
        `<tr><td>${l.label}<span class="detail">${l.detail}</span></td><td>${l.key === 'pickup' || l.key === 'distance' ? '' : '+ '}${formatEuro(l.amount)}</td></tr>`,
    )
    .join('');
  return `<table class="breakdown"><tbody>${rows}</tbody></table>`;
}

function summaryLabel(params) {
  const bits = [`${num(params.distanceKm)} km`, TARIFS.periods[params.period].label];
  if (params.metropole) bits.push('Métropole');
  if (params.ratePerKm !== TARIFS.defaultRatePerKm) bits.push(`${num(params.ratePerKm.toFixed(2))} €/km`);
  return bits.join(' · ');
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
    if (f !== 'distance') scheduleGeocode(t, f);
    update();
  });

  el.trips.addEventListener('change', (e) => {
    const t = tripFromEvent(e);
    const f = e.target.dataset.f;
    if (!t) return;
    if (f === 'period') t.period = e.target.value;
    else if (f === 'rate') t.rate = Number(e.target.value);
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
      case 'same-km':
        t.distance = state.trips[0].distance;
        node.querySelector('[data-f="distance"]').value = t.distance;
        break;
      case 'exclude':
        t.excluded = !t.excluded;
        break;
      case 'metro':
        t.metropole = !effectiveMetro(t);
        break;
      case 'metro-auto':
        t.metropole = null;
        break;
      case 'period-auto':
        t.period = null;
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

/**
 * Point d'entrée pour la future API itinéraire : remplit distance et durée d'un trajet
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
