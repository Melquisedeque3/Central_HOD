# Segurança

| Perfil | Capacidades |
|---|---|
| `WORK_READ` | Apenas `/work/context` e rotinas daily/weekly |
| `WORK_WRITE_LIMITED` | Leitura Work e allowlist de ações |
| `USER` | Estado e CRUD humano |
| `ADMIN` | Configuração, notas cruas, auditoria, backup/restore e integrações |

Tokens são variáveis de ambiente. Gere tokens aleatórios, armazene-os fora do repositório e reinicie o serviço ao rotacioná-los. A sessão do navegador é gerada em `.hod-auth.json`, com permissão `0600`; remover esse arquivo encerra sessões existentes.

Defesas: autorização em APIs sensíveis, CORS sem permissivo, CSP `self`, JSON limitado a 512 KiB, URLs de integração somente loopback, redação de segredos na auditoria, caminhos permitidos, resolução de symlinks e escrita atômica. Não exponha o serviço em rede pública.
