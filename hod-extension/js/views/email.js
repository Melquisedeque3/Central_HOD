/* ============================================================
   views/email.js — Correspondências e triagem de e-mails

   SEGURANÇA:
   • Opera exclusivamente em modo somente leitura (gmail readonly).
   • Proibido qualquer envio, alteração ou deleção de mensagens.
   • Dupla verificação: domínio parceiro + palavras-chave de recrutamento.
   ============================================================ */
import { esc, toast, timeAgo, emptyState, openModal } from '../ui.js';
import { getState, saveEmails, createTask, reload } from '../store.js';
import * as api from '../api.js';

export const meta = { kicker: 'Comunicação', title: 'Correspondências' };

let busy = false;
let filterCompany = '';
let filterPriority = '';

const PRIORITY_TONE = { urgente: '#ef4444', importante: '#f59e0b', normal: '#38bdf8', baixa: '#8b95a5' };

export function render(root) {
  const state = getState();
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
    const key = String(e.from || e.company || 'Remetente desconhecido').trim().toLocaleLowerCase('pt-BR');
    if (!grouped.has(key)) grouped.set(key, { sender: e.from || e.company || 'Remetente desconhecido', emails: [] });
    grouped.get(key).emails.push(e);
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
        <button class="btn primary sm" id="btnSyncGmail" ${busy ? 'disabled' : ''}>
          ${busy ? 'Sincronizando…' : 'Sincronizar Gmail'}
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:14.5px;">Triagem de correspondências</strong>
            <span class="chip tiny" style="background:rgba(34,197,94,.15);color:#4ade80;">
              Gmail Conectado (Somente Leitura)
            </span>
            ${urgent ? `<span class="chip tiny" style="background:rgba(239,68,68,.14);color:#fca5a5;">${urgent} urgente(s)</span>` : ''}
          </div>
          <p class="muted small" style="margin-top:4px;max-width:640px;">
            Consulta segura à caixa de entrada (estritamente leitura). Filtra mensagens de recrutamento e plataformas parceiras (Turing, Appen, Outlier, etc.) e sincroniza com o vault.
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
            : 'As mensagens aparecem aqui depois de sincronizar com o Gmail ou quando você importar um arquivo JSON.',
          all.length ? '<button class="btn ghost" data-action="clear-email-filter">Limpar filtros</button>' : '<button class="btn ghost" data-action="email-help">Ajuda e Configurações</button>')
      : `<div class="email-sender-grid">
          ${[...grouped.entries()].map(([key, group]) => senderCard(key, group)).join('')}
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

  /* ---------- sincronizar via Gmail (somente leitura seguro) ---------- */
  root.querySelector('#btnSyncGmail')?.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    render(root);
    try {
      toast('Buscando e-mails recentes (somente leitura)...');
      const res = await api.syncGmail();
      if (res.ok) {
        toast(`Sincronização concluída: ${res.collectedCount || 0} novo(s) e-mail(s) triado(s).`);
        await reload();
        render(root);
      } else {
        toast(res.error || 'Nenhum e-mail novo encontrado.', 'info');
      }
    } catch (err) {
      toast(`Falha na sincronização Gmail: ${err.message}`, 'error');
    } finally {
      busy = false;
      render(root);
    }
  });

  root.querySelectorAll('.email-sender-open').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = grouped.get(btn.dataset.senderKey);
      if (group) openSenderModal(group.sender, group.emails);
    });
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
function senderCard(key, group) {
  const latest = group.emails[0];
  const tone = PRIORITY_TONE[latest.priority] || PRIORITY_TONE.normal;
  const company = latest.company || 'Geral';
  return `
    <button type="button" class="card email-sender-card email-sender-open" data-sender-key="${esc(key)}">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div style="min-width:0;text-align:left;">
          <div class="muted small" style="margin-bottom:6px;">Remetente</div>
          <strong style="display:block;font-size:14px;line-height:1.35;overflow-wrap:anywhere;">${esc(group.sender)}</strong>
        </div>
        <span class="chip tiny" style="border-color:${tone};color:${tone};white-space:nowrap;">${group.emails.length} mensagem(ns)</span>
      </div>
      <div style="margin-top:18px;text-align:left;">
        <div class="muted small">Mais recente · ${esc(company)} · ${latest.date ? esc(timeAgo(latest.date)) : 'sem data'}</div>
        <div style="font-weight:600;font-size:14px;line-height:1.4;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(latest.subject || '(sem assunto)')}</div>
      </div>
      <div class="muted small" style="margin-top:auto;padding-top:16px;text-align:left;">Clique para ver todas as mensagens deste remetente</div>
    </button>
  `;
}

function openSenderModal(sender, emails) {
  openModal({
    title: sender,
    subtitle: `${emails.length} mensagem(ns) armazenada(s) localmente, em modo somente leitura`,
    submitLabel: 'Fechar',
    cancelLabel: '',
    wide: true,
    body: `<div class="email-thread-list">
      ${emails.map(email => {
        const tone = PRIORITY_TONE[email.priority] || PRIORITY_TONE.normal;
        return `<details class="email-thread-item">
          <summary>
            <span style="min-width:0;"><strong>${esc(email.subject || '(sem assunto)')}</strong><small>${email.date ? esc(timeAgo(email.date)) : 'Sem data'} · ${esc(email.company || 'Geral')}</small></span>
            <span class="chip tiny" style="border-color:${tone};color:${tone};">${esc(email.priority || 'normal')}</span>
          </summary>
          <div class="email-thread-content">
            <p><strong>Resumo:</strong> ${esc(email.summary || 'Sem resumo disponível.')}</p>
            <p><strong>Ação sugerida:</strong> ${esc(email.suggestedAction || 'Revisar manualmente')}</p>
            <pre class="md-pre" style="max-height:36vh;overflow:auto;white-space:pre-wrap;">${esc(email.messageContent || email.summary || 'O conteúdo completo não estava disponível nesta coleta.')}</pre>
          </div>
        </details>`;
      }).join('')}
    </div>`,
  });
}

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
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn ghost sm email-detail-btn" data-email-id="${esc(email.id || '')}">Ver mensagem</button>
          <button class="btn ghost sm create-task-btn"
                  data-company="${esc(company)}"
                  data-action="${esc(action)}"
                  data-email="${esc(email.id || '')}"
                  data-app="${esc(email.appId || '')}">+ Criar tarefa</button>
        </div>
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
        <p>Esta tela exibe correspondências reais através de dois fluxos:</p>

        <h3>1. Sincronização segura com Gmail (Somente Leitura)</h3>
        <p>Basta clicar em <b>Sincronizar Gmail</b> no topo da tela. O coletor consulta a caixa de entrada em modo estritamente protegido, filtra por plataformas e palavras-chave de recrutamento e registra as mensagens no vault.</p>

        <h3>2. Importar JSON manualmente</h3>
        <p>Para carregar dados previamente exportados ou externos, use o botão <b>Importar JSON</b> com a seguinte estrutura:</p>
        <pre class="md-pre"><code>[
  {
    "subject": "Convite para entrevista técnica",
    "from": "recrutamento@empresa.com",
    "date": "2026-11-20T14:30:00Z",
    "company": "Empresa Exemplo",
    "priority": "urgente",
    "summary": "Solicitação de disponibilidade de horários.",
    "suggestedAction": "Confirmar disponibilidade"
  }
]</code></pre>
      </div>
    `,
  });
}
