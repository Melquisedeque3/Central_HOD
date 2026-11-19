#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hod-mcp-'));
const port = 20000 + Math.floor(Math.random() * 1000);
const env = { ...process.env, HOD_PORT: String(port), HOD_VAULT: path.join(tmp, 'vault'), HOD_CONFIG: path.join(tmp, 'config.json'), HOD_AUTH_FILE: path.join(tmp, 'auth.json'), HOD_BACKUP_DIR: path.join(tmp, 'backups'), HOD_ADMIN_TOKEN: 'mcp-admin', HOD_MCP_TOKEN: 'mcp-token' };
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`; const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let retry = 0; retry < 50; retry++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {} await sleep(50); }
const now = new Date().toISOString();
await fetch(`${base}/api/records`, { method: 'POST', headers: { authorization: 'Bearer mcp-admin', 'content-type': 'application/json' }, body: JSON.stringify({ type: 'application', data: { id: 'mcp_app', company: 'MCP Test', role: 'QA', stage: 'aplicada', priority: 'normal', notes: '', steps: [], history: [], createdAt: now, updatedAt: now } }) });
const mcp = spawn(process.execPath, ['mcp/hod-mcp.mjs'], { cwd: root, env: { ...env, HOD_API_URL: base }, stdio: ['pipe', 'pipe', 'ignore'] });
let buffer = ''; const pending = new Map(); mcp.stdout.on('data', chunk => { buffer += chunk; for (;;) { const next = buffer.indexOf('\n'); if (next < 0) return; const line = buffer.slice(0, next); buffer = buffer.slice(next + 1); const data = JSON.parse(line); pending.get(data.id)?.(data); pending.delete(data.id); } });
let id = 0;
const rpc = (method, params) => new Promise((resolve, reject) => { const requestId = ++id; const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error('timeout MCP')); }, 5000); pending.set(requestId, result => { clearTimeout(timeout); resolve(result); }); mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`); });
try {
  const init = await rpc('initialize', { protocolVersion: '2024-11-05' }); assert.equal(init.result?.serverInfo?.name, 'hod-mcp');
  const listed = await rpc('tools/list', {}); assert.equal(listed.result?.tools?.length, 4);
  const context = await rpc('tools/call', { name: 'hod_get_context', arguments: { period: 'daily' } }); assert.match(context.result?.content?.[0]?.text || '', /pending_applications/);
  const action = await rpc('tools/call', { name: 'hod_execute_action', arguments: { type: 'ADD_NOTE', payload: { applicationId: 'mcp_app', note: 'Ação auditada pelo MCP' } } }); assert.equal(action.result?.isError, undefined);
  const rejected = await rpc('tools/call', { name: 'hod_execute_action', arguments: { type: 'EXEC_SHELL', payload: {} } }); assert.equal(rejected.result?.isError, true);
  const audit = await (await fetch(`${base}/api/audit`, { headers: { authorization: 'Bearer mcp-admin' } })).json(); assert.equal(audit.events.some(event => event.actor === 'MCP' && event.origin === 'mcp'), true);
  console.log('  ✔ MCP stdio: contexto, ação permitida, bloqueio e auditoria');
} finally { mcp.kill('SIGTERM'); server.kill('SIGTERM'); await fs.rm(tmp, { recursive: true, force: true }); }
