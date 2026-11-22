/* ============================================================
   agents/hod-assistant.mjs — Agente 3: HOD Assistant
   
   Fonte de verdade: Obsidian Vault
   Função: responder perguntas do usuário com base nos dados do vault
   Acionamento: via /api/ai/chat (SSE streaming) — mantém voz e histórico
   ============================================================ */
import { AgentBase } from './agent-base.mjs';

export class HodAssistant extends AgentBase {
  constructor(opts) {
    super({ ...opts, id: 'hod-assistant' });
    this.systemPrompt = `Você é o assistente do HOD (Head of Dashboard), central de carreira pessoal do usuário.
Você tem acesso ao vault Obsidian do usuário com todas as candidaturas, tarefas, guidelines e rotinas.
Responda em português do Brasil. Seja direto, prático e baseado nos dados reais fornecidos.
Nunca invente dados. Se não souber algo, diga que não encontrou no vault.
Use markdown nas respostas. Para listas de ações, use bullet points numerados.`;
  }

  buildContext(state) {
    const apps = (state.applications || []).slice(0, 20);
    const tasks = (state.tasks || []).filter(t => t.status !== 'done').slice(0, 15);
    const guidelines = (state.guidelines || []).slice(0, 8);
    const emails = (state.emails || []).slice(0, 10);
    const opportunities = (state.opportunities || []).slice(0, 10);

    const lines = [
      `## Contexto atual do HOD (${new Date().toLocaleDateString('pt-BR')})`,
      '',
      `### Candidaturas ativas (${apps.length})`,
      ...apps.map(a => `- **${a.company}** — ${a.role || 'cargo n/d'} | etapa: ${a.stage} | prioridade: ${a.priority || 'normal'}${a.deadline ? ` | prazo: ${a.deadline}` : ''}`),
      '',
      `### Tarefas abertas (${tasks.length})`,
      ...tasks.map(t => `- ${t.title} | status: ${t.status} | prioridade: ${t.priority || 'normal'}${t.dueAt ? ` | prazo: ${t.dueAt.slice(0, 10)}` : ''}`),
      '',
      `### Guidelines disponíveis (${guidelines.length})`,
      ...guidelines.map(g => `- ${g.title}${g.language ? ` (${g.language})` : ''}`),
      '',
      `### Oportunidades coletadas (${opportunities.length})`,
      ...opportunities.map(o => `- **${o.company || '?'}** — ${o.title || o.role || '?'} | fonte: ${o.source || '?'} | status: ${o.status || 'found'}`),
      '',
      emails.length ? `### E-mails recentes (${emails.length})\n${emails.map(e => `- ${e.subject || '?'} — ${e.company || '?'}`).join('\n')}` : '',
    ];
    return lines.filter(l => l !== undefined).join('\n');
  }

  /* run() aqui é para execução em background (relatório automático).
     O chat interativo passa pelo endpoint /api/ai/chat no server.mjs */
  async run({ state = {} } = {}) {
    await this.setStatus({ running: true });
    try {
      const ctx = this.buildContext(state);
      const result = await this.callAI({
        system: this.systemPrompt,
        user: `${ctx}\n\n---\n\nGere um briefing diário conciso: 3 prioridades, 1 risco, 1 oportunidade em destaque. Formato markdown, máximo 200 palavras.`,
        maxTokens: 400,
      });
      const today = new Date().toISOString().slice(0, 10);
      await this.writeNote(
        `Relatorios/briefing-${today}.md`,
        { hod_type: 'report', title: `Briefing ${today}`, date: today, agent: 'hod-assistant' },
        result,
      );
      await this.setStatus({ running: false, lastRun: new Date().toISOString(), lastResult: `Briefing gerado: ${result.length} chars` });
      return { ok: true, result };
    } catch (err) {
      await this.setStatus({ running: false, error: err.message });
      throw err;
    }
  }

  /* Constrói system prompt + contexto para o chat interativo */
  buildChatSystem(state) {
    return this.systemPrompt + '\n\n' + this.buildContext(state);
  }
}
