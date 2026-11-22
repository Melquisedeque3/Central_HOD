/* ============================================================
   views/apps.js — Candidaturas: Oportunidades & Aplicações
   
   Aba 1 — Oportunidades:
   • Vagas e projetos identificados pelos coletores autorizados
   • Botão "Aplicado": confirma inscrição, converte para candidatura e abre para edição
   • Botão "Remover": descarta oportunidade desinteressante
   • Filtros por empresa, plataforma/fonte e situação
   
   Aba 2 — Aplicações:
   • Candidaturas efetivamente realizadas
   • Kanban estrito de 5 colunas: Aplicado → Em Certificação → Aprovado → Reprovado → Encerrado
   • Validação de transições no frontend e backend (com correção administrativa documentada)
   • Sincronização automática com a tarefa principal
   ============================================================ */
import { esc, emptyState, fmtDate, priorityDot, progressBar, toast, confirmAction } from '../ui.js';
import {
  getState, STAGES, PRIORITIES, stageById, canTransition,
  updateApplication, moveApplication, convertOpportunityAction, deleteApplication,
} from '../store.js';
import { uiState } from '../state.js';
import { deadlineChip } from '../components.js';
import { openAppModal, openOpportunityModal } from './modals.js';
import * as api from '../api.js';

export const meta = { kicker: 'Candidaturas', title: 'Oportunidades & Aplicações' };

export function render(root) {
  const state = getState();
  const f = uiState.apps;
  const activeTab = f.tab || 'aplicacoes';

  const allApps = state.applications || [];
  const allOpps = state.opportunities || [];

  root.innerHTML = `
    <!-- Seletor de abas principais -->
    <div style="display:flex;gap:4px;padding:4px 0 16px;border-bottom:1px solid var(--line);margin-bottom:20px;">
      <button class="dock-tab ${activeTab === 'oportunidades' ? 'is-active' : ''}" data-apps-tab="oportunidades"
        style="padding:9px 18px;border:none;background:transparent;color:${activeTab === 'oportunidades' ? 'var(--ink)' : 'var(--muted-2)'};font-size:14px;font-weight:${activeTab === 'oportunidades' ? '600' : '400'};cursor:pointer;border-bottom:2px solid ${activeTab === 'oportunidades' ? 'var(--accent)' : 'transparent'};">
        🎯 Oportunidades <span class="chip tiny" style="margin-left:6px;background:rgba(255,255,255,0.06);">${allOpps.filter(o => o.status !== 'discarded').length}</span>
      </button>
      <button class="dock-tab ${activeTab === 'aplicacoes' ? 'is-active' : ''}" data-apps-tab="aplicacoes"
        style="padding:9px 18px;border:none;background:transparent;color:${activeTab === 'aplicacoes' ? 'var(--ink)' : 'var(--muted-2)'};font-size:14px;font-weight:${activeTab === 'aplicacoes' ? '600' : '400'};cursor:pointer;border-bottom:2px solid ${activeTab === 'aplicacoes' ? 'var(--accent)' : 'transparent'};">
        📋 Aplicações (Kanban) <span class="chip tiny" style="margin-left:6px;background:rgba(255,255,255,0.06);">${allApps.length}</span>
      </button>
    </div>

    ${activeTab === 'oportunidades' ? renderOportunidades(allOpps, f) : renderAplicacoes(allApps, f)}
  `;

  wire(root, { activeTab, allApps, allOpps });
}

/* ============================================================
   Aba 1: Oportunidades
   ============================================================ */
