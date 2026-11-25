import { STATUSES, TASKS } from '../data/tasks-data.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const done = TASKS.filter((t) => t.status === 'done').length;
document.getElementById('progress').innerHTML = `${done} faite${done > 1 ? 's' : ''} sur ${TASKS.length}<span class="scroll-hint"> · faites défiler les colonnes →</span>`;

document.getElementById('tasks').innerHTML = STATUSES.map((s) => {
  const items = TASKS.filter((t) => t.status === s.key);
  return `
    <section class="column status-${s.key}" aria-label="${esc(s.label)}">
      <header class="column-head">
        <h2>${esc(s.label)}</h2>
        <span class="badge">${items.length}</span>
      </header>
      <p class="column-desc">${esc(s.description)}</p>
      <ul class="column-cards">
        ${
          items.length
            ? items
                .map(
                  (t) => `
          <li class="task-card">
            <span class="area">${esc(t.area)}</span>
            <span class="task-title">${esc(t.title)}</span>
            ${t.note ? `<span class="note">${esc(t.note)}</span>` : ''}
          </li>`,
                )
                .join('')
            : '<li class="column-empty">Rien pour l’instant</li>'
        }
      </ul>
    </section>`;
}).join('');
