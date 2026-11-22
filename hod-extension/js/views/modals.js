/* ============================================================
   modals.js — formulários de criação e edição
   ============================================================ */
import {
  openModal, confirmAction, field, textarea, select, toDateTimeInput, toDateInput, toast,
} from '../ui.js';
import {
  getState, createTask, updateTask, deleteTask, getTask,
  createApplication, updateApplication, deleteApplication, getApplication,
  addStep, updateStep, deleteStep,
  createGuideline, updateGuideline, deleteGuideline, getGuideline,
  STAGES, PRIORITIES, STEP_KINDS,
} from '../store.js';
import * as api from '../api.js';

const appOptions = (selected = '') => [
  { value: '', label: '— Nenhuma —' },
  ...getState().applications.map(a => ({ value: a.id, label: `${a.company}${a.role ? ' — ' + a.role : ''}` })),
].map(o => ({ ...o, selected: o.value === selected }));

/* ---------- tarefa ---------- */
export function openTaskModal(id = '', preset = {}) {
  const task = id ? getTask(id) : null;
  const initialPriority = task?.priority || preset.priority || 'normal';
  openModal({
    title: task ? 'Editar tarefa' : 'Nova tarefa',
    body: `
      ${field('Tarefa', 'title', task?.title || preset.title || '', { required: true, placeholder: 'O que precisa ser feito?' })}
      <div class="grid-2">
        ${field('Prazo e hora', 'dueAt', toDateTimeInput(task?.dueAt || preset.dueAt || ''), { type: 'datetime-local' })}
        ${select('Prioridade', 'priority', PRIORITIES.map(p => ({ value: p.id, label: p.name })), initialPriority)}
      </div>
      ${select('Candidatura relacionada', 'appId', appOptions(task?.appId || preset.appId || ''))}
      ${textarea('Notas', 'notes', task?.notes || '', { rows: 3, placeholder: 'Contexto, links, detalhes…' })}
    `,
    onSubmit(data) {
      const payload = {
        title: data.title.trim(),
        dueAt: data.dueAt || '',
        priority: data.priority,
        status: task?.status || preset.status || 'todo',
        appId: data.appId,
        notes: data.notes.trim(),
      };
      if (!payload.title) { toast('Dê um título à tarefa.'); return false; }
      const linkedApp = payload.appId ? getApplication(payload.appId) : null;
      payload.appLabel = linkedApp ? `${linkedApp.company}${linkedApp.role ? ' — ' + linkedApp.role : ''}` : '';
      if (task?.isMain) payload.isMain = true;

      if (task) { updateTask(task.id, payload); toast('Tarefa atualizada'); }
      else { createTask(payload); toast('Tarefa criada'); }
    },
  });
}

export async function confirmDeleteTask(id) {
  const task = getTask(id);
  if (!task) return;
  if (await confirmAction(`Excluir a tarefa “${task.title}”?`, { confirmLabel: 'Excluir' })) {
    deleteTask(id);
    toast('Tarefa excluída');
  }
}

