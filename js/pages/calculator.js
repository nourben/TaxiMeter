import { TARIFS } from '../config/tarifs.js';
import { computeFare, formatEuro } from '../core/pricing.js';
import { periodForDate } from '../core/period.js';
import { checkMetropole } from '../core/metropole.js';
import { googleMapsDirectionsUrl } from '../services/maps-link.js';
import { geocode } from '../services/geocoding.js';
import { courses } from '../services/storage.js';
import { initInfoButtons } from '../ui/info.js';

const $ = (id) => document.getElementById(id);
const num = (s) => String(s).replace('.', ',');

const el = {
  form: $('fare-form'),
  origin: $('origin'),
  destination: $('destination'),
  mapsLink: $('maps-link'),
  distance: $('distance'),
  distanceReset: $('distance-reset'),
  distanceSource: $('distance-source'),
  duration: $('duration'),
  departure: $('departure'),
  periodJour: $('period-jour'),
  periodNuit: $('period-nuit'),
  periodBadge: $('period-badge'),
  periodHint: $('period-hint'),
  periodAuto: $('period-auto'),
  metropole: $('metropole'),
  metropoleHint: $('metropole-hint'),
  metropoleAuto: $('metropole-auto'),
  rateGroup: $('rate-group'),
  price1: $('price-1'),
  result1: $('result-1-body'),
  result1Suffix: $('result-1-suffix'),
  addSecond: $('add-second'),
  removeSecond: $('remove-second'),
  second: $('second-course'),
  secondOriginLabel: $('second-origin-label'),
  destination2: $('destination-2'),
  mapsLink2: $('maps-link-2'),
  distance2: $('distance-2'),
  distance2Reset: $('distance-2-reset'),
  duration2: $('duration-2'),
  metropole2: $('metropole-2'),
  metropole2Hint: $('metropole-2-hint'),
  metropole2Auto: $('metropole-2-auto'),
  price2: $('price-2'),
  result2: $('result-2-body'),
  combined: $('combined'),
  priceTotal: $('price-total'),
  save: $('save-course'),
  resetForm: $('reset-form'),
  toast: $('toast'),
};

const state = {
  periodAuto: true,
  secondActive: false,
  /** Lieux géocodés (null tant que non trouvés) */
  places: { origin: null, destination: null, destination2: null },
  /** Métropole : auto ou forcé à la main, par course */
  metro: {
    1: { auto: true, detected: { inZone: false, reason: null } },
    2: { auto: true, detected: { inZone: false, reason: null } },
  },
  /** Valeurs renvoyées par l'API itinéraire (null tant qu'elle n'est pas branchée) */
  apiDistance: { 1: null, 2: null },
  apiDuration: { 1: null, 2: null },
};

