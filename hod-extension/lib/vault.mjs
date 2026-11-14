/* ============================================================
   vault.mjs — adaptador de vault Markdown (Obsidian real ou pasta local)

   Regras do contrato:
   • cada registro é UMA nota .md
   • YAML frontmatter é a parte estruturada (fonte de verdade)
   • o corpo da nota é DERIVADO para candidaturas/tarefas, e é a
     fonte de verdade para guidelines (documento do usuário)
   • escrita atômica: tmp + rename no mesmo diretório
   • exclusão gera tombstone em .hod/tombstones.json
   • índice derivado em .hod/index.json (descartável, reconstruível)
   ============================================================ */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFrontmatter, buildNote } from './frontmatter.mjs';

export const TYPES = {
  application: { dir: 'Candidaturas', prefix: 'app' },
  task: { dir: 'Tarefas', prefix: 'task' },
  guideline: { dir: 'Guidelines', prefix: 'guide' },
  routine: { dir: 'Rotina', prefix: 'rot' },
  settings: { dir: '.', prefix: 'set' },
};

const META_DIR = '.hod';
const SAFE_NAME = /[\\/:*?"<>|#^[\]]/g;

function slug(value, fallback = 'sem-titulo') {
  const s = String(value ?? '')
    .replace(SAFE_NAME, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim()
    .slice(0, 90);
  return s || fallback;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function mkdirp(p) { await fs.mkdir(p, { recursive: true }); }

/* ---------- escrita atômica ---------- */
export async function writeFileAtomic(file, content) {
  const dir = path.dirname(file);
  await mkdirp(dir);
  const tmp = path.join(dir, `.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, file);
}

/* ---------- nomes de arquivo legíveis ---------- */
function baseName(type, data) {
  if (type === 'application') {
    const company = slug(data.company, 'Sem empresa');
    const role = data.role ? slug(data.role, '') : '';
    return role ? `${company} — ${role}` : company;
  }
  if (type === 'guideline') return slug(data.title, 'Guideline');
  if (type === 'task') return slug(data.title, 'Tarefa');
  if (type === 'routine') return slug(data.label || data.start || 'Bloco', 'Bloco');
  return 'HOD — Configurações';
}

export class Vault {
  constructor(rootPath) {
    this.root = path.resolve(rootPath);
    this.metaDir = path.join(this.root, META_DIR);
    this._cache = null;
    this._cacheKey = '';
  }

  get indexPath() { return path.join(this.metaDir, 'index.json'); }
  get tombstonePath() { return path.join(this.metaDir, 'tombstones.json'); }

  async init() {
    await mkdirp(this.root);
    for (const cfg of Object.values(TYPES)) {
      await mkdirp(cfg.dir === '.' ? this.root : path.join(this.root, cfg.dir));
    }
    await mkdirp(this.metaDir);
  }

  /* ============ leitura ============ */
  async scan(force = false) {
    const key = await this._fingerprint();
    if (!force && this._cache && this._cacheKey === key) return this._cache;

    const records = [];
    const seenIds = new Set();
    const errors = [];

    for (const [type, cfg] of Object.entries(TYPES)) {
      const dir = cfg.dir === '.' ? this.root : path.join(this.root, cfg.dir);
      let entries = [];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        try {
          const text = await fs.readFile(full, 'utf8');
          const { data, body } = parseFrontmatter(text);
          if (data.hod_type !== type) {
            if (!data.hod_type) continue; // nota do usuário: ignora
            continue;
          }
          const id = String(data.id || '').trim();
          if (!id || seenIds.has(id)) { errors.push(`${entry.name}: id ausente ou duplicado`); continue; }
          seenIds.add(id);
          const rel = path.relative(this.root, full).split(path.sep).join('/');
          const cleanBody = body.replace(/^\n+/, '').trimEnd();
          // Em guidelines o corpo da nota é o documento. Se estiver vazio,
          // aceita-se o `body` que notas antigas deixaram no frontmatter.
          const resolvedBody = type === 'guideline' && !cleanBody
            ? String(data.body || '')
            : cleanBody;
          records.push({
            id,
            type,
            path: rel,
            mtime: (await fs.stat(full)).mtimeMs,
            data: stripMeta(data),
            body: resolvedBody,
          });
        } catch (err) {
          errors.push(`${entry.name}: ${err.message}`);
        }
      }
    }

    const tombstones = await this._readTombstones();
    const index = {
      scannedAt: new Date().toISOString(),
      root: this.root,
      records,
      tombstones,
      errors,
    };
    this._cache = index;
    this._cacheKey = key;
    await this._persistIndex(index);
    return index;
  }

  async _fingerprint() {
    const parts = [];
    for (const cfg of Object.values(TYPES)) {
      const dir = cfg.dir === '.' ? this.root : path.join(this.root, cfg.dir);
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isFile() || !e.name.endsWith('.md') || e.name.startsWith('.')) continue;
          const st = await fs.stat(path.join(dir, e.name));
          parts.push(`${e.name}:${st.mtimeMs}:${st.size}`);
        }
      } catch { /* diretório ausente */ }
    }
    parts.sort();
    return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
  }

  async _persistIndex(index) {
    try {
      await writeFileAtomic(this.indexPath, JSON.stringify({
        scannedAt: index.scannedAt,
        root: index.root,
        count: index.records.length,
        errors: index.errors,
        tombstones: index.tombstones,
        records: index.records.map(r => ({
          id: r.id, type: r.type, path: r.path,
          title: r.data.company || r.data.title || r.data.label || r.id,
        })),
      }, null, 2));
    } catch { /* índice é descartável */ }
  }

  async _readTombstones() {
    try {
      const raw = await fs.readFile(this.tombstonePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  async _writeTombstones(map) {
    await writeFileAtomic(this.tombstonePath, JSON.stringify(map, null, 2));
  }

  /* ============ escrita ============ */
  async put(type, data) {
    const cfg = TYPES[type];
    if (!cfg) throw new Error(`Tipo desconhecido: ${type}`);
    if (!data.id) throw new Error('Registro sem id.');

    const index = await this.scan(true);
    const current = index.records.find(r => r.id === data.id && r.type === type);

    const dirRel = cfg.dir === '.' ? '' : `${cfg.dir}/`;
    const desired = path.join(this.root, dirRel + baseName(type, data) + '.md');

    // O arquivo sempre segue o título/empresa atual: se o usuário renomeia
    // a candidatura, a nota no Obsidian também precisa ser renomeada — senão
    // o vault fica com nomes que não correspondem ao conteúdo.
    let target = desired;
    {
      let n = 2;
      const stem = path.basename(desired, '.md');
      while (await exists(target)) {
        const rel = path.relative(this.root, target).split(path.sep).join('/');
        const owner = index.records.find(r => r.path === rel);
        if (!owner || (owner.id === data.id && owner.type === type)) break;
        target = path.join(this.root, `${dirRel}${stem} (${n++}).md`);
      }
    }

    const previousUpdated = current?.data?.updatedAt ? Date.parse(current.data.updatedAt) : 0;
    const incoming = data.updatedAt ? Date.parse(data.updatedAt) : Date.now();
    if (current && previousUpdated > incoming + 500) {
      const err = new Error('Conflito: a nota foi alterada depois da sua última leitura.');
      err.status = 409;
      err.current = current;
      throw err;
    }

    const now = new Date().toISOString();
    const frontmatter = {
      ...data,
      hod_type: type,
      id: data.id,
      created_at: data.createdAt || current?.data?.createdAt || now,
      updated_at: now,
      managed_by: 'hod',
    };
    // Em guidelines o corpo da nota É o documento: guardá-lo também no
    // frontmatter duplicaria o texto e faria o Obsidian mostrar dois
    // documentos divergentes quando o usuário editasse um dos lados.
    const body = renderBody(type, data);
    if (type === 'guideline') delete frontmatter.body;
    await writeFileAtomic(target, buildNote(frontmatter, body));

    if (current && current.path !== path.relative(this.root, target).split(path.sep).join('/')) {
      try { await fs.unlink(path.join(this.root, current.path)); } catch { /* já não existe */ }
    }

    const tombstones = await this._readTombstones();
    if (tombstones[data.id]) {
      delete tombstones[data.id];
      await this._writeTombstones(tombstones);
    }

    this._cache = null;
    return { path: path.relative(this.root, target).split(path.sep).join('/'), data: { ...data, updatedAt: now } };
  }

  async remove(type, id) {
    const index = await this.scan(true);
    const current = index.records.find(r => r.id === id && r.type === type);
    if (!current) {
      const err = new Error('Registro não encontrado no vault.');
      err.status = 404;
      throw err;
    }
    const trashDir = path.join(this.metaDir, 'trash');
    await mkdirp(trashDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(this.root, current.path);
    try {
      await fs.copyFile(file, path.join(trashDir, `${stamp}__${path.basename(file)}`));
      await fs.unlink(file);
    } catch (err) {
      const e = new Error(`Falha ao excluir a nota: ${err.message}`);
      e.status = 500;
      throw e;
    }
    const tombstones = await this._readTombstones();
    tombstones[id] = { id, type, path: current.path, deletedAt: new Date().toISOString() };
    await this._writeTombstones(tombstones);
    this._cache = null;
    return { id, deleted: true };
  }

  async removeType(type) {
    const index = await this.scan(true);
    const targets = index.records.filter(r => r.type === type);
    for (const t of targets) await this.remove(type, t.id);
    return targets.length;
  }

  async state() {
    const index = await this.scan();
    const out = {
      applications: [], tasks: [], guidelines: [], routine: [],
      emails: [], calendarEvents: [], driveFiles: [],
      settings: {},
    };
    for (const r of index.records) {
      if (r.type === 'application') out.applications.push(r.data);
      else if (r.type === 'task') out.tasks.push(r.data);
      else if (r.type === 'guideline') out.guidelines.push({ ...r.data, body: r.body });
      else if (r.type === 'routine') out.routine.push(r.data);
      else if (r.type === 'settings') out.settings = r.data;
    }
    const bag = await this._readJson('bag.json', {});
    return {
      version: 4,
      updatedAt: index.scannedAt,
      ...out,
      emails: bag.emails || [],
      calendarEvents: bag.calendarEvents || [],
      driveFiles: bag.driveFiles || [],
      vault: {
        root: this.root,
        notes: index.records.length,
        scannedAt: index.scannedAt,
        errors: index.errors,
        tombstones: Object.keys(index.tombstones).length,
      },
    };
  }

  async _readJson(name, fallback) {
    try {
      return JSON.parse(await fs.readFile(path.join(this.metaDir, name), 'utf8'));
    } catch { return fallback; }
  }

  async _writeJson(name, value) {
    await writeFileAtomic(path.join(this.metaDir, name), JSON.stringify(value, null, 2));
  }

  /* dados não-noteados (e-mails analisados, calendário) */
  async putBag(patch) {
    const bag = await this._readJson('bag.json', {});
    const next = { ...bag, ...patch, updatedAt: new Date().toISOString() };
    await this._writeJson('bag.json', next);
    this._cache = null;
    return next;
  }

  async putSettings(settings) {
    const existing = (await this.scan(true)).records.find(r => r.type === 'settings');
    const payload = {
      ...settings,
      id: existing?.id || 'settings',
      updatedAt: new Date().toISOString(),
      createdAt: existing?.data?.createdAt || new Date().toISOString(),
    };
    return this.put('settings', payload);
  }

  async health() {
    const index = await this.scan();
    return {
      ok: true,
      root: this.root,
      notes: index.records.length,
      errors: index.errors,
      writable: true,
    };
  }

  async readNote(relPath) {
    const safe = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const full = path.join(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error('Caminho inválido.');
    return fs.readFile(full, 'utf8');
  }

  async writeNote(relPath, content) {
    const safe = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const full = path.join(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error('Caminho inválido.');
    await writeFileAtomic(full, content);
    this._cache = null;
    return safe;
  }
}

function stripMeta(data) {
  const out = { ...data };
  delete out.hod_type;
  delete out.managed_by;
  // O frontmatter usa snake_case; a API e o navegador usam camelCase.
  // Sem essa tradução o `updatedAt` nunca voltava e o controle de
  // concorrência (409) simplesmente não disparava.
  if (out.createdAt === undefined && data.created_at !== undefined) out.createdAt = data.created_at;
  if (out.updatedAt === undefined && data.updated_at !== undefined) out.updatedAt = data.updated_at;
  delete out.created_at;
  delete out.updated_at;
  return out;
}

/* ============ corpo derivado ============ */
const STAGE_LABEL = {
  mapeada: 'Mapeada', aplicada: 'Candidatura enviada', teste: 'Teste / Prova',
  entrevista: 'Entrevista', proposta: 'Proposta', ativa: 'Ativa', encerrada: 'Encerrada',
};
const PRIORITY_LABEL = { urgente: 'Urgente', importante: 'Importante', normal: 'Normal', baixa: 'Pode esperar' };

function fmtDate(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderBody(type, data) {
  if (type === 'guideline') return data.body || '';

  if (type === 'settings') {
    return [
      '# HOD — Configurações',
      '',
      'Esta nota guarda a configuração do HOD que deve viver no vault.',
      'Conexões sensíveis (chaves de API do Hermes) ficam em `~/.hermes/.env`, nunca aqui.',
      '',
      '```json',
      JSON.stringify(data.connections || {}, null, 2),
      '```',
    ].join('\n');
  }

  if (type === 'task') {
    const done = data.status === 'done';
    const lines = [
      `# ${data.title || 'Tarefa'}`,
      '',
      `- [${done ? 'x' : ' '}] ${data.title || ''}`,
      `- **Prioridade:** ${PRIORITY_LABEL[data.priority] || data.priority || 'Normal'}`,
    ];
    if (data.dueAt) lines.push(`- **Prazo:** ${fmtDate(data.dueAt)}`);
    if (data.appLabel) lines.push(`- **Candidatura:** ${data.appLabel}`);
    if (data.notes) lines.push('', '## Notas', '', data.notes);
    lines.push('', '> Corpo gerado pelo HOD. Edite o frontmatter para alterar os dados.');
    return lines.join('\n');
  }

  if (type === 'routine') {
    const lines = [
      `# ${data.label || 'Bloco de rotina'}`,
      '',
      `**Horário:** ${data.start || '--:--'} — ${data.end || '--:--'}`,
    ];
    if (data.notes) lines.push('', data.notes);
    lines.push('', '> Corpo gerado pelo HOD.');
    return lines.join('\n');
  }

  if (type === 'application') {
    const steps = Array.isArray(data.steps) ? data.steps : [];
    const history = Array.isArray(data.history) ? data.history : [];

    const head = [
      `# ${data.company || 'Sem empresa'}${data.role ? ' — ' + data.role : ''}`,
      '',
      `**Etapa:** ${STAGE_LABEL[data.stage] || data.stage || '—'} · ` +
        `**Prioridade:** ${PRIORITY_LABEL[data.priority] || data.priority || '—'}`,
    ];
    if (data.deadline) head.push('', `**Prazo:** ${fmtDate(data.deadline)}`);
    if (data.appliedAt) head.push(`**Candidatura enviada:** ${fmtDate(data.appliedAt)}`);
    if (data.location) head.push(`**Localidade:** ${data.location}`);
    if (data.compensation) head.push(`**Remuneração:** ${data.compensation}`);
    if (data.link) head.push(`**Vaga:** [abrir](${data.link})`);

    const sections = [
      head.join('\n'),
      `## Próxima ação\n\n${data.nextAction || '_nenhuma definida_'}`,
      `## Etapas\n\n${steps.length
        ? steps.map(s => {
            const box = s.status === 'done' ? 'x' : ' ';
            const due = s.dueAt ? ` _(prazo: ${fmtDate(s.dueAt)})_` : '';
            return `- [${box}] ${s.title}${due} — ${s.kind || 'Etapa'}`;
          }).join('\n')
        : '_Sem etapas_'}`,
    ];
    if (data.notes) sections.push(`## Notas\n\n${data.notes}`);
    sections.push(`## Histórico\n\n${history.length
      ? history.slice(0, 40).map(h => `- ${fmtDate(h.at)} — ${h.text}`).join('\n')
      : '_Sem eventos_'}`);

    return [
      ...sections,
      '> Corpo gerado pelo HOD. Edite o frontmatter para alterar os dados; ' +
        'o bloco `## Notas` também é preservado no frontmatter.',
    ].join('\n\n') + '\n';
  }

  return '';
}
