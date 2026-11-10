/* ================= DADOS E CONSTANTES ================= */
const ETAPAS = ["Candidatura","Teste / qualificação","Aguardando resposta","Aprovado / onboarding","Ativo","Pausado / sem tarefas","Encerrado"];
const ETAPA_COR = {"Candidatura":"#38bdf8","Teste / qualificação":"#f59e0b","Aguardando resposta":"#a78bfa","Aprovado / onboarding":"#22c55e","Ativo":"#7ec8a4","Pausado / sem tarefas":"#8b98ad","Encerrado":"#5c6b82"};

const SEED = {
tasks:[
 {empresa:"Currículo",acao:"Montar currículo base",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Currículo",acao:"Enviar para revisão",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Currículo",acao:"Aplicar ajustes recebidos",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"LinkedIn",acao:"Montar ou atualizar perfil",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"CrowdGen",acao:"Assistir à aula correspondente",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"CrowdGen",acao:"Montar cadastro, completar perfil e guardar acesso",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Outlier",acao:"Assistir à aula correspondente",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Outlier",acao:"Montar cadastro, completar perfil e guardar acesso",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Welocalize",acao:"Assistir à aula correspondente",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"OneForma",acao:"Montar cadastro, completar perfil e guardar acesso",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Alignerr",acao:"Concluir verificações, testes ou certificações aplicáveis",status:"A fazer",prioridade:"Importante",quando:""},
 {empresa:"Ganhos rápidos",acao:"Consultar aulas e escolher oportunidade compatível",status:"A fazer",prioridade:"Pode esperar",quando:""}
],
projects:[],
events:[
 {dia:"Segunda",evento:"Encontro BLACK (alunos da modalidade)",ref:"19h às 21h",meu:"",status:"A fazer",acao:"Registrar ações relevantes"},
 {dia:"Terça",evento:"Encontro com Felipe, Diego e mentores",ref:"19h às 21h30",meu:"",status:"A fazer",acao:"Consultar Top 5 e listar vagas de interesse"},
 {dia:"Quarta",evento:"Aula de inglês",ref:"19h30 às 20h30",meu:"",status:"A fazer",acao:"Reservar prática"},
 {dia:"Quinta",evento:"Monitoria com Kati",ref:"14h",meu:"",status:"A fazer",acao:"Levar dúvida com empresa, projeto e etapa"},
 {dia:"Sexta",evento:"—",ref:"",meu:"",status:"A fazer",acao:""},
 {dia:"Sábado",evento:"SOS Vagas",ref:"10h",meu:"",status:"A fazer",acao:"Atualizar candidaturas e próximos passos"},
 {dia:"Extras",evento:"Aulas especiais e eventos extras",ref:"Conferir grupo de avisos",meu:"",status:"A fazer",acao:"Registrar próximas ações"}
],
routine:[
 {freq:"Diária",atividade:"E-mail e plataformas",oque:"Conferir caixa de entrada, spam, convites, notificações e prazos",prioridade:"Importante",quando:"Horário fixo — 10 a 15 min"},
 {freq:"Diária",atividade:"Três tarefas principais",oque:"Escolher três ações que caibam no tempo disponível e executar na ordem de prioridade",prioridade:"Importante",quando:"Antes de começar"},
 {freq:"Diária",atividade:"Tarefa 1",oque:"Copiar do controle a empresa, projeto e ação principal",prioridade:"Importante",quando:"Definir"},
 {freq:"Diária",atividade:"Tarefa 2",oque:"Copiar do controle a segunda ação",prioridade:"Importante",quando:"Definir"},
 {freq:"Diária",atividade:"Tarefa 3",oque:"Copiar do controle a terceira ação",prioridade:"Importante",quando:"Definir"},
 {freq:"Diária",atividade:"Atualizar controle",oque:"Atualizar status e registrar próxima ação",prioridade:"Importante",quando:"Ao terminar — 5 min"},
 {freq:"Semanal — domingo",atividade:"Planejar a semana",oque:"Revisar concluídos, pendências, convites e prazos",prioridade:"Importante",quando:"Todo domingo"},
 {freq:"Semanal — domingo",atividade:"Reservar agenda",oque:"Conferir eventos; reservar horários e distribuir tarefas pelos dias",prioridade:"Importante",quando:"Todo domingo"},
 {freq:"Semanal — domingo",atividade:"Ajustar o volume",oque:"Planejar três tarefas por dia; dividir as grandes e deixar espaço para imprevistos",prioridade:"Importante",quando:"Todo domingo"},
 {freq:"Semanal — radar",atividade:"Live de terça",oque:"Participar ao vivo ou assistir à gravação",prioridade:"Importante",quando:"Conforme agenda"},
 {freq:"Semanal — radar",atividade:"Top 5 / MindMeister",oque:"Consultar Top 5 e anotar vagas que chamaram atenção",prioridade:"Importante",quando:"Após live ou gravação"},
 {freq:"Semanal — radar",atividade:"Discord e avisos",oque:"Consultar vagas e comunicados em horário reservado",prioridade:"Importante",quando:"Definir"},
 {freq:"Semanal — radar",atividade:"Selecionar vagas",oque:"Conferir país, idioma, equipamento, formação, disponibilidade e prazo",prioridade:"Importante",quando:"Após selecionar"},
 {freq:"Semanal — radar",atividade:"Registrar candidaturas",oque:"Adicionar empresa, projeto, ações, prioridade e data no Meu controle",prioridade:"Importante",quando:"Após conferir requisitos"},
 {freq:"Semanal — radar",atividade:"Acompanhar retornos",oque:"Consultar processos aguardando resposta nas datas marcadas",prioridade:"Importante",quando:"Conforme controle"}
]};

const KEY = 'hodControleV2';
function uid(){return 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

function loadInitialState(){
  try{
    const s = localStorage.getItem(KEY);
    if(s){
      const d = JSON.parse(s);
      if(d && d.tasks) return d;
    }
  }catch(e){}
  const c = JSON.parse(JSON.stringify(SEED));
  c.tasks.forEach(t => t.id = uid());
  c.events.forEach(t => t.id = uid());
  c.routine.forEach(t => { t.id = uid(); t.done = false; });
  c.projects.forEach(t => t.id = uid());
  return c;
}

let state = loadInitialState();
let autoSyncTimer = null;

function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [KEY]: state });
  }
  if(GoogleAPI.isConnected()){
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => { autoSyncToSheets(); }, 1500);
  }
}

