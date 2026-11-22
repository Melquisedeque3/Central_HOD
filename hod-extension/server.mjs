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
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Vault, TYPES } from './lib/vault.mjs';
import { canAccess, isAllowedOrigin, loadAuth, validateLoopbackUrl } from './lib/security.mjs';
import { opportunityFingerprint, validateRecord } from './lib/validation.mjs';
import { BackupManager } from './lib/backups.mjs';
import { applyWorkAction, buildWorkContext } from './lib/work.mjs';
import { saveApplicationWithTaskSync, saveTaskWithAppSync, convertOpportunityToApplication } from './lib/sync.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------- argumentos e ambiente ---------- */
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const PORT = Number(argOf('port', process.env.HOD_PORT || 8420));
const HOST = argOf('host', process.env.HOD_HOST || '127.0.0.1');
const DEFAULT_VAULT = '/Volumes/Sem Título 3/Home_Office/Obsidian Vault';
const VAULT_PATH = path.resolve(argOf('vault', process.env.HOD_VAULT || DEFAULT_VAULT));
const CONFIG_FILE = path.resolve(
  argOf('config', process.env.HOD_CONFIG || path.join(__dirname, '.hod-config.json')),
);
const AUTH_FILE = path.resolve(argOf('auth', process.env.HOD_AUTH_FILE || path.join(__dirname, '.hod-auth.json')));

