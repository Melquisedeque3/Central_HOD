/* ============================================================
   views/settings.js — dados, Central de APIs e Obsidian
   ============================================================ */
import { esc, toast, confirmAction, field } from '../ui.js';
import { getState, exportJSON, importJSON, resetAll, updateSettings, flush, stats, AI_PROVIDERS } from '../store.js';
import { testConnection, exportAll, downloadMarkdownBundle } from '../obsidian.js';

export const meta = { kicker: 'Ajustes', title: 'Configuração e dados' };

export function render(root) {
  const state = getState();
  const o = state.settings.obsidian;
  const s = stats();
  const keys = state.settings.apiKeys || {};
  const activeProvider = state.settings.ai?.provider || 'gemini';

  root.innerHTML = `
    <div class="settings-grid">

      <!-- ============ CENTRAL DE APIS SEGURA (BYOK) ============ -->
      <section class="card" style="grid-column: 1 / -1; margin-bottom: 8px;">
        <header class="card-head" style="flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🔑</span>
            <div>
              <h3>Central de APIs & Provedores de IA</h3>
              <p class="muted small" style="margin: 2px 0 0;">Configuração BYOK (Bring Your Own Key) para uso nos assistentes, tradução de guidelines e leitura de emails.</p>
            </div>
          </div>
          <span class="chip tiny" style="background: rgba(34,197,94,.12); color: #4ade80; border: 1px solid rgba(34,197,94,.3);">🔒 100% Privado & Local</span>
        </header>

        <div style="padding: 16px 20px 20px;">
          <div style="background: rgba(241,188,144,0.06); border: 1px solid rgba(241,188,144,0.2); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: var(--ink); line-height: 1.5;">
            <strong>Segurança e Privacidade:</strong> As suas chaves de API ficam gravadas exclusivamente na memória local isolada do seu navegador (<code>chrome.storage.local</code>). Nenhuma chave é transmitida para servidores de terceiros ou compartilhada com o HOD, e elas são automaticamente omitidas de qualquer exportação de backup.
          </div>

          <form id="apiKeysForm" class="stack">
            <div style="display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); margin-bottom: 8px; flex-wrap: wrap;">
              <label style="font-size: 13.5px; font-weight: 500; color: var(--ink);">Provedor Padrão Ativo:</label>
              <select name="active_provider" style="padding: 6px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); color: var(--ink); border: 1px solid var(--line); font-size: 13px;">
                ${AI_PROVIDERS.map(p => `<option value="${p.id}" ${activeProvider === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
              ${AI_PROVIDERS.map(p => {
                const hasKey = !!(keys[p.id] && keys[p.id].length > 3);
                return `
                  <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <strong style="font-size: 13.5px; color: var(--ink);">${esc(p.name)}</strong>
                        <span class="chip tiny" style="${hasKey ? 'background: rgba(34,197,94,.15); color: #4ade80;' : 'background: rgba(255,255,255,.06); color: var(--muted-2);'}">
                          ${hasKey ? 'Configurada ✔' : 'Não configurada'}
                        </span>
                      </div>
                      <a href="${p.docUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 11.5px; color: var(--accent); text-decoration: none;">Obter chave ↗</a>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <input type="password" name="key_${p.id}" value="${esc(keys[p.id] || '')}" placeholder="${p.placeholder}" style="flex: 1; padding: 8px 12px; border-radius: 8px; background: rgba(0,0,0,0.25); border: 1px solid var(--line); color: var(--ink); font-size: 13px; font-family: monospace;" autocomplete="off" spellcheck="false" />
                      <button type="button" class="btn-toggle-key icon-btn" data-target="key_${p.id}" title="Mostrar / Ocultar chave" style="font-size: 13px;">👁</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="form-actions" style="margin-top: 14px;">
              <button type="submit" class="btn primary">Salvar Chaves de API</button>
            </div>
          </form>
        </div>
      </section>

      <!-- ============ OBSIDIAN ============ -->
      <section class="card">
        <header class="card-head"><h3>Obsidian — backend do segundo cérebro</h3></header>
        <p class="muted small">Usa o plugin <b>Local REST API</b> rodando na sua máquina. O HOD escreve notas .md no vault, sem nuvem intermediária.</p>
        <form id="obsidianForm" class="stack">
          <label class="field inline">
            <input type="checkbox" name="enabled" ${o.enabled ? 'checked' : ''}>
            <span>Ativar integração</span>
          </label>
          ${field('URL do Local REST API', 'url', o.url, { placeholder: 'http://127.0.0.1:27123' })}
          ${field('Chave da API', 'key', o.key, { type: 'password', placeholder: 'cole a chave gerada pelo plugin' })}
          ${field('Pasta no vault', 'folder', o.folder, { placeholder: 'HOD' })}
          <div class="form-actions">
            <button type="submit" class="btn primary">Salvar</button>
            <button type="button" class="btn ghost" id="testObsidian">Testar conexão</button>
            <button type="button" class="btn ghost" id="pushObsidian">Enviar tudo para o vault</button>
            <button type="button" class="btn ghost" id="downloadMd">Baixar .md</button>
          </div>
          <p class="muted small" id="obsidianStatus" role="status"></p>
        </form>
      </section>

      <!-- ============ DADOS & BACKUP ============ -->
      <section class="card">
        <header class="card-head"><h3>Dados</h3></header>
        <dl class="facts">
          <div><dt>Candidaturas</dt><dd>${s.apps}</dd></div>
          <div><dt>Tarefas</dt><dd>${state.tasks.length}</dd></div>
          <div><dt>Guidelines</dt><dd>${s.guidelines}</dd></div>
          <div><dt>Versão do schema</dt><dd>${state.version}</dd></div>
          <div><dt>Atualizado</dt><dd>${esc(new Date(state.updatedAt).toLocaleString('pt-BR'))}</dd></div>
        </dl>
        <div class="form-actions wrap">
          <button class="btn ghost" id="exportData">Exportar JSON</button>
          <label class="btn ghost file-btn">Importar JSON<input type="file" id="importData" accept="application/json" hidden></label>
          <button class="btn danger-ghost" id="resetData">Apagar tudo</button>
        </div>
        <p class="muted small">Tudo fica em <code>chrome.storage.local</code> com espelho em <code>localStorage</code>. As chaves de API privadas são omitidas das exportações para sua segurança.</p>
      </section>

      <!-- ============ SOBRE ============ -->
      <section class="card" style="grid-column: 1 / -1;">
        <header class="card-head"><h3>Sobre o HOD</h3></header>
        <p class="muted small">
          HOD — central de carreira e processos do Home Office Digital, extensão Chrome Manifest V3 sem build e sem dependências.<br>
          Dados e chaves salvos estritamente em ambiente local seguro, com Obsidian como backend opcional.<br><br>
          Atalhos: <code>g h</code> início · <code>g a</code> candidaturas · <code>g t</code> tarefas · <code>g m</code> email · <code>g e</code> aprendizagem · <code>g r</code> rotina · <code>g k</code> métricas · <code>g i</code> central IA · <code>g s</code> configurações.
        </p>
      </section>
    </div>
  `;

  // Toggle visibilidade das senhas/chaves
  root.querySelectorAll('.btn-toggle-key').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetName = btn.dataset.target;
      const input = root.querySelector(`input[name="${targetName}"]`);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  // Salvar chaves de API
  root.querySelector('#apiKeysForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const updatedKeys = {};
    for (const p of AI_PROVIDERS) {
      const val = form.get(`key_${p.id}`);
      updatedKeys[p.id] = typeof val === 'string' ? val.trim() : '';
    }
    const chosenProvider = String(form.get('active_provider') || 'gemini');

    updateSettings('apiKeys', updatedKeys);
    updateSettings('ai', { provider: chosenProvider });
    await flush();
    toast('Chaves de API salvas com segurança local!');
    render(root);
  });

  const status = root.querySelector('#obsidianStatus');

  root.querySelector('#obsidianForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    updateSettings('obsidian', {
      enabled: form.get('enabled') === 'on',
      url: String(form.get('url')).trim(),
      key: String(form.get('key')).trim(),
      folder: String(form.get('folder')).trim(),
    });
    await flush();
    toast('Configuração salva');
  });

  root.querySelector('#testObsidian')?.addEventListener('click', async () => {
    if (!status) return;
    status.textContent = 'Testando…';
    try {
      await testConnection(getState().settings.obsidian);
      status.textContent = 'Conectado ao Obsidian ✔';
      toast('Conexão OK');
    } catch (err) {
      status.textContent = `Falhou: ${err.message}`;
      toast('Não foi possível conectar', 'error');
    }
  });

  root.querySelector('#pushObsidian')?.addEventListener('click', async () => {
    if (!status) return;
    const obsidian = getState().settings.obsidian;
    status.textContent = 'Enviando notas…';
    try {
      const { ok, total, errors } = await exportAll(obsidian, getState());
      if (!ok) throw new Error(errors[0] || 'Nenhuma nota foi gravada. Confira URL, chave e plugin ativo.');
      status.textContent = ok === total
        ? `${ok}/${total} notas gravadas no vault.`
        : `${ok}/${total} notas gravadas — ${total - ok} falharam.`;
      toast(ok === total ? 'Exportação concluída' : 'Exportação parcial', ok === total ? '' : 'error');
    } catch (err) {
      status.textContent = `Falhou: ${err.message}`;
      toast('Não foi possível exportar', 'error');
    }
  });

  root.querySelector('#downloadMd')?.addEventListener('click', () => {
    downloadMarkdownBundle(getState());
    toast('Markdown gerado');
  });

  root.querySelector('#exportData')?.addEventListener('click', async () => {
    const text = await exportJSON();
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hod-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado (chaves privadas omitidas por segurança)');
  });

  root.querySelector('#importData')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importJSON(await file.text());
      toast('Backup importado');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  root.querySelector('#resetData')?.addEventListener('click', async () => {
    if (await confirmAction('Apagar todas as candidaturas, tarefas e guidelines? Exporte um backup antes.', { confirmLabel: 'Apagar tudo' })) {
      await resetAll();
      toast('Dados apagados');
    }
  });
}
