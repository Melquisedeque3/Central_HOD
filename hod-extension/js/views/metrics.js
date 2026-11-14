/* ============================================================
   views/metrics.js — Métricas e Desempenho com gráficos SVG reais
   Todos os números vêm do estado derivado (vault).
   ============================================================ */
import { esc, fmtDate } from '../ui.js';
import { getState, stats, STAGES, stageById } from '../store.js';

export const meta = { kicker: 'Desempenho', title: 'Métricas e Desempenho' };

/* ---------- gráficos ---------- */
function donut(segments, { size = 168, stroke = 22 } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const len = (s.value / total) * c;
    const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      stroke="${s.color}" stroke-width="${stroke}"
      stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="butt"></circle>`;
    offset += len;
    return arc;
  }).join('');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Distribuição">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${stroke}"></circle>
    ${arcs}
    <text x="50%" y="47%" text-anchor="middle" fill="var(--ink)" font-size="26" font-weight="500">${total}</text>
    <text x="50%" y="60%" text-anchor="middle" fill="var(--muted-2)" font-size="11">total</text>
  </svg>`;
}

function barChart(rows, { width = 560, barH = 22, gap = 12 } = {}) {
  if (!rows.length) return '<p class="muted pad">Sem dados para exibir.</p>';
  const max = Math.max(...rows.map(r => r.value), 1);
  const labelW = 140;
  const chartW = width - labelW - 56;
  const height = rows.length * (barH + gap);

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Gráfico de barras">
    ${rows.map((r, i) => {
      const y = i * (barH + gap);
      const w = Math.max(2, (r.value / max) * chartW);
      return `
        <text x="0" y="${y + barH * 0.72}" fill="var(--muted-2)" font-size="12">${esc(r.label.slice(0, 22))}</text>
        <rect x="${labelW}" y="${y}" width="${chartW}" height="${barH}" rx="6" fill="rgba(255,255,255,0.05)"></rect>
        <rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="6" fill="${r.color || 'var(--accent)'}"></rect>
        <text x="${labelW + chartW + 8}" y="${y + barH * 0.72}" fill="var(--ink)" font-size="12">${r.value}</text>
      `;
    }).join('')}
  </svg>`;
}

function sparkline(values, { width = 560, height = 90 } = {}) {
  if (values.length < 2) return '<p class="muted pad">Dados insuficientes para a série temporal.</p>';
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 12) - 6).toFixed(1)}`);
  const area = `0,${height} ${pts.join(' ')} ${width},${height}`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Série temporal">
    <polygon points="${area}" fill="rgba(126,203,219,0.14)"></polygon>
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"></polyline>
  </svg>`;
}

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
  const overdue = tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date()).length;

  /* funil por etapa */
  const stageRows = STAGES.map(s => ({
    label: s.name,
    value: apps.filter(a => a.stage === s.id).length,
    color: s.color,
  }));

  /* distribuição de tarefas por prioridade */
  const prioColors = { urgente: '#ef8c8c', importante: '#f4c77a', normal: '#7ecbdb', baixa: '#8aacb1' };
  const prioSegments = ['urgente', 'importante', 'normal', 'baixa'].map(p => ({
    label: p,
    value: tasks.filter(t => t.status !== 'done' && (t.priority || 'normal') === p).length,
    color: prioColors[p],
  }));

  /* empresas */
  const companyCounts = {};
  apps.forEach(a => { const c = a.company || 'Outras'; companyCounts[c] = (companyCounts[c] || 0) + 1; });
  const companyRows = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value, color: 'var(--accent)' }));

  /* série dos últimos 14 dias: tarefas concluídas por dia */
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const series = days.map(d => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return tasks.filter(t => {
      if (!t.completedAt) return false;
      const at = new Date(t.completedAt);
      return at >= d && at < next;
    }).length;
  });

  const emailCount = state.emails.length;
  const urgentEmails = state.emails.filter(e => e.priority === 'urgente').length;

  root.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div class="card" style="padding: 20px;">
        <span class="eyebrow">Candidaturas ativas</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: var(--accent);">${activeApps}</div>
        <small class="muted">${totalApps} registradas · ${st.pendingSteps} etapa(s) pendente(s)</small>
      </div>
      <div class="card" style="padding: 20px;">
        <span class="eyebrow">Tarefas concluídas</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: #4ade80;">${doneTasks}</div>
        <small class="muted">${completionRate}% de conclusão · ${st.openTasks} aberta(s)</small>
      </div>
      <div class="card" style="padding: 20px;">
        <span class="eyebrow">Atrasadas</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: ${overdue ? '#ef8c8c' : 'var(--muted-2)'};">${overdue}</div>
        <small class="muted">${overdue ? 'precisam de atenção hoje' : 'nada atrasado'}</small>
      </div>
      <div class="card" style="padding: 20px;">
        <span class="eyebrow">E-mails analisados</span>
        <div style="font-size: 32px; font-weight: 500; margin: 8px 0; color: #38bdf8;">${emailCount}</div>
        <small class="muted">${urgentEmails} marcado(s) como urgente</small>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; margin-bottom: 18px;">
      <section class="card">
        <header class="card-head"><h3>Funil por etapa</h3></header>
        <div style="padding: 18px 20px;">${barChart(stageRows)}</div>
      </section>

      <section class="card">
        <header class="card-head"><h3>Tarefas abertas por prioridade</h3></header>
        <div style="padding: 18px 20px; display: flex; gap: 22px; align-items: center; flex-wrap: wrap;">
          ${donut(prioSegments)}
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${prioSegments.map(s => `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <span style="width: 10px; height: 10px; border-radius: 3px; background: ${s.color};"></span>
                <span style="color: var(--ink);">${esc(s.label)}</span>
                <b style="color: var(--muted-2);">${s.value}</b>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    </div>

    <section class="card" style="margin-bottom: 18px;">
      <header class="card-head">
        <h3>Tarefas concluídas nos últimos 14 dias</h3>
        <span class="muted small">${series.reduce((a, b) => a + b, 0)} no período</span>
      </header>
      <div style="padding: 18px 20px;">${sparkline(series)}</div>
    </section>

    <section class="card">
      <header class="card-head">
        <h3>Volume de candidaturas por empresa</h3>
        <span class="muted small">${Object.keys(companyCounts).length} empresa(s)</span>
      </header>
      <div style="padding: 18px 20px;">${barChart(companyRows)}</div>
    </section>

    ${state.vault ? `
      <section class="card" style="margin-top: 18px;">
        <header class="card-head"><h3>Saúde do vault</h3></header>
        <dl class="facts">
          <div><dt>Notas indexadas</dt><dd>${state.vault.notes}</dd></div>
          <div><dt>Última varredura</dt><dd>${esc(fmtDate(state.vault.scannedAt))}</dd></div>
          <div><dt>Tombstones</dt><dd>${state.vault.tombstones ?? 0}</dd></div>
          <div><dt>Erros de leitura</dt><dd>${(state.vault.errors || []).length}</dd></div>
        </dl>
        ${(state.vault.errors || []).length ? `<p class="muted small">${state.vault.errors.slice(0, 5).map(esc).join(' · ')}</p>` : ''}
      </section>
    ` : ''}
  `;
}
