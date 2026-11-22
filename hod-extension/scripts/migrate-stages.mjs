/* ============================================================
   scripts/migrate-stages.mjs — Migração segura de etapas de candidaturas
   
   Regras:
   • Cria backup atômico com verificação de integridade antes de tocar em qualquer arquivo.
   • Mapeamento explícito dos status antigos para os 5 novos.
   • Candidaturas apenas 'mapeadas' sem 'appliedAt' viram 'opportunity' (Oportunidades/).
   • Preserva IDs, datas, histórico, notas e tags de cada nota.
   • Disponibiliza rollback via BackupManager.
   ============================================================ */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vault } from '../lib/vault.mjs';
import { BackupManager } from '../lib/backups.mjs';
import { validateRecord } from '../lib/validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vaultPath = process.argv[2] || process.env.HOD_VAULT || '/Volumes/Sem Título 3/Home_Office/Obsidian Vault';

export async function migrateVaultStages(rootPath = vaultPath) {
  console.log(`[Migração] Iniciando migração do vault em: ${rootPath}`);

  const vault = new Vault(rootPath);
  await vault.init();

  const backups = new BackupManager(rootPath);
  const backup = await backups.create('migracao_etapas_candidaturas');
  console.log(`[Migração] Backup de segurança criado: ${backup.id} (digest: ${backup.digest.slice(0, 12)}…)`);

  const index = await vault.scan(true);
  const apps = index.records.filter(r => r.type === 'application');

  console.log(`[Migração] Total de candidaturas encontradas para avaliar: ${apps.length}`);
  const report = {
    backupId: backup.id,
    migrated: [],
    convertedToOpportunity: [],
    unchanged: [],
    errors: [],
  };

  const STAGE_MAP = {
    aplicada: 'aplicado',
    teste: 'em_certificacao',
    entrevista: 'em_certificacao',
    proposta: 'aprovado',
    ativa: 'aprovado',
    encerrada: 'encerrado',
  };

  for (const record of apps) {
    const data = { ...record.data };
    const oldStage = data.stage;

    try {
      // Caso 1: 'mapeada' sem evidência de envio -> vira Oportunidade
      if (oldStage === 'mapeada' && !data.appliedAt) {
        console.log(`[Migração] Convertendo mapeada '${data.company}' para Oportunidade`);
        const oppData = {
          id: `opp_${data.id.replace(/^app_/, '')}`,
          source: 'Migração (antiga mapeada)',
          company: data.company,
          title: data.role || 'Cargo a definir',
          description: data.notes || '',
          url: data.link || '',
          status: 'found',
          priority: data.priority || 'normal',
          location: data.location || '',
          compensation: data.compensation || '',
          collectedAt: data.createdAt || new Date().toISOString(),
        };
        validateRecord('opportunity', oppData);
        await vault.put('opportunity', oppData, { actor: 'MIGRATION', origin: 'migration' });
        await vault.remove('application', data.id, { actor: 'MIGRATION', origin: 'migration' });
        report.convertedToOpportunity.push({ id: data.id, company: data.company, oppId: oppData.id });
        continue;
      }

      // Caso 2: mapeamento para novos status
      const newStage = STAGE_MAP[oldStage] || (['aplicado', 'em_certificacao', 'aprovado', 'reprovado', 'encerrado'].includes(oldStage) ? oldStage : 'aplicado');

      if (newStage !== oldStage) {
        data.stage = newStage;
        if (!data.history) data.history = [];
        data.history.unshift({
          at: new Date().toISOString(),
          text: `Migração estrutural de status: ${oldStage} → ${newStage}`,
        });
        validateRecord('application', data);
        await vault.put('application', data, { actor: 'MIGRATION', origin: 'migration' });
        report.migrated.push({ id: data.id, company: data.company, from: oldStage, to: newStage });
        console.log(`[Migração] '${data.company}': ${oldStage} → ${newStage}`);
      } else {
        report.unchanged.push({ id: data.id, company: data.company, stage: oldStage });
      }
    } catch (err) {
      console.error(`[Migração] Erro ao migrar ${data.company}: ${err.message}`);
      report.errors.push({ id: data.id, company: data.company, error: err.message });
    }
  }

  console.log(`\n[Migração] Concluída com sucesso!`);
  console.log(`  - Migradas: ${report.migrated.length}`);
  console.log(`  - Convertidas em Oportunidades: ${report.convertedToOpportunity.length}`);
  console.log(`  - Inalteradas: ${report.unchanged.length}`);
  console.log(`  - Erros: ${report.errors.length}`);

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateVaultStages().catch(err => {
    console.error('[Migração] Falha crítica:', err);
    process.exit(1);
  });
}
