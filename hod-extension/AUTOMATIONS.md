# Automações locais

O coletor CrowdGen/Appen pode ser executado manualmente; ele permanece em modo de prévia até receber `--commit`. Há um modelo não ativado em `launchd/com.centralhod.collector.example.plist` com intervalo de 6 horas. Copie-o para `~/Library/LaunchAgents/`, substitua `__HOD_ROOT__` e `__HOD_LOG_DIR__`, e forneça `HOD_COLLECTOR_TOKEN` fora do repositório (por exemplo, via `launchctl setenv` na sessão do usuário) antes de carregá-lo. O arquivo de exemplo nunca contém token.

Gmail OAuth e os demais conectores ainda não estão implementados. Quando houver conector autorizado, `launchd` deve executar scripts locais independentes do agente de IA, com lock, timeout, backoff limitado, idempotência, histórico e modo manual. Nunca agendar execução concorrente sobre o mesmo registro.

Frequências iniciais propostas: oportunidades a cada 6 h, Gmail a cada 2 h, análise até duas vezes por dia somente para dados novos, resumo diário uma vez/dia e semanal na segunda às 09:00. Permanecem configuráveis e não são ativadas sem credenciais/autorização.
