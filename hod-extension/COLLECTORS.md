# Coletores de oportunidades

O modelo `opportunity` persiste em `Oportunidades/` com fonte, empresa, cargo/projeto, URL, evidência, datas, status e prioridade. A entrada autorizada é `POST /api/opportunities`, protegida por `HOD_COLLECTOR_TOKEN`; o servidor gera ID determinístico quando necessário, valida e deduplica.

Ainda não há conector externo implementado. Antes de adicionar uma fonte (OneForma, TELUS Digital, CrowdGen, Outlier, Welocalize, Mercor ou Mindrift), confirmar API, RSS ou página pública cujo uso automatizado seja permitido. Não contornar CAPTCHA, login, limite ou bloqueio. Sem fonte autorizada, registrar como **INCONCLUSIVO** e oferecer importação manual/e-mail autorizado.