/* ---------- Utilitaires ---------- */

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readNumber(input) {
  const raw = String(input.value).trim().replace(',', '.');
  if (raw === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function selectedRate() {
  const checked = el.rateGroup.querySelector('input:checked');
  return checked ? Number(checked.value) : TARIFS.defaultRatePerKm;
}

function selectedPeriod() {
  return el.periodNuit.checked ? 'nuit' : 'jour';
}

function formatDuration(min) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/* ---------- Tarif kilométrique ---------- */

function renderRates() {
  el.rateGroup.innerHTML = TARIFS.ratesPerKm
    .map((r, i) => {
      const id = `rate-${i}`;
      const checked = r === TARIFS.defaultRatePerKm ? ' checked' : '';
      return `<input type="radio" name="rate" id="${id}" value="${r}"${checked} /><label for="${id}">${num(r.toFixed(2))} €</label>`;
    })
    .join('');
}

/* ---------- Horaire jour / nuit ---------- */

function departureDate() {
  const v = el.departure.value;
  const d = v ? new Date(v) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function syncPeriod() {
  const auto = periodForDate(departureDate());
  if (state.periodAuto) {
    (auto === 'nuit' ? el.periodNuit : el.periodJour).checked = true;
  }
  const p = TARIFS.periods;
  const current = selectedPeriod();
  el.periodBadge.textContent = state.periodAuto ? 'Auto' : 'Manuel';
  el.periodBadge.classList.toggle('badge-accent', state.periodAuto);
  el.periodHint.textContent =
    current === 'jour'
      ? `Tarif de jour (${p.jour.startHour} h – ${p.nuit.startHour} h) · × ${num(p.jour.multiplier)} sur la distance. `
      : `Tarif de nuit (${p.nuit.startHour} h – ${p.jour.startHour} h) · × ${num(p.nuit.multiplier)} sur le total. `;
  el.periodAuto.classList.toggle('hidden', state.periodAuto || current === auto);
  if (!state.periodAuto && current === auto) {
    state.periodAuto = true;
    syncPeriod();
  }
}

/* ---------- Métropole ---------- */

function placeFor(key, input) {
  const text = input.value.trim();
  if (!text) return null;
  const geo = state.places[key];
  // Le géocodage n'est utilisé que s'il correspond à la saisie actuelle
  if (geo && geo.query === text) return { text, ...geo };
  return { text };
}

function detectMetro(courseNo) {
  const origin = placeFor('origin', el.origin);
  const dest = courseNo === 1 ? placeFor('destination', el.destination) : placeFor('destination2', el.destination2);
  const o = checkMetropole(origin);
  const d = checkMetropole(dest);
  if (o.inZone) return { inZone: true, reason: `départ en zone (${o.reason})`, any: !!(origin || dest) };
  if (d.inZone) return { inZone: true, reason: `destination en zone (${d.reason})`, any: true };
  return { inZone: false, reason: null, any: !!(origin || dest) };
}

function syncMetro(courseNo) {
  const m = state.metro[courseNo];
  const input = courseNo === 1 ? el.metropole : el.metropole2;
  const hint = courseNo === 1 ? el.metropoleHint : el.metropole2Hint;
  const autoBtn = courseNo === 1 ? el.metropoleAuto : el.metropole2Auto;

  const det = detectMetro(courseNo);
  m.detected = det;
  if (m.auto) input.checked = det.inZone;

  let text;
  if (!det.any) text = 'Saisissez le trajet pour la détection automatique.';
  else if (det.inZone) text = `Détecté automatiquement : ${det.reason}.`;
  else text = 'Ni le départ ni la destination ne sont en zone Métropole.';
  if (!m.auto) text = `Réglé à la main (${input.checked ? 'activé' : 'désactivé'}). `;
  hint.textContent = text + ' ';
  autoBtn.classList.toggle('hidden', m.auto);
}

const geocodeField = debounce(async (key, input) => {
  const query = input.value.trim();
  if (query.length < 3) return;
  const result = await geocode(query);
  if (input.value.trim() !== query) return; // saisie modifiée entre-temps
  state.places[key] = result ? { ...result, query } : null;
  syncMetro(1);
  if (state.secondActive) syncMetro(2);
  render();
}, 600);

/* ---------- Distance (saisie manuelle / API) ---------- */

function syncDistanceUI(courseNo) {
  const input = courseNo === 1 ? el.distance : el.distance2;
  const reset = courseNo === 1 ? el.distanceReset : el.distance2Reset;
  const api = state.apiDistance[courseNo];
  const modified = api != null && readNumber(input) !== api;
  reset.classList.toggle('hidden', !modified);
  if (courseNo === 1) {
    el.distanceSource.classList.toggle('hidden', api == null);
    el.distanceSource.textContent = modified
      ? `Modifiée à la main (itinéraire calculé : ${num(api)} km).`
      : 'Calculée automatiquement par l’itinéraire.';
  }
}

/**
 * Point d'entrée pour la future API itinéraire : remplit la distance (et la durée)
 * et mémorise la valeur pour le bouton ↺.
 */
function setRouteResult(courseNo, { distanceKm, durationMin }) {
  state.apiDistance[courseNo] = distanceKm;
  state.apiDuration[courseNo] = durationMin ?? null;
  (courseNo === 1 ? el.distance : el.distance2).value = distanceKm;
  if (durationMin != null) (courseNo === 1 ? el.duration : el.duration2).value = Math.round(durationMin);
  render();
}

/* ---------- Liens Google Maps ---------- */

function syncMapsLinks() {
  const o = el.origin.value.trim();
  const d = el.destination.value.trim();
  const d2 = el.destination2.value.trim();
  setLink(el.mapsLink, o && d ? googleMapsDirectionsUrl(o, d) : null);
  setLink(el.mapsLink2, o && d2 ? googleMapsDirectionsUrl(o, d2) : null);
  el.secondOriginLabel.textContent = o || '— (renseignez le départ)';
}

function setLink(a, url) {
  if (url) {
    a.href = url;
    a.removeAttribute('aria-disabled');
  } else {
    a.href = '#';
    a.setAttribute('aria-disabled', 'true');
  }
}

/* ---------- Calcul et affichage ---------- */

function fareFor(courseNo) {
  const distanceKm = readNumber(courseNo === 1 ? el.distance : el.distance2);
  if (distanceKm == null) return null;
  const metropole = (courseNo === 1 ? el.metropole : el.metropole2).checked;
  const params = { distanceKm, ratePerKm: selectedRate(), period: selectedPeriod(), metropole };
  return { params, fare: computeFare(params), durationMin: readNumber(courseNo === 1 ? el.duration : el.duration2) };
}

function breakdownHtml({ params, fare, durationMin }) {
  const p = TARIFS.periods[params.period];
  const badges = [
    `<span class="badge">${params.period === 'jour' ? '☀︎' : '☾'} ${p.label}</span>`,
    `<span class="badge">${num(params.distanceKm)} km</span>`,
    `<span class="badge">${num(params.ratePerKm.toFixed(2))} €/km</span>`,
    params.metropole ? '<span class="badge badge-accent">Métropole</span>' : '',
    durationMin != null ? `<span class="badge">⏱ ${formatDuration(durationMin)}</span>` : '',
  ].join('');
  const rows = fare.lines
    .map(
      (l) =>
        `<tr><td>${l.label}<span class="detail">${l.detail}</span></td><td>${l.key === 'pickup' || l.key === 'distance' ? '' : '+ '}${formatEuro(l.amount)}</td></tr>`,
    )
    .join('');
  return `
    <div class="result-meta">${badges}</div>
    <table class="breakdown">
      <tbody>${rows}
        <tr class="total"><td>Total</td><td>${formatEuro(fare.total)}</td></tr>
      </tbody>
    </table>`;
}

let last = { 1: null, 2: null };

function render() {
  syncPeriod();
  syncMapsLinks();
  syncDistanceUI(1);
  if (state.secondActive) syncDistanceUI(2);

  const r1 = fareFor(1);
  last[1] = r1;
  if (r1) {
    el.price1.textContent = formatEuro(r1.fare.total);
    el.result1.innerHTML = breakdownHtml(r1);
  } else {
    el.price1.textContent = '—';
    el.result1.innerHTML = '<p class="empty-state">Indiquez la distance pour obtenir le prix.</p>';
  }
  el.result1Suffix.textContent = state.secondActive ? ' · 1re course' : '';

  let r2 = null;
  if (state.secondActive) {
    r2 = fareFor(2);
    last[2] = r2;
    el.price2.textContent = r2 ? formatEuro(r2.fare.total) : '—';
    el.result2.innerHTML = r2 ? breakdownHtml(r2) : '';
    const both = r1 && r2;
    el.combined.classList.toggle('hidden', !both);
    if (both) el.priceTotal.textContent = formatEuro(Math.round((r1.fare.total + r2.fare.total) * 100) / 100);
  } else {
    last[2] = null;
  }

  el.save.disabled = !r1;
  el.save.textContent = state.secondActive && r2 ? 'Enregistrer les 2 courses' : 'Enregistrer la course';
}

/* ---------- 2e course ---------- */

function setSecond(active) {
  state.secondActive = active;
  el.second.classList.toggle('hidden', !active);
  el.addSecond.classList.toggle('hidden', active);
  if (active) {
    syncMetro(2);
    el.destination2.focus();
  }
  render();
}

/* ---------- Enregistrement ---------- */

function recordFor(courseNo, r, groupId) {
  return {
    groupId,
    courseNo,
    origin: el.origin.value.trim(),
    destination: (courseNo === 1 ? el.destination : el.destination2).value.trim(),
    departureAt: departureDate().toISOString(),
    distanceKm: r.params.distanceKm,
    distanceSource: state.apiDistance[courseNo] != null && state.apiDistance[courseNo] === r.params.distanceKm ? 'api' : 'manual',
    durationMin: r.durationMin,
    period: r.params.period,
    ratePerKm: r.params.ratePerKm,
    metropole: r.params.metropole,
    total: r.fare.total,
  };
}

async function save(e) {
  e.preventDefault();
  if (!last[1]) return;
  const groupId = crypto.randomUUID?.() ?? String(Date.now());
  try {
    await courses.save(recordFor(1, last[1], groupId));
    if (state.secondActive && last[2]) await courses.save(recordFor(2, last[2], groupId));
    toast(state.secondActive && last[2] ? '2 courses enregistrées' : 'Course enregistrée');
  } catch (err) {
    toast(err.message);
  }
}

function resetAll() {
  el.form.reset();
  renderRates();
  state.periodAuto = true;
  state.metro[1].auto = true;
  state.metro[2].auto = true;
  state.places = { origin: null, destination: null, destination2: null };
  state.apiDistance = { 1: null, 2: null };
  state.apiDuration = { 1: null, 2: null };
  el.departure.value = toLocalInputValue(new Date());
  setSecond(false);
  syncMetro(1);
  render();
}

/* ---------- Événements ---------- */

function bind() {
  el.form.addEventListener('submit', save);
  el.form.addEventListener('input', render);
  el.form.addEventListener('change', render);

  for (const [key, input] of [
    ['origin', el.origin],
    ['destination', el.destination],
    ['destination2', el.destination2],
  ]) {
    input.addEventListener('input', () => {
      syncMetro(1);
      if (state.secondActive) syncMetro(2);
      geocodeField(key, input);
    });
  }

  el.departure.addEventListener('change', () => {
    state.periodAuto = true;
    render();
  });
  for (const radio of [el.periodJour, el.periodNuit]) {
    radio.addEventListener('change', () => {
      state.periodAuto = false;
      render();
    });
  }
  el.periodAuto.addEventListener('click', () => {
    state.periodAuto = true;
    render();
  });

  el.metropole.addEventListener('change', () => {
    state.metro[1].auto = false;
    syncMetro(1);
  });
  el.metropoleAuto.addEventListener('click', () => {
    state.metro[1].auto = true;
    syncMetro(1);
    render();
  });
  el.metropole2.addEventListener('change', () => {
    state.metro[2].auto = false;
    syncMetro(2);
  });
  el.metropole2Auto.addEventListener('click', () => {
    state.metro[2].auto = true;
    syncMetro(2);
    render();
  });

  el.distanceReset.addEventListener('click', () => {
    el.distance.value = state.apiDistance[1];
    render();
  });
  el.distance2Reset.addEventListener('click', () => {
    el.distance2.value = state.apiDistance[2];
    render();
  });

  for (const a of [el.mapsLink, el.mapsLink2]) {
    a.addEventListener('click', (e) => {
      if (a.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        toast('Renseignez le départ et la destination');
      }
    });
  }

  el.addSecond.addEventListener('click', () => setSecond(true));
  el.removeSecond.addEventListener('click', () => {
    el.destination2.value = '';
    el.distance2.value = '';
    el.duration2.value = '';
    state.metro[2].auto = true;
    state.apiDistance[2] = null;
    setSecond(false);
  });
  el.resetForm.addEventListener('click', resetAll);

  // Met à jour l'horaire automatique si la page reste ouverte longtemps
  setInterval(() => {
    if (state.periodAuto) render();
  }, 60_000);
}

/* ---------- Démarrage ---------- */

renderRates();
el.departure.value = toLocalInputValue(new Date());
initInfoButtons();
bind();
syncMetro(1);
render();

// Exposé pour la future intégration de l'API itinéraire (et pour tester à la main dans la console)
window.TaxiMeter = { setRouteResult };
