import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const ROLES = Object.freeze({
  COLLECTOR_WRITE: 5,
  WORK_READ: 10,
  WORK_WRITE_LIMITED: 20,
  USER: 30,
  ADMIN: 40,
});

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(part => {
    const i = part.indexOf('=');
    return i < 0 ? [] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(pair => pair.length));
}

export async function loadAuth(authFile) {
  let stored;
  try {
    stored = JSON.parse(await fs.readFile(authFile, 'utf8'));
  } catch {
    stored = {
      version: 1,
      browserToken: crypto.randomBytes(32).toString('base64url'),
    };
    await fs.mkdir(path.dirname(authFile), { recursive: true });
    await fs.writeFile(authFile, JSON.stringify(stored, null, 2), { mode: 0o600 });
  }
  await fs.chmod(authFile, 0o600).catch(() => {});

  const tokens = [
    { value: stored.browserToken, role: 'ADMIN', name: 'browser-session' },
    { value: process.env.HOD_ADMIN_TOKEN, role: 'ADMIN', name: 'admin' },
    { value: process.env.HOD_USER_TOKEN, role: 'USER', name: 'user' },
    { value: process.env.HOD_WORK_READ_TOKEN, role: 'WORK_READ', name: 'work-read' },
    { value: process.env.HOD_WORK_WRITE_TOKEN, role: 'WORK_WRITE_LIMITED', name: 'work-write-limited' },
    { value: process.env.HOD_MCP_TOKEN, role: 'WORK_WRITE_LIMITED', name: 'mcp' },
    { value: process.env.HOD_COLLECTOR_TOKEN, role: 'COLLECTOR_WRITE', name: 'collector' },
  ].filter(token => token.value);

  return {
    authenticate(req) {
      const auth = String(req.headers.authorization || '');
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const cookie = parseCookies(req.headers.cookie).hod_session || '';
      const value = bearer || cookie;
      const token = tokens.find(item => safeEqual(item.value, value));
      return token ? { role: token.role, roleLevel: ROLES[token.role], name: token.name } : null;
    },
    setBrowserSession(res) {
      res.setHeader('set-cookie', `hod_session=${encodeURIComponent(stored.browserToken)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800`);
    },
  };
}

export function canAccess(actor, role) {
  return !!actor && actor.roleLevel >= ROLES[role];
}

export function isAllowedOrigin(req, host, port) {
  const origin = req.headers.origin;
  if (!origin) return true; // CLI clients must authenticate with a bearer token.
  return origin === `http://${host}:${port}` || origin === `https://${host}:${port}`;
}

export function validateLoopbackUrl(value, label) {
  if (!value) return '';
  let url;
  const invalid = message => Object.assign(new Error(message), { status: 400 });
  try { url = new URL(value); } catch { throw invalid(`${label}: URL inválida.`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw invalid(`${label}: protocolo não permitido.`);
  if (!['127.0.0.1', '::1', 'localhost'].includes(url.hostname)) {
    throw invalid(`${label}: somente serviços loopback são permitidos.`);
  }
  if (url.username || url.password || url.hash) throw invalid(`${label}: URL não pode conter credenciais ou fragmento.`);
  return url.toString().replace(/\/$/, '');
}
