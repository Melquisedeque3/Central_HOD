#!/usr/bin/env node
/* MCP local por stdio. Não acessa vault: usa somente a API autenticada HOD. */
import readline from 'node:readline';

const base = String(process.env.HOD_API_URL || 'http://127.0.0.1:8420').replace(/\/$/, '');
const token = String(process.env.HOD_MCP_TOKEN || '');
const actions = new Set(['ADD_NOTE', 'UPDATE_STATUS', 'CREATE_TASK', 'UPDATE_PRIORITY', 'REGISTER_ANALYSIS', 'SCHEDULE_FOLLOWUP']);
const limit = 64 * 1024;

function reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
function fail(id, code, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`); }
async function api(path, init = {}) {
  if (!token) throw new Error('HOD_MCP_TOKEN não configurado.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}) }, signal: controller.signal });
    const text = await response.text();
    if (text.length > limit) throw new Error('Resposta HOD excede o limite MCP.');
    let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { throw new Error('Resposta HOD inválida.'); }
    if (!response.ok) throw new Error(body.error || `HOD HTTP ${response.status}`);
    return body;
  } finally { clearTimeout(timeout); }
}

const tools = [
  { name: 'hod_get_context', description: 'Lê o contexto operacional reduzido da HOD.', inputSchema: { type: 'object', properties: { period: { enum: ['daily', 'weekly'] } }, additionalProperties: false } },
  { name: 'hod_get_daily_routine', description: 'Lê a rotina diária reduzida da HOD.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'hod_get_weekly_routine', description: 'Lê a rotina semanal reduzida da HOD.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'hod_execute_action', description: 'Executa somente uma ação Work permitida e auditada.', inputSchema: { type: 'object', required: ['type', 'payload'], properties: { type: { enum: [...actions] }, payload: { type: 'object' } }, additionalProperties: false } },
];

async function callTool(name, args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Parâmetros MCP inválidos.');
  if (name === 'hod_get_context') {
    const period = args.period === 'weekly' ? 'weekly' : args.period === undefined || args.period === 'daily' ? 'daily' : null;
    if (!period || Object.keys(args).some(key => key !== 'period')) throw new Error('Parâmetros de contexto inválidos.');
    return api(`/work/context?period=${period}`);
  }
  if (name === 'hod_get_daily_routine' && Object.keys(args).length === 0) return api('/work/routines/daily');
  if (name === 'hod_get_weekly_routine' && Object.keys(args).length === 0) return api('/work/routines/weekly');
  if (name === 'hod_execute_action') {
    if (Object.keys(args).some(key => !['type', 'payload'].includes(key)) || !actions.has(args.type) || !args.payload || typeof args.payload !== 'object' || Array.isArray(args.payload)) throw new Error('Ação MCP não permitida.');
    return api('/work/actions', { method: 'POST', body: JSON.stringify({ type: args.type, payload: args.payload }) });
  }
  throw new Error('Ferramenta MCP inexistente.');
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', async line => {
  let request;
  try { request = JSON.parse(line); } catch { return fail(null, -32700, 'JSON inválido.'); }
  const id = request.id ?? null;
  try {
    if (request.method === 'initialize') return reply(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'hod-mcp', version: '1.0.0' } });
    if (request.method === 'tools/list') return reply(id, { tools });
    if (request.method === 'tools/call') {
      const result = await callTool(request.params?.name, request.params?.arguments || {});
      return reply(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    }
    return fail(id, -32601, 'Método MCP inexistente.');
  } catch (error) { return reply(id, { isError: true, content: [{ type: 'text', text: error.message } ] }); }
});
