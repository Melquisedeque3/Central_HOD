/* ============================================================
   agents/agent-runner.mjs — Roteador central de agentes HOD
   
   Importado pelo server.mjs via dynamic import quando chega
   POST /api/agent/run/:agentId
   ============================================================ */
import { HodAssistant } from './hod-assistant.mjs';
import { EmailAgent } from './email-agent.mjs';
import { VagaAgent } from './vaga-agent.mjs';
import { GuidelineAgent } from './guideline-agent.mjs';

const VAULT_PATH = '/Volumes/Sem Título 3/Home_Office/Obsidian Vault';

function makeAgent(id, aiConfig, extraOpts = {}) {
  const opts = { vaultPath: VAULT_PATH, aiConfig, ...extraOpts };
  switch (id) {
    case 'hod-assistant': return new HodAssistant(opts);
    case 'email':         return new EmailAgent(opts);
    case 'vaga':          return new VagaAgent(opts);
    case 'guideline':     return new GuidelineAgent(opts);
    default: throw new Error(`Agente desconhecido: ${id}`);
  }
}

export async function runAgent(agentId, { state = {}, config = {}, ...rest } = {}) {
  const aiConfig = config.ai || {};
  const agent = makeAgent(agentId, aiConfig, { feraPrompt: config.feraPrompt });
  return agent.run({ state, config, ...rest });
}

export async function getAgentStatus(agentId, { config = {} } = {}) {
  const agent = makeAgent(agentId, config.ai || {});
  return agent.getStatus();
}

export const AGENT_IDS = ['hod-assistant', 'email', 'vaga', 'guideline'];