function renderOportunidades(opps, f) {
  const q = (f.oppQ || '').toLowerCase();
  const source = f.oppSource || '';
  const status = f.oppStatus || '';
  const queue = f.oppQueue || '';
  const queueOf = opp => opp.reviewQueue || ({ ELIGIBLE: 'eligible', INCONCLUSIVE: 'verification', INELIGIBLE: 'incompatible' }[opp.eligibilityStatus] || '');
  const queues = [
    { id: '', label: 'Todas' },
    { id: 'eligible', label: 'Elegíveis' },
    { id: 'verification', label: 'Verificação necessária' },
    { id: 'incompatible', label: 'Incompatíveis' },
    { id: 'archived', label: 'Arquivadas' },
  ];

  // Lista única de fontes para o filtro
  const sources = Array.from(new Set(opps.map(o => o.source || 'Manual').filter(Boolean)));

  const filtered = opps.filter(o => {
    const textMatch = !q || `${o.company} ${o.title} ${o.source} ${o.description || ''}`.toLowerCase().includes(q);
    const sourceMatch = !source || (o.source || 'Manual') === source;
    const statusMatch = !status || o.status === status;
    const queueMatch = !queue || queueOf(o) === queue;
    return textMatch && sourceMatch && statusMatch && queueMatch;
  });

  return `
    <div class="toolbar">
      <div class="filters">
        <input id="oppSearch" value="${esc(f.oppQ || '')}" placeholder="Buscar vaga, empresa ou palavra-chave…" aria-label="Buscar oportunidades">
        <select id="oppSourceFilter" aria-label="Filtrar por fonte">
          <option value="">Todas as fontes</option>
          ${sources.map(s => `<option value="${esc(s)}" ${source === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
        <select id="oppStatusFilter" aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          <option value="found" ${status === 'found' ? 'selected' : ''}>Identificada</option>
          <option value="reviewing" ${status === 'reviewing' ? 'selected' : ''}>Em análise</option>
          <option value="applied" ${status === 'applied' ? 'selected' : ''}>Convertida (Aplicada)</option>
          <option value="discarded" ${status === 'discarded' ? 'selected' : ''}>Descartada</option>
        </select>
      </div>
      <div class="toolbar-right">
        <span class="muted small">${filtered.length} de ${opps.length} vaga(s) identificada(s)</span>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px;">
      ${queues.map(item => `<button class="btn ${queue === item.id ? 'primary' : 'ghost'} sm" data-opp-queue="${item.id}">
        ${item.label} <span class="chip tiny" style="margin-left:4px;">${item.id ? opps.filter(opp => queueOf(opp) === item.id).length : opps.length}</span>
      </button>`).join('')}
    </div>

    ${!opps.length ? emptyState('🎯', 'Nenhuma oportunidade coletada ainda', 'A próxima execução de uma fonte autorizada aparecerá aqui.') :
      !filtered.length ? emptyState('🔎', 'Nenhuma oportunidade encontrada', 'Tente limpar os filtros de busca para ver todas as vagas.', '<button class="btn" id="btnClearOppFilter">Limpar filtros</button>') : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-top:10px;">
        ${filtered.map(opp => {
          const isApplied = opp.status === 'applied';
          const isDiscarded = opp.status === 'discarded';
          return `
            <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;padding:16px 18px;border:1px solid var(--line);background:rgba(255,255,255,0.03);opacity:${isDiscarded ? 0.6 : 1};">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                  <span class="chip tiny" style="background:rgba(126,203,219,0.12);color:var(--accent);">
                    ${esc(opp.source || 'Manual')}
                  </span>
                  <div style="display:flex;align-items:center;gap:6px;">
                    ${opp.match_score !== undefined ? `<span class="chip tiny" style="background:rgba(74,222,128,0.15);color:#4ade80;">Match: ${opp.match_score}%</span>` : ''}
                    ${opp.eligibilityStatus ? `<span class="chip tiny" style="background:${opp.eligibilityStatus === 'ELIGIBLE' ? 'rgba(74,222,128,.15)' : opp.eligibilityStatus === 'INELIGIBLE' ? 'rgba(239,68,68,.14)' : 'rgba(251,191,36,.14)'};color:${opp.eligibilityStatus === 'ELIGIBLE' ? '#4ade80' : opp.eligibilityStatus === 'INELIGIBLE' ? '#fca5a5' : '#fcd34d'};">${opp.eligibilityStatus === 'ELIGIBLE' ? 'Elegível' : opp.eligibilityStatus === 'INELIGIBLE' ? 'Incompatível' : 'Verificar'}</span>` : ''}
                    <span class="chip tiny" style="background:rgba(255,255,255,0.06);">
                      ${opp.status === 'applied' ? '✔ Aplicado' : opp.status === 'discarded' ? '✕ Descartada' : 'Identificada'}
                    </span>
                  </div>
                </div>

                <h4 style="margin:0 0 4px;font-size:15px;color:var(--ink);">${esc(opp.title || 'Vaga sem título')}</h4>
                <div style="font-size:13px;font-weight:500;color:var(--accent);margin-bottom:8px;">${esc(opp.company || 'Empresa a confirmar')}</div>
                ${opp.location ? `<div class="muted small" style="margin:-3px 0 8px;">📍 ${esc(opp.location)}</div>` : ''}
                ${opp.eligibility?.geographic?.reason ? `<div class="muted small" style="margin:-3px 0 8px;">${esc(opp.eligibility.geographic.reason)}</div>` : ''}

                ${opp.description ? `
                  <div style="font-size:12.5px;color:var(--muted);line-height:1.5;max-height:80px;overflow:hidden;text-overflow:ellipsis;margin-bottom:12px;">
                    ${esc(opp.description.slice(0, 220))}${opp.description.length > 220 ? '…' : ''}
                  </div>
                ` : ''}

                ${opp.url ? `
                  <div style="margin-bottom:12px;">
                    <a href="${esc(opp.url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                      ↗ Acessar anúncio original
                    </a>
                  </div>
                ` : ''}
              </div>

              <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--line);justify-content:space-between;align-items:center;">
                <div style="display:flex;gap:8px;">
                  ${!isApplied ? `
                    <button class="btn primary sm" data-apply-opp="${esc(opp.id)}" title="Confirmar que enviou a candidatura para mover para Aplicações">
                      ✔ Aplicado
                    </button>
                  ` : `
                    <span class="chip tiny" style="color:#4ade80;">Candidatura enviada</span>
                  `}
                  <button class="btn ghost sm danger" data-remove-opp="${esc(opp.id)}" title="Remover dos meus registros">
                    Remover
                  </button>
                </div>
                <button class="icon-btn" data-edit-opp="${esc(opp.id)}" title="Editar detalhes">✎</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

/* ============================================================
   Aba 2: Aplicações (Kanban de 5 colunas)
   ============================================================ */
function renderAplicacoes(apps, f) {
  const q = (f.q || '').toLowerCase();
  const priorityFilter = f.priority || '';

  const filtered = apps
    .filter(a => {
      const matchQ = !q || `${a.company} ${a.role} ${(a.tags || []).join(' ')}`.toLowerCase().includes(q);
      const matchPriority = !priorityFilter || (a.priority || 'normal') === priorityFilter;
      return matchQ && matchPriority;
    })
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db || a.company.localeCompare(b.company);
    });

  // Agrupamento estrito pelas 5 colunas na ordem correta
  const stageGroups = Object.fromEntries(
    STAGES.map(stage => [stage.id, filtered.filter(app => (app.stage || 'aplicado') === stage.id)])
  );

  return `
    <div class="toolbar">
      <div class="filters">
        <input id="appSearch" value="${esc(f.q || '')}" placeholder="Buscar empresa, função ou tag…" aria-label="Buscar aplicações">
        <select id="appPriorityFilter" aria-label="Filtrar por prioridade">
          <option value="">Todas as prioridades</option>
          ${PRIORITIES.map(p => `<option value="${p.id}" ${priorityFilter === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="muted small">${filtered.length} de ${apps.length} aplicação(ões) em 5 etapas</span>
        <button class="btn primary" id="btnNewApp">+ Nova candidatura</button>
      </div>
    </div>

    ${!apps.length ? emptyState('📋', 'Nenhuma aplicação cadastrada', 'Adicione candidaturas realizadas ou converta uma oportunidade.', '<button class="btn primary" id="btnEmptyNewApp">Cadastrar candidatura</button>') : `
      <div class="kanban" role="list" style="display:flex;gap:14px;overflow-x:auto;padding-bottom:16px;">
        ${STAGES.map(stage => {
          const cards = stageGroups[stage.id] || [];
          return `
            <section class="kcol" data-stage="${stage.id}" style="min-width:270px;max-width:320px;flex:1;background:rgba(255,255,255,0.02);border-radius:12px;padding:12px;border:1px solid var(--line);" role="listitem">
              <header class="kcol-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line);">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <span class="kdot" style="background:${stage.color};width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                  <h3 style="font-size:13.5px;font-weight:600;margin:0;color:var(--ink);">${esc(stage.name)}</h3>
                </div>
                <span class="kcount" style="font-size:12px;color:var(--muted-2);background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:12px;">${cards.length}</span>
              </header>

              <div class="kcards" data-drop-stage="${stage.id}" style="display:flex;flex-direction:column;gap:10px;min-height:120px;">
                ${cards.map(app => {
                  const done = (app.steps || []).filter(s => s.status === 'done').length;
                  return `
                    <article class="kcard" tabindex="0" draggable="true" data-id="${esc(app.id)}"
                      style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--line);cursor:grab;display:flex;flex-direction:column;gap:6px;">
                      
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong style="font-size:13.5px;color:var(--ink);">${esc(app.company)}</strong>
                        ${priorityDot(app.priority)}
                      </div>

                      <div style="font-size:12.5px;color:var(--accent);font-weight:500;">
                        ${esc(app.role || 'Função a definir')}
                      </div>

                      ${app.nextAction ? `
                        <div style="font-size:12px;color:var(--muted-2);line-height:1.4;background:rgba(0,0,0,0.18);padding:6px 8px;border-radius:6px;border-left:2px solid var(--accent);">
                          <strong style="color:var(--ink);">Próxima ação:</strong> ${esc(app.nextAction)}
                        </div>
                      ` : ''}

                      ${app.closeReason && stage.id === 'encerrado' ? `
                        <div style="font-size:11.5px;color:#fca5a5;background:rgba(239,68,68,0.08);padding:4px 8px;border-radius:6px;">
                          <strong>Motivo:</strong> ${esc(app.closeReason)}
                        </div>
                      ` : ''}

                      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px;">
                        ${app.deadline ? deadlineChip(app.deadline) : ''}
                        ${(app.steps || []).length ? `<span class="chip tiny">${done}/${app.steps.length} etapas</span>` : ''}
                      </div>

                      <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:flex-end;gap:6px;">
                        <button class="icon-btn" data-action="edit-app" data-id="${esc(app.id)}" title="Editar candidatura">✎</button>
                        <button class="icon-btn danger" data-action="del-app" data-id="${esc(app.id)}" title="Excluir candidatura">✕</button>
                      </div>
                    </article>
                  `;
                }).join('')}
                <button class="kadd" data-action="new-app" data-stage="${stage.id}"
                  style="width:100%;padding:8px;border-radius:8px;border:1px dashed var(--line);background:transparent;color:var(--muted-2);cursor:pointer;font-size:12px;">
                  + adicionar nesta etapa
                </button>
              </div>
            </section>
          `;
        }).join('')}
      </div>
    `}
  `;
}

/* ============================================================
   Wiring de eventos
   ============================================================ */
function wire(root, { activeTab, allApps, allOpps }) {
  // Troca de aba
  root.querySelectorAll('[data-apps-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      uiState.apps.tab = btn.dataset.appsTab;
      render(root);
    });
  });

  if (activeTab === 'oportunidades') {
    wireOportunidades(root);
  } else {
    wireAplicacoes(root);
  }
}

function wireOportunidades(root) {
  const search = root.querySelector('#oppSearch');
  search?.addEventListener('input', e => {
    uiState.apps.oppQ = e.target.value;
    render(root);
  });

  const sourceFilter = root.querySelector('#oppSourceFilter');
  sourceFilter?.addEventListener('change', e => {
    uiState.apps.oppSource = e.target.value;
    render(root);
  });

  const statusFilter = root.querySelector('#oppStatusFilter');
  statusFilter?.addEventListener('change', e => {
    uiState.apps.oppStatus = e.target.value;
    render(root);
  });

  root.querySelectorAll('[data-opp-queue]').forEach(btn => {
    btn.addEventListener('click', () => {
      uiState.apps.oppQueue = btn.dataset.oppQueue || '';
      render(root);
    });
  });

  root.querySelector('#btnClearOppFilter')?.addEventListener('click', () => {
    uiState.apps.oppQ = '';
    uiState.apps.oppSource = '';
    uiState.apps.oppStatus = '';
    uiState.apps.oppQueue = '';
    render(root);
  });

  // Ação "Aplicado" na oportunidade
  root.querySelectorAll('[data-apply-opp]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oppId = btn.dataset.applyOpp;
      const state = getState();
      const opp = (state.opportunities || []).find(o => o.id === oppId);
      if (!opp) return;

      const confirmed = await confirmAction(
        `Confirmar inscrição para "${opp.company || ''} — ${opp.title}"?\n\nEsta vaga será convertida em uma candidatura na aba Aplicações.`,
        { confirmLabel: 'Confirmar Inscrição' }
      );
      if (!confirmed) return;

      btn.disabled = true;
      try {
        const res = await convertOpportunityAction(oppId);
        toast('Inscrição confirmada! Movida para Aplicações.');
        // Muda para a aba Aplicações e abre o modal da candidatura recém-criada
        uiState.apps.tab = 'aplicacoes';
        render(root);
        if (res?.application?.id) {
          openAppModal(res.application.id);
        }
      } catch (err) {
        toast(`Erro ao converter: ${err.message}`, 'error');
        btn.disabled = false;
      }
    });
  });

  // Ação "Remover" na oportunidade
  root.querySelectorAll('[data-remove-opp]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const oppId = btn.dataset.removeOpp;
      const confirmed = await confirmAction('Deseja remover esta oportunidade dos registros?', { confirmLabel: 'Remover' });
      if (!confirmed) return;

      try {
        await api.deleteRecord('opportunity', oppId);
        const state = getState();
        state.opportunities = (state.opportunities || []).filter(o => o.id !== oppId);
        toast('Oportunidade removida');
        render(root);
      } catch (err) {
        toast(`Erro: ${err.message}`, 'error');
      }
    });
  });

  // Ação "Editar" oportunidade
  root.querySelectorAll('[data-edit-opp]').forEach(btn => {
    btn.addEventListener('click', () => openOpportunityModal(btn.dataset.editOpp));
  });
}

