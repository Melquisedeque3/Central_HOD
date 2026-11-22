# Coletores de oportunidades

O modelo `opportunity` persiste em `Oportunidades/` com fonte, empresa, cargo/projeto, URL, evidência, datas, status e prioridade. A entrada autorizada é `POST /api/opportunities`, protegida por `HOD_COLLECTOR_TOKEN`; o servidor gera ID determinístico quando necessário, valida e deduplica.

## Registro de fontes

`collectors/source_registry.json` é o inventário central e auditável: URL oficial, tipo de integração, autorização, frequência proposta, limites e estado operacional. Apenas fontes com `authorization: AUTORIZADO` e integração API/feed podem ficar `ativo`; as demais permanecem `manual` ou `inconclusivo`. O registro não transforma uma página tecnicamente acessível em fonte autorizada.

## Fonte implementada

`collectors/lever_collector.py` lê somente a **Postings API pública do Lever**. A allowlist versionada em `collectors/lever_sources.json` contém CrowdGen/Appen, Welo/Welocalize e RWS. O coletor não usa login, CAPTCHA, scraping HTML nem aplica a vagas. Referências: [Lever Postings API](https://github.com/lever/postings-api), [CrowdGen/Appen](https://jobs.lever.co/appen), [Welo](https://jobs.lever.co/weloglobal) e [RWS](https://jobs.lever.co/rws).

Por padrão ele só consulta e apresenta um resumo:

```bash
npm run collect:crowdgen
```

Para verificar todas as fontes autorizadas sem gravar dados:

```bash
npm run collect:lever
```

Para a pré-seleção conservadora do perfil atual (residência em Sergipe), use:

```bash
npm run collect:profile
```

O perfil `collectors/melquisedeque_profile.json` é estruturado e versionado. Ele não descarta casos ambíguos: classifica geografia e requisitos como `ELIGIBLE`, `INELIGIBLE` ou `INCONCLUSIVE`, com evidência. Uma vaga remota marcada apenas como `Brazil` é nacionalmente elegível na ausência de exclusão estadual; Brasília e “remoto mundial” não comprovam elegibilidade em Sergipe. `experienceKeywords` confirma aderência profissional somente quando o anúncio traz a mesma evidência. Importações com perfil exigem que a fila (`ELIGIBLE` ou `INCONCLUSIVE`) seja informada explicitamente.

Para gravar na inbox, inicie o HOD com `HOD_COLLECTOR_TOKEN` e execute explicitamente:

```bash
HOD_COLLECTOR_TOKEN='token-exclusivo-do-coletor' npm run collect:profile -- --commit --import-status ELIGIBLE
```

Duplicatas retornadas pelo HOD (`409`) são contabilizadas como tal, sem sobrescrever notas. Dados HTML externos são convertidos para texto simples antes do envio. As suítes locais são `npm run test:collectors`, `npm run test:source-registry`, `npm run test:eligibility` e `npm run test:collector-integration` (ingestão, deduplicação e auditoria em instância temporária).

O coletor mantém a verificação TLS ativa. Em instalações macOS cujo Python aponte para uma cadeia ausente, ele usa exclusivamente o bundle confiável do sistema em `/etc/ssl/cert.pem`, quando presente; hostname e certificado continuam obrigatórios. Se nenhum bundle estiver disponível, instale os certificados da distribuição Python. Não use `--insecure` nem desative a validação de certificados.

OneForma, Outlier, Mindrift, Turing, micro1, DataAnnotation, DataForce, Handshake, Meridial, Vetto e AfterQuery exigem validação individual de uma API, RSS ou outro mecanismo autorizado. Não contornar CAPTCHA, login, limite ou bloqueio. Sem fonte autorizada, registrar a limitação e usar importação manual ou e-mail autorizado.

Em 20/11/2026, a validação específica concluiu que **OpenTrain**, **Mercor** e **TELUS Digital** não entram em coleta automática: seus termos públicos vedam ou não autorizam a coleta/reprodução necessária. **Turing**, **DataAnnotation** e **DataForce** permanecem sem um canal programático explicitamente autorizado. Todas as seis entram na primeira varredura apenas como fontes de estado/manual (e, depois da configuração OAuth somente leitura, por alertas e mensagens recebidas), nunca por scraping. O detalhe auditável está em `collectors/source_registry.json`.
