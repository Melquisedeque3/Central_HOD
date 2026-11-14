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
        appId: data.appId,
        notes: data.notes.trim(),
      };
      if (!payload.title) { toast('Dê um título à tarefa.'); return false; }
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
  openModal({
    title: app ? 'Editar candidatura' : 'Nova candidatura',
    wide: true,
    body: `
      <div class="grid-2">
        ${field('Empresa', 'company', app?.company || preset.company || '', { required: true, placeholder: 'Ex.: Welocalize' })}
        ${field('Função / projeto', 'role', app?.role || preset.role || '', { placeholder: 'Ex.: Language Tester PT-BR' })}
      </div>
      <div class="grid-2">
        ${select('Etapa', 'stage', STAGES.map(s => ({ value: s.id, label: s.name })), app?.stage || preset.stage || 'mapeada')}
        ${select('Prioridade', 'priority', PRIORITIES.map(p => ({ value: p.id, label: p.name })), app?.priority || 'importante')}
      </div>
      ${field('Próxima ação', 'nextAction', app?.nextAction || '', { placeholder: 'Ex.: Enviar e-mail de follow-up' })}
      <div class="grid-2">
        ${field('Prazo', 'deadline', toDateInput(app?.deadline || ''), { type: 'date' })}
        ${field('Data da candidatura', 'appliedAt', toDateInput(app?.appliedAt || ''), { type: 'date' })}
      </div>
      <div class="grid-2">
        ${field('Link', 'link', app?.link || '', { placeholder: 'https://…' })}
        ${field('Localidade', 'location', app?.location || '', { placeholder: 'Remoto / país' })}
      </div>
      ${field('Remuneração', 'compensation', app?.compensation || '', { placeholder: 'Ex.: US$ 12/h' })}
      ${textarea('Notas', 'notes', app?.notes || '', { rows: 4, placeholder: 'Requisitos, contatos, histórico…' })}
    `,
    onSubmit(data) {
      const payload = {
        company: data.company.trim(),
        role: data.role.trim(),
        stage: data.stage,
        priority: data.priority,
        nextAction: data.nextAction.trim(),
        deadline: data.deadline,
        appliedAt: data.appliedAt,
        link: data.link.trim(),
        location: data.location.trim(),
        compensation: data.compensation.trim(),
        notes: data.notes.trim(),
      };
      if (!payload.company) { toast('Informe a empresa.'); return false; }
      if (app) {
        const stageChanged = app.stage !== payload.stage;
        updateApplication(app.id, payload, stageChanged ? `Etapa alterada para ${STAGES.find(s => s.id === payload.stage)?.name}` : '');
        toast('Candidatura atualizada');
      } else {
        createApplication(payload);
        toast('Candidatura criada');
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
