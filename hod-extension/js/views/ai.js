/* ============================================================
   views/ai.js — HOD Assistant (Agente 3)

   • conversa com streaming SSE via /api/ai/chat
   • ações contextuais com dados reais do vault
   • voz gratuita: Web Speech API (STT) + speechSynthesis (TTS)
   • histórico da sessão em sessionStorage
   • log de execuções em localStorage
   ============================================================ */
import { esc, toast, chatMarkdown, relativeTime } from '../ui.js';
import { getState, stats } from '../store.js';
import { uiState } from '../state.js';
import * as api from '../api.js';

export const meta = { kicker: 'Agente', title: 'HOD Assistant' };

const HISTORY_KEY = 'hod:assistant:history';
const LOG_KEY     = 'hod:assistant:log';

let history  = loadHistory();
let busy     = false;
let abortCtl = null;
let listening  = false;
let recognizer = null;

const VOICE_KEY = 'hod:assistant:voiceOut';
let voiceOut = (() => { try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; } })();
let voiceCtx = {};
let autoSend = false;

function setVoiceOut(on) {
  voiceOut = !!on;
  try { localStorage.setItem(VOICE_KEY, voiceOut ? '1' : '0'); } catch { /* ignora */ }
  if (!voiceOut) stopSpeaking();
}

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* ignora */ }
  return [];
}

function saveHistory() {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40))); } catch { /* ignora */ }
}

function loadLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function pushLog(entry) {
  const log = loadLog();
  log.unshift({ ...entry, at: new Date().toISOString() });
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 60))); } catch { /* ignora */ }
}

/* ============================================================
   ações contextuais
   ============================================================ */
