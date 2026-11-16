# Obsidian Vault Structure (HOD)

## Expected Folder Layout inside the Vault

```text
<VaultRoot>/
├── Candidaturas/          # Processos seletivos (hod_type: "application")
├── Tarefas/               # Tarefas (hod_type: "task")
├── Guidelines/            # Manuais e materiais de estudo (hod_type: "guideline")
├── Rotina/                # Blocos de horário diários (hod_type: "routine")
└── .hod/
    ├── index.json         # CACHE DERIVADO — NUNCA edite diretamente!
    ├── tombstones.json    # IDs excluídos para evitar ressurreição
    ├── bag.json           # Listas auxiliares: { emails: [], calendarEvents: [], driveFiles: [] }
    └── trash/             # Backup automático de notas .md excluídas
```

## Frontmatter YAML Schemas (Fonte de Verdade)

### 1. Candidatura (`Candidaturas/<Empresa> — <Funcao>.md`, `type: "application"`)

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

**Valid enums**:
- `stage`: `mapeada` | `aplicada` | `triagem` | `teste` | `entrevista` | `oferta` | `contratada` | `encerrada`
- `priority`: `urgente` | `importante` | `normal` | `baixa`
- `steps[].status`: `todo` | `doing` | `done`

### 2. Tarefa (`Tarefas/<Titulo>.md`, `type: "task"`)

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

**Valid enums**:
- `status`: `todo` | `doing` | `done`

### 3. Guideline (`Guidelines/<Titulo>.md`, `type: "guideline"`)

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

Todo o conteúdo Markdown escrito abaixo do frontmatter nas notas de `Guidelines/` é **autoritativo** e preservado integralmente pelo servidor e pela interface.
```

### 4. Bloco de Rotina (`Rotina/<Horario> — <Label>.md`, `type: "routine"`)

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