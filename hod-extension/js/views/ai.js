/* ============================================================
   views/ai.js — Central de IA Multimodal
   ============================================================ */
import { esc } from '../ui.js';
import { getState } from '../store.js';

export const meta = { kicker: 'Inteligência Artificial', title: 'Central de IA' };

export function render(root) {
  const state = getState();
  const apps = state.applications || [];
  const tasks = state.tasks || [];

  root.innerHTML = `
    <div class="card" style="display: flex; flex-direction: column; height: calc(100vh - 220px); min-height: 500px;">
      <header class="card-head" style="flex-wrap: wrap; gap: 12px;">
        <div>
          <h3>Assistente Inteligente HOD</h3>
          <small class="muted">Conectado ao seu perfil, candidaturas (${apps.length}) e tarefas (${tasks.length})</small>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="font-size: 12px; color: var(--muted-2);">Provedor:</label>
          <select id="aiModelSelector" style="padding: 4px 10px; border-radius: 8px; background: rgba(255,255,255,0.06); color: var(--ink); border: 1px solid var(--line);">
            <option value="gemini">Google Gemini 2.5 Flash</option>
            <option value="openai">OpenAI GPT-4o</option>
            <option value="anthropic">Anthropic Claude 3.5 Sonnet</option>
            <option value="groq">Groq Llama 3</option>
            <option value="deepseek">DeepSeek V3</option>
          </select>
        </div>
      </header>

      <div id="aiChatHistory" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
        <div style="align-self: flex-start; max-width: 80%; background: rgba(255,255,255,0.05); padding: 14px 18px; border-radius: 12px; font-size: 14px; line-height: 1.5;">
          Olá! Sou seu copiloto do Home Office Digital. Posso analisar suas vagas, sugerir prioridades para o dia, simular entrevistas ou responder dúvidas sobre guidelines. Em que posso te ajudar agora?
        </div>
      </div>

      <div style="padding: 16px 20px; border-top: 1px solid var(--line); display: flex; gap: 10px;">
        <input type="text" id="aiInputPrompt" placeholder="Pergunte sobre seus processos, rotinas ou vagas…" style="flex: 1; padding: 10px 14px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--line); color: var(--ink);" />
        <button class="btn primary" id="aiSendBtn">Enviar</button>
      </div>
    </div>
  `;
}