function wireAplicacoes(root) {
  const search = root.querySelector('#appSearch');
  search?.addEventListener('input', e => {
    uiState.apps.q = e.target.value;
    render(root);
  });

  const priorityFilter = root.querySelector('#appPriorityFilter');
  priorityFilter?.addEventListener('change', e => {
    uiState.apps.priority = e.target.value;
    render(root);
  });

  root.querySelector('#btnNewApp')?.addEventListener('click', () => openAppModal());
  root.querySelector('#btnEmptyNewApp')?.addEventListener('click', () => openAppModal());

  root.querySelectorAll('[data-action="new-app"]').forEach(btn => {
    btn.addEventListener('click', () => openAppModal('', { stage: btn.dataset.stage || 'aplicado' }));
  });

  root.querySelectorAll('[data-action="edit-app"]').forEach(btn => {
    btn.addEventListener('click', () => openAppModal(btn.dataset.id));
  });

  root.querySelectorAll('[data-action="del-app"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const app = getState().applications.find(a => a.id === id);
      if (!app) return;
      if (await confirmAction(`Excluir candidatura de "${app.company}"?`, { confirmLabel: 'Excluir' })) {
        deleteApplication(id);
        toast('Candidatura excluída');
        render(root);
      }
    });
  });

  wireKanbanStageDrag(root);
}

