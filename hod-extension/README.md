# HOD — Central de Home Office (v4.0)

**HOD (Home Office Dashboard)** é uma estação de trabalho local para gestão completa de trabalho remoto: pipeline de candidaturas, tarefas, rotina diária otimizada, estudo de *guidelines* de qualificação e triagem de e-mails.

O sistema opera sobre uma arquitetura de **três pilares acoplados localmente**:

1. **Frontend Web (`http://127.0.0.1:8420`)** — Interface editorial rápida em HTML/CSS/ES Modules puros, servida por um servidor Node.js zero-dependências (`server.mjs`).
2. **Obsidian (Fonte de Verdade / Dono dos Dados)** — Todo registro do sistema é uma nota Markdown real (`.md`) com YAML frontmatter dentro do seu vault do Obsidian. O índice `.hod/index.json` é estritamente derivado e reconstruível a qualquer momento.
3. **Hermes Agent (Cérebro Operacional)** — O agente autônomo lê o estado do vault, responde via chat em streaming SSE, executa ações operacionais (briefing diário, priorização, análise de funil, preparação de etapas, tradução/explicação de *guidelines* e triagem de e-mails) e realiza CRUD completo no sistema.

> **Requisitos:** Node.js `>= 20` · Sem dependências `npm` · Sem etapa de build.

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Funcionalidades do Sistema](#2-funcionalidades-do-sistema)
3. [Estrutura do Repositório](#3-estrutura-do-repositório)
4. [Início Rápido (Humano)](#4-início-rápido-humano)
5. [MANUAL DE AUTOMAÇÃO PARA O HERMES AGENT (Bootstrapping & Integração Total)](#5-manual-de-automação-para-o-hermes-agent-bootstrapping--integração-total)
   - [5.1 Missão do Hermes Agent](#51-missão-do-hermes-agent)
   - [5.2 Passo a Passo de Inicialização e Conexão](#52-passo-a-passo-de-inicialização-e-conexão)
   - [5.3 Configuração de Persistência (`.hod-config.json`)](#53-configuração-de-persistência-hod-configjson)
   - [5.4 Contrato de Dados do Vault (Obsidian)](#54-contrato-de-dados-do-vault-obsidian)
   - [5.5 Referência Completa da API HTTP Local (`127.0.0.1:8420`)](#55-referência-completa-da-api-http-local-1270018420)
   - [5.6 Regras de Concorrência, Escrita Atômica e Tombstones](#56-regras-de-concorrência-escrita-atômica-e-tombstones)
   - [5.7 Skills / Ferramentas que o Hermes Deve Registrar](#57-skills--ferramentas-que-o-hermes-deve-registrar)
   - [5.8 Serviço em Background (LaunchAgent macOS / systemd Linux)](#58-serviço-em-background-launchagent-macos--systemd-linux)
   - [5.9 Checklist de Verificação Pós-Instalação (Smoke Test)](#59-checklist-de-verificação-pós-instalação-smoke-test)
   - [5.10 Armadilhas conhecidas](#510-armadilhas-conhecidas-todas-já-observadas-em-instalação-real)
6. [Voz (STT & TTS Gratuitos)](#6-voz-stt--tts-gratuitos)
7. [Segurança e Privacidade](#7-segurança-e-privacidade)
8. [Solução de Problemas](#8-solução-de-problemas)

---

## 1. Visão Geral da Arquitetura

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Navegador (Frontend UI — http://127.0.0.1:8420)                          │
│ HTML5 + CSS Editorial + ES Modules nativos (js/main.js, store.js, views) │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTP JSON + SSE Streaming
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Servidor Local HOD — server.mjs (Node.js >= 20, zero dependências)       │
│  • API CRUD & Indexador Markdown (lib/vault.mjs + lib/frontmatter.mjs)   │
│  • Proxy autenticado p/ Hermes Agent (/api/hermes/*)                     │
│  • Proxy autenticado p/ Obsidian Local REST API (/api/obsidian/*)        │
└─────────────────┬────────────────────────────────────┬───────────────────┘
                  │ Leitura/Escrita Atômica (fs)       │ OpenAI-compatible API
                  ▼                                    ▼
┌────────────────────────────────────┐   ┌─────────────────────────────────┐
│ Vault do Obsidian (Fonte de Verdade│   │ Hermes Agent (Cérebro)          │
│  ├── Candidaturas/*.md             │   │  • API Server (:8642/v1)        │
│  ├── Tarefas/*.md                  │◀──┤  • Opera o HOD via HTTP API     │
│  ├── Guidelines/*.md               │   │    ou edição Markdown + reindex │
│  ├── Rotina/*.md                   │   │  • Dashboard (:9119 opcional)   │
│  └── .hod/ (index, bag, tombstones)│   └─────────────────────────────────┘
└─────────────────┬──────────────────┘
                  │ (Opcional)
                  ▼
       Obsidian Local REST API (:27123)
```

### Princípio Arquitetural: *"Obsidian dono, índice derivado"*
- **Nenhuma informação primária fica presa em banco fechado ou no `localStorage`.**
- Cada candidatura, tarefa, *guideline* e bloco de rotina é um arquivo `.md` legível e editável diretamente no Obsidian.
- O arquivo `.hod/index.json` é apenas um cache de leitura rápida; se for apagado, o servidor reconstrói tudo varrendo os `.md` do vault.
- Se você editar uma nota no Obsidian, basta acionar **Sincronizar vault** (`POST /api/reindex`) e a interface reflete a mudança imediatamente.

---

## 2. Funcionalidades do Sistema

- **Painel Executivo (`#/home`)**: KPIs em tempo real, foco imediato, bloco ativo da rotina no horário atual, tarefas abertas e candidaturas prioritárias.
- **Console do Hermes Agent (`#/ai`)**:
  - Chat com streaming SSE em tempo real e renderização Markdown segura.
  - **6 Ações Operacionais com Contexto do Vault**:
    1. *Briefing do dia* (`daily-briefing`)
    2. *Priorizar tarefas abertas* (`prioritize-tasks`)
    3. *Analisar funil de candidaturas* (`pipeline-review`)
    4. *Preparar próxima etapa de candidatura* (`prep-next-step`)
    5. *Triar correspondências/e-mails* (`triage-emails`)
    6. *Revisar guidelines de estudo* (`study-plan`)
  - Entrada por voz (microfone via Web Speech API) e leitura em voz alta das respostas (`speechSynthesis`).
- **Candidaturas & Pipeline (`#/apps` e `#/app-detail?id=...`)**:
  - Alternância entre **Lista** e **Kanban** (com *drag-and-drop* entre as etapas: `mapeada`, `aplicada`, `triagem`, `teste`, `entrevista`, `oferta`, `contratada`, `encerrada`).
  - Gestão de etapas internas (*steps*), histórico cronológico, remuneração, plataforma, links, tarefas vinculadas, *guidelines* vinculadas e **editor direto da nota `.md`** no navegador.
- **Tarefas (`#/tasks`)**: CRUD completo com prioridades (`urgente`, `importante`, `normal`, `baixa`), status (`todo`, `doing`, `done`), vínculo com candidaturas, prazos e filtros combinados.
- **Rotina Diária Editável (`#/routine`)**: Blocos de horário gravados como notas no vault (`Rotina/*.md`), cálculo de carga horária planejada, destaque automático do bloco atual e distribuição inteligente das tarefas abertas por prioridade.
- **Métricas e Desempenho (`#/metrics`)**: Gráficos SVG nativos (donut de etapas, barras por prioridade e por empresa, *sparkline* de atividade de 14 dias) e diagnóstico de saúde do vault.
- **Guidelines & Estudo (`#/study`)**:
  - Biblioteca de manuais de qualificação (Telus, Welocalize, RWS, Appen, OneForma etc.) onde o corpo Markdown da nota é 100% autoritativo.
  - Importação local de arquivos `.md`, `.txt`, `.csv`, `.json`, `.docx` (descompactação nativa via `DecompressionStream`) e `.pdf`.
  - Ações integradas ao Hermes para **Traduzir para PT-BR**, **Explicar / Resumir** ou **Gerar Checklist de Prova**.
- **Correspondências / E-mail (`#/email`)**: Importação e armazenamento em `.hod/bag.json`, conversão de e-mail em **Tarefa** ou **Candidatura** com 1 clique e triagem assistida pelo Hermes.
- **Ajustes & Integrações (`#/settings`)**: Configuração ao vivo do Vault, Hermes Agent, Obsidian Local REST API, backup/restauração JSON e diagnóstico de conexões.

---

## 3. Estrutura do Repositório

> **⚠️ A aplicação vive em `hod-extension/`**, não na raiz do repositório. `node server.mjs` só funciona **de dentro dessa pasta**; executado da raiz, o Node falha com `MODULE_NOT_FOUND`.

```text
Central_HOD/
├── hod-extension/             # ← A APLICAÇÃO VIVE AQUI
│   ├── server.mjs             # Servidor HTTP Node.js (porta 8420), rotas REST e proxies
│   ├── package.json           # Scripts: start, dev, seed, smoke (zero dependências)
│   ├── .hod-config.example.json  # Modelo de configuração local (Hermes + Obsidian)
│   ├── .hod-config.json       # Config real + segredos (gitignored; você cria)
│   ├── index.html             # Shell da aplicação (SPA editorial)
│   ├── style.css              # Design system completo (dark editorial theme)
│   ├── fonts/ · icons/ · theme-1/  # Fontes, ícones e imagens do tema
│   ├── lib/
│   │   ├── frontmatter.mjs    # Parser e serializer YAML <-> Markdown zero-dependências
│   │   └── vault.mjs          # Motor do Vault: indexação, escrita atômica, tombstones, bag
│   ├── js/
│   │   ├── main.js            # Roteador hash, transições, atalhos de teclado, topbar status
│   │   ├── api.js             # Cliente HTTP/SSE para comunicação com server.mjs
│   │   ├── store.js           # Estado reativo v4, fila serializada de escrita e fallback local
│   │   ├── state.js           # Estado de interface (filtros, aba ativa, painéis)
│   │   ├── actions.js         # Dispatcher central de eventos (data-action)
│   │   ├── ui.js              # Utilitários DOM, modais, toasts, sanitização e Markdown
│   │   ├── components.js      # Componentes reutilizáveis (linhas de tarefa, badges, cards)
│   │   └── views/             # home · ai · apps · appDetail · tasks · routine
│   │                          # metrics · study · email · settings · modals
│   ├── scripts/
│   │   ├── seed.mjs           # Popula um vault vazio com dados de demonstração realistas
│   │   └── smoke.mjs          # Suíte automatizada com 54 asserções de API, CRUD e segurança
│   └── legacy-v1/             # Arquivo histórico da extensão Chrome (não é servido)
└── hermes-skills/
    └── hod-hermes/            # Skill pronta para copiar em ~/.hermes/skills/productivity/
```

---

## 4. Início Rápido (Humano)

```bash
# 1. Clone o repositório
git clone https://github.com/Melquisedeque3/Central_HOD.git
cd Central_HOD/hod-extension

# 2. Inicie apontando para a pasta do seu Vault no Obsidian
node server.mjs --vault "/caminho/absoluto/para/seu/VaultObsidian"
```

Acesse **`http://127.0.0.1:8420`** no navegador.

---

## 5. MANUAL DE AUTOMAÇÃO PARA O HERMES AGENT (Bootstrapping & Integração Total)

> **🤖 INSTRUÇÃO DIRETA PARA O HERMES AGENT:**
> Se o usuário entregou este repositório a você dizendo *"deixe o sistema funcional e una o Obsidian, o Frontend e você (Hermes)"*, **siga rigorosamente este protocolo passo a passo**. Você tem autonomia para configurar o servidor local, vincular o vault do Obsidian, conectar seu próprio endpoint OpenAI-compatible e validar toda a operação.

---

### 5.1 Missão do Hermes Agent

Você deve garantir que os **3 componentes** estejam ativos e conversando entre si:

1. **Vault do Obsidian** localizado no disco local (ou criado em um diretório dedicado caso o usuário ainda não tenha indicado um existente).
2. **API Server do próprio Hermes Agent** ativo em `http://127.0.0.1:8642` (endpoint compatível com OpenAI `/v1/models` e `/v1/chat/completions`).
3. **Servidor HOD (`server.mjs`)** rodando em `http://127.0.0.1:8420`, configurado com `.hod-config.json` apontando para o Vault, para o Hermes (`:8642`) e, se disponível, para o plugin Obsidian Local REST API (`:27123`).

---

### 5.2 Passo a Passo de Inicialização e Conexão

Execute os passos abaixo no terminal do host onde você (Hermes) e o Obsidian estão instalados:

#### Passo 1 — Verificar o ambiente Node.js
O HOD requer Node.js `>= 20` e **não usa `npm install`** (zero dependências).
```bash
node --version
```

#### Passo 2 — Localizar o Vault do Obsidian no sistema
Descubra onde está o vault do usuário:
- **No macOS**, inspecione `~/Library/Application Support/obsidian/obsidian.json` para listar os caminhos (`path`) dos vaults registrados no Obsidian.
- **No Linux**, inspecione `~/.config/obsidian/obsidian.json`.
- Caso exista mais de um vault ou o usuário tenha especificado uma pasta para o HOD, utilize o caminho indicado. Se o usuário quiser iniciar um vault limpo, crie uma pasta dedicada (ex.: `~/Obsidian/HOD_Vault`) e abra-a no Obsidian.

#### Passo 3 — Garantir que o API Server do Hermes está ativo na porta `8642`
Verifique no seu próprio ambiente/configuração do Hermes se o servidor compatível com OpenAI está habilitado:
```dotenv
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_KEY=<CHAVE_DO_HERMES_API_SERVER>
API_SERVER_CORS_ORIGINS=http://127.0.0.1:8420
```
Teste localmente:
```bash
curl -s http://127.0.0.1:8642/v1/models \
  -H "Authorization: Bearer <CHAVE_DO_HERMES_API_SERVER>"
```
Anote o `id` do modelo principal retornado em `data[0].id` (ex.: `hermes-default`, `claude-3-5-sonnet`, `gpt-4o`, `deepseek-chat` ou o modelo configurado no Hermes).

#### Passo 4 — Verificar se o plugin Obsidian Local REST API está ativo (Opcional)
O HOD lê e grava diretamente no sistema de arquivos do vault (`lib/vault.mjs`), portanto **funciona 100% mesmo sem plugins**. Porém, se o usuário tiver o plugin `obsidian-local-rest-api` instalado no vault:
- Verifique `<VAULT_PATH>/.obsidian/plugins/obsidian-local-rest-api/data.json` para obter a `apiKey` e a porta (`27123` HTTP ou `27124` HTTPS).

---

### 5.3 Configuração de Persistência (`.hod-config.json`)

Crie o arquivo `.hod-config.json` **dentro de `hod-extension/`** (ele está no `.gitignore` e nunca será commitado). O schema é **aninhado e fechado**: o `readConfig()` do servidor só lê as chaves abaixo. Qualquer campo inventado (`vaultPath`, `apiKey`, `dashboardUrl`, `systemPrompt`…) é **silenciosamente ignorado** — e o Hermes acaba sem chave.

```json
{
  "obsidian": {
    "enabled": false,
    "url": "http://127.0.0.1:27123",
    "key": "",
    "folder": ""
  },
  "hermes": {
    "enabled": true,
    "url": "http://127.0.0.1:8642",
    "key": "COLE_AQUI_O_API_SERVER_KEY_DO_HERMES",
    "model": "hermes-agent",
    "dashboard": "http://127.0.0.1:9119"
  },
  "ui": { "theme": "dark" }
}
```

| Campo | Observação |
|---|---|
| `hermes.key` | Segredo — **não é `apiKey`**. Copie de `API_SERVER_KEY` em `~/.hermes/.env` |
| `hermes.model` | Precisa ser um `id` devolvido por `/v1/models` (o Hermes anuncia `hermes-agent`) |
| `obsidian.key` | Chave do plugin Local REST API (opcional; `obsidian.folder` limita a subpasta) |
| `routine.slots` | Opcional; se omitido, o servidor usa os blocos padrão |

> **Não existe chave `vaultPath`.** O vault é sempre argumento de linha de comando — nunca configuração:

```bash
node server.mjs --vault "/caminho/absoluto/para/o/VaultDoObsidian" --config "$PWD/.hod-config.json"
```

Ou por ambiente: `HOD_VAULT="/caminho/do/vault" node server.mjs`.

---

### 5.4 Contrato de Dados do Vault (Obsidian)

Quando o HOD inicia sobre um vault, ele cria/utiliza a seguinte estrutura:

```text
<VaultDoObsidian>/
├── Candidaturas/          # Notas de processos seletivos (hod_type: application)
├── Tarefas/               # Notas de tarefas (hod_type: task)
├── Guidelines/            # Manuais e materiais de estudo (hod_type: guideline)
├── Rotina/                # Blocos de horário diários (hod_type: routine)
└── .hod/
    ├── index.json         # CACHE DERIVADO — NUNCA edite este arquivo diretamente!
    ├── tombstones.json    # Registro de IDs excluídos para evitar ressurreição
    ├── bag.json           # Listas auxiliares: { emails: [], calendarEvents: [], driveFiles: [] }
    └── trash/             # Backup automático das notas .md excluídas
```

#### Esquemas de Frontmatter YAML (Fonte de Verdade)

1. **Candidatura (`Candidaturas/<Empresa> — <Funcao>.md`, `type: "application"`)**
```yaml
---
id: app_m9x8a1b2
company: Welocalize
role: Search Quality Rater (PT-BR)
stage: teste
priority: urgente
platform: Junction
rate: US$ 14/h
appliedAt: 2025-02-10
deadline: 2025-03-01
nextAction: Concluir Parte 3 do exame prático
link: https://junction.welocalize.com
contact: recruiting@welocalize.com
tags:
  - rater
  - pt-br
notes: Estudar seção de Needs Met antes da prova.
steps:
  - id: step_1
    title: Cadastro e triagem de currículo
    kind: Triagem
    status: done
    dueAt: 2025-02-12
    notes: Aprovado
  - id: step_2
    title: Exame teórico + prático
    kind: Teste
    status: doing
    dueAt: 2025-03-01
    notes: ""
history:
  - at: 2025-02-10T12:00:00.000Z
    text: Candidatura criada
hod_type: application
created_at: 2025-02-10T12:00:00.000Z
updated_at: 2025-02-20T15:30:00.000Z
managed_by: hod
---
```
- **Valores válidos para `stage`**: `mapeada` | `aplicada` | `triagem` | `teste` | `entrevista` | `oferta` | `contratada` | `encerrada`.
- **Valores válidos para `priority`**: `urgente` | `importante` | `normal` | `baixa`.
- **Valores válidos para `steps[].status`**: `todo` | `doing` | `done`.

2. **Tarefa (`Tarefas/<Titulo>.md`, `type: "task"`)**
```yaml
---
id: task_k7p2q9w1
title: Revisar guideline de Page Quality da Welocalize
status: todo
priority: urgente
dueAt: 2025-02-28T14:00
appId: app_m9x8a1b2
appLabel: Welocalize — Search Quality Rater (PT-BR)
completedAt: ""
notes: Focar nos exemplos de YMYL.
hod_type: task
created_at: 2025-02-20T10:00:00.000Z
updated_at: 2025-02-20T10:00:00.000Z
managed_by: hod
---
```
- **Valores válidos para `status`**: `todo` | `doing` | `done`.

3. **Guideline (`Guidelines/<Titulo>.md`, `type: "guideline"`)**
```yaml
---
id: guide_z3n5v8m4
title: Welocalize — General Guidelines PT-BR
appId: app_m9x8a1b2
language: PT-BR / EN
sourceUrl: ""
hod_type: guideline
created_at: 2025-02-15T09:00:00.000Z
updated_at: 2025-02-20T11:00:00.000Z
managed_by: hod
---
# Welocalize — General Guidelines PT-BR

Todo o conteúdo Markdown escrito abaixo do frontmatter nas notas de `Guidelines/`
é **autoritativo** e preservado integralmente pelo servidor e pela interface.
```

4. **Bloco de Rotina (`Rotina/<Horario> — <Label>.md`, `type: "routine"`)**
```yaml
---
id: rot_b4m1x7c9
start: "08:00"
end: "09:30"
label: Foco Profundo — Testes e Qualificações
kind: foco
notes: Sem notificações; priorizar provas de projetos ativos.
hod_type: routine
created_at: 2025-02-10T08:00:00.000Z
updated_at: 2025-02-10T08:00:00.000Z
managed_by: hod
---
```

---

### 5.5 Referência Completa da API HTTP Local (`127.0.0.1:8420`)

O Hermes Agent deve operar o sistema preferencialmente através da API HTTP local do `server.mjs` (pois ela já atualiza o `.md`, mantém o índice sincronizado e aplica escrita atômica):

| Método e Rota | Descrição | Payload / Retorno |
|---|---|---|
| `GET /api/health` | Diagnóstico completo do sistema | Retorna `{ ok: true, mode: "vault", vault: {...}, connections: { obsidian, hermes } }` |
| `GET /api/state` | Snapshot completo do vault | Retorna `{ version: 4, applications, tasks, guidelines, routine, emails, calendarEvents, driveFiles, vault, connections }` |
| `POST /api/records` | Cria ou atualiza um registro (`.md`) | Body: `{ "type": "application\|task\|guideline\|routine\|settings", "data": { ... } }` → `{ ok: true, record }`. **`data.id` é obrigatório** — sem ele, `400 {"error":"Registro sem id."}` |
| `DELETE /api/records/:type/:id` | Move nota para `.hod/trash/` e cria tombstone | Retorna `{ ok: true, deleted: true, path }` |
| `POST /api/bag` | Atualiza listas auxiliares em `.hod/bag.json` | Body: `{ "emails": [...], "calendarEvents": [...], "driveFiles": [...] }` |
| `POST /api/reindex` | Revarre todos os `.md` do disco e reconstrói `.hod/index.json` | Retorna o novo estado completo (mesmo formato de `GET /api/state`) |
| `GET /api/note?path=<relPath>` | Lê o conteúdo Markdown bruto de uma nota do vault | Retorna `{ path, content }` |
| `PUT /api/note` | Sobrescreve o Markdown bruto de uma nota e reindexa | Body: `{ "path": "Candidaturas/...", "content": "---\n..." }` |
| `GET /api/config` | Lê a configuração pública de integrações | Retorna URLs, modelos e flags `hasKey` (nunca expõe segredos) |
| `POST /api/config` | Atualiza `.hod-config.json` | Body parcial com `{ obsidian?, hermes?, ui?, routine? }` |
| `GET /api/hermes/models` | Proxy para `GET <hermes.url>/v1/models` | Lista modelos disponíveis no Hermes |
| `POST /api/hermes/chat` | Proxy para `POST <hermes.url>/v1/chat/completions` | Suporta `stream: true` (SSE) e `stream: false` (JSON) |
| `POST /api/hermes/run` | Atalho que repassa direto para `<hermes.url>/v1/chat/completions` | Body: `{ "messages": [...], "model": "..." }`. **Não** aceita `{ action, input, context }` — use `/api/hermes/chat` |

> **Contrato real do agente:** o endereço usado pelo frontend é `POST /api/hermes/chat`, com
> `{ "messages": [{ "role": "user", "content": "..." }], "stream": true|false }`. É o mesmo formato
> OpenAI. O `run` existe apenas como conveniência e encaminha `messages` — payloads no formato
> `{ action, input, context }` retornam erro do upstream (`Missing or invalid 'messages' field`).

---

### 5.6 Regras de Concorrência, Escrita Atômica e Tombstones

Para que o Hermes Agent, o Obsidian e o Frontend operem sem conflito:

1. **Nunca edite `.hod/index.json` diretamente**: Ele é sobrescrito a cada operação do servidor.
2. **Preserve `id` estável**: Ao atualizar um registro via `POST /api/records`, mantenha o mesmo `id`. Se o título ou nome da empresa mudar, o `Vault` (`lib/vault.mjs`) atualiza a nota existente sem duplicar arquivos.
3. **Controle de Concorrência (`409 Conflict`)**:
   - Ao atualizar um registro existente via `POST /api/records`, envie o campo `updatedAt` (ou deixe sem `updatedAt` apenas quando quiser forçar a escrita).
   - Se o arquivo no disco tiver um `updated_at` mais novo do que o `updatedAt` enviado, o servidor responderá `HTTP 409` com `{ error: "Conflito: a nota foi modificada mais recentemente no vault.", current: {...} }`.
   - Quando receber `409`, releia o registro (`current`), mescle suas alterações e envie novamente.
4. **Se editar arquivos `.md` diretamente pelo filesystem ou via Obsidian**:
   - Chame `POST http://127.0.0.1:8420/api/reindex` logo em seguida para que o índice e a interface reflitam a mudança imediatamente.
5. **Exclusões e Tombstones**:
   - Sempre exclua registros via `DELETE /api/records/:type/:id`. Isso move a nota para `.hod/trash/` e registra o ID em `.hod/tombstones.json`.

---

### 5.7 Skills / Ferramentas que o Hermes Deve Registrar

> **Atalho:** o repositório já traz uma skill pronta em [`hermes-skills/hod-hermes/`](hermes-skills/hod-hermes/SKILL.md), extraída de uma instalação real. Copie antes de improvisar:
> ```bash
> mkdir -p ~/.hermes/skills/productivity
> cp -R hod-extension/hermes-skills/hod-hermes ~/.hermes/skills/productivity/
> ```
> Ela documenta os caminhos corretos, o schema real da config e as armadilhas que fariam a instalação falhar.

Como cérebro do HOD, configure ou utilize suas ferramentas internas (HTTP / Shell / File) para executar os seguintes fluxos sempre que o usuário pedir:

1. **`hod_get_state`**:
   - Faz `GET http://127.0.0.1:8420/api/state` para consultar candidaturas, tarefas, rotina, guidelines e e-mails reais antes de responder qualquer pergunta sobre a vida profissional do usuário.
2. **`hod_upsert_record`**:
   - Faz `POST http://127.0.0.1:8420/api/records` com `{ type, data }` para criar ou atualizar candidaturas (`application`), tarefas (`task`), guidelines (`guideline`) ou blocos de rotina (`routine`).
3. **`hod_delete_record`**:
   - Faz `DELETE http://127.0.0.1:8420/api/records/:type/:id` (peça confirmação ao usuário antes de excluir registros importantes).
4. **`hod_push_emails`**:
   - Quando o Hermes coletar e-mails externos (via Gmail/IMAP/MCP), deve enviá-los para `POST http://127.0.0.1:8420/api/bag` no formato:
     ```json
     {
       "emails": [
         {
           "id": "em_1",
           "subject": "Welcome to Telus Qualification Exam",
           "from": "sourcing@telusinternational.ai",
           "date": "2025-02-24T13:00:00.000Z",
           "snippet": "Your exam link is ready...",
           "body": "Texto completo do e-mail...",
           "tag": "Convite / Teste"
         }
       ]
     }
     ```
5. **`hod_reindex_vault`**:
   - Faz `POST http://127.0.0.1:8420/api/reindex` sempre que manipular notas `.md` diretamente no diretório do vault.

---

### 5.8 Serviço em Background (LaunchAgent macOS / systemd Linux)

Para que o usuário não precise abrir o terminal toda vez, o Hermes Agent pode configurar o servidor HOD para iniciar automaticamente no login:

#### No macOS (`~/Library/LaunchAgents/local.hod.server.plist`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>local.hod.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/CAMINHO/PARA/Central_HOD/hod-extension/server.mjs</string>
    <string>--vault</string>
    <string>/CAMINHO/PARA/VaultDoObsidian</string>
    <string>--config</string>
    <string>/CAMINHO/PARA/Central_HOD/hod-extension/.hod-config.json</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/CAMINHO/PARA/Central_HOD/hod-extension</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/hod-server.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/hod-server.err.log</string>
</dict>
</plist>
```
*(Três detalhes que já quebraram instalações reais: **1)** use o caminho **absoluto** do Node — `shutil.which('node')`; quando o Hermes instalou o próprio runtime ele fica em `~/.hermes/tools/node-*/bin/node`, não em `/usr/local/bin`. **2)** **Mate o processo órfão antes de carregar**, senão o launchd entra em loop de `EADDRINUSE`: `pkill -f "hod-extension/server.mjs"` e confirme com `lsof -nP -iTCP:8420`. **3)** Valide com `plutil -lint`, carregue com `launchctl load -w ~/Library/LaunchAgents/local.hod.server.plist` e confira `launchctl list | grep local.hod` mostrando exit code `0`.)*

#### No Linux (`~/.config/systemd/user/hod.service`)
```ini
[Unit]
Description=HOD Central de Home Office Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/CAMINHO/PARA/Central_HOD/hod-extension
ExecStart=/usr/bin/env node /CAMINHO/PARA/Central_HOD/hod-extension/server.mjs --vault "/CAMINHO/PARA/VaultDoObsidian" --config "/CAMINHO/PARA/Central_HOD/hod-extension/.hod-config.json"
Restart=on-failure

[Install]
WantedBy=default.target
```
*(Ative com `systemctl --user daemon-reload && systemctl --user enable --now hod.service`.)*

---

### 5.9 Checklist de Verificação Pós-Instalação (Smoke Test)

Antes de reportar ao usuário que o sistema está pronto, o Hermes Agent deve executar os 3 testes abaixo:

1. **Executar a suíte automatizada de Smoke Test (54 asserções)**:
   *(A suíte `npm run smoke` testa a API contra o servidor ativo em `127.0.0.1:8420`; execute-a em um vault de teste temporário primeiro se não quiser criar/apagar registros de teste no vault principal, ou valide diretamente via `/api/health`.)*
   ```bash
   curl -s http://127.0.0.1:8420/api/health
   ```
   Confirme que o JSON retornado contém:
   - `"ok": true`
   - `"mode": "vault"`
   - `"vault": { "root": "/caminho/do/vault/real", ... }`

2. **Testar a ponte HOD → Hermes Agent**:
   ```bash
   curl -s http://127.0.0.1:8420/api/hermes/models
   ```
   Confirme que retorna `"ok": true` e a lista `models` do Hermes Agent sem erro `401` ou `502`.

3. **Testar uma execução real do Agente via HOD**:
   ```bash
   curl -s -X POST http://127.0.0.1:8420/api/hermes/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Diga em uma frase: conexão HOD-Hermes ativa?"}],"stream":false}'
   ```
   Confirme que a resposta traz `choices[0].message.content` com texto em português.
   *(Este é o contrato real: formato OpenAI com `messages`. O payload `{action, input, context}`
   do `/api/hermes/run` **não existe** e falha no upstream.)*

Quando os 3 passos responderem com sucesso, informe ao usuário que a **Central HOD está 100% operacional em `http://127.0.0.1:8420`**, integrada ao Obsidian e ao Hermes Agent.

---

### 5.10 Armadilhas conhecidas (todas já observadas em instalação real)

| Sintoma | Causa | Correção |
|---|---|---|
| `MODULE_NOT_FOUND: .../Central_HOD/server.mjs` | Rodou da raiz do repo | `cd hod-extension` antes de `node server.mjs` |
| `GET /api/hermes/models` → `401`/`502` | `hermes.key` vazio ou errado | Copiar `API_SERVER_KEY` de `~/.hermes/.env` para `hermes.key` |
| Config "aceita" mas o Hermes nunca conecta | Usou `apiKey`/`vaultPath` (campos inexistentes) | Usar `hermes.key`; vault vai em `--vault` |
| `Missing or invalid 'messages' field` | Mandou `{action, input, context}` | Mandar `{messages: [...]}` |
| `400 {"error":"Registro sem id."}` | `POST /api/records` sem `data.id` | Gerar `id` estável no cliente antes de criar |
| LaunchAgent em loop com `EADDRINUSE` | `node server.mjs` manual ainda ocupa a 8420 | `pkill -f "hod-extension/server.mjs"` e só então `launchctl load` |
| launchd não sobe o node | `/usr/local/bin/node` não existe na máquina | Usar `shutil.which('node')` — costuma estar em `~/.hermes/tools/node-*/bin/node` |
| Vault indexa 0 notas | Caminho de vault inventado | Ler o path real de `~/Library/Application Support/obsidian/obsidian.json` |
| Edição no Obsidian não aparece | Índice desatualizado | `POST /api/reindex` (ou botão **Sincronizar vault**) |
| `409 Conflict` ao salvar | Nota mudou no disco depois do load | Reler via `GET /api/note`, mesclar e reenviar com o `updatedAt` atual |

---

## 6. Voz (STT & TTS Gratuitos)

- **Entrada de voz (Microfone 🎙)**: `window.SpeechRecognition` / `window.webkitSpeechRecognition` nativo, em `pt-BR`.
- **Saída de voz (Leitura 🔊)**: `window.speechSynthesis` nativo do sistema. O botão alterna a leitura das respostas e o estado fica em `localStorage['hod:hermes:voiceOut']`.
- **Seleção de voz**: `pickPtVoice()` pontua por `pt-BR` > `pt` e prioriza vozes locais; `speakable()` remove blocos de código, markdown e links antes de falar.
- **Modo conversa**: com o 🔊 ligado, ao terminar de falar a pergunta é enviada sozinha e a resposta é lida em voz alta — e o microfone é silenciado antes de abrir, para não transcrever a própria resposta.
- **Custo zero**: nenhuma API paga de áudio.

> **Limite de navegador:** o STT é do Chromium e depende do serviço de fala do Google — **Chrome/Edge/Safari ok, Brave e Firefox costumam bloquear**. O TTS é local e funciona em qualquer um. Se o 🎙 não abrir, diagnostique com `!!(window.SpeechRecognition || window.webkitSpeechRecognition)` antes de suspeitar do HOD. As vozes do Chrome carregam de forma assíncrona; o `voiceschanged` já é tratado no código.

---

## 7. Segurança e Privacidade

- **Escuta restrita a loopback**: por padrão, `server.mjs` escuta apenas em `127.0.0.1:8420`. Não exponha a porta à internet pública sem camada de autenticação.
- **Segredos isolados no servidor**: as chaves `hermes.key` e `obsidian.key` ficam salvas somente em `.hod-config.json` no disco local. A rota `GET /api/config` jamais devolve as chaves para o navegador (apenas `hasKey: true|false`).
- **Proteção de diretórios internos**: o servidor HTTP bloqueia com `403 Forbidden` qualquer acesso estático a `/lib`, `/vault`, `/scripts`, `/.git`, `/node_modules`, `/.tools`, `/legacy-v1` e arquivos ocultos (`/.`).
- **O vault nunca vai para o Git**: `vault/`, `.hod/` e `.hod-config.json` estão no `.gitignore`. Não versione notas pessoais — nem como pasta `HOD/` na raiz do repositório. Se quiser compartilhar dados de exemplo, use `npm run seed` em um vault descartável.

---

## 8. Solução de Problemas

| Sintoma | Causa Provável & Solução |
|---|---|
| Pill superior mostra **"Modo local (navegador)"** | Você abriu o `index.html` via `file://` ou o `server.mjs` está parado. Inicie `node server.mjs --vault "..."` e acesse `http://127.0.0.1:8420`. |
| **Hermes Agent retorna 502 / Offline** | O API Server do Hermes não está rodando na porta `8642`, ou o `hermes.key` em `.hod-config.json` está errado. Verifique `curl http://127.0.0.1:8642/v1/models`. |
| **Editei uma nota no Obsidian e não mudou na tela** | Clique no botão **"Sincronizar vault"** na barra lateral esquerda (ou envie `POST /api/reindex`). |
| **Erro `409 Conflict` ao salvar** | A nota foi alterada no disco após o carregamento da tela. Recarregue/sincronize o vault para obter a versão mais recente. |
| **Desejo popular dados de exemplo** | Com o servidor apontando para um vault vazio, execute `npm run seed` (ou `node scripts/seed.mjs --force`). |
