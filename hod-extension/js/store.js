/* ============================================================
   store.js — modelo de dados do HOD

   Arquitetura (v4):
     • Obsidian/vault é a FONTE DE VERDADE — cada registro é uma nota
       .md com frontmatter YAML.
     • Este módulo mantém um espelho em memória (estado derivado) para
       a interface ler de forma síncrona.
     • Toda escrita vai para o servidor local (server.mjs), que faz
       escrita atômica no vault.
     • Sem servidor, cai em modo local: localStorage é a fonte de verdade.

   Contrato de concorrência:
     • ids estáveis por registro (nunca reaproveitados)
     • escrita serializada (fila) — sem corrida entre usuário e agente
     • exclusão gera tombstone no servidor (o agente não ressuscita a nota)
   ============================================================ */
import * as api from './api.js';

export const STORAGE_KEY = 'hod:state';
export const LOCAL_KEY = 'hod:state:v4';
export const SCHEMA_VERSION = 4;
const LEGACY_KEY = 'hodControleV2';
const MIGRATED_FLAG = 'hod:vault-migrated';

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

export const DEFAULT_ROUTINE = [
  { id: 'rot_1', start: '07:00', end: '08:30', label: 'Foco Total / Tarefas Críticas' },
  { id: 'rot_2', start: '08:30', end: '09:00', label: 'Revisão de E-mails & Comunicação' },
  { id: 'rot_3', start: '09:00', end: '11:00', label: 'Estudo de Guidelines & Preparação' },
  { id: 'rot_4', start: '11:00', end: '12:00', label: 'Avanço em Candidaturas' },
  { id: 'rot_5', start: '13:30', end: '15:30', label: 'Execução de Testes / Entrevistas' },
  { id: 'rot_6', start: '15:30', end: '17:00', label: 'Follow-ups & Fechamento do Dia' },
];

const STAGE_ALIASES = {
  Candidatura: 'aplicada',
  'Teste / qualificação': 'teste',
  'Aguardando resposta': 'aplicada',
  'Aprovado / onboarding': 'proposta',
  Ativo: 'ativa',
  'Pausado / sem tarefas': 'mapeada',
  Encerrado: 'encerrada',
};

const PRIORITY_ALIASES = {
  Urgente: 'urgente',
  Importante: 'importante',
  'Pode esperar': 'baixa',
  '—': 'normal',
};

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO() { return new Date().toISOString(); }

export function stageById(id) { return STAGES.find(s => s.id === id) || STAGES[0]; }
export function priorityById(id) { return PRIORITIES.find(p => p.id === id) || PRIORITIES[2]; }

/* ---------- estado ---------- */
function emptyState() {
  return {
    version: SCHEMA_VERSION,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    applications: [],
    tasks: [],
    guidelines: [],
    routine: DEFAULT_ROUTINE.map(s => ({ ...s })),
    emails: [],
    calendarEvents: [],
    driveFiles: [],
    connections: null,
    vault: null,
    sync: { mode: 'local', pending: 0, lastError: '' },
    settings: {
      ui: { density: 'comfortable' },
    },
    legacy: null,
  };
}

let state = emptyState();
const listeners = new Set();
let booted = false;

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error('[HOD] listener falhou:', err); }
  }
}

/* ---------- normalização ---------- */
function normalize(raw) {
  const base = emptyState();
  const s = { ...base, ...(raw || {}) };

  s.version = SCHEMA_VERSION;
  s.applications = Array.isArray(s.applications) ? s.applications.filter(Boolean).map(normalizeApp) : [];
  s.tasks = Array.isArray(s.tasks) ? s.tasks.filter(Boolean).map(normalizeTask) : [];
  s.guidelines = Array.isArray(s.guidelines) ? s.guidelines.filter(Boolean).map(normalizeGuide) : [];
  s.routine = Array.isArray(s.routine) && s.routine.length
    ? s.routine.filter(Boolean).map(normalizeSlot).sort((a, b) => a.start.localeCompare(b.start))
    : DEFAULT_ROUTINE.map(x => ({ ...x }));
  s.emails = Array.isArray(s.emails) ? s.emails.filter(Boolean) : [];
  s.calendarEvents = Array.isArray(s.calendarEvents) ? s.calendarEvents.filter(Boolean) : [];
  s.driveFiles = Array.isArray(s.driveFiles) ? s.driveFiles.filter(Boolean) : [];
  s.settings = { ...base.settings, ...(s.settings || {}) };
  s.sync = { ...base.sync, ...(s.sync || {}) };
  return s;
}

