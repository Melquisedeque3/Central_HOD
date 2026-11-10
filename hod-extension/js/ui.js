/* ============================================================
   ui.js — helpers de interface, datas, modais e feedback
   ============================================================ */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- datas ---------- */
const DAY = 86400000;

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const raw = String(value);
  // datas "YYYY-MM-DD" são interpretadas como locais, não UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(value) {
  const d = parseDate(value);
  if (!d) return null;
  const a = startOfDay(d).getTime();
  const b = startOfDay().getTime();
  return Math.round((a - b) / DAY);
}

export function fmtDate(value, opts = {}) {
  const d = parseDate(value);
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
    year: sameYear && !opts.alwaysYear ? undefined : 'numeric',
  }).replace('.', '');
}

export function fmtDateTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  const hasTime = typeof value === 'string' && (value.includes('T') || value.includes(':'));
  if (!hasTime) return fmtDate(value);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function toDateInput(value) {
  const d = parseDate(value);
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeInput(value) {
  const d = parseDate(value);
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${toDateInput(value)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dueInfo(value) {
  if (!value) return null;
  const n = daysUntil(value);
  if (n === null) return null;
  if (n < 0) return { days: n, tone: 'over', text: n === -1 ? '1 dia atrasado' : `${Math.abs(n)} dias atrasado` };
  if (n === 0) return { days: 0, tone: 'today', text: 'Hoje' };
  if (n === 1) return { days: 1, tone: 'soon', text: 'Amanhã' };
  if (n <= 7) return { days: n, tone: 'soon', text: `Em ${n} dias` };
  return { days: n, tone: 'normal', text: fmtDate(value) };
}

export function relativeTime(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h atrás`;
  const dias = Math.round(h / 24);
  if (dias < 30) return `${dias} d atrás`;
  return fmtDate(iso);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* ---------- componentes ---------- */
export function priorityDot(priority) {
  const colors = { urgente: '#ef8c8c', importante: '#f4c77a', normal: '#7ecbdb', baixa: '#8aacb1' };
  return `<span class="dot" style="--dot:${colors[priority] || colors.normal}" title="${esc(priority)}"></span>`;
}

export function chip(text, tone = '') {
  return `<span class="chip ${tone}">${esc(text)}</span>`;
}

export function emptyState(icon, title, text, action = '') {
  return `<div class="empty">
    <div class="empty-icon">${icon}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${action}
  </div>`;
}

export function progressBar(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
    <span style="width:${pct}%"></span>
  </div>`;
}

/* ---------- toast ---------- */
let toastTimer = null;
export function toast(message, tone = '') {
  let host = $('#toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  host.innerHTML = `<div class="toast ${tone}">${esc(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, 2600);
}

/* ---------- modal ---------- */
let activeModal = null;
let previousFocus = null;

export function openModal({ title, subtitle = '', body = '', submitLabel = 'Salvar', cancelLabel = 'Cancelar', danger = '', onSubmit = null, onMount = null, wide = false }) {
  closeModal();
  previousFocus = document.activeElement;
  const root = $('#modal-root');
  root.hidden = false;
  root.innerHTML = `
    <div class="modal-backdrop" data-close-modal></div>
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-head">
        <div>
          <h2 id="modal-title">${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <button class="icon-btn" data-close-modal aria-label="Fechar">✕</button>
      </header>
      <form class="modal-form" novalidate>
        <div class="modal-body">${body}</div>
        <footer class="modal-foot">
          ${danger ? `<button type="button" class="btn danger" data-modal-danger>${esc(danger)}</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-close-modal>${esc(cancelLabel)}</button>
          <button type="submit" class="btn primary">${esc(submitLabel)}</button>
        </footer>
      </form>
    </div>`;
  activeModal = root;
  const form = $('form', root);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!onSubmit) { closeModal(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const ok = await onSubmit(data, form);
    if (ok !== false) closeModal();
  });
  $$('[data-close-modal]', root).forEach(el => el.addEventListener('click', closeModal));
  if (onMount) onMount(root, form);
  const first = $('input:not([type=hidden]), textarea, select', form);
  first?.focus();
  return root;
}

export function closeModal() {
  const root = $('#modal-root');
  if (!root || root.hidden) return;
  root.hidden = true;
  root.innerHTML = '';
  activeModal = null;
  previousFocus?.focus?.();
}

export function confirmAction(message, { title = 'Confirmar', confirmLabel = 'Confirmar', danger = true } = {}) {
  return new Promise(resolve => {
    const root = $('#modal-root');
    root.hidden = false;
    root.innerHTML = `
      <div class="modal-backdrop" data-no></div>
      <div class="modal small" role="dialog" aria-modal="true">
        <header class="modal-head"><h2>${esc(title)}</h2></header>
        <div class="modal-body"><p class="confirm-text">${esc(message)}</p></div>
        <footer class="modal-foot">
          <span class="spacer"></span>
          <button class="btn ghost" data-no>Cancelar</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmLabel)}</button>
        </footer>
      </div>`;
    root.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', () => { root.hidden = true; root.innerHTML = ''; resolve(false); }));
    root.querySelector('[data-yes]').addEventListener('click', () => { root.hidden = true; root.innerHTML = ''; resolve(true); });
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeModal) closeModal();
});

/* ---------- campos ---------- */
export function field(label, name, value = '', { type = 'text', placeholder = '', required = false, hint = '' } = {}) {
  return `<label class="field">
    <span>${esc(label)}${required ? ' *' : ''}</span>
    <input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''}>
    ${hint ? `<small>${esc(hint)}</small>` : ''}
  </label>`;
}

export function textarea(label, name, value = '', { rows = 4, placeholder = '' } = {}) {
  return `<label class="field">
    <span>${esc(label)}</span>
    <textarea name="${name}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
  </label>`;
}

export function select(label, name, options, value = '') {
  return `<label class="field">
    <span>${esc(label)}</span>
    <select name="${name}">
      ${options.map(o => `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>
  </label>`;
}

/* ---------- markdown mínimo e seguro ---------- */
export function miniMarkdown(md) {
  const lines = esc(md || '').split('\n');
  let html = '';
  let inList = false;
  const inline = s => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
      continue;
    }
    closeList();
    if (/^###\s+/.test(line)) html += `<h4>${inline(line.replace(/^###\s+/, ''))}</h4>`;
    else if (/^##\s+/.test(line)) html += `<h3>${inline(line.replace(/^##\s+/, ''))}</h3>`;
    else if (/^#\s+/.test(line)) html += `<h3>${inline(line.replace(/^#\s+/, ''))}</h3>`;
    else if (line.trim() === '') html += '';
    else html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html || '<p class="muted">Sem conteúdo.</p>';
}
