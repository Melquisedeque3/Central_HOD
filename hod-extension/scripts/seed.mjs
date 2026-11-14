#!/usr/bin/env node
/* ============================================================
   seed.mjs — popula o vault com dados de demonstração.

   Serve para ver a interface cheia no primeiro contato e para o
   Hermes Agent testar as ações contextuais com contexto real.

   Uso:
     node server.mjs &
     npm run seed            # só semeia se o vault estiver vazio
     npm run seed -- --force # regrava os registros demo_*
   ============================================================ */
import process from 'node:process';

const BASE = (process.env.HOD_URL || 'http://127.0.0.1:8420').replace(/\/$/, '');
const FORCE = process.argv.includes('--force');
const iso = offsetDays => new Date(Date.now() + offsetDays * 864e5).toISOString();
const day = offsetDays => iso(offsetDays).slice(0, 10);

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const state = (await api('/api/state')).state;
if (state.applications.length && !FORCE) {
  console.log(`O vault já tem ${state.applications.length} candidatura(s). Use --force para regravar os dados demo.`);
  process.exit(0);
}

const now = new Date().toISOString();

const applications = [
  {
    id: 'demo_app_nubank',
    company: 'Nubank',
    role: 'Engenheiro de Dados',
    stage: 'entrevista',
    priority: 'urgente',
    nextAction: 'Preparar case de streaming em tempo real',
    deadline: day(4),
    location: 'Remoto',
    link: 'https://nubank.com.br/carreiras',
    notes: 'Processo com 3 etapas. Recrutadora: Ana.\n\n**Foco do case:** ingestão de eventos e idempotência.',
    steps: [
      { id: 'demo_s1', title: 'Triagem com recrutadora', kind: 'Entrevista', status: 'done', dueAt: day(-9) },
      { id: 'demo_s2', title: 'Desafio técnico (SQL + Python)', kind: 'Prova / Teste', status: 'done', dueAt: day(-4) },
      { id: 'demo_s3', title: 'Case de arquitetura', kind: 'Prova / Teste', status: 'todo', dueAt: day(4) },
      { id: 'demo_s4', title: 'Entrevista com o time', kind: 'Entrevista', status: 'todo', dueAt: day(8) },
    ],
    history: [{ at: day(-4), text: 'Etapa: Teste / Prova → Entrevista' }],
    createdAt: iso(-21),
    updatedAt: now,
  },
  {
    id: 'demo_app_itau',
    company: 'Itaú',
    role: 'Analista de BI Sênior',
    stage: 'aplicada',
    priority: 'importante',
    nextAction: 'Aguardar retorno do RH (prazo de 7 dias)',
    deadline: day(12),
    location: 'São Paulo (híbrido)',
    notes: 'Vaga pede Power BI avançado e modelagem dimensional.',
    steps: [{ id: 'demo_s5', title: 'Candidatura enviada', kind: 'Candidatura', status: 'done', dueAt: day(-2) }],
    history: [],
    createdAt: iso(-2),
    updatedAt: now,
  },
  {
    id: 'demo_app_ifood',
    company: 'iFood',
    role: 'Data Analyst',
    stage: 'proposta',
    priority: 'urgente',
    nextAction: 'Negociar faixa salarial e modelo de trabalho',
    deadline: day(2),
    location: 'Remoto',
    notes: 'Proposta inicial: R$ 12.500 + bônus. Tentar 14k.',
    steps: [
      { id: 'demo_s6', title: 'Proposta recebida', kind: 'Proposta', status: 'done', dueAt: day(-1) },
      { id: 'demo_s7', title: 'Contraproposta', kind: 'Negociação', status: 'todo', dueAt: day(2) },
    ],
    history: [],
    createdAt: iso(-30),
    updatedAt: now,
  },
  {
    id: 'demo_app_mercadolivre',
    company: 'Mercado Livre',
    role: 'Data Scientist',
    stage: 'mapeada',
    priority: 'baixa',
    nextAction: 'Ler requisitos e decidir se vale aplicar',
    deadline: '',
    location: 'Remoto',
    notes: 'Descrição menciona MLOps e Airflow.',
    steps: [],
    history: [],
    createdAt: iso(-1),
    updatedAt: now,
  },
];

