/* ============================================================
   server.mjs — servidor local do HOD (zero dependências)

   Responsabilidades:
   • servir a página (HTML/CSS/JS estáticos)
   • API REST sobre o vault Obsidian (fonte de verdade)
   • proxy para o Obsidian Local REST API (opcional)
   • proxy para o Hermes Agent (API OpenAI-compatível) com a
     chave mantida no servidor — o navegador nunca a vê
   • fallback de modo: sem vault configurado, usa ./vault

   Uso:
     node server.mjs                 # http://127.0.0.1:8420
     node server.mjs --port 9000
     node server.mjs --vault "/caminho/do/vault"
     HOD_VAULT=/caminho/do/vault node server.mjs
     HOD_CONFIG=/caminho/do/.hod-config.json node server.mjs
   ============================================================ */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vault, TYPES } from './lib/vault.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------- argumentos e ambiente ---------- */
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const PORT = Number(argOf('port', process.env.HOD_PORT || 8420));
const HOST = argOf('host', process.env.HOD_HOST || '127.0.0.1');
const VAULT_PATH = path.resolve(argOf('vault', process.env.HOD_VAULT || path.join(__dirname, 'vault')));
const CONFIG_FILE = path.resolve(
  argOf('config', process.env.HOD_CONFIG || path.join(__dirname, '.hod-config.json')),
);

const DEFAULTS = {
  obsidian: {
    enabled: false,
    url: 'http://127.0.0.1:27123',
    key: '',
    folder: '',
  },
  hermes: {
    enabled: false,
    url: 'http://127.0.0.1:8642',
    key: '',
    model: 'hermes-3-llama-3.1-405b',
    dashboard: 'http://127.0.0.1:9119',
  },
  routine: {
    slots: [
      { id: 'rot_1', start: '07:00', end: '08:30', label: 'Foco Total / Tarefas Críticas' },
      { id: 'rot_2', start: '08:30', end: '09:00', label: 'Revisão de E-mails & Comunicação' },
      { id: 'rot_3', start: '09:00', end: '11:00', label: 'Estudo de Guidelines & Preparação' },
      { id: 'rot_4', start: '11:00', end: '12:00', label: 'Avanço em Candidaturas' },
      { id: 'rot_5', start: '13:30', end: '15:30', label: 'Execução de Testes / Entrevistas' },
      { id: 'rot_6', start: '15:30', end: '17:00', label: 'Follow-ups & Fechamento do Dia' },
    ],
  },
  ui: { theme: 'dark' },
};

