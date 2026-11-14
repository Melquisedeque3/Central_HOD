/* ============================================================
   views/study.js — biblioteca de guidelines por empresa/projeto

   Novidades desta versão:
   • importar PDF / DOCX / TXT / MD direto para o vault (inbox/)
   • tradução deixa de ser botão morto: vira ação do agente Hermes
   • tutor contextual usa o Hermes com a guideline como contexto
   ============================================================ */
import { esc, emptyState, miniMarkdown, relativeTime, toast, openModal, field, textarea, select, confirmAction } from '../ui.js';
import { getState, getGuideline, updateGuideline, deleteGuideline, createGuideline } from '../store.js';
import { uiState } from '../state.js';
import * as api from '../api.js';

export const meta = { kicker: 'Estudo', title: 'Guidelines e material de estudo' };

const MAX_FILE = 2 * 1024 * 1024; // 2 MB de texto extraído

const ACCEPT = '.md,.markdown,.txt,.pdf,.docx,.csv,.json';

export function render(root, params) {
  const state = getState();
  const f = uiState.study;
  const q = f.q.toLowerCase();

  const guides = state.guidelines.filter(g =>
    (!q || `${g.title} ${g.body}`.toLowerCase().includes(q)) && (!f.app || g.appId === f.app)
  );
  const selected = params.g ? getGuideline(params.g) : guides[0] || null;
  const linkedApp = selected?.appId ? state.applications.find(a => a.id === selected.appId) : null;
  const hermesOn = !!state.connections?.hermes?.enabled;

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
              <button class="btn ghost sm" data-translate ${hermesOn ? '' : 'disabled title="Conecte o Hermes em Ajustes"'}>Traduzir para PT-BR</button>
              <button class="btn ghost sm" data-summarize ${hermesOn ? '' : 'disabled title="Conecte o Hermes em Ajustes"'}>Resumir com o agente</button>
              <button class="btn ghost sm" data-copy>Copiar markdown</button>
              <span class="muted small">${hermesOn ? 'Ações executadas pelo Hermes Agent' : 'Sem Hermes: ações de IA desativadas'}</span>
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
  const model = state.connections?.hermes?.model || '';
  const original = (guideline.body || '').slice(0, 12000);

  if (!original.trim()) { toast('Esta guideline está vazia.', 'error'); return; }

  const label = kind === 'translation' ? 'Traduzindo' : 'Resumindo';
  toast(`${label} com o Hermes…`);
  modalBusy(root, `${label}…`, guideline.title);

  const prompt = kind === 'translation'
    ? `Traduza para português do Brasil o documento abaixo. Preserve a estrutura em markdown, títulos e listas. Responda apenas a tradução.\n\n---\n\n${original}`
    : `Resuma o documento abaixo em português do Brasil, com: (1) objetivo em 1 frase, (2) regras importantes em lista, (3) o que preciso fazer para cumprir. Responda em markdown.\n\n---\n\n${original}`;

  try {
    const reply = await api.hermesChatOnce({
      model,
      messages: [
        { role: 'system', content: 'Você é o Hermes, agente operacional do HOD. Responda em português do Brasil, direto ao ponto.' },
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
    toast(`Hermes falhou: ${err.message}`, 'error');
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
