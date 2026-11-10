/* ============================================================
   obsidian.js — ponte com o Obsidian via Local REST API
   (backend do "segundo cérebro"). Sem servidor intermediário.
   ============================================================ */

const cleanBase = url => (url || '').replace(/\/+$/, '');

function headers(settings) {
  return {
    Authorization: `Bearer ${settings.key}`,
    'Content-Type': 'text/markdown; charset=utf-8',
  };
}

export async function testConnection(obsidian) {
  if (!obsidian?.url) throw new Error('Informe a URL do Local REST API.');
  if (!obsidian?.key) throw new Error('Informe a chave da API do plugin.');
  const res = await fetch(`${cleanBase(obsidian.url)}/vault/`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${obsidian.key}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Obsidian respondeu ${res.status}. Confira URL e chave.`);
  return true;
}

export async function saveNote(obsidian, path, content) {
  const folder = (obsidian.folder || '').replace(/^\/+|\/+$/g, '');
  const full = [folder, path].filter(Boolean).join('/');
  const encoded = full.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${cleanBase(obsidian.url)}/vault/${encoded}`, {
    method: 'PUT',
    headers: headers(obsidian),
    body: content,
  });
  if (!res.ok) throw new Error(`Falha ao salvar ${full}: ${res.status}`);
  return full;
}

/* ---------- markdown export ---------- */
export function noteForApplication(app, state) {
  const stage = state.applications ? app.stage : '';
  const steps = app.steps.map(s => `- [${s.status === 'done' ? 'x' : ' '}] ${s.title}${s.dueAt ? ` _(prazo: ${s.dueAt.slice(0, 10)})_` : ''} — ${s.kind}`).join('\n') || '_Sem etapas_';
  const tasks = state.tasks.filter(t => t.appId === app.id);
  const taskLines = tasks.map(t => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${t.dueAt ? ` _(prazo: ${t.dueAt.slice(0, 10)})_` : ''}`).join('\n') || '_Sem tarefas_';
  const guides = state.guidelines.filter(g => g.appId === app.id);
  const guideLinks = guides.map(g => `- [[${g.title}]]`).join('\n');

  return `---
hod: candidatura
empresa: "${app.company.replace(/"/g, '\\"')}"
funcao: "${(app.role || '').replace(/"/g, '\\"')}"
etapa: ${stage}
prioridade: ${app.priority}
prazo: ${app.deadline || ''}
atualizado: ${new Date().toISOString()}
---

# ${app.company}${app.role ? ' — ' + app.role : ''}

**Etapa:** ${stage} · **Prioridade:** ${app.priority}
${app.deadline ? `**Prazo:** ${app.deadline}` : ''}

## Próxima ação
${app.nextAction || '_nenhuma_ '}

## Etapas
${steps}

## Tarefas
${taskLines}

${guideLinks ? `## Guidelines\n${guideLinks}\n` : ''}
## Notas
${app.notes || ''}

## Histórico
${app.history.map(h => `- ${h.at.slice(0, 16).replace('T', ' ')} — ${h.text}`).join('\n') || '_Sem eventos_'}
`;
}

export function buildNotes(state) {
  const notes = state.applications.map(app => ({
    path: `Candidaturas/${app.company.replace(/[\\/:*?"<>|]/g, '-')}${app.role ? ' — ' + app.role.replace(/[\\/:*?"<>|]/g, '-') : ''}.md`,
    content: noteForApplication(app, state),
  }));
  const index = [
    '# HOD — Índice de candidaturas',
    '',
    ...state.applications.map(a => `- ${a.company}${a.role ? ' — ' + a.role : ''} (${a.stage})`),
    '',
    state.guidelines.length ? '## Guidelines' : '',
    ...state.guidelines.map(g => `- ${g.title}`),
    '',
  ].join('\n');
  notes.unshift({ path: 'HOD — Índice.md', content: index });
  return notes;
}

export async function exportAll(obsidian, state) {
  const notes = buildNotes(state);
  let ok = 0;
  const errors = [];
  for (const note of notes) {
    try { await saveNote(obsidian, note.path, note.content); ok++; }
    catch (e) { errors.push(String(e.message || e)); }
  }
  return { ok, total: notes.length, errors };
}

export function downloadMarkdownBundle(state) {
  const notes = buildNotes(state);
  const bundle = notes.map(n => `<!-- ${n.path} -->\n${n.content}`).join('\n\n---\n\n');
  const blob = new Blob([bundle], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `HOD-obsidian-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
