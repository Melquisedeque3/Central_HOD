/* ============================================================
   views/apps.js — Candidaturas: Kanban por Empresa + Lista
   Arrastar um card para a coluna de outra empresa reatribui a
   empresa daquela candidatura (persistido no vault).
   ============================================================ */
import { esc, emptyState, fmtDate, priorityDot, progressBar } from '../ui.js';
import { getState, STAGES, stageById, updateApplication } from '../store.js';
import { uiState } from '../state.js';
import { deadlineChip } from '../components.js';

export const meta = { kicker: 'Candidaturas', title: 'Candidaturas por Empresa' };

export function render(root) {
  const state = getState();
  const f = uiState.apps;
  const q = f.q.toLowerCase();

  const allApps = state.applications || [];
  const filteredApps = allApps
    .filter(a => (!q || `${a.company} ${a.role} ${(a.tags || []).join(' ')}`.toLowerCase().includes(q)) && (!f.stage || a.stage === f.stage))
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db || a.company.localeCompare(b.company);
    });

  const companyGroups = {};
  filteredApps.forEach(app => {
    const company = (app.company || 'Sem empresa').trim();
    if (!companyGroups[company]) companyGroups[company] = [];
    companyGroups[company].push(app);
  });

  const companies = Object.keys(companyGroups).sort((a, b) => a.localeCompare(b));
  const hasFilter = !!(q || f.stage);

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="appsSearch" data-filter="apps.q" value="${esc(f.q)}" placeholder="Buscar empresa, função ou tag…" aria-label="Buscar candidaturas">
        <select data-filter="apps.stage" aria-label="Filtrar por etapa">
          <option value="">Todas as etapas</option>
          ${STAGES.map(s => `<option value="${s.id}" ${f.stage === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="muted small">${filteredApps.length} de ${allApps.length} candidatura(s) · ${companies.length} empresa(s)</span>
        <button class="btn primary" data-action="new-app">+ Nova candidatura</button>
      </div>
    </div>

    ${!allApps.length
      ? emptyState('🗂', 'Nenhuma candidatura cadastrada', 'Adicione vagas para ver os quadros organizados automaticamente por empresa.', '<button class="btn primary" data-action="new-app">Criar candidatura</button>')
      : !filteredApps.length
        ? emptyState('🔎', 'Nada encontrado com esse filtro', 'Ajuste a busca ou a etapa para ver suas candidaturas.', '<button class="btn" data-action="clear-apps-filter">Limpar filtros</button>')
        : `
        <div style="margin-bottom: 34px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px;">
            <h3 style="font-size: 15px; font-weight: 500; letter-spacing: 0.02em; color: var(--ink);">
              Visão Kanban <span style="font-size: 13px; color: var(--muted-2); font-weight: 400;">(arraste um card para outra empresa para reatribuir)</span>
            </h3>
          </div>

          <div class="kanban" role="list" style="display: flex; gap: 16px; overflow-x: auto; padding-bottom: 14px;">
            ${companies.map(company => {
              const cards = companyGroups[company];
              return `
                <section class="kcol" data-company="${esc(company)}" style="min-width: 280px; max-width: 320px; flex: 1;" role="listitem" aria-label="${esc(company)}">
                  <header class="kcol-head" style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                      <span class="kdot" style="background: var(--accent);"></span>
                      <h3 style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(company)}</h3>
                    </div>
                    <span class="kcount">${cards.length}</span>
                  </header>

                  <div class="kcards" data-drop-company="${esc(company)}" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                    ${cards.map(app => {
                      const stage = stageById(app.stage);
                      const done = app.steps.filter(s => s.status === 'done').length;
                      return `
                        <article class="kcard" tabindex="0" draggable="true" data-id="${app.id}">
                          <button class="kcard-body" data-action="open-app" data-id="${app.id}" style="text-align: left; width: 100%; border: none; background: transparent; cursor: pointer;">
                            <div class="kcard-top" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                              <span class="chip stage" style="--chip:${stage.color}; font-size: 10.5px;">${esc(stage.short)}</span>
                              ${priorityDot(app.priority)}
                            </div>
                            <div class="krole" style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: var(--ink);">${esc(app.role || 'Função a definir')}</div>
                            ${app.nextAction ? `<div class="knext" style="font-size: 12px; margin-bottom: 6px;"><b>Próxima:</b> ${esc(app.nextAction)}</div>` : ''}
                            <div class="kmeta" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                              ${app.deadline ? deadlineChip(app.deadline) : ''}
                              ${app.steps.length ? `<span class="chip tiny">${done}/${app.steps.length} etapas</span>` : ''}
                            </div>
                          </button>
                          <div class="kcard-actions" style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: flex-end; gap: 8px;">
                            <button class="icon-btn" data-action="edit-app" data-id="${app.id}" title="Editar candidatura">✎</button>
                            <button class="icon-btn danger" data-action="del-app" data-id="${app.id}" title="Excluir candidatura">✕</button>
                          </div>
                        </article>
                      `;
                    }).join('')}
                    <button class="kadd" data-action="new-app" data-company="${esc(company)}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px dashed var(--line); background: transparent; color: var(--muted-2); cursor: pointer; font-size: 12.5px;">+ nova vaga nesta empresa</button>
                  </div>
                </section>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
            <h3 style="font-size: 15px; font-weight: 500; letter-spacing: 0.02em; color: var(--ink);">
              Visão em Lista <span style="font-size: 13px; color: var(--muted-2); font-weight: 400;">(${filteredApps.length} vagas encontradas)</span>
            </h3>
          </div>

          <div class="table-wrap"><table class="table">
            <thead><tr>
              <th>Empresa / Função</th><th>Etapa</th><th>Próxima ação</th><th>Prazo</th><th>Progresso</th><th>Ações</th>
            </tr></thead>
            <tbody>
              ${filteredApps.map(app => {
                const stage = stageById(app.stage);
                const done = app.steps.filter(s => s.status === 'done').length;
                return `<tr>
                  <td class="cell-main">
                    <div><b>${esc(app.company)}</b></div>
                    <div class="muted small">${esc(app.role || 'Função a definir')}</div>
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
          </table></div>
        </div>
      `}
  `;

  root.querySelector('[data-action="clear-apps-filter"]')?.addEventListener('click', () => {
    uiState.apps = { q: '', stage: '' };
    render(root);
  });

  wireCompanyDrag(root);
}

/* arrastar card entre colunas de empresa = reatribuir empresa */
function wireCompanyDrag(root) {
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
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target === el) location.hash = `#/apps/${el.dataset.id}`;
    });
  });

  root.querySelectorAll('[data-drop-company]').forEach(zone => {
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
      const company = zone.dataset.dropCompany;
      if (!id || !company) return;
      const app = getState().applications.find(a => a.id === id);
      if (!app || app.company === company) return;
      updateApplication(id, { company }, `Empresa alterada para ${company}`);
    });
  });
}