/* ---------- candidatura ---------- */
export function openAppModal(id = '', preset = {}) {
  const app = id ? getApplication(id) : null;
  const currentStage = app?.stage || preset.stage || 'aplicado';
  // A tarefa de acompanhamento é opcional na criação. Em candidaturas já
  // existentes, preservamos os dados e a tarefa vinculada, quando houver.
  const taskEnabled = app ? true : false;

  openModal({
    title: app ? 'Editar candidatura' : 'Nova candidatura',
    wide: true,
    body: `
      <div class="grid-2">
        ${field('Empresa', 'company', app?.company || preset.company || '', { required: true, placeholder: 'Ex.: Welocalize' })}
        ${field('Função / projeto', 'role', app?.role || preset.role || '', { placeholder: 'Ex.: Language Tester PT-BR' })}
      </div>
      <div class="grid-2">
        ${select('Etapa', 'stage', STAGES.map(s => ({ value: s.id, label: s.name })), currentStage)}
        ${field('Data da candidatura', 'appliedAt', toDateInput(app?.appliedAt || preset.appliedAt || new Date().toISOString().slice(0, 10)), { type: 'date' })}
      </div>
      ${!app ? `<label class="field inline app-task-toggle">
        <input type="checkbox" name="createTask" ${taskEnabled ? 'checked' : ''}>
        <span>Criar tarefa de acompanhamento</span>
      </label>` : ''}
      <div id="appTaskFields" class="${taskEnabled ? '' : 'is-disabled'}">
        <div class="grid-2">
          ${field('Próxima ação', 'nextAction', app?.nextAction || preset.nextAction || '', { placeholder: 'Ex.: Enviar e-mail de follow-up' })}
          <div></div>
        </div>
        <div class="grid-2">
          ${field('Prazo', 'deadline', toDateInput(app?.deadline || preset.deadline || ''), { type: 'date' })}
          ${select('Prioridade', 'priority', PRIORITIES.map(p => ({ value: p.id, label: p.name })), app?.priority || preset.priority || 'normal')}
        </div>
      </div>
      <div class="grid-2">
        ${field('Link', 'link', app?.link || preset.link || '', { placeholder: 'https://…' })}
        ${field('Localidade', 'location', app?.location || preset.location || '', { placeholder: 'Remoto / país' })}
      </div>
      <div class="grid-2">
        ${field('Remuneração', 'compensation', app?.compensation || preset.compensation || '', { placeholder: 'Ex.: US$ 12/h' })}
        <div></div>
      </div>
      <div id="closeReasonWrap" style="display:${currentStage === 'encerrado' ? 'block' : 'none'};margin-top:6px;">
        ${field('Motivo do encerramento', 'closeReason', app?.closeReason || '', { placeholder: 'Ex.: Projeto concluído / Contrato encerrado' })}
      </div>
      ${textarea('Notas individuais da candidatura', 'notes', app?.notes || preset.notes || '', { rows: 4, placeholder: 'Instruções de inscrição, contatos, observações…' })}
    `,
    onMount(dialog) {
      const stageSelect = dialog.querySelector('select[name="stage"]');
      const reasonWrap = dialog.querySelector('#closeReasonWrap');
      stageSelect?.addEventListener('change', () => {
        if (reasonWrap) reasonWrap.style.display = stageSelect.value === 'encerrado' ? 'block' : 'none';
      });
      const toggle = dialog.querySelector('input[name="createTask"]');
      const taskFields = dialog.querySelector('#appTaskFields');
      const setTaskFields = enabled => {
        taskFields?.classList.toggle('is-disabled', !enabled);
        taskFields?.querySelectorAll('input, select').forEach(input => { input.disabled = !enabled; });
      };
      if (toggle) {
        setTaskFields(toggle.checked);
        toggle.addEventListener('change', () => setTaskFields(toggle.checked));
      }
    },
    async onSubmit(data) {
      const createTask = app ? true : data.createTask === 'on';
      const payload = {
        company: data.company.trim(),
        role: data.role.trim(),
        stage: data.stage,
        priority: createTask ? (data.priority || 'normal') : 'normal',
        nextAction: createTask ? (data.nextAction || '').trim() : '',
        deadline: createTask ? (data.deadline || '') : '',
        appliedAt: data.appliedAt,
        link: data.link.trim(),
        location: data.location.trim(),
        compensation: data.compensation.trim(),
        closeReason: (data.closeReason || '').trim(),
        notes: data.notes.trim(),
        taskEnabled: createTask,
        mainTaskId: app?.mainTaskId || '',
      };
      if (!payload.company) { toast('Informe a empresa.'); return false; }
      if (payload.stage === 'encerrado' && !payload.closeReason) {
        toast('Informe o motivo de encerramento da candidatura.', 'error');
        return false;
      }

      if (app) {
        const stageChanged = app.stage !== payload.stage;
        let adminCorrection = false;
        let adminReason = '';

        if (stageChanged) {
          const { canTransition } = await import('../store.js');
          if (!canTransition(app.stage, payload.stage)) {
            const justify = window.prompt(
              `A transição direta de "${app.stage}" para "${payload.stage}" não faz parte do fluxo padrão.\n\nSe for uma correção de erro administrativo, digite a justificativa para registrar no histórico:`
            );
            if (!justify || !justify.trim()) {
              toast('Transição cancelada: justificativa obrigatória para correção.', 'error');
              return false;
            }
            adminCorrection = true;
            adminReason = justify.trim();
          }
        }

        updateApplication(
          app.id,
          payload,
          stageChanged ? `Etapa alterada para ${STAGES.find(s => s.id === payload.stage)?.name}${adminReason ? ' (Correção: ' + adminReason + ')' : ''}` : '',
          { adminCorrection, reason: adminReason || payload.closeReason }
        );
        toast('Candidatura atualizada');
      } else {
        createApplication(payload);
        toast('Candidatura criada com sucesso');
      }
    },
  });
}

