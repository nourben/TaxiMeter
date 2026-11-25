import { GRANULARITIES } from '../core/periods.js';
import { estimatesPerPeriod, USING_DEMO_DATA } from '../services/stats.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('fr-FR');
const STORAGE_KEY = 'taximeter.stats.granularity';

let granularity = 'day';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (GRANULARITIES[saved]) granularity = saved;
} catch {
  /* rien */
}

$('granularity').innerHTML = Object.entries(GRANULARITIES)
  .map(
    ([key, g]) =>
      `<input type="radio" name="granularity" id="g-${key}" value="${key}"${key === granularity ? ' checked' : ''} /><label for="g-${key}">${g.label}</label>`,
  )
  .join('');

/** Graduations « rondes » pour l'axe vertical. */
function niceTicks(max) {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
  return ticks;
}

async function render() {
  const data = await estimatesPerPeriod(granularity);
  const g = GRANULARITIES[granularity];
  $('chart-caption').textContent = g.caption;
  $('demo-note').classList.toggle('hidden', !USING_DEMO_DATA);

  const total = data.reduce((s, d) => s + d.count, 0);
  const current = data[data.length - 1];
  const best = data.reduce((a, b) => (b.count > a.count ? b : a));
  const unit = { day: 'jour', week: 'semaine', month: 'mois', year: 'an' }[granularity];
  $('stat-row').innerHTML = `
    <div><span class="stat-value">${fmt(total)}</span><span class="stat-label">au total</span></div>
    <div><span class="stat-value">${fmt(Math.round(total / data.length))}</span><span class="stat-label">en moyenne par ${unit}</span></div>
    <div><span class="stat-value">${fmt(current.count)}</span><span class="stat-label">${granularity === 'day' ? 'aujourd’hui' : 'période en cours'}</span></div>`;

  const ticks = niceTicks(best.count);
  const top = ticks[ticks.length - 1];
  const grid = ticks
    .map((t) => `<div class="chart-grid" style="bottom:${(t / top) * 100}%"><span>${fmt(t)}</span></div>`)
    .join('');
  const bars = data
    .map((d, i) => {
      const h = top ? (d.count / top) * 100 : 0;
      const labelled = d === current || d === best; // étiquettes sélectives
      return `<button type="button" class="chart-col${d.current ? ' is-current' : ''}" data-i="${i}" aria-label="${d.long} : ${fmt(d.count)} estimations">
          <span class="chart-bar" style="height:${h}%">${labelled ? `<span class="chart-value">${fmt(d.count)}</span>` : ''}</span>
          <span class="chart-x">${d.short}</span>
        </button>`;
    })
    .join('');
  $('chart').dataset.g = granularity;
  $('chart').innerHTML = `<div class="chart-plot">${grid}<div class="chart-cols">${bars}</div></div>`;

  $('chart-rows').innerHTML = data
    .map((d) => `<tr><td>${d.long}${d.current ? ' (en cours)' : ''}</td><td class="num">${fmt(d.count)}</td></tr>`)
    .join('');

  // Infobulle au survol ou au toucher
  const tip = $('chart-tip');
  const show = (col) => {
    const d = data[Number(col.dataset.i)];
    tip.textContent = `${d.long} : ${fmt(d.count)} estimation${d.count > 1 ? 's' : ''}`;
    tip.classList.remove('hidden');
    $('chart').querySelectorAll('.chart-col').forEach((c) => c.classList.toggle('is-active', c === col));
  };
  $('chart').querySelectorAll('.chart-col').forEach((col) => {
    col.addEventListener('mouseenter', () => show(col));
    col.addEventListener('focus', () => show(col));
    col.addEventListener('click', () => show(col));
  });
  $('chart').addEventListener('mouseleave', () => {
    tip.classList.add('hidden');
    $('chart').querySelectorAll('.chart-col').forEach((c) => c.classList.remove('is-active'));
  });
}

$('granularity').addEventListener('change', (e) => {
  granularity = e.target.value;
  try {
    localStorage.setItem(STORAGE_KEY, granularity);
  } catch {
    /* rien */
  }
  $('chart-tip').classList.add('hidden');
  render();
});

render();
