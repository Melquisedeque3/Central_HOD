# Testes

```bash
npm run test:unit
npm run test:security
npm run test:work-e2e
npm run test:work-restart
npm run smoke
npm run test:performance
npm run test:mcp
```

`unit` usa vault temporário e cobre parser, validação, deduplicação, auditoria, traversal, symlink, escrita atômica, backup, restore, corrupção e vault indisponível. `security` sobe servidor isolado e testa tokens, perfis, CORS/CSP, SSRF, XSS como dado, payloads inválidos/grandes, proxy, shell e filesystem.

Os testes Work e smoke exigem uma instância previamente iniciada e tokens/vault de teste no ambiente. Nunca aponte testes de backup/restore para vault pessoal. `performance` usa diretório temporário e mede 300 registros.