function buildActions() {
  const state = getState();
  const st    = stats();
  const apps  = state.applications || [];
  const tasks = state.tasks        || [];

  const active  = apps.filter(a => a.stage !== 'encerrada');
  const overdue = tasks.filter(t => t.status !== 'done' && t.dueAt && new Date(t.dueAt) < new Date());
  const noNext  = active.filter(a => !a.nextAction);

  return [
    {
      id: 'briefing', icon: '☀', label: 'Briefing do dia',
      hint: 'Prioridades, prazos e o que fazer primeiro', enabled: true,
      build: () => {
        const today = tasks.filter(t => t.status !== 'done' && t.dueAt &&
          new Date(t.dueAt).toDateString() === new Date().toDateString());
        return {
          system: 'Você é o HOD Assistant, agente de carreira pessoal. Responda em português do Brasil, em markdown curto e acionável.',
          user: [
            'Monte meu briefing do dia. Seja específico e curto.',
            '',
            `Candidaturas ativas: ${active.length}${active.length ? ' — ' + active.slice(0, 8).map(a => `${a.company}${a.role ? ' (' + a.role + ')' : ''} [${a.stage}]`).join('; ') : ''}`,
            `Tarefas atrasadas: ${overdue.length}${overdue.length ? ' — ' + overdue.slice(0, 8).map(t => t.title).join('; ') : ''}`,
            `Tarefas de hoje: ${today.length}${today.length ? ' — ' + today.map(t => t.title).join('; ') : ''}`,
            `Tarefas abertas: ${st.openTasks}`,
            `Candidaturas sem próxima ação: ${noNext.length}${noNext.length ? ' — ' + noNext.slice(0, 6).map(a => a.company).join(', ') : ''}`,
            '',
            'Entregue: (1) as 3 coisas mais importantes hoje, (2) o que está travando, (3) uma ação de 15 minutos para destravar.',
          ].join('\n'),
        };
      },
    },
    {
      id: 'followup', icon: '✉', label: 'Rascunhar follow-up',
      hint: 'E-mail de retomada para processos parados', enabled: active.length > 0,
      build: () => {
        const target = [...active].sort((a, b) => {
          const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return da - db;
        })[0];
        return {
          system: 'Você é o HOD Assistant. Escreva e-mails profissionais, curtos e sem clichês. Responda em português do Brasil.',
          user: [
            `Escreva um e-mail de follow-up para a empresa ${target?.company || '(empresa)'}${target?.role ? ` referente à vaga de ${target.role}` : ''}.`,
            `Etapa atual: ${target?.stage || '—'}. Última ação: ${target?.nextAction || 'nenhuma'}.`,
            target?.appliedAt ? `Candidatura enviada em ${target.appliedAt}.` : '',
            '',
            'Formato: assunto em uma linha, corpo de até 130 palavras, tom cordial e objetivo, uma pergunta clara no fim. Sem emojis.',
          ].filter(Boolean).join('\n'),
        };
      },
    },
    {
      id: 'study-plan', icon: '📚', label: 'Plano de estudo',
      hint: 'Sequência de estudo a partir das guidelines', enabled: (state.guidelines || []).length > 0,
      build: () => {
        const guides = (state.guidelines || []).slice(0, 6);
        return {
          system: 'Você é o HOD Assistant, tutor de carreira. Responda em português do Brasil, em markdown.',
          user: [
            'Monte um plano de estudo de 5 dias para eu dominar o material abaixo. Cada dia com 45–60 minutos.',
            '',
            ...guides.map((g, i) => `${i + 1}. ${g.title}${g.language ? ` (${g.language})` : ''}\n${(g.body || '').slice(0, 900)}`),
            '',
            'Entregue uma tabela markdown: Dia | Foco | Tarefa concreta | Como verificar que aprendi.',
          ].join('\n'),
        };
      },
    },
    {
      id: 'pipeline-review', icon: '▦', label: 'Revisar pipeline',
      hint: 'Diagnóstico do funil e próximos passos', enabled: apps.length > 0,
      build: () => ({
        system: 'Você é o HOD Assistant, analista de funil de carreira. Responda em português do Brasil.',
        user: [
          'Diagnostique meu pipeline abaixo.',
          '',
          ...apps.map(a => `- ${a.company}${a.role ? ' — ' + a.role : ''} | etapa: ${a.stage} | prioridade: ${a.priority} | prazo: ${a.deadline || 'sem'} | próxima ação: ${a.nextAction || 'nenhuma'}`),
          '',
          'Entregue: (1) onde estou perdendo tração, (2) 3 candidaturas prioritárias e por quê, (3) uma ação concreta por candidatura.',
        ].join('\n'),
      }),
    },
    {
      id: 'priority-triage', icon: '⚖', label: 'Triar tarefas',
      hint: 'Reordenar a lista por impacto real',
      enabled: tasks.filter(t => t.status !== 'done').length > 0,
      build: () => {
        const open = tasks.filter(t => t.status !== 'done');
        return {
          system: 'Você é o HOD Assistant. Seja direto e prático. Responda em português do Brasil.',
          user: [
            'Triagem das minhas tarefas abertas. Diga o que fazer, adiar e descartar.',
            '',
            ...open.map(t => `- ${t.title} | prioridade: ${t.priority} | prazo: ${t.dueAt || 'sem'} | ${t.appLabel || ''}`),
            '',
            'Formato: três listas markdown — FAZER AGORA, ADIAR, DESCARTAR — com justificativa curta por item.',
          ].join('\n'),
        };
      },
    },
    {
      id: 'vault-audit', icon: '🗄', label: 'Auditar vault',
      hint: 'Notas incompletas e dados faltando', enabled: true,
      build: () => {
        const brokenApps  = apps.filter(a => !a.nextAction || !a.deadline);
        const brokenTasks = tasks.filter(t => t.status !== 'done' && !t.dueAt);
        return {
          system: 'Você é o HOD Assistant, curador do vault Obsidian. Responda em português do Brasil.',
          user: [
            'Audite a qualidade dos meus dados e me diga o que completar.',
            '',
            `Candidaturas sem próxima ação ou prazo: ${brokenApps.length} — ${brokenApps.slice(0, 10).map(a => a.company).join(', ') || 'nenhuma'}`,
            `Tarefas abertas sem prazo: ${brokenTasks.length} — ${brokenTasks.slice(0, 10).map(t => t.title).join('; ') || 'nenhuma'}`,
            `Guidelines: ${(state.guidelines || []).length}`,
            `E-mails analisados: ${(state.emails || []).length}`,
            '',
            'Liste os 10 ajustes de dados de maior impacto, em ordem, com o campo exato a preencher.',
          ].join('\n'),
        };
      },
    },
  ];
}

/* ============================================================
   render
   ============================================================ */
