/* ============================================================
   frontmatter.mjs — leitor/escritor do subconjunto de YAML que o
   HOD usa nas notas do Obsidian.

   Suporta:
     chave: valor            (string, número, booleano, null)
     chave: "texto citado"
     chave: |                (bloco multilinha literal)
     chave: [ ... ]          (flow collection JSON)
     chave: { ... }          (flow collection JSON)
     chave:
       - item
       - item
   Sem dependências externas.
   ============================================================ */

const FM_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function splitFrontmatter(text) {
  const src = String(text ?? '');
  const m = FM_RE.exec(src);
  if (!m) return { raw: '', body: src };
  return { raw: m[1], body: src.slice(m[0].length) };
}

export function parseFrontmatter(text) {
  const { raw, body } = splitFrontmatter(text);
  return { data: raw ? parseYaml(raw) : {}, body };
}

function coerce(value) {
  const s = String(value).trim();
  if (s === '' || s === '~' || s === 'null') return s === '' ? '' : null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+$/.test(s)) return Number(s);
  if (s.startsWith('[') || s.startsWith('{')) {
    try { return JSON.parse(s); } catch { /* cai para string */ }
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    return s.startsWith('"') ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n') : inner;
  }
  return s;
}

export function parseYaml(raw) {
  const out = {};
  const lines = String(raw).replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }

    const m = /^([A-Za-z0-9_.-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2];

    /* bloco literal | ou |- */
    if (/^\|[+-]?$/.test(rest.trim())) {
      i++;
      const buf = [];
      let indent = null;
      while (i < lines.length) {
        const cur = lines[i];
        if (cur.trim() === '') { buf.push(''); i++; continue; }
        const ind = cur.length - cur.trimStart().length;
        if (indent === null) indent = ind;
        if (ind < indent) break;
        buf.push(cur.slice(indent));
        i++;
      }
      while (buf.length && buf[buf.length - 1] === '') buf.pop();
      out[key] = buf.join('\n');
      continue;
    }

    /* lista em bloco */
    if (rest.trim() === '') {
      const items = [];
      let j = i + 1;
      let sawItem = false;
      while (j < lines.length) {
        const cur = lines[j];
        if (!cur.trim()) { j++; continue; }
        const im = /^[ \t]*-[ \t]+(.*)$/.exec(cur);
        if (!im) break;
        items.push(coerce(im[1]));
        sawItem = true;
        j++;
      }
      if (sawItem) { out[key] = items; i = j; continue; }
      out[key] = '';
      i++;
      continue;
    }

    out[key] = coerce(rest);
    i++;
  }

  return out;
}

function needsQuote(s) {
  if (s === '') return true;
  if (/^[\s>|*&!%@`{}[\]#,-]/.test(s)) return true;
  if (/[:#]\s/.test(s) || s !== s.trim()) return true;
  if (/^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(s)) return true;
  return false;
}

function scalar(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const s = String(value);
  if (s.includes('\n')) return null; // sinaliza bloco
  return needsQuote(s) ? JSON.stringify(s) : s;
}

export function stringifyYaml(data) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (Array.isArray(value) || (value && typeof value === 'object')) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
      continue;
    }

    const text = String(value ?? '');
    if (text.includes('\n')) {
      lines.push(`${key}: |`);
      for (const l of text.replace(/\s+$/, '').split('\n')) lines.push(`  ${l}`);
      continue;
    }
    lines.push(`${key}: ${scalar(value)}`);
  }
  return lines.join('\n');
}

export function buildNote(data, body) {
  return `---\n${stringifyYaml(data)}\n---\n\n${String(body ?? '').replace(/^\n+/, '').trimEnd()}\n`;
}
