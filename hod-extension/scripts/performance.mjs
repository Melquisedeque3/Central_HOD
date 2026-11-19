#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Vault } from '../lib/vault.mjs';
import { buildNote } from '../lib/frontmatter.mjs';
import { BackupManager } from '../lib/backups.mjs';
const total = Number(process.env.HOD_PERF_RECORDS || 300);
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hod-perf-')); const vaultPath = path.join(root, 'vault'); const now = new Date().toISOString();
const ms = async fn => { const start = performance.now(); const value = await fn(); return { value, elapsed: performance.now() - start }; };
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
try {
  const startup = await ms(async () => { const vault = new Vault(vaultPath); await vault.init(); return vault; }); const vault = startup.value;
  const seed = await ms(async () => { const dir = path.join(vaultPath, 'Candidaturas'); await Promise.all(Array.from({ length: total }, (_, i) => fs.writeFile(path.join(dir, `Perf ${i}.md`), buildNote({ hod_type: 'application', id: `perf_${i}`, company: `Empresa ${i}`, role: 'Teste', stage: 'aplicada', priority: 'normal', created_at: now, updated_at: now, managed_by: 'hod' }, '')))); });
  const read = await ms(() => vault.state());
  const write = await ms(() => vault.put('task', { id: 'perf_task', title: 'Medição de escrita', status: 'todo', priority: 'normal', notes: '', dueAt: '', createdAt: now, updatedAt: now }));
  const work = await ms(() => vault.state());
  const backups = new BackupManager(vaultPath, { root: path.join(root, 'backups') }); const backup = await ms(() => backups.create('performance')); await fs.writeFile(path.join(vaultPath, 'after-backup.txt'), 'alterado'); const restore = await ms(() => backups.restore(backup.value.id));
  const port = 19000 + Math.floor(Math.random() * 500); const token = 'performance-work-token';
  const child = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env, HOD_PORT: String(port), HOD_VAULT: vaultPath, HOD_CONFIG: path.join(root, 'config.json'), HOD_AUTH_FILE: path.join(root, 'auth.json'), HOD_WORK_WRITE_TOKEN: token, HOD_WORK_READ_TOKEN: 'performance-read', HOD_ADMIN_TOKEN: 'performance-admin', HOD_BACKUP_DIR: path.join(root, 'backups') }, stdio: 'ignore' });
  const endpoint = `http://127.0.0.1:${port}`; for (let retry = 0; retry < 50; retry++) { try { if ((await fetch(`${endpoint}/api/health`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 40)); }
  const call = async (route, init) => { const start = performance.now(); const response = await fetch(`${endpoint}${route}`, init); await response.text(); return performance.now() - start; };
  const contexts = []; for (let i = 0; i < 10; i++) contexts.push(await call('/work/context', { headers: { authorization: 'Bearer performance-read' } }));
  const actions = []; for (let i = 0; i < 10; i++) actions.push(await call('/work/actions', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'ADD_NOTE', payload: { applicationId: 'perf_0', note: `Medição ${i}` } }) }));
  child.kill('SIGTERM');
  const out = { records: total, initialization_ms: Number(startup.elapsed.toFixed(2)), seed_write_ms: Number(seed.elapsed.toFixed(2)), vault_read_ms: Number(read.elapsed.toFixed(2)), single_write_ms: Number(write.elapsed.toFixed(2)), work_context_basis_state_ms: Number(work.elapsed.toFixed(2)), work_context_mean_ms: Number(average(contexts).toFixed(2)), work_action_mean_ms: Number(average(actions).toFixed(2)), backup_ms: Number(backup.elapsed.toFixed(2)), restore_ms: Number(restore.elapsed.toFixed(2)), rss_mb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2)), heap_used_mb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)) };
  console.log(JSON.stringify(out, null, 2));
} finally { await fs.rm(root, { recursive: true, force: true }); }
