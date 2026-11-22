/* ============================================================
   lib/sync.mjs — Serviço de sincronização e transição de candidaturas
   
   Responsabilidades:
   • Validação de transições de etapa (estrita + correção administrativa)
   • Sincronização bidirecional e atômica entre Candidatura e Tarefa Principal
   • Conversão de Oportunidade em Aplicação com confirmação
   • Prevenção de loop circular e duplicação
   ============================================================ */
import crypto from 'node:crypto';
import { canTransition, validateRecord } from './validation.mjs';

function bad(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/**
 * Valida a transição de etapa de uma candidatura.
 */
export function validateStageTransition(currentStage, nextStage, { adminCorrection = false, reason = '' } = {}) {
  if (!currentStage || !nextStage || currentStage === nextStage) return true;

  if (adminCorrection) {
    if (!reason || !reason.trim()) {
      throw bad('Justificativa obrigatória para correção administrativa de etapa.');
    }
    return true;
  }

  if (!canTransition(currentStage, nextStage)) {
    throw bad(`Transição de etapa inválida: '${currentStage}' para '${nextStage}'. Para corrigir erro de registro, use correção administrativa com justificativa.`);
  }

  if (nextStage === 'encerrado' && (!reason || !reason.trim())) {
    throw bad('Motivo de encerramento é obrigatório ao encerrar uma candidatura.');
  }

  return true;
}

/**
 * Salva candidatura e sincroniza automaticamente com a tarefa principal vinculada.
 */
export async function saveApplicationWithTaskSync(vault, appData, { actor = 'USER', origin = 'api', adminCorrection = false, reason = '' } = {}) {
  validateRecord('application', appData);

  const index = await vault.scan(true);
  const existing = index.records.find(r => r.type === 'application' && r.id === appData.id);

  if (existing) {
    const currentStage = existing.data.stage;
    const nextStage = appData.stage;
    validateStageTransition(currentStage, nextStage, { adminCorrection, reason: reason || appData.closeReason });
    if (adminCorrection && reason) {
      await vault.audit.record({
        actor, origin, action: 'STAGE_ADMIN_CORRECTION', entity: 'application', entityId: appData.id,
        before: { stage: currentStage }, after: { stage: nextStage, reason },
      });
    }
  }

  // Sincronização com Tarefa Principal
  let syncedTask = null;
  const nextAction = (appData.nextAction || '').trim();

  if (appData.taskEnabled !== false && nextAction && origin !== 'task_sync') {
    let taskId = appData.mainTaskId;
    let existingTask = taskId ? index.records.find(r => r.type === 'task' && r.id === taskId) : null;

    const taskPayload = {
      id: existingTask?.data?.id || taskId || `task_${crypto.randomUUID().slice(0, 14)}`,
      title: nextAction,
      dueAt: appData.deadline || existingTask?.data?.dueAt || '',
      priority: appData.priority || existingTask?.data?.priority || 'normal',
      appId: appData.id,
      appLabel: `${appData.company}${appData.role ? ' — ' + appData.role : ''}`,
      status: existingTask?.data?.status || 'todo',
      notes: existingTask?.data?.notes || '',
      isMain: true,
    };

    validateRecord('task', taskPayload);
    appData.mainTaskId = taskPayload.id;

    // Salva a tarefa primeiro
    syncedTask = await vault.put('task', taskPayload, { actor, origin: 'app_sync' });
  }

  // Salva a candidatura
  const savedApp = await vault.put('application', appData, { actor, origin });

  return {
    ok: true,
    application: savedApp.data,
    task: syncedTask ? syncedTask.data : null,
    path: savedApp.path,
  };
}

/**
 * Salva tarefa e, caso seja a tarefa principal, sincroniza com a candidatura vinculada.
 */
export async function saveTaskWithAppSync(vault, taskData, { actor = 'USER', origin = 'api' } = {}) {
  validateRecord('task', taskData);
  const savedTask = await vault.put('task', taskData, { actor, origin });

  let syncedApp = null;
  // Sincroniza apenas se for tarefa vinculada principal e a chamada não originou da aplicação
  if (taskData.appId && taskData.isMain && origin !== 'app_sync') {
    const index = await vault.scan(true);
    const appRecord = index.records.find(r => r.type === 'application' && r.id === taskData.appId);
    if (appRecord) {
      const app = { ...appRecord.data };
      let changed = false;

      if (taskData.title && app.nextAction !== taskData.title) {
        app.nextAction = taskData.title;
        changed = true;
      }
      if (taskData.dueAt !== undefined && app.deadline !== taskData.dueAt) {
        app.deadline = taskData.dueAt;
        changed = true;
      }
      if (taskData.priority && app.priority !== taskData.priority) {
        app.priority = taskData.priority;
        changed = true;
      }
      if (!app.mainTaskId || app.mainTaskId !== taskData.id) {
        app.mainTaskId = taskData.id;
        changed = true;
      }

      if (changed) {
        validateRecord('application', app);
        syncedApp = await vault.put('application', app, { actor, origin: 'task_sync' });
      }
    }
  }

  return {
    ok: true,
    task: savedTask.data,
    application: syncedApp ? syncedApp.data : null,
    path: savedTask.path,
  };
}

/**
 * Converte uma oportunidade encontrada em aplicação após confirmação de inscrição.
 */
export async function convertOpportunityToApplication(vault, oppId, overrides = {}, { actor = 'USER', origin = 'api' } = {}) {
  const index = await vault.scan(true);
  const oppRecord = index.records.find(r => r.type === 'opportunity' && r.id === oppId);
  if (!oppRecord) throw bad('Oportunidade não encontrada.', 404);

  const opp = oppRecord.data;

  // Atualiza a oportunidade para status 'applied'
  const updatedOpp = { ...opp, status: 'applied', convertedAt: new Date().toISOString() };
  await vault.put('opportunity', updatedOpp, { actor, origin });

  // Cria a aplicação correspondente
  const appId = overrides.id || `app_${crypto.randomUUID().slice(0, 14)}`;
  const appData = {
    id: appId,
    company: overrides.company || opp.company || 'Empresa desconhecida',
    role: overrides.role || opp.title || 'Cargo/Projeto',
    stage: 'aplicado',
    priority: overrides.priority || opp.priority || 'normal',
    appliedAt: overrides.appliedAt || new Date().toISOString().slice(0, 10),
    deadline: overrides.deadline || '',
    link: overrides.link || opp.url || '',
    location: overrides.location || opp.location || '',
    compensation: overrides.compensation || opp.compensation || '',
    notes: overrides.notes || (opp.description ? `Oportunidade importada de ${opp.source || 'coletor'}:\n\n${opp.description}` : ''),
    nextAction: overrides.nextAction || 'Acompanhar retorno da candidatura',
  };

  const result = await saveApplicationWithTaskSync(vault, appData, { actor, origin });
  return { ok: true, application: result.application, task: result.task, opportunity: updatedOpp };
}
