/* ============================================================
   views/apps.js — lista de processos/candidaturas
   ============================================================ */
import { esc, emptyState, dueInfo, fmtDate, priorityDot, progressBar } from '../ui.js';
import { getState, STAGES, stageById } from '../store.js';
import { uiState } from '../state.js';
import { deadlineChip } from '../components.js';

export const meta = { kicker: 'Processos', title: 'Candidaturas e processos' };

export function render(root) {
  const state = getState();
  const f = uiState.apps;
  const q = f.q.toLowerCase();

  const apps = [...state.applications]
    .filter(a => (!q || `${a.company} ${a.role} ${(a.tags || []).join(' ')}`.toLowerCase().includes(q)) && (!f.stage || a.stage === f.stage))
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db || a.company.localeCompare(b.company);
    });

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="appsSearch" data-filter="apps.q" value="${esc(f.q)}" placeholder="Buscar empresa, função ou tag…" aria-label="Buscar processos">
        <select data-filter="apps.stage" aria-label="Filtrar por etapa">
          <option value="">Todas as etapas</option>
          ${STAGES.map(s => `<option value="${s.id}" ${f.stage === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="muted small">${apps.length} processo(s)</span>
        <button class="btn primary" data-action="new-app">+ Nova candidatura</button>
      </div>
    </div>

    ${!state.applications.length
      ? emptyState('🗂', 'Nenhum processo cadastrado', 'Cada candidatura vira um processo com etapas, prazos e histórico.', '<button class="btn primary" data-action="new-app">Criar candidatura</button>')
      : `<div class="table-wrap"><table class="table">
          <thead><tr>
            <th>Empresa / função</th><th>Etapa</th><th>Próxima ação</th><th>Prazo</th><th>Etapas</th><th></th>
          </tr></thead>
          <tbody>
            ${apps.map(app => {
              const done = app.steps.filter(s => s.status === 'done').length;
              const stage = stageById(app.stage);
              const info = dueInfo(app.deadline);
              return `<tr>
                <td>
                  <button class="cell-main" data-action="open-app" data-id="${app.id}">
                    <strong>${esc(app.company)}</strong>
                    <small class="muted">${esc(app.role || 'Função a definir')}</small>
                  </button>
                </td>
                <td><span class="chip stage" style="--chip:${stage.color}">${esc(stage.short)}</span></td>
                <td class="cell-action">${app.nextAction ? esc(app.nextAction) : '<span class="muted">— definir —</span>'}</td>
                <td>${app.deadline ? deadlineChip(app.deadline) : '<span class="muted">—</span>'}</td>
                <td><div class="cell-progress">${progressBar(done, app.steps.length)}<small class="muted">${done}/${app.steps.length}</small></div></td>
                <td class="row-actions">
                  <button class="icon-btn" data-action="edit-app" data-id="${app.id}" aria-label="Editar">✎</button>
                  <button class="icon-btn danger" data-action="del-app" data-id="${app.id}" aria-label="Excluir">✕</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
  `;
}
