# Coletores de oportunidades

O modelo `opportunity` persiste em `Oportunidades/` com fonte, empresa, cargo/projeto, URL, evidência, datas, status e prioridade. A entrada autorizada é `POST /api/opportunities`, protegida por `HOD_COLLECTOR_TOKEN`; o servidor gera ID determinístico quando necessário, valida e deduplica.

## Fonte implementada

`collectors/lever_collector.py` é o primeiro conector: lê somente a **Postings API pública do Lever** para o board `appen`, publicado como CrowdGen/Appen. A documentação do Lever define essa API para criar sites de vagas públicos; a página da CrowdGen/Appen confirma que o board é público. O coletor não usa login, CAPTCHA, scraping HTML nem aplica a vagas. Referências: [Lever Postings API](https://github.com/lever/postings-api) e [CrowdGen/Appen](https://jobs.lever.co/appen).

Por padrão ele só consulta e apresenta um resumo:

```bash
npm run collect:crowdgen
```

Para gravar na inbox, inicie o HOD com `HOD_COLLECTOR_TOKEN` e execute explicitamente:

```bash
HOD_COLLECTOR_TOKEN='token-exclusivo-do-coletor' npm run collect:crowdgen -- --commit
```

Duplicatas retornadas pelo HOD (`409`) são contabilizadas como tal, sem sobrescrever notas. Dados HTML externos são convertidos para texto simples antes do envio. As suítes locais são `npm run test:collectors` e `npm run test:collector-integration` (ingestão, deduplicação e auditoria em instância temporária).

O coletor mantém a verificação TLS ativa. Se o Python do macOS apresentar `CERTIFICATE_VERIFY_FAILED`, execute o instalador de certificados fornecido pela distribuição Python (normalmente `Install Certificates.command`) ou instale uma distribuição de Python que tenha o repositório de CAs configurado. Não use `--insecure` nem desative a validação de certificados.

OneForma, TELUS Digital, Outlier, Welocalize, Mercor e Mindrift continuam **INCONCLUSIVOS**: ainda requerem validação individual de uma API, RSS ou outro mecanismo autorizado. Não contornar CAPTCHA, login, limite ou bloqueio. Sem fonte autorizada, registrar a limitação e usar importação manual ou e-mail autorizado.