export function render(root) {
  const state   = getState();
  const aiCfg   = state.connections?.ai || {};
  const enabled = !!aiCfg.enabled;
  const model   = aiCfg.model || '';
  const actions = buildActions();
  const log     = loadLog();
  const tab     = uiState.ai?.tab || 'chat';

  root.innerHTML = `
    <div class="card" style="display:flex;flex-direction:column;height:calc(100vh - 190px);min-height:540px;box-sizing:border-box;">

      <header class="card-head" style="flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:12px 20px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">🤖</span>
          <div>
            <h3 style="font-size:15px;margin:0;">HOD Assistant</h3>
            <div style="display:flex;gap:8px;align-items:center;margin-top:3px;flex-wrap:wrap;">
              <span class="chip tiny" style="background:${enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};color:${enabled ? '#4ade80' : '#fca5a5'};">
                ${enabled ? '● ativo' : '○ desconectado'}
              </span>
              ${model ? `<span class="chip tiny" style="background:rgba(126,203,219,0.14);color:var(--accent);">${esc(model)}</span>` : ''}
              <span class="chip tiny" style="background:rgba(255,255,255,0.06);">vault: ${state.vault?.notes ?? 0} nota(s)</span>
              <span class="chip tiny" style="background:rgba(255,255,255,0.06);">${state.applications.length} vagas · ${stats().openTasks} tarefas</span>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="btn ghost sm" id="aiReload" title="Recarregar do servidor">↻</button>
          <button class="btn ghost sm" id="aiClear" title="Limpar conversa">🗑</button>
          <a href="#/settings" class="btn ghost sm" style="text-decoration:none;">⚙ Configurar IA</a>
        </div>
      </header>

      <div style="display:flex;gap:2px;padding:8px 16px 0;border-bottom:1px solid var(--line);">
        ${[['chat', 'Conversa'], ['actions', 'Ações'], ['agents', 'Agentes'], ['log', 'Execuções']].map(([id, label]) => `
          <button class="dock-tab ${tab === id ? 'is-active' : ''}" data-tab="${id}"
            style="padding:8px 14px;border:none;background:transparent;color:${tab === id ? 'var(--ink)' : 'var(--muted-2)'};font-size:13px;font-weight:${tab === id ? '600' : '400'};cursor:pointer;border-bottom:2px solid ${tab === id ? 'var(--accent)' : 'transparent'};">
            ${label}
          </button>
        `).join('')}
      </div>

      ${tab === 'chat'    ? renderChat(enabled)
      : tab === 'actions' ? renderActions(actions, enabled)
      : tab === 'agents'  ? renderAgents()
      : renderLog(log)}
    </div>
  `;

  wire(root, { enabled, model, actions });
}

function renderChat(enabled) {
  return `
    <div id="assistThread" style="flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;">
      ${!enabled ? `
        <div style="padding:14px 16px;border-radius:10px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;font-size:13px;line-height:1.6;">
          <strong>HOD Assistant não configurado.</strong>
          Configure o provedor e a chave de API em
          <a href="#/settings" style="color:#fff;text-decoration:underline;">Ajustes → Agente IA</a>.
          O sistema continua funcionando — só o chat de IA fica desligado.
        </div>
      ` : ''}

      ${!history.length ? `
        <div style="margin:auto;text-align:center;max-width:520px;color:var(--muted-2);font-size:13.5px;line-height:1.7;">
          <div style="font-size:36px;margin-bottom:10px;">🤖</div>
          <div style="color:var(--ink);font-size:15px;font-weight:500;margin-bottom:6px;">HOD Assistant</div>
          Seu vault Obsidian é a fonte de verdade. Faça perguntas sobre candidaturas, tarefas, guidelines e rotina.<br>
          Use <b>Ações</b> para começar com prompts contextualizados, ou fale pelo microfone.
        </div>
      ` : history.map(msg => bubble(msg)).join('')}
    </div>

    <div style="padding:12px 18px;border-top:1px solid var(--line);display:flex;gap:10px;align-items:flex-end;background:rgba(0,0,0,0.16);">
      <button class="btn ghost" id="aiMic" title="Falar (voz do sistema)" style="padding:10px 14px;">🎙</button>
      <button class="btn ghost ${voiceOut ? 'is-active' : ''}" id="aiSpeak"
        title="${voiceOut ? 'Voz ativa' : 'Voz desligada'}"
        style="padding:10px 14px;${voiceOut ? 'border-color:var(--accent);color:var(--accent);' : 'opacity:.65;'}">🔊</button>
      <textarea id="assistInput" rows="1"
        placeholder="${enabled ? 'Pergunte ao HOD Assistant… (Enter envia, Shift+Enter quebra linha)' : 'Configure o Agente IA em Ajustes'}"
        ${enabled ? '' : 'disabled'}
        style="flex:1;resize:none;padding:11px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--ink);font-size:13.5px;font-family:inherit;line-height:1.5;max-height:140px;outline:none;"></textarea>
      <button class="btn primary" id="assistSend" ${enabled ? '' : 'disabled'} style="padding:10px 18px;">Enviar ↵</button>
    </div>
  `;
}