async function autoSyncToSheets(){
  if(!GoogleAPI.isConnected()) return;
  const btn = document.getElementById('btnSyncSheets');
  try{
    if(btn) btn.textContent = '⏳';
    await GoogleAPI.exportToGoogleSheets(state);
    if(btn){ btn.textContent = '✔ Sync'; setTimeout(() => { btn.textContent = '↺ Sync'; }, 2000); }
  }catch(e){
    console.error('Falha no auto-sync:', e);
    if(btn) btn.textContent = '↺ Sync';
  }
}

/* ================= HELPERS ================= */
const STATUS_CLS = {"A fazer":"s-afazer","Fazendo":"s-fazendo","Aguardando":"s-aguardando","Concluído":"s-concluido","Encerrado":"s-encerrado"};
const PRIO_CLS = {"Urgente":"b-urgente","Importante":"b-importante","Pode esperar":"b-pode","—":"b-none","":"b-none"};

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function prioBadge(p){
  if(!p||p==='—')return '<span class="badge b-none">—</span>';
  return '<span class="badge '+PRIO_CLS[p]+'">'+p+'</span>';
}

function statusBadge(s){
  return '<span class="badge '+(STATUS_CLS[s]||'b-none')+'">'+esc(s)+'</span>';
}

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._x);
  t._x=setTimeout(()=>t.classList.remove('show'),2500);
}

function statusSelect(cur, actionType, id){
  return '<select class="inline" data-action="'+actionType+'" data-id="'+id+'">'+
    ['A fazer','Fazendo','Aguardando','Concluído','Encerrado'].map(s=>'<option'+(s===cur?' selected':'')+'>'+s+'</option>').join('')+
    '</select>';
}

