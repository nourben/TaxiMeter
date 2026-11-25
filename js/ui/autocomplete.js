// Liste de suggestions sous un champ texte (combobox accessible, clavier + tactile).

let uid = 0;

/**
 * @param {HTMLInputElement} input
 * @param {object} opts
 * @param {(q:string, signal:AbortSignal) => Promise<Array<{label:string, detail?:string}>>} opts.fetch
 * @param {(item:object) => void} opts.onSelect
 * @param {number} [opts.minChars=3]
 * @param {number} [opts.delay=250]
 */
export function attachAutocomplete(input, { fetch, onSelect, minChars = 3, delay = 250 }) {
  const id = `ac-${++uid}`;
  const list = document.createElement('ul');
  list.className = 'ac-list hidden';
  list.id = id;
  list.setAttribute('role', 'listbox');
  input.insertAdjacentElement('afterend', list);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');

  let items = [];
  let active = -1;
  let timer;
  let controller;
  let lastQuery = '';

  function close() {
    list.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function render() {
    if (!items.length) return close();
    list.innerHTML = items
      .map(
        (it, i) =>
          `<li role="option" id="${id}-${i}" data-i="${i}" aria-selected="${i === active}" class="ac-item${i === active ? ' active' : ''}">
            <span class="ac-label"></span><span class="ac-detail"></span>
          </li>`,
      )
      .join('');
    // Textes insérés sans HTML (données externes)
    list.querySelectorAll('.ac-item').forEach((li, i) => {
      li.querySelector('.ac-label').textContent = items[i].label;
      li.querySelector('.ac-detail').textContent = items[i].detail ?? '';
    });
    list.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `${id}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function choose(i) {
    const it = items[i];
    if (!it) return;
    lastQuery = it.label;
    close();
    onSelect(it);
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < minChars) {
      controller?.abort();
      items = [];
      return close();
    }
    timer = setTimeout(async () => {
      if (q === lastQuery) return;
      controller?.abort();
      controller = new AbortController();
      const result = await fetch(q, controller.signal);
      if (input.value.trim() !== q) return; // saisie modifiée entre-temps
      items = result ?? [];
      active = -1;
      if (document.activeElement === input) render();
    }, delay);
  });

  input.addEventListener('keydown', (e) => {
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % items.length;
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + items.length) % items.length;
      render();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  // pointerdown plutôt que click : se déclenche avant la perte du focus
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('.ac-item');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.i));
  });

  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('focus', () => {
    if (items.length && input.value.trim() !== lastQuery) render();
  });
}