/* ---------- config do servidor (fora do vault) ---------- */
async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      obsidian: { ...DEFAULTS.obsidian, ...(parsed.obsidian || {}) },
      hermes: { ...DEFAULTS.hermes, ...(parsed.hermes || {}) },
      routine: { ...DEFAULTS.routine, ...(parsed.routine || {}) },
      ui: { ...DEFAULTS.ui, ...(parsed.ui || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

async function writeConfig(next) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

let config = await readConfig();
const vault = new Vault(VAULT_PATH);
await vault.init();

/* ---------- utilidades HTTP ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function sendError(res, status, message, extra = {}) {
  sendJSON(res, status, { ok: false, error: message, ...extra });
}

async function readRawBody(req, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Corpo da requisição muito grande.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readBody(req, limit = 8 * 1024 * 1024) {
  const raw = await readRawBody(req, limit);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}

/* ---------- proxy helpers ---------- */
async function proxyFetch(target, { method = 'GET', headers = {}, body } = {}, timeout = 30000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    return await fetch(target, { method, headers, body, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

function obsidianHeaders(extra = {}) {
  const h = { ...extra };
  if (config.obsidian.key) h.Authorization = `Bearer ${config.obsidian.key}`;
  return h;
}

function obsidianBase() {
  return String(config.obsidian.url || '').replace(/\/+$/, '');
}

function hermesBase() {
  const raw = String(config.hermes.url || '').replace(/\/+$/, '');
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}

function hermesHeaders(extra = {}) {
  const h = { 'content-type': 'application/json', ...extra };
  if (config.hermes.key) h.Authorization = `Bearer ${config.hermes.key}`;
  return h;
}

/* ============ status agregado ============ */
async function health() {
  const out = {
    ok: true,
    version: '4.0.0',
    vault: { path: VAULT_PATH, mode: 'filesystem' },
    obsidian: { configured: !!config.obsidian.url, enabled: config.obsidian.enabled, reachable: false, error: null },
    hermes: { configured: !!config.hermes.url, enabled: config.hermes.enabled, reachable: false, error: null, dashboard: config.hermes.dashboard },
  };

  try {
    const h = await vault.health();
    out.vault.notes = h.notes;
    out.vault.errors = h.errors;
  } catch (err) {
    out.vault.error = err.message;
    out.ok = false;
  }

  if (config.obsidian.url) {
    try {
      const res = await proxyFetch(`${obsidianBase()}/vault/`, {
        headers: obsidianHeaders({ Accept: 'application/json' }),
      }, 2500);
      out.obsidian.reachable = res.ok;
      if (!res.ok) out.obsidian.error = `HTTP ${res.status}`;
    } catch (err) {
      out.obsidian.error = err.name === 'AbortError' ? 'timeout' : err.message;
    }
  }

  if (config.hermes.url) {
    try {
      const res = await proxyFetch(`${hermesBase()}/models`, { headers: hermesHeaders() }, 2500);
      out.hermes.reachable = res.ok;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        out.hermes.models = (data.data || []).map(m => m.id).filter(Boolean);
      } else {
        out.hermes.error = `HTTP ${res.status}`;
      }
    } catch (err) {
      out.hermes.error = err.name === 'AbortError' ? 'timeout' : err.message;
    }
  }

  return out;
}

/* ============ roteador ============ */
async function handleAPI(req, res, url) {
  const { pathname } = url;
  const method = req.method || 'GET';

  /* ---- status ---- */
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, await health());
  }

  /* ---- estado derivado ---- */
  if (pathname === '/api/state' && method === 'GET') {
    const state = await vault.state();
    state.connections = publicConfig();
    return sendJSON(res, 200, { ok: true, state });
  }

  /* ---- upsert de registro ---- */
  if (pathname === '/api/records' && method === 'POST') {
    const body = await readBody(req);
    const type = String(body.type || '');
    if (!TYPES[type]) return sendError(res, 400, `Tipo inválido: ${type}`);
    const data = body.data || {};
    if (!data.id) return sendError(res, 400, 'Registro sem id.');
    const saved = await vault.put(type, data);
    return sendJSON(res, 200, { ok: true, ...saved });
  }

  /* ---- exclusão de registro ---- */
  const delMatch = /^\/api\/records\/([a-z]+)\/([^/]+)$/.exec(pathname);
  if (delMatch && method === 'DELETE') {
    const [, type, id] = delMatch;
    if (!TYPES[type]) return sendError(res, 400, `Tipo inválido: ${type}`);
    const out = await vault.remove(type, decodeURIComponent(id));
    return sendJSON(res, 200, { ok: true, ...out });
  }

  /* ---- dados sem nota (emails, calendário, drive) ---- */
  if (pathname === '/api/bag' && method === 'POST') {
    const body = await readBody(req);
    const allowed = ['emails', 'calendarEvents', 'driveFiles'];
    const patch = {};
    for (const k of allowed) if (Array.isArray(body[k])) patch[k] = body[k];
    const bag = await vault.putBag(patch);
    return sendJSON(res, 200, { ok: true, bag });
  }

  /* ---- configuração de conexões ---- */
  if (pathname === '/api/config' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, config: publicConfig() });
  }
  if (pathname === '/api/config' && method === 'POST') {
    const body = await readBody(req);
    const next = { ...config };
    for (const section of ['obsidian', 'hermes', 'routine', 'ui']) {
      if (body[section] && typeof body[section] === 'object') {
        next[section] = { ...next[section], ...body[section] };
      }
    }
    config = await writeConfig(next);
    await vault.putSettings({ connections: publicConfig() });
    return sendJSON(res, 200, { ok: true, config: publicConfig() });
  }

  /* ---- reindex ---- */
  if (pathname === '/api/reindex' && method === 'POST') {
    const index = await vault.scan(true);
    return sendJSON(res, 200, { ok: true, notes: index.records.length, errors: index.errors });
  }

  /* ---- notas cruas ---- */
  if (pathname === '/api/note' && method === 'GET') {
    const rel = url.searchParams.get('path');
    if (!rel) return sendError(res, 400, 'Informe ?path=');
    const content = await vault.readNote(rel);
    return sendJSON(res, 200, { ok: true, path: rel, content });
  }
  if (pathname === '/api/note' && method === 'PUT') {
    const body = await readBody(req);
    if (!body.path) return sendError(res, 400, 'Informe path.');
    const saved = await vault.writeNote(body.path, String(body.content || ''));
    return sendJSON(res, 200, { ok: true, path: saved });
  }

  /* ---- Obsidian Local REST API (proxy) ---- */
  if (pathname.startsWith('/api/obsidian/')) {
    if (!config.obsidian.url) return sendError(res, 400, 'Obsidian não configurado.');
    const tail = pathname.slice('/api/obsidian'.length);
    const target = `${obsidianBase()}${tail}${url.search}`;
    const hasBody = ['PUT', 'POST', 'PATCH'].includes(method);
    const init = {
      method,
      headers: obsidianHeaders({
        Accept: req.headers.accept || 'application/json',
        ...(hasBody ? { 'content-type': req.headers['content-type'] || 'text/markdown; charset=utf-8' } : {}),
      }),
      body: hasBody ? await readRawBody(req) : undefined,
    };
    try {
      const upstream = await proxyFetch(target, init, 15000);
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      });
      return res.end(text);
    } catch (err) {
      return sendError(res, 502, `Obsidian inacessível: ${err.message}`);
    }
  }

  /* ---- Hermes: status / modelos ---- */
  if (pathname === '/api/hermes/models' && method === 'GET') {
    if (!config.hermes.url) return sendError(res, 400, 'Hermes não configurado.');
    try {
      const upstream = await proxyFetch(`${hermesBase()}/models`, { headers: hermesHeaders() }, 10000);
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      });
      return res.end(text);
    } catch (err) {
      return sendError(res, 502, `Hermes inacessível: ${err.message}`);
    }
  }

  /* ---- Hermes: chat com streaming ---- */
  if (pathname === '/api/hermes/chat' && method === 'POST') {
    if (!config.hermes.url) return sendError(res, 400, 'Hermes não configurado.');
    const body = await readBody(req);
    const payload = {
      model: body.model || config.hermes.model,
      messages: Array.isArray(body.messages) ? body.messages : [],
      stream: body.stream !== false,
      temperature: body.temperature ?? 0.6,
    };
    if (body.tools) payload.tools = body.tools;

    try {
      const upstream = await proxyFetch(`${hermesBase()}/chat/completions`, {
        method: 'POST',
        headers: hermesHeaders({ Accept: payload.stream ? 'text/event-stream' : 'application/json' }),
        body: JSON.stringify(payload),
      }, 180000);

      if (!upstream.ok) {
        const text = await upstream.text();
        return sendError(res, upstream.status, text.slice(0, 900));
      }

      if (!payload.stream) {
        const text = await upstream.text();
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(text);
      }

      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        res.end();
      }
      return undefined;
    } catch (err) {
      if (res.headersSent) return res.end();
      return sendError(res, 502, `Hermes inacessível: ${err.message}`);
    }
  }

  /* ---- Hermes: enfileirar job (cron / gateway) ---- */
  if (pathname === '/api/hermes/run' && method === 'POST') {
    if (!config.hermes.url) return sendError(res, 400, 'Hermes não configurado.');
    const body = await readBody(req);
    try {
      const upstream = await proxyFetch(`${hermesBase()}/chat/completions`, {
        method: 'POST',
        headers: hermesHeaders(),
        body: JSON.stringify({
          model: body.model || config.hermes.model,
          messages: body.messages || [],
          stream: false,
        }),
      }, 180000);
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      });
      return res.end(text);
    } catch (err) {
      return sendError(res, 502, `Hermes inacessível: ${err.message}`);
    }
  }

  return sendError(res, 404, `Rota de API inexistente: ${pathname}`);
}

