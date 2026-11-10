/* ============================================================
   store.js — modelo de dados, persistência e migração
   Fonte única de verdade. Chrome storage como principal,
   localStorage como espelho (e fallback fora da extensão).
   ============================================================ */

export const STORAGE_KEY = 'hod:state';
export const SCHEMA_VERSION = 3;
const LEGACY_KEY = 'hodControleV2';

export const STAGES = [
  { id: 'mapeada', name: 'Mapeada', short: 'Mapeada', color: '#7ecbdb' },
  { id: 'aplicada', name: 'Candidatura enviada', short: 'Enviada', color: '#38bdf8' },
  { id: 'teste', name: 'Teste / Prova', short: 'Teste', color: '#f4c77a' },
  { id: 'entrevista', name: 'Entrevista', short: 'Entrevista', color: '#b8a4f4' },
  { id: 'proposta', name: 'Proposta', short: 'Proposta', color: '#7ec8a4' },
  { id: 'ativa', name: 'Ativa', short: 'Ativa', color: '#56d98f' },
  { id: 'encerrada', name: 'Encerrada', short: 'Encerrada', color: '#5c6b82' },
];

export const PRIORITIES = [
  { id: 'urgente', name: 'Urgente', color: '#ef8c8c', weight: 0 },
  { id: 'importante', name: 'Importante', color: '#f4c77a', weight: 1 },
  { id: 'normal', name: 'Normal', color: '#7ecbdb', weight: 2 },
  { id: 'baixa', name: 'Pode esperar', color: '#8aacb1', weight: 3 },
];

export const STEP_KINDS = [
  'Candidatura', 'Certificação', 'Prova / Teste', 'Entrevista',
  'Documento', 'Follow-up', 'Onboarding', 'Outro',
];

export const TASK_STATUS = [
  { id: 'todo', name: 'A fazer' },
  { id: 'doing', name: 'Fazendo' },
  { id: 'done', name: 'Concluído' },
];

const STAGE_ALIASES = {
  'Candidatura': 'aplicada',
  'Teste / qualificação': 'teste',
  'Aguardando resposta': 'aplicada',
  'Aprovado / onboarding': 'proposta',
  'Ativo': 'ativa',
  'Pausado / sem tarefas': 'mapeada',
  'Encerrado': 'encerrada',
};

const PRIORITY_ALIASES = {
  'Urgente': 'urgente',
  'Importante': 'importante',
  'Pode esperar': 'baixa',
  '—': 'normal',
};

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO() { return new Date().toISOString(); }

export function stageById(id) {
  return STAGES.find(s => s.id === id) || STAGES[0];
}
export function priorityById(id) {
  return PRIORITIES.find(p => p.id === id) || PRIORITIES[2];
}

/* ---------- estado vazio ---------- */
function emptyState() {
  return {
    version: SCHEMA_VERSION,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    applications: [],
    tasks: [],
    guidelines: [],
    settings: {
      obsidian: { enabled: false, url: 'http://127.0.0.1:27123', key: '', folder: 'HOD' },
      ai: { provider: '', model: '', apiKey: '' },
      ui: { density: 'comfortable' },
    },
    legacy: null,
  };
}

