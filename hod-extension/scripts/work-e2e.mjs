#!/usr/bin/env node
/* Teste de contrato da superfície limitada do ChatGPT Work. */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const base = (process.env.HOD_URL || 'http://127.0.0.1:8420').replace(/\/$/, '');
const admin = process.env.HOD_ADMIN_TOKEN || process.env.HOD_TOKEN || '';
const read = process.env.HOD_WORK_READ_TOKEN || '';
const write = process.env.HOD_WORK_WRITE_TOKEN || '';
const vault = process.env.HOD_VAULT_PATH || '';
const stamp = Date.now().toString(36);
const appId = `work_app_${stamp}`;
let passed = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) { passed += 1; console.log(`  ✔ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`); }
};
async function request(route, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: response.status, json, text };
}
if (!admin || !read || !write || !vault) {
  console.error('Defina HOD_ADMIN_TOKEN, HOD_WORK_READ_TOKEN, HOD_WORK_WRITE_TOKEN e HOD_VAULT_PATH.');
  process.exit(2);
}

console.log(`\nHOD Work E2E · ${base}\n`);
const now = new Date().toISOString();
const initial = { id: appId, company: `Work E2E ${stamp}`, role: 'Engenharia', stage: 'aplicada', priority: 'importante', nextAction: 'Aguardar retorno', deadline: '', notes: '', steps: [], history: [], createdAt: now, updatedAt: now };
const seeded = await request('/api/records', { method: 'POST', token: admin, body: { type: 'application', data: initial } });
check('prepara pendência para o Work', seeded.status === 200, seeded.text);

const context = await request('/work/context', { token: read });
check('Work lê o contexto autorizado', context.status === 200 && Array.isArray(context.json?.context?.pending_applications), context.text);
check('contexto identifica a pendência', context.json?.context?.pending_applications?.some(item => item.id === appId), context.text);
const weekly = await request('/work/routines/weekly', { token: read });
check('rotina semanal está disponível ao Work', weekly.status === 200 && weekly.json?.routine?.summary?.period === 'weekly', weekly.text);
const daily = await request('/work/routines/daily', { token: read });
check('rotina diária está disponível ao Work', daily.status === 200 && daily.json?.routine?.summary?.period === 'daily', daily.text);
const genericState = await request('/api/state', { token: read });
check('Work não recebe estado completo genérico', genericState.status === 401, genericState.text);

const changed = await request('/work/actions', { method: 'POST', token: write, body: { type: 'UPDATE_STATUS', payload: { applicationId: appId, status: 'entrevista' } } });
check('Work envia ação permitida', changed.status === 201 && changed.json?.action === 'UPDATE_STATUS', changed.text);
const note = await request('/work/actions', { method: 'POST', token: write, body: { type: 'ADD_NOTE', payload: { applicationId: appId, note: 'Pendência analisada pelo Work.' } } });
check('Work adiciona nota permitida', note.status === 201, note.text);
const task = await request('/work/actions', { method: 'POST', token: write, body: { type: 'CREATE_TASK', payload: { applicationId: appId, title: `Preparar entrevista ${stamp}`, priority: 'normal' } } });
check('Work cria tarefa permitida', task.status === 201, task.text);
const reprioritized = await request('/work/actions', { method: 'POST', token: write, body: { type: 'UPDATE_PRIORITY', payload: { entity: 'application', id: appId, priority: 'urgente' } } });
check('Work atualiza prioridade permitida', reprioritized.status === 201, reprioritized.text);
const followup = await request('/work/actions', { method: 'POST', token: write, body: { type: 'SCHEDULE_FOLLOWUP', payload: { applicationId: appId, title: `Follow-up ${stamp}`, priority: 'importante', dueAt: new Date(Date.now() + 86400000).toISOString() } } });
check('Work agenda follow-up permitido', followup.status === 201, followup.text);
const analysis = await request('/work/actions', { method: 'POST', token: write, body: { type: 'REGISTER_ANALYSIS', payload: { applicationId: appId, title: `Análise ${stamp}`, content: 'Conteúdo autorizado para o vault HOD.' } } });
const relativeDocument = analysis.json?.result?.path;
check('Work registra análise autorizada', analysis.status === 201 && /^Insights\//.test(relativeDocument || ''), analysis.text);
if (relativeDocument) {
  const content = await fs.readFile(path.join(vault, ...relativeDocument.split('/')), 'utf8').catch(() => '');
  check('Obsidian recebe somente conteúdo em diretório HOD autorizado', content.includes('Conteúdo autorizado para o vault HOD.'), relativeDocument);
}

const forbidden = await request('/work/actions', { method: 'POST', token: write, body: { type: 'DELETE_RECORD', payload: { id: appId } } });
check('allowlist bloqueia exclusão', forbidden.status === 400, forbidden.text);
const shell = await request('/work/actions', { method: 'POST', token: write, body: { type: 'EXEC_SHELL', payload: { command: 'id' } } });
check('allowlist bloqueia shell', shell.status === 400, shell.text);
const filesystem = await request('/work/actions', { method: 'POST', token: write, body: { type: 'WRITE_FILE', payload: { path: '../fora.md', content: 'bloqueado' } } });
check('allowlist bloqueia filesystem arbitrário', filesystem.status === 400, filesystem.text);
const recordWrite = await request('/api/records', { method: 'POST', token: write, body: { type: 'task', data: { id: `forbidden_${stamp}`, title: 'não deve criar' } } });
check('Work não usa CRUD genérico', recordWrite.status === 401, recordWrite.text);
const config = await request('/api/config', { method: 'POST', token: write, body: {} });
check('Work não altera configuração', config.status === 401, config.text);
const proxy = await request('/api/obsidian/vault/qualquer', { token: admin });
check('proxy genérico do Obsidian permanece desativado', proxy.status === 410, proxy.text);

const state = await request('/api/state', { token: admin });
check('frontend pode refletir alteração via estado derivado', state.status === 200 && state.json?.state?.applications?.some(item => item.id === appId && item.stage === 'entrevista') && state.json?.state?.tasks?.some(item => item.appId === appId), state.text);
const audit = await request('/api/audit', { token: admin });
const events = audit.json?.events || [];
check('toda ação Work fica auditada', audit.status === 200 && events.filter(event => event.actor === 'WORK').some(event => event.entity_id === appId) && events.some(event => event.action === 'WRITE_DOCUMENT' && event.actor === 'WORK'), audit.text);

console.log(`\n${passed}/${passed + failures.length} verificações passaram.`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
