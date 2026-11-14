/* ============================================================
   views/settings.js — Conexões, vault e dados

   Mudança de propósito: a tela não gerencia mais 8 chaves de API
   (elas viviam em localStorage em texto puro). Agora ela configura
   o servidor local, o vault Obsidian e o Hermes Agent — e as
   credenciais ficam em `.hod-config.json`, nunca no navegador.
   ============================================================ */
import { esc, toast, confirmAction, field, openModal } from '../ui.js';
import { getState, stats, exportJSON, importJSON, resetAll, reload } from '../store.js';
import * as api from '../api.js';

export const meta = { kicker: 'Ajustes', title: 'Conexões e dados' };

export function render(root) {
  const state = getState();
  const conn = state.connections || {};
  const o = conn.obsidian || {};
  const h = conn.hermes || {};
  const s = stats();
  const vaultMode = state.sync.mode === 'vault';

  root.innerHTML = `
    <div class="settings-grid">

      <!-- ============ MODO DE ARMAZENAMENTO ============ -->
      <section class="card" style="grid-column: 1 / -1;">
        <header class="card-head" style="flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">${vaultMode ? '🗄' : '💾'}</span>
            <div>
              <h3>${vaultMode ? 'Vault Obsidian conectado' : 'Modo local (só este navegador)'}</h3>
              <p class="muted small" style="margin:2px 0 0;">
                ${vaultMode
                  ? 'As notas .md do vault são a fonte de verdade. O índice é derivado e reconstruível.'
                  : 'Sem servidor, os dados ficam em localStorage. Rode <code>node server.mjs</code> para gravar no vault.'}
              </p>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn ghost sm" id="testServer">Testar servidor</button>
            <button class="btn ghost sm" id="reindex">Reindexar vault</button>
            <button class="btn ghost sm" id="reloadState">Recarregar do vault</button>
          </div>
        </header>
        <div style="padding:16px 20px 20px;">
          <dl class="facts">
            <div><dt>Modo</dt><dd>${vaultMode ? 'vault' : 'local'}</dd></div>
            <div><dt>Notas indexadas</dt><dd>${state.vault?.notes ?? '—'}</dd></div>
            <div><dt>Gravações pendentes</dt><dd>${state.sync.pending}</dd></div>
            <div><dt>Último erro</dt><dd>${state.sync.lastError ? esc(state.sync.lastError.slice(0, 80)) : '—'}</dd></div>
          </dl>
          ${state.sync.lastError ? `<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;font-size:12.5px;">${esc(state.sync.lastError)}</div>` : ''}
        </div>
      </section>

      <!-- ============ HERMES ============ -->
      <section class="card">
        <header class="card-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">◉</span>
            <h3>Hermes Agent</h3>
          </div>
          <span class="chip tiny" style="background:${h.enabled ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.06)'};color:${h.enabled ? '#4ade80' : 'var(--muted-2)'};">
            ${h.enabled ? 'ativo' : 'desligado'}
          </span>
        </header>
        <p class="muted small">
          O Hermes roda o cérebro operacional. O HOD fala com ele pelo API Server
          (<code>API_SERVER_ENABLED=true</code>, porta 8642). A chave fica no servidor local,
          em <code>.hod-config.json</code> — o navegador nunca a recebe.
        </p>
        <form id="hermesForm" class="stack">
          <label class="field inline">
            <input type="checkbox" name="enabled" ${h.enabled ? 'checked' : ''}>
            <span>Ativar integração</span>
          </label>
          ${field('URL do API Server', 'url', h.url || 'http://127.0.0.1:8642', { placeholder: 'http://127.0.0.1:8642' })}
          ${field('API key (opcional, se API_SERVER_KEY estiver setada)', 'key', '', { type: 'password', placeholder: h.hasKey ? '•••••••• (já definida)' : 'cole a chave do API_SERVER_KEY' })}
          ${field('Modelo', 'model', h.model || 'hermes-3-llama-3.1-405b', { placeholder: 'hermes-3-llama-3.1-405b' })}
          ${field('Web Dashboard (opcional)', 'dashboard', h.dashboard || 'http://127.0.0.1:9119', { placeholder: 'http://127.0.0.1:9119' })}
          <div class="form-actions wrap">
            <button type="submit" class="btn primary">Salvar</button>
            <button type="button" class="btn ghost" id="testHermes">Testar conexão</button>
            <button type="button" class="btn ghost" id="listModels">Listar modelos</button>
          </div>
          <p class="muted small" id="hermesStatus" role="status"></p>
        </form>
      </section>

      <!-- ============ OBSIDIAN ============ -->
      <section class="card">
        <header class="card-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">🗄</span>
            <h3>Obsidian Local REST API</h3>
          </div>
          <span class="chip tiny" style="background:${o.hasKey ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.06)'};color:${o.hasKey ? '#4ade80' : 'var(--muted-2)'};">
            ${o.hasKey ? 'com chave' : 'sem chave'}
          </span>
        </header>
        <p class="muted small">
          Opcional. O HOD já grava direto nos arquivos <code>.md</code> do vault pelo servidor local.
          Configure aqui apenas se quiser abrir notas no Obsidian ou usar o plugin REST.
        </p>
        <form id="obsidianForm" class="stack">
          <label class="field inline">
            <input type="checkbox" name="enabled" ${o.enabled ? 'checked' : ''}>
            <span>Ativar integração REST</span>
          </label>
          ${field('URL do Local REST API', 'url', o.url || 'http://127.0.0.1:27123', { placeholder: 'http://127.0.0.1:27123' })}
          ${field('Chave da API', 'key', '', { type: 'password', placeholder: o.hasKey ? '•••••••• (já definida)' : 'cole a chave do plugin' })}
          ${field('Subpasta no vault', 'folder', o.folder || '', { placeholder: '(raiz do vault)' })}
          <div class="form-actions wrap">
            <button type="submit" class="btn primary">Salvar</button>
            <button type="button" class="btn ghost" id="testObsidian">Testar conexão</button>
          </div>
          <p class="muted small" id="obsidianStatus" role="status"></p>
        </form>
      </section>

      <!-- ============ DADOS ============ -->
      <section class="card">
        <header class="card-head"><h3>Dados</h3></header>
        <dl class="facts">
          <div><dt>Candidaturas</dt><dd>${s.apps}</dd></div>
          <div><dt>Tarefas</dt><dd>${state.tasks.length}</dd></div>
          <div><dt>Guidelines</dt><dd>${s.guidelines}</dd></div>
          <div><dt>Blocos de rotina</dt><dd>${state.routine.length}</dd></div>
          <div><dt>E-mails analisados</dt><dd>${state.emails.length}</dd></div>
          <div><dt>Versão do schema</dt><dd>${state.version}</dd></div>
          <div><dt>Atualizado</dt><dd>${esc(new Date(state.updatedAt).toLocaleString('pt-BR'))}</dd></div>
        </dl>
        <div class="form-actions wrap">
          <button class="btn ghost" id="exportData">Exportar JSON</button>
          <label class="btn ghost file-btn">Importar JSON<input type="file" id="importData" accept="application/json" hidden></label>
          <button class="btn danger-ghost" id="resetData">Apagar tudo</button>
        </div>
        <p class="muted small">
          O backup exporta só os seus dados — sem credenciais. No modo vault, os dados vivem em
          <code>${esc(state.vault?.root || './vault')}</code>.
        </p>
      </section>

      <!-- ============ ROTINA ============ -->
      <section class="card">
        <header class="card-head"><h3>Rotina</h3></header>
        <p class="muted small">Os blocos de rotina são registros do vault e podem ser editados na aba Rotina.</p>
        <dl class="facts">
          <div><dt>Blocos</dt><dd>${state.routine.length}</dd></div>
          <div><dt>Total planejado</dt><dd>${fmtTotal(state.routine)}</dd></div>
        </dl>
        <div class="form-actions">
          <a class="btn ghost" href="#/routine">Abrir rotina</a>
        </div>
      </section>

      <!-- ============ SOBRE / INTEGRAÇÃO ============ -->
      <section class="card" style="grid-column: 1 / -1;">
        <header class="card-head">
          <h3>Sobre e integração</h3>
          <button class="btn ghost sm" id="showIntegration">Como integrar o Hermes</button>
        </header>
        <p class="muted small">
          HOD 4.0 — página local, sem extensão, sem build e sem dependências.<br>
          Obsidian é o dono dos dados; o índice é derivado. O Hermes é o cérebro operacional.<br><br>
          Atalhos: <code>g h</code> início · <code>g a</code> candidaturas · <code>g t</code> tarefas ·
          <code>g m</code> email · <code>g e</code> estudo · <code>g r</code> rotina · <code>g k</code> métricas ·
          <code>g i</code> agente · <code>g s</code> ajustes.
        </p>
      </section>
    </div>
  `;

  /* ---------- servidor ---------- */
  root.querySelector('#testServer')?.addEventListener('click', async () => {
    try {
      const health = await api.fetchHealth();
      toast(`Servidor OK · ${health.vault?.notes ?? 0} nota(s) no índice`);
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

  /* ---------- Hermes ---------- */
  const hermesStatus = root.querySelector('#hermesStatus');

  root.querySelector('#hermesForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const patch = {
      hermes: {
        enabled: form.get('enabled') === 'on',
        url: String(form.get('url') || '').trim(),
        model: String(form.get('model') || '').trim(),
        dashboard: String(form.get('dashboard') || '').trim(),
      },
    };
    const key = String(form.get('key') || '').trim();
    if (key) patch.hermes.key = key;
    try {
      await api.saveConfig(patch);
      toast('Configuração do Hermes salva');
      await reload().catch(() => {});
      render(root);
    } catch (err) {
      toast(`Falha ao salvar: ${err.message}`, 'error');
    }
  });

  root.querySelector('#testHermes')?.addEventListener('click', async () => {
    if (!hermesStatus) return;
    hermesStatus.textContent = 'Testando…';
    try {
      const models = await api.hermesModels();
      hermesStatus.textContent = `Conectado ✔ — ${models.length} modelo(s): ${models.slice(0, 4).map(m => m.id).join(', ')}`;
      toast('Hermes acessível');
    } catch (err) {
      hermesStatus.textContent = `Falhou: ${err.message}`;
      toast('Hermes não respondeu', 'error');
    }
  });

  root.querySelector('#listModels')?.addEventListener('click', async () => {
    if (!hermesStatus) return;
    try {
      const models = await api.hermesModels();
      hermesStatus.textContent = models.length
        ? `Modelos: ${models.map(m => m.id).join(', ')}`
        : 'Nenhum modelo listado (API pode não expor /models).';
    } catch (err) {
      hermesStatus.textContent = `Falhou: ${err.message}`;
    }
  });

  /* ---------- Obsidian ---------- */
  const obsStatus = root.querySelector('#obsidianStatus');

  root.querySelector('#obsidianForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const patch = {
      obsidian: {
        enabled: form.get('enabled') === 'on',
        url: String(form.get('url') || '').trim(),
        folder: String(form.get('folder') || '').trim(),
      },
    };
    const key = String(form.get('key') || '').trim();
    if (key) patch.obsidian.key = key;
    try {
      await api.saveConfig(patch);
      toast('Configuração do Obsidian salva');
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
      await api.obsidianTest();
      obsStatus.textContent = 'Conectado ao Obsidian ✔';
      toast('Obsidian acessível');
    } catch (err) {
      obsStatus.textContent = `Falhou: ${err.message}`;
      toast('Obsidian não respondeu', 'error');
    }
  });

  /* ---------- dados ---------- */
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
    if (await confirmAction('Apagar todas as candidaturas, tarefas e guidelines? No modo vault as notas também são removidas (com cópia em .hod/trash).', { confirmLabel: 'Apagar tudo' })) {
      await resetAll();
      toast('Dados apagados');
      render(root);
    }
  });

  /* ---------- integração ---------- */
  root.querySelector('#showIntegration')?.addEventListener('click', () => {
    openModal({
      title: 'Integrar Hermes + Obsidian',
      wide: true,
      submitLabel: 'Fechar',
      cancelLabel: 'Fechar',
      body: `
        <div class="markdown" style="font-size:13px;line-height:1.7;">
          <h3>1. Apontar o vault</h3>
          <p>Rode o servidor apontando para o vault que já existe no outro SSD:</p>
          <pre class="md-pre"><code>HOD_VAULT="/caminho/do/vault" node server.mjs</code></pre>
          <p>Ou copie o vault para <code>./vault</code> e rode <code>node server.mjs</code>.</p>

          <h3>2. Subir o Hermes com o API Server</h3>
          <pre class="md-pre"><code># ~/.hermes/.env
API_SERVER_ENABLED=true
API_SERVER_KEY=uma-chave-longa
API_SERVER_CORS_ORIGINS=http://127.0.0.1:8420</code></pre>

          <h3>3. Conectar na aba Ajustes</h3>
          <p>URL <code>http://127.0.0.1:8642</code>, a mesma chave e o modelo desejado.
          A página fala com o Hermes pelo servidor local — a chave nunca entra no navegador.</p>

          <h3>4. Deixar o Hermes ler o vault</h3>
          <p>O Hermes já lê arquivos locais. Aponte as skills dele para a mesma pasta do vault.
          O contrato das notas está no README deste repositório (seção <b>Contrato do vault</b>).</p>

          <h3>5. Verificar</h3>
          <p>Ajustes → <i>Testar conexão</i> no Hermes, depois aba <b>Agente</b> → <i>Ações</i> → <i>Briefing do dia</i>.</p>
        </div>
      `,
    });
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
