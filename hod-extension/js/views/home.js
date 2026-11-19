/* ============================================================
   views/home.js — Home com Carrossel Central (Theatre Cards)
   Os cards agora são DERIVADOS do estado real: candidaturas,
   tarefas, rotina, guidelines e conexões. Nenhum texto fictício.
   ============================================================ */
import { esc, toDateInput, dueInfo, relativeTime } from '../ui.js';
import { getState, stats, stageById } from '../store.js';

export const meta = { kicker: 'Home', title: 'Home' };

function getWeekDays() {
  const hoje = new Date();
  const diasSem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dias = [];
  for (let i = -2; i <= 4; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    dias.push({
      key: toDateInput(d),
      dayName: diasSem[d.getDay()],
      dayNum: String(d.getDate()).padStart(2, '0'),
      isToday: i === 0,
    });
  }
  return dias;
}

/* ---------- construção dos cards a partir do estado ---------- */
function buildCards(state) {
  const cards = [];
  const apps = state.applications || [];
  const tasks = state.tasks || [];

  /* 1. candidatura mais urgente (prazo mais próximo entre as ativas) */
  const active = apps
    .filter(a => a.stage !== 'encerrada')
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
  const focus = active[0];
  if (focus) {
    const info = dueInfo(focus.deadline);
    cards.push({
      id: 'focus-app',
      category: `Processo · ${stageById(focus.stage).name}`,
      title: `${focus.company}${focus.role ? ' — ' + focus.role : ''}`,
      desc: focus.nextAction || 'Defina a próxima ação desta candidatura para não perder o ritmo.',
      bg: 'theme-1/feed.webp',
      actionText: 'Abrir processo',
      nav: `apps/${focus.id}`,
      time: info ? info.text : 'sem prazo',
    });
  }

  /* 2. tarefa mais urgente em aberto */
  const openTasks = tasks.filter(t => t.status !== 'done');
  const urgentTask = [...openTasks].sort((a, b) => {
    const pa = ['urgente', 'importante', 'normal', 'baixa'].indexOf(a.priority);
    const pb = ['urgente', 'importante', 'normal', 'baixa'].indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return da - db;
  })[0];
  if (urgentTask) {
    const info = dueInfo(urgentTask.dueAt);
    cards.push({
      id: 'urgent-task',
      category: `Prioridade · ${urgentTask.priority}`,
      title: urgentTask.title,
      desc: urgentTask.notes || urgentTask.appLabel || 'Tarefa aberta na sua lista — abra para editar ou concluir.',
      bg: 'theme-1/today.webp',
      actionText: 'Ver tarefas',
      nav: 'tasks',
      time: info ? info.text : 'sem prazo',
    });
  }

  /* 3. pipeline consolidado */
  const byStage = {};
  for (const a of apps) byStage[a.stage] = (byStage[a.stage] || 0) + 1;
  cards.push({
    id: 'pipeline',
    category: 'Pipeline · Funil',
    title: apps.length
      ? `${apps.length} candidatura(s) em ${Object.keys(byStage).length} etapa(s)`
      : 'Comece mapeando suas candidaturas',
    desc: apps.length
      ? `Teste: ${byStage.teste || 0} · Entrevista: ${byStage.entrevista || 0} · Proposta: ${byStage.proposta || 0} · Ativa: ${byStage.ativa || 0}`
      : 'Cadastre a primeira vaga para o funil começar a acompanhar prazos e etapas.',
    bg: 'theme-1/projects.webp',
    actionText: 'Abrir pipeline',
    nav: 'pipeline',
    time: `${openTasks.length} tarefa(s) aberta(s)`,
  });

  /* 4. rotina do dia */
  const slots = state.routine || [];
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const toMin = hhmm => {
    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const current = slots.find(s => nowMin >= toMin(s.start) && nowMin < toMin(s.end));
  const nextSlot = slots.find(s => toMin(s.start) > nowMin);
  cards.push({
    id: 'routine',
    category: 'Rotina · Bloco atual',
    title: current ? current.label : nextSlot ? `Próximo: ${nextSlot.label}` : 'Rotina do dia concluída',
    desc: current
      ? `Bloco ${current.start} — ${current.end} em andamento.`
      : nextSlot
        ? `Começa às ${nextSlot.start}.`
        : `${slots.length} bloco(s) configurado(s) para a rotina.`,
    bg: 'theme-1/workflows.webp',
    actionText: 'Ver rotina',
    nav: 'routine',
    time: current ? `${current.start} — ${current.end}` : nextSlot ? `às ${nextSlot.start}` : 'livre',
  });

  /* 5. biblioteca de guidelines */
  const guides = state.guidelines || [];
  cards.push({
    id: 'guides',
    category: 'Estudo · Biblioteca',
    title: guides.length ? `${guides.length} guideline(s) no vault` : 'Nenhuma guideline ainda',
    desc: guides.length
      ? `Última: ${guides[0].title}${guides[0].updatedAt ? ` · ${relativeTime(guides[0].updatedAt)}` : ''}`
      : 'Cole as orientações das empresas para estudar e pedir tradução ao agente.',
    bg: 'theme-1/content.webp',
    actionText: 'Abrir estudo',
    nav: 'study',
    time: guides.length ? `${guides.length} nota(s)` : 'vazio',
  });

  /* 6. métricas */
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  cards.push({
    id: 'metrics',
    category: 'Desempenho · Métricas',
    title: 'Conversão e ritmo do seu funil',
    desc: `${doneTasks} tarefa(s) concluída(s) · ${apps.length} candidatura(s) · ${state.emails.length} e-mail(s) analisado(s).`,
    bg: 'theme-1/metrics.webp',
    actionText: 'Ver métricas',
    nav: 'metrics',
    time: 'tempo real',
  });

  return cards;
}

const AREAS = [
  { id: 'vagas', title: 'Vagas e candidaturas', desc: 'Oportunidades, prioridades e processos em andamento.', bg: 'theme-1/projects.webp', items: [['Candidaturas', 'apps'], ['Tarefas de candidatura', 'tasks'], ['Correspondências', 'email']] },
  { id: 'projetos', title: 'Projetos e freelas', desc: 'Organize oportunidades de projeto e próximas ações.', bg: 'theme-1/workflows.webp', items: [['Oportunidades coletadas', 'apps'], ['Tarefas abertas', 'tasks'], ['Métricas', 'metrics']] },
  { id: 'correspondencias', title: 'Correspondências', desc: 'Resumos por empresa e pendências de resposta.', bg: 'theme-1/feed.webp', items: [['Caixa de acompanhamento', 'email'], ['Follow-ups', 'tasks'], ['Candidaturas', 'apps']] },
  { id: 'guidelines', title: 'Guidelines', desc: 'Biblioteca organizada por empresa e projeto.', bg: 'theme-1/content.webp', items: [['Biblioteca', 'study'], ['Importar documento', 'study'], ['Rotina de estudo', 'routine']] },
  { id: 'rotina', title: 'Rotina', desc: 'Planeje o dia, conclua tarefas e acompanhe o ritmo.', bg: 'theme-1/today.webp', items: [['Rotina diária', 'routine'], ['Tarefas', 'tasks'], ['Desempenho', 'metrics']] },
];

export function render(root, params = {}) {
  const state = getState();
  const s = stats();
  const week = getWeekDays();
  const overdue = state.tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date()).length;
  const apps = state.applications || [];
  const tasks = state.tasks || [];
  const emails = state.emails || [];
  const priorities = ['urgente', 'importante', 'normal', 'baixa'];
  const labels = { urgente: 'Urgente', importante: 'Importante', normal: 'Normal', baixa: 'Baixa' };
  const openTasks = tasks.filter(task => task.status !== 'done');

  const area = AREAS.find(item => item.id === params.id);
  const hierarchy = area ? `
    <section class="hub-area" style="background-image:url('${area.bg}')">
      <div class="hub-area-shade"></div><div class="hub-area-content">
        <button class="hub-back" data-nav="home">← Todas as áreas</button>
        <span>ÁREA OPERACIONAL</span><h2>${esc(area.title)}</h2><p>${esc(area.desc)}</p>
        <div class="hub-subcards">${area.items.map(([label, nav], index) => `<button data-nav="${nav}" class="hub-subcard"><small>SUBÁREA ${String(index + 1).padStart(2, '0')}</small><strong>${esc(label)}</strong><i>→</i></button>`).join('')}</div>
      </div>
    </section>` : `
    <section class="workspace-theatre" aria-label="Áreas operacionais">
      <div class="theatre-rail">${AREAS.map((item, index) => `<button class="theatre-card ${index === 0 ? 'is-active' : index === 1 ? 'slot-1' : 'slot-n1'}" data-nav="hub/${item.id}" style="background-image:url('${item.bg}')"><span class="card-backdrop-gradient"></span><span class="feed-cover-content"><span class="feed-category">ÁREA ${String(index + 1).padStart(2, '0')}</span><strong class="feed-headline">${esc(item.title)}</strong><span class="feed-summary">${esc(item.desc)}</span><span class="feed-bottom-row"><b class="feed-action-btn">Explorar <em>→</em></b></span></span></button>`).join('')}</div>
      <p class="hub-hint">Selecione uma área para revelar suas subáreas.</p>
    </section>`;

  root.innerHTML = `
    <div class="home-os-stage">
      <section class="home-top-bar">
        <div class="quick-status-capsule">
          <div class="status-item" data-nav="tasks" title="Tarefas diárias">
            <span class="status-icon">${overdue ? '⚠' : '✓'}</span>
            <div><strong>${overdue ? 'Pendências' : 'Em dia'}</strong><small>${s.openTasks} tarefa(s) aberta(s)${overdue ? ` · ${overdue} atrasada(s)` : ''}</small></div>
          </div>
        </div>
        <div class="calendar-capsule">
          ${week.map(d => `
            <button type="button" class="cal-day-btn ${d.isToday ? 'is-selected' : ''}" data-day="${d.key}">
              <span class="day-label">${d.dayName}</span>
              <strong class="day-number">${d.dayNum}</strong>
              ${d.isToday ? '<span class="day-dot"></span>' : ''}
            </button>
          `).join('')}
        </div>

        <button class="feed-toggle-btn" data-action="open-agent" title="Abrir agente">
          <span>✨</span> Agente
        </button>
      </section>

      <section class="home-summary" style="background-image:url('theme-1/metrics.webp');">
        <div class="home-summary-shade"></div>
        <div class="summary-content">
          <div class="summary-heading"><span>VISÃO GERAL</span><h2>Seu painel de hoje</h2><p>${apps.length} candidatura(s), ${openTasks.length} tarefa(s) aberta(s) e ${emails.length} correspondência(s) acompanhada(s).</p></div>
          <div class="summary-grid">
            <button class="summary-card" data-nav="apps"><strong>${apps.filter(app => app.stage !== 'encerrada').length}</strong><span>Candidaturas ativas</span></button>
            <button class="summary-card" data-nav="tasks"><strong>${openTasks.length}</strong><span>Tarefas abertas</span></button>
            <button class="summary-card" data-nav="email"><strong>${emails.length}</strong><span>Correspondências</span></button>
            <button class="summary-card" data-nav="tasks"><strong>${overdue}</strong><span>Atrasadas</span></button>
          </div>
          <div class="priority-bars">${priorities.map(priority => { const count = apps.filter(app => app.priority === priority && app.stage !== 'encerrada').length; const width = apps.length ? Math.max(5, Math.round(count / apps.length * 100)) : 0; return `<button data-nav="apps" class="priority-line"><span>${labels[priority]}</span><i><b style="width:${width}%"></b></i><em>${count}</em></button>`; }).join('')}</div>
        </div>
      </section>
      ${hierarchy}
    </div>
  `;

  root.querySelectorAll('.cal-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day;
      const todayKey = toDateInput(new Date());
      if (day === todayKey) return;
      location.hash = '#/tasks';
    });
  });
}
