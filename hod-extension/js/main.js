/* ============================================================
   main.js — shell, rotas, atalhos e ciclo de render
   ============================================================ */
import { $, $$, toast, esc } from './ui.js';
import { getState, load, subscribe } from './store.js';
import { dispatch } from './actions.js';
import { setFilter } from './state.js';
import { openAppModal } from './views/modals.js';

import * as home from './views/home.js';
import * as pipeline from './views/pipeline.js';
import * as apps from './views/apps.js';
import * as appDetail from './views/appDetail.js';
import * as tasks from './views/tasks.js';
import * as study from './views/study.js';
import * as settings from './views/settings.js';

const ROUTES = [
  { pattern: /^\/?$/, view: home, name: 'home' },
  { pattern: /^\/home$/, view: home, name: 'home' },
  { pattern: /^\/pipeline$/, view: pipeline, name: 'pipeline' },
  { pattern: /^\/apps$/, view: apps, name: 'apps' },
  { pattern: /^\/apps\/([^/]+)$/, view: appDetail, name: 'apps' },
  { pattern: /^\/tasks$/, view: tasks, name: 'tasks' },
  { pattern: /^\/study$/, view: study, name: 'study' },
  { pattern: /^\/settings$/, view: settings, name: 'settings' },
];

const ROUTE_ORDER = ['home', 'pipeline', 'apps', 'tasks', 'study', 'settings'];
const PAGE_LABEL = { home: 'Início', pipeline: 'Pipeline', apps: 'Processos', tasks: 'Tarefas', study: 'Estudo', settings: 'Ajustes' };

const viewEl = $('#view');
const viewBody = $('#view-body');
let current = { view: home, params: {}, name: 'home' };
let lastRenderedAt = 0;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/home';
  const [path, queryString = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryString));
  for (const route of ROUTES) {
    const m = path.match(route.pattern);
    if (m) return { view: route.view, name: route.name, params: { ...params, id: m[1] || undefined } };
  }
  return { view: home, name: 'home', params: {} };
}

