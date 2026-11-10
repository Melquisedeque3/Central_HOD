# HOD — Central de Carreira

Extensão Chrome (Manifest V3) para organizar candidaturas, processos, prazos e material de estudo em um só lugar. Sem build, sem dependências e sem backend próprio: os dados ficam na sua máquina e o **Obsidian** é o backend opcional do "segundo cérebro".

> Versão 2.0.0 · schema de dados 3 · interface em português.
> A documentação da versão antiga (Google Sheets + Gemini) está preservada em [`legacy-v1/v1/README.md`](legacy-v1/v1/README.md).

---

## 1. O que já funciona (Fase 0 + 1)

| Área | Recurso |
|---|---|
| **Início** | Faixa semanal com contagem por dia, palco do dia (foco + KPIs), próximos prazos, tarefas de hoje/atrasadas, processos sem próxima ação e captura rápida. |
| **Pipeline** | Kanban com 7 etapas, arrastar e soltar entre colunas, filtros por texto/prioridade e histórico automático de mudança de etapa. |
| **Processos** | Tabela de candidaturas + página de detalhe com etapas (certificação, prova, entrevista, follow-up…), tarefas ligadas, guidelines, notas em Markdown e linha do tempo. |
| **Tarefas** | CRUD completo, agrupamento por atraso/prazo, prioridade, vínculo com candidatura e conclusão com um clique. |
| **Estudo** | Biblioteca de guidelines por empresa/projeto, leitor Markdown, filtros, cópia do conteúdo e espaço para tradução PT-BR (fase de IA). |
| **Ajustes** | Conexão com Obsidian (Local REST API), teste de conexão, envio de todas as notas, download `.md`, exportar/importar JSON e apagar tudo. |
| **Dados** | `chrome.storage.local` como fonte principal, espelho em `localStorage`, migração automática da v1 e backup JSON. |

Atalhos: `g h` início · `g p` pipeline · `g a` processos · `g t` tarefas · `g e` estudo · `g s` ajustes · `n` nova tarefa · `/` buscar.

---

## 2. Instalação

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione esta pasta.
4. Clique no ícone do HOD. O painel abre em uma aba inteira; clicar de novo foca a aba existente.

Para editar o código e testar rápido, também é possível servir a pasta:

```bash
python3 -m http.server 8765
# abra http://127.0.0.1:8765/
```

Fora da extensão o app usa `localStorage`; dentro dela, `chrome.storage.local` com espelho local.

---

## 3. Arquitetura

```
hod-extension/
├── manifest.json          # MV3: storage + host_permissions para 127.0.0.1/localhost
├── background.js          # service worker: abre/foca o painel (ping entre abas)
├── index.html             # shell: masthead, breadcrumb, #view, menu de borda, #modal-root
├── style.css              # design system (dark teal, Rubik, menu de borda, transições, responsivo até 390px)
├── fonts/                 # Rubik variável (subset latin), empacotada para uso offline
├── js/
│   ├── main.js            # rotas por hash, transições direcionais, render, atalhos e eventos
│   ├── store.js           # modelo, normalização, migração, persistência e CRUD
│   ├── state.js           # estado de UI (filtros por tela)
│   ├── actions.js         # despacho de data-action
│   ├── ui.js              # helpers de DOM, datas, modais, toast e Markdown seguro
│   ├── components.js      # linhas de tarefa/etapa, chips, progresso
│   ├── obsidian.js        # Local REST API + geração de notas Markdown
│   └── views/             # home, pipeline, apps, appDetail, tasks, study, settings, modals
├── scripts/
│   ├── dev-check.mjs      # carrega o painel via CDP, semeia dados e tira screenshots
│   ├── crud-check.mjs     # teste de fumaça do CRUD, persistência e exclusão em cascata
│   └── debug.mjs          # inspeção auxiliar do painel
├── legacy-v1/v1/          # versão anterior preservada (não é carregada)
└── .tools/                # craft-anything + capturas usadas como referência de UX
```

Sem bundler, sem npm no runtime: módulos ES nativos carregados pelo navegador. O service worker não guarda estado de negócio.

**Navegação:** o menu principal é o **edge menu** no canto inferior esquerdo — um botão-redondo que abre discos concêntricos (revelação em cascata) com os seis destinos rotulados sobre o arco: Início, Pipeline, Processos, Tarefas, Estudo e Ajustes. Funciona por clique, teclado (Tab/Escape) e fecha ao navegar; o masthead fixo concentra a marca, a trilha (HOD / página / item) e as ações rápidas.

**Home editorial:** relógio grande, trilha dos sete dias com contagem de itens, bloco "próximo movimento" com os prazos à direita, indicadores em linha, atalhos ilustrados para as quatro áreas e prateleiras de tarefas. As rotas internas usam a View Transitions API para uma transição direcional curta (avançar/voltar), desativada com `prefers-reduced-motion`.

### Modelo de dados

