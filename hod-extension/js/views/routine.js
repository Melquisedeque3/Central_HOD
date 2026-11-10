/* ============================================================
   views/routine.js — Sugestão de rotina diária otimizada
   ============================================================ */
import { esc, fmtDate, dueInfo } from '../ui.js';
import { getState, priorityById } from '../store.js';

export const meta = { kicker: 'Rotina', title: 'Rotina Diária Otimizada' };

export function render(root) {
  const state = getState();
  const tasks = (state.tasks || []).filter(t => t.status !== 'done');
  const todayStr = new Date().toISOString().slice(0, 10);

  // Ordena tarefas por prioridade: urgente, importante, normal, baixa
  const prioWeight = { urgente: 4, importante: 3, normal: 2, baixa: 1 };
  const sorted = [...tasks].sort((a, b) => {
    const wa = prioWeight[a.priority] || 0;
    const wb = prioWeight[b.priority] || 0;
    return wb - wa;
  });

  // Gera blocos horários sugeridos para o dia
  const scheduleSlots = [
    { start: '07:00', end: '08:30', label: 'Foco Total / Tarefas Críticas' },
    { start: '08:30', end: '09:00', label: 'Revisão de Emails & Comunicação' },
    { start: '09:00', end: '11:00', label: 'Estudo de Guidelines & Preparação' },
    { start: '11:00', end: '12:00', label: 'Avanço em Candidaturas' },
    { start: '13:30', end: '15:30', label: 'Execução de Testes / Entrevistas' },
    { start: '15:30', end: '17:00', label: 'Follow-ups & Fechamento do Dia' },
  ];

  const routineItems = scheduleSlots.map((slot, idx) => {
    const assignedTask = sorted[idx];
    return {
      ...slot,
      task: assignedTask || null
    };
  });

  root.innerHTML = `
    <div class="card" style="margin-bottom: 24px;">
      <header class="card-head">
        <h3>Cronograma Inteligente do Dia</h3>
        <span class="muted small">${sorted.length} tarefas pendentes analisadas</span>
      </header>
      <div style="padding: 16px 20px 24px;">
        <div class="routine-timeline" style="display: flex; flex-direction: column; gap: 14px;">
          ${routineItems.map(item => `
            <div style="display: flex; align-items: flex-start; gap: 18px; padding: 14px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--line);">
              <div style="min-width: 110px; font-weight: 600; font-size: 13.5px; color: var(--accent);">
                ${item.start} — ${item.end}
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 500; font-size: 14px; color: var(--ink); margin-bottom: 4px;">
                  ${item.task ? esc(item.task.title) : esc(item.label)}
                </div>
                <div style="font-size: 12px; color: var(--muted-2);">
                  ${item.task ? `Vinculada à prioridade: <span class="chip tiny ${item.task.priority}">${esc(priorityById(item.task.priority)?.name || item.task.priority)}</span>` : 'Bloco livre para rotina e organização'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