const tasks = [
  { id: 'demo_task_case', title: 'Montar case de arquitetura (Nubank)', status: 'doing', priority: 'urgente', dueAt: iso(3), appId: 'demo_app_nubank', notes: 'Foco em idempotência e backpressure.' },
  { id: 'demo_task_sql', title: 'Revisar window functions', status: 'todo', priority: 'importante', dueAt: iso(1), appId: 'demo_app_nubank' },
  { id: 'demo_task_followup', title: 'Follow-up com RH do Itaú', status: 'todo', priority: 'importante', dueAt: iso(-1), appId: 'demo_app_itau' },
  { id: 'demo_task_proposta', title: 'Escrever contraproposta para o iFood', status: 'todo', priority: 'urgente', dueAt: iso(2), appId: 'demo_app_ifood' },
  { id: 'demo_task_linkedin', title: 'Atualizar LinkedIn com projetos recentes', status: 'todo', priority: 'baixa', dueAt: '' },
  { id: 'demo_task_curriculo', title: 'Versão em inglês do currículo', status: 'done', priority: 'normal', dueAt: '', completedAt: iso(-3) },
];

const guidelines = [
  {
    id: 'demo_guide_system_design',
    title: 'System Design — roteiro de entrevista',
    language: 'pt',
    body: `# System Design — roteiro\n\n## 1. Entender o problema (5 min)\n- volume, latência, consistência\n- perguntas de clarificação\n\n## 2. Desenhar em alto nível\n- cliente → API → fila → workers → storage\n\n## 3. Aprofundar\n- particionamento\n- idempotência\n- observabilidade\n\n## 4. Trade-offs\n- consistência x disponibilidade\n- custo x latência\n`,
    createdAt: iso(-15),
    updatedAt: now,
  },
  {
    id: 'demo_guide_negociacao',
    title: 'Negociação salarial — script',
    language: 'pt',
    body: `# Negociação salarial\n\n- Nunca dar o primeiro número.\n- Ancorar na faixa de mercado (pesquisa prévia).\n- Pedir o pacote completo: base, bônus, benefícios, equity.\n- Silêncio depois da contraproposta.\n\n> "Considerando o escopo da vaga e minha experiência com X, esperava algo na faixa de Y."\n`,
    createdAt: iso(-10),
    updatedAt: now,
  },
];

const routine = [
  { id: 'demo_rot_1', start: '07:00', end: '08:30', label: 'Foco Total / Tarefas Críticas' },
  { id: 'demo_rot_2', start: '08:30', end: '09:00', label: 'Revisão de E-mails & Comunicação' },
  { id: 'demo_rot_3', start: '09:00', end: '11:00', label: 'Estudo de Guidelines & Preparação' },
  { id: 'demo_rot_4', start: '11:00', end: '12:00', label: 'Avanço em Candidaturas' },
  { id: 'demo_rot_5', start: '13:30', end: '15:30', label: 'Execução de Testes / Entrevistas' },
  { id: 'demo_rot_6', start: '15:30', end: '17:00', label: 'Follow-ups & Fechamento do Dia' },
];

const emails = [
  {
    id: 'demo_mail_1',
    subject: 'Case técnico — Nubank',
    from: 'ana.recrutamento@nubank.com.br',
    date: iso(-1),
    company: 'Nubank',
    priority: 'urgente',
    summary: 'Envio do enunciado do case de arquitetura, prazo de 5 dias.',
    suggestedAction: 'Bloquear 2h na rotina de estudo e responder confirmando o prazo.',
  },
  {
    id: 'demo_mail_2',
    subject: 'Proposta — iFood',
    from: 'talentos@ifood.com.br',
    date: iso(-2),
    company: 'iFood',
    priority: 'importante',
    summary: 'Proposta formal com prazo de resposta até sexta.',
    suggestedAction: 'Comparar com a faixa de mercado e preparar contraproposta.',
  },
];

const put = (type, data) => api('/api/records', { method: 'POST', body: JSON.stringify({ type, data }) });

for (const app of applications) await put('application', app);
for (const task of tasks) await put('task', { ...task, createdAt: now, updatedAt: now, dueAt: task.dueAt || '' });
for (const guide of guidelines) await put('guideline', guide);
for (const slot of routine) await put('routine', { ...slot, createdAt: now, updatedAt: now });
await api('/api/bag', {
  method: 'POST',
  body: JSON.stringify({ emails, calendarEvents: [], driveFiles: [] }),
});

const final = (await api('/api/state')).state;
console.log(`Semeado: ${final.applications.length} candidatura(s), ${final.tasks.length} tarefa(s), ` +
  `${final.guidelines.length} guideline(s), ${final.routine.length} bloco(s) de rotina, ${final.emails.length} e-mail(s).`);
