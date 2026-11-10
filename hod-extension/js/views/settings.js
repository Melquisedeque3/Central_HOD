/* ============================================================
   views/settings.js — dados, Obsidian e estado das integrações
   ============================================================ */
import { esc, toast, confirmAction, field } from '../ui.js';
import { getState, exportJSON, importJSON, resetAll, updateSettings, flush, stats } from '../store.js';
import { testConnection, exportAll, downloadMarkdownBundle } from '../obsidian.js';

export const meta = { kicker: 'Ajustes', title: 'Configuração e dados' };

export function render(root) {
  const state = getState();
  const o = state.settings.obsidian;
  const s = stats();

  root.innerHTML = `
    <div class="settings-grid">
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
        <p class="muted small">Tudo fica em <code>chrome.storage.local</code> com espelho em <code>localStorage</code>. Faça backup antes de migrar de máquina.</p>
      </section>

      <section class="card">
        <header class="card-head"><h3>Integrações planejadas</h3></header>
        <ul class="roadmap">
          <li><b>Gmail</b><span class="chip tiny">fase 4</span><small>Triagem de e-mails das empresas e alertas de prazo.</small></li>
          <li><b>Google Calendar</b><span class="chip tiny">fase 4</span><small>Provas e entrevistas na agenda.</small></li>
          <li><b>Google Drive</b><span class="chip tiny">fase 4</span><small>Anexos e documentos por processo.</small></li>
          <li><b>IA BYOK</b><span class="chip tiny">fase 3</span><small>OpenRouter, Google AI, Groq, Nvidia — tradução, resumo e pesquisa.</small></li>
        </ul>
        <p class="muted small">Nenhuma chave é sincronizada entre dispositivos.</p>
      </section>

      <section class="card">
        <header class="card-head"><h3>Sobre</h3></header>
        <p class="muted small">
          HOD — central de carreira, extensão Chrome Manifest V3 sem build e sem dependências.<br>
          Dados locais, exportáveis, com Obsidian como backend opcional.<br><br>
          Atalhos: <code>g h</code> início · <code>g p</code> pipeline · <code>g t</code> tarefas · <code>g e</code> estudo.
        </p>
      </section>
    </div>
  `;

  const status = root.querySelector('#obsidianStatus');

  root.querySelector('#obsidianForm').addEventListener('submit', async e => {
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

  root.querySelector('#testObsidian').addEventListener('click', async () => {
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

  root.querySelector('#pushObsidian').addEventListener('click', async () => {
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

  root.querySelector('#downloadMd').addEventListener('click', () => {
    downloadMarkdownBundle(getState());
    toast('Markdown gerado');
  });

  root.querySelector('#exportData').addEventListener('click', async () => {
    const text = await exportJSON();
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hod-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado');
  });

  root.querySelector('#importData').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importJSON(await file.text());
      toast('Backup importado');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  root.querySelector('#resetData').addEventListener('click', async () => {
    if (await confirmAction('Apagar todas as candidaturas, tarefas e guidelines? Exporte um backup antes.', { confirmLabel: 'Apagar tudo' })) {
      await resetAll();
      toast('Dados apagados');
    }
  });
}