function bubble(msg) {
  const isUser = msg.role === 'user';
  return `
    <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
      <div style="max-width:82%;padding:13px 17px;border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
        background:${isUser ? 'var(--accent)' : 'rgba(255,255,255,0.05)'};
        color:${isUser ? '#172a2f' : 'var(--ink)'};
        font-weight:${isUser ? '500' : '400'};font-size:13.5px;line-height:1.6;
        border:1px solid ${isUser ? 'transparent' : 'var(--line)'};overflow-wrap:anywhere;">
        ${isUser ? esc(msg.content).replace(/\n/g, '<br>') : chatMarkdown(msg.content)}
        ${!isUser && msg.error ? `<div class="muted small" style="margin-top:8px;color:#fca5a5;">${esc(msg.error)}</div>` : ''}
      </div>
    </div>`;
}

function renderActions(actions, enabled) {
  return `
    <div style="flex:1;padding:20px;overflow-y:auto;">
      <p class="muted small" style="margin-bottom:16px;">
        Cada ação monta um prompt com os dados reais do seu vault. Nada é inventado.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
        ${actions.map(a => `
          <button class="card" data-agent-action="${a.id}" ${(!enabled || !a.enabled) ? 'disabled' : ''}
            style="text-align:left;padding:16px 18px;cursor:${(!enabled || !a.enabled) ? 'not-allowed' : 'pointer'};opacity:${(!enabled || !a.enabled) ? 0.5 : 1};border:1px solid var(--line);background:rgba(255,255,255,0.03);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:18px;">${a.icon}</span>
              <strong style="font-size:14px;color:var(--ink);">${esc(a.label)}</strong>
            </div>
            <div class="muted small" style="font-size:12.5px;line-height:1.5;">${esc(a.hint)}</div>
            ${!a.enabled ? '<div class="muted small" style="margin-top:8px;font-size:11.5px;">sem dados suficientes</div>' : ''}
          </button>
        `).join('')}
      </div>
    </div>`;
}

