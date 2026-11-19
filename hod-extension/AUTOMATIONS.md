# Automações locais

Estado atual: coleta automática e Gmail OAuth não implementados. Quando houver conector autorizado, `launchd` deve executar scripts locais independentes do agente de IA, com lock, timeout, backoff limitado, idempotência, histórico e modo manual. Nunca agendar execução concorrente sobre o mesmo registro.

Frequências iniciais propostas: oportunidades a cada 6 h, Gmail a cada 2 h, análise até duas vezes por dia somente para dados novos, resumo diário uma vez/dia e semanal na segunda às 09:00. Permanecem configuráveis e não são ativadas sem credenciais/autorização.