```js
{
  version: 3,
  applications: [{
    id, company, role, stage, priority, nextAction, deadline, appliedAt,
    link, location, compensation, tags[], notes,
    steps: [{ id, title, kind, status, dueAt, notes }],
    history: [{ at, text }], createdAt, updatedAt
  }],
  tasks: [{ id, title, notes, status, priority, dueAt, appId, completedAt }],
  guidelines: [{ id, title, appId, sourceUrl, language, body, translation }],
  settings: {
    obsidian: { enabled, url, key, folder },
    ai: { provider, model, apiKey },   // reservado para a fase 3
    ui: { density }
  }
}
```

Regras: `application → steps → tasks`; excluir uma candidatura remove tarefas e guidelines ligadas; toda mudança de etapa gera evento no histórico; prazos aceitam `YYYY-MM-DD` (dia) ou `YYYY-MM-DDTHH:mm` (data e hora).

---

## 4. Obsidian como backend

O HOD conversa com o plugin **[Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)** rodando no Obsidian:

1. Instale e ative o plugin no vault.
2. Copie a **API key** exibida pelo plugin.
3. Em **Ajustes → Obsidian**, informe a URL (padrão `http://127.0.0.1:27123`), a chave e a pasta (padrão `HOD`).
4. Use **Testar conexão** e **Enviar tudo para o vault**.

Cada candidatura vira `HOD/Candidaturas/Empresa — Função.md`, com frontmatter (`hod`, `empresa`, `funcao`, `etapa`, `prioridade`, `prazo`) e seções de próxima ação, etapas, tarefas, guidelines e histórico. Um `HOD/HOD — Índice.md` lista tudo. Também é possível baixar um único `.md` com todas as notas.

Observações:
- O plugin usa certificado autoassinado por padrão; se optar por HTTPS local, o Chrome precisa confiar no certificado.
- Não há sincronização bidirecional ainda: o HOD escreve no vault; leitura/merge entra na fase 4.

---

## 5. Privacidade e segurança

- Permissões: apenas `storage`; acesso de rede restrito a `127.0.0.1` e `localhost` (Obsidian).
- Nenhuma telemetria, nenhum servidor intermediário e nenhuma chave de IA nesta fase.
- Chaves e dados ficam em `chrome.storage.local` — **não** são sincronizados entre dispositivos.
- O conteúdo é sempre escapado antes de entrar no HTML; o Markdown é renderizado por um subconjunto próprio, sem injetar HTML.
- Backup recomendado antes de migrar de máquina: **Ajustes → Exportar JSON**.

---

## 6. Verificação / desenvolvimento

O harness usa o Chrome em modo debug e o servidor local:

```bash
# terminal 1
python3 -m http.server 8765

# terminal 2 (Chrome headless com CDP)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/hod-chrome \
  about:blank

# terminal 3
node scripts/dev-check.mjs      # screenshots em /tmp/hod-shots + erros de console
node scripts/crud-check.mjs     # CRUD real: criar, editar, concluir, recarregar e excluir
```

O `dev-check.mjs` semeia cinco candidaturas, cinco tarefas e duas guidelines, percorre todas as telas e reporta exceções. O `crud-check.mjs` cria uma candidatura pela topbar, adiciona e conclui uma etapa, cria uma tarefa vinculada, recarrega para conferir a persistência e valida a exclusão em cascata — sem apagar os dados existentes.

---

## 7. Roadmap

| Fase | Escopo | Status |
|---|---|---|
| **0 — Fundação** | storage único, schema, migração v1, rotas, shell, backup | ✅ concluída |
| **1 — Home + Pipeline + Processos** | CRUD real, kanban, etapas, tarefas, prazos, busca | ✅ concluída |
| **2 — Estudo** | guidelines, leitor Markdown, vínculo com processos | ✅ concluída (tradução fica para a IA) |
| **3 — IA BYOK** | chaves OpenRouter/Google AI/Groq/Nvidia, tradução PT-BR, resumos, digest de e-mails | 🔜 próxima |
| **4 — Integrações** | Gmail, Calendar, Drive, leitura do vault Obsidian | ⏳ planejada |
| **5 — Polimento** | testes automatizados, acessibilidade, importação assistida | ⏳ planejada |

### Fase 3 — decisões de projeto

- Chaves em `chrome.storage.local`, nunca em URL, log ou `sync`; campo mascarado e opção de apagar.
- Camada única `ai.js` com adaptadores por provedor e fallback entre modelos.
- Toda escrita sugerida pela IA passa por aprovação (human-in-the-loop); a IA lê e propõe, não altera o estado sozinha.
- Tradução de guidelines grava em `translation`, preservando o original.

### Fase 4 — atritos conhecidos

- Gmail/Calendar/Drive exigem OAuth; uso pessoal funciona em modo de teste, distribuição exige verificação e provavelmente backend.
- Obsidian não expõe o vault à extensão; o caminho suportado é o Local REST API ou import/export `.md`.
- Busca de vagas via APIs/feeds é viável; scraping de LinkedIn e similares viola os termos de uso e não será implementado.

---

## 8. Referências de produto

- **EasyMachineAI HQ** (`hq.easymachineai.com`) — referência de fluxo, densidade e estética "HQ".
- **craft-anything** (`github.com/storytold/craft-anything`) — usado para mapear telas, estados e padrões de interação da referência. Nenhum código ou ativo proprietário foi copiado; a implementação é original e adaptada ao domínio de carreira.

---

*Última atualização: novembro/2026.*
