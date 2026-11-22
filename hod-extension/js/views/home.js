/* ============================================================
   views/home.js — Home com Carrossel 3D e Navegação por Subpastas
   Inspirado no Easy Machine AI HQ:
   Nível 1: Carrossel Hero Central com Cover Flow 3D interativo
   Nível 2: Banner Superior Compacto + Grid de Subpastas com 3 Métricas
   ============================================================ */
import { esc, toDateInput } from '../ui.js';
import { getState, stats } from '../store.js';

export const meta = { kicker: 'Home', title: 'Home' };

/* Armazena o índice do slide ativo na Home para persistência durante a navegação */
let activeSlideIndex = 0;

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

function getAreasData(state) {
  const apps = state.applications || [];
  const tasks = state.tasks || [];
  const emails = state.emails || [];
  const guidelines = state.guidelines || [];
  const routine = state.routine || [];

  const urgentTasks = tasks.filter(t => t.status !== 'done' && t.priority === 'urgente').length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date()).length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const openTasks = tasks.filter(t => t.status !== 'done').length;

  const appliedApps = apps.filter(a => a.stage === 'aplicado').length;
  const certApps = apps.filter(a => a.stage === 'em_certificacao').length;
  const approvedApps = apps.filter(a => a.stage === 'aprovado').length;
  const activeApps = apps.filter(a => a.stage !== 'encerrado' && a.stage !== 'reprovado').length;
  // Mantém as métricas de projetos compatíveis com os estágios atuais e
  // legados, sem supor que todos os vaults já foram migrados.
  const interviewApps = apps.filter(a => ['entrevista', 'em_certificacao'].includes(a.stage)).length;
  const offerApps = apps.filter(a => ['proposta', 'aprovado'].includes(a.stage)).length;
  const totalOpps = (state.opportunities || []).length;

  return [
    {
      id: 'vagas',
      category: 'OPORTUNIDADES & CARREIRA',
      title: 'Oportunidades & Aplicações',
      desc: 'Varredura diária de vagas, triagem de oportunidades e Kanban de 5 etapas das aplicações.',
      bg: 'theme-1/projects.webp',
      badge: `${activeApps} ativas`,
      subfolders: [
        {
          id: 'vagas-remotas',
          title: 'Oportunidades Identificadas',
          desc: 'Vagas mapeadas pelos coletores automáticos prontas para inscrição.',
          thumb: 'theme-1/projects.webp',
          nav: 'apps',
          metrics: [
            { val: totalOpps, label: 'Oportunidades' },
            { val: appliedApps, label: 'Aplicadas' },
            { val: activeApps, label: 'Em andamento' },
          ],
        },
        {
          id: 'processos-ativos',
          title: 'Aplicações em Andamento',
          desc: 'Kanban estrito: Aplicado, Em Certificação, Aprovado, Reprovado e Encerrado.',
          thumb: 'theme-1/feed.webp',
          nav: 'apps',
          metrics: [
            { val: appliedApps, label: 'Aplicadas' },
            { val: certApps, label: 'Certificação' },
            { val: approvedApps, label: 'Aprovadas' },
          ],
        },
        {
          id: 'followups-vagas',
          title: 'Tarefas de Candidatura',
          desc: 'Follow-ups, envios de currículo e tarefas vinculadas aos seus processos.',
          thumb: 'theme-1/today.webp',
          nav: 'tasks',
          metrics: [
            { val: urgentTasks, label: 'Urgentes' },
            { val: openTasks, label: 'Pendentes' },
            { val: overdueTasks, label: 'Atrasadas' },
          ],
        },
      ],
    },
    {
      id: 'tarefas',
      category: 'EXECUÇÃO OPERACIONAL',
      title: 'Tarefas Diárias',
      desc: 'Quadro Kanban com prioridades, prazos, checklists e foco nas entregas do dia.',
      bg: 'theme-1/today.webp',
      badge: `${openTasks} pendentes`,
      subfolders: [
        {
          id: 'urgentes-dia',
          title: 'Foco de Hoje & Urgentes',
          desc: 'Prioridades críticas que exigem atenção imediata e conclusão hoje.',
          thumb: 'theme-1/today.webp',
          nav: 'tasks',
          metrics: [
            { val: urgentTasks, label: 'Urgentes' },
            { val: overdueTasks, label: 'Atrasadas' },
            { val: openTasks, label: 'Abertas' },
          ],
        },
        {
          id: 'backlog-geral',
          title: 'Backlog Geral',
          desc: 'Tarefas importantes, rotineiras e backlog de melhorias organizadas por lista.',
          thumb: 'theme-1/workflows.webp',
          nav: 'tasks',
          metrics: [
            { val: tasks.filter(t => t.priority === 'importante' && t.status !== 'done').length, label: 'Importantes' },
            { val: tasks.filter(t => t.priority === 'normal' && t.status !== 'done').length, label: 'Normais' },
            { val: tasks.filter(t => t.priority === 'baixa' && t.status !== 'done').length, label: 'Baixa' },
          ],
        },
        {
          id: 'tarefas-feitas',
          title: 'Concluídas & Histórico',
          desc: 'Registro e histórico de tarefas finalizadas para balanço de produtividade.',
          thumb: 'theme-1/metrics.webp',
          nav: 'tasks',
          metrics: [
            { val: doneTasks, label: 'Concluídas' },
            { val: tasks.length, label: 'Total criadas' },
            { val: tasks.length ? Math.round((doneTasks / tasks.length) * 100) + '%' : '0%', label: 'Taxa entrega' },
          ],
        },
      ],
    },
    {
      id: 'projetos',
      category: 'PROJETOS & FREELAS',
      title: 'Projetos e Clientes',
      desc: 'Central de projetos paralelos, freelas, entregáveis e prospecção de demandas.',
      bg: 'theme-1/workflows.webp',
      badge: 'Fluxo ativo',
      subfolders: [
        {
          id: 'prospeccao-projetos',
          title: 'Prospecção & Oportunidades',
          desc: 'Demandas identificadas em plataformas e contatos para prestação de serviços.',
          thumb: 'theme-1/workflows.webp',
          nav: 'apps',
          metrics: [
            { val: activeApps, label: 'Oportunidades' },
            { val: interviewApps, label: 'Alinhamentos' },
            { val: offerApps, label: 'Fechamentos' },
          ],
        },
        {
          id: 'entregas-projetos',
          title: 'Demandas & Entregáveis',
          desc: 'Tarefas operacionais específicas de desenvolvimento e suporte técnico.',
          thumb: 'theme-1/today.webp',
          nav: 'tasks',
          metrics: [
            { val: openTasks, label: 'Tarefas ativas' },
            { val: urgentTasks, label: 'Críticas' },
            { val: doneTasks, label: 'Entregues' },
          ],
        },
        {
          id: 'metricas-projetos',
          title: 'Métricas de Entrega',
          desc: 'Acompanhamento de conversão, produtividade e ritmo do seu portfólio.',
          thumb: 'theme-1/metrics.webp',
          nav: 'metrics',
          metrics: [
            { val: doneTasks, label: 'Itens prontos' },
            { val: activeApps, label: 'Projetos' },
            { val: '100%', label: 'Disponibilidade' },
          ],
        },
      ],
    },
    {
      id: 'correspondencias',
      category: 'COMUNICAÇÃO LOCAL',
      title: 'Correspondências & Inbox',
      desc: 'Resumos inteligentes de e-mails, retornos de empresas e follow-ups pendentes.',
      bg: 'theme-1/feed.webp',
      badge: `${emails.length} mensagens`,
      subfolders: [
        {
          id: 'inbox-local',
          title: 'Caixa de Entrada Sincronizada',
          desc: 'Mensagens importadas localmente no vault com leitura sem distrações.',
          thumb: 'theme-1/feed.webp',
          nav: 'email',
          metrics: [
            { val: emails.length, label: 'Mensagens' },
            { val: emails.filter(e => e.unread).length || emails.length, label: 'Importadas' },
            { val: 'Local', label: 'Modo seguro' },
          ],
        },
        {
          id: 'followups-email',
          title: 'Resumos por Empresa',
          desc: 'Linha do tempo consolidada das conversas com cada recrutador ou cliente.',
          thumb: 'theme-1/content.webp',
          nav: 'email',
          metrics: [
            { val: new Set(emails.map(e => e.company || e.from).filter(Boolean)).size || activeApps, label: 'Empresas' },
            { val: emails.length, label: 'Interações' },
            { val: '0', label: 'Spam' },
          ],
        },
        {
          id: 'pendencias-resposta',
          title: 'Pendências de Ação',
          desc: 'E-mails que necessitam de resposta ou agendamento de chamada técnica.',
          thumb: 'theme-1/today.webp',
          nav: 'tasks',
          metrics: [
            { val: urgentTasks, label: 'Respostas' },
            { val: openTasks, label: 'Agendamentos' },
            { val: overdueTasks, label: 'Atrasos' },
          ],
        },
      ],
    },
    {
      id: 'guidelines',
      category: 'ESTUDO & DOCUMENTAÇÃO',
      title: 'Formação & Guidelines',
      desc: 'Biblioteca viva de documentações, diretrizes de projetos e anotações de estudo.',
      bg: 'theme-1/content.webp',
      badge: `${guidelines.length} notas`,
      subfolders: [
        {
          id: 'biblioteca-guias',
          title: 'Biblioteca de Guidelines',
          desc: 'Orientações oficiais de avaliação, critérios de qualidade e padrões de código.',
          thumb: 'theme-1/content.webp',
          nav: 'study',
          metrics: [
            { val: guidelines.length, label: 'Documentos' },
            { val: new Set(guidelines.map(g => g.company).filter(Boolean)).size, label: 'Empresas' },
            { val: 'MD', label: 'Formato' },
          ],
        },
        {
          id: 'estudo-ia',
          title: 'Anotações & Prompt Craft',
          desc: 'Resumos sintetizados, guias traduzidos e cadernos de estudos para testes.',
          thumb: 'theme-1/workflows.webp',
          nav: 'study',
          metrics: [
            { val: guidelines.length, label: 'Artigos' },
            { val: 'Local', label: 'Obsidian' },
            { val: 'RAG', label: 'Contexto' },
          ],
        },
        {
          id: 'rotina-estudo',
          title: 'Rotina de Aprendizagem',
          desc: 'Sessões agendadas para leitura e fixação de guidelines antes de testes.',
          thumb: 'theme-1/today.webp',
          nav: 'routine',
          metrics: [
            { val: routine.length, label: 'Blocos' },
            { val: 'Diário', label: 'Ritmo' },
            { val: 'Foco', label: 'Modo' },
          ],
        },
      ],
    },
    {
      id: 'rotina',
      category: 'GESTÃO PESSOAL',
      title: 'Rotina Diária & Foco',
      desc: 'Estruturação de blocos de tempo, ritmo de trabalho sustentável e hábitos diários.',
      bg: 'theme-1/today.webp',
      badge: `${routine.length} blocos`,
      subfolders: [
        {
          id: 'blocos-tempo',
          title: 'Blocos de Tempo & Foco',
          desc: 'Grade horária com distribuição estratégica de turnos de trabalho e pausas.',
          thumb: 'theme-1/today.webp',
          nav: 'routine',
          metrics: [
            { val: routine.length, label: 'Blocos' },
            { val: 'Hoje', label: 'Escopo' },
            { val: 'Ativo', label: 'Status' },
          ],
        },
        {
          id: 'habitos-produtividade',
          title: 'Tarefas de Manutenção',
          desc: 'Checklist matinal e vespertino de organização e limpeza operacional.',
          thumb: 'theme-1/workflows.webp',
          nav: 'tasks',
          metrics: [
            { val: openTasks, label: 'Checklists' },
            { val: doneTasks, label: 'Completos' },
            { val: urgentTasks, label: 'Pendentes' },
          ],
        },
        {
          id: 'metricas-rotina',
          title: 'Desempenho da Semana',
          desc: 'Visualização da consistência e taxa de cumprimento das metas estabelecidas.',
          thumb: 'theme-1/metrics.webp',
          nav: 'metrics',
          metrics: [
            { val: `${doneTasks}`, label: 'Entregas' },
            { val: '100%', label: 'Ritmo' },
            { val: 'Equilíbrio', label: 'Meta' },
          ],
        },
      ],
    },
  ];
}