function renderAgents() {
  const agents = [
    { id: 'email',         icon: '✉',  label: 'Email Analyst',   desc: 'Analisa emails da inbox e classifica por candidatura' },
    { id: 'vaga',          icon: '🎯',  label: 'Vaga Collector',  desc: 'Avalia oportunidades coletadas e pontua match com seu perfil' },
    { id: 'hod-assistant', icon: '🤖',  label: 'HOD Assistant',   desc: 'Responde perguntas com base no vault (este chat)' },
    { id: 'guideline',     icon: '📖',  label: 'Fera (Guideline)',desc: 'Explica guidelines didaticamente (andragogia)' },
  ];
  return `
    <div style="flex:1;padding:20px;overflow-y:auto;">
      <p class="muted small" style="margin-bottom:16px;">Execute um agente manualmente ou verifique o status da última execução.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
        ${agents.map(ag => `
          <div class="card" style="padding:16px 18px;border:1px solid var(--line);background:rgba(255,255,255,0.03);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span style="font-size:20px;">${ag.icon}</span>
              <strong style="font-size:14px;">${esc(ag.label)}</strong>
            </div>
            <div class="muted small" style="font-size:12.5px;line-height:1.5;margin-bottom:12px;">${esc(ag.desc)}</div>
            <div style="display:flex;gap:8px;">
              <button class="btn ghost sm" data-run-agent="${ag.id}">▶ Executar</button>
              <button class="btn ghost sm" data-status-agent="${ag.id}">Status</button>
            </div>
            <div id="agent-status-${ag.id}" class="muted small" style="margin-top:8px;font-size:11.5px;"></div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderLog(log) {
  return `
    <div style="flex:1;padding:20px;overflow-y:auto;">
      ${!log.length ? '<p class="muted pad">Nenhuma execução registrada nesta sessão.</p>' : `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${log.map(entry => `
            <div style="padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--line);">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;">
                <strong style="font-size:13px;color:var(--ink);">${esc(entry.label || entry.kind || 'execução')}</strong>
                <span class="muted small" style="font-size:11.5px;">${esc(relativeTime(entry.at))}</span>
              </div>
              <div class="muted small" style="font-size:12px;margin-top:4px;">
                ${entry.ok ? '✔ concluído' : '✕ falhou'}${entry.detail ? ' · ' + esc(entry.detail.slice(0, 180)) : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>`;
}

/* ============================================================
   wiring
   ============================================================ */
function wire(root, ctx) {
  const { enabled, model, actions } = ctx;
  voiceCtx = ctx;

  root.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!uiState.ai) uiState.ai = {};
      uiState.ai.tab = btn.dataset.tab;
      render(root);
    });
  });

  const thread = root.querySelector('#assistThread');
  if (thread) thread.scrollTop = thread.scrollHeight;

  const input = root.querySelector('#assistInput');
  const resize = () => {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(140, input.scrollHeight) + 'px';
  };
  input?.addEventListener('input', resize);

  root.querySelector('#assistSend')?.addEventListener('click', () => send(root, ctx));
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(root, ctx); }
  });

  root.querySelector('#aiClear')?.addEventListener('click', () => {
    history = [];
    saveHistory();
    render(root);
    toast('Conversa limpa');
  });

  root.querySelector('#aiReload')?.addEventListener('click', async () => {
    toast('Verificando configuração…');
    try {
      const health = await api.fetchHealth();
      const aiOk = health.ai?.configured && health.ai?.enabled;
      toast(aiOk ? `IA ativa: ${health.ai.provider} / ${health.ai.model}` : 'IA não configurada — acesse Ajustes', aiOk ? 'info' : 'error');
    } catch (err) {
      toast(`Servidor offline: ${err.message}`, 'error');
    }
  });

  root.querySelector('#aiMic')?.addEventListener('click', () => toggleMic(root, input));
  root.querySelector('#aiSpeak')?.addEventListener('click', () => {
    setVoiceOut(!voiceOut);
    render(root);
    toast(voiceOut ? 'Voz ligada' : 'Voz desligada');
  });

  root.querySelectorAll('[data-agent-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = actions.find(a => a.id === btn.dataset.agentAction);
      if (!action) return;
      const prompt = action.build();
      if (!uiState.ai) uiState.ai = {};
      uiState.ai.tab = 'chat';
      history.push({ role: 'user', content: `**${action.label}**\n\n${prompt.user.split('\n').slice(0, 2).join(' ')}…` });
      saveHistory();
      render(root);
      await stream(root, { ...ctx, system: prompt.system, user: prompt.user, label: action.label });
    });
  });

  /* aba Agentes — botões run/status */
  root.querySelectorAll('[data-run-agent]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.runAgent;
      const statusEl = root.querySelector(`#agent-status-${id}`);
      if (statusEl) statusEl.textContent = 'Executando…';
      btn.disabled = true;
      try {
        const res = await fetch(`/api/agent/run/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        if (statusEl) statusEl.textContent = data.ok ? `✔ ${data.lastResult || 'concluído'}` : `✕ ${data.error || 'erro'}`;
        pushLog({ label: `Agente: ${id}`, ok: data.ok, detail: data.lastResult || data.error || '' });
      } catch (err) {
        if (statusEl) statusEl.textContent = `✕ ${err.message}`;
      }
      btn.disabled = false;
    });
  });

  root.querySelectorAll('[data-status-agent]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.statusAgent;
      const statusEl = root.querySelector(`#agent-status-${id}`);
      try {
        const res = await fetch(`/api/agent/status/${id}`);
        const data = await res.json();
        const s = data.status || {};
        if (statusEl) statusEl.textContent = s.lastRun
          ? `Última execução: ${new Date(s.lastRun).toLocaleString('pt-BR')} — ${s.lastResult || ''}${s.error ? ' ⚠ ' + s.error : ''}`
          : 'Nunca executado';
      } catch (err) {
        if (statusEl) statusEl.textContent = `Erro: ${err.message}`;
      }
    });
  });

  if (ctx.tab !== 'agents') input?.focus();
}

/* ---------- envio ---------- */
async function send(root, ctx) {
  const input = root.querySelector('#assistInput');
  if (!input || busy) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  history.push({ role: 'user', content: text });
  saveHistory();
  render(root);
  await stream(root, { ...ctx, user: text });
}