function publicConfig() {
  return {
    obsidian: {
      enabled: config.obsidian.enabled,
      url: config.obsidian.url,
      folder: config.obsidian.folder,
      hasKey: !!config.obsidian.key,
    },
    hermes: {
      enabled: config.hermes.enabled,
      url: config.hermes.url,
      model: config.hermes.model,
      dashboard: config.hermes.dashboard,
      hasKey: !!config.hermes.key,
    },
    routine: config.routine,
    ui: config.ui,
  };
}

/* ============ estáticos ============ */
const BLOCKED = new Set(['lib', 'vault', 'scripts', '.git', 'node_modules', '.tools', 'legacy-v1']);

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  const parts = rel.split('/').filter(Boolean);
  if (parts.some(p => p.startsWith('.')) || BLOCKED.has(parts[0])) {
    return sendError(res, 403, 'Caminho não servido.');
  }

  const full = path.join(__dirname, rel);
  if (!full.startsWith(__dirname)) return sendError(res, 403, 'Caminho inválido.');

  try {
    const stat = await fs.stat(full);
    if (stat.isDirectory()) return serveStatic(req, res, new URL(`${url.pathname}/index.html`, url.origin));
    const ext = path.extname(full).toLowerCase();
    const data = await fs.readFile(full);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': ext === '.html' ? 'no-store' : 'no-cache',
    });
    res.end(data);
  } catch {
    sendError(res, 404, `Não encontrado: ${rel}`);
  }
}

/* ============ servidor ============ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    });
    return res.end();
  }

  try {
    if (url.pathname.startsWith('/api/')) return await handleAPI(req, res, url);
    return await serveStatic(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    if (res.headersSent) return res.end();
    console.error(`[HOD] ${req.method} ${url.pathname} → ${status}: ${err.message}`);
    return sendError(res, status, err.message, err.current ? { current: err.current } : {});
  }
});

server.listen(PORT, HOST, () => {
  const noteCount = 'HOD 4.0';
  console.log(`\n  ${noteCount} — página local`);
  console.log(`  ▸ http://${HOST}:${PORT}`);
  console.log(`  ▸ vault: ${VAULT_PATH}`);
  console.log(`  ▸ obsidian: ${config.obsidian.enabled ? config.obsidian.url : 'desligado'}`);
  console.log(`  ▸ hermes:   ${config.hermes.enabled ? config.hermes.url : 'desligado'}\n`);
});

process.on('SIGINT', () => {
  console.log('\n  encerrando…');
  server.close(() => process.exit(0));
});
