import crypto from 'node:crypto';
import { validateRecord } from './validation.mjs';

const ACTIONS = new Set(['ADD_NOTE', 'UPDATE_STATUS', 'CREATE_TASK', 'UPDATE_PRIORITY', 'REGISTER_ANALYSIS', 'SCHEDULE_FOLLOWUP']);
const stage = new Set(['mapeada', 'aplicada', 'teste', 'entrevista', 'proposta', 'ativa', 'encerrada']);
const priority = new Set(['urgente', 'importante', 'normal', 'baixa']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const id = prefix => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const today = () => new Date().toISOString().slice(0, 10);

function safeApp(app) { return { id: app.id, company: app.company, role: app.role, stage: app.stage, priority: app.priority, deadline: app.deadline, nextAction: app.nextAction, updatedAt: app.updatedAt }; }
function safeTask(task) { return { id: task.id, title: task.title, status: task.status, priority: task.priority, dueAt: task.dueAt, appId: task.appId, appLabel: task.appLabel }; }

export async function buildWorkContext(vault, { period = 'daily' } = {}) {
  const state = await vault.state();
  const overdueTasks = state.tasks.filter(t => t.status !== 'done' && t.dueAt && t.dueAt.slice(0, 10) < today()).map(safeTask);
  const pendingApplications = state.applications.filter(a => !['encerrada', 'ativa'].includes(a.stage)).map(safeApp);
  const waitingResponse = state.applications.filter(a => a.stage === 'aplicada').map(safeApp);
  const priorityItems = [...state.tasks.filter(t => t.status !== 'done' && ['urgente', 'importante'].includes(t.priority)).map(safeTask), ...state.applications.filter(a => ['urgente', 'importante'].includes(a.priority)).map(safeApp)];
  const recentChanges = (await vault.audit.recent(period === 'weekly' ? 50 : 20)).map(e => ({ timestamp: e.timestamp, actor: e.actor, action: e.action, entity: e.entity, entity_id: e.entity_id, outcome: e.outcome }));
  return { pending_applications: pendingApplications, waiting_response: waitingResponse, overdue_tasks: overdueTasks, priority_items: priorityItems, recent_changes: recentChanges, alerts: overdueTasks.map(t => ({ type: 'OVERDUE_TASK', task_id: t.id, title: t.title })), summary: { period, applications: state.applications.length, open_tasks: state.tasks.filter(t => t.status !== 'done').length, overdue_tasks: overdueTasks.length, waiting_response: waitingResponse.length } };
}

export async function applyWorkAction(vault, input) {
  if (!input || typeof input !== 'object' || !ACTIONS.has(input.type)) throw fail('Ação Work não permitida.');
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const state = await vault.state();
  const app = appId => { const found = state.applications.find(item => item.id === appId); if (!found) throw fail('Candidatura não encontrada.', 404); return found; };
  if (input.type === 'ADD_NOTE') {
    const current = app(payload.applicationId); if (typeof payload.note !== 'string' || !payload.note.trim() || payload.note.length > 12000) throw fail('Nota inválida.');
    const next = { ...current, notes: [current.notes, payload.note.trim()].filter(Boolean).join('\n\n'), history: [{ at: new Date().toISOString(), text: 'Nota adicionada pelo Work' }, ...(current.history || [])], updatedAt: new Date().toISOString() };
    validateRecord('application', next); return { action: input.type, result: await vault.put('application', next, { actor: 'WORK', origin: 'work' }) };
  }
  if (input.type === 'UPDATE_STATUS') {
    const current = app(payload.applicationId); if (!stage.has(payload.status)) throw fail('Status inválido.');
    const next = { ...current, stage: payload.status, history: [{ at: new Date().toISOString(), text: `Status atualizado pelo Work: ${payload.status}` }, ...(current.history || [])], updatedAt: new Date().toISOString() };
    validateRecord('application', next); return { action: input.type, result: await vault.put('application', next, { actor: 'WORK', origin: 'work' }) };
  }
  if (input.type === 'CREATE_TASK' || input.type === 'SCHEDULE_FOLLOWUP') {
    const applicationId = payload.applicationId || ''; const related = applicationId ? app(applicationId) : null;
    const title = input.type === 'SCHEDULE_FOLLOWUP' ? (payload.title || `Follow-up: ${related?.company || ''}`) : payload.title;
    if (state.tasks.some(t => t.status !== 'done' && t.appId === applicationId && t.title === title)) throw fail('Tarefa equivalente já está aberta.', 409);
    const task = { id: id('task'), title, notes: String(payload.notes || ''), status: 'todo', priority: payload.priority || 'normal', dueAt: payload.dueAt || '', appId: applicationId, appLabel: related ? `${related.company}${related.role ? ' — ' + related.role : ''}` : '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    validateRecord('task', task); return { action: input.type, result: await vault.put('task', task, { actor: 'WORK', origin: 'work' }) };
  }
  if (input.type === 'UPDATE_PRIORITY') {
    if (!priority.has(payload.priority) || !['application', 'task'].includes(payload.entity)) throw fail('Atualização de prioridade inválida.');
    const collection = payload.entity === 'application' ? state.applications : state.tasks; const current = collection.find(item => item.id === payload.id); if (!current) throw fail('Entidade não encontrada.', 404);
    const next = { ...current, priority: payload.priority, updatedAt: new Date().toISOString() }; validateRecord(payload.entity, next);
    return { action: input.type, result: await vault.put(payload.entity, next, { actor: 'WORK', origin: 'work' }) };
  }
  if (input.type === 'REGISTER_ANALYSIS') {
    if (typeof payload.title !== 'string' || typeof payload.content !== 'string') throw fail('Análise inválida.');
    return { action: input.type, result: await vault.writeWorkDocument('Insights', { title: payload.title, content: payload.content, relatedId: String(payload.applicationId || '') }, { actor: 'WORK', origin: 'work' }) };
  }
  throw fail('Ação Work não implementada.');
}
