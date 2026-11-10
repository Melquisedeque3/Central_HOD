/**
 * Módulo de Integração com Google Sheets e Google Calendar
 * Suporta Google Apps Script Web App (Sem necessidade de Client ID ou OAuth2)
 */
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbwLmHTFpNRlck5uCQBIYnlxWHuNj-nbVMgwWmMyehTDVqrkRWrqLZQXIeh23NSUEcz3/exec';

const GoogleAPI = {
  webAppUrl: null,

  async init() {
    const data = await this.getStorage(['hodWebAppUrl', 'hodSheetId']);
    if (data.hodWebAppUrl) {
      this.webAppUrl = data.hodWebAppUrl;
    } else if (data.hodSheetId && data.hodSheetId.startsWith('https://script.google.com/')) {
      this.webAppUrl = data.hodSheetId;
    } else {
      this.webAppUrl = DEFAULT_URL;
    }
  },

  getStorage(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        const res = {};
        keys.forEach(k => { res[k] = localStorage.getItem(k); });
        resolve(res);
      }
    });
  },

  setStorage(data) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(data, resolve);
      } else {
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        resolve();
      }
    });
  },

  async setUrl(url) {
    const cleanUrl = url.trim();
    this.webAppUrl = cleanUrl;
    await this.setStorage({ hodWebAppUrl: cleanUrl, hodSheetId: cleanUrl });
    return cleanUrl;
  },

  isConnected() {
    return !!(this.webAppUrl && this.webAppUrl.startsWith('https://script.google.com/'));
  },

  /* ================= IMPORTAR / EXPORTAR VIA APPS SCRIPT ================= */

  async importFromGoogleSheets() {
    const targetUrl = this.webAppUrl || DEFAULT_URL;
    if (!targetUrl) throw new Error('Cole o link do Apps Script nas configurações.');
    
    const res = await fetch(targetUrl, { method: 'GET' });
    if (!res.ok) throw new Error('Erro ao conectar ao Apps Script (' + res.status + ')');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const tasks = (data.tasks || []).map((t, i) => ({
      id: t.id || 't_' + i + '_' + Date.now().toString(36),
      empresa: t.empresa || '',
      acao: t.acao || '',
      status: t.status || 'A fazer',
      prioridade: t.prioridade || 'Importante',
      quando: t.quando || ''
    }));

    const projects = (data.projects || []).map((p, i) => ({
      id: p.id || 'p_' + i + '_' + Date.now().toString(36),
      empresa: p.empresa || '',
      projeto: p.projeto || '',
      etapa: p.etapa || 'Candidatura',
      acao: p.acao || '',
      prioridade: p.prioridade || 'Importante',
      prazo: p.prazo || '',
      quando: p.quando || '',
      historico: p.historico || '',
      obs: p.obs || ''
    }));

    const events = (data.events || []).map((e, i) => ({
      id: e.id || 'e_' + i + '_' + Date.now().toString(36),
      dia: e.dia || '',
      evento: e.evento || '',
      ref: e.ref || '',
      meu: e.meu || '',
      status: e.status || 'A fazer',
      acao: e.acao || ''
    }));

    const routine = (data.routine || []).map((r, i) => ({
      id: r.id || 'r_' + i + '_' + Date.now().toString(36),
      freq: r.freq || 'Diária',
      atividade: r.atividade || '',
      oque: r.oque || '',
      done: !!r.done,
      prioridade: r.prioridade || 'Importante',
      quando: r.quando || ''
    }));

    return { tasks, projects, events, routine };
  },

  async exportToGoogleSheets(state) {
    const targetUrl = this.webAppUrl || DEFAULT_URL;
    if (!targetUrl) throw new Error('Cole o link do Apps Script nas configurações.');

    const payload = {
      action: 'save_all',
      tasks: state.tasks || [],
      projects: state.projects || [],
      events: state.events || [],
      routine: state.routine || []
    };

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch(e) {
      data = { success: true };
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  },

  /* ================= GOOGLE CALENDAR ================= */

  async createCalendarEvent(item) {
    const targetUrl = this.webAppUrl || DEFAULT_URL;
    if (!targetUrl) throw new Error('Configure o link do Apps Script primeiro.');

    const payload = {
      action: 'calendar_event',
      title: item.title,
      description: item.description || '',
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime || ''
    };

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch(e) {
      data = { success: true };
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }
};

window.GoogleAPI = GoogleAPI;
