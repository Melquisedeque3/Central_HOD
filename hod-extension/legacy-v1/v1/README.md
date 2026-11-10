# 🚀 HOD Controle — Extensão para Google Chrome

> **Painel de Controle e Acompanhamento de Candidaturas, Projetos e Rotinas do Home Office Digital (HOD)**  
> Totalmente integrado ao **Google Planilhas**, **Google Agenda** e com **Assistente Gemini Multimodal com IA**.  
> Interface redesenhada no estilo **EasyMachineAI HQ** — dark teal, dock inferior, tiles de workspace, relógio masthead.

---

## 📌 1. Visão Geral e Evolução do Projeto

O projeto começou a partir de um arquivo HTML local estático (`hod-controle (1).html`) e de uma planilha base (`Controle_Simples_HOD--(1).xlsx`), utilizados para organizar rotinas, testes e candidaturas em plataformas de trabalho remoto (Welocalize, CrowdGen, Outlier, OneForma, Alignerr, etc.).

Ao longo do desenvolvimento, a aplicação foi transformada em uma **Extensão do Google Chrome de ponta a ponta (Manifest V3)**, com:
1. **Zero necessidade de servidor dedicado:** roda direto no navegador com armazenamento em cache local e na nuvem.
2. **Integração bidirecional com o Google Planilhas:** leitura e salvamento automático sem burocracias de APIs complexas.
3. **Sincronização com o Google Agenda:** tarefas e eventos com data/hora vão direto para o seu calendário no celular.
4. **Assistente de Inteligência Artificial Gemini (Multimodal):** você pode digitar ou simplesmente dar `Ctrl+V` em um print de um e-mail ou aviso de teste e o Gemini cadastra tudo no lugar certo para você.
5. **Interface HQ (v2):** redesign completo da UI para o estilo EasyMachineAI HQ — dark teal, fonte Rubik, dock inferior flutuante, tiles de workspace em carrossel, faixa de calendário e relógio masthead.

---

## 📁 2. Estrutura de Arquivos da Extensão

A extensão está localizada na pasta `/Volumes/Sem Título 3/Home_Office/Dash/hod-extension/`:

```
hod-extension/
├── manifest.json       # Manifesto oficial da extensão (Manifest V3, permissões e hosts)
├── background.js       # Service Worker para abrir e focar o painel em aba inteira
├── index.html          # Estrutura visual HQ: masthead, faixa de calendário, tiles, dock, views, modais
├── style.css           # Design system HQ completo: tokens de cor, Rubik, dock, tiles, kanban, etc.
├── app.js              # Lógica da aplicação: relógio, navegação por dock, tiles, renderização de todas as views
├── google-api.js       # Módulo de sincronização com o Google Apps Script e Google Agenda
├── gemini-api.js       # Módulo multimodal de IA com Google Gemini (Texto + Imagens/Prints)
├── icons/              # Ícones oficiais da extensão
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # Esta documentação completa
```

---

## 🎨 3. Design System HQ (EasyMachineAI-inspired)