function normalizeApp(a) {
  return {
    id: a.id || uid('app'),
    company: a.company || 'Sem empresa',
    role: a.role || '',
    stage: STAGES.some(s => s.id === a.stage) ? a.stage : 'mapeada',
    priority: PRIORITIES.some(p => p.id === a.priority) ? a.priority : 'normal',
    nextAction: a.nextAction || '',
    deadline: a.deadline || '',
    appliedAt: a.appliedAt || '',
    link: a.link || '',
    location: a.location || '',
    compensation: a.compensation || '',
    tags: Array.isArray(a.tags) ? a.tags : [],
    notes: a.notes || '',
    steps: Array.isArray(a.steps) ? a.steps.filter(Boolean).map(s => ({
      id: s.id || uid('step'),
      title: s.title || '',
      kind: s.kind || 'Outro',
      status: s.status === 'done' ? 'done' : 'todo',
      dueAt: s.dueAt || '',
      notes: s.notes || '',
      createdAt: s.createdAt || nowISO(),
    })) : [],
    history: Array.isArray(a.history) ? a.history.filter(Boolean) : [],
    taskRefs: Array.isArray(a.taskRefs) ? a.taskRefs : [],
    createdAt: a.createdAt || nowISO(),
    updatedAt: a.updatedAt || nowISO(),
  };
}

function normalizeTask(t) {
  return {
    id: t.id || uid('task'),
    title: t.title || '',
    notes: t.notes || '',
    status: ['todo', 'doing', 'done'].includes(t.status) ? t.status : 'todo',
    priority: PRIORITIES.some(p => p.id === t.priority) ? t.priority : 'normal',
    dueAt: t.dueAt || '',
    appId: t.appId || '',
    appLabel: t.appLabel || '',
    createdAt: t.createdAt || nowISO(),
    completedAt: t.completedAt || '',
  };
}

function normalizeGuide(g) {
  return {
    id: g.id || uid('guide'),
    title: g.title || '',
    appId: g.appId || '',
    sourceUrl: g.sourceUrl || '',
    language: g.language || 'pt',
    body: g.body || '',
    translation: g.translation || '',
    createdAt: g.createdAt || nowISO(),
    updatedAt: g.updatedAt || nowISO(),
  };
}

function normalizeSlot(s) {
  return {
    id: s.id || uid('rot'),
    start: s.start || '08:00',
    end: s.end || '09:00',
    label: s.label || 'Bloco',
    notes: s.notes || '',
  };
}

/* ============================================================
   fila de escrita — serializa tudo, evita corrida
   ============================================================ */
let chain = Promise.resolve();
let pending = 0;

function enqueue(task) {
  pending++;
  state.sync = { ...state.sync, pending };
  chain = chain
    .then(task)
    .then(() => { pending = Math.max(0, pending - 1); state.sync.pending = pending; state.sync.lastError = ''; })
    .catch(err => {
      pending = Math.max(0, pending - 1);
      state.sync.pending = pending;
      state.sync.lastError = err.message || String(err);
      console.error('[HOD] falha ao gravar:', err);
      emit();
    })
    .finally(() => { if (pending === 0) emit(); });
  return chain;
}

const isVault = () => state.sync.mode === 'vault';

/* ---------- espelho local (sempre mantido) ---------- */
let mirrorTimer = null;

function scheduleMirror(delay = 250) {
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(writeMirror, delay);
}

