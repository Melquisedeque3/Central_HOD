# Backup e restore

Ao iniciar, o HOD cria no máximo um backup diário. `ADMIN` pode listar e criar backups em `/api/backups`; manifestos possuem SHA-256 e a retenção padrão é 14. Configure `HOD_BACKUP_DIR` e `HOD_BACKUP_RETENTION` quando necessário.

Para restaurar, envie `POST /api/backups/:id/restore` com `{ "confirm": "RESTORE" }`. O digest é validado e uma cópia pré-restore é criada. Backup ausente, ID inválido ou digest divergente falham sem restaurar conteúdo adulterado.
