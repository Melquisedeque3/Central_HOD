# Automações locais

O coletor Lever pode ser executado manualmente; ele consulta exclusivamente CrowdGen/Appen, Welo/Welocalize e RWS e aplica o perfil geográfico/profissional do usuário antes de qualquer importação. Ele permanece em modo de prévia até receber `--commit`. Há um modelo não ativado em `launchd/com.centralhod.collector.example.plist` com intervalo de 6 horas. Copie-o para `~/Library/LaunchAgents/`, substitua `__HOD_ROOT__` e `__HOD_LOG_DIR__`, e forneça `HOD_COLLECTOR_TOKEN` fora do repositório (por exemplo, via `launchctl setenv` na sessão do usuário) antes de carregá-lo. O arquivo de exemplo nunca contém token.

Gmail OAuth ainda não está conectado. A base de processamento local recebe e-mails em `inbox/` e os classifica em `Correspondencias/`, sem enviar, apagar ou alterar e-mails. Quando a conta for autorizada por OAuth, o conector deve usar somente escopo de leitura, com lock, timeout, backoff limitado, idempotência, histórico e modo manual. Nunca agendar execução concorrente sobre o mesmo registro.

Frequências iniciais propostas: oportunidades a cada 6 h, Gmail a cada 2 h, análise até duas vezes por dia somente para dados novos, resumo diário uma vez/dia e semanal na segunda às 09:00. Permanecem configuráveis e não são ativadas sem credenciais/autorização.