function writeMirror() {
  clearTimeout(mirrorTimer);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[HOD] não foi possível gravar o espelho local:', err);
  }
}

export function flush() {
  writeMirror();
  return chain;
}

/* ---------- persistência ---------- */
function persistRecord(type, record) {
  scheduleMirror();
  if (!isVault()) return Promise.resolve();
  return api.putRecord(type, record).catch(err => {
    throw new Error(`Vault: ${err.message}`);
  });
}

function persistDelete(type, id) {
  scheduleMirror();
  if (!isVault()) return Promise.resolve();
  return api.deleteRecord(type, id).catch(err => {
    throw new Error(`Vault: ${err.message}`);
  });
}

/* ============================================================
   boot / migração
   ============================================================ */
export async function load() {
  if (booted) return state;
  booted = true;

  const info = await api.detectServer();

  if (info.mode === 'vault') {
    state.sync.mode = 'vault';
    try {
      const remote = await api.fetchState();
      state = normalize(remote);
      state.sync.mode = 'vault';
      state.connections = remote.connections || null;
      state.vault = remote.vault || null;
      await migrateLocalIntoVault();
    } catch (err) {
      console.warn('[HOD] servidor respondeu com erro, caindo para modo local:', err);
      state = normalize(readLocalMirror() || emptyState());
      state.sync.mode = 'local';
      state.sync.lastError = err.message;
    }
  } else {
    state = normalize(readLocalMirror() || await readLegacyOrMigration());
    state.sync.mode = 'local';
  }

  emit();
  scheduleMirror(0);
  return state;
}

function readLocalMirror() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

async function readLegacyOrMigration() {
  let legacy = null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    legacy = raw ? JSON.parse(raw) : null;
  } catch { legacy = null; }
  if (legacy && (legacy.tasks || legacy.projects)) return migrateLegacy(legacy);
  return emptyState();
}

/**
 * Primeira execução em modo vault: se o vault está vazio e existe
 * estado anterior em localStorage, empurra tudo como notas.
 */
async function migrateLocalIntoVault() {
  if (localStorage.getItem(MIGRATED_FLAG) === '1') return;
  const empty = !state.applications.length && !state.tasks.length && !state.guidelines.length;
  if (!empty) { localStorage.setItem(MIGRATED_FLAG, '1'); return; }

  const backup = readLocalMirror();
  if (!backup || (!backup.applications?.length && !backup.tasks?.length && !backup.guidelines?.length)) {
    localStorage.setItem(MIGRATED_FLAG, '1');
    return;
  }

  console.info('[HOD] migrando estado local para o vault…');
  const old = normalize(backup);
  state.applications = old.applications;
  state.tasks = old.tasks;
  state.guidelines = old.guidelines;
  state.routine = old.routine;
  emit();

  for (const a of old.applications) await persistRecord('application', a);
  for (const t of old.tasks) await persistRecord('task', t);
  for (const g of old.guidelines) await persistRecord('guideline', g);
  for (const r of old.routine) await persistRecord('routine', r);

  if (old.emails.length || old.calendarEvents.length || old.driveFiles.length) {
    await api.putBag({
      emails: old.emails,
      calendarEvents: old.calendarEvents,
      driveFiles: old.driveFiles,
    }).catch(() => {});
  }

  localStorage.setItem(MIGRATED_FLAG, '1');
  console.info('[HOD] migração concluída.');
}

/* ---------- recarregar do vault (após edição externa) ---------- */
export async function reload() {
  if (!isVault()) return state;
  const remote = await api.fetchState();
  state = normalize(remote);
  state.sync.mode = 'vault';
  state.connections = remote.connections || state.connections;
  state.vault = remote.vault || null;
  emit();
  return state;
}

/* ============================================================
   CRUD — candidaturas
   ============================================================ */
export function createApplication(data = {}) {
  const app = normalizeApp({
    id: uid('app'),
    stage: 'mapeada',
    priority: 'importante',
    location: 'Remoto',
    ...data,
  });
  app.createdAt = nowISO();
  app.updatedAt = nowISO();
  state.applications.unshift(app);
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('application', app));
  emit();
  return app;
}

