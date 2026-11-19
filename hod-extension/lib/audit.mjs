import { promises as fs } from 'node:fs';
import path from 'node:path';

const SECRET = /pass(word)?|token|api.?key|cookie|secret|authorization|key$/i;
function sanitize(value, depth = 0) {
  if (depth > 5) return '[truncado]';
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitize(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET.test(key) ? '[redigido]' : sanitize(item, depth + 1)]));
  if (typeof value === 'string') return value.slice(0, 120000);
  return value;
}

export class AuditLog {
  constructor(root) { this.file = path.join(root, '.hod', 'audit.jsonl'); }
  async record({ actor = 'SYSTEM', origin = 'server', action, entity, entityId, before = null, after = null, outcome = 'success' }) {
    const event = { timestamp: new Date().toISOString(), actor, origin, action, entity, entity_id: entityId || '', outcome, before: sanitize(before), after: sanitize(after) };
    await fs.appendFile(this.file, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
    return event;
  }
  async recent(limit = 50) {
    try { return (await fs.readFile(this.file, 'utf8')).trim().split('\n').filter(Boolean).slice(-limit).reverse().map(JSON.parse); } catch { return []; }
  }
}
