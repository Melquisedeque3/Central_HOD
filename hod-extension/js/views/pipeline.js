/* ============================================================
   views/pipeline.js — kanban de candidaturas
   ============================================================ */
import { esc, dueInfo, priorityDot, emptyState } from '../ui.js';
import { getState, STAGES, moveApplication, priorityById } from '../store.js';
import { uiState } from '../state.js';
import { deadlineChip, stageChip } from '../components.js';

export const meta = { kicker: 'Pipeline', title: 'Fluxo de candidaturas' };

export function render(root) {
  const state = getState();
  const q = uiState.pipeline.q.toLowerCase();
  const prio = uiState.pipeline.priority;

  const apps = state.applications.filter(a =>
    (!q || `${a.company} ${a.role} ${(a.tags || []).join(' ')}`.toLowerCase().includes(q)) &&
    (!prio || a.priority === prio)
  );

  const total = state.applications.length;
  const active = state.applications.filter(a => a.stage !== 'encerrada').length;

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="pipeSearch" data-filter="pipeline.q" value="${esc(uiState.pipeline.q)}" placeholder="Buscar empresa, função ou tag…" aria-label="Buscar candidaturas">
        <select data-filter="pipeline.priority" aria-label="Filtrar por prioridade">
          <option value="">Todas as prioridades</option>
          ${['urgente', 'importante', 'normal', 'baixa'].map(p => `<option value="${p}" ${prio === p ? 'selected' : ''}>${esc(priorityById(p).name)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="muted small">${active} ativas · ${total} no total</span>
        <button class="btn primary" data-action="new-app">+ Nova candidatura</button>
      </div>
    </div>

    ${!total ? emptyState('▦', 'Seu pipeline está vazio', 'Cadastre a primeira candidatura para acompanhar etapas, prazos e próximas ações.', '<button class="btn primary" data-action="new-app">Criar candidatura</button>') : ''}

    <div class="kanban" role="list">
      ${STAGES.map(stage => {
        const cards = apps.filter(a => a.stage === stage.id);
        return `<section class="kcol" data-stage="${stage.id}" style="--stage:${stage.color}" role="listitem" aria-label="${esc(stage.name)}">
          <header class="kcol-head">
            <span class="kdot"></span>
            <h3>${esc(stage.name)}</h3>
            <span class="kcount">${cards.length}</span>
          </header>
          <div class="kcards" data-drop="${stage.id}">
            ${cards.map(card).join('')}
            <button class="kadd" data-action="new-app">+ adicionar</button>
          </div>
        </section>`;
      }).join('')}
    </div>
  `;

  wireDrag(root);
}

function card(app) {
  const done = app.steps.filter(s => s.status === 'done').length;
  const total = app.steps.length;
  const info = dueInfo(app.deadline);
  return `<article class="kcard" draggable="true" data-id="${app.id}" tabindex="0">
    <button class="kcard-body" data-action="open-app" data-id="${app.id}">
      <div class="kcard-top">
        <span class="kcompany">${esc(app.company)}</span>
        ${priorityDot(app.priority)}
      </div>
      <div class="krole">${esc(app.role || 'Função a definir')}</div>
      ${app.nextAction ? `<div class="knext"><b>Próxima</b> ${esc(app.nextAction)}</div>` : `<div class="knext warn"><b>Sem próxima ação</b></div>`}
      <div class="kmeta">
        ${info ? deadlineChip(app.deadline) : ''}
        ${total ? `<span class="chip tiny">${done}/${total} etapas</span>` : ''}
        ${app.location ? `<span class="muted small">${esc(app.location)}</span>` : ''}
      </div>
    </button>
    <div class="kcard-actions">
      <button class="icon-btn" data-action="edit-app" data-id="${app.id}" aria-label="Editar candidatura">✎</button>
      <button class="icon-btn danger" data-action="del-app" data-id="${app.id}" aria-label="Excluir candidatura">✕</button>
    </div>
  </article>`;
}

function wireDrag(root) {
  let draggingId = null;
  root.querySelectorAll('.kcard').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggingId = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingId);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      root.querySelectorAll('.kcol').forEach(c => c.classList.remove('dragover'));
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target === el) location.hash = `#/apps/${el.dataset.id}`;
    });
  });
  root.querySelectorAll('[data-drop]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.closest('.kcol').classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.closest('.kcol').classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.closest('.kcol').classList.remove('dragover');
      const id = draggingId || e.dataTransfer.getData('text/plain');
      if (id) moveApplication(id, zone.dataset.drop);
    });
  });
}