/* ---------- migração da v1 ---------- */
function migrateLegacy(old) {
  const state = emptyState();
  state.legacy = { importedAt: nowISO(), sourceKey: LEGACY_KEY };

  const mapTask = (t, extra = {}) => ({
    id: uid('task'),
    title: t.acao || t.title || t.atividade || 'Tarefa importada',
    notes: [t.empresa, t.oque].filter(Boolean).join(' — '),
    status: t.status === 'Concluído' ? 'done' : t.status === 'Fazendo' ? 'doing' : 'todo',
    priority: PRIORITY_ALIASES[t.prioridade] || 'normal',
    dueAt: t.quando || '',
    appId: '',
    createdAt: nowISO(),
    completedAt: t.status === 'Concluído' ? nowISO() : '',
    ...extra,
  });

  const appIdByCompany = {};
  (old.projects || []).forEach(p => {
    const id = uid('app');
    appIdByCompany[p.empresa] = id;
    state.applications.push({
      id,
      company: p.empresa || 'Sem empresa',
      role: p.projeto || 'Sem projeto',
      stage: STAGE_ALIASES[p.etapa] || 'mapeada',
      priority: PRIORITY_ALIASES[p.prioridade] || 'normal',
      nextAction: p.acao || '',
      deadline: p.prazo || '',
      appliedAt: '',
      link: p.obs || '',
      location: '',
      compensation: '',
      tags: [],
      notes: p.historico || '',
      steps: [],
      history: [{ at: nowISO(), text: `Importado da v1 na etapa “${p.etapa || '—'}”` }],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  });

  (old.tasks || []).forEach(t => {
    state.tasks.push(mapTask(t, { appId: appIdByCompany[t.empresa] || '' }));
  });

  (old.routine || []).forEach(r => {
    state.tasks.push(mapTask(r, { notes: `Rotina ${r.freq || ''} — ${r.oque || ''}`.trim() }));
  });

  (old.events || []).forEach(e => {
    state.tasks.push(mapTask(e, {
      title: `${e.dia}: ${e.evento}`.replace(/: —$/, ''),
      notes: [e.ref, e.acao].filter(Boolean).join(' — '),
    }));
  });

  return state;
}

/* ---------- normalização ---------- */
function normalize(state) {
  const base = emptyState();
  const s = { ...base, ...state };
  s.version = SCHEMA_VERSION;
  s.applications = Array.isArray(s.applications) ? s.applications.filter(Boolean) : [];
  s.tasks = Array.isArray(s.tasks) ? s.tasks.filter(Boolean) : [];
  s.guidelines = Array.isArray(s.guidelines) ? s.guidelines.filter(Boolean) : [];
  s.settings = {
    ...base.settings,
    ...(state.settings || {}),
    obsidian: { ...base.settings.obsidian, ...(state.settings?.obsidian || {}) },
    ai: { ...base.settings.ai, ...(state.settings?.ai || {}) },
    ui: { ...base.settings.ui, ...(state.settings?.ui || {}) },
  };
  s.applications = s.applications.map(a => ({
    steps: [], history: [], tags: [], ...a,
    id: a.id || uid('app'),
    steps: Array.isArray(a.steps) ? a.steps.filter(Boolean) : [],
    history: Array.isArray(a.history) ? a.history.filter(Boolean) : [],
    tags: Array.isArray(a.tags) ? a.tags : [],
  }));
  s.tasks = s.tasks.map(t => ({ appId: '', notes: '', dueAt: '', ...t, id: t.id || uid('task') }));
  s.guidelines = s.guidelines.map(g => ({ appId: '', body: '', translation: '', ...g, id: g.id || uid('guide') }));
  return s;
}

/* ---------- armazenamento ---------- */
const hasChrome = () => typeof chrome !== 'undefined' && !!chrome?.storage?.local;

async function readRaw() {
  if (hasChrome()) {
    try {
      const got = await chrome.storage.local.get(STORAGE_KEY);
      if (got && got[STORAGE_KEY]) return got[STORAGE_KEY];
    } catch (e) { console.warn('chrome.storage.local falhou:', e); }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('localStorage falhou:', e); }
  return null;
}

async function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let state = emptyState();
let saveTimer = null;
const listeners = new Set();

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

export async function load() {
  const stored = await readRaw();
  if (stored) {
    state = normalize(stored);
  } else {
    const legacy = await readLegacy();
    state = legacy && (legacy.tasks || legacy.projects) ? migrateLegacy(legacy) : emptyState();
    if (legacy) scheduleSave(0);
  }
  emit();
  return state;
}

export function setState(next) {
  state = normalize(next);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

export function update(mutator) {
  const result = mutator(state);
  if (result === false) return false;
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
  return true;
}

function scheduleSave(delay = 200) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, delay);
}

export async function flush() {
  clearTimeout(saveTimer);
  const snapshot = state;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (e) { console.warn(e); }
  if (hasChrome()) {
    try { await chrome.storage.local.set({ [STORAGE_KEY]: snapshot }); } catch (e) { console.warn(e); }
  }
}

/* ---------- CRUD: candidaturas ---------- */
export function createApplication(data = {}) {
  const app = {
    id: uid('app'),
    company: '',
    role: '',
    stage: 'mapeada',
    priority: 'importante',
    nextAction: '',
    deadline: '',
    appliedAt: '',
    link: '',
    location: 'Remoto',
    compensation: '',
    tags: [],
    notes: '',
    steps: [],
    history: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...data,
  };
  state.applications.unshift(app);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
  return app;
}

export function getApplication(id) {
  return state.applications.find(a => a.id === id) || null;
}

export function updateApplication(id, patch, historyText = '') {
  const app = getApplication(id);
  if (!app) return null;
  Object.assign(app, patch, { updatedAt: nowISO() });
  if (historyText) app.history.unshift({ at: nowISO(), text: historyText });
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
  return app;
}

export function moveApplication(id, stageId) {
  const app = getApplication(id);
  if (!app || app.stage === stageId) return;
  const from = stageById(app.stage).name;
  const to = stageById(stageId).name;
  app.stage = stageId;
  app.updatedAt = nowISO();
  app.history.unshift({ at: nowISO(), text: `Etapa: ${from} → ${to}` });
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

export function deleteApplication(id) {
  state.applications = state.applications.filter(a => a.id !== id);
  state.tasks = state.tasks.filter(t => t.appId !== id);
  state.guidelines = state.guidelines.filter(g => g.appId !== id);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

/* ---------- CRUD: etapas do processo ---------- */
export function addStep(appId, data = {}) {
  const app = getApplication(appId);
  if (!app) return null;
  const step = {
    id: uid('step'),
    title: '',
    kind: 'Prova / Teste',
    status: 'todo',
    dueAt: '',
    notes: '',
    createdAt: nowISO(),
    ...data,
  };
  app.steps.push(step);
  app.history.unshift({ at: nowISO(), text: `Etapa adicionada: ${step.title}` });
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
  return step;
}

export function updateStep(appId, stepId, patch) {
  const app = getApplication(appId);
  const step = app?.steps.find(s => s.id === stepId);
  if (!step) return;
  const wasDone = step.status === 'done';
  Object.assign(step, patch, { updatedAt: nowISO() });
  if (!wasDone && step.status === 'done') {
    app.history.unshift({ at: nowISO(), text: `Concluído: ${step.title}` });
  }
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

export function deleteStep(appId, stepId) {
  const app = getApplication(appId);
  if (!app) return;
  app.steps = app.steps.filter(s => s.id !== stepId);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

/* ---------- CRUD: tarefas ---------- */
export function createTask(data = {}) {
  const task = {
    id: uid('task'),
    title: '',
    notes: '',
    status: 'todo',
    priority: 'normal',
    dueAt: '',
    appId: '',
    createdAt: nowISO(),
    completedAt: '',
    ...data,
  };
  state.tasks.unshift(task);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
  return task;
}

export function getTask(id) { return state.tasks.find(t => t.id === id) || null; }

export function updateTask(id, patch) {
  const task = getTask(id);
  if (!task) return;
  Object.assign(task, patch);
  if (patch.status === 'done' && !task.completedAt) task.completedAt = nowISO();
  if (patch.status && patch.status !== 'done') task.completedAt = '';
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

export function toggleTask(id) {
  const task = getTask(id);
  if (!task) return;
  updateTask(id, { status: task.status === 'done' ? 'todo' : 'done' });
}

export function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

/* ---------- CRUD: guidelines ---------- */
export function createGuideline(data = {}) {
  const g = {
    id: uid('guide'),
    title: '',
    appId: '',
    sourceUrl: '',
    language: 'en',
    body: '',
    translation: '',
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...data,
  };
  state.guidelines.unshift(g);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
  return g;
}

export function getGuideline(id) { return state.guidelines.find(g => g.id === id) || null; }

export function updateGuideline(id, patch) {
  const g = getGuideline(id);
  if (!g) return;
  Object.assign(g, patch, { updatedAt: nowISO() });
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

export function deleteGuideline(id) {
  state.guidelines = state.guidelines.filter(g => g.id !== id);
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

/* ---------- utilidades ---------- */
export function updateSettings(section, patch) {
  state.settings[section] = { ...state.settings[section], ...patch };
  state.updatedAt = nowISO();
  scheduleSave();
  emit();
}

export async function exportJSON() {
  await flush();
  return JSON.stringify({ ...state, exportedAt: nowISO() }, null, 2);
}

export async function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || (!parsed.applications && !parsed.tasks)) {
    throw new Error('Arquivo não parece ser um backup do HOD.');
  }
  setState(parsed);
  await flush();
}

export async function resetAll() {
  state = emptyState();
  await flush();
  emit();
}

export function stats() {
  const open = state.tasks.filter(t => t.status !== 'done');
  const activeApps = state.applications.filter(a => !['encerrada'].includes(a.stage));
  const pendingSteps = state.applications.flatMap(a => a.steps).filter(s => s.status !== 'done');
  return {
    apps: state.applications.length,
    activeApps: activeApps.length,
    openTasks: open.length,
    overdueTasks: open.filter(t => t.dueAt && new Date(t.dueAt) < new Date()).length,
    pendingSteps: pendingSteps.length,
    guidelines: state.guidelines.length,
  };
}
