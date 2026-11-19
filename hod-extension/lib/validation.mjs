const ID = /^[A-Za-z0-9_-]{1,96}$/;
const DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?Z?)?)?$/;
const STAGES = new Set(['mapeada', 'aplicada', 'teste', 'entrevista', 'proposta', 'ativa', 'encerrada']);
const PRIORITIES = new Set(['urgente', 'importante', 'normal', 'baixa']);
const TASK_STATUS = new Set(['todo', 'doing', 'done']);

function bad(message) { return Object.assign(new Error(message), { status: 400 }); }
function text(value, name, { required = false, max = 4000 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`${name} é obrigatório.`);
    return;
  }
  if (typeof value !== 'string' || value.length > max) throw bad(`${name} inválido.`);
}
function date(value, name) {
  if (value && (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(new Date(value).getTime()))) throw bad(`${name} inválida.`);
}
function url(value, name) {
  if (!value) return;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch { throw bad(`${name} deve usar HTTP(S).`); }
}
function id(value, name = 'id') { if (typeof value !== 'string' || !ID.test(value)) throw bad(`${name} inválido.`); }
function list(value, name, max = 200) { if (value !== undefined && (!Array.isArray(value) || value.length > max)) throw bad(`${name} inválida.`); }

export function validateRecord(type, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('Registro inválido.');
  id(data.id);
  if (type === 'application') {
    text(data.company, 'empresa', { required: true, max: 160 });
    text(data.role, 'função', { max: 160 }); text(data.notes, 'notas', { max: 120000 });
    if (data.stage && !STAGES.has(data.stage)) throw bad('etapa inválida.');
    if (data.priority && !PRIORITIES.has(data.priority)) throw bad('prioridade inválida.');
    date(data.deadline, 'prazo'); date(data.appliedAt, 'data da candidatura'); url(data.link, 'link');
    list(data.steps, 'etapas'); list(data.history, 'histórico');
  } else if (type === 'task') {
    text(data.title, 'título', { required: true, max: 240 }); text(data.notes, 'notas', { max: 120000 });
    if (data.status && !TASK_STATUS.has(data.status)) throw bad('status inválido.');
    if (data.priority && !PRIORITIES.has(data.priority)) throw bad('prioridade inválida.');
    date(data.dueAt, 'prazo'); if (data.appId) id(data.appId, 'appId');
  } else if (type === 'guideline') {
    text(data.title, 'título', { required: true, max: 240 }); text(data.body, 'conteúdo', { max: 400000 });
    text(data.translation, 'tradução', { max: 400000 }); url(data.sourceUrl, 'URL de fonte'); if (data.appId) id(data.appId, 'appId');
  } else if (type === 'routine') {
    text(data.label, 'rótulo', { required: true, max: 160 });
    if (data.start && !/^\d{2}:\d{2}$/.test(data.start)) throw bad('horário inicial inválido.');
    if (data.end && !/^\d{2}:\d{2}$/.test(data.end)) throw bad('horário final inválido.');
  } else if (type === 'opportunity') {
    text(data.source, 'fonte', { required: true, max: 120 });
    text(data.company, 'empresa', { max: 160 }); text(data.title, 'cargo/projeto', { required: true, max: 240 });
    text(data.description, 'descrição', { max: 120000 }); text(data.requirements, 'requisitos', { max: 120000 });
    text(data.sourceId, 'id da fonte', { max: 240 }); text(data.status, 'status', { max: 40 });
    if (data.priority && !PRIORITIES.has(data.priority)) throw bad('prioridade inválida.');
    url(data.url, 'URL original'); date(data.publishedAt, 'data de publicação'); date(data.collectedAt, 'data de coleta');
    list(data.evidence, 'evidências', 40);
  }
  return data;
}

export function applicationFingerprint(data) {
  return [data.company, data.role, data.link, data.appliedAt]
    .map(value => String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\/+$/, ''))
    .join('|');
}

export function opportunityFingerprint(data) {
  return [data.source, data.sourceId || data.url, data.title, data.company]
    .map(value => String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\/+$/, ''))
    .join('|');
}
