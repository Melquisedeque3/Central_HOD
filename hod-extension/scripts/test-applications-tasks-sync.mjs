/* ============================================================
   scripts/test-applications-tasks-sync.mjs
   
   Suíte completa de testes para:
   • Novas etapas do Kanban (5 colunas)
   • Validação de transições de status (válidas, inválidas e correção administrativa)
   • Oportunidades e conversão para Aplicações
   • Sincronização bidirecional e atômica Candidatura ↔ Tarefa
   • Tarefas independentes e notas isoladas
   • Migração com backup
   ============================================================ */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Vault } from '../lib/vault.mjs';
import { canTransition, STAGES, VALID_TRANSITIONS } from '../lib/validation.mjs';
import {
  saveApplicationWithTaskSync,
  saveTaskWithAppSync,
  convertOpportunityToApplication,
  validateStageTransition,
} from '../lib/sync.mjs';
import { migrateVaultStages } from './migrate-stages.mjs';

console.log('🧪 Iniciando testes de Oportunidades, Aplicações e Tarefas...');

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hod-test-sync-'));
try {
  const vault = new Vault(tmpDir);
  await vault.init();

  // 1. Verificação das 5 etapas no schema
  assert.equal(STAGES.size, 5);
  assert(STAGES.has('aplicado'));
  assert(STAGES.has('em_certificacao'));
  assert(STAGES.has('aprovado'));
  assert(STAGES.has('reprovado'));
  assert(STAGES.has('encerrado'));
  console.log('✔ 1. Exatamente 5 etapas configuradas');

  // 2. Transições válidas e inválidas
  assert.equal(canTransition('aplicado', 'em_certificacao'), true);
  assert.equal(canTransition('aplicado', 'reprovado'), true);
  assert.equal(canTransition('em_certificacao', 'aprovado'), true);
  assert.equal(canTransition('em_certificacao', 'reprovado'), true);
  assert.equal(canTransition('aprovado', 'encerrado'), true);

  // Inválidas
  assert.equal(canTransition('aplicado', 'aprovado'), false);
  assert.equal(canTransition('aplicado', 'encerrado'), false);
  assert.equal(canTransition('reprovado', 'aprovado'), false);
  assert.equal(canTransition('encerrado', 'aplicado'), false);
  console.log('✔ 2. Matriz de transições do fluxo estrito validada');

  // 3. Validação de transição com e sem correção administrativa
  assert.throws(
    () => validateStageTransition('aplicado', 'aprovado', { adminCorrection: false }),
    /Transição de etapa inválida/
  );
  // Correção administrativa sem justificativa deve falhar
  assert.throws(
    () => validateStageTransition('aplicado', 'aprovado', { adminCorrection: true, reason: '' }),
    /Justificativa obrigatória/
  );
  // Correção administrativa com justificativa deve passar
  assert.equal(
    validateStageTransition('aplicado', 'aprovado', { adminCorrection: true, reason: 'Erro de digitação' }),
    true
  );
  // Encerramento sem motivo deve falhar
  assert.throws(
    () => validateStageTransition('aprovado', 'encerrado', { adminCorrection: false, reason: '' }),
    /Motivo de encerramento é obrigatório/
  );
  console.log('✔ 3. Validador de transições e correções administrativas');

  // 4. Criação de oportunidade e conversão em aplicação
  const oppData = {
    id: 'opp_test_001',
    company: 'Empresa Teste',
    title: 'Engenheiro de IA',
    source: 'LinkedIn',
    status: 'found',
    url: 'https://linkedin.com/jobs/123',
    description: 'Vaga remota para especialista em IA',
  };
  await vault.put('opportunity', oppData);

  const converted = await convertOpportunityToApplication(vault, 'opp_test_001', {
    nextAction: 'Enviar teste prático',
    deadline: '2026-12-01',
  });

  assert(converted.ok);
  assert.equal(converted.application.stage, 'aplicado');
  assert.equal(converted.application.company, 'Empresa Teste');
  assert.equal(converted.opportunity.status, 'applied');
  assert(converted.task);
  assert.equal(converted.task.title, 'Enviar teste prático');
  assert.equal(converted.task.isMain, true);
  console.log('✔ 4. Criação e conversão de oportunidade em aplicação com tarefa principal');

  // 5. Criação de candidatura sem próxima ação (não cria tarefa)
  const appSemAcao = {
    id: 'app_no_action',
    company: 'Outra Empresa',
    role: 'Avaliador',
    stage: 'aplicado',
    priority: 'normal',
  };
  const resSemAcao = await saveApplicationWithTaskSync(vault, appSemAcao);
  assert(resSemAcao.ok);
  assert.equal(resSemAcao.task, null);
  console.log('✔ 5. Candidatura sem próxima ação não gera tarefa');

  // 5b. A opção explícita também impede tarefa, mesmo se houver texto
  const appSemTarefa = {
    id: 'app_task_disabled', company: 'Empresa Sem Tarefa', role: 'Generalista',
    stage: 'aplicado', priority: 'normal', nextAction: 'Não deve virar tarefa', taskEnabled: false,
  };
  const resSemTarefa = await saveApplicationWithTaskSync(vault, appSemTarefa);
  assert.equal(resSemTarefa.task, null);
  console.log('✔ 5b. Candidatura com tarefa desativada não gera tarefa');

  // 6. Criação de candidatura com próxima ação gera tarefa vinculada
  const appComAcao = {
    id: 'app_com_acao',
    company: 'Tech Corp',
    role: 'Desenvolvedor',
    stage: 'aplicado',
    priority: 'urgente',
    nextAction: 'Revisar documentação técnica',
    deadline: '2026-11-25',
    notes: 'Notas secretas da candidatura',
  };
  const resComAcao = await saveApplicationWithTaskSync(vault, appComAcao);
  assert(resComAcao.ok);
  assert(resComAcao.task);
  assert.equal(resComAcao.task.title, 'Revisar documentação técnica');
  assert.equal(resComAcao.task.priority, 'urgente');
  assert.equal(resComAcao.task.dueAt, '2026-11-25');
  assert.equal(resComAcao.task.appId, 'app_com_acao');
  assert.equal(resComAcao.task.isMain, true);
  assert.equal(resComAcao.task.notes, ''); // notas separadas!
  console.log('✔ 6. Criação com próxima ação cria tarefa vinculada com notas separadas');

  // 7. Sincronização Candidatura → Tarefa (ao editar candidatura)
  const updatedApp = {
    ...appComAcao,
    mainTaskId: resComAcao.task.id,
    nextAction: 'Novo título da próxima ação',
    deadline: '2026-11-30',
    priority: 'importante',
    notes: 'Notas atualizadas da candidatura',
  };
  const resAppSync = await saveApplicationWithTaskSync(vault, updatedApp);
  assert.equal(resAppSync.task.title, 'Novo título da próxima ação');
  assert.equal(resAppSync.task.dueAt, '2026-11-30');
  assert.equal(resAppSync.task.priority, 'importante');
  console.log('✔ 7. Sincronização Candidatura → Tarefa');

  // 8. Sincronização Tarefa → Candidatura (ao editar tarefa principal)
  const updatedTask = {
    ...resAppSync.task,
    title: 'Título alterado na aba Tarefas',
    dueAt: '2026-12-05',
    priority: 'baixa',
    notes: 'Anotações da tarefa',
  };
  const resTaskSync = await saveTaskWithAppSync(vault, updatedTask);
  assert.equal(resTaskSync.application.nextAction, 'Título alterado na aba Tarefas');
  assert.equal(resTaskSync.application.deadline, '2026-12-05');
  assert.equal(resTaskSync.application.priority, 'baixa');
  assert.equal(resTaskSync.application.notes, 'Notas atualizadas da candidatura'); // notas mantidas intactas!
  console.log('✔ 8. Sincronização Tarefa → Candidatura sem poluição de notas');

  // 9. Tarefas independentes (sem appId)
  const independentTask = {
    id: 'task_indep_001',
    title: 'Comprar café',
    status: 'todo',
    priority: 'normal',
  };
  const resIndep = await saveTaskWithAppSync(vault, independentTask);
  assert.equal(resIndep.application, null);
  console.log('✔ 9. Tarefas independentes persistem sem exigir candidatura');

  // 10. Múltiplas tarefas por candidatura (tarefas secundárias)
  const secondaryTask = {
    id: 'task_secondary_002',
    title: 'Estudar guideline adicional',
    appId: 'app_com_acao',
    isMain: false, // secundária
    priority: 'normal',
  };
  const resSec = await saveTaskWithAppSync(vault, secondaryTask);
  assert.equal(resSec.application, null); // secundária não altera a próxima ação da candidatura!
  console.log('✔ 10. Múltiplas tarefas: tarefas secundárias não alteram a próxima ação');

  // 11. Conclusão de tarefa não altera etapa da candidatura
  const completedTask = {
    ...updatedTask,
    status: 'done',
  };
  await saveTaskWithAppSync(vault, completedTask);
  const scanAfterDone = await vault.scan();
  const currentApp = scanAfterDone.records.find(r => r.id === 'app_com_acao');
  assert.equal(currentApp.data.stage, 'aplicado'); // etapa preservada!
  console.log('✔ 11. Concluir tarefa não altera automaticamente a etapa');

  // 12. Teste da migração de estágios com backup
  const legacyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hod-test-legacy-'));
  const legacyVault = new Vault(legacyDir);
  await legacyVault.init();

  // Cria registros com status antigos
  await legacyVault.put('application', {
    id: 'app_leg_1', company: 'Empresa A', stage: 'mapeada', priority: 'normal',
  });
  await legacyVault.put('application', {
    id: 'app_leg_2', company: 'Empresa B', stage: 'teste', appliedAt: '2026-11-10', priority: 'urgente',
  });
  await legacyVault.put('application', {
    id: 'app_leg_3', company: 'Empresa C', stage: 'encerrada', appliedAt: '2026-10-01', priority: 'baixa',
  });

  const migrationReport = await migrateVaultStages(legacyDir);
  assert(migrationReport.backupId);
  assert.equal(migrationReport.convertedToOpportunity.length, 1); // mapeada sem appliedAt -> Oportunidade!
  assert.equal(migrationReport.migrated.length, 2); // teste -> em_certificacao, encerrada -> encerrado

  const postMigScan = await legacyVault.scan();
  const convertedOpp = postMigScan.records.find(r => r.id === 'opp_leg_1');
  assert(convertedOpp);
  assert.equal(convertedOpp.type, 'opportunity');

  const bApp = postMigScan.records.find(r => r.id === 'app_leg_2');
  assert.equal(bApp.data.stage, 'em_certificacao');

  const cApp = postMigScan.records.find(r => r.id === 'app_leg_3');
  assert.equal(cApp.data.stage, 'encerrado');

  console.log('✔ 12. Migração segura com backup e conversão de mapeada para Oportunidades');

  console.log('\n🎉 Todos os 12 testes de Oportunidades, Aplicações e Tarefas passaram com 100% de sucesso!');
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}