function formatDate(isoStr){
  if(!isoStr) return '<span style="color:var(--muted2)">—</span>';
  if(!/^\d{4}-\d{2}-\d{2}/.test(isoStr)) return esc(isoStr);
  const p = isoStr.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function formatDateTime(isoStr){
  if(!isoStr) return '<span style="color:var(--muted2)">—</span>';
  if(!isoStr.includes('T')) return formatDate(isoStr);
  const [d, t] = isoStr.split('T');
  const dp = d.split('-');
  return `📅 ${dp[2]}/${dp[1]}/${dp[0]} às ${t}`;
}

function checkDateUrgency(dateOrDateTimeStr){
  if(!dateOrDateTimeStr) return null;
  const d = new Date(dateOrDateTimeStr);
  if(isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Vencido', color: 'var(--red)', isUrgent: true };
  if (diffDays === 0) return { label: 'Hoje', color: 'var(--amber)', isUrgent: true };
  if (diffDays === 1) return { label: 'Amanhã', color: 'var(--blue)', isUrgent: false };
  return null;
}

/* ================= NAVEGAÇÃO HQ ================= */
let currentView = 'home';

function switchView(v){
  currentView = v;
  document.querySelectorAll('.destination-view').forEach(s => s.classList.toggle('active', s.id === 'view-'+v));
  document.querySelectorAll('.dock-btn[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === v));
  if(v === 'kanban') renderKanban();
  if(v === 'events') renderEvents();
  if(v === 'routine') renderRoutine();
  if(v === 'tasks') renderTasks();
  if(v === 'home') renderHome();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

/* ================= CLOCK & HEADER ================= */
function updateClock(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const el = document.getElementById('hdTime');
  if(el) el.textContent = hh+':'+mm;
}

function initHeader(){
  const hoje = new Date();
  const diasSem = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  const todayEl = document.getElementById('hdToday');
  if(todayEl) todayEl.textContent = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const weekEl = document.getElementById('hdWeek');
  if(weekEl) weekEl.textContent = diasSem[hoje.getDay()];

  updateClock();
  setInterval(updateClock, 10000);

  // Calendar strip
  buildCalendarStrip();
}

function buildCalendarStrip(){
  const track = document.getElementById('dateTrack');
  if(!track) return;
  const monthEl = document.getElementById('calMonthYear');
  const hoje = new Date();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const diaSemAbr = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  if(monthEl) monthEl.textContent = `${meses[hoje.getMonth()]} ${hoje.getFullYear()}`;

  track.innerHTML = '';
  for(let i = 0; i < 7; i++){
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const isToday = i === 0;
    const btn = document.createElement('button');
    btn.className = isToday ? 'today-day' : '';
    if(isToday) btn.setAttribute('aria-current','date');
    btn.innerHTML = `<span>${diaSemAbr[d.getDay()]}</span><strong>${d.getDate()}</strong>`;
    track.appendChild(btn);
  }

  // Labels de status
  const ab = state.tasks.filter(t=>t.status!=='Concluído'&&t.status!=='Encerrado').length;
  const urg = state.tasks.filter(t=>t.prioridade==='Urgente'&&t.status!=='Concluído'&&t.status!=='Encerrado').length;
  const urgLabel = document.getElementById('calUrgentLabel');
  const todayLabel = document.getElementById('calTodayLabel');
  if(urgLabel && urg > 0) urgLabel.textContent = `🔔 ${urg} urgente${urg>1?'s':''} ·`;
  if(todayLabel) todayLabel.textContent = `≡ ${ab} por fazer`;
}

/* ================= HOME VIEW ================= */
function renderHome(){
  buildCalendarStrip();

  const T = state.tasks;
  const ab = T.filter(t=>t.status!=='Concluído'&&t.status!=='Encerrado');
  const doing = T.filter(t=>t.status==='Fazendo');
  const urg = ab.filter(t=>{
    if(t.prioridade==='Urgente') return true;
    const u = checkDateUrgency(t.quando);
    return u && u.isUrgent;
  });
  const conc = T.filter(t=>t.status==='Concluído').length;
  const pct = T.length ? Math.round(conc/T.length*100) : 0;

  // Badges nos tiles
  const setEl = (id,v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('tileBadgeTasks', ab.length);
  setEl('tileSubTasks', `${ab.length} abe${ab.length===1?'rta':'rtas'} · ${pct}% concluído`);
  setEl('tileBadgeKanban', state.projects.length);
  setEl('tileSubKanban', `${state.projects.filter(p=>p.etapa==='Ativo').length} ativo${state.projects.filter(p=>p.etapa==='Ativo').length===1?'':'s'} de ${state.projects.length}`);
  setEl('totalOpenLabel', `${ab.length} tarefa${ab.length===1?'':'s'} aberta${ab.length===1?'':'s'}`);

  // Rotina
  const dailyRoutine = state.routine.filter(r=>r.freq==='Diária');
  const rdone = dailyRoutine.filter(r=>r.done).length;
  setEl('tileBadgeRoutine', `${rdone}/${dailyRoutine.length}`);
  setEl('tileSubRoutine', `${rdone} de ${dailyRoutine.length} concluído${rdone===1?'':'s'}`);

  // Dock badges
  const dockBT = document.getElementById('dockBadgeTasks');
  if(dockBT){ dockBT.style.display = ab.length>0?'grid':'none'; dockBT.textContent = ab.length>99?'99+':ab.length; }
  const dockBK = document.getElementById('dockBadgeKanban');
  if(dockBK){ dockBK.style.display = state.projects.length>0?'grid':'none'; dockBK.textContent = state.projects.length; }

  // Orientation: foco (tarefa mais urgente)
  const urgCount = document.getElementById('urgentCount');
  if(urgCount) urgCount.textContent = urg.length > 0 ? `${urg.length} urgente${urg.length>1?'s':''}` : 'Tudo ok ✓';

  const focusTask = document.getElementById('focusTask');
  const focusCompany = document.getElementById('focusCompany');
  if(focusTask){
    if(urg.length > 0){
      focusTask.textContent = urg[0].acao;
      if(focusCompany) focusCompany.textContent = urg[0].empresa + (urg[0].quando ? ' · '+formatDate(urg[0].quando).replace(/<[^>]*>/g,'') : '');
    } else if(doing.length > 0){
      focusTask.textContent = doing[0].acao;
      if(focusCompany) focusCompany.textContent = doing[0].empresa + ' · Em andamento';
    } else if(ab.length > 0){
      focusTask.textContent = ab[0].acao;
      if(focusCompany) focusCompany.textContent = ab[0].empresa;
    } else {
      focusTask.textContent = 'Todas as tarefas concluídas — ótimo trabalho!';
      if(focusCompany) focusCompany.textContent = '';
    }
  }

  // Orientation: em andamento
  const doingList = document.getElementById('doingList');
  const doingCount = document.getElementById('doingCount');
  if(doingList){
    if(doingCount) doingCount.textContent = doing.length;
    if(doing.length){
      doingList.innerHTML = doing.slice(0,4).map(t =>
        `<button class="orientation-item" data-action="go-task" data-id="${t.id}">
          <span class="decision-dot"></span>
          <span><strong>${esc(t.empresa)} — ${esc(t.acao)}</strong>
          <small>${t.quando?formatDate(t.quando).replace(/<[^>]*>/g,''):'sem data'}</small></span>
        </button>`
      ).join('');
    } else {
      doingList.innerHTML = '<span class="section-label" style="margin-top:16px">Nada em andamento — escolha uma tarefa para iniciar.</span>';
    }
  }

  // Orientation: rotina
  const routineList = document.getElementById('routineList');
  const routineCount = document.getElementById('routineCount');
  if(routineList){
    if(routineCount) routineCount.textContent = `${rdone}/${dailyRoutine.length}`;
    if(dailyRoutine.length){
      routineList.innerHTML = dailyRoutine.slice(0,4).map(r =>
        `<label class="orientation-item">
          <input type="checkbox" data-action="toggle-routine" data-id="${r.id}" ${r.done?'checked':''}>
          <span class="rcheck" style="width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(196,213,216,.4);flex-shrink:0;display:grid;place-items:center;transition:.15s;color:transparent;font-size:10px;${r.done?'background:var(--accent);border-color:var(--accent);color:#283135':''}">✔</span>
          <span><strong style="${r.done?'text-decoration:line-through;opacity:.5':''}">${esc(r.atividade)}</strong>
          <small>${esc(r.oque).substring(0,50)}${r.oque.length>50?'...':''}</small></span>
        </label>`
      ).join('');
    } else {
      routineList.innerHTML = '<span class="section-label">Rotina não configurada.</span>';
    }
  }
}

/* ================= TASKS VIEW ================= */
function updateBatchDeleteUI(){
  const checkedBoxes = document.querySelectorAll('.task-check:checked');
  const count = checkedBoxes.length;
  const bar = document.getElementById('batchBar');
  const countSpan = document.getElementById('countSelectedTasks');
  const checkAll = document.getElementById('checkAllTasks');

  if(bar) bar.classList.toggle('show', count > 0);
  if(countSpan) countSpan.textContent = count;

  const allBoxes = document.querySelectorAll('.task-check');
  if(checkAll && allBoxes.length > 0){
    checkAll.checked = count === allBoxes.length;
    checkAll.indeterminate = count > 0 && count < allBoxes.length;
  }
}

function deleteSelectedTasks(){
  const checkedBoxes = document.querySelectorAll('.task-check:checked');
  const ids = Array.from(checkedBoxes).map(cb => cb.dataset.id);
  if(ids.length === 0) return;
  if(confirm(`Excluir definitivamente as ${ids.length} tarefa(s) selecionada(s)?`)){
    state.tasks = state.tasks.filter(t => !ids.includes(t.id));
    save(); renderTasks(); renderHome();
    toast(`${ids.length} tarefa(s) excluída(s) ✔`);
  }
}

function renderTasks(){
  const q = (document.getElementById('fSearch')?.value || '').toLowerCase();
  const fs = document.getElementById('fStatus')?.value || '';
  const fp = document.getElementById('fPrio')?.value || '';
  const fg = document.getElementById('fGroup')?.value || '';
  const hideDone = document.getElementById('fHideDone')?.checked;

  // Atualiza filtro por empresa
  const grupos = [...new Set(state.tasks.map(t=>t.empresa))].sort();
  const gs = document.getElementById('fGroup');
  if(gs){
    const cur = gs.value;
    gs.innerHTML = '<option value="">Todas as empresas</option>'+
      grupos.map(g=>'<option'+(g===cur?' selected':'')+'>'+esc(g)+'</option>').join('');
  }

  let rows = state.tasks.filter(t =>
    (!q || t.empresa.toLowerCase().includes(q) || t.acao.toLowerCase().includes(q)) &&
    (!fs || t.status === fs) &&
    (!fp || t.prioridade === fp) &&
    (!fg || t.empresa === fg) &&
    (!hideDone || (t.status !== 'Concluído' && t.status !== 'Encerrado'))
  );

  const peso = {"Urgente":0,"Importante":1,"Pode esperar":2,"—":3};
  rows.sort((a,b) => (peso[a.prioridade]??4) - (peso[b.prioridade]??4) || a.empresa.localeCompare(b.empresa));

  const list = document.getElementById('taskList');
  if(!list) return;

  if(!rows.length){
    list.innerHTML = '<div class="empty-state"><div class="big">🔍</div>Nenhuma tarefa encontrada.</div>';
    return;
  }

  list.innerHTML = rows.map(t => {
    const isUrgent = (t.prioridade==='Urgente' || checkDateUrgency(t.quando)?.isUrgent) && t.status!=='Concluído' && t.status!=='Encerrado';
    const urgInfo = checkDateUrgency(t.quando);
    const dateTag = urgInfo ? `<span class="badge" style="background:${urgInfo.color};color:#04120a;margin-left:6px">${urgInfo.label}</span>` : '';
    const emp = t.empresa.split('—');

    return `<div class="task-entry${t.status==='Concluído'?' done':''}" data-id="${t.id}">
      <input type="checkbox" class="task-check" data-id="${t.id}" style="margin-top:4px;width:15px;height:15px;accent-color:var(--accent);flex-shrink:0;cursor:pointer">
      <button class="task-circle" data-action="task-toggle-done" data-id="${t.id}" title="${t.status==='Concluído'?'Reabrir':'Marcar como concluído'}">
        ${t.status==='Concluído'?'●':'○'}
      </button>
      <div class="task-body" style="flex:1;min-width:0">
        <h2>${esc(t.acao)}</h2>
        <small>
          <b style="color:var(--ink);opacity:.8">${esc(emp[0].trim())}</b>
          ${emp[1]?' — '+esc(emp.slice(1).join('—').trim()):''}
          &nbsp;·&nbsp;${statusBadge(t.status)}
          &nbsp;${prioBadge(t.prioridade)}
          ${dateTag}
          ${t.quando ? '&nbsp;·&nbsp;'+formatDateTime(t.quando).replace(/<[^>]*>/g,'') : ''}
        </small>
      </div>
      <div class="task-actions">
        ${t.status!=='Fazendo'&&t.status!=='Concluído'&&t.status!=='Encerrado'
          ? `<button class="action sm" data-action="task-quick-status" data-id="${t.id}" data-status="Fazendo">▶</button>`
          : ''}
        ${t.status==='Fazendo'
          ? `<button class="action sm primary" data-action="task-quick-status" data-id="${t.id}" data-status="Concluído">✔</button>`
          : ''}
        ${t.quando ? `<button class="icon-btn cal" data-action="cal-task" data-id="${t.id}" title="Google Agenda">📅</button>` : ''}
        <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Editar">✎</button>
        <button class="icon-btn del" data-action="del-task" data-id="${t.id}" title="Excluir">🗑</button>
      </div>
    </div>`;
  }).join('');

  updateBatchDeleteUI();
}

function taskStatus(id, v){
  const t = state.tasks.find(x=>x.id===id);
  if(t){ t.status=v; save(); renderTasks(); renderHome(); toast('Status: '+v); }
}

let editingTask = null;
let currentModalType = null;

function openTaskModal(id){
  editingTask = id || null;
  currentModalType = 'task';
  const t = id ? state.tasks.find(x=>x.id===id) : {empresa:'',acao:'',status:'A fazer',prioridade:'Importante',quando:''};
  document.getElementById('mTitle').textContent = id ? 'Editar tarefa' : 'Nova tarefa';
  document.getElementById('mBody').innerHTML =
    '<div class="field"><label>Empresa / Atividade</label><input id="mEmpresa" value="'+esc(t.empresa)+'" placeholder="Ex.: Welocalize"></div>'+
    '<div class="field"><label>O que fazer</label><input id="mAcao" value="'+esc(t.acao)+'" placeholder="Ex.: Concluir exame de qualificação"></div>'+
    '<div class="frow">'+
      '<div class="field"><label>Status</label><select id="mStatus">'+['A fazer','Fazendo','Aguardando','Concluído','Encerrado'].map(s=>'<option'+(s===t.status?' selected':'')+'>'+s+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Prioridade</label><select id="mPrio">'+['Urgente','Importante','Pode esperar','—'].map(s=>'<option'+(s===t.prioridade?' selected':'')+'>'+s+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="field"><label>Data e Horário (Google Agenda)</label><input type="datetime-local" id="mQuando" value="'+esc(t.quando)+'"></div>';

  let foot = document.querySelector('#overlay .modal-foot');
  foot.querySelector('.action.danger-modal')?.remove();
  if(id){
    const b = document.createElement('button');
    b.className = 'action danger-modal'; b.dataset.action = 'modal-del-task';
    b.textContent = 'Excluir'; b.style.marginRight = 'auto';
    foot.prepend(b);
  }
  document.getElementById('overlay').classList.add('open');
}

async function saveTask(){
  const d = {
    empresa: document.getElementById('mEmpresa').value.trim(),
    acao: document.getElementById('mAcao').value.trim(),
    status: document.getElementById('mStatus').value,
    prioridade: document.getElementById('mPrio').value,
    quando: document.getElementById('mQuando').value
  };
  if(!d.empresa || !d.acao){ toast('Preencha a empresa e o que fazer.'); return; }
  let targetId;
  if(editingTask){
    Object.assign(state.tasks.find(x=>x.id===editingTask), d);
    targetId = editingTask;
  } else {
    targetId = uid(); state.tasks.push({id:targetId,...d});
  }
  save(); closeModal(); renderTasks(); renderHome(); toast('Tarefa salva ✔');
  if(d.quando && GoogleAPI.isConnected()) syncTaskToCalendar(targetId);
}

function delTask(id){
  if(confirm('Excluir esta tarefa definitivamente?')){
    state.tasks = state.tasks.filter(t=>t.id!==id);
    save(); renderTasks(); renderHome(); toast('Tarefa excluída ✔');
  }
}

async function syncTaskToCalendar(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t||!t.quando){ toast('Defina uma data/horário.'); return; }
  try{
    toast('Sincronizando com Google Agenda...');
    await GoogleAPI.createCalendarEvent({
      title: `${t.empresa}: ${t.acao}`,
      description: `Status: ${t.status}\nPrioridade: ${t.prioridade}`,
      startDateTime: t.quando
    });
    toast('Evento adicionado ao Google Agenda! 📅');
  }catch(e){ toast('Erro no Calendar: '+e.message); }
}

/* ================= KANBAN ================= */
let dragId = null;

function renderKanban(){
  const kb = document.getElementById('kanban');
  if(!kb) return;
  kb.innerHTML = ETAPAS.map(et => {
    const ps = state.projects.filter(p=>p.etapa===et);
    const cards = ps.map(p =>
      `<div class="kcard" draggable="true" data-id="${p.id}">
        <div class="kemp">${esc(p.empresa)}</div>
        <div class="kproj">${esc(p.projeto)}</div>
        <div class="kacao"><b>Próxima:</b> ${esc(p.acao)}</div>
        <div class="kmeta">${prioBadge(p.prioridade)}${p.prazo?'<span class="badge b-pode">⏳ '+formatDate(p.prazo).replace(/<[^>]*>/g,'')+'</span>':''}</div>
        ${p.quando ? '<div class="kwhen">'+formatDateTime(p.quando).replace(/<[^>]*>/g,'')+'</div>' : ''}
        <div class="kedit" style="position:absolute;top:7px;right:7px;display:flex;gap:4px">
          ${p.quando?'<button class="icon-btn cal kedit" data-action="cal-proj" data-id="'+p.id+'">📅</button>':''}
          <button class="icon-btn kedit" data-action="edit-proj" data-id="${p.id}">✎</button>
        </div>
      </div>`
    ).join('');
    return `<div class="kcol" data-etapa="${et}" style="--cc:${ETAPA_COR[et]}">
      <div class="kcol-head"><span class="cdot"></span><h4>${et}</h4><span class="kcount">${ps.length}</span></div>
      <div class="kcards">${cards}</div>
      <button class="kadd" data-action="add-proj-etapa" data-etapa="${et}">+ Adicionar</button>
    </div>`;
  }).join('');

  kb.querySelectorAll('.kcard').forEach(c => {
    c.addEventListener('dragstart', e => {
      dragId = c.dataset.id; c.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    c.addEventListener('dragend', () => {
      c.classList.remove('dragging');
      kb.querySelectorAll('.kcol').forEach(k=>k.classList.remove('dragover'));
    });
  });

  kb.querySelectorAll('.kcol').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('dragover');
      const p = state.projects.find(x=>x.id===dragId);
      if(p && p.etapa !== col.dataset.etapa){
        p.etapa = col.dataset.etapa;
        p.historico = (p.historico?p.historico+' | ':'')+new Date().toLocaleDateString('pt-BR')+': '+col.dataset.etapa;
        save(); renderKanban(); renderHome();
        toast('Movido para "'+col.dataset.etapa+'"');
      }
    });
  });
}

let editingProj = null;
function openProjModal(id, etapa){
  editingProj = id || null;
  currentModalType = 'proj';
  const p = id ? state.projects.find(x=>x.id===id) : {empresa:'',projeto:'',etapa:etapa||'Candidatura',acao:'',prioridade:'Importante',prazo:'',quando:'',historico:'',obs:''};
  document.getElementById('mTitle').textContent = id ? 'Editar projeto' : 'Novo projeto';
  document.getElementById('mBody').innerHTML =
    '<div class="frow">'+
      '<div class="field"><label>Empresa</label><input id="pEmpresa" value="'+esc(p.empresa)+'" placeholder="Ex.: OneForma"></div>'+
      '<div class="field"><label>Projeto</label><input id="pProjeto" value="'+esc(p.projeto)+'" placeholder="Ex.: Busca BR"></div>'+
    '</div>'+
    '<div class="frow">'+
      '<div class="field"><label>Etapa</label><select id="pEtapa">'+ETAPAS.map(s=>'<option'+(s===p.etapa?' selected':'')+'>'+s+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Prioridade</label><select id="pPrio">'+['Urgente','Importante','Pode esperar','—'].map(s=>'<option'+(s===p.prioridade?' selected':'')+'>'+s+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="field"><label>Próxima ação</label><input id="pAcao" value="'+esc(p.acao)+'"></div>'+
    '<div class="frow">'+
      '<div class="field"><label>Prazo (data)</label><input type="date" id="pPrazo" value="'+esc(p.prazo)+'"></div>'+
      '<div class="field"><label>Quando fazer (data/hora)</label><input type="datetime-local" id="pQuando" value="'+esc(p.quando)+'"></div>'+
    '</div>'+
    '<div class="field"><label>Histórico</label><textarea id="pHist">'+esc(p.historico)+'</textarea></div>'+
    '<div class="field"><label>Link / Observações</label><input id="pObs" value="'+esc(p.obs)+'"></div>';

  let foot = document.querySelector('#overlay .modal-foot');
  foot.querySelector('.action.danger-modal')?.remove();
  foot.querySelector('.action.danger-modal')?.remove();
  if(id){
    const b = document.createElement('button');
    b.className = 'action danger-modal'; b.dataset.action = 'modal-del-proj';
    b.textContent = 'Excluir projeto'; b.style.marginRight = 'auto';
    foot.prepend(b);
  }
  document.getElementById('overlay').classList.add('open');
}

async function saveProj(){
  const d = {
    empresa: document.getElementById('pEmpresa').value.trim(),
    projeto: document.getElementById('pProjeto').value.trim(),
    etapa: document.getElementById('pEtapa').value,
    prioridade: document.getElementById('pPrio').value,
    acao: document.getElementById('pAcao').value.trim(),
    prazo: document.getElementById('pPrazo').value,
    quando: document.getElementById('pQuando').value,
    historico: document.getElementById('pHist').value.trim(),
    obs: document.getElementById('pObs').value.trim()
  };
  if(!d.empresa||!d.projeto){ toast('Preencha empresa e projeto.'); return; }
  let targetId;
  if(editingProj){
    Object.assign(state.projects.find(x=>x.id===editingProj), d);
    targetId = editingProj;
  } else {
    targetId = uid(); state.projects.push({id:targetId,...d});
  }
  save(); closeModal(); renderKanban(); renderHome(); toast('Projeto salvo ✔');
  if(d.quando && GoogleAPI.isConnected()) syncProjectToCalendar(targetId);
}

function delProj(id){
  if(confirm('Excluir este projeto?')){
    state.projects = state.projects.filter(p=>p.id!==id);
    save(); renderKanban(); renderHome(); toast('Projeto excluído');
  }
}

async function syncProjectToCalendar(id){
  const p = state.projects.find(x=>x.id===id);
  if(!p||!p.quando){ toast('Defina uma data/horário.'); return; }
  try{
    toast('Sincronizando com Google Agenda...');
    await GoogleAPI.createCalendarEvent({
      title: `${p.empresa} (${p.projeto}): ${p.acao}`,
      description: `Etapa: ${p.etapa}\nPróxima ação: ${p.acao}\nPrazo: ${p.prazo}\nObs: ${p.obs}`,
      startDateTime: p.quando
    });
    toast('Projeto sincronizado! 📅');
  }catch(e){ toast('Erro no Calendar: '+e.message); }
}

/* ================= EVENTS ================= */
const DIA_IDX = {"Domingo":0,"Segunda":1,"Terça":2,"Quarta":3,"Quinta":4,"Sexta":5,"Sábado":6};

function renderEvents(){
  const jsDay = new Date().getDay();
  const order = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Extras"];
  const grid = document.getElementById('days');
  if(!grid) return;
  grid.innerHTML = order.map(d => {
    const evts = state.events.filter(e => e.dia===d && e.evento && e.evento!=='—');
    const isToday = DIA_IDX[d] === jsDay;
    return `<div class="day-card${isToday?' today-card':''}">
      <div class="day-head">
        <h4>${d}</h4>
        ${isToday?'<span class="today-label">HOJE</span>':''}
      </div>
      <div class="day-body">
        ${evts.length ? evts.map(e =>
          `<div class="evt${e.status==='Concluído'?' done':''}">
            <div class="etitle">${esc(e.evento)}</div>
            ${e.ref?'<div class="etime">🕐 '+esc(e.ref)+'</div>':''}
            ${e.acao?'<div class="eacao">↳ '+esc(e.acao)+'</div>':''}
            <div class="emy">
              <label style="font-size:10px;color:var(--muted2);white-space:nowrap">Minha hora:</label>
              <input type="datetime-local" data-action="event-meu-change" data-id="${e.id}" value="${esc(e.meu)}">
            </div>
            <div style="margin-top:7px;display:flex;gap:6px;align-items:center">
              ${statusSelect(e.status,'event-status-change',e.id)}
              ${e.meu?'<button class="icon-btn cal" style="margin-left:auto" data-action="cal-event" data-id="'+e.id+'" title="Google Agenda">📅</button>':''}
            </div>
          </div>`
        ).join('') : '<div class="empty-state" style="padding:16px 10px;font-size:11px">Dia livre.</div>'}
      </div>
    </div>`;
  }).join('');
}

function setEvent(id, f, v){
  const e = state.events.find(x=>x.id===id);
  if(e){
    e[f] = v; save();
    if(f==='status'){ renderEvents(); renderHome(); }
    if(f==='meu' && v && GoogleAPI.isConnected()) syncEventToCalendar(id);
  }
}

async function syncEventToCalendar(id){
  const e = state.events.find(x=>x.id===id);
  if(!e||!e.meu){ toast('Defina sua data/horário.'); return; }
  try{
    toast('Sincronizando...');
    await GoogleAPI.createCalendarEvent({
      title: e.evento,
      description: `Referência: ${e.ref}\nAção: ${e.acao}`,
      startDateTime: e.meu
    });
    toast('Evento salvo no Google Agenda! 📅');
  }catch(err){ toast('Erro no Calendar: '+err.message); }
}

/* ================= ROUTINE ================= */
function renderRoutine(){
  const groups = [["Diária","🔵 Rotina diária"],["Semanal — domingo","📅 Planejamento de domingo"],["Semanal — radar","📡 Radar de vagas"]];
  const container = document.getElementById('routine');
  if(!container) return;
  container.innerHTML = groups.map(([g, tit]) => {
    const items = state.routine.filter(r=>r.freq===g);
    const done = items.filter(r=>r.done).length;
    const pct = items.length ? done/items.length*100 : 0;
    return `<div class="rgroup">
      <h3>${tit}
        <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">${done}/${items.length}</span>
        <div class="progress-bar" style="flex:1;max-width:120px"><div style="width:${pct}%"></div></div>
      </h3>
      <div class="rlist">
        ${items.map(r =>
          `<label class="ritem${r.done?' done':''}">
            <input type="checkbox" data-action="toggle-routine" data-id="${r.id}" ${r.done?'checked':''}>
            <span class="rcheck">✔</span>
            <span>
              <div class="rtitle">${esc(r.atividade)} <span class="rfreq">· ${esc(r.quando)}</span></div>
              <div class="rdesc">${esc(r.oque)}</div>
              <div class="rmeta">${prioBadge(r.prioridade)}</div>
            </span>
          </label>`
        ).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleRoutine(id){
  const r = state.routine.find(x=>x.id===id);
  if(r){ r.done=!r.done; save(); renderRoutine(); renderHome(); }
}

function resetWeek(){
  if(confirm('Desmarcar todos os itens da rotina?')){
    state.routine.forEach(r=>r.done=false);
    save(); renderRoutine(); renderHome();
    toast('Semana reiniciada 🚀');
  }
}

/* ================= MODAL & EXPORT/IMPORT ================= */
function closeModal(){ document.getElementById('overlay').classList.remove('open'); }
function closeGoogleModal(){ document.getElementById('googleModal').classList.remove('open'); }

function openGoogleModal(){
  document.getElementById('inputSheetId').value = GoogleAPI.webAppUrl || '';
  updateGoogleStatusBadge();
  document.getElementById('googleModal').classList.add('open');
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hod-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  toast('Backup exportado ⬇');
}

function importJSON(ev){
  const f = ev.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const d = JSON.parse(rd.result);
      if(!d.tasks||!d.events||!d.routine||!d.projects) throw 0;
      state = d; save(); renderAll();
      toast('Dados importados ✔');
    }catch(e){ toast('Arquivo inválido.'); }
  };
  rd.readAsText(f);
  ev.target.value = '';
}

function resetAll(){
  if(confirm('Restaurar os dados originais? Suas alterações serão perdidas.')){
    localStorage.removeItem(KEY); state = loadInitialState(); save(); renderAll();
    toast('Dados restaurados ↺');
  }
}

function updateGoogleStatusBadge(){
  const dot = document.getElementById('googleDot');
  const txt = document.getElementById('googleStatusText');
  const statusSpan = document.getElementById('modalGoogleEmail');
  const badgeModal = document.getElementById('badgeModalStatus');
  const btn = document.getElementById('btnGoogleStatus');

  if(GoogleAPI.isConnected()){
    if(dot){ dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 6px var(--green)'; }
    if(txt) txt.textContent = 'Conectada ✔';
    if(btn) btn.style.borderColor = 'rgba(126,200,164,.4)';
    if(statusSpan) statusSpan.textContent = 'Conectado via Apps Script';
    if(badgeModal){
      badgeModal.textContent = 'Ativo ✔';
      badgeModal.style.background = 'rgba(126,200,164,.15)';
      badgeModal.style.color = 'var(--green)';
    }
  } else {
    if(dot){ dot.style.background = 'var(--muted2)'; dot.style.boxShadow = 'none'; }
    if(txt) txt.textContent = 'Planilha';
    if(btn) btn.style.borderColor = '';
    if(statusSpan) statusSpan.textContent = 'Cole o link abaixo';
    if(badgeModal){
      badgeModal.textContent = 'Pendente';
      badgeModal.style.background = 'rgba(255,255,255,.05)';
      badgeModal.style.color = 'var(--muted)';
    }
  }
}

async function saveGoogleSettings(){
  const val = document.getElementById('inputSheetId').value.trim();
  if(!val){ toast('Cole a URL do Apps Script primeiro.'); return; }
  await GoogleAPI.setUrl(val);
  updateGoogleStatusBadge(); closeGoogleModal();
  toast('Link salvo! ✔');
  autoSyncToSheets();
}

async function syncWithSheets(){
  if(!GoogleAPI.isConnected()){ openGoogleModal(); return; }
  try{
    toast('Sincronizando...');
    await GoogleAPI.exportToGoogleSheets(state);
    toast('Planilha atualizada! ✔');
  }catch(e){ toast('Erro: '+e.message); }
}

async function pullFromSheets(){
  if(!GoogleAPI.isConnected()){ toast('Configure o Apps Script.'); return; }
  try{
    toast('Carregando da planilha...');
    const data = await GoogleAPI.importFromGoogleSheets();
    if(data.tasks.length||data.projects.length){
      state=data; save(); renderAll();
      toast('Dados importados da planilha ✔');
    } else { toast('Nenhum dado encontrado.'); }
  }catch(e){ toast('Erro: '+e.message); }
}

/* ================= GEMINI ================= */
let attachedGeminiImage = null;

function openGeminiDrawer(){
  document.getElementById('geminiDrawer')?.classList.add('open');
  if(typeof GeminiAPI !== 'undefined' && GeminiAPI.apiKey){
    const inp = document.getElementById('inputGeminiKey');
    if(inp) inp.value = GeminiAPI.apiKey;
  }
  const sel = document.getElementById('selectGeminiModel');
  if(sel && typeof GeminiAPI !== 'undefined' && GeminiAPI.model) sel.value = GeminiAPI.model;
}

function closeGeminiDrawer(){
  document.getElementById('geminiDrawer')?.classList.remove('open');
}

function setAttachedImage(file, base64Url){
  const parts = base64Url.split(',');
  const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  attachedGeminiImage = { mimeType, base64: parts[1], name: file.name||'Captura' };
  const preview = document.getElementById('geminiImgPreview');
  const thumb = document.getElementById('geminiImgThumb');
  const nameSpan = document.getElementById('geminiImgName');
  if(preview&&thumb){ thumb.src=base64Url; if(nameSpan) nameSpan.textContent=attachedGeminiImage.name; preview.classList.add('show'); }
}

function clearAttachedImage(){
  attachedGeminiImage = null;
  const preview = document.getElementById('geminiImgPreview');
  const thumb = document.getElementById('geminiImgThumb');
  if(preview) preview.classList.remove('show');
  if(thumb) thumb.src='';
  const fileInp = document.getElementById('geminiFileInput');
  if(fileInp) fileInp.value='';
}

function appendGeminiMessage(text, role, imgSrc=null, isAdded=false){
  const container = document.getElementById('geminiMessages');
  if(!container) return null;
  const div = document.createElement('div');
  div.className = `g-msg ${role}`+(isAdded?' added':'');
  let html = '';
  if(imgSrc) html += `<img src="${imgSrc}" class="thumb" alt="Anexo">`;
  html += `<div>${esc(text).replace(/\n/g,'<br>')}</div>`;
  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function handleSendGemini(){
  const input = document.getElementById('geminiInput');
  const prompt = input?.value.trim() || '';
  if(!prompt && !attachedGeminiImage){ toast('Digite ou cole um print.'); return; }

  if(typeof GeminiAPI === 'undefined' || !GeminiAPI.hasKey()){
    openGeminiDrawer();
    toast('Informe sua chave de API do Gemini.');
    document.getElementById('inputGeminiKey')?.focus();
    return;
  }

  const currentImg = attachedGeminiImage;
  const imgSrc = currentImg ? `data:${currentImg.mimeType};base64,${currentImg.base64}` : null;
  appendGeminiMessage(prompt||(imgSrc?'(Análise de print)':''), 'user', imgSrc);
  if(input) input.value='';
  clearAttachedImage();

  const loadingMsg = appendGeminiMessage('✨ Analisando com '+GeminiAPI.model+'...', 'gemini');

  try{
    const res = await GeminiAPI.processInput(prompt, currentImg, state);
    loadingMsg?.remove();
    if(res.action==='add_task'&&res.data){
      const t = {id:uid(), empresa:res.data.empresa||'Geral', acao:res.data.acao||prompt, status:res.data.status||'A fazer', prioridade:res.data.prioridade||'Importante', quando:res.data.quando||''};
      state.tasks.push(t); save(); renderTasks(); renderHome();
      if(t.quando && GoogleAPI.isConnected()) syncTaskToCalendar(t.id);
      appendGeminiMessage(res.message||`Tarefa "${t.acao}" adicionada!`, 'gemini', null, true);
      toast('Nova tarefa adicionada pelo Gemini ✨');
    } else if(res.action==='add_project'&&res.data){
      const p = {id:uid(), empresa:res.data.empresa||'Geral', projeto:res.data.projeto||'Projeto', etapa:res.data.etapa||'Candidatura', acao:res.data.acao||'Acompanhar', prioridade:res.data.prioridade||'Importante', prazo:res.data.prazo||'', quando:res.data.quando||'', historico:'Criado via Gemini em '+new Date().toLocaleDateString('pt-BR'), obs:res.data.obs||''};
      state.projects.push(p); save(); renderKanban(); renderHome();
      appendGeminiMessage(res.message||`Projeto "${p.projeto}" adicionado!`, 'gemini', null, true);
      toast('Projeto adicionado pelo Gemini ✨');
    } else if(res.action==='add_event'&&res.data){
      const ev = {id:uid(), dia:res.data.dia||'Extras', evento:res.data.evento||'Evento', ref:res.data.ref||'', meu:res.data.meu||'', status:'A fazer', acao:res.data.acao||''};
      state.events.push(ev); save(); renderEvents();
      appendGeminiMessage(res.message||`Evento "${ev.evento}" adicionado!`, 'gemini', null, true);
      toast('Evento adicionado pelo Gemini ✨');
    } else {
      appendGeminiMessage(res.message||'Processado.', 'gemini');
    }
  }catch(err){
    loadingMsg?.remove();
    appendGeminiMessage(`❌ Erro: ${err.message}`, 'gemini');
    toast('Erro no Gemini: '+err.message);
  }
}

/* ================= EVENT LISTENERS ================= */
function setupEventListeners(){
  // Dock navigation
  document.getElementById('controlDock')?.addEventListener('click', e => {
    const btn = e.target.closest('.dock-btn[data-nav]');
    if(btn) switchView(btn.dataset.nav);
  });
  document.getElementById('dockGemini')?.addEventListener('click', openGeminiDrawer);
  document.getElementById('dockConfig')?.addEventListener('click', openGoogleModal);

  // Tiles na home
  document.querySelectorAll('.workspace-tile[data-nav]').forEach(tile => {
    tile.addEventListener('click', () => switchView(tile.dataset.nav));
  });
  document.getElementById('tileGemini')?.addEventListener('click', openGeminiDrawer);

  // Botões da masthead/header
  document.getElementById('btnSyncSheets')?.addEventListener('click', syncWithSheets);
  document.getElementById('btnGoogleStatus')?.addEventListener('click', openGoogleModal);
  document.getElementById('btnDiarioHoje')?.addEventListener('click', () => switchView('routine'));
  document.getElementById('wordmark')?.addEventListener('click', () => switchView('home'));

  // Botões home orientation
  document.getElementById('btnNewTaskHome')?.addEventListener('click', () => openTaskModal());
  document.getElementById('btnNewProjHome')?.addEventListener('click', () => openProjModal());

  // Botões tasks view
  document.getElementById('btnNewTaskTasks')?.addEventListener('click', () => openTaskModal());
  document.getElementById('btnDeleteSelectedTasks')?.addEventListener('click', deleteSelectedTasks);
  document.getElementById('checkAllTasks')?.addEventListener('change', e => {
    document.querySelectorAll('.task-check').forEach(cb => { cb.checked = e.target.checked; });
    updateBatchDeleteUI();
  });

  // Filtros tasks
  document.getElementById('fSearch')?.addEventListener('input', renderTasks);
  document.getElementById('fStatus')?.addEventListener('change', renderTasks);
  document.getElementById('fPrio')?.addEventListener('change', renderTasks);
  document.getElementById('fGroup')?.addEventListener('change', renderTasks);
  document.getElementById('fHideDone')?.addEventListener('change', renderTasks);

  // Botão kanban
  document.getElementById('btnNewProjKanban')?.addEventListener('click', () => openProjModal());

  // Rotina
  document.getElementById('btnResetWeek')?.addEventListener('click', resetWeek);

  // Modal
  document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
  document.getElementById('btnCancelModal')?.addEventListener('click', closeModal);
  document.getElementById('mSave')?.addEventListener('click', () => {
    if(currentModalType==='task') saveTask();
    else if(currentModalType==='proj') saveProj();
  });
  document.getElementById('overlay')?.addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });

  // Google Modal
  document.getElementById('btnCloseGoogleModal')?.addEventListener('click', closeGoogleModal);
  document.getElementById('btnCancelGoogleModal')?.addEventListener('click', closeGoogleModal);
  document.getElementById('btnSaveGoogleSettings')?.addEventListener('click', saveGoogleSettings);
  document.getElementById('btnPullSheets')?.addEventListener('click', pullFromSheets);
  document.getElementById('btnPushSheets')?.addEventListener('click', syncWithSheets);
  document.getElementById('btnExportJSON')?.addEventListener('click', exportJSON);
  document.getElementById('btnImportTrigger')?.addEventListener('click', () => document.getElementById('importFile')?.click());
  document.getElementById('importFile')?.addEventListener('change', importJSON);
  document.getElementById('btnResetAll')?.addEventListener('click', resetAll);
  document.getElementById('googleModal')?.addEventListener('click', e => { if(e.target===e.currentTarget) closeGoogleModal(); });

  // Gemini
  document.getElementById('btnCloseGemini')?.addEventListener('click', closeGeminiDrawer);
  document.getElementById('btnSendGemini')?.addEventListener('click', handleSendGemini);
  document.getElementById('btnRemoveGeminiImg')?.addEventListener('click', clearAttachedImage);
  document.getElementById('btnSaveGeminiKey')?.addEventListener('click', async () => {
    const key = document.getElementById('inputGeminiKey')?.value.trim();
    if(key && typeof GeminiAPI !== 'undefined'){ await GeminiAPI.setKey(key); toast('Chave salva ✔'); }
  });
  document.getElementById('selectGeminiModel')?.addEventListener('change', async e => {
    if(typeof GeminiAPI !== 'undefined'){ await GeminiAPI.setModel(e.target.value); toast('Modelo: '+e.target.value); }
  });
  document.getElementById('geminiInput')?.addEventListener('keydown', e => {
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSendGemini(); }
  });
  document.getElementById('geminiInput')?.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if(!items) return;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file = items[i].getAsFile();
        if(file){
          const reader = new FileReader();
          reader.onload = ev => { setAttachedImage(file, ev.target.result); toast('Print colado! 📷'); };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  });
  document.getElementById('geminiFileInput')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if(file){
      const reader = new FileReader();
      reader.onload = ev => { setAttachedImage(file, ev.target.result); toast('Imagem carregada! 📷'); };
      reader.readAsDataURL(file);
    }
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if(e.key==='Escape'){ closeModal(); closeGoogleModal(); closeGeminiDrawer(); }
  });

  // Delegação de cliques dinâmicos
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if(action==='task-quick-status') taskStatus(id, btn.dataset.status);
    else if(action==='task-toggle-done'){
      const t = state.tasks.find(x=>x.id===id);
      if(t){ t.status = t.status==='Concluído'?'A fazer':'Concluído'; save(); renderTasks(); renderHome(); toast('Status: '+t.status); }
    }
    else if(action==='cal-task') syncTaskToCalendar(id);
    else if(action==='edit-task') openTaskModal(id);
    else if(action==='del-task') delTask(id);
    else if(action==='add-proj-etapa') openProjModal(null, btn.dataset.etapa);
    else if(action==='edit-proj') openProjModal(id);
    else if(action==='cal-proj') syncProjectToCalendar(id);
    else if(action==='cal-event') syncEventToCalendar(id);
    else if(action==='modal-del-task'){ delTask(editingTask); closeModal(); }
    else if(action==='modal-del-proj'){ delProj(editingProj); closeModal(); }
    else if(action==='go-task'){ switchView('tasks'); }
  });

  // Delegação de mudanças dinâmicas
  document.addEventListener('change', e => {
    const el = e.target;
    if(el.classList.contains('task-check')){ updateBatchDeleteUI(); return; }
    const action = el.dataset.action;
    const id = el.dataset.id;
    if(!action) return;
    if(action==='task-status-change') taskStatus(id, el.value);
    else if(action==='event-status-change') setEvent(id,'status',el.value);
    else if(action==='event-meu-change') setEvent(id,'meu',el.value);
    else if(action==='toggle-routine') toggleRoutine(id);
  });
}

/* ================= INIT ================= */
function renderAll(){
  renderHome();
  renderTasks();
  renderKanban();
  renderEvents();
  renderRoutine();
}

initHeader();
setupEventListeners();

GoogleAPI.init().then(() => {
  updateGoogleStatusBadge();
});

if(typeof GeminiAPI !== 'undefined') GeminiAPI.init();

renderAll();
