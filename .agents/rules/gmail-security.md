# 🔒 REGRA RÍGIDA — SEGURANÇA E OPERAÇÃO DO GMAIL

## PROIBIÇÃO ABSOLUTA DE AÇÕES DESTRUTIVAS OU ENVIO NÃO AUTORIZADO
O assistente e todos os agentes do HOD estão **TERMINANTEMENTE PROIBIDOS** de:
1. **Enviar qualquer e-mail** (`gmail mutate send`, `gmail mutate reply` ou qualquer envio externo) sem solicitação direta e confirmação prévia explícita do usuário.
2. **Apagar ou excluir qualquer e-mail** (`gmail mutate delete`, `trash` ou qualquer ação destrutiva).
3. **Modificar o estado dos e-mails na nuvem** (arquivar, marcar como lido na nuvem ou remover marcadores) sem ordem explícita.

## MODO ESTRITAMENTE DE LEITURA (READ-ONLY)
- Toda integração com o Gmail opera **exclusivamente em modo de leitura** através do namespace `gmail readonly` (`search`, `get`, `read`).
- O coletor apenas copia os dados relevantes de texto para processamento local na pasta `vault/inbox/`.
- A caixa de entrada e os e-mails na conta Google do usuário permanecem 100% intactos e inalterados.