export function getApplication(id) { return state.applications.find(a => a.id === id) || null; }
export const appById = getApplication;

export function updateApplication(id, patch, historyText = '') {
  const app = getApplication(id);
  if (!app) return null;
  Object.assign(app, patch, { updatedAt: nowISO() });
  if (historyText) app.history.unshift({ at: nowISO(), text: historyText });
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('application', app));
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
  enqueue(() => persistRecord('application', app));
  emit();
}

export function deleteApplication(id) {
  state.applications = state.applications.filter(a => a.id !== id);
  const removedTasks = state.tasks.filter(t => t.appId === id);
  const removedGuides = state.guidelines.filter(g => g.appId === id);
  state.tasks = state.tasks.filter(t => t.appId !== id);
  state.guidelines = state.guidelines.filter(g => g.appId !== id);
  state.updatedAt = nowISO();
  enqueue(async () => {
    await persistDelete('application', id);
    for (const t of removedTasks) await persistDelete('task', t.id);
    for (const g of removedGuides) await persistDelete('guideline', g.id);
  });
  emit();
}

/* ---------- etapas ---------- */
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
  app.updatedAt = nowISO();
  app.history.unshift({ at: nowISO(), text: `Etapa adicionada: ${step.title}` });
  enqueue(() => persistRecord('application', app));
  emit();
  return step;
}

export function updateStep(appId, stepId, patch) {
  const app = getApplication(appId);
  const step = app?.steps.find(s => s.id === stepId);
  if (!step) return;
  const wasDone = step.status === 'done';
  Object.assign(step, patch);
  if (!wasDone && step.status === 'done') {
    app.history.unshift({ at: nowISO(), text: `Concluído: ${step.title}` });
  }
  app.updatedAt = nowISO();
  enqueue(() => persistRecord('application', app));
  emit();
}

export function deleteStep(appId, stepId) {
  const app = getApplication(appId);
  if (!app) return;
  app.steps = app.steps.filter(s => s.id !== stepId);
  app.updatedAt = nowISO();
  enqueue(() => persistRecord('application', app));
  emit();
}

/* ---------- tarefas ---------- */
export function createTask(data = {}) {
  const appId = data.appId || '';
  const linked = appId ? getApplication(appId) : null;
  const task = normalizeTask({
    id: uid('task'),
    status: 'todo',
    priority: 'normal',
    ...data,
    appLabel: linked ? `${linked.company}${linked.role ? ' — ' + linked.role : ''}` : '',
  });
  task.createdAt = nowISO();
  state.tasks.unshift(task);
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('task', task));
  emit();
  return task;
}
export const addTask = createTask;

export function getTask(id) { return state.tasks.find(t => t.id === id) || null; }

export function updateTask(id, patch) {
  const task = getTask(id);
  if (!task) return;
  Object.assign(task, patch);
  if (patch.appId !== undefined) {
    const linked = patch.appId ? getApplication(patch.appId) : null;
    task.appLabel = linked ? `${linked.company}${linked.role ? ' — ' + linked.role : ''}` : '';
  }
  if (patch.status === 'done' && !task.completedAt) task.completedAt = nowISO();
  if (patch.status && patch.status !== 'done') task.completedAt = '';
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('task', task));
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
  enqueue(() => persistDelete('task', id));
  emit();
}

/* ---------- guidelines ---------- */
export function createGuideline(data = {}) {
  const g = normalizeGuide({
    id: uid('guide'),
    language: 'pt',
    ...data,
  });
  g.createdAt = nowISO();
  g.updatedAt = nowISO();
  state.guidelines.unshift(g);
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('guideline', g));
  emit();
  return g;
}

export function getGuideline(id) { return state.guidelines.find(g => g.id === id) || null; }

