/* ============================================================
   api.js — cliente do servidor local do HOD

   A página roda em http://127.0.0.1:8420 servida pelo server.mjs.
   Quando ela é aberta sem servidor (file:// ou host estático), o
   cliente entra em modo `local` e tudo funciona só com localStorage.

   Nenhuma credencial vive aqui: as chaves do Hermes e do Obsidian
   ficam no servidor (`.hod-config.json`) e nunca chegam ao navegador.
   ============================================================ */

const BASE = '';

let serverInfo = null;
let serverChecked = false;

async function request(path, { method = 'GET', body, timeout = 20000, raw = false } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ac.signal,
    });
    if (raw) return res;
    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { data = { ok: res.ok, text }; }
    }
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- detecção de servidor ---------- */
export async function detectServer(force = false) {
  if (serverChecked && !force) return serverInfo;
  serverChecked = true;
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) {
    serverInfo = { mode: 'local', ok: false, reason: 'sem servidor (file://)' };
    return serverInfo;
  }
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    serverInfo = { mode: 'vault', ok: true, ...data };
  } catch (err) {
    serverInfo = { mode: 'local', ok: false, reason: err.message };
  }
  return serverInfo;
}

export function getServerInfo() { return serverInfo; }
export function isServerMode() { return serverInfo?.mode === 'vault'; }

/* ---------- estado ---------- */
export async function fetchState() {
  const data = await request('/api/state', { timeout: 20000 });
  return data.state;
}

export async function fetchHealth() {
  return request('/api/health', { timeout: 8000 });
}

/* ---------- registros ---------- */
export function putRecord(type, data) {
  return request('/api/records', { method: 'POST', body: { type, data } });
}

export function deleteRecord(type, id) {
  return request(`/api/records/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function putBag(patch) {
  return request('/api/bag', { method: 'POST', body: patch });
}

export function reindex() {
  return request('/api/reindex', { method: 'POST', timeout: 30000 });
}

/* ---------- configuração de conexões ---------- */
export async function fetchConfig() {
  const data = await request('/api/config', { timeout: 8000 });
  return data.config;
}

export async function saveConfig(patch) {
  const data = await request('/api/config', { method: 'POST', body: patch, timeout: 12000 });
  return data.config;
}

/* ---------- notas cruas ---------- */
export function readNote(path) {
  return request(`/api/note?path=${encodeURIComponent(path)}`);
}

export function writeNote(path, content) {
  return request('/api/note', { method: 'PUT', body: { path, content } });
}

/* ---------- Obsidian Local REST API (via proxy do servidor) ---------- */
export async function obsidianTest() {
  const res = await request('/api/obsidian/vault/', { timeout: 8000, raw: true });
  return res.ok;
}

export function obsidianRequest(tail, { method = 'POST', body, contentType = 'application/json' } = {}) {
  const headers = { 'content-type': contentType };
  const init = { method, headers };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return fetch(`/api/obsidian${tail}`, init).then(async res => {
    const text = await res.text();
    if (!res.ok) throw new Error(`Obsidian ${res.status}: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return text; }
  });
}

/* ---------- Hermes ---------- */
export async function hermesModels() {
  const data = await request('/api/hermes/models', { timeout: 10000 });
  return (data.data || []).map(m => ({ id: m.id, name: m.name || m.id }));
}

/**
 * Chat com streaming SSE.
 * @param {object} opts
 * @param {string} opts.model
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {(delta:string)=>void} opts.onDelta
 * @returns {Promise<string>} texto completo
 */
export async function hermesChatStream({ model, messages, onDelta, signal, temperature = 0.6 }) {
  const res = await fetch(`${BASE}/api/hermes/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, temperature }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Hermes HTTP ${res.status}`;
    try { msg = JSON.parse(text).error || msg; } catch { /* texto puro */ }
    throw new Error(msg);
  }

  if (!res.body) throw new Error('Streaming indisponível neste navegador.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content
          ?? json.choices?.[0]?.message?.content
          ?? json.delta
          ?? '';
        if (delta) { full += delta; onDelta?.(delta, full); }
      } catch { /* fragmento parcial */ }
    }
  }

  return full;
}

export async function hermesChatOnce({ model, messages, temperature = 0.4, timeout = 180000 }) {
  const data = await request('/api/hermes/chat', {
    method: 'POST',
    body: { model, messages, stream: false, temperature },
    timeout,
  });
  return data.choices?.[0]?.message?.content || '';
}