A interface v2 foi construída com base no design system extraído diretamente do site [hq.easymachineai.com](https://hq.easymachineai.com).

### Paleta de Cores (tokens CSS)

```css
:root {
  --ink:        #f4f5f1;               /* texto principal */
  --muted:      #c4d5d8;               /* texto secundário */
  --line:       rgba(230,244,245,.24); /* bordas sutis */
  --surface:    #20393f;               /* superfície de cartão */
  --accent:     #f1bc90;               /* pêssego/laranja — cor de ação primária */
  --deep:       #162a30;               /* fundo mais escuro */
  --bg-mid:     #1d373e;               /* fundo intermediário */
  --bg-card:    #203b43;               /* fundo de cartão */
}
```

### Tipografia
- **Fonte principal:** [Rubik](https://fonts.google.com/specimen/Rubik) (pesos 300, 400, 500, 600) — carregada via Google Fonts.
- Relógio masthead: `80px`, `font-weight: 300`, `letter-spacing: -0.035em`.
- Requer conexão à internet para carregar a fonte. Offline exibe fallback sans-serif.

### Layout e Navegação

| Componente | Descrição |
| :--- | :--- |
| **Masthead** | Topo fixo com relógio ao vivo (hora:minuto), data longa e estado de sincronização |
| **Calendar Strip** | Faixa de 7 dias com pílulas de dia da semana; dia atual destacado em accent |
| **Workspace Tiles** | 5 tiles em grade 2×3 para navegação entre seções; badges de contagem dinâmicos |
| **Orientation Strip** | Bloco abaixo dos tiles com tarefa em foco, itens em andamento e próximo item de rotina |
| **Control Dock** | Barra fixa no fundo com backdrop-filter blur, border-radius 20px; 5 botões de seção |
| **Destination Views** | Cada seção (Tarefas, Kanban, Eventos, Rotina, Gemini) substitui os tiles ao navegar |

### Arquitetura de Navegação (v1 → v2)

| | v1 (antigo) | v2 (HQ) |
| :--- | :--- | :--- |
| **Ponto de entrada** | Tabs no topo | Home com tiles em carrossel |
| **Navegação** | `switchView()` alternava `.tab.active` | `switchView()` alterna `.destination-view.active` + `.dock-btn.active` |
| **Views** | `dashboard`, `tasks`, `kanban`, `events`, `routine` | `view-home`, `view-tasks`, `view-kanban`, `view-events`, `view-routine` |
| **Gemini** | Gaveta lateral com botão no topo | View dedicada `view-gemini` acessível pelo dock |

---

## ⚡ 4. Funcionalidades Detalhadas

### 🏠 Home (Painel Principal HQ)
* **Relógio ao vivo:** atualizado a cada segundo, formato HH:MM.
* **Faixa de calendário:** 7 dias rolando; dia atual com destaque em accent pêssego.
* **Tiles de workspace:** 5 cards com ícone, nome e badge de contagem (ex.: "3 tarefas", "2 projetos").
* **Orientation strip:** exibe a tarefa em foco (primeira com status "A fazer"), lista de itens em andamento e o próximo item de rotina diária.

### ✔ Tarefas (Meu Controle)
* **Datas reais (`datetime-local`):** permite definir dia e hora exatos para compromissos.
* **Caixas de seleção e Exclusão em Lote:** checkbox individual, checkbox global ("selecionar todas"), botão "🗑 Excluir selecionadas (X)".
* **Filtros avançados:** busca textual, filtros por status/prioridade/empresa, interruptor "☑ Ocultar concluídas".
* **Exclusão Definitiva:** diferencia concluir (tacha para histórico) de apagar (remove da extensão e da planilha).

### ▦ Projetos / Kanban
* **7 colunas de fluxo:** *Candidatura*, *Teste / qualificação*, *Aguardando resposta*, *Aprovado / onboarding*, *Ativo*, *Pausado / sem tarefas* e *Encerrado*.
* **Drag and Drop:** arraste de cartões entre colunas com histórico automático de data e etapa.
* **Prazos:** campo `date` para vencimento da etapa e campo `datetime-local` para conferência.

### 🗓 Eventos da Semana
* Grade de Segunda a Sábado + Extras.
* Identificador automático do dia atual (**HOJE**).
* Botão **📅** para enviar o evento diretamente para o Google Agenda.

### 🔁 Rotina & Radar
* Checklist interativo diário e semanal (Rotina diária, Planejamento de domingo e Radar de vagas).
* Barras de progresso dinâmicas e botão para reiniciar a semana com um clique.

### ✨ Assistente Gemini Multimodal (IA Integrada)
* **View dedicada no dock:** acessada pelo botão ✨ no dock inferior.
* **Suporte a Prints (`Ctrl+V`):** basta copiar a imagem de um teste ou e-mail e colar no chat.
* **Análise Multimodal e Ação Automática:** identifica empresa, ação, prioridade e data/hora; cadastra no local certo; dispara auto-sync.
* **Seletor de Modelos:**
  * `gemini-2.5-flash`: ultrarrápido e multimodal (padrão recomendado).
  * `gemini-2.5-pro`: máxima capacidade de raciocínio para textos longos ou testes complexos.
  * `gemini-2.5-flash-lite`: opção leve de alta velocidade.

---

## 🛠 5. Como Instalar a Extensão no Google Chrome

1. Abra o navegador Google Chrome e acesse: `chrome://extensions/`
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (*Developer mode*).
3. No canto superior esquerdo, clique em **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta da extensão:
   ```text
   /Volumes/Sem Título 3/Home_Office/Dash/hod-extension
   ```
5. O ícone verde **HOD** aparecerá na sua barra de extensões. Clique nele para abrir o painel em aba inteira a qualquer momento.

> **Dica:** Após qualquer alteração nos arquivos `.js`, `.html` ou `.css`, clique no botão 🔄 de "Recarregar" na página `chrome://extensions/` para aplicar as mudanças.

---

## ☁ 6. Configuração da Planilha Google e Agenda (Google Apps Script)

A sincronização é realizada através de um **Web App do Google Apps Script**, o que elimina a necessidade de criar projetos no Google Cloud Console ou configurar credenciais OAuth complexas.

### Passo a Passo:
1. Abra sua planilha no Google Drive.
   * *Atenção:* Certifique-se de que a planilha foi salva no formato nativo (**Arquivo > Salvar como Planilhas Google**), sem o selo verde `.XLSX`.
2. No menu superior da planilha, clique em **Extensões > Apps Script**.
3. Apague qualquer código existente e cole o script abaixo:

```javascript
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  function getRows(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    values.shift(); // Remove cabeçalho
    return values;
  }

  const tasks = getRows("Meu controle").map((r, i) => ({
    id: "t_" + i,
    empresa: String(r[0] || ""),
    acao: String(r[1] || ""),
    status: String(r[2] || "A fazer"),
    prioridade: String(r[3] || "Importante"),
    quando: r[4] ? (r[4] instanceof Date ? Utilities.formatDate(r[4], "GMT-3", "yyyy-MM-dd'T'HH:mm") : String(r[4])) : ""
  })).filter(t => t.empresa || t.acao);

  const projects = getRows("Meus projetos").map((r, i) => ({
    id: "p_" + i,
    empresa: String(r[0] || ""),
    projeto: String(r[1] || ""),
    etapa: String(r[2] || "Candidatura"),
    acao: String(r[3] || ""),
    prioridade: String(r[4] || "Importante"),
    prazo: r[5] ? (r[5] instanceof Date ? Utilities.formatDate(r[5], "GMT-3", "yyyy-MM-dd") : String(r[5])) : "",
    quando: r[6] ? (r[6] instanceof Date ? Utilities.formatDate(r[6], "GMT-3", "yyyy-MM-dd'T'HH:mm") : String(r[6])) : "",
    historico: String(r[7] || ""),
    obs: String(r[8] || "")
  })).filter(p => p.empresa || p.projeto);

  const events = getRows("Eventos da semana").map((r, i) => ({
    id: "e_" + i,
    dia: String(r[0] || ""),
    evento: String(r[1] || ""),
    ref: String(r[2] || ""),
    meu: r[3] ? (r[3] instanceof Date ? Utilities.formatDate(r[3], "GMT-3", "yyyy-MM-dd'T'HH:mm") : String(r[3])) : "",
    status: String(r[4] || "A fazer"),
    acao: String(r[5] || "")
  })).filter(e => e.evento && e.evento !== "—");

  const routine = getRows("Rotina e radar").map((r, i) => ({
    id: "r_" + i,
    freq: String(r[0] || "Diária"),
    atividade: String(r[1] || ""),
    oque: String(r[2] || ""),
    done: String(r[3] || "").toLowerCase() === "concluído",
    prioridade: String(r[4] || "Importante"),
    quando: String(r[5] || "")
  })).filter(r => r.atividade);

  return ContentService.createTextOutput(JSON.stringify({ tasks, projects, events, routine }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Sincronizar com Google Agenda
    if (data.action === "calendar_event") {
      const cal = CalendarApp.getDefaultCalendar();
      const start = new Date(data.startDateTime);
      const end = data.endDateTime ? new Date(data.endDateTime) : new Date(start.getTime() + 60 * 60 * 1000);
      cal.createEvent(data.title, start, end, { description: data.description || "" });
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Salvar todas as abas na Planilha
    if (data.action === "save_all") {
      function writeRows(name, rows) {
        const sheet = ss.getSheetByName(name);
        if (!sheet) return;
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
        }
        if (rows.length > 0) {
          sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        }
      }

      writeRows("Meu controle", (data.tasks || []).map(t => [t.empresa, t.acao, t.status, t.prioridade, t.quando]));
      writeRows("Meus projetos", (data.projects || []).map(p => [p.empresa, p.projeto, p.etapa, p.acao, p.prioridade, p.prazo, p.quando, p.historico, p.obs]));
      writeRows("Eventos da semana", (data.events || []).map(ev => [ev.dia, ev.evento, ev.ref, ev.meu, ev.status, ev.acao]));
      writeRows("Rotina e radar", (data.routine || []).map(r => [r.freq, r.atividade, r.oque, r.done ? "Concluído" : "A fazer", r.prioridade, r.quando]));

      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Clique no botão azul **Implantar > Nova implantação**:
   * Tipo: **Aplicativo da Web**.
   * Executar como: **Eu (seu e-mail)**.
   * Quem tem acesso: **Qualquer pessoa**.
5. Copie a **URL do aplicativo da Web** (que termina em `/exec`).
6. No painel da extensão, clique no botão **"⚙ Config"** no dock, cole a URL e clique em **"Salvar Link"**.
7. Pronto! A extensão já tem **Auto-Sync** ativo (salva automaticamente após 1,5 segundos de qualquer alteração).

---

## 🔑 7. Configuração do Assistente Gemini (IA)

1. Obtenha sua chave de API gratuita do Google em: [Google AI Studio - Obter API Key](https://aistudio.google.com/app/apikey).
2. Abra a extensão e clique no botão **✨** (Gemini) no dock inferior.
3. Cole sua chave no campo **Chave de API do Gemini** e clique em **Salvar**.
4. Agora basta enviar comandos por texto ou colar prints (`Ctrl+V`) na área de digitação.

---

## 🗂 8. Armazenamento de Dados

Todos os dados são salvos em `localStorage` sob a chave `hodControleV2` como um único objeto JSON com as propriedades:

```json
{
  "tasks":    [...],   // Tarefas (Meu Controle)
  "projects": [...],   // Projetos (Kanban)
  "events":   [...],   // Eventos da Semana
  "routine":  [...],   // Rotina & Radar
  "config":   { "scriptUrl": "...", "geminiKey": "..." }
}
```

A sincronia bidirecional com o Google Planilhas ocorre via `google-api.js` (módulo `GoogleAPI`).

---

## 🛡 9. Histórico de Problemas Encontrados e Soluções Aplicadas

Durante o desenvolvimento da extensão, os seguintes desafios técnicos foram identificados e solucionados:

| Desafio Encontrado | Causa Raiz | Solução Aplicada |
| :--- | :--- | :--- |
| **Cliques não funcionavam / Erro de CSP** | A política de segurança de extensões (Manifest V3 CSP) bloqueia qualquer evento embutido (`onclick`, `onchange`). | Remoção de todos os manipuladores inline de `index.html` e `app.js`, substituindo por escutadores limpos (`addEventListener`) e delegação via `data-action`. |
| **Erro `bad client id: {0}` no login Google** | Tentativa de usar login OAuth2 sem que o usuário tivesse criado o Client ID no Google Cloud Console. | Migração para o modelo **Google Apps Script Web App**, que dispensa OAuth2 e funciona com autorização direta por link seguro. |
| **Menu "Extensões" sumido na Planilha** | A planilha estava em modo de compatibilidade com Excel (`.XLSX`), que bloqueia o Apps Script no Google Drive. | Conversão do arquivo via menu *Arquivo > Salvar como Planilhas Google*. |
| **Erro de CORS (`No 'Access-Control-Allow-Origin'`)** | O Chrome bloqueava requisições `fetch` para o domínio do Google Apps Script originadas da extensão. | Inclusão de `host_permissions` no `manifest.json` para `https://script.google.com/*` e `https://script.googleusercontent.com/*`. |
| **Registros permaneciam riscados/apagados** | Confusão entre o status "Concluído" (que apenas tacha o item para histórico) e a exclusão real. | Criação de caixas de seleção, botão de **Exclusão Definitiva em Massa** e filtro opcional **"Ocultar concluídas"**. |
| **Imagens temáticas do HQ retornavam 404** | As imagens `hero.webp` do site hq.easymachineai.com não são públicas (exigem login na comunidade Skool). | Substituição por gradientes CSS por tile, mantendo fidelidade visual sem dependência externa. |
| **Fonte Rubik não carrega** | Google Fonts requer conexão à internet; extensão sem rede exibe fallback. | Comportamento esperado — offline exibe `sans-serif` sem quebrar o layout. |

---

## 🗺 10. Roadmap / Próximas Fases

### ✅ Fase 1 — Interface HQ + Funcionalidades Originais (CONCLUÍDO)
- [x] Redesign visual completo no estilo EasyMachineAI HQ
- [x] Masthead com relógio ao vivo
- [x] Faixa de calendário de 7 dias
- [x] Tiles de workspace com badges dinâmicos
- [x] Control Dock fixo no fundo
- [x] Todas as views: Tarefas, Kanban, Eventos, Rotina, Gemini
- [x] Integração Google Planilhas via Apps Script
- [x] Integração Google Agenda
- [x] Assistente Gemini Multimodal

### 🔜 Fase 2 — Integração com Obsidian (PLANEJADO)
- [ ] Conexão com vault do Obsidian via plugin Local REST API ou MCP
- [ ] Sincronização bidirecional: tarefas HOD ↔ notas Obsidian
- [ ] Estrutura de vault sugerida: `tasks.md`, `projects/`, `events/`, `routine.md`
- [ ] Suporte a Dataview para visualizações avançadas no Obsidian

---

*Documentação atualizada em: Novembro/2026 — Versão 2.0 (HQ Redesign)*