export function updateGuideline(id, patch) {
  const g = getGuideline(id);
  if (!g) return;
  Object.assign(g, patch, { updatedAt: nowISO() });
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('guideline', g));
  emit();
}

export function deleteGuideline(id) {
  state.guidelines = state.guidelines.filter(g => g.id !== id);
  state.updatedAt = nowISO();
  enqueue(() => persistDelete('guideline', id));
  emit();
}

/* ---------- rotina ---------- */
export function createSlot(data = {}) {
  const slot = normalizeSlot({ id: uid('rot'), ...data });
  state.routine.push(slot);
  state.routine.sort((a, b) => a.start.localeCompare(b.start));
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('routine', slot));
  emit();
  return slot;
}

export function getSlot(id) { return state.routine.find(s => s.id === id) || null; }

export function updateSlot(id, patch) {
  const slot = getSlot(id);
  if (!slot) return;
  Object.assign(slot, patch);
  state.routine.sort((a, b) => a.start.localeCompare(b.start));
  state.updatedAt = nowISO();
  enqueue(() => persistRecord('routine', slot));
  emit();
}

export function deleteSlot(id) {
  state.routine = state.routine.filter(s => s.id !== id);
  state.updatedAt = nowISO();
  enqueue(() => persistDelete('routine', id));
  emit();
}

export function resetRoutine() {
  state.routine = DEFAULT_ROUTINE.map(s => ({ ...s, id: uid('rot') }));
  state.updatedAt = nowISO();
  enqueue(async () => { for (const s of state.routine) await persistRecord('routine', s); });
  emit();
  return state.routine;
}

/* ---------- dados externos (e-mails, calendário, drive) ---------- */
export function saveEmails(list) {
  state.emails = Array.isArray(list) ? list : [];
  state.updatedAt = nowISO();
  scheduleMirror();
  if (isVault()) enqueue(() => api.putBag({ emails: state.emails }));
  emit();
}

export function saveCalendarEvents(list) {
  state.calendarEvents = Array.isArray(list) ? list : [];
  state.updatedAt = nowISO();
  scheduleMirror();
  if (isVault()) enqueue(() => api.putBag({ calendarEvents: state.calendarEvents }));
  emit();
}

export function saveDriveFiles(list) {
  state.driveFiles = Array.isArray(list) ? list : [];
  state.updatedAt = nowISO();
  scheduleMirror();
  if (isVault()) enqueue(() => api.putBag({ driveFiles: state.driveFiles }));
  emit();
}

/* ---------- configurações de conexão ---------- */
export function setConnections(next) {
  state.connections = { ...state.connections, ...next };
  emit();
}

export async function updateConfig(patch) {
  const saved = await api.saveConfig(patch);
  state.connections = saved;
  emit();
  return saved;
}

/* ============================================================
   backup / importação / reset
   ============================================================ */
export async function exportJSON() {
  await flush();
  const safe = JSON.parse(JSON.stringify(state));
  delete safe.connections;
  delete safe.sync;
  delete safe.vault;
  return JSON.stringify({ ...safe, exportedAt: nowISO() }, null, 2);
}

export async function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || (!parsed.applications && !parsed.tasks && !parsed.guidelines)) {
    throw new Error('Arquivo não parece ser um backup do HOD.');
  }
  const incoming = normalize(parsed);

  for (const a of incoming.applications) {
    const i = state.applications.findIndex(x => x.id === a.id);
    if (i >= 0) state.applications[i] = a; else state.applications.unshift(a);
  }
  for (const t of incoming.tasks) {
    const i = state.tasks.findIndex(x => x.id === t.id);
    if (i >= 0) state.tasks[i] = t; else state.tasks.unshift(t);
  }
  for (const g of incoming.guidelines) {
    const i = state.guidelines.findIndex(x => x.id === g.id);
    if (i >= 0) state.guidelines[i] = g; else state.guidelines.unshift(g);
  }
  state.updatedAt = nowISO();
  scheduleMirror(0);

  if (isVault()) {
    enqueue(async () => {
      for (const a of incoming.applications) await api.putRecord('application', a);
      for (const t of incoming.tasks) await api.putRecord('task', t);
      for (const g of incoming.guidelines) await api.putRecord('guideline', g);
    });
  }

  emit();
  return { applications: incoming.applications.length, tasks: incoming.tasks.length, guidelines: incoming.guidelines.length };
}

