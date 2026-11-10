/* ============================================================
   actions.js — despacho central de data-action
   ============================================================ */
import { getState, updateStep, updateTask, updateApplication, toggleTask } from './store.js';
import {
  openTaskModal, confirmDeleteTask, openAppModal, confirmDeleteApp,
  openStepModal, confirmDeleteStep, openGuidelineModal, confirmDeleteGuideline,
} from './views/modals.js';

export function dispatch(action, ds = {}, el = null) {
  const handler = HANDLERS[action];
  if (!handler) { console.warn('Ação desconhecida:', action); return; }
  handler(ds, el);
}

const HANDLERS = {
  'open-app': ({ id }) => { location.hash = `#/apps/${id}`; },
  'edit-app': ({ id }) => openAppModal(id),
  'new-app': () => openAppModal(),
  'del-app': ({ id }) => confirmDeleteApp(id),

  'new-task': ({ app }) => openTaskModal('', { appId: app || '' }),
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

  'new-guide': () => openGuidelineModal(),
  'edit-guide': ({ id }) => openGuidelineModal(id),
  'del-guide': ({ id }) => confirmDeleteGuideline(id),

  'set-stage': ({ id, stage }) => {
    updateApplication(id, { stage }, `Etapa alterada para ${stage}`);
  },

  'task-doing': ({ id }) => updateTask(id, { status: 'doing' }),
  'task-done': ({ id }) => updateTask(id, { status: 'done' }),
  'task-todo': ({ id }) => updateTask(id, { status: 'todo' }),
};
