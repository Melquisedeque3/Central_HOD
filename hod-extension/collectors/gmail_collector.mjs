/* ============================================================
   collectors/gmail_collector.mjs — Coletor seguro do Gmail para HOD
   
   SEGURANÇA RÍGIDA:
   • Opera exclusivamente com 'gmail readonly' (sem mutate, sem send, sem delete).
   • Dupla verificação: domínio/remetente conhecido + palavras-chave de recrutamento.
   • Deposita e-mails brutos em vault/inbox/[id].md.
   • Aciona o Email Analyst Agent para categorização em Correspondencias/.
   ============================================================ */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNote } from '../lib/frontmatter.mjs';
import { writeFileAtomic } from '../lib/vault.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Domínios e remetentes mapeados da caixa de entrada do usuário
export const KNOWN_DOMAINS = [
  'turing.com',
  'micro1.ai',
  'appen.com',
  'crowdgen.com',
  'telusinternational.ai',
  'oneforma.com',
  'my.oneforma.com',
  'centific.com',
  'welocalize.com',
  'outlier.ai',
  'alignerr.com',
  'mercor.com',
  'afterquery.com',
  'userinterviews.com',
  'lever.co',
  'greenhouse.io',
  'smartrecruiters.com',
  'ashbyhq.com',
  'workday.com',
];

export const KEYWORDS = [
  'interview', 'assessment', 'onboarding', 'qualification', 'application',
  'vaga', 'candidatura', 'processo', 'recrutamento', 'teste', 'proposta',
  'contrato', 'selecao', 'feedback', 'project', 'ticket', 'round',
];

const MAX_MESSAGE_CHARS = 20_000;
const SAFE_GMAIL_ID = /^[A-Za-z0-9_-]{1,200}$/;

function decodeBody(data) {
  if (typeof data !== 'string' || !data) return '';
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      .toString('utf8')
      .replace(/\u0000/g, '');
  } catch { return ''; }
}

function htmlToText(value) {
  return String(value || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai apenas texto legível de uma mensagem Gmail multipart, sem HTML ativo. */
export function extractMessageText(message, limit = MAX_MESSAGE_CHARS) {
  const plain = [];
  const html = [];
  const visit = payload => {
    if (!payload || typeof payload !== 'object') return;
    const text = decodeBody(payload.body?.data);
    if (text) {
      if (payload.mimeType === 'text/plain') plain.push(text);
      else if (payload.mimeType === 'text/html') html.push(htmlToText(text));
    }
    for (const part of Array.isArray(payload.parts) ? payload.parts : []) visit(part);
  };
  visit(message?.payload);
  return (plain.join('\n\n') || html.join('\n\n') || String(message?.snippet || ''))
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, Math.max(1, limit));
}

const KNOWN_GMAIL_PATHS = [
  process.env.GMAIL_BIN,
  path.join(process.env.HOME || '/Users/melqui', '.gemini/antigravity/bin/gmail'),
  '/Users/melqui/.gemini/antigravity/bin/gmail',
  '/usr/local/bin/gmail',
  '/opt/homebrew/bin/gmail',
];

export async function getGmailBinary() {
  for (const p of KNOWN_GMAIL_PATHS) {
    if (!p) continue;
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  return 'gmail';
}

/**
 * Executa comando gmail CLI (sempre no namespace readonly)
 */
async function runGmail(args) {
  // Garantia absoluta de segurança: bloqueia qualquer argumento fora de readonly
  if (args[0] !== 'readonly') {
    throw new Error('Operação bloqueada: o coletor só tem permissão para comandos readonly.');
  }
  const bin = await getGmailBinary();
  const binDir = path.dirname(bin);
  const currentPath = process.env.PATH || '';
  const extendedPath = currentPath.includes(binDir) ? currentPath : `${binDir}:${currentPath}`;

  const { stdout } = await execFileAsync(bin, args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
    env: { ...process.env, PATH: extendedPath },
  });
  return stdout;
}

/**
 * Busca e coleta e-mails recentes com dupla verificação
 */
export async function collectGmailInbox({ vaultPath, maxEmails = 20 } = {}) {
  const vPath = vaultPath || process.env.HOD_VAULT || '/Volumes/Sem Título 3/Home_Office/Obsidian Vault';
  const inboxDir = path.join(vPath, 'inbox');
  await fs.mkdir(inboxDir, { recursive: true });

  const query = `newer_than:7d (${KEYWORDS.slice(0, 10).join(' OR ')})`;
  let messages = [];

  try {
    const rawSearch = await runGmail(['readonly', 'search', query, '--max', String(maxEmails), '--json']);
    messages = JSON.parse(rawSearch || '[]');
  } catch (err) {
    throw new Error(`Falha ao buscar e-mails: ${err.message}`);
  }

  const collected = [];
  const skipped = [];

  for (const m of messages) {
    if (!SAFE_GMAIL_ID.test(String(m.id || ''))) {
      skipped.push(String(m.id || 'inválido'));
      continue;
    }
    const noteFile = path.join(inboxDir, `${m.id}.md`);

    // Evita ler novamente mensagens já salvas
    try {
      await fs.access(noteFile);
      skipped.push(m.id);
      continue;
    } catch { /* arquivo não existe, prossegue com coleta */ }

    try {
      const rawMsg = await runGmail(['readonly', 'get', m.id, '--json']);
      const msg = JSON.parse(rawMsg);

      const headers = msg.payload?.headers || [];
      const getHeader = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');
      const snippet = msg.snippet || '';
      const messageText = extractMessageText(msg);

      // Dupla verificação: domínio conhecido OU palavras-chave fortes
      const senderLower = from.toLowerCase();
      const subjectLower = subject.toLowerCase();
      const snippetLower = snippet.toLowerCase();

      const isKnownDomain = KNOWN_DOMAINS.some(d => senderLower.includes(d));
      const hasKeywords = KEYWORDS.some(k => subjectLower.includes(k) || snippetLower.includes(k));

      if (!isKnownDomain && !hasKeywords) {
        skipped.push(m.id);
        continue;
      }

      // O corpo é convertido para texto simples e limitado. Nenhum HTML de
      // e-mail chega à interface ou é interpretado como instrução.
      const mdContent = buildNote({
        hod_type: 'email_inbox', email_id: m.id, from, subject, date,
        agent_processed: false, collected_at: new Date().toISOString(),
      }, [
        `## Assunto: ${subject}`,
        `**De:** ${from}  `,
        `**Data:** ${date}  `,
        '',
        '### Conteúdo:',
        messageText || snippet,
      ].join('\n'));

      await writeFileAtomic(noteFile, mdContent);
      collected.push({ id: m.id, from, subject, date });
    } catch (err) {
      console.warn(`[GmailCollector] Erro ao processar mensagem ${m.id}:`, err.message);
    }
  }

  // Executa o Email Analyst Agent para categorizar o que foi recém-coletado
  let agentReport = null;
  if (collected.length > 0) {
    try {
      const { runAgent } = await import('../agents/agent-runner.mjs');
      agentReport = await runAgent('email', { state: {} });
    } catch (err) {
      console.warn('[GmailCollector] Erro ao acionar EmailAgent:', err.message);
    }
  }

  return {
    ok: true,
    totalFound: messages.length,
    collectedCount: collected.length,
    collected,
    skippedCount: skipped.length,
    agentProcessed: agentReport?.processed || [],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  collectGmailInbox()
    .then(r => console.log('Coleta concluída:', JSON.stringify(r, null, 2)))
    .catch(e => console.error('Erro na coleta:', e));
}
