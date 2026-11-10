/* ============================================================
   views/study.js — biblioteca de guidelines por empresa/projeto
   ============================================================ */
import { esc, emptyState, miniMarkdown, relativeTime, toast } from '../ui.js';
import { getState, getGuideline, updateGuideline } from '../store.js';
import { uiState } from '../state.js';

export const meta = { kicker: 'Estudo', title: 'Guidelines e material de estudo' };

export function render(root, params) {
  const state = getState();
  const f = uiState.study;
  const q = f.q.toLowerCase();

  const guides = state.guidelines.filter(g =>
    (!q || `${g.title} ${g.body}`.toLowerCase().includes(q)) && (!f.app || g.appId === f.app)
  );
  const selected = params.g ? getGuideline(params.g) : guides[0] || null;
  const linkedApp = selected?.appId ? state.applications.find(a => a.id === selected.appId) : null;

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="guideSearch" data-filter="study.q" value="${esc(f.q)}" placeholder="Buscar em títulos e conteúdo…" aria-label="Buscar guidelines">
        <select data-filter="study.app" aria-label="Filtrar por candidatura">
          <option value="">Todas as candidaturas</option>
          ${state.applications.map(a => `<option value="${a.id}" ${f.app === a.id ? 'selected' : ''}>${esc(a.company)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn primary" data-action="new-guide">+ Nova guideline</button>
      </div>
    </div>

    ${!state.guidelines.length ? emptyState('📚', 'Sua biblioteca está vazia', 'Cole aqui as orientações de cada empresa ou projeto. Depois a IA vai traduzir, resumir e montar revisões.',
      '<button class="btn primary" data-action="new-guide">Criar primeira guideline</button>') : `
      <div class="study-grid">
        <aside class="guide-side">
          ${guides.length ? guides.map(g => {
            const app = state.applications.find(a => a.id === g.appId);
            return `<button class="guide-item ${selected?.id === g.id ? 'active' : ''}" data-nav="#/study?g=${g.id}">
              <strong>${esc(g.title)}</strong>
              <small class="muted">${esc(app?.company || 'Sem vínculo')} · ${esc(g.language || '—')} · ${relativeTime(g.updatedAt)}</small>
            </button>`;
          }).join('') : '<p class="muted pad">Nada encontrado.</p>'}
        </aside>

        <article class="guide-reader card">
          ${selected ? `
            <header class="card-head">
              <div>
                <h3>${esc(selected.title)}</h3>
                <p class="muted small">
                  ${linkedApp ? `<a class="link" href="#/apps/${linkedApp.id}">${esc(linkedApp.company)}${linkedApp.role ? ' — ' + esc(linkedApp.role) : ''}</a> · ` : ''}
                  ${esc(selected.language || 'idioma não informado')}
                  ${selected.sourceUrl ? ` · <a class="link" href="${esc(selected.sourceUrl)}" target="_blank" rel="noopener">fonte ↗</a>` : ''}
                </p>
              </div>
              <div class="head-actions">
                <button class="btn ghost sm" data-action="edit-guide" data-id="${selected.id}">Editar</button>
                <button class="icon-btn danger" data-action="del-guide" data-id="${selected.id}" aria-label="Excluir guideline">✕</button>
              </div>
            </header>

            <div class="guide-tools">
              <button class="btn ghost sm" data-translate aria-disabled="true" title="Disponível na fase de IA">Traduzir para PT-BR</button>
              <button class="btn ghost sm" data-copy>Copiar markdown</button>
              <span class="muted small">Tradução e resumo automáticos entram na fase de IA (BYOK).</span>
            </div>

            <div class="markdown guide-body">${miniMarkdown(selected.body)}</div>

            ${selected.translation ? `<section class="translation">
              <h4>Tradução PT-BR</h4>
              <div class="markdown">${miniMarkdown(selected.translation)}</div>
            </section>` : ''}
          ` : '<p class="muted pad">Selecione uma guideline.</p>'}
        </article>
      </div>`}
  `;

  root.querySelector('[data-copy]')?.addEventListener('click', async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.body || '');
      toast('Markdown copiado');
    } catch { toast('Não foi possível copiar'); }
  });

  root.querySelector('[data-translate]')?.addEventListener('click', () => {
    toast('Tradução com IA chega na fase 3 — configure a chave em Ajustes.');
  });
}
