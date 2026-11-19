# Integração ChatGPT Work

Use bearer token no cabeçalho `Authorization`. `GET /work/context?period=daily|weekly` retorna somente pendências, prioridades, alertas e mudanças recentes. `GET /work/routines/daily|weekly` retorna o contexto do período.

`POST /work/actions` aceita somente `ADD_NOTE`, `UPDATE_STATUS`, `CREATE_TASK`, `UPDATE_PRIORITY`, `REGISTER_ANALYSIS` e `SCHEDULE_FOLLOWUP`.

Toda ação é validada, persistida em Markdown e auditada como `WORK`. Exclusão, shell, configuração, proxy, filesystem arbitrário e qualquer tipo não listado retornam erro. Work não acessa estado completo, CRUD genérico, backup, configuração ou notas cruas.
