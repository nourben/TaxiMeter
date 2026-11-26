import { GRANULARITIES } from '../core/periods.js';
import { estimatesPerPeriod, visitsPerPeriod, visitorFrequency } from '../services/stats.js';

const fmt = (n) => n.toLocaleString('fr-FR');
const UNIT = { day: 'jour', week: 'semaine', month: 'mois', year: 'an' };

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

/** Un module « diagramme en barres + sélecteur de période » pour un type d'événement. */
function setupModule(root) {
  const kind = root.dataset.kind;
  const r = (name) => root.querySelector(`[data-r="${name}"]`);
  const storageKey = `taximeter.stats.${kind}.granularity`;
  const visitors = kind === 'visitors';
  const words = kind === 'distance' ? ['calcul', 'calculs'] : visitors ? ['visiteur', 'visiteurs'] : ['estimation', 'estimations'];
  const fixedCaption = root.tagName === 'DETAILS' ? r('caption').textContent : '';

  let granularity = 'day';
  try {
    const saved = localStorage.getItem(storageKey);
    if (GRANULARITIES[saved]) granularity = saved;
  } catch {
    /* rien */
  }

  r('switch').innerHTML = Object.entries(GRANULARITIES)
    .map(
      ([key, g]) =>
        `<input type="radio" name="g-${kind}" id="g-${kind}-${key}" value="${key}"${key === granularity ? ' checked' : ''} /><label for="g-${kind}-${key}">${g.label}</label>`,
    )
    .join('');

  async function render() {
    const g = GRANULARITIES[granularity];
    r('caption').textContent = fixedCaption ? `${fixedCaption} · ${g.caption}` : g.caption;
    let data;
    try {
      data = visitors ? await visitsPerPeriod(granularity) : await estimatesPerPeriod(granularity, kind);
      r('error').classList.add('hidden');
    } catch {
      r('error').classList.remove('hidden');
      for (const k of ['stats', 'chart', 'rows']) r(k).innerHTML = '';
      r('empty').classList.add('hidden');
      return;
    }

    const total = data.reduce((s, d) => s + d.count, 0);
    const current = data[data.length - 1];
    const best = data.reduce((a, b) => (b.count > a.count ? b : a));
    r('empty').classList.toggle('hidden', total > 0);
    const nowLabel = granularity === 'day' ? 'aujourd’hui' : 'période en cours';
    r('stats').innerHTML = visitors
      ? `
      <div><span class="stat-value">${fmt(current.count)}</span><span class="stat-label">visiteurs ${nowLabel}</span></div>
      <div><span class="stat-value">${fmt(current.returning)}</span><span class="stat-label">dont déjà venus</span></div>
      <div><span class="stat-value">${fmt(current.views)}</span><span class="stat-label">pages vues ${nowLabel}</span></div>`
      : `
      <div><span class="stat-value">${fmt(total)}</span><span class="stat-label">au total</span></div>
      <div><span class="stat-value">${fmt(Math.round(total / data.length))}</span><span class="stat-label">en moyenne par ${UNIT[granularity]}</span></div>
      <div><span class="stat-value">${fmt(current.count)}</span><span class="stat-label">${granularity === 'day' ? 'aujourd’hui' : 'période en cours'}</span></div>`;

    const ticks = niceTicks(best.count);
    const top = ticks[ticks.length - 1];
    const grid = ticks
      .map((t) => `<div class="chart-grid" style="bottom:${(t / top) * 100}%"><span>${fmt(t)}</span></div>`)
      .join('');
    const bars = data
      .map((d, i) => {
        const h = top ? (d.count / top) * 100 : 0;
        const labelled = d.count > 0 && (d === current || d === best); // étiquettes sélectives
        return `<button type="button" class="chart-col${d.current ? ' is-current' : ''}" data-i="${i}" aria-label="${d.long} : ${fmt(d.count)} ${words[1]}">
            <span class="chart-bar" style="height:${h}%">${labelled ? `<span class="chart-value">${fmt(d.count)}</span>` : ''}</span>
            <span class="chart-x">${d.short}</span>
          </button>`;
      })
      .join('');
    const chart = r('chart');
    chart.dataset.g = granularity;
    chart.setAttribute('aria-label', `${words[1]} par ${UNIT[granularity]}, ${g.caption}`);
    chart.innerHTML = `<div class="chart-plot">${grid}<div class="chart-cols">${bars}</div></div>`;

    r('rows').innerHTML = [...data]
      .reverse()
      .map(
        (d) =>
          `<tr><td><span class="d-long">${d.long}${d.current ? ' (en cours)' : ''}</span><span class="d-short">${d.short}${d.current ? ' •' : ''}</span></td><td class="num">${fmt(d.count)}</td>${
            visitors ? `<td class="num">${fmt(d.returning)}</td><td class="num">${fmt(d.views)}</td>` : ''
          }</tr>`,
      )
      .join('');

    // Infobulle au survol ou au toucher
    const tip = r('tip');
    const show = (col) => {
      const d = data[Number(col.dataset.i)];
      tip.textContent =
        `${d.long} : ${fmt(d.count)} ${d.count > 1 ? words[1] : words[0]}` +
        (visitors ? ` (dont ${fmt(d.returning)} déjà venus) · ${fmt(d.views)} pages vues` : '');
      tip.classList.remove('hidden');
      chart.querySelectorAll('.chart-col').forEach((c) => c.classList.toggle('is-active', c === col));
    };
    chart.querySelectorAll('.chart-col').forEach((col) => {
      col.addEventListener('mouseenter', () => show(col));
      col.addEventListener('focus', () => show(col));
      col.addEventListener('click', () => show(col));
    });
    chart.addEventListener('mouseleave', () => {
      tip.classList.add('hidden');
      chart.querySelectorAll('.chart-col').forEach((c) => c.classList.remove('is-active'));
    });
  }

  r('switch').addEventListener('change', (e) => {
    granularity = e.target.value;
    try {
      localStorage.setItem(storageKey, granularity);
    } catch {
      /* rien */
    }
    r('tip').classList.add('hidden');
    render();
  });

  // Module replié : chargé seulement à la première ouverture
  if (root.tagName === 'DETAILS') {
    let loaded = false;
    root.addEventListener('toggle', () => {
      if (root.open && !loaded) {
        loaded = true;
        render();
      }
    });
  } else {
    render();
  }
}

document.querySelectorAll('.stats-module').forEach(setupModule);

// Fidélité des visiteurs sur 30 jours
const BRACKETS = { 1: '1 jour', '2-3': '2 à 3 jours', '4-9': '4 à 9 jours', '10+': '10 jours ou plus' };
const freq = document.getElementById('visitor-frequency');
const freqHost = freq?.closest('details.stats-module');
function loadFrequency() {
  visitorFrequency()
    .then((rows) => {
      const total = rows.reduce((s, x) => s + x.visitors, 0);
      freq.innerHTML = rows
        .map(
          (x) =>
            `<tr><td>Venus ${BRACKETS[x.bracket] ?? x.bracket}</td><td class="num">${fmt(x.visitors)}</td><td class="num">${
              total ? Math.round((x.visitors / total) * 100) : 0
            } %</td></tr>`,
        )
        .join('');
    })
    .catch(() => {
      freq.innerHTML = '<tr><td colspan="3">Indisponible pour le moment.</td></tr>';
    });
}
// Chargé seulement à la première ouverture du module Visiteurs
if (freq && freqHost) {
  freqHost.addEventListener('toggle', function once() {
    if (!freqHost.open) return;
    freqHost.removeEventListener('toggle', once);
    loadFrequency();
  });
}
