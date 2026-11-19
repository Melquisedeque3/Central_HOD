# Central HOD

Central local-first para candidaturas, tarefas e rotina. A fonte de verdade é um vault Markdown compatível com Obsidian; o índice é derivado e reconstruível. Requer Node.js 20+ e não possui dependências externas.

## Início rápido

```bash
cd hod-extension
HOD_VAULT="/caminho/para/HOD" node server.mjs
```

Abra `http://127.0.0.1:8420/`. A primeira visita cria uma sessão local HttpOnly para a interface. Para automações, configure tokens no ambiente antes de iniciar:

```bash
HOD_ADMIN_TOKEN='...' HOD_USER_TOKEN='...' HOD_WORK_READ_TOKEN='...' HOD_WORK_WRITE_TOKEN='...' node server.mjs
```

Nunca versione tokens, `.hod-config.json`, `.hod-auth.json` ou o vault pessoal.

## Operação

- `npm run smoke` — regressão de CRUD e HTTP.
- `npm run test:unit` — validação, vault, auditoria, backup/restore e falhas.
- `npm run test:security` — autorização e superfícies de ataque em instância isolada.
- `npm run test:work-e2e` e `npm run test:work-restart` — contrato Work e persistência.
- `npm run test:performance` — medição local reproduzível com 300 registros temporários.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [WORK_INTEGRATION.md](WORK_INTEGRATION.md), [OBSIDIAN_INTEGRATION.md](OBSIDIAN_INTEGRATION.md), [BACKUP.md](BACKUP.md) e [TESTING.md](TESTING.md).

## Troubleshooting e limitações

- `401`: abra a raiz local para obter a sessão de navegador ou use o token do perfil correto.
- `410 /api/obsidian/*`: esperado; o proxy genérico foi removido. Use o vault Markdown diretamente.
- Backup/restore inválido: confira espaço e permissões do diretório de backup; não force restore com digest divergente.
- Hermes indisponível: a interface principal continua funcional; confirme o serviço loopback e o token Hermes separadamente.

O HOD é local e não fornece sincronização distribuída, bloqueio entre múltiplos processos nem recuperação de desastre fora do diretório de backup configurado. Não o exponha à internet.