function activeNav(name) {
  $$('.dock-app[data-route]').forEach(el => {
    const on = el.dataset.route === name;
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  document.documentElement.dataset.hqPage = name;
  updateGlide();
}

function updateBreadcrumb(meta) {
  const parent = $('#crumb-parent');
  const sep = $('#crumb-sep');
  const sep2 = $('#crumb-sep-2');
  const crumb = $('#crumb-current');
  const isDetail = current.name === 'apps' && !!current.params.id;

  if (isDetail) {
    parent.hidden = false;
    parent.textContent = 'Processos';
    parent.dataset.nav = 'apps';
    sep.hidden = false;
    sep2.hidden = false;
    crumb.textContent = viewBody.dataset.crumb || 'Processo';
  } else {
    parent.hidden = true;
    sep.hidden = false;
    sep2.hidden = true;
    crumb.textContent = PAGE_LABEL[current.name] || meta.kicker || 'HOD';
  }
}

function render({ focus } = {}) {
  const focusSnapshot = focus || captureFocus();
  viewEl.classList.add('is-rendering');
  delete viewBody.dataset.crumb;
  delete viewBody.dataset.pageTitle;
  delete viewBody.dataset.subtitle;
  delete viewBody.dataset.hidePageHead;

  try {
    current.view.render(viewBody, current.params);
  } catch (err) {
    console.error(err);
    viewBody.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><h3>Algo quebrou nesta tela</h3><p>${esc(String(err.message || err))}</p><button class="btn" id="reloadPanel">Recarregar</button></div>`;
    $('#reloadPanel')?.addEventListener('click', () => location.reload());
  }

  viewEl.classList.remove('is-rendering');
  const meta = current.view.meta || {};
  const pageTitle = viewBody.dataset.pageTitle || meta.title || '';
  const subtitle = viewBody.dataset.subtitle || '';
  const isHome = current.name === 'home';

  $('#page-head').hidden = isHome || viewBody.dataset.hidePageHead === '1';
  $('#page-kicker').textContent = meta.kicker || '';
  $('#page-title').textContent = pageTitle;
  const subtitleEl = $('#page-subtitle');
  subtitleEl.textContent = subtitle;
  subtitleEl.hidden = !subtitle;

  document.body.dataset.page = current.name;
  document.title = pageTitle ? `${pageTitle} — HOD` : 'HOD';
  updateBreadcrumb(meta);
  activeNav(current.name);
  updateBadges();
  restoreFocus(focusSnapshot);
  lastRenderedAt = Date.now();
}

function captureFocus() {
  const el = document.activeElement;
  if (!el || !viewEl.contains(el)) return null;
  const key = el.dataset.filter || (el.id ? `#${el.id}` : '');
  if (!key) return null;
  return { key, start: el.selectionStart, end: el.selectionEnd };
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const el = snapshot.key.startsWith('#')
    ? viewEl.querySelector(snapshot.key)
    : viewEl.querySelector(`[data-filter="${snapshot.key}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (typeof el.setSelectionRange === 'function' && snapshot.start != null) {
    try { el.setSelectionRange(snapshot.start, snapshot.end); } catch { /* ignore */ }
  }
}

function applyRoute(next) {
  current = next;
  render();
  updateHistoryButtons();
  if (current.params.new) {
    history.replaceState(null, '', '#/apps');
    openAppModal();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

let activeTransition = null;

function navigate() {
  const next = parseHash();
  const same = next.name === current.name
    && (next.params.id || '') === (current.params.id || '')
    && (next.params.g || '') === (current.params.g || '');

  if (same) { applyRoute(next); return; }

  /* trilha de histórico (idempotente com voltar/avançar) */
  if (historyOp === 'back') {
    /* trail já foi popped e fwd já recebeu a tela de saída */
  } else if (historyOp === 'forward') {
    /* trail já recebeu a tela de saída; fwd já foi popped */
  } else {
    fwd.length = 0;
    trailPush(current.name);
  }
  historyOp = null;

  const from = ROUTE_ORDER.indexOf(current.name);
  const to = ROUTE_ORDER.indexOf(next.name);
  const dir = to >= from ? 'forward' : 'back';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (document.startViewTransition && !reduced && !activeTransition) {
    document.documentElement.dataset.hqRouteDir = dir;
    document.documentElement.classList.add('hq-route-transition');
    const transition = document.startViewTransition(() => applyRoute(next));
    activeTransition = transition;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      activeTransition = null;
      document.documentElement.classList.remove('hq-route-transition');
    });
  } else {
    applyRoute(next);
  }
}

/* ============================================================
   dock inferior — histórias, glide, onda de magnificação,
   setas de rolagem, badges e atalhos (espelho do EMAI HQ)
   ============================================================ */
const dock = $('#control-dock');
const dockCore = $('#dock-core');
const dockBackBtn = $('#dock-back');
const dockForwardBtn = $('#dock-forward');
const cueLeft = $('#dock-cue-left');
const cueRight = $('#dock-cue-right');

/* trilha de navegação interna: retroceder/avançar entre telas */
const trail = [];
const fwd = [];
let historyOp = null; // 'back' | 'forward' | null

function trailPush(name) {
  if (!name || trail[trail.length - 1] === name) return;
  trail.push(name);
  if (trail.length > 32) trail.shift();
}

function updateHistoryButtons() {
  if (dockBackBtn) dockBackBtn.hidden = trail.length === 0;
  if (dockForwardBtn) dockForwardBtn.hidden = fwd.length === 0;
}

function dockBack() {
  if (!trail.length) return;
  const to = trail.pop();
  fwd.push(current.name);
  historyOp = 'back';
  location.hash = `#/${to}`;
}

function dockForward() {
  if (!fwd.length) return;
  const to = fwd.pop();
  trailPush(current.name);
  historyOp = 'forward';
  location.hash = `#/${to}`;
}

dockBackBtn?.addEventListener('click', dockBack);
dockForwardBtn?.addEventListener('click', dockForward);

/* indicador deslizante sob o tile da página atual */
function updateGlide() {
  if (!dockCore) return;
  const cur = dockCore.querySelector('.dock-app[aria-current="page"]');
  if (!cur) { dockCore.style.setProperty('--glide-w', '0px'); return; }
  dockCore.style.setProperty('--glide-x', `${cur.offsetLeft}px`);
  dockCore.style.setProperty('--glide-w', `${cur.offsetWidth}px`);
}

/* setas de rolagem do trilho em telas estreitas */
function updateCues() {
  if (!dockCore || !cueLeft || !cueRight) return;
  const scrollable = dockCore.scrollWidth > dockCore.clientWidth + 2;
  dockCore.classList.toggle('is-scrollable', scrollable);
  if (!scrollable) { cueLeft.hidden = true; cueRight.hidden = true; return; }
  const max = dockCore.scrollWidth - dockCore.clientWidth;
  cueLeft.hidden = dockCore.scrollLeft <= 2;
  cueRight.hidden = dockCore.scrollLeft >= max - 2;
}
cueLeft?.addEventListener('click', () => dockCore.scrollBy({ left: -156, behavior: 'smooth' }));
cueRight?.addEventListener('click', () => dockCore.scrollBy({ left: 156, behavior: 'smooth' }));
dockCore?.addEventListener('scroll', updateCues, { passive: true });
window.addEventListener('resize', () => { requestAnimationFrame(() => { updateGlide(); updateCues(); }); });

/* teclado do trilho: setas movem o foco, Home/End, ↑ volta ao conteúdo */
dockCore?.addEventListener('keydown', e => {
  const items = Array.from(dockCore.querySelectorAll('.dock-app'));
  const idx = items.indexOf(document.activeElement);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    if (idx < 0) return;
    e.preventDefault();
    items[(idx + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]?.focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    if (idx < 0) return;
    e.preventDefault();
    items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    viewEl.focus({ preventScroll: true });
  }
});

/* atalho numérico 1–6: pisca o tile e navega */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (dockBackBtn?.matches(':focus-visible') || dockForwardBtn?.matches(':focus-visible'))) return;
  if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (!Number.isInteger(n) || n < 1 || n > 6) return;
  const target = dockCore?.querySelectorAll('.dock-app')[n - 1];
  if (!target || target.getAttribute('aria-current') === 'page') return;
  target.classList.add('is-pressed');
  setTimeout(() => target.classList.remove('is-pressed'), 240);
  trail.length = 0;
  fwd.length = 0;
  historyOp = null;
  location.hash = `#/${target.dataset.route}`;
});

/* Alt+← / Alt+→ = retroceder/avançar telas */
document.addEventListener('keydown', e => {
  if (!e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); dockBack(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); dockForward(); }
});

