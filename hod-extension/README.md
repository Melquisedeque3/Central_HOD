# HOD — Central de Home Office

Página local para organizar candidaturas, tarefas, rotina, guidelines e correspondências. A interface é o frontend; **Obsidian é a fonte de verdade**; o **Hermes Agent é o cérebro operacional**. O índice `.hod/index.json` é derivado e reconstruível.

> HOD 4.0 · Node.js 20+ · sem dependências de runtime e sem etapa de build.

## Arquitetura

```text
┌─────────────────────────┐       HTTP/SSE       ┌─────────────────────────┐
│ Navegador                │ ──────────────────▶ │ HOD local :8420         │
│ HTML/CSS/ES Modules      │ ◀────────────────── │ server.mjs (Node)       │
└─────────────────────────┘                      └────────┬────────┬───────┘
                                                          │        │
                                      Markdown + índice    │        │ OpenAI API proxy
                                                          ▼        ▼
                                                 ┌────────────┐ ┌─────────────┐
                                                 │ Vault       │ │ Hermes Agent│
                                                 │ Obsidian    │ │ API :8642   │
                                                 └────────────┘ └─────────────┘
                                                      │
                                               REST opcional
                                                      ▼
                                             Obsidian plugin :27123
```

Os registros editáveis são notas Markdown com YAML frontmatter. O servidor indexa as notas para montar o estado rápido da interface; a edição pelo HOD volta a gravar a nota. O plugin Obsidian Local REST API é opcional — o servidor HOD acessa o vault diretamente pelo sistema de arquivos. A integração REST existe para operações auxiliares e conexão/teste do plugin.

As chaves do Hermes e da REST API do Obsidian ficam em `.hod-config.json` no servidor local, nunca no JavaScript do navegador. Não exponha o HOD à rede pública: o padrão é escutar somente em `127.0.0.1`.

## Requisitos e início

- Node.js 20 ou superior.
- Um vault Obsidian existente ou diretório local gravável.
- Hermes Agent é opcional para usar as áreas que não dependem do agente.

```bash
node --version
node server.mjs --vault "/caminho/para/o/vault"
```

Abra <http://127.0.0.1:8420>. Ou use `npm start` (não há instalação de pacote). Para gerar dados de demonstração em um vault vazio: `npm run seed`. Para validar a API: `npm run smoke` com o servidor ativo. O seed não substitui dados existentes sem a opção `--force`.

### Argumentos e variáveis

| Opção | Variável | Padrão | Função |
|---|---|---|---|
| `--host` | `HOD_HOST` | `127.0.0.1` | Endereço de escuta; mantenha localhost salvo necessidade deliberada. |
| `--port` | `HOD_PORT` | `8420` | Porta HTTP da página e API. |
| `--vault` | `HOD_VAULT` | `./vault` | Diretório do vault Markdown. |
| `--config` | `HOD_CONFIG` | `./.hod-config.json` | Caminho do arquivo local de configuração/segredos. |

Argumentos têm precedência sobre variáveis de ambiente. Exemplo:

```bash
HOD_VAULT="$HOME/Documents/MeuVault" HOD_PORT=8420 node server.mjs
```

## Preparação do Hermes Agent

No host onde o Hermes está instalado, configure o API Server OpenAI-compatible segundo a versão instalada do Hermes. No ambiente do Hermes, defina:

```dotenv
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_KEY=gere-uma-chave-longa-e-aleatoria
# Se a versão exigir CORS para o cliente, permita apenas a origem local do HOD.
API_SERVER_CORS_ORIGINS=http://127.0.0.1:8420
```

Reinicie o serviço e confirme que `http://127.0.0.1:8642/v1/models` responde quando enviado `Authorization: Bearer <API_SERVER_KEY>`. O HOD solicita modelos e conversa por `/v1/chat/completions`, com streaming SSE. O campo da chave é salvo pelo servidor; depois de salvar, a UI exibe apenas o indicador de chave configurada.

Em **Ajustes → Hermes Agent**, preencha:

- **URL:** `http://127.0.0.1:8642` (a URL pode também terminar em `/v1`);
- **API key:** o valor de `API_SERVER_KEY`;
- **Modelo:** um ID retornado por `/v1/models`;
- **Dashboard:** opcional, normalmente `http://127.0.0.1:9119`.

Use **Testar conexão** e **Listar modelos**. Se Hermes estiver desligado, a página continua operável; chat e ações do agente ficam desabilitados.