export async function resetAll() {
  const apps = [...state.applications];
  const tasks = [...state.tasks];
  const guides = [...state.guidelines];

  state.applications = [];
  state.tasks = [];
  state.guidelines = [];
  state.emails = [];
  state.calendarEvents = [];
  state.driveFiles = [];
  state.updatedAt = nowISO();
  scheduleMirror(0);

  if (isVault()) {
    enqueue(async () => {
      for (const a of apps) await api.deleteRecord('application', a.id).catch(() => {});
      for (const t of tasks) await api.deleteRecord('task', t.id).catch(() => {});
      for (const g of guides) await api.deleteRecord('guideline', g.id).catch(() => {});
      await api.putBag({ emails: [], calendarEvents: [], driveFiles: [] }).catch(() => {});
    });
  }

  emit();
}

/* ---------- métricas ---------- */
export function stats() {
  const open = state.tasks.filter(t => t.status !== 'done');
  const activeApps = state.applications.filter(a => a.stage !== 'encerrada');
  const pendingSteps = state.applications.flatMap(a => a.steps || []).filter(s => s.status !== 'done');
  return {
    apps: state.applications.length,
    activeApps: activeApps.length,
    openTasks: open.length,
    overdueTasks: open.filter(t => t.dueAt && new Date(t.dueAt) < new Date()).length,
    doneTasks: state.tasks.filter(t => t.status === 'done').length,
    pendingSteps: pendingSteps.length,
    guidelines: state.guidelines.length,
  };
}

/* ---------- migração v1 ---------- */
function migrateLegacy(old) {
  const s = emptyState();
  s.legacy = { importedAt: nowISO(), sourceKey: LEGACY_KEY };

  const mapTask = (t, extra = {}) => ({
    id: uid('task'),
    title: t.acao || t.title || t.atividade || 'Tarefa importada',
    notes: [t.empresa, t.oque].filter(Boolean).join(' — '),
    status: t.status === 'Concluído' ? 'done' : t.status === 'Fazendo' ? 'doing' : 'todo',
    priority: PRIORITY_ALIASES[t.prioridade] || 'normal',
    dueAt: t.quando || '',
    appId: '',
    appLabel: '',
    createdAt: nowISO(),
    completedAt: t.status === 'Concluído' ? nowISO() : '',
    ...extra,
  });

  const appIdByCompany = {};
  (old.projects || []).forEach(p => {
    const id = uid('app');
    appIdByCompany[p.empresa] = id;
    s.applications.push(normalizeApp({
      id,
      company: p.empresa || 'Sem empresa',
      role: p.projeto || 'Sem projeto',
      stage: STAGE_ALIASES[p.etapa] || 'mapeada',
      priority: PRIORITY_ALIASES[p.prioridade] || 'normal',
      nextAction: p.acao || '',
      deadline: p.prazo || '',
      link: p.obs || '',
      notes: p.historico || '',
      history: [{ at: nowISO(), text: `Importado da v1 na etapa “${p.etapa || '—'}”` }],
    }));
  });

  (old.tasks || []).forEach(t => s.tasks.push(normalizeTask(mapTask(t, { appId: appIdByCompany[t.empresa] || '' }))));
  (old.routine || []).forEach(r => s.tasks.push(normalizeTask(mapTask(r, { notes: `Rotina ${r.freq || ''} — ${r.oque || ''}`.trim() }))));
  (old.events || []).forEach(e => s.tasks.push(normalizeTask(mapTask(e, {
    title: `${e.dia}: ${e.evento}`.replace(/: —$/, ''),
    notes: [e.ref, e.acao].filter(Boolean).join(' — '),
  }))));

  return s;
}
