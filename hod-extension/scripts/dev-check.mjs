/* Dev harness: loads the panel in Chrome via CDP, seeds data, screenshots views. */
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.OUT || '/tmp/hod-shots';
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry.text);
});

const send = (method, params = {}) => new Promise(res => {
  const rid = ++id;
  pending.set(rid, res);
  ws.send(JSON.stringify({ id: rid, method, params }));
});
const wait = ms => new Promise(r => setTimeout(r, ms));

await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
mkdirSync(OUT, { recursive: true });

const now = new Date().toISOString();
const seed = {
  version: 3, createdAt: now, updatedAt: now,
  applications: [
    { id: 'app_1', company: 'Welocalize', role: 'Language Tester PT-BR', stage: 'teste', priority: 'urgente', nextAction: 'Concluir prova de 45 min', deadline: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), appliedAt: '2026-10-28', link: 'https://welocalize.com', location: 'Remoto', compensation: 'US$ 12/h', tags: ['idioma'], notes: '**Prova** com foco em QA de tradução.', steps: [
      { id: 's1', title: 'Cadastro na plataforma', kind: 'Candidatura', status: 'done', dueAt: '2026-10-28', notes: '' },
      { id: 's2', title: 'Prova de qualificação', kind: 'Prova / Teste', status: 'todo', dueAt: new Date(Date.now() + 2 * 864e5).toISOString(), notes: '45 minutos, sem consulta' },
      { id: 's3', title: 'Entrevista com recrutador', kind: 'Entrevista', status: 'todo', dueAt: '', notes: '' },
    ], history: [{ at: now, text: 'Etapa: Candidatura enviada → Teste / Prova' }] },
    { id: 'app_2', company: 'CrowdGen', role: 'AI Trainer', stage: 'aplicada', priority: 'importante', nextAction: 'Aguardar retorno do teste', deadline: '', appliedAt: '2026-11-01', link: '', location: 'Remoto', compensation: '', tags: [], notes: '', steps: [], history: [] },
    { id: 'app_3', company: 'Outlier', role: 'Data Quality Analyst', stage: 'entrevista', priority: 'importante', nextAction: 'Preparar apresentação de 5 min', deadline: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), appliedAt: '2026-10-20', link: '', location: 'Remoto', compensation: 'US$ 15/h', tags: [], notes: '', steps: [{ id: 's4', title: 'Entrevista técnica', kind: 'Entrevista', status: 'todo', dueAt: new Date(Date.now() + 5 * 864e5).toISOString(), notes: '' }], history: [] },
    { id: 'app_4', company: 'OneForma', role: 'Search Evaluator', stage: 'ativa', priority: 'normal', nextAction: 'Registrar horas da semana', deadline: '', appliedAt: '2026-09-10', link: '', location: 'Remoto', compensation: '', tags: [], notes: '', steps: [{ id: 's5', title: 'Onboarding', kind: 'Onboarding', status: 'done', dueAt: '', notes: '' }], history: [] },
    { id: 'app_5', company: 'Alignerr', role: 'Redator técnico', stage: 'mapeada', priority: 'baixa', nextAction: 'Ler requisitos e decidir se aplica', deadline: '', appliedAt: '', link: '', location: 'Remoto', compensation: '', tags: [], notes: '', steps: [], history: [] },
  ],
  tasks: [
    { id: 't1', title: 'Concluir prova da Welocalize', notes: '45 min, sem consulta', status: 'todo', priority: 'urgente', dueAt: new Date(Date.now() + 2 * 864e5).toISOString(), appId: 'app_1', createdAt: now, completedAt: '' },
    { id: 't2', title: 'Enviar follow-up para CrowdGen', notes: '', status: 'todo', priority: 'importante', dueAt: new Date(Date.now() - 1 * 864e5).toISOString(), appId: 'app_2', createdAt: now, completedAt: '' },
    { id: 't3', title: 'Revisar currículo em inglês', notes: '', status: 'doing', priority: 'importante', dueAt: '', appId: '', createdAt: now, completedAt: '' },
    { id: 't4', title: 'Estudar guia da Outlier', notes: '', status: 'todo', priority: 'normal', dueAt: new Date(Date.now() + 1 * 864e5).toISOString(), appId: 'app_3', createdAt: now, completedAt: '' },
    { id: 't5', title: 'Atualizar portfólio', notes: '', status: 'done', priority: 'normal', dueAt: '', appId: '', createdAt: now, completedAt: now },
  ],
  guidelines: [
    { id: 'g1', title: 'Guia de avaliação — Welocalize', appId: 'app_1', sourceUrl: 'https://welocalize.com/guide', language: 'en', body: '# Critérios\n\n- Precisão acima de 98%\n- **Não** usar tradutor automático\n- Entregar em 45 minutos\n\n## Dicas\nLer o glossário antes de começar.', translation: '', createdAt: now, updatedAt: now },
    { id: 'g2', title: 'Onboarding — OneForma', appId: 'app_4', sourceUrl: '', language: 'pt', body: 'Registrar horas até sexta.\n\n- Plataforma XTM\n- Contato: suporte@oneforma.com', translation: '', createdAt: now, updatedAt: now },
  ],
  settings: { obsidian: { enabled: false, url: 'http://127.0.0.1:27123', key: '', folder: 'HOD' }, ai: { provider: '', model: '', apiKey: '' }, ui: { density: 'comfortable' } },
  legacy: null,
};

await send('Page.navigate', { url: BASE });
await wait(1200);
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('hod:state', ${JSON.stringify(JSON.stringify(seed))}); } catch (e) {}`,
});
await send('Page.reload', { ignoreCache: true });
await wait(1500);

const shots = [
  ['home', '#/home'], ['pipeline', '#/pipeline'], ['apps', '#/apps'],
  ['detail', '#/apps/app_1'], ['tasks', '#/tasks'], ['study', '#/study'], ['settings', '#/settings'],
];
const results = [];
for (const [name, hash] of shots) {
  await send('Page.navigate', { url: BASE + hash });
  await send('Page.reload', { ignoreCache: true });
  await wait(1200);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(shot.result.data, 'base64'));
  const check = await send('Runtime.evaluate', { expression: `({title: document.title, cards: document.querySelectorAll('.card,.kcard').length, text: document.querySelector('#view')?.innerText.slice(0,120)})`, returnByValue: true });
  results.push({ name, ...check.result?.result?.value });
}
console.log(JSON.stringify({ results, errors }, null, 1));
ws.close();