/* onda contínua de magnificação (mesma física do EMAI HQ) */
let dockLast = 0;
function hqDockMagnify(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  const t = performance.now();
  if (t - dockLast < 14) return;
  dockLast = t;
  dock.classList.add('is-tracking');
  for (const el of dock.querySelectorAll('.dock-app, .dock-history')) {
    const r = el.getBoundingClientRect();
    const d = Math.abs(e.clientX - (r.left + r.width / 2));
    const o = Math.max(0, 1 - d / 150);
    el.style.setProperty('--mag', (1 + .42 * o * o).toFixed(3));
  }
}
function hqDockRelax(e) {
  dockLast = 0;
  e.currentTarget.classList.remove('is-tracking');
  for (const el of dock.querySelectorAll('[style*="--mag"]')) el.style.removeProperty('--mag');
}
dock?.addEventListener('pointermove', hqDockMagnify);
dock?.addEventListener('pointerleave', hqDockRelax);

/* badge de contagem (ex.: tarefas atrasadas / de hoje) */
function setBadge(routeName, count) {
  const tile = dockCore?.querySelector(`.dock-app[data-route="${routeName}"]`);
  if (!tile) return;
  tile.querySelector('.dock-badge')?.remove();
  if (!count) return;
  const b = document.createElement('b');
  b.className = 'dock-badge';
  b.setAttribute('aria-hidden', 'true');
  b.textContent = count > 9 ? '9+' : String(count);
  tile.appendChild(b);
}

function updateBadges() {
  try {
    const st = getState();
    const today = new Date().toISOString().slice(0, 10);
    const due = (st.tasks || []).filter(t => t.status !== 'done' && t.dueAt && t.dueAt.slice(0, 10) <= today).length;
    setBadge('tasks', due);
  } catch { /* estado ainda não carregado */ }
}

/* ---------- eventos globais ---------- */
// Delegado no documento: cobre a view, a topbar e qualquer ação fora do <main>.
document.addEventListener('click', e => {
  if (!(e.target instanceof Element)) return;
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    e.preventDefault();
    const target = nav.dataset.nav;
    if (target) location.hash = target.startsWith('#') ? target : `#/${target}`;
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  dispatch(el.dataset.action, { ...el.dataset }, el);
});

let filterTimer = null;
function onFilter(e) {
  const el = e.target.closest('[data-filter]');
  if (!el) return;
  setFilter(el.dataset.filter, el.value);
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => render({ focus: captureFocus() }), el.tagName === 'INPUT' ? 140 : 0);
}
viewEl.addEventListener('input', onFilter);
viewEl.addEventListener('change', onFilter);

window.addEventListener('hashchange', navigate);
subscribe(() => { if (Date.now() - lastRenderedAt > 30) render(); });

/* ---------- atalhos ---------- */
let gPressed = 0;
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.toLowerCase() === 'g') { gPressed = Date.now(); return; }
  if (Date.now() - gPressed < 900) {
    const map = { h: '#/home', p: '#/pipeline', t: '#/tasks', e: '#/study', s: '#/settings', a: '#/apps' };
    const target = map[e.key.toLowerCase()];
    if (target) { location.hash = target; gPressed = 0; }
  }
  if (e.key === 'n' && current.name === 'tasks') dispatch('new-task', {});
  if (e.key === '/' && current.name !== 'settings') {
    const input = viewEl.querySelector('[data-filter$=".q"]');
    if (input) { e.preventDefault(); input.focus(); }
  }
});

/* ---------- relógio ---------- */
function tick() {
  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const clockTime = $('#clock-time');
  const clockDate = $('#clock-date');
  if (clockTime) clockTime.textContent = time;
  if (clockDate) clockDate.textContent = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  const heroClock = $('#home-clock');
  if (heroClock) heroClock.textContent = time;
}

async function boot() {
  await load();
  tick();
  setInterval(tick, 30000);
  navigate();
  requestAnimationFrame(() => { updateGlide(); updateCues(); updateHistoryButtons(); });
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try { chrome.runtime.sendMessage({ type: 'hod:panel-ready' }); } catch { /* sem service worker */ }
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === 'hod:ping') { sendResponse({ ok: true }); return true; }
      return false;
    });
  }
  window.addEventListener('beforeunload', () => { import('./store.js').then(m => m.flush()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) import('./store.js').then(m => m.flush()); });
}

boot();
