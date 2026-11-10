/* ============================================================
   views/home.js — Home com Carrossel Central (Theatre Cards)
   100% fiel ao EasyMachineAI HQ com wallpapers temáticos reais
   ============================================================ */
import { esc, toDateInput, parseDate } from '../ui.js';
import { getState, stats } from '../store.js';

export const meta = { kicker: 'Home', title: 'Home' };

function dayKey(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return toDateInput(d);
}

function getWeekDays() {
  const hoje = new Date();
  const diasSem = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dias = [];
  // Gera -2 até +4 em relação ao dia de hoje
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

// Cards da esteira do Carrossel Central (Theatre Cards)
const THEATRE_CARDS = [
  {
    id: 'northstar',
    category: 'Projeto · Seu Espaço',
    title: 'Northstar walkthrough is the launch dependency',
    desc: 'Alinhar as diretrizes de qualificação e testes para os projetos ativos no pipeline.',
    bg: 'theme-1/feed.webp',
    actionText: 'Abrir projeto',
    nav: 'pipeline',
    time: 'Hoje · 14h',
  },
  {
    id: 'handoffs',
    category: 'Processo · Candidatura',
    title: 'The hidden cost of unclear handoffs',
    desc: 'Revisar retornos de e-mail e status de qualificação nas empresas prioritárias.',
    bg: 'theme-1/today.webp',
    actionText: 'Ver processos',
    nav: 'apps',
    time: 'Nov 9',
  },
  {
    id: 'review',
    category: 'Auditoria · Tarefas',
    title: 'Weekly cadence review & pipeline status',
    desc: '3 ações pendentes exigem atenção para desbloquear próximas etapas.',
    bg: 'theme-1/projects.webp',
    actionText: 'Ver tarefas',
    nav: 'tasks',
    time: 'Urgente',
  },
  {
    id: 'metrics',
    category: 'Desempenho · Métricas',
    title: 'Candidate pipeline conversion rate',
    desc: 'Acompanhar a evolução das candidaturas até a etapa de contratação ativa.',
    bg: 'theme-1/metrics.webp',
    actionText: 'Ver métricas',
    nav: 'pipeline',
    time: 'Semanal',
  },
  {
    id: 'workflows',
    category: 'Automações · Rotina',
    title: 'Daily scheduled sync & job radar',
    desc: 'Rotina diária de checagem de vagas, testes e alertas ativados.',
    bg: 'theme-1/workflows.webp',
    actionText: 'Ver rotina',
    nav: 'study',
    time: '1 agendada',
  }
];

let activeCardIndex = 0;

export function render(root) {
  const state = getState();
  const s = stats();
  const week = getWeekDays();
  const currentCard = THEATRE_CARDS[activeCardIndex];

  // Identifica cards vizinhos para renderizar na lateral da esteira 3D
  const prevIndex = (activeCardIndex - 1 + THEATRE_CARDS.length) % THEATRE_CARDS.length;
  const nextIndex = (activeCardIndex + 1) % THEATRE_CARDS.length;
  const prevCard = THEATRE_CARDS[prevIndex];
  const nextCard = THEATRE_CARDS[nextIndex];

  root.innerHTML = `
    <div class="home-os-stage">
      <!-- CALENDAR STRIP NO ESTILO PÍLULA CINZA ESCURO DA REFERÊNCIA -->
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
          <div class="status-item" data-nav="apps" title="Ações que precisam da sua atenção">
            <span class="status-icon">✉</span>
            <div>
              <strong>Needs you</strong>
              <small>${s.openTasks || 3} items</small>
            </div>
          </div>
          <div class="status-divider"></div>
          <div class="status-item" data-nav="study" title="Rotinas e automações agendadas">
            <span class="status-icon">▷</span>
            <div>
              <strong>Automations</strong>
              <small>1 scheduled</small>
            </div>
          </div>
        </div>

        <button class="feed-toggle-btn" title="Feed ligado">
          <span>📰</span> Feed on
        </button>
      </section>

      <!-- CARROSSEL CENTRAL THEATRE CARDS COM WALLPAPERS REAIS -->
      <section class="workspace-theatre" id="workspaceTheatre">
        <!-- Seta Anterior -->
        <button class="theatre-arrow theatre-arrow-prev" id="theatrePrev" aria-label="Card anterior">
          ‹
        </button>

        <!-- Trilha 3D de Cards -->
        <div class="theatre-rail">
          <!-- Card Lateral Esquerdo -->
          <article class="theatre-card slot-n1" style="background-image: url('${prevCard.bg}');">
            <div class="card-overlay">
              <span class="card-kicker">${esc(prevCard.category)}</span>
              <h3>${esc(prevCard.title)}</h3>
            </div>
          </article>

          <!-- Card Central Ativo (Hero) -->
          <article class="theatre-card is-active" aria-current="true" style="background-image: url('${currentCard.bg}');">
            <div class="card-backdrop-gradient"></div>
            <div class="feed-cover-content">
              <div class="feed-top-row">
                <span class="feed-mark">HOD / FEED</span>
                <span class="feed-counter">0${activeCardIndex + 1} / 0${THEATRE_CARDS.length}</span>
              </div>
              <div class="feed-category">
                <span>${esc(currentCard.category)}</span>
              </div>
              <h2 class="feed-headline">${esc(currentCard.title)}</h2>
              <p class="feed-summary">${esc(currentCard.desc)}</p>

              <div class="feed-bottom-row">
                <button class="feed-action-btn" data-nav="${currentCard.nav}">
                  ${esc(currentCard.actionText)} →
                </button>
                <span class="feed-meta-time">● ${esc(currentCard.time)}</span>
              </div>
            </div>
          </article>

          <!-- Card Lateral Direito -->
          <article class="theatre-card slot-1" style="background-image: url('${nextCard.bg}');">
            <div class="card-overlay">
              <span class="card-kicker">${esc(nextCard.category)}</span>
              <h3>${esc(nextCard.title)}</h3>
            </div>
          </article>
        </div>

        <!-- Seta Próximo -->
        <button class="theatre-arrow theatre-arrow-next" id="theatreNext" aria-label="Próximo card">
          ›
        </button>
      </section>
    </div>
  `;

  // Event Listeners dos controles do Carrossel
  root.querySelector('#theatrePrev')?.addEventListener('click', () => {
    activeCardIndex = (activeCardIndex - 1 + THEATRE_CARDS.length) % THEATRE_CARDS.length;
    render(root);
  });

  root.querySelector('#theatreNext')?.addEventListener('click', () => {
    activeCardIndex = (activeCardIndex + 1) % THEATRE_CARDS.length;
    render(root);
  });

  // Clique nos cards laterais para avançar/voltar
  root.querySelector('.slot-n1')?.addEventListener('click', () => {
    activeCardIndex = (activeCardIndex - 1 + THEATRE_CARDS.length) % THEATRE_CARDS.length;
    render(root);
  });

  root.querySelector('.slot-1')?.addEventListener('click', () => {
    activeCardIndex = (activeCardIndex + 1) % THEATRE_CARDS.length;
    render(root);
  });
}
