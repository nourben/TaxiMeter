// Choix du département (info « i » des tarifs) : bouton arrondi comme « Départ ».
// Sur téléphone, la liste native (roue iOS) s'ouvre ; sur ordinateur, un panneau
// avec recherche remplace la vieille liste déroulante. Le choix met à jour le <select>
// caché et déclenche un événement « change » (traité par la page).

import { DEPARTMENT_RATES } from '../config/tarifs.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches;

export function attachDeptPicker(wrap) {
  const btn = wrap.querySelector('.dept-btn');
  const select = wrap.querySelector('select[data-f="dept"]');
  if (!btn || !select || wrap.dataset.ready) return;
  wrap.dataset.ready = '1';

  const panel = document.createElement('div');
  panel.className = 'dept-panel hidden';
  panel.innerHTML = `
    <input type="text" class="dept-search" placeholder="Numéro ou nom du département" aria-label="Rechercher un département" autocomplete="off" />
    <ul class="dept-list" role="listbox" aria-label="Départements"></ul>`;
  wrap.appendChild(panel);
  const input = panel.querySelector('input');
  const list = panel.querySelector('ul');
  let items = [];
  let active = 0;

  function render() {
    const q = norm(input.value.trim());
    items = DEPARTMENT_RATES.filter(([code, name]) => !q || norm(`${code} ${name}`).includes(q));
    active = Math.min(active, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items
          .map(([code, name, rate], i) =>
            `<li role="option" data-code="${code}" class="${i === active ? 'is-active' : ''}${code === select.value ? ' is-selected' : ''}" aria-selected="${code === select.value}"><span><b>${code}</b> ${name}</span><span class="dept-li-rate">${String(rate.toFixed(2)).replace('.', ',')} €</span></li>`)
          .join('')
      : '<li class="dept-empty">Aucun département</li>';
  }
  function open() {
    input.value = '';
    active = Math.max(0, DEPARTMENT_RATES.findIndex(([code]) => code === select.value));
    render();
    panel.classList.remove('hidden');
    wrap.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    input.focus();
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }
  function close() {
    panel.classList.add('hidden');
    wrap.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function choose(code) {
    select.value = code;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    btn.focus();
  }

  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    if (coarse()) return; // le <select> natif posé sur le bouton s'ouvre
    panel.classList.contains('hidden') ? open() : close();
  });
  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
      render();
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[active]) choose(items[active][0]);
    } else if (e.key === 'Escape') {
      close();
      btn.focus();
    }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault()); // garde le focus dans la recherche
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-code]');
    if (li) choose(li.dataset.code);
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });
}