export function render(root, params = {}) {
  const state = getState();
  const s = stats();
  const week = getWeekDays();
  const overdue = state.tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date()).length;
  const areas = getAreasData(state);

  const selectedArea = params.id ? areas.find(a => a.id === params.id) : null;

  /* Nível 2: Banner Superior Compacto + Grid de Subpastas com 3 Métricas */
  if (selectedArea) {
    root.dataset.crumb = selectedArea.title;
    root.innerHTML = `
      <div class="hub-stage">
        <!-- Banner Compacto Superior -->
        <header class="hub-hero-banner" style="background-image: url('${selectedArea.bg}');">
          <div class="hub-banner-shade"></div>
          <div class="hub-banner-content">
            <div class="hub-banner-meta">
              <button class="hub-back-btn" data-nav="home" title="Voltar para a Home">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span>Voltar</span>
              </button>
              <span class="hub-badge">${esc(selectedArea.category)}</span>
            </div>
            <h1 class="hub-banner-title">${esc(selectedArea.title)}</h1>
            <p class="hub-banner-desc">${esc(selectedArea.desc)}</p>
          </div>
        </header>

        <!-- Grid de Subpastas (Estilo HQ com 3 colunas de métricas) -->
        <section class="hub-subfolders-section" aria-label="Subpastas de ${esc(selectedArea.title)}">
          <div class="hub-subfolders-grid">
            ${selectedArea.subfolders.map((sub, idx) => `
              <article class="subfolder-card" data-nav="${sub.nav}">
                <div class="subfolder-thumb" style="background-image: url('${sub.thumb}');">
                  <span class="subfolder-chip">SUBPASTA 0${idx + 1}</span>
                </div>
                <div class="subfolder-body">
                  <h3 class="subfolder-title">${esc(sub.title)}</h3>
                  <p class="subfolder-desc">${esc(sub.desc)}</p>
                  
                  <div class="subfolder-metrics-row">
                    ${sub.metrics.map(m => `
                      <div class="subfolder-metric-col">
                        <strong class="metric-val">${esc(String(m.val))}</strong>
                        <span class="metric-lbl">${esc(m.label)}</span>
                      </div>
                    `).join('')}
                  </div>

                  <div class="subfolder-footer">
                    <button class="subfolder-enter-btn" data-nav="${sub.nav}">
                      Entrar <em>→</em>
                    </button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    `;
    return;
  }

  /* Nível 1: Home com Carrossel 3D Cover Flow Interativo */
  root.innerHTML = `
    <div class="home-os-stage">
      <!-- Barra superior: status e dias da semana -->
      <section class="home-top-bar">
        <div class="quick-status-capsule">
          <div class="status-item" data-nav="tasks" title="Tarefas diárias">
            <span class="status-icon">${overdue ? '⚠' : '✓'}</span>
            <div>
              <strong>${overdue ? 'Atenção' : 'Em dia'}</strong>
              <small>${s.openTasks} tarefa(s)${overdue ? ` · ${overdue} atrasada(s)` : ''}</small>
            </div>
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

      <!-- Carrossel 3D Cover Flow -->
      <section class="theatre-stage" aria-label="Seções principais">
        <button class="theatre-nav-arrow is-prev" id="theatrePrev" aria-label="Card anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        <div class="theatre-carousel" id="theatreCarousel">
          ${areas.map((area, idx) => `
            <div class="theatre-slide" data-index="${idx}" data-area="${area.id}" style="background-image: url('${area.bg}');">
              <div class="theatre-slide-shade"></div>
              <div class="theatre-slide-content">
                <div class="theatre-slide-top">
                  <span class="theatre-pill">${esc(area.badge)}</span>
                  <span class="theatre-category">${esc(area.category)}</span>
                </div>
                <div class="theatre-slide-bottom">
                  <h2 class="theatre-slide-title">${esc(area.title)}</h2>
                  <p class="theatre-slide-desc">${esc(area.desc)}</p>
                  <button class="theatre-enter-btn" data-nav="hub/${area.id}">
                    Entrar <em>→</em>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <button class="theatre-nav-arrow is-next" id="theatreNext" aria-label="Próximo card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </section>

      <!-- Indicadores de paginação (dots) -->
      <nav class="theatre-dots-row" id="theatreDots" aria-label="Navegação por pontos">
        ${areas.map((_, idx) => `
          <button class="theatre-dot ${idx === activeSlideIndex ? 'is-active' : ''}" data-index="${idx}" aria-label="Ir para o slide ${idx + 1}"></button>
        `).join('')}
      </nav>
    </div>
  `;

  /* Lógica de Navegação do Carrossel 3D */
  const slides = Array.from(root.querySelectorAll('.theatre-slide'));
  const dots = Array.from(root.querySelectorAll('.theatre-dot'));
  const totalSlides = slides.length;

  function updateCarouselPositions() {
    slides.forEach((slide, idx) => {
      slide.classList.remove('is-active', 'slot-prev', 'slot-next', 'slot-hidden');
      const diff = (idx - activeSlideIndex + totalSlides) % totalSlides;

      if (diff === 0) {
        slide.classList.add('is-active');
      } else if (diff === 1 || (idx === 0 && activeSlideIndex === totalSlides - 1)) {
        slide.classList.add('slot-next');
      } else if (diff === totalSlides - 1 || (idx === totalSlides - 1 && activeSlideIndex === 0)) {
        slide.classList.add('slot-prev');
      } else {
        slide.classList.add('slot-hidden');
      }
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === activeSlideIndex);
    });
  }

  function goToSlide(newIndex) {
    activeSlideIndex = (newIndex + totalSlides) % totalSlides;
    updateCarouselPositions();
  }

  // Inicializa posições
  updateCarouselPositions();

  // Setas
  const prevBtn = root.querySelector('#theatrePrev');
  const nextBtn = root.querySelector('#theatreNext');
  prevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToSlide(activeSlideIndex - 1);
  });
  nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToSlide(activeSlideIndex + 1);
  });

  // Dots
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      goToSlide(Number(dot.dataset.index));
    });
  });

  // Clique nos slides laterais centraliza o slide clicado
  slides.forEach(slide => {
    slide.addEventListener('click', (e) => {
      const idx = Number(slide.dataset.index);
      if (idx !== activeSlideIndex) {
        e.preventDefault();
        e.stopPropagation();
        goToSlide(idx);
      } else if (!e.target.closest('.theatre-enter-btn')) {
        // Clicar no slide central ativo abre a área
        const areaId = slide.dataset.area;
        location.hash = `#/hub/${areaId}`;
      }
    });
  });

  // Teclado (setas esquerda e direita)
  const keyHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') goToSlide(activeSlideIndex - 1);
    if (e.key === 'ArrowRight') goToSlide(activeSlideIndex + 1);
  };
  window.addEventListener('keydown', keyHandler);

  // Limpeza de listener ao desmontar
  root.addEventListener('DOMNodeRemoved', () => {
    window.removeEventListener('keydown', keyHandler);
  }, { once: true });
}
