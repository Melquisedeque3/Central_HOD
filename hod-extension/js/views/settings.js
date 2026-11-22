/* ============================================================
   views/settings.js — Ajustes e Conexões do HOD
   Sem Hermes. Integração: Vault Obsidian + Agente IA + Dados.
   ============================================================ */
import { esc, toast, confirmAction, field, textarea } from '../ui.js';
import { getState, stats, exportJSON, importJSON, resetAll, reload } from '../store.js';
import * as api from '../api.js';

export const meta = { kicker: 'Ajustes', title: 'Conexões e dados' };

export function render(root) {
  const state = getState();
  const conn = state.connections || {};
  const obs = conn.obsidian || {};
  const aiCfg = conn.ai || {};
  const profile = conn.profile || {};
  const residence = profile.residence || {};
  const s = stats();
  const vaultMode = state.sync.mode === 'vault';

  root.innerHTML = `
    <div class="settings-grid">

      <!-- ======= STATUS DO VAULT ======= -->
      <section class="card" style="grid-column: 1 / -1;">
        <header class="card-head" style="flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="settings-vault-icon ${vaultMode ? 'is-connected' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22"><path d="M5 20h14a2 2 0 0 0 2-2V8l-5-5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M14 3v5h5"/></svg>
            </div>
            <div>
              <h3 style="margin:0;">${vaultMode ? 'Vault Obsidian conectado' : 'Aguardando servidor local'}</h3>
              <p class="muted small" style="margin:3px 0 0;">
                ${vaultMode
                  ? 'Arquivos <code>.md</code> são a fonte de verdade. Índice derivado e reconstruível.'
                  : 'Inicie o servidor com <code>node server.mjs</code> para gravar no vault.'}
              </p>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn ghost sm" id="testServer">Testar conexão</button>
            <button class="btn ghost sm" id="reindex">Reindexar vault</button>
            <button class="btn ghost sm" id="reloadState">Recarregar estado</button>
          </div>
        </header>
        <div style="padding:16px 20px 20px;">
          <dl class="facts">
            <div><dt>Modo</dt><dd>${vaultMode ? 'vault' : 'local (localStorage)'}</dd></div>
            <div><dt>Caminho do vault</dt><dd style="font-size:11px;word-break:break-all;">${esc(state.vault?.root || conn.vaultPath || '/Volumes/Sem Título 3/Home_Office/Obsidian Vault')}</dd></div>
            <div><dt>Notas indexadas</dt><dd>${state.vault?.notes ?? '—'}</dd></div>
            <div><dt>Gravações pendentes</dt><dd>${state.sync.pending}</dd></div>
            <div><dt>Último erro de sync</dt><dd>${state.sync.lastError ? esc(state.sync.lastError.slice(0, 80)) : '—'}</dd></div>
          </dl>
          ${state.sync.lastError ? `
            <div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;font-size:12.5px;">
              ${esc(state.sync.lastError)}
            </div>` : ''}
        </div>
      </section>

      <!-- ======= PERFIL PARA TRIAGEM ======= -->
      <section class="card">
        <header class="card-head"><h3>Perfil para triagem de vagas</h3></header>
        <p class="muted small">Usado pelo HOD e agentes para avaliar oportunidades. Não envia dados a plataformas nem altera candidaturas.</p>
        <form id="candidateProfileForm" class="stack">
          <div class="grid-2">
            ${field('País de residência', 'country', residence.country || 'Brazil')}
            ${field('Estado', 'state', residence.state || 'Sergipe')}
          </div>
          ${field('Versão do perfil', 'version', profile.version || 'resume-melquisedeque-2026-11')}
          ${textarea('Idiomas (vírgulas)', 'languages', (profile.languages || []).map(item => typeof item === 'string' ? item : item.name).filter(Boolean).join(', ') || 'Portuguese, English, Spanish', { rows: 2 })}
          ${textarea('Áreas de interesse (vírgulas)', 'interests', (profile.interests || []).join(', ') || 'AI Evaluation, Data Annotation, Search Evaluation, Relevance Rating, Data Quality, Linguistic QA', { rows: 2 })}
          ${textarea('Áreas excluídas (vírgulas)', 'excludedAreas', (profile.excludedAreas || []).join(', ') || 'software engineer, medical, legal', { rows: 2 })}
          <div class="form-actions"><button type="submit" class="btn primary">Salvar perfil</button></div>
          <p class="muted small" id="candidateProfileStatus" role="status"></p>
        </form>
      </section>

      <!-- ======= OBSIDIAN REST (OPCIONAL) ======= -->
      <section class="card">
        <header class="card-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="20" height="20"><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-30 12 12)"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(30 12 12)"/><circle cx="12" cy="12" r="2"/></svg>
            <h3>Obsidian Local REST (opcional)</h3>
          </div>
          <span class="chip tiny" style="background:${obs.enabled ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.06)'};color:${obs.enabled ? '#4ade80' : 'var(--muted-2)'};">
            ${obs.enabled ? 'ativo' : 'desligado'}
          </span>
        </header>
        <p class="muted small">
          API REST local do plugin <strong>Local REST API</strong> do Obsidian. Permite verificar
          a conectividade com o app, mas o HOD já grava os <code>.md</code> diretamente no vault —
          este plugin é opcional.
        </p>
        <form id="obsidianForm" class="stack">
          <label class="field inline">
            <input type="checkbox" name="enabled" ${obs.enabled ? 'checked' : ''}>
            <span>Ativar verificação REST</span>
          </label>
          ${field('URL do plugin', 'url', obs.url || 'http://127.0.0.1:27123', { placeholder: 'http://127.0.0.1:27123' })}
          ${field('API key (se configurada no plugin)', 'key', '', { type: 'password', placeholder: obs.hasKey ? '•••••••• (já definida)' : 'deixe em branco se não usar' })}
          <div class="form-actions wrap">
            <button type="submit" class="btn primary">Salvar</button>
            <button type="button" class="btn ghost" id="testObsidian">Testar</button>
          </div>
          <p class="muted small" id="obsidianStatus" role="status"></p>
        </form>
      </section>

      <!-- ======= AGENTE DE IA ======= -->
      <section class="card">
        <header class="card-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">✨</span>
            <h3>Agente de IA</h3>
          </div>
          <span class="chip tiny" style="background:${aiCfg.enabled ? 'rgba(167,139,250,.14)' : 'rgba(255,255,255,.06)'};color:${aiCfg.enabled ? '#c4b5fd' : 'var(--muted-2)'};">
            ${aiCfg.enabled ? (aiCfg.provider || 'ativo') : 'desligado'}
          </span>
        </header>
        <p class="muted small">
          Integração com modelos de linguagem para triagem automática de vagas, tradução de
          guidelines e geração de rascunhos. A chave fica somente no servidor local
          em <code>.hod-config.json</code> — o navegador nunca a recebe.
        </p>
        <form id="aiForm" class="stack">
          <label class="field inline">
            <input type="checkbox" name="enabled" ${aiCfg.enabled ? 'checked' : ''}>
            <span>Ativar agente</span>
          </label>
          <label class="field">
            <span>Provedor</span>
            <select name="provider">
              <option value="gemini" ${(aiCfg.provider || 'gemini') === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              <option value="openai" ${aiCfg.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="anthropic" ${aiCfg.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude</option>
              <option value="ollama" ${aiCfg.provider === 'ollama' ? 'selected' : ''}>Ollama (local)</option>
            </select>
          </label>
          ${field('Modelo', 'model', aiCfg.model || 'gemini-2.0-flash', { placeholder: 'gemini-2.0-flash' })}
          ${field('API key', 'key', '', { type: 'password', placeholder: aiCfg.hasKey ? '•••••••• (já definida)' : 'cole a chave do provedor' })}
          <div class="form-actions wrap">
            <button type="submit" class="btn primary">Salvar</button>
          </div>
          <p class="muted small" id="aiStatus" role="status"></p>
        </form>
      </section>

      <!-- ======= DADOS & RESUMO ======= -->
      <section class="card">
        <header class="card-head"><h3>Dados do vault</h3></header>
        <dl class="facts">
          <div><dt>Candidaturas</dt><dd>${s.apps}</dd></div>
          <div><dt>Tarefas</dt><dd>${state.tasks.length}</dd></div>
          <div><dt>Guidelines</dt><dd>${s.guidelines}</dd></div>
          <div><dt>Oportunidades</dt><dd>${(state.opportunities || []).length}</dd></div>
          <div><dt>Blocos de rotina</dt><dd>${state.routine.length}</dd></div>
          <div><dt>E-mails importados</dt><dd>${state.emails.length}</dd></div>
          <div><dt>Versão do schema</dt><dd>${state.version}</dd></div>
          <div><dt>Atualizado</dt><dd>${esc(new Date(state.updatedAt).toLocaleString('pt-BR'))}</dd></div>
        </dl>
        <div class="form-actions wrap">
          <button class="btn ghost" id="exportData">Exportar JSON</button>
          <label class="btn ghost file-btn">Importar JSON<input type="file" id="importData" accept="application/json" hidden></label>
          <button class="btn danger-ghost" id="resetData">Apagar tudo</button>
        </div>
        <p class="muted small">
          O backup exporta somente dados — sem credenciais. As notas vivem em
          <code>/Volumes/Sem Título 3/Home_Office/Obsidian Vault</code>.
        </p>
      </section>

      <!-- ======= ROTINA ======= -->
      <section class="card">
        <header class="card-head"><h3>Rotina diária</h3></header>
        <p class="muted small">Os blocos são registros do vault. Edite diretamente na aba Rotina.</p>
        <dl class="facts">
          <div><dt>Blocos configurados</dt><dd>${state.routine.length}</dd></div>
          <div><dt>Horas planejadas</dt><dd>${fmtTotal(state.routine)}</dd></div>
        </dl>
        <div class="form-actions">
          <a class="btn ghost" href="#/routine">Abrir rotina</a>
        </div>
      </section>

      <!-- ======= ATALHOS & OPERAÇÃO ======= -->
      <section class="card" style="grid-column: 1 / -1;">
        <header class="card-head"><h3>Atalhos de teclado</h3></header>
        <p class="muted small">
          <code>g h</code> início ·
          <code>g a</code> candidaturas ·
          <code>g t</code> tarefas ·
          <code>g m</code> correspondências ·
          <code>g e</code> estudo ·
          <code>g r</code> rotina ·
          <code>g k</code> métricas ·
          <code>g s</code> ajustes ·
          <code>← →</code> navegar carrossel
        </p>
        <p class="muted small" style="margin-top:8px;">
          Para iniciar o servidor: <code>node server.mjs</code> dentro de <code>hod-extension/</code>.
          O vault Obsidian é a fonte de verdade — reindexe após editar notas fora do HOD.
        </p>
      </section>

    </div>
  `;

  /* ---- Testar servidor ---- */
  root.querySelector('#testServer')?.addEventListener('click', async () => {
    try {
      const health = await api.fetchHealth();
      const path = health.vault?.path || '';
      toast(`Servidor OK · ${health.vault?.notes ?? 0} nota(s) · vault: ${path.split('/').pop()}`);
    } catch (err) {
      toast(`Servidor local indisponível: ${err.message}`, 'error');
    }
  });

  root.querySelector('#reindex')?.addEventListener('click', async () => {
    try {
      const res = await api.reindex();
      await reload();
      toast(`Reindexado: ${res.notes} nota(s)`);
      render(root);
    } catch (err) {
      toast(`Falha ao reindexar: ${err.message}`, 'error');
    }
  });

  root.querySelector('#reloadState')?.addEventListener('click', async () => {
    try {
      await reload();
      toast('Estado recarregado do vault');
      render(root);
    } catch (err) {
      toast(`Falha ao recarregar: ${err.message}`, 'error');
    }
  });

  /* ---- Obsidian REST ---- */
  const obsStatus = root.querySelector('#obsidianStatus');
  root.querySelector('#obsidianForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const patch = { obsidian: { enabled: form.get('enabled') === 'on', url: String(form.get('url') || '').trim() } };
    const key = String(form.get('key') || '').trim();
    if (key) patch.obsidian.key = key;
    try {
      await api.saveConfig(patch);
      toast('Configuração do Obsidian REST salva');
      await reload().catch(() => {});
      render(root);
    } catch (err) {
      toast(`Falha ao salvar: ${err.message}`, 'error');
    }
  });

  root.querySelector('#testObsidian')?.addEventListener('click', async () => {
    if (!obsStatus) return;
    obsStatus.textContent = 'Testando…';
    try {
      const health = await api.fetchHealth();
      if (health.obsidian?.reachable) {
        obsStatus.textContent = 'Obsidian REST acessível ✔';
        toast('Obsidian REST conectado');
      } else {
        obsStatus.textContent = `Não acessível: ${health.obsidian?.error || 'sem resposta'}`;
      }
    } catch (err) {
      obsStatus.textContent = `Falhou: ${err.message}`;
      toast('Obsidian REST não respondeu', 'error');
    }
  });

  /* ---- Agente de IA ---- */
  root.querySelector('#aiForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const patch = {
      ai: {
        enabled: form.get('enabled') === 'on',
        provider: String(form.get('provider') || 'gemini').trim(),
        model: String(form.get('model') || '').trim(),
      },
    };
    const key = String(form.get('key') || '').trim();
    if (key) patch.ai.key = key;
    try {
      await api.saveConfig(patch);
      toast('Configuração do agente salva');
      await reload().catch(() => {});
      render(root);
    } catch (err) {
      toast(`Falha ao salvar: ${err.message}`, 'error');
    }
  });

  root.querySelector('#candidateProfileForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const list = name => String(form.get(name) || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 40);
    const patch = {
      profile: {
        version: String(form.get('version') || '').trim().slice(0, 120),
        residence: { country: String(form.get('country') || '').trim().slice(0, 80), state: String(form.get('state') || '').trim().slice(0, 80) },
        languages: list('languages').map(name => ({ name, level: 'user-declared' })),
        interests: list('interests'),
        excludedAreas: list('excludedAreas'),
      },
    };
    try {
      await api.saveConfig(patch);
      toast('Perfil de triagem salvo');
      await reload().catch(() => {});
      render(root);
    } catch (err) {
      toast(`Falha ao salvar perfil: ${err.message}`, 'error');
    }
  });

  /* ---- Exportar / Importar / Apagar ---- */
  root.querySelector('#exportData')?.addEventListener('click', async () => {
    const text = await exportJSON();
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hod-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado');
  });

  root.querySelector('#importData')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importJSON(await file.text());
      toast(`Importado: ${res.applications} candidatura(s), ${res.tasks} tarefa(s), ${res.guidelines} guideline(s)`);
      render(root);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  root.querySelector('#resetData')?.addEventListener('click', async () => {
    if (await confirmAction('Apagar todas as candidaturas, tarefas e guidelines? No modo vault as notas também são removidas (cópia em .hod/trash).', { confirmLabel: 'Apagar tudo' })) {
      await resetAll();
      toast('Dados apagados');
      render(root);
    }
  });
}

function fmtTotal(slots) {
  const toMin = hhmm => {
    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const total = (slots || []).reduce((acc, s) => acc + Math.max(0, toMin(s.end) - toMin(s.start)), 0);
  return `${(total / 60).toFixed(1)} h`;
}