### O que entregar ao agente Hermes

A integração com o modelo é apenas o transporte de chat. Para o Hermes operar de fato o vault, instale/configure no host de integração as skills e ferramentas apropriadas, respeitando os contratos abaixo. Não disponibilize o caminho do vault nem credenciais ao navegador. A API local HOD permite que um agente autorizado leia o estado e faça CRUD:

- `GET /api/state` — snapshot derivado do vault;
- `POST /api/records` com `{ "type": "application|task|guideline|routine|settings", "data": { ... } }` — cria/atualiza nota;
- `DELETE /api/records/:type/:id` — exclui, arquiva na lixeira e deixa tombstone;
- `GET /api/note?path=...` e `PUT /api/note` com `{ "path": "...", "content": "..." }` — leitura/gravação Markdown;
- `POST /api/reindex` — reconstrói o índice após alterações externas;
- `GET /api/health` — diagnóstico de conectividade.

Para escrita concorrente, preserve `id` estável e envie `updatedAt` atual quando fizer update. O servidor responde `409` com o estado atual quando detectar edição obsoleta. Exclusões criam tombstone para evitar ressurreição de dados e cópia em `.hod/trash/`. **Não escreva diretamente em `.hod/index.json`**: é cache derivado.

Skills sugeridas para configurar no Hermes:

1. `hod-vault-read`: carregar o estado, filtrar notas e consultar Markdown; nunca inventar campos.
2. `hod-record-upsert`: propor ou executar CRUD via endpoints acima; confirmar ações destrutivas conforme a política do usuário.
3. `hod-daily-briefing`: resumir tarefas, prazos e próximos passos a partir de `GET /api/state`.
4. `hod-reindex`: após editar Markdown por fora da API, solicitar reindexação.

Comece com execução supervisionada. Uma configuração de cron pode chamar um briefing diário, mas agende-a apenas depois de validar permissões, fuso horário, canal de entrega e formato com o usuário. O HOD não instala skills nem cria cron jobs automaticamente.

## Preparação do Obsidian (opcional)

Para usar o proxy Local REST API:

1. Instale o plugin **Local REST API** no Obsidian e habilite-o.
2. Copie a chave gerada pelo plugin e mantenha o servidor acessível em `127.0.0.1:27123` (padrão).
3. Em **Ajustes → Obsidian Local REST API**, informe URL, chave e, opcionalmente, subpasta do vault.
4. Clique em **Testar conexão**.

A chave é guardada localmente pelo servidor e não é devolvida ao browser. O HOD usa acesso direto ao diretório do vault para os dados principais; a REST API não substitui essa configuração.

## Voz

A entrada de voz usa Web Speech API do navegador quando disponível. A leitura de respostas usa a síntese de voz do sistema (`speechSynthesis`); não requer chave ou serviço pago. Disponibilidade e vozes variam entre navegador e sistema operacional. Se não houver suporte, chat por texto continua disponível.

## Vault e dados

Na primeira inicialização, o HOD cria (se necessário) as pastas e metadados:

```text
Vault/
├── Candidaturas/       # uma nota por processo
├── Tarefas/            # uma nota por tarefa
├── Guidelines/         # notas de estudo; corpo Markdown autoritativo
├── Rotina/             # blocos de rotina
├── .hod/
│   ├── index.json      # índice derivado, reconstruível
│   ├── tombstones.json # exclusões, evita ressurreição
│   ├── bag.json        # e-mails, calendário e arquivos auxiliares
│   └── trash/          # cópias de notas excluídas
```

O arquivo `.hod-config.json` fica no diretório do projeto por padrão, fora do vault; `HOD_CONFIG`/`--config` pode apontá-lo para outro local protegido.

Exemplo abreviado de candidatura:

```yaml
---
id: app_abc123
company: Exemplo
role: Engenheira de Dados
stage: entrevista
priority: importante
nextAction: Preparar conversa técnica
deadline: 2026-12-01
steps:
  - id: step_1
    title: Entrevista técnica
    kind: Entrevista
    status: todo
hod_type: application
created_at: 2026-11-10T10:00:00.000Z
updated_at: 2026-11-10T10:00:00.000Z
managed_by: hod
---
# Exemplo — Engenheira de Dados
```

Tipos aceitos em `POST /api/records`: `application`, `task`, `guideline`, `routine`, `settings`. Cada nota tem `id` estável, `hod_type` e datas. Para guidelines, o corpo Markdown após o frontmatter é a fonte de verdade; os demais corpos derivados podem ser reconstituídos a partir dos campos estruturados.

