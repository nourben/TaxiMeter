// Choix de l'heure de départ : un champ qui ouvre un panneau avec raccourcis (+1 h, +2 h…)
// et trois roues à faire défiler (jour à gauche, heure et minutes à droite).

const DAYS = 14; // aujourd'hui + 13 jours
const STEP = 5; // minutes
const ROW = 34; // hauteur d'une ligne de roue (px), identique au CSS
const SHORTCUTS = [1, 2, 3, 4]; // heures

const pad = (n) => String(n).padStart(2, '0');
const dayStart = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
/** Prochain créneau de 5 minutes. */
export function roundUp(ms) {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(Math.ceil((m + (d.getTime() < ms ? 1 : 0)) / STEP) * STEP);
  return d.getTime();
}

function dayLabel(ms, now = Date.now()) {
  const diff = Math.round((dayStart(ms) - dayStart(now)) / 86_400_000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  return new Date(ms).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const timeLabel = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Libellé court d'une heure de départ : « Maintenant », « Aujourd'hui à 15:30 », « Demain à 08:00 »… */
export function formatDeparture(ms, now = Date.now()) {
  if (ms == null) return 'Maintenant';
  return `${dayLabel(ms, now)} à ${timeLabel(ms)}`;
}

function formatDelay(ms, now = Date.now()) {
  const min = Math.round((ms - now) / 60_000);
  if (min < 1) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) return `dans ${Math.floor(h / 24)} j ${h % 24} h`;
  return h ? `dans ${h} h${m ? ` ${pad(m)}` : ''}` : `dans ${m} min`;
}

/**
 * @param {HTMLElement} wrap élément .when-field contenant le bouton .when-btn
 * @param {{ get: () => number|null, set: (ms:number|null) => void }} opts
 */
export function attachWhenPicker(wrap, { get, set }) {
  const btn = wrap.querySelector('.when-btn');
  const panel = document.createElement('div');
  panel.className = 'when-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Heure de départ');
  panel.innerHTML = `
    <div class="when-quick">
      <button type="button" class="when-chip" data-q="now">Maintenant</button>
      ${SHORTCUTS.map((h) => `<button type="button" class="when-chip" data-q="${h}">+${h} h</button>`).join('')}
    </div>
    <div class="when-wheels">
      <div class="wheel wheel-day" tabindex="0" role="listbox" aria-label="Jour"></div>
      <div class="wheel wheel-hour" tabindex="0" role="listbox" aria-label="Heure"></div>
      <span class="wheel-sep" aria-hidden="true">:</span>
      <div class="wheel wheel-min" tabindex="0" role="listbox" aria-label="Minutes"></div>
    </div>
    <div class="when-foot">
      <span class="when-summary" aria-live="polite"></span>
      <button type="button" class="btn btn-sm when-ok">OK</button>
    </div>`;
  wrap.appendChild(panel);
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');

  const summary = panel.querySelector('.when-summary');
  let days = [];
  const wheels = {
    day: { el: panel.querySelector('.wheel-day'), values: [], idx: 0 },
    hour: { el: panel.querySelector('.wheel-hour'), values: [...Array(24).keys()], idx: 0 },
    min: { el: panel.querySelector('.wheel-min'), values: [...Array(60 / STEP).keys()].map((i) => i * STEP), idx: 0 },
  };

  function fill(w, labels) {
    w.el.innerHTML =
      '<div class="wheel-pad"></div>' +
      labels.map((l, i) => `<div class="wheel-item" role="option" data-i="${i}">${l}</div>`).join('') +
      '<div class="wheel-pad"></div>';
  }

  function mark(w) {
    w.el.querySelectorAll('.wheel-item').forEach((it, i) => {
      it.classList.toggle('is-sel', i === w.idx);
      it.setAttribute('aria-selected', String(i === w.idx));
    });
  }

  function valueFromWheels() {
    return days[wheels.day.idx] + wheels.hour.values[wheels.hour.idx] * 3_600_000 + wheels.min.values[wheels.min.idx] * 60_000;
  }

  function showSummary() {
    const ms = get();
    if (ms == null) summary.textContent = 'Départ immédiat';
    else if (ms <= Date.now() + 60_000) summary.textContent = 'Heure passée : calcul pour un départ immédiat';
    else summary.textContent = `Départ ${formatDelay(ms)}`;
    summary.classList.toggle('is-warn', ms != null && ms <= Date.now() + 60_000);
  }

  function select(w, i, { scroll = true, commit = true } = {}) {
    w.idx = Math.max(0, Math.min(w.values.length - 1, i));
    mark(w);
    if (scroll) w.el.scrollTop = w.idx * ROW;
    if (commit) {
      set(valueFromWheels());
      showSummary();
    }
  }

  function showValue(ms) {
    const d = new Date(ms);
    select(wheels.day, Math.max(0, days.indexOf(dayStart(ms))), { commit: false });
    select(wheels.hour, d.getHours(), { commit: false });
    select(wheels.min, Math.floor(d.getMinutes() / STEP), { commit: false });
  }

  for (const w of Object.values(wheels)) {
    let timer;
    w.el.addEventListener('scroll', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const i = Math.round(w.el.scrollTop / ROW);
        if (i !== w.idx) select(w, i, { scroll: false });
      }, 120);
    });
    w.el.addEventListener('click', (e) => {
      const it = e.target.closest('.wheel-item');
      if (!it) return;
      select(w, Number(it.dataset.i), { scroll: false });
      w.el.scrollTo({ top: w.idx * ROW, behavior: 'smooth' });
    });
    w.el.addEventListener('keydown', (e) => {
      const delta = { ArrowUp: -1, ArrowDown: 1, PageUp: -4, PageDown: 4 }[e.key];
      if (!delta) return;
      e.preventDefault();
      select(w, w.idx + delta);
    });
  }

  function open() {
    const now = Date.now();
    days = [...Array(DAYS).keys()].map((i) => {
      const d = new Date(dayStart(now));
      d.setDate(d.getDate() + i);
      return d.getTime();
    });
    wheels.day.values = days;
    fill(wheels.day, days.map((d) => dayLabel(d, now)));
    fill(wheels.hour, wheels.hour.values.map(pad));
    fill(wheels.min, wheels.min.values.map(pad));
    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    showValue(get() ?? roundUp(now));
    showSummary();
    wheels.hour.el.focus({ preventScroll: true });
  }

  function close(focus = false) {
    if (panel.classList.contains('hidden')) return;
    panel.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    if (focus) btn.focus();
  }

  btn.addEventListener('click', () => (panel.classList.contains('hidden') ? open() : close()));
  panel.querySelector('.when-ok').addEventListener('click', () => close(true));
  panel.querySelector('.when-quick').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (!q) return;
    if (q === 'now') {
      set(null);
      close(true);
      return;
    }
    const ms = roundUp(Date.now()) + Number(q) * 3_600_000;
    showValue(ms);
    set(valueFromWheels());
    showSummary();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  return { close };
}
