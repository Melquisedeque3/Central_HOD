/* ============================================================
   views/metrics.js — Métricas e Desempenho
   ============================================================ */
import { esc } from '../ui.js';
import { getState, stats } from '../store.js';

export const meta = { kicker: 'Desempenho', title: 'Métricas e Desempenho' };

export function render(root) {
  const state = getState();
  const st = stats();
  const apps = state.applications || [];
  const tasks = state.tasks || [];

  const totalApps = apps.length;
  const activeApps = apps.filter(a => a.stage !== 'encerrada').length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Contagem por empresa
  const companyCounts = {};
  apps.forEach(a => {
    const c = a.company || 'Outras';
    companyCounts[c] = (companyCounts[c] || 0) + 1;
  });

  root.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div class="card" style="padding: 20px;">
        <span class="eyebrow">Candidaturas Ativas</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: var(--accent);">${activeApps}</div>
        <small class="muted">${totalApps} registradas no total</small>
      </div>

      <div class="card" style="padding: 20px;">
        <span class="eyebrow">Tarefas Concluídas</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: #4ade80;">${doneTasks}</div>
        <small class="muted">${completionRate}% de taxa de resolução</small>
      </div>

      <div class="card" style="padding: 20px;">
        <span class="eyebrow">Empresas Monitoradas</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: #38bdf8;">${Object.keys(companyCounts).length}</div>
        <small class="muted">Distribuição no pipeline</small>
      </div>
    </div>

    <div class="card">
      <header class="card-head">
        <h3>Volume de Candidaturas por Empresa</h3>
      </header>
      <div style="padding: 20px;">
        ${Object.keys(companyCounts).length === 0 ? '<p class="muted">Nenhuma empresa cadastrada ainda.</p>' : `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${Object.entries(companyCounts).map(([company, count]) => {
              const pct = totalApps ? Math.round((count / totalApps) * 100) : 0;
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 6px;">
                    <strong>${esc(company)}</strong>
                    <span class="muted">${count} vaga(s) (${pct}%)</span>
                  </div>
                  <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; border-radius: 4px; background: var(--accent);"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}
