#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hod-collector-'));
const port = 21000 + Math.floor(Math.random() * 1000);
const feedPort = port + 1000;
const token = 'collector-integration-token';
const env = { ...process.env, HOD_PORT: String(port), HOD_VAULT: path.join(tmp, 'vault'), HOD_CONFIG: path.join(tmp, 'config.json'), HOD_AUTH_FILE: path.join(tmp, 'auth.json'), HOD_ADMIN_TOKEN: 'collector-admin', HOD_COLLECTOR_TOKEN: token, HOD_BACKUP_DIR: path.join(tmp, 'backups') };
const feed = [{ id: 'lever-1', text: '<b>AI evaluator</b>', hostedUrl: 'https://jobs.lever.co/appen/lever-1', description: '<p>Analyze <em>data</em>.</p>', createdAt: 1700000000000, categories: { location: 'Remote' }, lists: [] }];
const feedServer = http.createServer((req, res) => {
  if (req.url !== '/postings') return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(feed));
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
const run = (command, args, options) => new Promise((resolve, reject) => {
  const child = spawn(command, args, options); let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

await listen(feedServer);
const address = feedServer.address();
const api = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.mjs'], { cwd: appRoot, env, stdio: 'ignore' });
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${api}/api/health`)).ok) break; } catch {} await sleep(50); }
  const args = ['collectors/lever_collector.py', '--endpoint', `http://127.0.0.1:${address.port}/postings`, '--api-url', api, '--commit'];
  const first = await run('python3', args, { cwd: appRoot, env: { ...env, HOD_COLLECTOR_TOKEN: token } });
  assert.equal(first.code, 0, first.stderr); assert.equal(JSON.parse(first.stdout).sources[0].created, 1);
  const second = await run('python3', args, { cwd: appRoot, env: { ...env, HOD_COLLECTOR_TOKEN: token } });
  assert.equal(second.code, 0, second.stderr); assert.equal(JSON.parse(second.stdout).sources[0].duplicate, 1);
  const state = await fetch(`${api}/api/opportunities`, { headers: { authorization: 'Bearer collector-admin' } });
  const body = await state.json(); assert.equal(state.status, 200); assert.equal(body.opportunities.length, 1); assert.equal(body.opportunities[0].description, 'Analyze data.');
  const audit = await fetch(`${api}/api/audit`, { headers: { authorization: 'Bearer collector-admin' } });
  const events = (await audit.json()).events; assert(events.some(event => event.actor === 'COLLECTOR' && event.origin === 'collector' && event.action === 'CREATE'));
  console.log('✔ coletor valida fonte, envia por token restrito, deduplica e audita');
} finally {
  child.kill('SIGTERM'); await close(feedServer); await fs.rm(tmp, { recursive: true, force: true });
}
