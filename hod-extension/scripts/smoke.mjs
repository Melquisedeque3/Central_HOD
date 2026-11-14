#!/usr/bin/env node
/* ============================================================
   smoke.mjs — teste de fumaça ponta a ponta do servidor HOD.

   Não usa navegador nem dependências: fala direto com a API HTTP.
   Cobre o contrato que o Hermes Agent também usa:

     • leitura de estado derivado
     • criação / atualização / renomeação / exclusão de notas
     • conflito de concorrência (409 com updatedAt antigo)
     • tombstones e lixeira
     • frontmatter válido e corpo derivado
     • bloqueio de caminhos internos
     • credenciais nunca expostas

   Uso:
     node server.mjs &            # em outro terminal
     npm run smoke
     HOD_URL=http://127.0.0.1:9000 npm run smoke
   ============================================================ */
import process from 'node:process';

const BASE = (process.env.HOD_URL || 'http://127.0.0.1:8420').replace(/\/$/, '');
const STAMP = Date.now().toString(36);
const APP_ID = `smoke_app_${STAMP}`;
const TASK_ID = `smoke_task_${STAMP}`;
const GUIDE_ID = `smoke_guide_${STAMP}`;

let passed = 0;
const failures = [];

const check = (name, ok, detail = '') => {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body, text };
}

const putRecord = (type, data) => api('/api/records', {
  method: 'POST',
  body: JSON.stringify({ type, data }),
});