/* ---------- oportunidade (manual) ---------- */
export function openOpportunityModal(id = '', preset = {}) {
  const state = getState();
  const opp = id ? (state.opportunities || []).find(o => o.id === id) : null;

  openModal({
    title: opp ? 'Editar oportunidade' : 'Nova oportunidade identificada',
    wide: true,
    body: `
      <div class="grid-2">
        ${field('Empresa', 'company', opp?.company || preset.company || '', { required: true, placeholder: 'Ex.: Appen / Telus' })}
        ${field('Cargo / Projeto', 'title', opp?.title || preset.title || '', { required: true, placeholder: 'Ex.: Search Evaluator' })}
      </div>
      <div class="grid-2">
        ${field('Plataforma / Fonte', 'source', opp?.source || preset.source || 'Manual', { placeholder: 'LinkedIn / Remoto / Upwork' })}
        ${select('Situação', 'status', [
          { value: 'found', label: 'Identificada (não aplicada)' },
          { value: 'reviewing', label: 'Em análise' },
          { value: 'applied', label: 'Inscrição realizada (convertida)' },
          { value: 'discarded', label: 'Descartada' },
        ], opp?.status || preset.status || 'found')}
      </div>
      <div class="grid-2">
        ${field('Link da vaga', 'url', opp?.url || preset.url || '', { placeholder: 'https://…' })}
        ${select('Prioridade estimada', 'priority', PRIORITIES.map(p => ({ value: p.id, label: p.name })), opp?.priority || preset.priority || 'normal')}
      </div>
      ${textarea('Descrição e requisitos', 'description', opp?.description || preset.description || '', { rows: 4, placeholder: 'Requisitos da vaga, qualificações necessárias…' })}
    `,
    async onSubmit(data) {
      const payload = {
        id: opp?.id || `opp_${Date.now().toString(36)}`,
        company: data.company.trim(),
        title: data.title.trim(),
        source: data.source.trim() || 'Manual',
        status: data.status,
        url: data.url.trim(),
        priority: data.priority,
        description: data.description.trim(),
        collectedAt: opp?.collectedAt || new Date().toISOString(),
      };
      if (!payload.company || !payload.title) {
        toast('Informe a empresa e o cargo/projeto.', 'error');
        return false;
      }
      try {
        await api.putRecord('opportunity', payload);
        const st = getState();
        const existingIdx = (st.opportunities || []).findIndex(o => o.id === payload.id);
        if (existingIdx >= 0) st.opportunities[existingIdx] = payload;
        else {
          if (!st.opportunities) st.opportunities = [];
          st.opportunities.unshift(payload);
        }
        toast('Oportunidade salva');
      } catch (err) {
        toast(`Erro ao salvar oportunidade: ${err.message}`, 'error');
      }
    },
  });
}

