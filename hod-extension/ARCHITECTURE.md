# Arquitetura

`server.mjs` serve a SPA e a API local em loopback. `lib/vault.mjs` traduz registros para notas Markdown com frontmatter, usa escrita atômica e mantém `.hod/index.json` apenas como cache derivado. `.hod/audit.jsonl`, tombstones e `bag.json` ficam sob `.hod/`.

```text
Browser → API local autenticada → Vault Markdown (fonte de verdade)
ChatGPT Work → /work/context e /work/actions → allowlist → Vault Markdown
```

Os tipos estruturados são `application`, `task`, `guideline`, `routine` e `opportunity`. O Work só cria documentos nas pastas HOD autorizadas; análises usam `Insights/`. Coletores autorizados entram por API em `Oportunidades/`; não acessam o vault. Não há banco SQLite: no ensaio de 300 registros a leitura inicial foi ~322 ms e a ação Work média ~532 ms, sem evidência de degradação que justifique migração.

Hermes é opcional, restrito a URL loopback e acessível somente por `ADMIN`. O proxy genérico do Obsidian está desativado.