async function cleanup() {
  for (const [type, id] of [['application', APP_ID], ['task', TASK_ID], ['guideline', GUIDE_ID]]) {
    await api(`/api/records/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }
}

console.log(`\nHOD smoke test · ${BASE}\n`);

/* ---------- 0. servidor no ar ---------- */
const health = await api('/api/health');
if (health.status !== 200) {
  console.error(`Servidor não respondeu em ${BASE}. Rode "node server.mjs" antes.\n`);
  process.exit(1);
}
check('GET /api/health responde 200', health.status === 200);
check('health informa o caminho do vault', typeof health.body?.vault?.path === 'string', health.body?.vault?.path);
check('health informa notas indexadas', Number.isInteger(health.body?.vault?.notes), String(health.body?.vault?.notes));
check('vault em modo filesystem', health.body?.vault?.mode === 'filesystem', health.body?.vault?.mode);
check('health informa estado do Hermes', typeof health.body?.hermes?.reachable === 'boolean');
check('health informa estado do Obsidian', typeof health.body?.obsidian?.reachable === 'boolean');

/* ---------- 1. estado derivado ---------- */
const state0 = await api('/api/state');
const s0 = state0.body?.state;
check('GET /api/state responde 200', state0.status === 200);
check('estado tem schema v4', s0?.version === 4, String(s0?.version));
for (const key of ['applications', 'tasks', 'guidelines', 'routine', 'emails', 'calendarEvents', 'driveFiles']) {
  check(`estado tem array "${key}"`, Array.isArray(s0?.[key]));
}
check('estado expõe o vault', typeof s0?.vault?.notes === 'number');
const tombstonesBefore = s0?.vault?.tombstones ?? 0;

/* ---------- 2. criação de candidatura ---------- */
const now = new Date().toISOString();
const app = {
  id: APP_ID,
  company: `Smoke ${STAMP}`,
  role: 'Engenheiro de Teste',
  stage: 'aplicada',
  priority: 'normal',
  nextAction: 'Validar o smoke test',
  deadline: '',
  notes: 'Nota criada pelo smoke test.',
  steps: [{ id: 's1', title: 'Primeiro passo', kind: 'Candidatura', status: 'todo' }],
  history: [],
  createdAt: now,
  updatedAt: now,
};

const created = await putRecord('application', app);
check('POST /api/records cria candidatura', created.status === 200 && created.body?.ok === true, created.text?.slice(0, 120));
const appPath = created.body?.path;
check('criação devolve o caminho da nota', typeof appPath === 'string' && appPath.startsWith('Candidaturas/'), appPath);

const note = await api(`/api/note?path=${encodeURIComponent(appPath)}`);
check('GET /api/note lê a nota criada', note.status === 200 && typeof note.body?.content === 'string');
const md = note.body?.content || '';
const [frontmatter, ...rest] = md.split(/\n---\n/);
check('nota começa com frontmatter YAML', md.startsWith('---\n'));
check('frontmatter guarda hod_type', /hod_type:\s*application/.test(frontmatter));
check('frontmatter guarda o id estável', frontmatter.includes(`id: ${APP_ID}`));
check('frontmatter marca managed_by: hod', /managed_by:\s*hod/.test(frontmatter));
check('frontmatter guarda created_at/updated_at', /created_at:/.test(frontmatter) && /updated_at:/.test(frontmatter));
check('corpo é derivado do registro', rest.join('\n---\n').includes('Corpo gerado pelo HOD'), rest.join('').slice(0, 80));
check('corpo traz a empresa', rest.join(' ').includes(`Smoke ${STAMP}`));

/* ---------- 3. idempotência (mesmo id não duplica arquivo) ---------- */
const again = await putRecord('application', { ...app, updatedAt: new Date().toISOString() });
check('regravar o mesmo id mantém o mesmo caminho', again.body?.path === appPath, `${appPath} → ${again.body?.path}`);

/* ---------- 4. conflito de concorrência (409) ---------- */
const stale = await putRecord('application', {
  ...app,
  nextAction: 'escrita antiga',
  updatedAt: new Date(Date.now() - 60_000).toISOString(),
});
check('escrita com updatedAt antigo recebe 409', stale.status === 409, `status ${stale.status}`);
check('409 devolve o registro atual', typeof stale.body?.current?.data?.nextAction === 'string');

/* ---------- 5. renomear move o arquivo ---------- */
const renamed = await putRecord('application', {
  ...app,
  company: `Smoke Renomeado ${STAMP}`,
  updatedAt: new Date().toISOString(),
});
const renamedPath = renamed.body?.path;
check('renomear troca o caminho da nota', renamedPath !== appPath, `${appPath} → ${renamedPath}`);
check('novo caminho segue a empresa', String(renamedPath).includes('Smoke Renomeado'), renamedPath);
const oldNote = await api(`/api/note?path=${encodeURIComponent(appPath)}`);
check('arquivo antigo não existe mais', oldNote.status !== 200, `status ${oldNote.status}`);
const newNote = await api(`/api/note?path=${encodeURIComponent(renamedPath)}`);
check('conteúdo novo está no arquivo novo', (newNote.body?.content || '').includes('Smoke Renomeado'));

/* ---------- 6. guideline: corpo é a fonte de verdade ---------- */
const guideBody = `# Guia do smoke\n\n- item um\n- item dois\n`;
const guide = await putRecord('guideline', {
  id: GUIDE_ID,
  title: `Guia Smoke ${STAMP}`,
  language: 'pt',
  body: guideBody,
  createdAt: now,
  updatedAt: now,
});
check('cria guideline', guide.status === 200, guide.text?.slice(0, 120));
const guideNote = await api(`/api/note?path=${encodeURIComponent(guide.body?.path)}`);
const guideMd = guideNote.body?.content || '';
const [guideFm, ...guideRest] = guideMd.split(/\n---\n/);
check('guideline não duplica o corpo no frontmatter', !/^body:/m.test(guideFm));
check('guideline preserva o corpo no markdown', guideRest.join('\n---\n').trim() === guideBody.trim(), guideRest.join('').slice(0, 60));

/* ---------- 7. tarefa ---------- */
const task = await putRecord('task', {
  id: TASK_ID,
  title: `Tarefa Smoke ${STAMP}`,
  status: 'todo',
  priority: 'baixa',
  dueAt: '',
  appId: APP_ID,
  createdAt: now,
  updatedAt: now,
});
check('cria tarefa', task.status === 200 && String(task.body?.path).startsWith('Tarefas/'), task.body?.path);

/* ---------- 8. exclusão + tombstone + lixeira ---------- */
const del = await api(`/api/records/application/${encodeURIComponent(APP_ID)}`, { method: 'DELETE' });
check('DELETE remove a candidatura', del.status === 200 && del.body?.deleted === true, del.text?.slice(0, 120));
const delAgain = await api(`/api/records/application/${encodeURIComponent(APP_ID)}`, { method: 'DELETE' });
check('segundo DELETE devolve 404', delAgain.status === 404, `status ${delAgain.status}`);
const afterDel = await api('/api/state');
const stillThere = (afterDel.body?.state?.applications || []).some(a => a.id === APP_ID);
check('registro excluído some do estado', !stillThere);
check('exclusão grava tombstone', (afterDel.body?.state?.vault?.tombstones ?? 0) > tombstonesBefore,
  `${tombstonesBefore} → ${afterDel.body?.state?.vault?.tombstones}`);

/* ---------- 9. bag (e-mails/calendário/drive) ---------- */
const bag = await api('/api/bag', {
  method: 'POST',
  body: JSON.stringify({ emails: [{ id: `smoke_mail_${STAMP}`, subject: 'Teste', from: 'x@y.z' }] }),
});
check('POST /api/bag grava dados sem nota', bag.status === 200 && bag.body?.ok === true);
const stateBag = await api('/api/state');
check('bag aparece no estado', (stateBag.body?.state?.emails || []).some(e => e.id === `smoke_mail_${STAMP}`));

/* ---------- 10. reindex ---------- */
const reindex = await api('/api/reindex', { method: 'POST' });
check('POST /api/reindex reconstrói o índice', reindex.status === 200 && Number.isInteger(reindex.body?.notes));

/* ---------- 11. caminhos internos bloqueados ---------- */
for (const path of ['/lib/vault.mjs', '/vault/', '/scripts/smoke.mjs', '/.git/config', '/.hod-config.json']) {
  const res = await api(path);
  check(`caminho interno bloqueado: ${path}`, res.status === 403, `status ${res.status}`);
}

/* ---------- 12. credenciais nunca saem do servidor ---------- */
const cfg = await api('/api/config');
const cfgText = JSON.stringify(cfg.body || {});
check('GET /api/config responde 200', cfg.status === 200);
check('config não devolve chave em texto puro', !/"key"\s*:/.test(cfgText), cfgText.slice(0, 160));
check('config informa hasKey (Hermes)', typeof cfg.body?.config?.hermes?.hasKey === 'boolean');
check('config informa hasKey (Obsidian)', typeof cfg.body?.config?.obsidian?.hasKey === 'boolean');

/* ---------- limpeza ---------- */
await cleanup();
const finalState = await api('/api/state');
check('limpeza removeu os registros do teste',
  !(finalState.body?.state?.tasks || []).some(t => t.id === TASK_ID) &&
  !(finalState.body?.state?.guidelines || []).some(g => g.id === GUIDE_ID));

console.log(`\n${passed} verificação(ões) OK${failures.length ? `, ${failures.length} falha(s)` : ''}.\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ! ${f}`);
  process.exit(1);
}
