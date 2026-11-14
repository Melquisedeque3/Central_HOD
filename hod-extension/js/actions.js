/* ============================================================
   actions.js — despacho central de data-action
   Presets são propagados: abrir "nova tarefa" dentro de uma coluna
   de prioridade já cria a tarefa naquela prioridade.
   ============================================================ */
import { getState, updateStep, updateTask, updateApplication, toggleTask, moveApplication } from './store.js';
import {
  openTaskModal, confirmDeleteTask, openAppModal, confirmDeleteApp,
  openStepModal, confirmDeleteStep, openGuidelineModal, confirmDeleteGuideline,
} from './views/modals.js';

export function dispatch(action, ds = {}, el = null) {
  const handler = HANDLERS[action];
  if (!handler) {
    // Vários botões têm listener próprio na view (modais, filtros, rotina).
    // O documento só precisa ignorá-los em silêncio; o aviso fica para
    // ações que ninguém tratou de fato.
    if (!LOCAL_ACTIONS.has(action)) console.warn('Ação sem tratador:', action);
    return;
  }
  handler(ds, el);
}

/* ações resolvidas por listeners dentro das views, não pelo despacho global */
const LOCAL_ACTIONS = new Set([
  'new-slot', 'edit-slot', 'del-slot', 'reset-routine',
  'clear-apps-filter', 'clear-email-filter', 'email-help',
]);

const HANDLERS = {
  'open-app': ({ id }) => { location.hash = `#/apps/${id}`; },
  'edit-app': ({ id }) => openAppModal(id),
  'new-app': ({ company }) => openAppModal('', { company: company || '' }),
  'del-app': ({ id }) => confirmDeleteApp(id),

  'new-task': ({ app, priority, dueAt }) => openTaskModal('', {
    appId: app || '',
    priority: priority || '',
    dueAt: dueAt || '',
  }),
  'edit-task': ({ id }) => openTaskModal(id),
  'del-task': ({ id }) => confirmDeleteTask(id),
  'toggle-task': ({ id }) => toggleTask(id),

  'add-step': ({ app }) => openStepModal(app),
  'edit-step': ({ app, id }) => openStepModal(app, id),
  'del-step': ({ app, id }) => confirmDeleteStep(app, id),
  'toggle-step': ({ app, id }) => {
    const step = getState().applications.find(a => a.id === app)?.steps.find(s => s.id === id);
    if (step) updateStep(app, id, { status: step.status === 'done' ? 'todo' : 'done' });
  },

  'new-guide': ({ app }) => openGuidelineModal('', { appId: app || '' }),
  'edit-guide': ({ id }) => openGuidelineModal(id),
  'del-guide': ({ id }) => confirmDeleteGuideline(id),

  'set-stage': ({ id, stage }) => {
    updateApplication(id, { stage }, `Etapa alterada para ${stage}`);
  },
  'move-stage': ({ id, stage }) => moveApplication(id, stage),

  'task-doing': ({ id }) => updateTask(id, { status: 'doing' }),
  'task-done': ({ id }) => updateTask(id, { status: 'done' }),
  'task-todo': ({ id }) => updateTask(id, { status: 'todo' }),
};
