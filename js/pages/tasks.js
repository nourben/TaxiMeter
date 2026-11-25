import { STATUSES, TASKS } from '../data/tasks-data.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const root = document.getElementById('tasks');
const done = TASKS.filter((t) => t.status === 'done').length;
document.getElementById('progress').textContent = `${done} tâche${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${TASKS.length}`;

root.innerHTML = STATUSES.map((s) => {
  const items = TASKS.filter((t) => t.status === s.key);
  if (!items.length) return '';
  return `
    <details class="card task-group status-${s.key}"${s.open ? ' open' : ''}>
      <summary>
        <span>${esc(s.label)}</span>
        <span class="badge count">${items.length}</span>
      </summary>
      <p class="hint" style="margin:4px 0 0">${esc(s.description)}</p>
      <ul class="task-list">
        ${items
          .map(
            (t) => `
          <li>
            <span class="dot" aria-hidden="true">${s.key === 'done' ? '✓' : s.key === 'check' ? '!' : ''}</span>
            <span>
              <span class="area">${esc(t.area)}</span>
              ${esc(t.title)}
              ${t.note ? `<span class="note">${esc(t.note)}</span>` : ''}
            </span>
          </li>`,
          )
          .join('')}
      </ul>
    </details>`;
}).join('');
