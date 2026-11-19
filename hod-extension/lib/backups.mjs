import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ID = /^\d{8}T\d{6}Z-[a-z0-9-]{1,40}$/;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

async function digest(root) {
  const hash = crypto.createHash('sha256');
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name); const rel = path.relative(root, full);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && rel !== 'manifest.json') { hash.update(rel); hash.update(await fs.readFile(full)); }
    }
  }
  await walk(root); return hash.digest('hex');
}

export class BackupManager {
  constructor(vaultRoot, { root = path.join(path.dirname(vaultRoot), '.hod-backups'), retention = 14 } = {}) {
    this.vaultRoot = vaultRoot; this.root = root; this.retention = Math.max(1, Number(retention) || 14);
  }
  async list() {
    try {
      const entries = await fs.readdir(this.root, { withFileTypes: true });
      const all = await Promise.all(entries.filter(e => e.isDirectory() && ID.test(e.name)).map(async e => {
        try { return JSON.parse(await fs.readFile(path.join(this.root, e.name, 'manifest.json'), 'utf8')); } catch { return null; }
      }));
      return all.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch { return []; }
  }
  async create(reason = 'manual') {
    await fs.mkdir(this.root, { recursive: true });
    const id = `${stamp()}-${String(reason).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'backup'}`;
    const target = path.join(this.root, id);
    await fs.cp(this.vaultRoot, target, { recursive: true });
    const manifest = { id, createdAt: new Date().toISOString(), reason, digest: await digest(target), version: 1 };
    await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    const old = (await this.list()).slice(this.retention);
    await Promise.all(old.map(item => fs.rm(path.join(this.root, item.id), { recursive: true, force: true })));
    return manifest;
  }
  async verify(id) {
    if (!ID.test(id)) throw Object.assign(new Error('Identificador de backup inválido.'), { status: 400 });
    const manifest = JSON.parse(await fs.readFile(path.join(this.root, id, 'manifest.json'), 'utf8'));
    return { ...manifest, valid: safeDigest(await digest(path.join(this.root, id)), manifest.digest) };
  }
  async ensureDaily() {
    const today = new Date().toISOString().slice(0, 10);
    if (!(await this.list()).some(item => item.createdAt?.slice(0, 10) === today)) return this.create('daily');
    return null;
  }
  async restore(id) {
    const checked = await this.verify(id);
    if (!checked.valid) throw Object.assign(new Error('Backup corrompido.'), { status: 409 });
    const safety = await this.create('before-restore');
    const parent = path.dirname(this.vaultRoot); const temp = path.join(parent, `.restore-${process.pid}-${Date.now()}`); const previous = path.join(parent, `.previous-${process.pid}-${Date.now()}`);
    await fs.cp(path.join(this.root, id), temp, { recursive: true, filter: src => path.basename(src) !== 'manifest.json' });
    try { await fs.rename(this.vaultRoot, previous); await fs.rename(temp, this.vaultRoot); await fs.rm(previous, { recursive: true, force: true }); }
    catch (err) { await fs.rename(previous, this.vaultRoot).catch(() => {}); await fs.rm(temp, { recursive: true, force: true }).catch(() => {}); throw err; }
    return { restored: id, safetyBackup: safety.id };
  }
}
function safeDigest(actual, expected) { return typeof expected === 'string' && actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
