/* ============================================================
   views/study.js — biblioteca de guidelines por empresa/projeto

   Novidades desta versão:
   • importar PDF / DOCX / TXT / MD direto para o vault (inbox/)
   • tradução deixa de ser botão morto: vira ação do agente Hermes
   • tutor contextual usa o Hermes com a guideline como contexto
   ============================================================ */
import { esc, safeExternalUrl, emptyState, miniMarkdown, relativeTime, toast, openModal, field, textarea, select, confirmAction } from '../ui.js';
import { getState, getGuideline, updateGuideline, deleteGuideline, createGuideline } from '../store.js';
import { uiState } from '../state.js';
import * as api from '../api.js';

export const meta = { kicker: 'Estudo', title: 'Guidelines e material de estudo' };

const MAX_FILE = 2 * 1024 * 1024; // 2 MB de texto extraído

const ACCEPT = '.md,.markdown,.txt,.pdf,.docx,.csv,.json';

export function render(root, params) {
  const state = getState();
  const f = uiState.study;
  const q = (f.q || '').toLowerCase();

  const companies = [...new Set(state.guidelines.map(g => g.company).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const guides = state.guidelines.filter(g => {
    if (q && !`${g.title} ${g.body} ${g.company || ''} ${g.project || ''} ${g.category || ''}`.toLowerCase().includes(q)) return false;
    if (f.app && g.appId !== f.app) return false;
    if (f.company && g.company !== f.company) return false;
    return true;
  });
  const selected = params.g ? getGuideline(params.g) : guides[0] || null;
  const linkedApp = selected?.appId ? state.applications.find(a => a.id === selected.appId) : null;
  const aiOn = !!state.connections?.ai?.enabled;

  root.innerHTML = `
    <div class="toolbar">
      <div class="filters">
        <input id="guideSearch" data-filter="study.q" value="${esc(f.q || '')}" placeholder="Buscar por projeto, empresa ou regras…" aria-label="Buscar guidelines">
        <select data-filter="study.company" aria-label="Filtrar por empresa">
          <option value="">Todas as empresas (${companies.length})</option>
          ${companies.map(c => `<option value="${esc(c)}" ${f.company === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select data-filter="study.app" aria-label="Filtrar por candidatura">
          <option value="">Todas as candidaturas</option>
          ${state.applications.map(a => `<option value="${esc(a.id)}" ${f.app === a.id ? 'selected' : ''}>${esc(a.company)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <label class="btn ghost file-btn">
          Importar arquivo
          <input type="file" id="guideFile" accept="${ACCEPT}" hidden>
        </label>
        <button class="btn primary" data-action="new-guide">+ Nova guideline</button>
      </div>
    </div>

    ${!state.guidelines.length ? emptyState('📚', 'Sua biblioteca está vazia',
      'Importe um PDF/DOCX ou cole as orientações de cada empresa. O agente pode traduzir, resumir e montar revisões.',
      `<div class="form-actions"><label class="btn primary file-btn">Importar arquivo<input type="file" id="guideFileEmpty" accept="${ACCEPT}" hidden></label><button class="btn ghost" data-action="new-guide">Criar à mão</button></div>`) : `
      <div class="study-grid">
        <aside class="guide-side">
          ${guides.length ? guides.map(g => {
            const app = state.applications.find(a => a.id === g.appId);
            const comp = g.company || app?.company || 'Geral';
            return `<button class="guide-item ${selected?.id === g.id ? 'active' : ''}" data-nav="#/study?g=${encodeURIComponent(g.id)}">
              <strong style="display:block;font-size:13.5px;margin-bottom:3px;">${esc(g.title)}</strong>
              <small class="muted" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="chip tiny" style="font-size:10px;padding:1px 6px;">${esc(comp)}</span>
                ${g.project ? `<span>· ${esc(g.project)}</span>` : ''}
                <span>· ${esc(g.language || '—')}</span>
              </small>
            </button>`;
          }).join('') : '<p class="muted pad">Nada encontrado com os filtros atuais.</p>'}
        </aside>

        <article class="guide-reader card">
          ${selected ? `
            <header class="card-head">
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                  <h3 style="margin:0;font-size:17px;">${esc(selected.title)}</h3>
                  ${selected.company ? `<span class="chip tiny" style="background:rgba(56,189,248,.14);color:#38bdf8;font-weight:600;">${esc(selected.company)}</span>` : ''}
                  ${selected.project ? `<span class="chip tiny">${esc(selected.project)}</span>` : ''}
                  ${selected.category ? `<span class="chip tiny" style="background:rgba(168,85,247,.14);color:#c084fc;">${esc(selected.category)}</span>` : ''}
                </div>
                <p class="muted small">
                  ${linkedApp ? `<a class="link" href="#/apps/${encodeURIComponent(linkedApp.id)}">${esc(linkedApp.company)}${linkedApp.role ? ' — ' + esc(linkedApp.role) : ''}</a> · ` : ''}
                  Idioma: <code>${esc(selected.language || 'não informado')}</code>
                  ${safeExternalUrl(selected.sourceUrl) ? ` · <a class="link" href="${safeExternalUrl(selected.sourceUrl)}" target="_blank" rel="noopener">fonte ↗</a>` : ''}
                  · Atualizado: ${relativeTime(selected.updatedAt)}
                </p>
              </div>
              <div class="head-actions">
                <button class="btn ghost sm" data-action="edit-guide" data-id="${esc(selected.id)}">Editar</button>
                <button class="icon-btn danger" data-action="del-guide" data-id="${esc(selected.id)}" aria-label="Excluir guideline">✕</button>
              </div>
            </header>

            <div class="guide-tools">
              <button class="btn primary sm" data-fera ${aiOn ? '' : 'disabled title="Configure a IA em Ajustes"'}>🐾 Estudar com FERA</button>
              <button class="btn ghost sm" data-translate ${aiOn ? '' : 'disabled title="Configure a IA em Ajustes"'}>Traduzir para PT-BR</button>
              <button class="btn ghost sm" data-summarize ${aiOn ? '' : 'disabled title="Configure a IA em Ajustes"'}>Resumir com o agente</button>
              <button class="btn ghost sm" data-copy>Copiar markdown</button>
              <span class="muted small">${aiOn ? 'Tutor FERA pronto com a guideline' : 'IA desativada (configure em Ajustes)'}</span>
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

  /* ---------- importação de arquivo ---------- */
  const handleFile = async input => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_FILE * 4) { toast('Arquivo grande demais (limite 8 MB).', 'error'); return; }
    toast(`Lendo ${file.name}…`);
    try {
      const text = await extractText(file);
      if (!text.trim()) throw new Error('Não consegui extrair texto deste arquivo.');
      const g = createGuideline({
        title: file.name.replace(/\.[^.]+$/, ''),
        body: text.slice(0, MAX_FILE),
        language: 'en',
      });
      // guarda cópia bruta no vault/inbox para o agente poder ler depois
      if (state.sync.mode === 'vault') {
        await api.writeNote(`inbox/${file.name}`, text).catch(() => {});
      }
      toast(`Guideline criada a partir de ${file.name}`);
      location.hash = `#/study?g=${g.id}`;
    } catch (err) {
      toast(`Falha ao importar: ${err.message}`, 'error');
    }
  };

  root.querySelector('#guideFile')?.addEventListener('change', e => handleFile(e.target));
  root.querySelector('#guideFileEmpty')?.addEventListener('change', e => handleFile(e.target));

  /* ---------- ações da guideline ---------- */
  root.querySelector('[data-copy]')?.addEventListener('click', async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.body || '');
      toast('Markdown copiado');
    } catch { toast('Não foi possível copiar', 'error'); }
  });

  root.querySelector('[data-fera]')?.addEventListener('click', async () => {
    if (!selected) return;
    await runAgentAction(root, selected, 'fera');
  });

  root.querySelector('[data-translate]')?.addEventListener('click', async () => {
    if (!selected) return;
    await runAgentAction(root, selected, 'translation');
  });

  root.querySelector('[data-summarize]')?.addEventListener('click', async () => {
    if (!selected) return;
    await runAgentAction(root, selected, 'summary');
  });
}

/* ============================================================
   extração de texto
   ============================================================ */
async function extractText(file) {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();

  if (name.endsWith('.pdf')) return extractPdfText(new Uint8Array(buf));
  if (name.endsWith('.docx')) return extractDocxText(buf);
  if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')
    || name.endsWith('.csv') || name.endsWith('.json')) {
    return new TextDecoder('utf-8').decode(buf);
  }
  // fallback: tenta como texto
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

/* PDF: extrai os streams de texto (FlateDecode via DecompressionStream) */
async function extractPdfText(bytes) {
  const latin = new TextDecoder('latin1').decode(bytes);
  const chunks = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(latin)) !== null) {
    const raw = m[1];
    const bytesOfStream = Uint8Array.from(raw, ch => ch.charCodeAt(0) & 0xff);
    let text = '';
    try {
      if (typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate');
        const stream = new Blob([bytesOfStream]).stream().pipeThrough(ds);
        text = new TextDecoder('latin1').decode(await new Response(stream).arrayBuffer());
      }
    } catch { text = raw; }
    if (!text) continue;
    const parts = [...text.matchAll(/\((?:\\.|[^\\()])*\)/g)].map(x => x[0].slice(1, -1));
    if (parts.length) chunks.push(parts.join(' '));
  }

  let out = chunks.join('\n\n')
    .replace(/\\([nrt])/g, (_, c) => ({ n: '\n', r: '', t: '\t' }[c] ?? ''))
    .replace(/\\([()\\])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (!out) throw new Error('PDF sem texto extraível (talvez seja digitalizado). Peça OCR ao agente.');
  return out;
}

