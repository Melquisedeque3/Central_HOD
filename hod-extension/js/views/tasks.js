/* ============================================================
   views/tasks.js — lista completa de tarefas
   ============================================================ */
import { esc, dueInfo, emptyState, toDateInput } from '../ui.js';
import { getState, priorityById } from '../store.js';
import { uiState } from '../state.js';
import { taskRow } from '../components.js';

export const meta = { kicker: 'Tarefas', title: 'Tudo o que precisa ser feito' };

export function render(root) {
  const state = getState();
  const f = uiState.tasks;
  const q = f.q.toLowerCase();

  let tasks = state.tasks.filter(t =>
    (!q || `${t.title} ${t.notes}`.toLowerCase().includes(q)) &&
    (!f.priority || t.priority === f.priority) &&
    (!f.app || t.appId === f.app) &&
    (f.status === 'all' || (f.status === 'open' ? t.status !== 'done' : t.status === f.status))
  );

  const byDue = (a, b) => {
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return da - db;
  };

  const open = tasks.filter(t => t.status !== 'done').sort(byDue);
  const late = open.filter(t => (dueInfo(t.dueAt)?.days ?? 1) < 0);
  const today = open.filter(t => dueInfo(t.dueAt)?.days === 0);
  const soon = open.filter(t => { const n = dueInfo(t.dueAt)?.days; return n !== null && n > 0 && n <= 7; });
  const later = open.filter(t => { const n = dueInfo(t.dueAt)?.days; return n !== null && n > 7; });
  const noDate = open.filter(t => !t.dueAt || !toDateInput(t.dueAt));
  const done = tasks.filter(t => t.status === 'done').sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  const group = (title, list, tone = '') => list.length ? `
    <section class="card tgroup ${tone}">
      <header class="card-head"><h3>${esc(title)}</h3><span class="kcount">${list.length}</span></header>
      <div class="task-list">${list.map(t => taskRow(t)).join('')}</div>
    </section>` : '';

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="taskSearch" data-filter="tasks.q" value="${esc(f.q)}" placeholder="Buscar tarefa…" aria-label="Buscar tarefas">
        <select data-filter="tasks.status" aria-label="Filtrar por status">
          <option value="open" ${f.status === 'open' ? 'selected' : ''}>Em aberto</option>
          <option value="doing" ${f.status === 'doing' ? 'selected' : ''}>Fazendo</option>
          <option value="done" ${f.status === 'done' ? 'selected' : ''}>Concluídas</option>
          <option value="all" ${f.status === 'all' ? 'selected' : ''}>Todas</option>
        </select>
        <select data-filter="tasks.priority" aria-label="Filtrar por prioridade">
          <option value="">Todas as prioridades</option>
          ${['urgente', 'importante', 'normal', 'baixa'].map(p => `<option value="${p}" ${f.priority === p ? 'selected' : ''}>${esc(priorityById(p).name)}</option>`).join('')}
        </select>
        <select data-filter="tasks.app" aria-label="Filtrar por candidatura">
          <option value="">Todas as candidaturas</option>
          ${state.applications.map(a => `<option value="${a.id}" ${f.app === a.id ? 'selected' : ''}>${esc(a.company)}${a.role ? ' — ' + esc(a.role) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn primary" data-action="new-task">+ Nova tarefa</button>
      </div>
    </div>

    ${!state.tasks.length ? emptyState('☑', 'Nenhuma tarefa ainda', 'Capture o que precisa fazer — prazos aparecem no seu painel do dia.', '<button class="btn primary" data-action="new-task">Criar tarefa</button>') : ''}

    ${group('Atrasadas', late, 'late')}
    ${group('Hoje', today)}
    ${group('Próximos 7 dias', soon)}
    ${group('Depois', later)}
    ${group('Sem data', noDate)}
    ${group('Concluídas', done, 'muted-group')}

    ${state.tasks.length && !tasks.length ? emptyState('🔍', 'Nada encontrado', 'Ajuste os filtros para ver outras tarefas.') : ''}
  `;
}
