/* ============================================================
   agents/vaga-agent.mjs — Agente 2: Vaga Collector
   
   Lê oportunidades coletadas em vault/Oportunidades/*.md
   → pontua match com perfil do usuário
   → enriquece nota com análise de compatibilidade
   → notifica HOD Assistant se match > 70%
   ============================================================ */
import { AgentBase } from './agent-base.mjs';

export class VagaAgent extends AgentBase {
  constructor(opts) {
    super({ ...opts, id: 'vaga' });
    this.systemPrompt = `Você é o Agente de Vagas do HOD (central de carreira).
Avalie a compatibilidade entre uma vaga e o perfil do usuário.
Retorne um JSON com:
{
  "matchScore": número de 0 a 100,
  "matchReason": "resumo em 1-2 frases de por que é compatível ou não",
  "highlights": ["ponto forte 1", "ponto forte 2"],
  "gaps": ["lacuna 1", "lacuna 2"],
  "recommendedAction": "candidatar|aguardar|descartar",
  "urgency": "alta|media|baixa"
}
Responda APENAS com o JSON, sem markdown, sem explicação.`;
  }

  async run({ state = {}, config = {} } = {}) {
    await this.setStatus({ running: true });
    const processed = [];
    const errors = [];

    const profile = config.profile || {};
    const profileContext = [
      `Nome: ${profile.name || 'Usuário'}`,
      `Habilidades: ${(profile.skills || []).join(', ') || 'não definidas'}`,
      `Cargos-alvo: ${(profile.targetRoles || []).join(', ') || 'não definidos'}`,
      `Preferência remoto: ${profile.preferRemote ? 'sim' : 'não'}`,
      `Idiomas: ${(profile.languages || ['Português']).join(', ')}`,
    ].join('\n');

    try {
      const oppNotes = await this.listNotes('Oportunidades');

      for (const rel of oppNotes) {
        try {
          const { data: fm, body } = await this.readNote(rel);
          if (fm.agent_scored) continue; // já avaliada

          const vagaContext = [
            `Título: ${fm.title || fm.role || '?'}`,
            `Empresa: ${fm.company || '?'}`,
            `Fonte: ${fm.source || '?'}`,
            `Localização: ${fm.location || 'não especificado'}`,
            `Remoto: ${fm.remote ? 'sim' : 'não'}`,
            `Descrição: ${body.slice(0, 1000)}`,
          ].join('\n');

          let analysis;
          try {
            const raw = await this.callAI({
              system: this.systemPrompt,
              user: `## Perfil do usuário\n${profileContext}\n\n## Vaga\n${vagaContext}`,
              maxTokens: 400,
            });
            analysis = JSON.parse(raw.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
          } catch {
            analysis = { matchScore: 50, matchReason: 'Avaliação manual necessária.', highlights: [], gaps: [], recommendedAction: 'aguardar', urgency: 'baixa' };
          }

          // Atualiza a nota com análise
          await this.writeNote(rel, {
            ...fm,
            agent_scored: true,
            scored_at: new Date().toISOString(),
            match_score: analysis.matchScore,
            recommended_action: analysis.recommendedAction,
            urgency: analysis.urgency,
          }, body + `\n\n---\n## Análise do Agente\n**Match:** ${analysis.matchScore}/100\n${analysis.matchReason}\n\n**Destaques:** ${(analysis.highlights || []).join(', ') || '—'}\n**Lacunas:** ${(analysis.gaps || []).join(', ') || '—'}\n**Ação:** ${analysis.recommendedAction}`);

          processed.push({ rel, score: analysis.matchScore });

          // Notifica HOD Assistant se boa oportunidade
          if (analysis.matchScore >= 70) {
            await this.postMessage({
              to: 'hod-assistant',
              subject: `Vaga compatível (${analysis.matchScore}%): ${fm.title || '?'}`,
              body: `Empresa: ${fm.company || '?'}\nMatch: ${analysis.matchScore}%\nAção: ${analysis.recommendedAction}\n${analysis.matchReason}`,
            });
          }
        } catch (err) {
          errors.push({ rel, error: err.message });
        }
      }

      const result = `${processed.length} vagas avaliadas, ${errors.length} erros`;
      await this.setStatus({ running: false, lastRun: new Date().toISOString(), lastResult: result, error: errors.length ? errors[0].error : null });
      return { ok: true, processed, errors };
    } catch (err) {
      await this.setStatus({ running: false, error: err.message });
      throw err;
    }
  }
}
