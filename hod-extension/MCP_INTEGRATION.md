# MCP local

O servidor MCP usa `stdio`, não expõe HTTP adicional e nunca lê o vault diretamente. Configure `HOD_MCP_TOKEN` com token exclusivo; o backend identifica operações como `MCP` na auditoria.

Ferramentas: `hod_get_context`, `hod_get_daily_routine`, `hod_get_weekly_routine` e `hod_execute_action`. A última aceita somente a allowlist Work existente.

Copie `mcp/hod-mcp.example.json` para a configuração do seu cliente e substitua o caminho absoluto e o token fora do Git. Teste com `npm run test:mcp`.