/* DOCX: é um ZIP; lemos word/document.xml */
async function extractDocxText(arrayBuffer) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não suporta leitura de DOCX. Converta para .txt ou cole o texto.');
  }
  const files = await unzip(new Uint8Array(arrayBuffer));
  const doc = files.get('word/document.xml');
  if (!doc) throw new Error('DOCX inválido: word/document.xml não encontrado.');
  const xml = new TextDecoder('utf-8').decode(doc);
  const text = xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) throw new Error('DOCX sem texto.');
  return text;
}

/* unzip mínimo (apenas entradas DEFLATE/store) */
async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map();

  // localiza o End of Central Directory
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP inválido.');

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder('utf-8').decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    if (view.getUint32(localOffset, true) === 0x04034b50) {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) {
        out.set(name, data);
      } else if (method === 8) {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Blob([data]).stream().pipeThrough(ds);
          out.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
        } catch (err) {
          console.warn('[HOD] falha ao descomprimir', name, err);
        }
      }
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}

/* ============================================================
   ações delegadas ao agente
   ============================================================ */
async function runAgentAction(root, guideline, kind) {
  const state = getState();
  const original = (guideline.body || '').slice(0, 12000);

  if (!original.trim()) { toast('Esta guideline está vazia.', 'error'); return; }

  if (kind === 'fera') {
    modalBusy(root, 'FERA preparando a aula…', guideline.title);
    try {
      const res = await fetch(`/api/agent/run/guideline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ guidelineId: guideline.id }),
      });
      const data = await res.json();
      closeBusy();
      if (!data.ok) throw new Error(data.error || 'Erro ao executar o tutor FERA');
      
      openModal(`🐾 FERA — ${esc(guideline.title)}`, `
        <div style="max-height:60vh;overflow-y:auto;line-height:1.6;font-size:14px;">
          ${miniMarkdown(data.result)}
        </div>
      `, [
        { label: 'Fechar', kind: 'ghost', onClick: () => {} },
      ]);
    } catch (err) {
      closeBusy();
      toast(`FERA: ${err.message}`, 'error');
    }
    return;
  }

  const label = kind === 'translation' ? 'Traduzindo' : 'Resumindo';
  toast(`${label} com o agente…`);
  modalBusy(root, `${label}…`, guideline.title);

  const prompt = kind === 'translation'
    ? `Traduza para português do Brasil o documento abaixo. Preserve a estrutura em markdown, títulos e listas. Responda apenas a tradução.\n\n---\n\n${original}`
    : `Resuma o documento abaixo em português do Brasil, com: (1) objetivo em 1 frase, (2) regras importantes em lista, (3) o que preciso fazer para cumprir. Responda em markdown.\n\n---\n\n${original}`;

  try {
    const reply = await api.hermesChatOnce({
      messages: [
        { role: 'system', content: 'Você é o assistente operacional do HOD. Responda em português do Brasil, direto ao ponto.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });

    if (!reply.trim()) throw new Error('O agente não retornou conteúdo.');

    if (kind === 'translation') updateGuideline(guideline.id, { translation: reply });
    else updateGuideline(guideline.id, { body: `${guideline.body}\n\n---\n\n## Resumo do agente\n\n${reply}` });

    closeBusy();
    toast(kind === 'translation' ? 'Tradução salva na guideline' : 'Resumo anexado à guideline');
  } catch (err) {
    closeBusy();
    toast(`Falha na operação: ${err.message}`, 'error');
  }
}

let busyEl = null;

function modalBusy(root, title, subtitle) {
  closeBusy();
  busyEl = document.createElement('div');
  busyEl.className = 'agent-busy';
  busyEl.style.cssText = 'position:fixed;right:22px;bottom:96px;z-index:9000;padding:14px 18px;border-radius:12px;background:rgba(14,32,38,0.96);border:1px solid var(--line);box-shadow:0 12px 32px rgba(0,0,0,0.4);font-size:13px;color:var(--ink);max-width:320px;';
  busyEl.innerHTML = `<b>${esc(title)}</b><div class="muted small" style="margin-top:4px;">${esc(subtitle || '')}</div>`;
  document.body.appendChild(busyEl);
}

function closeBusy() {
  busyEl?.remove();
  busyEl = null;
}
