/* ============================================================
   views/email.js — Correspondências analisadas pelo Hermes

   Antes: chamava um Apps Script fixo e, quando falhava, inventava
   e-mails no formato `recruiting@<empresa>.com` para preencher a
   tela. Agora não existe mais geração sintética: os e-mails vêm do
   conector de e-mail do Hermes (ou de um JSON importado) e ficam
   guardados no vault, em `.hod/bag.json`.

   Se o Hermes não estiver conectado, a tela diz isso com clareza e
   mostra como conectar — em vez de fingir que funcionou.
   ============================================================ */
import { esc, toast, timeAgo, emptyState, openModal } from '../ui.js';
import { getState, saveEmails, createTask } from '../store.js';
import * as api from '../api.js';

export const meta = { kicker: 'Comunicação', title: 'Correspondências' };

let busy = false;
let filterCompany = '';
let filterPriority = '';

const PRIORITY_TONE = { urgente: '#ef4444', importante: '#f59e0b', normal: '#38bdf8', baixa: '#8b95a5' };

export function render(root) {
  const state = getState();
  const conn = state.connections?.hermes || {};
  const hermesOn = !!(conn.enabled && state.sync.mode === 'vault');
  const apps = state.applications || [];
  const companies = [...new Set(apps.map(a => a.company).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const all = [...(state.emails || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const filtered = all.filter(e => {
    if (filterCompany && e.company !== filterCompany) return false;
    if (filterPriority && e.priority !== filterPriority) return false;
    return true;
  });

  const grouped = new Map();
  for (const e of filtered) {
    const key = e.company || 'Geral';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(e);
  }

  const urgent = all.filter(e => e.priority === 'urgente').length;

  root.innerHTML = `
    <div class="toolbar" style="margin-bottom:20px;">
      <div class="filters">
        <select id="emailCompanyFilter" aria-label="Filtrar por empresa">
          <option value="">Todas as empresas (${companies.length})</option>
          ${companies.map(c => `<option value="${esc(c)}" ${filterCompany === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select id="emailPriorityFilter" aria-label="Filtrar por prioridade">
          <option value="">Todas as prioridades</option>
          ${['urgente', 'importante', 'normal', 'baixa'].map(p => `<option value="${p}" ${filterPriority === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn ghost sm" id="importEmails">Importar JSON</button>
        <button class="btn primary" id="syncEmails" ${busy || !hermesOn ? 'disabled' : ''}>
          ${busy ? 'Analisando…' : 'Analisar com Hermes'}
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:14.5px;">Triagem de correspondências</strong>
            <span class="chip tiny" style="background:${hermesOn ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)'};color:${hermesOn ? '#4ade80' : 'var(--muted-2)'};">
              ${hermesOn ? 'Hermes conectado' : 'Hermes desconectado'}
            </span>
            ${urgent ? `<span class="chip tiny" style="background:rgba(239,68,68,.14);color:#fca5a5;">${urgent} urgente(s)</span>` : ''}
          </div>
          <p class="muted small" style="margin-top:4px;max-width:640px;">
            ${hermesOn
              ? 'O Hermes consulta a caixa de entrada pelo conector dele, resume as mensagens das últimas duas semanas e grava o resultado no vault.'
              : 'A análise usa o conector de e-mail do Hermes. Conecte o Hermes em Ajustes para habilitar — esta tela não inventa dados.'}
          </p>
        </div>
        <div style="text-align:right;">
          <span class="muted small">${all.length} mensagem(ns) no vault</span>
        </div>
      </div>
    </div>

    ${filtered.length === 0
      ? emptyState('✉', 'Nenhuma correspondência analisada',
          all.length
            ? 'Nenhum e-mail bate com os filtros atuais.'
            : 'As mensagens aparecem aqui depois que o Hermes analisa a caixa de entrada, ou quando você importa um JSON.',
          all.length ? '<button class="btn ghost" data-action="clear-email-filter">Limpar filtros</button>' : '<button class="btn ghost" data-action="email-help">Como conectar</button>')
      : `<div style="display:flex;flex-direction:column;gap:20px;">
          ${[...grouped.entries()].map(([company, emails]) => `
            <section class="card" style="padding:18px 22px;">
              <header class="card-head" style="margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <h3 style="margin:0;font-size:16px;">${esc(company)}</h3>
                  <span class="chip tiny">${emails.length}</span>
                </div>
                <a class="btn ghost sm" href="#/apps">Ver candidaturas</a>
              </header>
              <div style="display:flex;flex-direction:column;gap:14px;">
                ${emails.map(email => emailCard(email, company)).join('')}
              </div>
            </section>
          `).join('')}
        </div>`}
  `;

  /* ---------- filtros ---------- */
  root.querySelector('#emailCompanyFilter')?.addEventListener('change', e => {
    filterCompany = e.target.value;
    render(root);
  });
  root.querySelector('#emailPriorityFilter')?.addEventListener('change', e => {
    filterPriority = e.target.value;
    render(root);
  });
  root.querySelector('[data-action="clear-email-filter"]')?.addEventListener('click', () => {
    filterCompany = '';
    filterPriority = '';
    render(root);
  });
  root.querySelector('[data-action="email-help"]')?.addEventListener('click', showHelp);

  /* ---------- sincronizar via Hermes ---------- */
  root.querySelector('#syncEmails')?.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    render(root);
    try {
      const found = await analyzeWithHermes(companies);
      if (!found.length) {
        toast('O Hermes não retornou mensagens.', 'error');
      } else {
        const merged = mergeEmails(state.emails || [], found);
        await saveEmails(merged);
        toast(`${found.length} mensagem(ns) analisada(s)`);
      }
    } catch (err) {
      toast(`Falha na análise: ${err.message}`, 'error');
    } finally {
      busy = false;
      render(root);
    }
  });

  /* ---------- importar ---------- */
  root.querySelector('#importEmails')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const list = Array.isArray(parsed) ? parsed : parsed.emails;
        if (!Array.isArray(list)) throw new Error('JSON sem array "emails".');
        const clean = list.map(normalizeEmail).filter(e => e.subject);
        await saveEmails(mergeEmails(state.emails || [], clean));
        toast(`${clean.length} mensagem(ns) importada(s)`);
        render(root);
      } catch (err) {
        toast(`Importação falhou: ${err.message}`, 'error');
      }
    });
    input.click();
  });

  /* ---------- criar tarefa ---------- */
  root.querySelectorAll('.create-task-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const company = btn.getAttribute('data-company') || '';
      const action = btn.getAttribute('data-action') || 'Responder e-mail';
      const emailId = btn.getAttribute('data-email') || '';
      try {
        await createTask({
          title: company ? `[${company}] ${action}` : action,
          notes: `Origem: correspondência${emailId ? ` (${emailId})` : ''}.`,
          priority: 'importante',
          status: 'todo',
          appId: btn.getAttribute('data-app') || '',
        });
        toast('Tarefa criada');
        btn.disabled = true;
        btn.textContent = '✓ Criada';
      } catch (err) {
        toast(`Falha ao criar tarefa: ${err.message}`, 'error');
      }
    });
  });
}

