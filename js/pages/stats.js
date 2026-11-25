import { courses } from '../services/storage.js';
import { formatEuro } from '../core/pricing.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (n, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

async function render() {
  const all = await courses.list();
  const empty = all.length === 0;
  $('stats-empty').classList.toggle('hidden', !empty);
  $('stats-content').classList.toggle('hidden', empty);
  if (empty) return;

  const total = all.reduce((s, c) => s + c.total, 0);
  const km = all.reduce((s, c) => s + c.distanceKm, 0);
  const nuit = all.filter((c) => c.period === 'nuit').length;
  const metro = all.filter((c) => c.metropole).length;

  $('stat-count').textContent = all.length;
  $('stat-revenue').textContent = formatEuro(total);
  $('stat-avg').textContent = formatEuro(total / all.length);
  $('stat-km').textContent = `${num(km)} km`;
  $('stat-split').textContent = `${all.length - nuit} jour · ${nuit} nuit · ${metro} Métropole`;

  $('stat-rows').innerHTML = all
    .slice(0, 50)
    .map((c) => {
      const d = new Date(c.departureAt);
      return `<tr>
        <td>${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${esc(c.origin || '—')} → ${esc(c.destination || '—')}${c.courseNo === 2 ? ' <span class="badge">2e</span>' : ''}</td>
        <td class="num">${num(c.distanceKm)}</td>
        <td>${c.period === 'nuit' ? 'Nuit' : 'Jour'}${c.metropole ? ' + M' : ''}</td>
        <td class="num">${formatEuro(c.total)}</td>
      </tr>`;
    })
    .join('');
}

$('stats-clear').addEventListener('click', async () => {
  if (!$('stats-clear').dataset.confirm) {
    $('stats-clear').dataset.confirm = '1';
    $('stats-clear').textContent = 'Confirmer la suppression';
    return;
  }
  await courses.clear();
  delete $('stats-clear').dataset.confirm;
  $('stats-clear').textContent = 'Effacer l’historique';
  render();
});

render();
