/* ============================================================
   views/appDetail.js — processo completo de uma candidatura
   ============================================================ */
import { esc, fmtDate, fmtDateTime, relativeTime, dueInfo, emptyState, progressBar, miniMarkdown } from '../ui.js';
import { getState, getApplication, STAGES, stageById, updateApplication, priorityById } from '../store.js';
import { stepRow, taskRow, deadlineChip, appName } from '../components.js';

export const meta = { kicker: 'Processo', title: 'Detalhe da candidatura' };

export function render(root, params) {
  const app = getApplication(params.id);
  const state = getState();

  if (!app) {
    root.innerHTML = emptyState('🔍', 'Processo não encontrado', 'Ele pode ter sido excluído ou o link está incorreto.',
      '<a class="btn primary" href="#/apps">Voltar aos processos</a>');
    return;
  }

  document.title = `${app.company} — HOD`;
  const stage = stageById(app.stage);
  root.dataset.crumb = app.company;
  root.dataset.pageTitle = app.company;
  root.dataset.subtitle = app.role ? `${app.role} · ${stage.name}` : stage.name;
  root.dataset.hidePageHead = '1';
  const done = app.steps.filter(s => s.status === 'done').length;
  const tasks = state.tasks.filter(t => t.appId === app.id);
  const openTasks = tasks.filter(t => t.status !== 'done');
  const guides = state.guidelines.filter(g => g.appId === app.id);
  const info = dueInfo(app.deadline);
  const nextStep = app.steps.filter(s => s.status !== 'done')
    .sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity))[0];

  root.innerHTML = `
    <div class="detail-top">
      <a class="back" href="#/apps">← Processos</a>
      <div class="detail-actions">
        <button class="btn ghost" data-action="edit-app" data-id="${app.id}">Editar</button>
        <button class="btn danger-ghost" data-action="del-app" data-id="${app.id}">Excluir</button>
      </div>
    </div>

    <header class="detail-head">
      <div>
        <h2 class="detail-title">${esc(app.company)}</h2>
        <p class="detail-role">${esc(app.role || 'Função a definir')}</p>
        <div class="detail-chips">
          <span class="chip stage" style="--chip:${stage.color}">${esc(stage.name)}</span>
          <span class="chip">${esc(priorityById(app.priority).name)}</span>
          ${app.location ? `<span class="chip">${esc(app.location)}</span>` : ''}
          ${app.compensation ? `<span class="chip">${esc(app.compensation)}</span>` : ''}
          ${app.appliedAt ? `<span class="chip subtle">Aplicado em ${esc(fmtDate(app.appliedAt))}</span>` : ''}
        </div>
      </div>
      <div class="detail-stage">
        <label class="field compact">
          <span>Mover para</span>
          <select data-stage-select data-id="${app.id}">
            ${STAGES.map(s => `<option value="${s.id}" ${s.id === app.stage ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </label>
        ${app.link ? `<a class="btn ghost" href="${esc(app.link)}" target="_blank" rel="noopener">Abrir vaga ↗</a>` : ''}
      </div>
    </header>

    <div class="detail-grid">
      <div class="detail-main">
        <section class="card highlight">
          <header class="card-head"><h3>Próxima ação</h3></header>
          <div class="next-action">
            <p>${esc(app.nextAction || 'Nenhuma próxima ação definida.')}</p>
            ${info ? `<div>${deadlineChip(app.deadline, { prefix: 'Prazo · ' })}</div>` : ''}
          </div>
          ${nextStep ? `<p class="muted small">Etapa em foco: <b>${esc(nextStep.title)}</b>${nextStep.dueAt ? ` · ${esc(fmtDateTime(nextStep.dueAt))}` : ''}</p>` : ''}
        </section>

        <section class="card">
          <header class="card-head">
            <h3>Etapas do processo</h3>
            <div class="head-actions">
              <span class="muted small">${done}/${app.steps.length}</span>
              <button class="btn ghost sm" data-action="add-step" data-app="${app.id}">+ Etapa</button>
            </div>
          </header>
          ${app.steps.length
            ? `${progressBar(done, app.steps.length)}<div class="step-list">${app.steps.map(s => stepRow(app, s)).join('')}</div>`
            : `<p class="muted pad">Sem etapas. Adicione certificações, provas, entrevistas e follow-ups.</p>`}
        </section>

        <section class="card">
          <header class="card-head">
            <h3>Tarefas ligadas</h3>
            <button class="btn ghost sm" data-action="new-task" data-app="${app.id}">+ Tarefa</button>
          </header>
          ${openTasks.length ? `<div class="task-list">${openTasks.map(t => taskRow(t)).join('')}</div>` : `<p class="muted pad">Nenhuma tarefa aberta.</p>`}
        </section>

        <section class="card">
          <header class="card-head">
            <h3>Guidelines de estudo</h3>
            <a class="link" href="#/study">abrir estudo →</a>
          </header>
          ${guides.length ? `<ul class="guide-list">${guides.map(g => `<li>
            <a href="#/study?g=${g.id}" class="link strong">${esc(g.title)}</a>
            <small class="muted">${esc(g.language || '—')} · ${relativeTime(g.updatedAt)}</small>
          </li>`).join('')}</ul>` : `<p class="muted pad">Nenhuma guideline ligada a este processo.</p>`}
        </section>

        ${app.notes ? `<section class="card">
          <header class="card-head"><h3>Notas</h3></header>
          <div class="markdown">${miniMarkdown(app.notes)}</div>
        </section>` : ''}
      </div>

      <aside class="detail-side">
        <section class="card">
          <header class="card-head"><h3>Linha do tempo</h3></header>
          ${app.history.length ? `<ol class="history">${app.history.slice(0, 14).map(h => `
            <li><span class="h-dot"></span><div><b>${esc(h.text)}</b><small class="muted">${esc(fmtDateTime(h.at))}</small></div></li>`).join('')}</ol>`
            : `<p class="muted pad">Sem eventos registrados.</p>`}
        </section>
        <section class="card">
          <header class="card-head"><h3>Ficha</h3></header>
          <dl class="facts">
            <div><dt>Etapa</dt><dd>${esc(stage.name)}</dd></div>
            <div><dt>Prioridade</dt><dd>${esc(priorityById(app.priority).name)}</dd></div>
            <div><dt>Prazo</dt><dd>${app.deadline ? esc(fmtDate(app.deadline)) : '—'}</dd></div>
            <div><dt>Candidatura</dt><dd>${app.appliedAt ? esc(fmtDate(app.appliedAt)) : '—'}</dd></div>
            <div><dt>Criado</dt><dd>${esc(fmtDate(app.createdAt))}</dd></div>
            <div><dt>Atualizado</dt><dd>${esc(relativeTime(app.updatedAt))}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  `;

  root.querySelector('[data-stage-select]')?.addEventListener('change', e => {
    const id = e.target.dataset.id;
    const to = e.target.value;
    updateApplication(id, { stage: to }, `Etapa alterada para ${stageById(to).name}`);
  });
}
