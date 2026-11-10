/* ============================================================
   crud-check.mjs — teste de fumaça do CRUD via Chrome DevTools
   Requer: servidor em http://127.0.0.1:8765 e Chrome com
   --remote-debugging-port=9222 (use um --user-data-dir dedicado).
   Uso: node scripts/crud-check.mjs
   ============================================================ */
import process from 'node:process';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const CDP = process.env.CDP || 'http://127.0.0.1:9222';

const created = await (await fetch(`${CDP}/json/new?url=about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const failures = [];
const logs = [];

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    logs.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
  }
});

const send = (method, params = {}) => new Promise(resolve => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const js = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ✔ ${name}`);
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`); }
};

try {
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: `${BASE}#/apps` });
  await wait(1200);
  const baseline = await js(`(() => { const s = JSON.parse(localStorage.getItem('hod:state') || '{"applications":[],"tasks":[]}'); return { apps: s.applications.length, tasks: s.tasks.length }; })()`);
  const company = `Empresa Teste ${Date.now().toString(36)}`;

  // 1. criar candidatura pela topbar
  console.log('\nCandidaturas');
  await js(`document.querySelector('.top-actions [data-action="new-app"]').click()`);
  await wait(400);
  check('modal de candidatura abre', await js(`!!document.querySelector('.modal form')`));
  await js(`(() => {
    const f = document.querySelector('.modal form');
    const set = (n, v) => { f.elements[n].value = v; };
    set('company', ${JSON.stringify(company)}); set('role', 'Pessoa Desenvolvedora');
    set('nextAction', 'Enviar currículo'); set('deadline', '2026-12-01'); set('priority', 'urgente');
    f.querySelector('button[type=submit]').click();
  })()`);
  await wait(700);
  const apps = await js(`JSON.parse(localStorage.getItem('hod:state') || '{}').applications || []`);
  const app = apps.find(a => a.company === company);
  check('candidatura criada', !!app);
  check('contagem aumentou', apps.length === baseline.apps + 1, `${baseline.apps} → ${apps.length}`);
  check('prazo e etapa salvos', app?.deadline === '2026-12-01' && app?.stage === 'mapeada', JSON.stringify({ stage: app?.stage, deadline: app?.deadline }));

  // 2. etapa no detalhe
  console.log('\nEtapas');
  await send('Page.navigate', { url: `${BASE}#/apps/${app?.id}` });
  await wait(900);
  await js(`document.querySelector('[data-action="add-step"]').click()`);
  await wait(400);
  await js(`(() => {
    const f = document.querySelector('.modal form');
    f.elements.title.value = 'Prova técnica';
    f.elements.kind.value = 'Prova / Teste';
    f.elements.dueAt.value = '2026-12-05T14:30';
    f.querySelector('button[type=submit]').click();
  })()`);
  await wait(700);
  let steps = await js(`JSON.parse(localStorage.getItem('hod:state')).applications.find(a => a.id === ${JSON.stringify(app?.id)})?.steps || []`);
  check('etapa criada com prazo', steps[0]?.title === 'Prova técnica' && steps[0]?.dueAt === '2026-12-05T14:30');

  await js(`document.querySelector('[data-action="toggle-step"]')?.click()`);
  await wait(500);
  steps = await js(`JSON.parse(localStorage.getItem('hod:state')).applications.find(a => a.id === ${JSON.stringify(app?.id)})?.steps || []`);
  check('etapa concluída', steps[0]?.status === 'done');

  // 3. tarefa vinculada
  console.log('\nTarefas');
  await send('Page.navigate', { url: `${BASE}#/tasks` });
  await wait(900);
  await js(`document.querySelector('.top-actions [data-action="new-task"]').click()`);
  await wait(400);
  await js(`(() => {
    const f = document.querySelector('.modal form');
    f.elements.title.value = 'Tarefa vinculada';
    f.elements.appId.value = ${JSON.stringify(app?.id)};
    f.elements.dueAt.value = '2026-12-03T09:00';
    f.querySelector('button[type=submit]').click();
  })()`);
  await wait(700);
  const task = (await js(`JSON.parse(localStorage.getItem('hod:state')).tasks`)).find(t => t.title === 'Tarefa vinculada');
  check('tarefa criada e vinculada', task?.appId === app?.id);

  // 4. persistência após reload
  console.log('\nPersistência');
  await send('Page.reload', { ignoreCache: true });
  await wait(1200);
  const persisted = await js(`(() => { const s = JSON.parse(localStorage.getItem('hod:state')); return {
    app: s.applications.find(a => a.id === ${JSON.stringify(app?.id)}),
    task: s.tasks.find(t => t.title === 'Tarefa vinculada'),
  }; })()`);
  check('candidatura persiste', persisted.app?.company === company && persisted.app?.steps[0]?.status === 'done');
  check('tarefa persiste', persisted.task?.appId === app?.id);
  check('tarefa aparece na tela', await js(`document.querySelector('#view')?.innerText.includes('Tarefa vinculada')`));

  // 5. exclusão em cascata
  console.log('\nExclusão');
  await send('Page.navigate', { url: `${BASE}#/apps/${app?.id}` });
  await wait(900);
  await js(`document.querySelector('[data-action="del-app"]')?.click()`);
  await wait(300);
  await js(`document.querySelector('[data-yes]')?.click()`);
  await wait(700);
  const after = await js(`(() => { const s = JSON.parse(localStorage.getItem('hod:state')); return { apps: s.applications.length, tasks: s.tasks.length, steps: s.applications.reduce((n, a) => n + a.steps.length, 0) }; })()`);
  check('candidatura removida', after.apps === baseline.apps, `${after.apps} (esperado ${baseline.apps})`);
  check('tarefas ligadas removidas', after.tasks === baseline.tasks, `${after.tasks} (esperado ${baseline.tasks})`);

  check('sem erros de console', logs.length === 0, logs.slice(0, 3).join(' | '));
} finally {
  ws.close();
  await fetch(`${CDP}/json/close/${created.id}`).catch(() => {});
}

console.log(failures.length ? `\n${failures.length} falha(s).` : '\nTudo certo.');
process.exitCode = failures.length ? 1 : 0;
