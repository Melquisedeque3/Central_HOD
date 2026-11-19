# Integração Obsidian

Abra `HOD_VAULT` como vault no Obsidian. O HOD lê e grava Markdown diretamente; nenhum plugin é necessário. Pastas estruturadas: `Candidaturas/`, `Tarefas/`, `Guidelines/`, `Rotina/` e `.hod/`. Documentos Work são limitados a diretórios HOD autorizados, incluindo `Insights/`.

O endpoint antigo `/api/obsidian/*` responde `410` deliberadamente. Isso evita um proxy genérico para o filesystem/REST do Obsidian. Para refletir edição manual, use reindexação. Symlinks que escapam o vault são rejeitados.