/* ============================================================
   Drag and Drop estrito do Kanban com validação de transição
   ============================================================ */
function wireKanbanStageDrag(root) {
  let draggingId = null;

  root.querySelectorAll('.kcard[draggable]').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggingId = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingId);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggingId = null;
      root.querySelectorAll('.kcol').forEach(c => c.classList.remove('dragover'));
    });
  });

  root.querySelectorAll('[data-drop-stage]').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.closest('.kcol')?.classList.add('dragover');
    });
    zone.addEventListener('dragleave', e => {
      if (zone.contains(e.relatedTarget)) return;
      zone.closest('.kcol')?.classList.remove('dragover');
    });
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.closest('.kcol')?.classList.remove('dragover');

      const id = draggingId || e.dataTransfer.getData('text/plain');
      const targetStage = zone.dataset.dropStage;
      if (!id || !targetStage) return;

      const app = getState().applications.find(a => a.id === id);
      if (!app || app.stage === targetStage) return;

      const currentStage = app.stage;
      let closeReason = '';
      let adminCorrection = false;
      let adminReason = '';

      // Verifica se a transição é permitida
      if (!canTransition(currentStage, targetStage)) {
        const justify = window.prompt(
          `A transição direta de "${stageById(currentStage).name}" para "${stageById(targetStage).name}" não faz parte do fluxo padrão.\n\nSe for uma correção administrativa, informe a justificativa:`
        );
        if (!justify || !justify.trim()) {
          toast('Transição cancelada: justificativa obrigatória para correção.', 'error');
          return;
        }
        adminCorrection = true;
        adminReason = justify.trim();
      }

      // Se moveu para encerrado, solicita o motivo
      if (targetStage === 'encerrado') {
        const reason = window.prompt(
          'Informe o motivo do encerramento (ex: Projeto concluído, Contrato encerrado, etc.):'
        );
        if (!reason || !reason.trim()) {
          toast('Encerramento cancelado: informe o motivo.', 'error');
          return;
        }
        closeReason = reason.trim();
      }

      moveApplication(id, targetStage, {
        adminCorrection,
        reason: adminReason,
        closeReason,
      });

      toast(`Etapa atualizada para ${stageById(targetStage).name}`);
      render(root);
    });
  });
}
