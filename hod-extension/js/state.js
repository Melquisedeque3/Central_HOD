/* ============================================================
   state.js — estado de interface (filtros, painéis)
   ============================================================ */
export const uiState = {
  home: { day: '' },
  pipeline: { q: '', priority: '' },
  tasks: { q: '', status: 'open', priority: '', app: '' },
  apps: { q: '', stage: '' },
  study: { q: '', app: '' },
  ai: { tab: 'chat' },
};

export function getFilter(path) {
  const [section, key] = path.split('.');
  return uiState[section]?.[key];
}

export function setFilter(path, value) {
  const [section, key] = path.split('.');
  if (!uiState[section]) return;
  uiState[section][key] = value;
}
