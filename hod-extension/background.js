/* ============================================================
   background.js — abre ou foca o painel do HOD
   Sem permissão "tabs": o próprio painel responde ao ping,
   então nunca focamos a aba errada.
   ============================================================ */

const PANEL_URL = chrome.runtime.getURL('index.html');
let panelTabId = null;

async function isPanel(tabId) {
  if (!tabId) return false;
  try {
    const reply = await chrome.tabs.sendMessage(tabId, { type: 'hod:ping' });
    return !!reply?.ok;
  } catch {
    return false;
  }
}

async function focusPanel(tabId) {
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
    return true;
  } catch {
    return false;
  }
}

async function findPanelTab() {
  if (await isPanel(panelTabId)) return panelTabId;
  // O service worker pode dormir e perder o id: procura o painel entre as abas abertas.
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.id !== panelTabId && await isPanel(tab.id)) {
      panelTabId = tab.id;
      return tab.id;
    }
  }
  return null;
}

async function openPanel() {
  const existing = await findPanelTab();
  if (existing) return focusPanel(existing);
  const tab = await chrome.tabs.create({ url: PANEL_URL });
  panelTabId = tab.id ?? null;
  return true;
}

chrome.action.onClicked.addListener(() => { openPanel(); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'hod:panel-ready' && sender.tab?.id) {
    panelTabId = sender.tab.id;
  }
  // Chrome exige sendResponse síncrono ou `return true` — Promise não é suportada aqui.
  if (message?.type === 'hod:ping') {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (tabId === panelTabId) panelTabId = null;
});

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') chrome.tabs.create({ url: PANEL_URL });
});