export async function confirmDeleteApp(id) {
  const app = getApplication(id);
  if (!app) return;
  if (await confirmAction(`Excluir “${app.company} — ${app.role}”? Tarefas e guidelines ligadas também serão removidas.`, { confirmLabel: 'Excluir' })) {
    deleteApplication(id);
    toast('Candidatura excluída');
    if (location.hash.startsWith(`#/apps/${id}`)) location.hash = '#/apps';
  }
}

/* ---------- etapa ---------- */
export function openStepModal(appId, stepId = '') {
  const app = getApplication(appId);
  if (!app) return;
  const step = stepId ? app.steps.find(s => s.id === stepId) : null;
  openModal({
    title: step ? 'Editar etapa' : 'Nova etapa do processo',
    subtitle: `${app.company}${app.role ? ' — ' + app.role : ''}`,
    body: `
      ${field('Título', 'title', step?.title || '', { required: true, placeholder: 'Ex.: Prova de idioma — 45 min' })}
      <div class="grid-2">
        ${select('Tipo', 'kind', STEP_KINDS.map(k => ({ value: k, label: k })), step?.kind || 'Prova / Teste')}
        ${field('Prazo', 'dueAt', toDateTimeInput(step?.dueAt || ''), { type: 'datetime-local' })}
      </div>
      ${textarea('Notas', 'notes', step?.notes || '', { rows: 3, placeholder: 'Instruções, links, o que estudar…' })}
    `,
    onSubmit(data) {
      const payload = {
        title: data.title.trim(),
        kind: data.kind,
        dueAt: data.dueAt || '',
        notes: data.notes.trim(),
      };
      if (!payload.title) { toast('Dê um título à etapa.'); return false; }
      if (step) { updateStep(appId, step.id, payload); toast('Etapa atualizada'); }
      else { addStep(appId, payload); toast('Etapa adicionada'); }
    },
  });
}

export async function confirmDeleteStep(appId, stepId) {
  const step = getApplication(appId)?.steps.find(s => s.id === stepId);
  if (!step) return;
  if (await confirmAction(`Excluir a etapa “${step.title}”?`, { confirmLabel: 'Excluir' })) {
    deleteStep(appId, stepId);
    toast('Etapa excluída');
  }
}

/* ---------- guideline ---------- */
export function openGuidelineModal(id = '', preset = {}) {
  const guide = id ? getGuideline(id) : null;
  openModal({
    title: guide ? 'Editar guideline' : 'Nova guideline',
    subtitle: 'Material de estudo por empresa ou projeto',
    wide: true,
    body: `
      ${field('Título', 'title', guide?.title || preset.title || '', { required: true, placeholder: 'Ex.: Guia de avaliação — CrowdGen' })}
      <div class="grid-2">
        ${select('Candidatura relacionada', 'appId', appOptions(guide?.appId || ''))}
        ${field('Idioma do original', 'language', guide?.language || 'en', { placeholder: 'en, es, pt…' })}
      </div>
      ${field('Fonte', 'sourceUrl', guide?.sourceUrl || '', { placeholder: 'https://…' })}
      ${textarea('Conteúdo (Markdown)', 'body', guide?.body || '', { rows: 12, placeholder: 'Cole aqui as orientações da empresa…' })}
    `,
    onSubmit(data) {
      const payload = {
        title: data.title.trim(),
        appId: data.appId,
        language: data.language.trim(),
        sourceUrl: data.sourceUrl.trim(),
        body: data.body,
      };
      if (!payload.title) { toast('Dê um título à guideline.'); return false; }
      if (guide) { updateGuideline(guide.id, payload); toast('Guideline atualizada'); }
      else { createGuideline(payload); toast('Guideline criada'); }
    },
  });
}

export async function confirmDeleteGuideline(id) {
  const guide = getGuideline(id);
  if (!guide) return;
  if (await confirmAction(`Excluir a guideline “${guide.title}”?`, { confirmLabel: 'Excluir' })) {
    deleteGuideline(id);
    toast('Guideline excluída');
  }
}
