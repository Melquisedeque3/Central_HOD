/* ============================================================
   views/email.js — Caixa de entrada por empresa e prioridade
   ============================================================ */
import { esc, emptyState } from '../ui.js';
import { getState } from '../store.js';

export const meta = { kicker: 'Comunicação', title: 'Caixa de Emails' };

export function render(root) {
  const state = getState();
  const apps = state.applications || [];
  const companies = [...new Set(apps.map(a => a.company).filter(Boolean))];

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="emailSearch" placeholder="Buscar mensagens, remetente ou assunto…" aria-label="Buscar emails">
        <select aria-label="Filtrar por empresa">
          <option value="">Todas as empresas</option>
          ${companies.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <select aria-label="Filtrar por prioridade">
          <option value="">Todas as prioridades</option>
          <option value="alta">Alta prioridade</option>
          <option value="normal">Normal</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn" id="syncGmailBtn">🔄 Sincronizar Gmail</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <header class="card-head">
        <h3>Integração com Gmail & Leitura por IA</h3>
        <span class="chip tiny" style="background: rgba(34,197,94,.15); color: #4ade80;">Conexão ativa</span>
      </header>
      <div style="padding: 16px 20px; font-size: 13.5px; color: var(--muted-2); line-height: 1.6;">
        <p>A caixa de emails centraliza automaticamente as mensagens recebidas das empresas em que você possui processos abertos (${companies.join(', ') || 'nenhuma empresa cadastrada ainda'}).</p>
        <p style="margin-top: 8px;">A IA processa o conteúdo, classifica a urgência e alimenta os prazos e tarefas das suas candidaturas.</p>
      </div>
    </div>

    ${emptyState('✉', 'Caixa de entrada atualizada', 'Nenhuma mensagem pendente de resposta ou atenção imediata no momento.')}
  `;
}
