#!/usr/bin/env node
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildNote, parseFrontmatter } from '../lib/frontmatter.mjs';
import { validateRecord } from '../lib/validation.mjs';
import { Vault, writeFileAtomic } from '../lib/vault.mjs';
import { BackupManager } from '../lib/backups.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hod-unit-'));
let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`  ✔ ${name}`); } catch (error) { console.error(`  ✘ ${name}: ${error.message}`); throw error; } }
const app = id => ({ id, company: 'Empresa', role: 'Função', stage: 'aplicada', priority: 'normal', notes: '', steps: [], history: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
try {
  await test('frontmatter preserva campos e corpo', () => { const parsed = parseFrontmatter(buildNote({ hod_type: 'application', id: 'unit_app', active: true, list: ['a', 'b'] }, 'Corpo\nmultilinha')); assert.equal(parsed.data.id, 'unit_app'); assert.deepEqual(parsed.data.list, ['a', 'b']); assert.equal(parsed.body.trim(), 'Corpo\nmultilinha'); });
  await test('validação rejeita ID, URL e enum inválidos', () => { assert.throws(() => validateRecord('application', { ...app('../bad'), link: 'javascript:alert(1)' })); assert.throws(() => validateRecord('application', { ...app('valid'), stage: 'apagada' })); });
  const vaultPath = path.join(root, 'vault'); const vault = new Vault(vaultPath); await vault.init();
  await test('vault grava atomicamente e auditoria redige segredo', async () => { await vault.put('application', { ...app('unit_app'), secretToken: 'nunca-expor' }, { actor: 'TEST', origin: 'unit' }); assert.equal((await vault.audit.recent())[0].after.secretToken, '[redigido]'); });
  await test('deduplicação impede candidatura equivalente', async () => { await assert.rejects(vault.put('application', app('unit_app_2')), error => error.status === 409); });
  await test('oportunidade é validada, persistida e deduplicada', async () => {
    const opportunity = { id: 'opp_unit_1', source: 'Fonte de teste', sourceId: '123', company: 'Empresa', title: 'Projeto', url: 'https://example.test/opportunity', status: 'found', priority: 'normal', collectedAt: new Date().toISOString() };
    await vault.put('opportunity', opportunity, { actor: 'COLLECTOR', origin: 'collector' });
    assert.equal((await vault.state()).opportunities.length, 1);
    await assert.rejects(vault.put('opportunity', { ...opportunity, id: 'opp_unit_2' }), error => error.status === 409);
  });
  await test('path traversal e diretório Work não autorizado são bloqueados', async () => { await assert.rejects(vault.readNote('../.hod/audit.jsonl'), error => error.status === 403 || error.status === 400); await assert.rejects(vault.writeWorkDocument('Candidaturas', { title: 'x', content: 'x' }), error => error.status === 403); });
  await test('arquivo de persistência interrompida é ignorado', async () => { await fs.writeFile(path.join(vaultPath, 'Candidaturas', '.tmp-interrompido'), 'incompleto'); assert.equal((await vault.state()).applications.length, 1); });
  await test('nota Markdown corrompida é excluída do estado e registrada como erro', async () => { await fs.writeFile(path.join(vaultPath, 'Candidaturas', 'corrompida.md'), '---\nhod_type: application\nid: corrupt_app\n---\n'); const index = await vault.scan(true); assert.equal(index.records.some(record => record.id === 'corrupt_app'), false); assert.equal(index.errors.some(error => error.includes('corrompida.md')), true); });
  await test('symlink escape é bloqueado', async () => { const external = path.join(root, 'outside.md'); await fs.writeFile(external, 'fora'); await fs.symlink(external, path.join(vaultPath, 'Candidaturas', 'escape.md')); await assert.rejects(vault.readNote('Candidaturas/escape.md'), error => error.status === 403); });
  await test('erro de gravação é propagado sem registro parcial', async () => { const dir = path.join(vaultPath, 'Tarefas'); await fs.chmod(dir, 0o500); try { await assert.rejects(vault.put('task', { id: 'write_error', title: 'não grava', status: 'todo', priority: 'normal' })); } finally { await fs.chmod(dir, 0o700); } assert.equal((await vault.state()).tasks.some(task => task.id === 'write_error'), false); });
  await test('backup válido, restore real e backup corrompido falham previsivelmente', async () => { const backups = new BackupManager(vaultPath, { root: path.join(root, 'backups') }); const good = await backups.create('unit'); assert.equal((await backups.verify(good.id)).valid, true); const marker = path.join(vaultPath, 'marker.txt'); await fs.writeFile(marker, 'antes'); const point = await backups.create('restore-point'); await fs.writeFile(marker, 'depois'); await backups.restore(point.id); assert.equal(await fs.readFile(marker, 'utf8'), 'antes'); const corrupt = await backups.create('corrupt'); await fs.appendFile(path.join(backups.root, corrupt.id, 'marker.txt'), 'adulterado'); await assert.rejects(backups.restore(corrupt.id), error => error.status === 409); });
  await test('vault indisponível falha sem estado parcial', async () => { const file = path.join(root, 'not-a-directory'); await fs.writeFile(file, 'x'); await assert.rejects(new Vault(file).init()); });
  await test('writeFileAtomic produz conteúdo completo', async () => { const target = path.join(root, 'atomic.txt'); await writeFileAtomic(target, 'completo'); assert.equal(await fs.readFile(target, 'utf8'), 'completo'); });
  console.log(`\n${passed} testes unitários/resiliência passaram.`);
} finally { await fs.rm(root, { recursive: true, force: true }); }
