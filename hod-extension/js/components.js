/* ============================================================
   components.js — pedaços de interface reutilizados
   ============================================================ */
import { esc, dueInfo, fmtDate, priorityDot, progressBar } from './ui.js';
import { getState, priorityById, stageById } from './store.js';

export function deadlineChip(date, { prefix = '' } = {}) {
  const info = dueInfo(date);
  if (!info) return '';
  return `<span class="chip due ${info.tone}">${prefix}${esc(info.text)}</span>`;
}

export function appName(app) {
  if (!app) return '';
  return app.role ? `${app.company} — ${app.role}` : app.company;
}

export function taskRow(task, { compact = false } = {}) {
  const app = task.appId ? getState().applications.find(a => a.id === task.appId) : null;
  const done = task.status === 'done';
  const info = dueInfo(task.dueAt);
  const overdue = info && info.tone === 'over' && !done;
  return `<div class="task-row ${done ? 'done' : ''} ${overdue ? 'overdue' : ''}" data-task-id="${task.id}">
    <button class="check ${done ? 'on' : ''}" data-action="toggle-task" data-id="${task.id}"
      aria-label="${done ? 'Reabrir' : 'Concluir'} tarefa" aria-pressed="${done}">
      ${done ? '✓' : ''}
    </button>
    <div class="task-main">
      <div class="task-title">${esc(task.title)}</div>
      <div class="task-meta">
        ${priorityDot(task.priority)}
        ${app ? `<button class="link" data-action="open-app" data-id="${app.id}">${esc(app.company)}</button>` : ''}
        ${task.notes && !compact ? `<span class="muted">· ${esc(task.notes.slice(0, 90))}</span>` : ''}
      </div>
    </div>
    ${task.dueAt ? deadlineChip(task.dueAt) : ''}
    <div class="row-actions">
      <button class="icon-btn" data-action="edit-task" data-id="${task.id}" aria-label="Editar tarefa">✎</button>
      <button class="icon-btn danger" data-action="del-task" data-id="${task.id}" aria-label="Excluir tarefa">✕</button>
    </div>
  </div>`;
}

export function stageChip(stageId) {
  const stage = stageById(stageId);
  return `<span class="chip stage" style="--chip:${stage.color}">${esc(stage.short)}</span>`;
}

export function appRow(app) {
  const done = app.steps.filter(s => s.status === 'done').length;
  const total = app.steps.length;
  const info = dueInfo(app.deadline);
  return `<button class="app-row" data-action="open-app" data-id="${app.id}">
    <div class="app-row-main">
      <div class="app-company">${esc(app.company)}</div>
      <div class="app-role">${esc(app.role || 'Sem função definida')}</div>
    </div>
    <div class="app-row-meta">
      ${stageChip(app.stage)}
      ${total ? `<span class="muted small">${done}/${total} etapas</span>` : ''}
      ${info ? deadlineChip(app.deadline) : ''}
      ${priorityDot(app.priority)}
    </div>
  </button>`;
}

export function stepRow(app, step) {
  const info = dueInfo(step.dueAt);
  const done = step.status === 'done';
  return `<div class="step-row ${done ? 'done' : ''}" data-step-id="${step.id}">
    <button class="check ${done ? 'on' : ''}" data-action="toggle-step" data-app="${app.id}" data-id="${step.id}"
      aria-label="${done ? 'Reabrir etapa' : 'Concluir etapa'}" aria-pressed="${done}">${done ? '✓' : ''}</button>
    <div class="step-main">
      <div class="step-title">${esc(step.title)}</div>
      <div class="task-meta"><span class="chip tiny">${esc(step.kind)}</span>${step.notes ? `<span class="muted small">${esc(step.notes.slice(0, 80))}</span>` : ''}</div>
    </div>
    ${step.dueAt ? deadlineChip(step.dueAt) : ''}
    <div class="row-actions">
      <button class="icon-btn" data-action="edit-step" data-app="${app.id}" data-id="${step.id}" aria-label="Editar etapa">✎</button>
      <button class="icon-btn danger" data-action="del-step" data-app="${app.id}" data-id="${step.id}" aria-label="Excluir etapa">✕</button>
    </div>
  </div>`;
}

export function stageSummary(apps, currentStage) {
  const counts = Object.fromEntries(
    ['mapeada', 'aplicada', 'teste', 'entrevista', 'proposta', 'ativa', 'encerrada']
      .map(id => [id, apps.filter(a => a.stage === id).length])
  );
  return `<div class="stage-summary">
    ${['mapeada', 'aplicada', 'teste', 'entrevista', 'proposta', 'ativa'].map(id => {
      const stage = stageById(id);
      return `<a class="stage-pill ${currentStage === id ? 'active' : ''}" href="#/pipeline">
        <i style="--c:${stage.color}"></i>${esc(stage.short)}<b>${counts[id]}</b>
      </a>`;
    }).join('')}
  </div>`;
}

export function appProgress(app) {
  const done = app.steps.filter(s => s.status === 'done').length;
  return `${progressBar(done, app.steps.length)}<span class="muted small">${done}/${app.steps.length || 0}</span>`;
}

export function priorityLabel(id) {
  return priorityById(id).name;
}

export function fmtShort(date) {
  return fmtDate(date);
}
