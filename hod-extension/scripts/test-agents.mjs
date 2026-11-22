import assert from 'node:assert/strict';
import { AgentBase, parseFrontmatter, buildFrontmatter } from '../agents/agent-base.mjs';
import { HodAssistant } from '../agents/hod-assistant.mjs';
import { EmailAgent } from '../agents/email-agent.mjs';
import { VagaAgent } from '../agents/vaga-agent.mjs';
import { GuidelineAgent } from '../agents/guideline-agent.mjs';
import { AGENT_IDS, runAgent, getAgentStatus } from '../agents/agent-runner.mjs';

console.log('Testando arquitetura de agentes...');

// 1. Frontmatter
const sample = `---\nhod_type: email\ncompany: "Google"\nurgent: true\n---\nCorpo da mensagem`;
const parsed = parseFrontmatter(sample);
assert.equal(parsed.data.hod_type, 'email');
assert.equal(parsed.data.company, 'Google');
assert.equal(parsed.data.urgent, true);
assert.equal(parsed.body, 'Corpo da mensagem');

const rebuilt = buildFrontmatter(parsed.data, parsed.body);
assert(rebuilt.includes('hod_type: email'));
assert(rebuilt.includes('company: Google'));
console.log('✔ parseFrontmatter e buildFrontmatter');

// 2. IDs dos agentes
assert.deepEqual(AGENT_IDS, ['hod-assistant', 'email', 'vaga', 'guideline']);
console.log('✔ AGENT_IDS registrados');

// 3. Instanciação de cada agente
const mockOpts = { vaultPath: '/tmp', aiConfig: { provider: 'gemini', model: 'gemini-2.0-flash', key: 'test' } };
const hod = new HodAssistant(mockOpts);
const email = new EmailAgent(mockOpts);
const vaga = new VagaAgent(mockOpts);
const guide = new GuidelineAgent(mockOpts);

assert.equal(hod.id, 'hod-assistant');
assert.equal(email.id, 'email');
assert.equal(vaga.id, 'vaga');
assert.equal(guide.id, 'guideline');
console.log('✔ Instanciação dos 4 agentes');

// 4. HOD Assistant buildContext
const ctx = hod.buildContext({
  applications: [{ company: 'Empresa X', role: 'Dev', stage: 'entrevista' }],
  tasks: [{ title: 'Fazer teste', status: 'pending', priority: 'high' }],
  guidelines: [{ title: 'Guia de Avaliação' }],
  opportunities: [{ company: 'Empresa Y', title: 'Data Rater' }],
  emails: [{ subject: 'Resposta processo', company: 'Empresa X' }],
});
assert(ctx.includes('Empresa X'));
assert(ctx.includes('Fazer teste'));
assert(ctx.includes('Guia de Avaliação'));
assert(ctx.includes('Empresa Y'));
console.log('✔ HOD Assistant buildContext');

console.log('\nTodos os testes de agentes passaram com sucesso!');