### Concorrência e consistência

- O servidor serializa gravações e grava notas de forma atômica.
- Envie `updatedAt` para evitar sobrescrever edições recentes; trate `409` relendo o registro e conciliando a alteração.
- Nunca recrie registro apagado sem intenção explícita: respeite os tombstones.
- Edite as notas normalmente no Obsidian. Se alterações externas não aparecerem, use **Reindexar vault** ou `POST /api/reindex`.
- `GET /api/state` é uma projeção do vault, não outra fonte de verdade.

## Migração da extensão Chrome

1. Faça backup/exporte os dados da extensão antes da migração.
2. Inicie o HOD com o vault de destino correto.
3. No HOD, use **Ajustes → Exportar JSON** na origem, se ainda puder abrir a extensão antiga; caso contrário, preserve o backup JSON existente.
4. Importe o JSON pelo formulário **Importar JSON**. Os registros são mesclados por `id`; confira contagens, conteúdo de guidelines e rotinas no vault.
5. Reindexe e valide o HOD antes de remover a extensão antiga. A importação não apaga as notas já existentes.

Dados demonstrativos (`npm run seed`) não são sua migração e podem ser removidos manualmente do vault.

## Operação e endpoints

- `GET /api/health` — versão, vault e conectividade Hermes/Obsidian;
- `GET /api/state` — estado completo derivado;
- `POST /api/records`, `DELETE /api/records/:type/:id` — CRUD de notas;
- `POST /api/bag` — atualiza listas de e-mail/calendário/Drive;
- `GET|POST /api/config` — preferências; resposta pública inclui `hasKey`, não a chave;
- `GET|PUT /api/note` — acesso Markdown controlado;
- `GET|PUT|POST|DELETE /api/obsidian/*` — proxy REST autenticado pelo servidor;
- `GET /api/hermes/models`, `POST /api/hermes/chat`, `POST /api/hermes/run` — proxy Hermes.

Há também modo degradado de navegador/localStorage se o servidor estiver indisponível, mas para persistir notas no vault, usar Hermes e manter backup Markdown, abra sempre a página pelo servidor HOD.

## Segurança e backup

- `.hod-config.json`, `vault/` e `.hod/` estão no `.gitignore`; nunca commite vault pessoal nem chaves.
- `.hod-config.example.json` é um modelo sem segredos.
- O servidor escuta em loopback por padrão. Não mude para `0.0.0.0` sem adicionar autenticação e controles de rede.
- Faça backup do vault inteiro (incluindo `.hod/` se desejar preservar lixeira e estado de indexação). O índice pode ser regenerado; tombstones e lixeira são úteis para recuperação.
- A página não deve ser servida por hospedagem pública quando o HOD local usa permissões de escrita.

## Solução de problemas

| Sintoma | Verificação |
|---|---|
| `node server.mjs` não inicia | Confirme Node 20+, permissão de escrita no vault e disponibilidade da porta 8420. Tente `--port 8421`. |
| Página mostra modo local | Acesse via `http://127.0.0.1:8420`, confirme `/api/health` e recarregue. Abrir o HTML por `file://` não conecta ao servidor. |
| Notas não aparecem | Confirme `--vault` aponta ao vault certo; clique em **Reindexar vault**. |
| Hermes não conecta | Verifique que API Server está habilitado e escutando em 8642; valide URL, chave e `/v1/models`. A chave não deve ir no browser. |
| Obsidian REST retorna 401 | Confira chave do plugin, URL, plugin ativo e teste primeiro em Ajustes. O HOD continua usando o filesystem mesmo se a REST opcional estiver desligada. |
| Resposta do agente não conclui | Verifique logs do Hermes/API Server, limite/timeout e compatibilidade OpenAI de `/v1/chat/completions`. |
| Edição retorna 409 | Recarregue o registro e reaplique a alteração em vez de reenviar estado antigo. |
| Nota modificada externamente não atualiza | Execute reindexação. Não edite `.hod/index.json` manualmente. |

## Desenvolvimento

Não há build nem dependências npm. Edite os arquivos e reinicie `node server.mjs` quando mudar código do servidor. Alterações front-end aparecem ao recarregar o navegador. Testes básicos:

```bash
npm run smoke
# opcional: popular um vault de teste vazio
npm run seed
```

A interface mantém o desenho atual; esta migração substitui principalmente armazenamento, rotas de integração e operacionalização local.
