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

export function render(root) {
  const state = getState();
  const s = stats();
  const week = getWeekDays();
  const cards = buildCards(state);

  const activeCardIndex = Math.min(render.index || 0, cards.length - 1);
  render.index = activeCardIndex;

  const currentCard = cards[activeCardIndex];
  const prevCard = cards[(activeCardIndex - 1 + cards.length) % cards.length];
  const nextCard = cards[(activeCardIndex + 1) % cards.length];

  const overdue = state.tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date()).length;
  const vaultNote = state.vault?.notes ?? 0;
  const modeLabel = state.sync.mode === 'vault' ? 'Vault' : 'Local';

  root.innerHTML = `
    <div class="home-os-stage">
      <section class="home-top-bar">
        <div class="calendar-capsule">
          ${week.map(d => `
            <button type="button" class="cal-day-btn ${d.isToday ? 'is-selected' : ''}" data-day="${d.key}">
              <span class="day-label">${d.dayName}</span>
              <strong class="day-number">${d.dayNum}</strong>
              ${d.isToday ? '<span class="day-dot"></span>' : ''}
            </button>
          `).join('')}
        </div>

        <div class="quick-status-capsule">
          <div class="status-item" data-nav="tasks" title="Tarefas abertas e atrasadas">
            <span class="status-icon">${overdue ? '⚠' : '✓'}</span>
            <div>
              <strong>${overdue ? 'Atrasadas' : 'Em dia'}</strong>
              <small>${s.openTasks} abertas${overdue ? ` · ${overdue} atrasada(s)` : ''}</small>
            </div>
          </div>
          <div class="status-divider"></div>
          <div class="status-item" data-nav="settings" title="Modo de armazenamento">
            <span class="status-icon">${state.sync.mode === 'vault' ? '🗄' : '💾'}</span>
            <div>
              <strong>${modeLabel}</strong>
              <small>${state.sync.mode === 'vault' ? `${vaultNote} nota(s)` : 'só neste navegador'}</small>
            </div>
          </div>
        </div>

        <button class="feed-toggle-btn" data-nav="ai" title="Abrir o agente Hermes">
          <span>✨</span> Agente
        </button>
      </section>

      <section class="workspace-theatre" id="workspaceTheatre">
        <button class="theatre-arrow theatre-arrow-prev" data-card="prev" aria-label="Card anterior">‹</button>

        <div class="theatre-rail">
          <article class="theatre-card slot-n1" data-card="prev" style="background-image: url('${prevCard.bg}');">
            <div class="card-overlay">
              <span class="card-kicker">${esc(prevCard.category)}</span>
              <h3>${esc(prevCard.title)}</h3>
            </div>
          </article>

          <article class="theatre-card is-active" aria-current="true" style="background-image: url('${currentCard.bg}');">
            <div class="card-backdrop-gradient"></div>
            <div class="feed-cover-content">
              <div class="feed-top-row">
                <span class="feed-mark">HOD / FEED</span>
                <span class="feed-counter">0${activeCardIndex + 1} / 0${cards.length}</span>
              </div>
              <div class="feed-category"><span>${esc(currentCard.category)}</span></div>
              <h2 class="feed-headline">${esc(currentCard.title)}</h2>
              <p class="feed-summary">${esc(currentCard.desc)}</p>

              <div class="feed-bottom-row">
                <button class="feed-action-btn" data-nav="${esc(currentCard.nav)}">${esc(currentCard.actionText)} →</button>
                <span class="feed-meta-time">● ${esc(currentCard.time)}</span>
              </div>
            </div>
          </article>

          <article class="theatre-card slot-1" data-card="next" style="background-image: url('${nextCard.bg}');">
            <div class="card-overlay">
              <span class="card-kicker">${esc(nextCard.category)}</span>
              <h3>${esc(nextCard.title)}</h3>
            </div>
          </article>
        </div>

        <button class="theatre-arrow theatre-arrow-next" data-card="next" aria-label="Próximo card">›</button>
      </section>
    </div>
  `;

  const go = delta => {
    render.index = (activeCardIndex + delta + cards.length) % cards.length;
    render(root);
  };

  root.querySelectorAll('[data-card="prev"]').forEach(el => el.addEventListener('click', () => go(-1)));
  root.querySelectorAll('[data-card="next"]').forEach(el => el.addEventListener('click', () => go(1)));

  root.querySelectorAll('.cal-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day;
      const todayKey = toDateInput(new Date());
      if (day === todayKey) return;
      location.hash = '#/tasks';
    });
  });
}
