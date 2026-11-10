// Abre o painel em uma nova aba ou foca na aba já existente ao clicar no ícone da extensão
chrome.action.onClicked.addListener(async () => {
  const targetUrl = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find(t => t.url && t.url.startsWith(targetUrl));

  if (existingTab && existingTab.id) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }
});