async function stream(root, { model, system, user, label }) {
  if (busy) return;
  busy = true;
  abortCtl = new AbortController();

  const thread = root.querySelector('#assistThread');
  const pid = `stream-${Date.now()}`;
  if (thread) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;justify-content:flex-start;';
    wrap.innerHTML = `<div id="${pid}" style="max-width:82%;padding:13px 17px;border-radius:16px 16px 16px 4px;background:rgba(255,255,255,0.05);color:var(--ink);font-size:13.5px;line-height:1.6;border:1px solid var(--line);overflow-wrap:anywhere;">
      <span class="muted">pensando…</span></div>`;
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
  }

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  for (const m of history.slice(-12)) {
    if (m.role === 'user' || m.role === 'assistant') messages.push({ role: m.role, content: m.content });
  }
  if (user && !history.some(m => m.content === user)) messages.push({ role: 'user', content: user });

  const started = Date.now();
  let acc = '';

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, system, stream: true }),
      signal: abortCtl.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, '');
        if (line === '[DONE]') break;
        try {
          const chunk = JSON.parse(line);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            acc += delta;
            const el = document.getElementById(pid);
            if (el) {
              el.innerHTML = chatMarkdown(acc);
              if (thread) thread.scrollTop = thread.scrollHeight;
            }
          }
        } catch { /* ignora linha inválida */ }
      }
    }

    const answer = acc.trim();
    if (!answer) throw new Error('Resposta vazia do agente.');
    history.push({ role: 'assistant', content: answer });
    saveHistory();
    pushLog({ label: label || 'conversa', ok: true, detail: `${Math.round((Date.now() - started) / 1000)}s · ${answer.length} chars` });
    busy = false;
    render(root);
    if (voiceOut) speak(answer);
  } catch (err) {
    const aborted = err.name === 'AbortError';
    history.push({
      role: 'assistant',
      content: aborted ? '_(interrompido)_' : '⚠ Não consegui responder. Verifique a configuração do Agente IA em Ajustes.',
      error: aborted ? '' : err.message,
    });
    saveHistory();
    pushLog({ label: label || 'conversa', ok: false, detail: err.message });
    busy = false;
    render(root);
    if (!aborted) toast(`HOD Assistant: ${err.message}`, 'error');
  }
}

/* ---------- voz (mantém igual ao original) ---------- */
function toggleMic(root, input) {
  if (listening) { recognizer?.stop(); listening = false; return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Use Chrome/Edge para reconhecimento de voz.', 'error'); return; }
  stopSpeaking();
  autoSend = voiceOut;
  recognizer = new SR();
  recognizer.lang = 'pt-BR';
  recognizer.interimResults = true;
  recognizer.continuous = false;
  let base = input?.value || '';
  recognizer.onresult = event => {
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t; else interim += t;
    }
    if (input) input.value = (base + ' ' + final + interim).trim();
    if (final) base = (base + ' ' + final).trim();
  };
  recognizer.onerror = e => {
    listening = false;
    root.querySelector('#aiMic')?.classList.remove('is-listening');
    if (e.error !== 'aborted') toast(`Microfone: ${e.error}`, 'error');
  };
  recognizer.onend = () => {
    listening = false;
    root.querySelector('#aiMic')?.classList.remove('is-listening');
    if (autoSend && input && input.value.trim() && !busy) {
      const text = input.value.trim();
      input.value = '';
      history.push({ role: 'user', content: text });
      saveHistory(); render(root);
      stream(root, { ...voiceCtx, user: text });
    }
  };
  try {
    recognizer.start(); listening = true;
    root.querySelector('#aiMic')?.classList.add('is-listening');
    toast('Ouvindo…');
  } catch (err) { toast(`Microfone: ${err.message}`, 'error'); }
}

function pickPtVoice() {
  const voices = speechSynthesis.getVoices() || [];
  const score = v => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    let s = 0;
    if (lang === 'pt-br') s += 100; else if (lang.startsWith('pt')) s += 50; else return -1;
    if (v.localService) s += 10;
    if (/luciana|felipe|joana|daniel|maria|google/i.test(v.name || '')) s += 5;
    return s;
  };
  return voices.map(v => [score(v), v]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0])[0]?.[1] || null;
}

function speakable(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>|]/g, ' ')
    .replace(/^\s*[-•]\s*/gm, ' ').replace(/\s+/g, ' ').trim();
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const clean = speakable(text);
  if (!clean) return;
  const utter = new SpeechSynthesisUtterance(clean.slice(0, 800));
  const voice = pickPtVoice();
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang || 'pt-BR';
  utter.rate = 1.02;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
}
