/* ============================================================
   agents/agent-base.mjs — Classe base para todos os agentes HOD

   Responsabilidades:
   • lê vault (Markdown + frontmatter YAML) via filesystem
   • chama AI API (Gemini / OpenAI / Anthropic / Ollama)
   • escreve resultados de volta ao vault como notas .md
   • mensagens inter-agente via vault/.hod/agent-messages.json
   ============================================================ */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const AGENT_VERSION = '1.0.0';

/* helpers de frontmatter YAML mínimo (sem dependência) */
export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (!isNaN(val) && val !== '') val = Number(val);
    data[key] = val;
  }
  return { data, body: raw.slice(m[0].length).trim() };
}

export function buildFrontmatter(data, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && (v.includes(':') || v.includes("'") || v.includes('"')))
      lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  return lines.join('\n') + '\n\n' + (body || '');
}

/* ============================================================
   AgentBase
   ============================================================ */
export class AgentBase {
  /**
   * @param {object} opts
   * @param {string} opts.id          — identificador único do agente (ex: 'email', 'vaga')
   * @param {string} opts.vaultPath   — caminho absoluto do vault
   * @param {object} opts.aiConfig    — { provider, model, key, enabled }
   */
  constructor({ id, vaultPath, aiConfig = {} }) {
    this.id = id;
    this.vaultPath = vaultPath;
    this.aiConfig = aiConfig;
    this._messagesFile = path.join(vaultPath, '.hod', 'agent-messages.json');
    this._statusFile = path.join(vaultPath, '.hod', `agent-${id}-status.json`);
  }

  /* ---------- vault helpers ---------- */

  async readNote(rel) {
    const full = path.join(this.vaultPath, rel);
    const raw = await fs.readFile(full, 'utf8');
    return parseFrontmatter(raw);
  }

  async writeNote(rel, frontmatter, body) {
    const full = path.join(this.vaultPath, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buildFrontmatter(frontmatter, body), 'utf8');
    return rel;
  }

  async listNotes(dir) {
    const full = path.join(this.vaultPath, dir);
    try {
      const entries = await fs.readdir(full, { withFileTypes: true });
      return entries
        .filter(e => e.isFile() && e.name.endsWith('.md'))
        .map(e => path.join(dir, e.name));
    } catch { return []; }
  }

  /* ---------- AI call (sem streaming) ---------- */

  async callAI({ system, user, maxTokens = 1500 }) {
    const { provider = 'gemini', model, key } = this.aiConfig;
    if (!key) throw new Error('Chave de API não configurada.');

    if (provider === 'gemini') {
      return this._callGemini({ system, user, model: model || 'gemini-2.0-flash', key, maxTokens });
    }
    if (provider === 'openai') {
      return this._callOpenAI({ system, user, model: model || 'gpt-4o-mini', key, maxTokens, base: 'https://api.openai.com/v1' });
    }
    if (provider === 'anthropic') {
      return this._callAnthropic({ system, user, model: model || 'claude-3-haiku-20240307', key, maxTokens });
    }
    if (provider === 'ollama') {
      return this._callOpenAI({ system, user, model: model || 'llama3', key: '', maxTokens, base: 'http://127.0.0.1:11434/v1' });
    }
    throw new Error(`Provedor desconhecido: ${provider}`);
  }

  async _callGemini({ system, user, model, key, maxTokens }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const body = {
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
    };
    const res = await this._fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async _callOpenAI({ system, user, model, key, maxTokens, base }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });
    const res = await this._fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.4, stream: false }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `OpenAI ${res.status}`);
    return data.choices?.[0]?.message?.content || '';
  }

  async _callAnthropic({ system, user, model, key, maxTokens }) {
    const res = await this._fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature: 0.4,
        system: system || undefined,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic ${res.status}`);
    return data.content?.[0]?.text || '';
  }

  async _fetch(url, opts, timeout = 60000) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    try {
      return await fetch(url, { ...opts, signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- mensagens inter-agente ---------- */

  async postMessage({ to, subject, body }) {
    const msg = {
      id: crypto.randomUUID(),
      from: this.id,
      to,
      subject,
      body,
      at: new Date().toISOString(),
      read: false,
    };
    await fs.mkdir(path.dirname(this._messagesFile), { recursive: true });
    let msgs = [];
    try { msgs = JSON.parse(await fs.readFile(this._messagesFile, 'utf8')); } catch { /* ok */ }
    msgs.unshift(msg);
    if (msgs.length > 200) msgs = msgs.slice(0, 200);
    await fs.writeFile(this._messagesFile, JSON.stringify(msgs, null, 2), 'utf8');
    return msg;
  }

  async readMessages({ unreadOnly = true } = {}) {
    try {
      const raw = await fs.readFile(this._messagesFile, 'utf8');
      const msgs = JSON.parse(raw);
      const mine = msgs.filter(m => m.to === this.id || m.to === '*');
      return unreadOnly ? mine.filter(m => !m.read) : mine;
    } catch { return []; }
  }

  async markRead(ids) {
    try {
      const raw = await fs.readFile(this._messagesFile, 'utf8');
      const msgs = JSON.parse(raw);
      for (const m of msgs) if (ids.includes(m.id)) m.read = true;
      await fs.writeFile(this._messagesFile, JSON.stringify(msgs, null, 2), 'utf8');
    } catch { /* ok */ }
  }

  /* ---------- status do agente ---------- */

  async setStatus({ running = false, lastRun = null, lastResult = null, error = null }) {
    const status = { agentId: this.id, running, lastRun, lastResult, error, updatedAt: new Date().toISOString() };
    await fs.mkdir(path.dirname(this._statusFile), { recursive: true });
    await fs.writeFile(this._statusFile, JSON.stringify(status, null, 2), 'utf8');
    return status;
  }

  async getStatus() {
    try {
      return JSON.parse(await fs.readFile(this._statusFile, 'utf8'));
    } catch {
      return { agentId: this.id, running: false, lastRun: null, lastResult: null, error: null };
    }
  }

  /* ---------- método a sobrescrever ---------- */
  async run(context = {}) {
    throw new Error(`Agente ${this.id}: método run() não implementado.`);
  }
}
