/* ============================================================
   views/routine.js — Rotina diária EDITÁVEL

   Os blocos deixaram de ser fixos: são registros do vault (tipo
   `routine`) e podem ser criados, editados, removidos e reordenados.
   As tarefas abertas são distribuídas nos blocos por prioridade.
   ============================================================ */
import { esc, fmtDate, dueInfo, toast, confirmAction, openModal, field, textarea, select } from '../ui.js';
import { getState, priorityById, createSlot, updateSlot, deleteSlot, resetRoutine, getSlot } from '../store.js';
import { taskRow } from '../components.js';

export const meta = { kicker: 'Rotina', title: 'Rotina Diária Otimizada' };

const toMin = hhmm => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fmtTime = hhmm => (hhmm || '--:--');

export function render(root) {
  const state = getState();
  const slots = [...(state.routine || [])].sort((a, b) => a.start.localeCompare(b.start));
  const openTasks = (state.tasks || []).filter(t => t.status !== 'done');
  const prioWeight = { urgente: 4, importante: 3, normal: 2, baixa: 1 };
  const sorted = [...openTasks].sort((a, b) => (prioWeight[b.priority] || 0) - (prioWeight[a.priority] || 0));

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const currentId = slots.find(s => nowMin >= toMin(s.start) && nowMin < toMin(s.end))?.id;

  /* distribui as tarefas nos blocos, uma por bloco, em ordem de prioridade */
  const assignments = new Map();
  slots.forEach((slot, i) => { if (sorted[i]) assignments.set(slot.id, sorted[i]); });

  const totalMinutes = slots.reduce((acc, s) => acc + Math.max(0, toMin(s.end) - toMin(s.start)), 0);
  const unassigned = sorted.slice(slots.length);

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <span class="muted small">
          ${slots.length} bloco(s) · ${(totalMinutes / 60).toFixed(1)} h planejadas · ${openTasks.length} tarefa(s) em aberto
        </span>
      </div>
      <div class="toolbar-right">
        <button class="btn ghost" data-action="reset-routine">Restaurar padrão</button>
        <button class="btn primary" data-action="new-slot">+ Novo bloco</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <header class="card-head">
        <h3>Cronograma do Dia</h3>
        <span class="muted small">Blocos editáveis · salvos no vault</span>
      </header>
      <div style="padding: 16px 20px 24px;">
        ${!slots.length ? `
          <div class="empty">
            <div class="empty-icon">🕗</div>
            <h3>Nenhum bloco de rotina</h3>
            <p>Crie blocos com horário e objetivo para o dia ganhar estrutura.</p>
            <button class="btn primary" data-action="new-slot">Criar primeiro bloco</button>
          </div>
        ` : `
          <div class="routine-timeline" style="display: flex; flex-direction: column; gap: 12px;">
            ${slots.map(slot => {
              const task = assignments.get(slot.id);
              const isNow = slot.id === currentId;
              const dur = Math.max(0, toMin(slot.end) - toMin(slot.start));
              return `
                <div class="routine-block ${isNow ? 'is-now' : ''}" style="display: flex; align-items: flex-start; gap: 18px; padding: 14px 16px; border-radius: 12px; background: ${isNow ? 'rgba(126,203,219,0.08)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isNow ? 'var(--accent)' : 'var(--line)'};">
                  <div style="min-width: 116px;">
                    <div style="font-weight: 600; font-size: 13.5px; color: var(--accent);">${esc(fmtTime(slot.start))} — ${esc(fmtTime(slot.end))}</div>
                    <div class="muted small" style="font-size: 11.5px; margin-top: 2px;">${dur} min${isNow ? ' · agora' : ''}</div>
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 500; font-size: 14px; color: var(--ink); margin-bottom: 4px;">${esc(slot.label)}</div>
                    <div style="font-size: 12px; color: var(--muted-2);">
                      ${task
                        ? `Tarefa: <b>${esc(task.title)}</b> · <span class="chip tiny ${esc(task.priority)}">${esc(priorityById(task.priority)?.name || task.priority)}</span>`
                        : (slot.notes ? esc(slot.notes) : 'Bloco livre — usado para foco, revisão ou descanso.')}
                    </div>
                  </div>
                  <div class="row-actions" style="display: flex; gap: 6px;">
                    <button class="icon-btn" data-action="edit-slot" data-id="${slot.id}" title="Editar bloco">✎</button>
                    <button class="icon-btn danger" data-action="del-slot" data-id="${slot.id}" title="Excluir bloco">✕</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>

    ${unassigned.length ? `
      <section class="card">
        <header class="card-head">
          <h3>Tarefas que não couberam nos blocos</h3>
          <span class="kcount">${unassigned.length}</span>
        </header>
        <div class="task-list">${unassigned.map(t => taskRow(t)).join('')}</div>
      </section>
    ` : ''}

    ${openTasks.length && slots.length ? `
      <section class="card" style="margin-top: 18px;">
        <header class="card-head"><h3>Todas as tarefas em aberto</h3><span class="kcount">${openTasks.length}</span></header>
        <div class="task-list">${sorted.map(t => taskRow(t, { compact: true })).join('')}</div>
      </section>
    ` : ''}
  `;

  /* ---------- ações da rotina ---------- */
  root.querySelector('[data-action="new-slot"]')?.addEventListener('click', () => openSlotModal());

  root.querySelector('[data-action="reset-routine"]')?.addEventListener('click', async () => {
    if (await confirmAction('Restaurar os 6 blocos padrão? Os blocos atuais serão substituídos.', { confirmLabel: 'Restaurar' })) {
      const old = [...getState().routine];
      for (const s of old) deleteSlot(s.id);
      resetRoutine();
      toast('Rotina restaurada');
    }
  });

  root.querySelectorAll('[data-action="edit-slot"]').forEach(btn => {
    btn.addEventListener('click', () => openSlotModal(btn.dataset.id));
  });

  root.querySelectorAll('[data-action="del-slot"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slot = getSlot(btn.dataset.id);
      if (!slot) return;
      if (await confirmAction(`Excluir o bloco “${slot.label}” (${slot.start}–${slot.end})?`, { confirmLabel: 'Excluir' })) {
        deleteSlot(slot.id);
        toast('Bloco removido');
      }
    });
  });
}

export function openSlotModal(id = '') {
  const slot = id ? getSlot(id) : null;
  openModal({
    title: slot ? 'Editar bloco de rotina' : 'Novo bloco de rotina',
    body: `
      ${field('Objetivo do bloco', 'label', slot?.label || '', { required: true, placeholder: 'Ex.: Foco total em tarefas críticas' })}
      <div class="grid-2">
        ${field('Início', 'start', slot?.start || '08:00', { type: 'time', required: true })}
        ${field('Fim', 'end', slot?.end || '09:00', { type: 'time', required: true })}
      </div>
      ${textarea('Observações', 'notes', slot?.notes || '', { rows: 2, placeholder: 'O que fazer neste bloco…' })}
    `,
    onSubmit(data) {
      const label = String(data.label || '').trim();
      const start = String(data.start || '').trim();
      const end = String(data.end || '').trim();
      if (!label) { toast('Dê um nome ao bloco.'); return false; }
      if (!start || !end) { toast('Informe início e fim.'); return false; }
      if (toMin(end) <= toMin(start)) { toast('O fim precisa ser depois do início.'); return false; }
      const payload = { label, start, end, notes: String(data.notes || '').trim() };
      if (slot) { updateSlot(slot.id, payload); toast('Bloco atualizado'); }
      else { createSlot(payload); toast('Bloco criado'); }
    },
  });
}