/* ============================================================
   cartão de e-mail
   ============================================================ */
function emailCard(email, company) {
  const tone = PRIORITY_TONE[email.priority] || PRIORITY_TONE.normal;
  const action = email.suggestedAction || 'Responder';
  return `
    <article style="background:rgba(0,0,0,.2);border:1px solid var(--line);border-radius:10px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="width:8px;height:8px;border-radius:50%;background:${tone};display:inline-block;"></span>
            <strong style="font-size:14px;">${esc(email.subject || '(sem assunto)')}</strong>
            <span class="chip tiny" style="border-color:${tone};color:${tone};text-transform:uppercase;font-size:10px;">${esc(email.priority || 'normal')}</span>
          </div>
          <div class="muted small">
            ${email.from ? `De: <code>${esc(email.from)}</code>` : 'Remetente desconhecido'}
            ${email.date ? ` · ${timeAgo(email.date)}` : ''}
          </div>
        </div>
        <button class="btn ghost sm create-task-btn"
                data-company="${esc(company)}"
                data-action="${esc(action)}"
                data-email="${esc(email.id || '')}"
                data-app="${esc(email.appId || '')}">+ Criar tarefa</button>
      </div>

      ${(email.summary || email.snippet) ? `
        <div style="margin-top:10px;padding:10px 14px;border-radius:8px;background:rgba(56,189,248,.08);border-left:3px solid #38bdf8;font-size:13px;line-height:1.5;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#38bdf8;font-weight:600;margin-bottom:3px;">Resumo</div>
          <div>${esc(email.summary || email.snippet)}</div>
          ${email.suggestedAction ? `<div class="muted small" style="margin-top:6px;">Próximo passo: <strong>${esc(email.suggestedAction)}</strong></div>` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

/* ============================================================
   Hermes — pede a análise e exige JSON de volta
   ============================================================ */
async function analyzeWithHermes(companies) {
  const conn = getState().connections?.hermes || {};

  const system = [
    'Você é o Hermes, agente operacional do HOD.',
    'Use o seu conector de e-mail (Gmail/IMAP) para buscar mensagens recebidas nos últimos 14 dias.',
    'Foque em remetentes ligados às empresas listadas pelo usuário.',
    'Responda APENAS com um array JSON, sem texto antes ou depois, sem cercas de código.',
    'Cada item deve ter as chaves:',
    '  subject (string), from (string), date (ISO 8601), company (string),',
    '  priority ("urgente"|"importante"|"normal"|"baixa"),',
    '  summary (1-2 frases em português), suggestedAction (imperativo curto em português).',
    'Se não houver mensagens relevantes, responda exatamente [].',
  ].join('\n');

  const user = companies.length
    ? `Empresas de interesse: ${companies.join(', ')}.`
    : 'Não há empresas cadastradas; traga apenas mensagens de recrutadores e processos seletivos.';

  const raw = await api.hermesChatOnce({
    model: conn.model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  return parseJsonArray(raw).map(normalizeEmail).filter(e => e.subject);
}

function parseJsonArray(text) {
  if (!text) return [];
  let body = String(text).trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(body);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEmail(e = {}) {
  const priority = ['urgente', 'importante', 'normal', 'baixa'].includes(e.priority) ? e.priority : 'normal';
  return {
    id: e.id || `mail_${hash(`${e.subject || ''}|${e.from || ''}|${e.date || ''}`)}`,
    subject: String(e.subject || '').trim(),
    from: String(e.from || '').trim(),
    date: e.date || new Date().toISOString(),
    company: String(e.company || '').trim(),
    priority,
    summary: String(e.summary || e.snippet || '').trim(),
    snippet: String(e.snippet || '').trim(),
    suggestedAction: String(e.suggestedAction || '').trim(),
    appId: e.appId || '',
  };
}

function mergeEmails(current, incoming) {
  const byId = new Map(current.map(e => [e.id, e]));
  for (const e of incoming) byId.set(e.id, { ...byId.get(e.id), ...e });
  return [...byId.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ============================================================
   ajuda
   ============================================================ */
function showHelp() {
  openModal({
    title: 'Como as correspondências chegam aqui',
    wide: true,
    submitLabel: 'Fechar',
    cancelLabel: 'Fechar',
    body: `
      <div class="markdown" style="font-size:13px;line-height:1.7;">
        <p>Esta tela não finge ter dados. Há dois caminhos reais:</p>

        <h3>1. Hermes com conector de e-mail</h3>
        <p>Configure no Hermes um conector Gmail/IMAP, depois volte aqui e clique em
        <b>Analisar com Hermes</b>. Ele busca as mensagens das últimas duas semanas,
        resume e a página grava o resultado em <code>.hod/bag.json</code>.</p>
        <pre class="md-pre"><code># ~/.hermes/.env
API_SERVER_ENABLED=true
API_SERVER_KEY=uma-chave-longa</code></pre>

        <h3>2. Importar JSON manualmente</h3>
        <p>Útil para testar a interface sem Hermes. Formato aceito:</p>
        <pre class="md-pre"><code>[
  {
    "subject": "Entrevista técnica",
    "from": "recrutamento@empresa.com",
    "date": "2025-01-20T14:30:00Z",
    "company": "Empresa",
    "priority": "urgente",
    "summary": "Pedem disponibilidade para quinta.",
    "suggestedAction": "Confirmar horário"
  }
]</code></pre>

        <h3>3. Escrita direta pelo agente</h3>
        <p>O Hermes também pode gravar o arquivo <code>.hod/bag.json</code> direto no vault,
        usando a chave <code>emails</code>. A página recarrega ao reindexar.</p>
      </div>
    `,
  });
}
