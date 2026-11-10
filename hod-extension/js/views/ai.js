/* ============================================================
   views/ai.js — Central de IA Multimodal
   ============================================================ */
import { esc } from '../ui.js';
import { getState, AI_PROVIDERS, updateSettings, flush } from '../store.js';

export const meta = { kicker: 'Inteligência Artificial', title: 'Central de IA' };

export function render(root) {
  const state = getState();
  const apps = state.applications || [];
  const tasks = state.tasks || [];
  const keys = state.settings.apiKeys || {};
  const currentProvider = state.settings.ai?.provider || 'gemini';

  root.innerHTML = `
    <div class="card" style="display: flex; flex-direction: column; height: calc(100vh - 220px); min-height: 520px;">
      <header class="card-head" style="flex-wrap: wrap; gap: 12px;">
        <div>
          <h3>Assistente Inteligente HOD</h3>
          <small class="muted">Conectado ao seu perfil, candidaturas (${apps.length}) e tarefas (${tasks.length})</small>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <label style="font-size: 12px; color: var(--muted-2);">Provedor ativo:</label>
          <select id="aiModelSelector" style="padding: 5px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); color: var(--ink); border: 1px solid var(--line); font-size: 13px;">
            ${AI_PROVIDERS.map(p => {
              const configured = !!(keys[p.id] && keys[p.id].length > 3);
              return `<option value="${p.id}" ${currentProvider === p.id ? 'selected' : ''}>
                ${esc(p.name)} ${configured ? '✔' : '(sem chave)'}
              </option>`;
            }).join('')}
          </select>
          <a href="#/settings" class="btn ghost sm" style="text-decoration: none; font-size: 11.5px; padding: 4px 10px;">Configurar Chaves ↗</a>
        </div>
      </header>

      <div id="aiChatHistory" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
        <div style="align-self: flex-start; max-width: 80%; background: rgba(255,255,255,0.05); padding: 14px 18px; border-radius: 12px; font-size: 14px; line-height: 1.5;">
          Olá! Sou seu copiloto do Home Office Digital. Posso analisar suas candidaturas, orientar seus estudos de guidelines, sugerir a rotina do dia e tirar dúvidas em português.
          <br><br>
          ${!keys[currentProvider] ? `
            <span style="display: inline-block; padding: 6px 12px; border-radius: 8px; background: rgba(239,68,68,0.15); color: #fca5a5; font-size: 12.5px;">
              ⚠️ Nenhuma chave cadastrada para o provedor selecionado. <a href="#/settings" style="color: #fca5a5; font-weight: 600; text-decoration: underline;">Cadastre sua chave nas Configurações</a> para conversar.
            </span>
          ` : `
            <span style="font-size: 12px; color: #4ade80;">✔ Provedor configurado e pronto para responder com seus dados locais.</span>
          `}
        </div>
      </div>

      <div style="padding: 16px 20px; border-top: 1px solid var(--line); display: flex; gap: 10px;">
        <input type="text" id="aiInputPrompt" placeholder="Pergunte sobre seus processos, rotinas ou vagas…" style="flex: 1; padding: 10px 14px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--line); color: var(--ink);" />
        <button class="btn primary" id="aiSendBtn">Enviar</button>
      </div>
    </div>
  `;

  root.querySelector('#aiModelSelector')?.addEventListener('change', async e => {
    const prov = e.target.value;
    updateSettings('ai', { provider: prov });
    await flush();
    render(root);
  });
}
