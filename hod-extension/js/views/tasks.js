/* ============================================================
   views/tasks.js — Tarefas: Kanban por Prioridade + Lista
   Arrastar um card entre colunas muda a prioridade da tarefa.
   ============================================================ */
import { esc, dueInfo, emptyState, toDateInput } from '../ui.js';
import { getState, PRIORITIES, getApplication, updateTask } from '../store.js';
import { uiState } from '../state.js';
import { taskRow, deadlineChip } from '../components.js';

export const meta = { kicker: 'Tarefas', title: 'Tarefas por Prioridade' };

export function render(root) {
  const state = getState();
  const f = uiState.tasks;
  const q = f.q.toLowerCase();

  const allTasks = state.tasks || [];
  const tasks = allTasks.filter(t =>
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

  const openTasks = tasks.filter(t => t.status !== 'done').sort(byDue);
  const late = openTasks.filter(t => (dueInfo(t.dueAt)?.days ?? 1) < 0);
  const today = openTasks.filter(t => dueInfo(t.dueAt)?.days === 0);
  const soon = openTasks.filter(t => { const n = dueInfo(t.dueAt)?.days; return n !== null && n > 0 && n <= 7; });
  const later = openTasks.filter(t => { const n = dueInfo(t.dueAt)?.days; return n !== null && n > 7; });
  const noDate = openTasks.filter(t => !t.dueAt || !toDateInput(t.dueAt));
  const done = tasks.filter(t => t.status === 'done').sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  const group = (title, list, tone = '') => list.length ? `
    <section class="card tgroup ${tone}" style="margin-bottom: 12px;">
      <header class="card-head"><h3>${esc(title)}</h3><span class="kcount">${list.length}</span></header>
      <div class="task-list">${list.map(t => taskRow(t)).join('')}</div>
    </section>` : '';

  const kanbanTasks = allTasks.filter(t => t.status !== 'done' &&
    (!q || `${t.title} ${t.notes}`.toLowerCase().includes(q)) &&
    (!f.app || t.appId === f.app) &&
    f.status !== 'done');

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
          ${PRIORITIES.map(p => `<option value="${p.id}" ${f.priority === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <select data-filter="tasks.app" aria-label="Filtrar por candidatura">
          <option value="">Todas as candidaturas</option>
          ${state.applications.map(a => `<option value="${a.id}" ${f.app === a.id ? 'selected' : ''}>${esc(a.company)}${a.role ? ' — ' + esc(a.role) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="muted small">${openTasks.length} em aberto · ${late.length} atrasada(s)</span>
        <button class="btn primary" data-action="new-task">+ Nova tarefa</button>
      </div>
    </div>

    ${!allTasks.length ? emptyState('☑', 'Nenhuma tarefa ainda', 'Capture o que precisa fazer — elas serão organizadas por prioridade.', '<button class="btn primary" data-action="new-task">Criar tarefa</button>') : `

      <div style="margin-bottom: 34px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px;">
          <h3 style="font-size: 15px; font-weight: 500; letter-spacing: 0.02em; color: var(--ink);">
            Visão Kanban <span style="font-size: 13px; color: var(--muted-2); font-weight: 400;">(arraste um card para mudar a prioridade)</span>
          </h3>
        </div>

        <div class="kanban" role="list" style="display: flex; gap: 16px; overflow-x: auto; padding-bottom: 14px;">
          ${PRIORITIES.map(p => {
            const cards = kanbanTasks.filter(t => (t.priority || 'normal') === p.id);
            return `
              <section class="kcol" data-priority="${p.id}" style="min-width: 260px; max-width: 300px; flex: 1;" role="listitem" aria-label="${esc(p.name)}">
                <header class="kcol-head" style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="kdot" style="background: ${p.color};"></span>
                    <h3 style="font-size: 14px; font-weight: 600;">${esc(p.name)}</h3>
                  </div>
                  <span class="kcount">${cards.length}</span>
                </header>

                <div class="kcards" data-drop-priority="${p.id}" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                  ${cards.map(t => {
                    const linkedApp = t.appId ? getApplication(t.appId) : null;
                    return `
                      <article class="kcard" tabindex="0" draggable="true" data-id="${t.id}">
                        <div class="kcard-body" style="text-align: left; width: 100%;">
                          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                            <button class="task-check" data-action="toggle-task" data-id="${t.id}" aria-label="Concluir" style="cursor: pointer; margin-top: 2px;"><span class="box"></span></button>
                            <div style="flex: 1; min-width: 0;">
                              <div style="font-weight: 600; font-size: 13.5px; color: var(--ink); line-height: 1.35;">${esc(t.title)}</div>
                              ${linkedApp ? `<small class="muted" style="display: block; margin-top: 3px; font-size: 11.5px;">🏢 ${esc(linkedApp.company)}</small>` : ''}
                            </div>
                          </div>
                          <div class="kmeta" style="display: flex; gap: 6px; align-items: center; justify-content: space-between; margin-top: 6px;">
                            ${t.dueAt ? deadlineChip(t.dueAt) : '<span class="muted small">—</span>'}
                            <div style="display: flex; gap: 6px;">
                              <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Editar tarefa">✎</button>
                              <button class="icon-btn danger" data-action="del-task" data-id="${t.id}" title="Excluir tarefa">✕</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    `;
                  }).join('')}
                  <button class="kadd" data-action="new-task" data-priority="${p.id}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px dashed var(--line); background: transparent; color: var(--muted-2); cursor: pointer; font-size: 12.5px;">+ adicionar ${esc(p.name.toLowerCase())}</button>
                </div>
              </section>
            `;
          }).join('')}
        </div>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          <h3 style="font-size: 15px; font-weight: 500; letter-spacing: 0.02em; color: var(--ink);">
            Visão em Lista <span style="font-size: 13px; color: var(--muted-2); font-weight: 400;">(Agrupamento por prazos)</span>
          </h3>
        </div>

        ${group('Atrasadas', late, 'late')}
        ${group('Hoje', today)}
        ${group('Próximos 7 dias', soon)}
        ${group('Depois', later)}
        ${group('Sem data', noDate)}
        ${group('Concluídas', done, 'muted-group')}
      </div>
    `}
  `;

  wirePriorityDrag(root);
}

function wirePriorityDrag(root) {
  let draggingId = null;

  root.querySelectorAll('.kcard[draggable]').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggingId = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingId);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggingId = null;
      root.querySelectorAll('.kcol').forEach(c => c.classList.remove('dragover'));
    });
  });

  root.querySelectorAll('[data-drop-priority]').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.closest('.kcol')?.classList.add('dragover');
    });
    zone.addEventListener('dragleave', e => {
      if (zone.contains(e.relatedTarget)) return;
      zone.closest('.kcol')?.classList.remove('dragover');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.closest('.kcol')?.classList.remove('dragover');
      const id = draggingId || e.dataTransfer.getData('text/plain');
      const priority = zone.dataset.dropPriority;
      if (!id || !priority) return;
      const task = getState().tasks.find(t => t.id === id);
      if (!task || task.priority === priority) return;
      updateTask(id, { priority });
    });
  });
}
