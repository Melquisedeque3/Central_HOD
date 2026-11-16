# Skills do Hermes para o HOD

Esta pasta contém skills prontas para o **Hermes Agent**, escritas a partir de uma instalação
real (macOS, Hermes 0.21.x) — não são documentação teórica: cada regra existe porque algo
quebrou antes.

## Instalação

```bash
# a partir da raiz do repositório
mkdir -p ~/.hermes/skills/productivity
cp -R hod-extension/hermes-skills/hod-hermes ~/.hermes/skills/productivity/
```

O Hermes recarrega o catálogo de skills automaticamente. Para conferir:

```bash
ls ~/.hermes/skills/productivity/hod-hermes
```

Depois basta pedir em linguagem natural — a skill `hod-hermes` é acionada quando o assunto
envolve HOD, vault do Obsidian, integração com o agente ou operação de candidaturas/tarefas.

## Conteúdo

| Arquivo | Para que serve |
|---|---|
| `hod-hermes/SKILL.md` | Regras permanentes: sequência de instalação, ativação do API Server, contrato de dados, voz, LaunchAgent e armadilhas |
| `references/installation-recipe.md` | Receita de instalação do zero e correções de permissão/Node |
| `references/api-endpoint-quickref.md` | Tabela condensada dos endpoints com os corpos reais |
| `references/obsidian-vault-structure.md` | Frontmatter de `application`, `task`, `guideline`, `routine` com enums válidos |
| `references/troubleshooting-smoke.md` | Pontos de entrada do smoke test e diagnóstico de falhas |

## Regras que mais importam

1. A aplicação vive em **`hod-extension/`**, não na raiz do repositório.
2. O vault é **argumento de CLI** (`--vault` / `HOD_VAULT`) — não existe `vaultPath` na config.
3. O segredo do Hermes é **`hermes.key`** (de `API_SERVER_KEY` em `~/.hermes/.env`), não `apiKey`.
4. O contrato do agente é **OpenAI** (`messages`). Não existe endpoint de "ação".
5. Depois de editar Markdown por fora, **`POST /api/reindex`**.
6. Nunca editar `.hod/index.json` à mão.
