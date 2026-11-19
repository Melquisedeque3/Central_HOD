#!/usr/bin/env node
/* Confirma persistência das ações Work após subir outro processo no mesmo vault. */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const base = (process.env.HOD_URL || 'http://127.0.0.1:8420').replace(/\/$/, '');
const token = process.env.HOD_ADMIN_TOKEN || process.env.HOD_TOKEN || '';
const vault = process.env.HOD_VAULT_PATH || '';
if (!token || !vault) { console.error('Defina HOD_ADMIN_TOKEN e HOD_VAULT_PATH.'); process.exit(2); }
async function get(route) {
  const response = await fetch(`${base}${route}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const state = await get('/api/state');
const audit = await get('/api/audit');
const insights = await fs.readdir(path.join(vault, 'Insights')).catch(() => []);
const checks = [
  ['servidor reiniciado recupera candidaturas Work', state.status === 200 && state.body?.state?.applications?.some(app => app.id.startsWith('work_app_') && app.stage === 'entrevista')],
  ['servidor reiniciado recupera follow-up Work', state.body?.state?.tasks?.some(task => task.appId?.startsWith('work_app_'))],
  ['documento autorizado persiste no diretório Insights', insights.some(name => name.endsWith('.md'))],
  ['auditoria Work persiste após reinício', audit.status === 200 && audit.body?.events?.some(event => event.actor === 'WORK')],
];
for (const [name, ok] of checks) console.log(`  ${ok ? '✔' : '✘'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