const DEFAULTS = {
  vault: DEFAULT_VAULT,
  obsidian: {
    enabled: false,
    url: 'http://127.0.0.1:27123',
    key: '',
    folder: '',
  },
  ai: {
    enabled: false,
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    key: '',
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
      ai: { ...DEFAULTS.ai, ...(parsed.ai || {}) },
      profile: parsed.profile || {},
      routine: { ...DEFAULTS.routine, ...(parsed.routine || {}) },
      ui: { ...DEFAULTS.ui, ...(parsed.ui || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

async function writeConfig(next) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(CONFIG_FILE, 0o600).catch(() => {});
  return next;
}

let config = await readConfig();
const auth = await loadAuth(AUTH_FILE);
const vault = new Vault(VAULT_PATH);
await vault.init();
const backups = new BackupManager(vault.root, { root: process.env.HOD_BACKUP_DIR || path.join(path.dirname(vault.root), '.hod-backups'), retention: process.env.HOD_BACKUP_RETENTION || 14 });
await backups.ensureDaily().catch(err => console.error(`[HOD] backup diário falhou: ${err.message}`));

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

async function readRawBody(req, limit = 512 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Corpo da requisição muito grande.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readBody(req, limit = 512 * 1024) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw Object.assign(new Error('Content-Type deve ser application/json.'), { status: 415 });
  }
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


/* ============ status agregado ============ */
async function health() {
  const out = {
    ok: true,
    version: '4.0.0',
    vault: { path: VAULT_PATH, mode: 'filesystem' },
    obsidian: { configured: !!config.obsidian.url, enabled: config.obsidian.enabled, reachable: false, error: null },
    ai: { configured: !!config.ai?.key, enabled: config.ai?.enabled, provider: config.ai?.provider, model: config.ai?.model },
  };

  try {
    const h = await vault.health();
    out.vault.notes = h.notes;
    out.vault.errors = h.errors;
  } catch (err) {
    out.vault.error = err.message;
    out.ok = false;
  }

  if (config.obsidian.enabled && config.obsidian.url) {
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

  /* bloco hermes removido — substituído por integração via AI config */

  return out;
}

/* ============ roteador ============ */
async function handleAPI(req, res, url) {
  const { pathname } = url;
  const method = req.method || 'GET';

  const actor = auth.authenticate(req);
  const auditActor = actor?.name === 'mcp' ? 'MCP' : actor?.name === 'collector' ? 'COLLECTOR' : actor?.role.startsWith('WORK') ? 'WORK' : 'USER';
  const requireRole = role => {
    if (!isAllowedOrigin(req, HOST, PORT)) {
      sendError(res, 403, 'Origem não permitida.');
      return false;
    }
    if (!canAccess(actor, role)) {
      sendError(res, 401, 'Autenticação ou permissão insuficiente.');
      return false;
    }
    return true;
  };

  /* ---- status ---- */
  if (pathname === '/api/health' && method === 'GET') {
    if (!actor) return sendJSON(res, 200, { ok: true, version: '4.0.0' });
    return sendJSON(res, 200, await health());
  }

  /* ---- interface mínima para ChatGPT Work ---- */
  if (pathname === '/work/context' && method === 'GET') {
    if (!requireRole('WORK_READ')) return;
    const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'daily';
    return sendJSON(res, 200, { ok: true, context: await buildWorkContext(vault, { period }) });
  }
  if (pathname === '/work/actions' && method === 'POST') {
    if (!requireRole('WORK_WRITE_LIMITED')) return;
    const body = await readBody(req);
    const output = await applyWorkAction(vault, body, { actor: auditActor, origin: actor?.name === 'mcp' ? 'mcp' : 'work' });
    return sendJSON(res, 201, { ok: true, ...output });
  }
  if (/^\/work\/routines\/(daily|weekly)$/.test(pathname) && method === 'GET') {
    if (!requireRole('WORK_READ')) return;
    const period = pathname.endsWith('/weekly') ? 'weekly' : 'daily';
    return sendJSON(res, 200, { ok: true, routine: await buildWorkContext(vault, { period }) });
  }

  /* ---- estado derivado ---- */
  if (pathname === '/api/state' && method === 'GET') {
    // O contexto do Work é deliberadamente reduzido e é servido somente em
    // /work/context. O estado completo continua sendo uma superfície humana.
    if (!requireRole('USER')) return;
    const state = await vault.state();
    state.connections = publicConfig();
    return sendJSON(res, 200, { ok: true, state });
  }

  /* ---- inbox determinístico de oportunidades para coletores autorizados ---- */
  if (pathname === '/api/opportunities' && method === 'GET') {
    if (!requireRole('USER')) return;
    const state = await vault.state();
    return sendJSON(res, 200, { ok: true, opportunities: state.opportunities || [] });
  }
  if (pathname === '/api/opportunities' && method === 'POST') {
    if (!requireRole('COLLECTOR_WRITE')) return;
    const body = await readBody(req);
    const data = body.data && typeof body.data === 'object' ? { ...body.data } : {};
    const fingerprint = [data.source, data.sourceId || data.url, data.title, data.company].map(value => String(value || '').trim().toLocaleLowerCase('pt-BR')).join('|');
    data.id = data.id || `opp_${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
    data.status = data.status || 'found';
    data.priority = data.priority || 'normal';
    data.collectedAt = data.collectedAt || new Date().toISOString();
    validateRecord('opportunity', data);
    // Coletores só criam itens novos. Repetir um anúncio não deve nem alterar
    // collectedAt, nem gerar um novo evento de auditoria: é idempotência real,
    // não apenas ausência de uma segunda nota.
    const existing = (await vault.scan()).records.find(record => record.type === 'opportunity' && record.id === data.id);
    if (existing && opportunityFingerprint(existing.data) === opportunityFingerprint(data)) {
      return sendError(res, 409, 'Oportunidade já coletada.');
    }
    const saved = await vault.put('opportunity', data, { actor: auditActor, origin: actor?.name === 'collector' ? 'collector' : 'api' });
    return sendJSON(res, 201, { ok: true, ...saved });
  }

  /* ---- upsert de registro ---- */
  if (pathname === '/api/records' && method === 'POST') {
    if (!requireRole('USER')) return;
    const body = await readBody(req);
    const type = String(body.type || '');
    if (!TYPES[type]) return sendError(res, 400, `Tipo inválido: ${type}`);
    const data = body.data || {};
    if (!data.id) return sendError(res, 400, 'Registro sem id.');

    if (type === 'application') {
      const resSync = await saveApplicationWithTaskSync(vault, data, {
        actor: auditActor,
        origin: 'api',
        adminCorrection: !!body.adminCorrection,
        reason: body.reason || data.closeReason || '',
      });
      return sendJSON(res, 200, { ok: true, ...resSync.application, syncedTask: resSync.task });
    }

    if (type === 'task') {
      const resSync = await saveTaskWithAppSync(vault, data, { actor: auditActor, origin: 'api' });
      return sendJSON(res, 200, { ok: true, ...resSync.task, syncedApp: resSync.application });
    }

    validateRecord(type, data);
    const saved = await vault.put(type, data, { actor: auditActor, origin: 'api' });
    return sendJSON(res, 200, { ok: true, ...saved });
  }

  /* ---- conversão de oportunidade em aplicação ---- */
  const convertMatch = /^\/api\/opportunities\/([^/]+)\/convert$/.exec(pathname);
  if (convertMatch && method === 'POST') {
    if (!requireRole('USER')) return;
    const body = await readBody(req);
    const oppId = decodeURIComponent(convertMatch[1]);
    const result = await convertOpportunityToApplication(vault, oppId, body.overrides || {}, { actor: auditActor, origin: 'api' });
    return sendJSON(res, 201, { ok: true, ...result });
  }

  /* ---- exclusão de registro ---- */
  const delMatch = /^\/api\/records\/([a-z]+)\/([^/]+)$/.exec(pathname);
  if (delMatch && method === 'DELETE') {
    if (!requireRole('USER')) return;
    const [, type, id] = delMatch;
    if (!TYPES[type]) return sendError(res, 400, `Tipo inválido: ${type}`);
    const out = await vault.remove(type, decodeURIComponent(id), { actor: auditActor, origin: 'api' });
    return sendJSON(res, 200, { ok: true, ...out });
  }

  /* ---- dados sem nota (emails, calendário, drive) ---- */
  if (pathname === '/api/bag' && method === 'POST') {
    if (!requireRole('USER')) return;
    const body = await readBody(req);
    const allowed = ['emails', 'calendarEvents', 'driveFiles'];
    const patch = {};
    for (const k of allowed) if (Array.isArray(body[k])) patch[k] = body[k];
    const bag = await vault.putBag(patch, { actor: auditActor, origin: 'api' });
    return sendJSON(res, 200, { ok: true, bag });
  }

  /* ---- configuração de conexões ---- */
  if (pathname === '/api/config' && method === 'GET') {
    if (!requireRole('ADMIN')) return;
    return sendJSON(res, 200, { ok: true, config: publicConfig() });
  }
  if (pathname === '/api/config' && method === 'POST') {
    if (!requireRole('ADMIN')) return;
    const body = await readBody(req);
    // Configuração é uma superfície sensível: rejeitar campos desconhecidos
    // impede que integrações removidas (como Hermes) sejam aceitas em silêncio
    // ou que endpoints arbitrários sejam introduzidos por acidente.
    const allowedConfigSections = new Set(['obsidian', 'ai', 'profile', 'routine', 'ui']);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowedConfigSections.has(key))) {
      return sendError(res, 400, 'Seção de configuração não permitida.');
    }
    const previousPublic = publicConfig();
    const next = { ...config };
    if (body.obsidian && typeof body.obsidian === 'object') {
      const patch = body.obsidian;
      next.obsidian = {
        ...next.obsidian,
        ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
        ...(patch.url !== undefined ? { url: validateLoopbackUrl(String(patch.url), 'Obsidian') } : {}),
        ...(typeof patch.key === 'string' ? { key: patch.key } : {}),
        ...(typeof patch.folder === 'string' ? { folder: patch.folder } : {}),
      };
    }
    if (body.ai && typeof body.ai === 'object') {
      const patch = body.ai;
      next.ai = {
        ...next.ai,
        ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
        ...(typeof patch.provider === 'string' ? { provider: patch.provider.slice(0, 40) } : {}),
        ...(typeof patch.model === 'string' ? { model: patch.model.slice(0, 160) } : {}),
        ...(typeof patch.key === 'string' ? { key: patch.key } : {}),
      };
    }
    if (body.profile && typeof body.profile === 'object') {
      next.profile = { ...next.profile, ...body.profile };
    }
    if (body.routine && typeof body.routine === 'object' && Array.isArray(body.routine.slots)) {
      next.routine = { ...next.routine, slots: body.routine.slots.slice(0, 24) };
    }
    if (body.ui && typeof body.ui === 'object' && typeof body.ui.theme === 'string') {
      next.ui = { ...next.ui, theme: body.ui.theme.slice(0, 40) };
    }
    config = await writeConfig(next);
    await vault.putSettings({ connections: publicConfig() });
    await vault.audit.record({ actor: auditActor, origin: 'api', action: 'CONFIG_UPDATE', entity: 'config', entityId: 'local', before: previousPublic, after: publicConfig() });
    return sendJSON(res, 200, { ok: true, config: publicConfig() });
  }

  /* ---- reindex ---- */
  if (pathname === '/api/reindex' && method === 'POST') {
    if (!requireRole('USER')) return;
    const index = await vault.scan(true);
    return sendJSON(res, 200, { ok: true, notes: index.records.length, errors: index.errors });
  }

  if (pathname === '/api/audit' && method === 'GET') {
    if (!requireRole('USER')) return;
    return sendJSON(res, 200, { ok: true, events: await vault.audit.recent(100) });
  }

  if (pathname === '/api/backups' && method === 'GET') {
    if (!requireRole('ADMIN')) return;
    return sendJSON(res, 200, { ok: true, backups: await backups.list() });
  }
  if (pathname === '/api/backups' && method === 'POST') {
    if (!requireRole('ADMIN')) return;
    const body = await readBody(req);
    const backup = await backups.create(String(body.reason || 'manual').slice(0, 40));
    await vault.audit.record({ actor: auditActor, origin: 'api', action: 'BACKUP', entity: 'vault', entityId: backup.id, after: { reason: backup.reason } });
    return sendJSON(res, 201, { ok: true, backup });
  }
  const restoreMatch = /^\/api\/backups\/([^/]+)\/restore$/.exec(pathname);
  if (restoreMatch && method === 'POST') {
    if (!requireRole('ADMIN')) return;
    const body = await readBody(req);
    if (body.confirm !== 'RESTORE') return sendError(res, 400, 'Confirmação RESTORE obrigatória.');
    const result = await backups.restore(decodeURIComponent(restoreMatch[1]));
    await vault.init();
    vault._cache = null;
    await vault.audit.record({ actor: auditActor, origin: 'api', action: 'RESTORE', entity: 'vault', entityId: result.restored, after: result });
    return sendJSON(res, 200, { ok: true, ...result });
  }

  /* ---- notas cruas ---- */
  if (pathname === '/api/note' && method === 'GET') {
    if (!requireRole('ADMIN')) return;
    const rel = url.searchParams.get('path');
    if (!rel) return sendError(res, 400, 'Informe ?path=');
    const content = await vault.readNote(rel);
    return sendJSON(res, 200, { ok: true, path: rel, content });
  }
  if (pathname === '/api/note' && method === 'PUT') {
    if (!requireRole('ADMIN')) return;
    const body = await readBody(req);
    if (!body.path) return sendError(res, 400, 'Informe path.');
    const saved = await vault.writeNote(body.path, String(body.content || ''));
    return sendJSON(res, 200, { ok: true, path: saved });
  }

  /* ---- Obsidian Local REST API (proxy) ---- */
  if (pathname.startsWith('/api/obsidian/')) {
    return sendError(res, 410, 'Proxy genérico do Obsidian desativado. Use documentos HOD autorizados.');
  }

  /* ---- AI: chat com streaming (SSE) — substitui /api/hermes/chat ---- */
  if (pathname === '/api/ai/chat' && method === 'POST') {
    if (!requireRole('ADMIN')) return;
    if (!config.ai?.enabled || !config.ai?.key) return sendError(res, 400, 'Agente IA não configurado. Acesse Ajustes → Agente IA.');
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const provider = body.provider || config.ai.provider || 'gemini';
    const model = body.model || config.ai.model || 'gemini-2.0-flash';
    const key = config.ai.key;
    const stream = body.stream !== false;

    try {
      if (provider === 'gemini') {
        /* Gemini não tem streaming SSE nativo igual OpenAI — fazemos non-stream e enviamos como SSE */
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const geminiBody = {
          system_instruction: body.system ? { parts: [{ text: body.system }] } : undefined,
          contents: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: body.max_tokens || 1500, temperature: body.temperature ?? 0.5 },
        };
        const upstream = await proxyFetch(geminiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(geminiBody),
        }, 120000);
        const data = await upstream.json();
        if (!upstream.ok) return sendError(res, upstream.status, data?.error?.message || 'Gemini error');
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
          /* simula streaming: envia em chunks de ~40 chars */
          const chunkSize = 40;
          for (let i = 0; i < text.length; i += chunkSize) {
            const delta = text.slice(i, i + chunkSize);
            const payload = JSON.stringify({ choices: [{ delta: { content: delta }, finish_reason: i + chunkSize >= text.length ? 'stop' : null }] });
            res.write(`data: ${payload}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          return res.end();
        } else {
          return sendJSON(res, 200, { choices: [{ message: { role: 'assistant', content: text } }] });
        }
      }

      /* OpenAI-compatible (openai, ollama, anthropic via openai-compat) */
      const baseMap = { openai: 'https://api.openai.com/v1', ollama: 'http://127.0.0.1:11434/v1', anthropic: 'https://api.anthropic.com/openai/v1' };
      const base = baseMap[provider] || 'https://api.openai.com/v1';
      const headers = { 'content-type': 'application/json', Accept: stream ? 'text/event-stream' : 'application/json' };
      if (key) headers.Authorization = `Bearer ${key}`;
      const upstream = await proxyFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, stream, temperature: body.temperature ?? 0.5, max_tokens: body.max_tokens || 1500 }),
      }, 120000);
      if (!upstream.ok) {
        const txt = await upstream.text();
        return sendError(res, upstream.status, txt.slice(0, 900));
      }
      if (!stream) {
        const txt = await upstream.text();
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(txt);
      }
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally { res.end(); }
      return undefined;
    } catch (err) {
      if (res.headersSent) return res.end();
      return sendError(res, 502, `AI inacessível: ${err.message}`);
    }
  }

  /* ---- Coletor Gmail ---- */
  if (pathname === '/api/collectors/gmail' && method === 'POST') {
    if (!requireRole('USER')) return;
    try {
      const { collectGmailInbox } = await import('./collectors/gmail_collector.mjs');
      const result = await collectGmailInbox({ vaultPath: VAULT_PATH });
      return sendJSON(res, 200, result);
    } catch (err) {
      return sendError(res, 500, `Erro na coleta do Gmail: ${err.message}`);
    }
  }

  /* ---- Agente: executar por ID ---- */
  if (/^\/api\/agent\/run\/([a-z-]+)$/.test(pathname) && method === 'POST') {
    if (!requireRole('ADMIN')) return;
    const agentId = pathname.split('/').pop();
    const body = await readBody(req);
    try {
      const { runAgent } = await import('./agents/agent-runner.mjs');
      const state = await vault.state();
      const result = await runAgent(agentId, { state, config: { ...config, profile: body?.profile || {} }, ...(body || {}) });
      return sendJSON(res, 200, { ok: true, agentId, ...result });
    } catch (err) {
      return sendError(res, 500, `Agente ${agentId}: ${err.message}`);
    }
  }

  /* ---- Agente: status ---- */
  if (/^\/api\/agent\/status\/([a-z-]+)$/.test(pathname) && method === 'GET') {
    if (!requireRole('ADMIN')) return;
    const agentId = pathname.split('/').pop();
    try {
      const { promises: fs2 } = await import('node:fs');
      const statusFile = `${VAULT_PATH}/.hod/agent-${agentId}-status.json`;
      const raw = await fs2.readFile(statusFile, 'utf8').catch(() => 'null');
      const status = JSON.parse(raw) || { agentId, running: false, lastRun: null };
      return sendJSON(res, 200, { ok: true, status });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  /* ---- Mensagens inter-agente ---- */
  if (pathname === '/api/agent/messages' && method === 'GET') {
    if (!requireRole('ADMIN')) return;
    try {
      const { promises: fs2 } = await import('node:fs');
      const msgsFile = `${VAULT_PATH}/.hod/agent-messages.json`;
      const raw = await fs2.readFile(msgsFile, 'utf8').catch(() => '[]');
      const msgs = JSON.parse(raw);
      const unread = url.searchParams.get('unread') === 'true';
      return sendJSON(res, 200, { ok: true, messages: unread ? msgs.filter(m => !m.read) : msgs.slice(0, 50) });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  return sendError(res, 404, `Rota de API inexistente: ${pathname}`);
}

function publicConfig() {
  return {
    vaultPath: VAULT_PATH,
    obsidian: {
      enabled: config.obsidian.enabled,
      url: config.obsidian.url,
      folder: config.obsidian.folder,
      hasKey: !!config.obsidian.key,
    },
    ai: {
      enabled: config.ai?.enabled ?? false,
      provider: config.ai?.provider ?? 'gemini',
      model: config.ai?.model ?? '',
      hasKey: !!(config.ai?.key),
    },
    profile: config.profile || {},
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/work/')) return await handleAPI(req, res, url);
    if (url.pathname === '/' || url.pathname === '/index.html') auth.setBrowserSession(res);
    return await serveStatic(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    if (res.headersSent) return res.end();
    console.error(`[HOD] ${req.method} ${url.pathname} → ${status}: ${err.message}`);
    const message = status >= 500 ? 'Erro interno ao processar a solicitação.' : err.message;
    return sendError(res, status, message, err.current ? { current: err.current } : {});
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  HOD 4.0 — página local`);
  console.log(`  ▸ http://${HOST}:${PORT}`);
  console.log(`  ▸ vault: ${VAULT_PATH}`);
  console.log(`  ▸ obsidian REST: ${config.obsidian.enabled ? config.obsidian.url : 'desligado'}`);
  console.log(`  ▸ agente IA: ${config.ai?.enabled ? `${config.ai.provider} / ${config.ai.model}` : 'desligado'}\n`);
});

process.on('SIGINT', () => {
  console.log('\n  encerrando…');
  server.close(() => process.exit(0));
});
