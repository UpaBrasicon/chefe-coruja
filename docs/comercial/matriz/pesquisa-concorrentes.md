# Pesquisa de concorrentes — matriz competitiva (uso interno)

- **Data de acesso de todas as fontes:** 08/10/2026
- **Escopo:** MV (Soul MV), Philips/Bionexo Tasy (Tasy EMR), TOTVS Saúde Hospitais e Clínicas (linha RM / "RM Saúde"), SisHOSP.
- **Legenda de status:**
  - **sim**: há documentação pública.
  - **parcial**: a evidência é indireta, incompleta, antiga ou só cita o nome do módulo.
  - **não encontrado**: não achamos evidência pública. Isso **não** quer dizer que o produto não tenha o recurso.
- **Regra de fonte:** usamos página, folder ou documentação do próprio fornecedor sempre que possível. Fontes secundárias (imprensa, conteúdo patrocinado) aparecem marcadas como **[secundária]**. As citações estão abreviadas ou parafraseadas e têm menos de 15 palavras.

---

## Visão consolidada

| Critério | MV (Soul MV) | Tasy | TOTVS RM Saúde | SisHOSP |
|---|---|---|---|---|
| Recepção/cadastro | parcial | sim | sim | sim |
| Classificação de risco | sim | sim (Manchester) | sim | sim |
| PEP de pronto-socorro | sim | sim | parcial | sim |
| Prescrição eletrônica | sim | sim | sim | sim |
| Checagem beira-leito | sim | sim | parcial | sim |
| Observação/internação/leitos | parcial | sim | sim | sim |
| Painéis/BI em tempo real | sim | parcial | parcial | sim |
| Tempos de espera da porta | não encontrado | não encontrado | parcial | parcial |
| Exportação de dados | parcial | não encontrado | não encontrado | parcial |
| MFA | não encontrado | sim | não encontrado | não encontrado |
| Trilha de auditoria | parcial | parcial | sim | parcial |
| Nuvem no Brasil | parcial | parcial | parcial | parcial |
| LGPD | sim | sim | sim | não encontrado |
| SBIS/CFM | sim (NGS2) | sim (NGS2) | não encontrado | não encontrado |
| Faturamento SUS | não encontrado | parcial | sim | sim |
| TISS | sim | não encontrado | sim | sim |
| RNDS | não encontrado | não encontrado | não encontrado | não encontrado |
| Assinatura ICP-Brasil | parcial | sim | parcial | sim |
| Regulação de vagas | parcial | não encontrado | parcial | não encontrado |
| Atenção básica/UBS | sim | parcial | não encontrado | não encontrado |
| Lab/PACS (HL7/FHIR) | parcial | sim (HL7) | parcial | parcial |

Achado transversal: **nenhum dos quatro tem evidência pública de integração com a RNDS**. Só o Tasy cita MFA publicamente.

---

## 1. MV — Soul MV (MV Sistemas)

- **Site:** https://mv.com.br
- **Mercado-alvo:** hospitais de médio e grande porte, redes, operadoras e gestão pública (municipal e estadual). O portfólio cobre do hospital à secretaria de saúde. Uma notícia antiga cita um ERP da MV para hospitais de até 70 leitos **[secundária]** (https://www.baguete.com.br/noticias/mv-erp-para-hospitais-de-ate-70-leitos).
- **Implantação:** hospedagem própria do cliente ou nuvem por meio do "Cloud Broker MV". A página não informa a localização do data center.
- **Preço:** não é público.

| Critério | Status | Evidência (curta) | URL |
|---|---|---|---|
| Recepção/cadastro de paciente | parcial | Produto "Recepção Digital" aparece no menu; página não lida. Assistencial "registra informações completas" do paciente | https://mv.com.br/produto/assistencial |
| Classificação de risco | sim | "Categoriza o nível de urgência do atendimento do paciente." Protocolo não nomeado | https://mv.com.br/produto/assistencial |
| PEP de pronto-socorro | sim | Certificado SBIS nº 153: SOUL MV, "PEP / Pronto Atendimento", NGS2 | https://sbis.org.br/wp-content/uploads/2024/10/Certificado_SBIS_SRES_153_MV.pdf |
| Prescrição eletrônica | sim | Controle de interações medicamentosas na prescrição (PEP) | https://mv.com.br/produto/pep1 |
| Checagem de enfermagem/beira-leito | sim | Case do fornecedor: módulo Beira Leito na prescrição e administração de fármacos | https://www.mv.com.br/storage/blog/Case%20Hospital%20Luxemburgo-1667221195.pdf |
| Observação/internação e leitos | parcial | "Realiza relatórios de censo ocupacional". Mapa de leitos não descrito; há certificado SBIS para Internação (nº 154) | https://mv.com.br/produto/assistencial |
| Painéis/BI em tempo real | sim | Go Dash: "Monitore, em tempo real, os processos e desempenho" | https://mv.com.br/produto/go-dash |
| Tempos de espera da porta | não encontrado | — | — |
| Exportação de dados | parcial | Go Dash "possibilita o download em várias visões" | https://mv.com.br/produto/go-dash |
| MFA | não encontrado | — | — |
| Trilha de auditoria | parcial | Deduzida do NGS2 (o manual SBIS exige auditoria), sem página própria | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |
| Nuvem no Brasil | parcial | Cloud Broker: "todos os recursos para o funcionamento da Cloud". Local não informado | https://mv.com.br/produto/cloud-broker-mv |
| Adequação LGPD | sim | Oferta de programa: "Esteja em conformidade com a LGPD" | https://mv.com.br/produto/lgpd |
| Certificação SBIS/CFM | sim | SOUL MV SMA-PEP.2020, NGS2, estágio 2, certificados 151–154. **Validade até 23/10/2026** | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |
| Faturamento SUS (AIH/BPA/APAC) | não encontrado | A página de faturamento não cita SUS. A MV comprou a Hospidata (AIH/APAC), que segue como operação independente **[secundária]** | https://www.baguete.com.br/noticias/mv-adquire-grupo-hospidata |
| Faturamento TISS | sim | "Registra dados no padrão TISS"; controle de glosas | https://mv.com.br/produto/faturamento |
| Integração RNDS | não encontrado | — | — |
| Assinatura digital ICP-Brasil | parcial | O NGS2 exige assinatura com certificado ICP-Brasil. Página própria só de "Assinatura Biométrica" | https://sbis.org.br/wp-content/uploads/2024/10/Certificado_SBIS_SRES_153_MV.pdf |
| Regulação de vagas | parcial | Gestão Estadual: "controle de urgências, internações, consultas" (produto público, fora do hospitalar) | https://mv.com.br/produto/gestao-estadual |
| Atenção básica/UBS | sim | Gestão Municipal "conecta as unidades básicas"; integra e-SUS | https://mv.com.br/produto/gestao-municipal |
| Laboratório/PACS (HL7/FHIR) | parcial | Produtos PACS, RIS e Anatomia Patológica no portfólio. HL7/FHIR não citado | https://mv.com.br/produto/pacs |

---

## 2. Philips Tasy EMR — atualmente **Bionexo Tasy**

- **Propriedade:** a Bionexo concluiu a compra do Tasy (Tucano do Brasil) em maio de 2026, após aprovação do CADE **[secundária]** (https://portalerp.com/br/noticia/bionexo-conclui-aquisicao-do-tasy-e-lanca-a-bionexo-tasy-plataforma-integrada-que-conecta-o-ecossistema-de-saude-na-america-latina). Os folders citados abaixo ainda são da Philips.
- **Mercado-alvo:** "de pequenas clínicas a grandes hospitais e redes", com mais de 990 instituições (folder de 2019). Na prática, o Tasy é forte em hospitais privados de grande porte e acreditados (HIMSS 6/7).
- **Implantação:** web, "pronto para nuvem" / "disponível como solução em nuvem". O certificado SBIS registra Oracle DB 19c com Oracle Linux. A Bionexo opera em SaaS **[secundária]**. Localização da nuvem não informada.
- **Preço:** não é público.

| Critério | Status | Evidência (curta) | URL |
|---|---|---|---|
| Recepção/cadastro de paciente | sim | "Cadastro de pacientes" entre os módulos de operações | https://www.philips.com/c-dam/b2bhc/br/marketing/tasy_saiba.pdf |
| Classificação de risco | sim | Infográfico Tasy HTML5 lista "Protocolo de Manchester" | https://www.philips.com/c-dam/b2bhc/br/marketing/infografia_html5__pt_.pdf |
| PEP de pronto-socorro | sim | Certificado SBIS nº 193: Tasy HTML5, PEP / Pronto Atendimento, NGS2 (até 20/05/2028) | https://sbis.org.br/wp-content/uploads/2026/05/193.pdf |
| Prescrição eletrônica | sim | CPOE com alertas de interação e alergia | https://www.philips.com/c-dam/b2bhc/br/marketing/tasy_saiba.pdf |
| Checagem de enfermagem/beira-leito | sim | Medicação "desde a prescrição até a administração à beira do leito"; ADEP | https://www.philips.com/c-dam/b2bhc/br/marketing/tasy_saiba.pdf |
| Observação/internação e leitos | sim | "Gestão de leitos"; certificado SBIS para Internação (nº 192) | https://www.philips.com/c-dam/b2bhc/br/marketing/philips_tasy_emr_general_brochure.pdf |
| Painéis/BI em tempo real | parcial | "Painel de indicadores"; relatórios e KPIs. "Tempo real" não afirmado para BI | https://www.philips.com/c-dam/b2bhc/br/marketing/infografia_html5__pt_.pdf |
| Tempos de espera da porta | não encontrado | Uma revista da Philips de 2015 descreve metas de tempo do Manchester, mas não um indicador do sistema | — |
| Exportação de dados | não encontrado | — | — |
| MFA | sim | "Autenticação e autorização de dois fatores" (infográfico sem data) | https://www.philips.com/c-dam/b2bhc/br/marketing/infografia_html5__pt_.pdf |
| Trilha de auditoria | parcial | "Maior segurança da rastreabilidade das informações"; NGS2 | https://www.philips.com/c-dam/b2bhc/br/marketing/infografia_html5__pt_.pdf |
| Nuvem no Brasil | parcial | "Disponível como uma solução em nuvem". Local não informado | https://www.philips.com/c-dam/b2bhc/br/marketing/philips_tasy_emr_general_brochure.pdf |
| Adequação LGPD | sim | Recursos de segurança "para suporte à conformidade" com GDPR e LGPD | https://www.philips.com/c-dam/b2bhc/br/marketing/tasy_saiba.pdf |
| Certificação SBIS/CFM | sim | NGS2, estágio 2, certificados 190–193 (consultório, clínica, internação, PA) | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |
| Faturamento SUS (AIH/BPA/APAC) | parcial | Case do fornecedor cita AIH no Hospital Bruno Born. Lido só via resumo de busca | https://www.philips.com/c-dam/b2bhc/br/articles/health-systems/case-bruno-born.pdf |
| Faturamento TISS | não encontrado | Folder cita "Faturamento (ciclo de receitas)" sem mencionar TISS | https://www.philips.com/c-dam/b2bhc/br/marketing/tasy_saiba.pdf |
| Integração RNDS | não encontrado | — | — |
| Assinatura digital ICP-Brasil | sim | Certificado SBIS registra módulo de assinatura digital "E-VAL" (NGS2) | https://sbis.org.br/wp-content/uploads/2026/05/193.pdf |
| Regulação de vagas | não encontrado | — | — |
| Atenção básica/UBS | parcial | Infográfico lista "Atenção primária" e "Gestão Populacional" | https://www.philips.com/c-dam/b2bhc/br/marketing/infografia_html5__pt_.pdf |
| Laboratório/PACS (HL7/FHIR) | sim | "Interoperabilidade com poderosos recursos de interface HL7"; interface com PACS | https://www.philips.com/c-dam/b2bhc/br/marketing/tasy_saiba.pdf |

---

## 3. TOTVS Saúde — Hospitais e Clínicas (linha RM / "RM Saúde" / "TOTVS Gestão Hospitalar")

- **Site:** https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/. Documentação pública no TDN (tdn.totvs.com, espaço "Linha RM").
- **Mercado-alvo:** hospitais e clínicas de pequeno a médio porte. A página diz "Mais de 650 clientes no segmento". A força da TOTVS em saúde está em operadoras e cooperativas (linhas Protheus/Datasul), que não entram nesta comparação.
- **Implantação:** ERP da linha RM em hospedagem do cliente ou TOTVS Cloud. A página de saúde fala em "tecnologia em nuvem" e LGPD, mas no contexto de operadoras. A página do produto hospitalar não afirma SaaS.
- **Preço:** não é público. Gestão de Custos e a ficha da Anestech são "comercializado à parte".

| Critério | Status | Evidência (curta) | URL |
|---|---|---|---|
| Recepção/cadastro de paciente | sim | Agendamento, "cadastrando os dados dos pacientes e otimizando o processo de triagem" | https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/ |
| Classificação de risco | sim | Painel de Classificação de Risco para "o enfermeiro do Pronto Atendimento". Manchester não nomeado | https://tdn.totvs.com/pages/viewpage.action?pageId=513433288 |
| PEP de pronto-socorro | parcial | PEP genérico ("prontuário eletrônico") e fluxo de PA no TDN; sem certificação SBIS na lista atual | https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/ |
| Prescrição eletrônica | sim | "Melhore os controles de prescrição, dispensação" | https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/ |
| Checagem de enfermagem/beira-leito | parcial | O TDN cita "checagem beira leito" com código de barras no PEP 2.0 (Soluções Saúde, 2019). Na RM, só "cuidados de enfermagem" | https://tdn.totvs.com/pages/viewpage.action?pageId=510513042 |
| Observação/internação e leitos | sim | "Mapa de Ocupação de Leitos": cada card mostra leito e situação | https://tdn.totvs.com/pages/viewpage.action?pageId=864328740 |
| Painéis/BI em tempo real | parcial | Analytics com indicadores "relativos a tempo de atendimento". "Tempo real" não afirmado | https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/ |
| Tempos de espera da porta | parcial | Indicadores de tempo de atendimento; painel de chamadas de senhas | https://tdn.totvs.com/display/LRM/Painel+de+Chamadas+Novo |
| Exportação de dados | não encontrado | — | — |
| MFA | não encontrado | O TDN mostra MFA em outros produtos TOTVS (Agro etc.), não na RM Saúde | — |
| Trilha de auditoria | sim | Log de auditoria do framework RM grava autor e valores alterados (página de 2017) | https://tdn.totvs.com/display/LRM/Log+de+Auditoria |
| Nuvem no Brasil | parcial | TOTVS tem "tecnologia em nuvem" (citada para operadoras). Local não informado | https://www.totvs.com/saude/ |
| Adequação LGPD | sim | "Tecnologia 100% em compliance com a Lei Geral de Proteção de Dados" | https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/ |
| Certificação SBIS/CFM | não encontrado | Nenhum produto TOTVS na lista de sistemas certificados da SBIS (consulta de 08/10/2026) | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |
| Faturamento SUS (AIH/BPA/APAC) | sim | Páginas do TDN para AIH, BPA e APAC (Faturamento SUS – Linha RM Saúde) | https://tdn.totvs.com/pages/viewpage.action?pageId=633055318 |
| Faturamento TISS | sim | TISS 4.02.00 disponível nas versões 12.1.2502 a 12.1.2510 | https://tdn.totvs.com/pages/releaseview.action?pageId=630840982 |
| Integração RNDS | não encontrado | A busca no TDN por "RNDS" não trouxe página pública da RM Saúde (havia uma página "Sumário de Alta" restrita) | — |
| Assinatura digital ICP-Brasil | parcial | Nota técnica sobre "mensagem da Assinatura Digital" nos impressos (Soluções Saúde). ICP-Brasil não explícito | https://tdn.totvs.com/display/SaudePiloto/DT+-+Apresentar+nos+Impressos+a+mensagem+da+Assinatura+Digital |
| Regulação de vagas | parcial | "Integração com sistema Cross" (Central de regulação de SP): registro de internação e alta | https://tdn.totvs.com/pages/viewpage.action?pageId=856445228 |
| Atenção básica/UBS | não encontrado | — | — |
| Laboratório/PACS (HL7/FHIR) | parcial | Unidade de Diagnóstico e Central de Laudos; o TDN cita "Integração com PACS". HL7/FHIR não citado | https://tdn.totvs.com/pages/viewpage.action?pageId=370608208 |

---

## 4. SisHOSP

- **Produto identificado:** **SisHOSP CORE**, da SisHOSP (Campinas/SP, fundada em 1987). Site: https://sishosp.com.br/hospitais/
- **Homônimos descartados:**
  - **SIHOSP**, Sistema de Indicadores Hospitalares da ANS (não é software de gestão).
  - **SIS-HOS**, da JME (RS), citado só em notícia antiga **[secundária]**.
  - **portal.sishosp.com.br**, que parece ser uma linha da mesma empresa voltada a reabilitação/APAEs e não foi analisado.
- **Mercado-alvo:** hospitais de pequeno e médio porte, inclusive filantrópicos e públicos que atendem o SUS, além de clínicas, ILPIs e psiquiátricas. A empresa diz ter "mais de 100 instituições atendidas". Clientes citados: Hospital Geral de Paragominas, Santa Casa de Ipuã, Hospital Mário Gatti (Unacon).
- **Implantação:** hospedagem própria do cliente (espelhamento de banco, backup na nuvem) ou "SisHOSP na Nuvem", com banco gerido pela empresa.
- **Preço:** não é público. O site anuncia "PROPOSTA comercial detalhada com preços" após diagnóstico (https://sishosp.com.br/como-comprar/).
- **Concorrente mais próximo do Chefe Coruja em porte.** Observação: segundo o site, o prontuário "exibe a classificação de risco do paciente em função das respostas" em fluxogramas validados pela enfermagem. O sistema calcula a cor, o que diverge da regra do Chefe Coruja de não sugerir cor.

| Critério | Status | Evidência (curta) | URL |
|---|---|---|---|
| Recepção/cadastro de paciente | sim | "a RECEPÇÃO atende o PACIENTE e faz o seu cadastro"; totem e chamada por TV | https://sishosp.com.br/hospitais/ |
| Classificação de risco | sim | Triagem com fluxogramas da enfermagem; exibe a classificação. Protocolo não nomeado | https://sishosp.com.br/hospitais/ |
| PEP de pronto-socorro | sim | "Prontuário Eletrônico do Paciente de Pronto-Socorro ou Pronto-Atendimento" | https://sishosp.com.br/hospitais/ |
| Prescrição eletrônica | sim | "alertas, críticas e bloqueios na prescrição de medicamentos"; integração Memed | https://sishosp.com.br/hospitais/ |
| Checagem de enfermagem/beira-leito | sim | "Checagem Beira Leito": lê o código de barras da pulseira e valida a medicação | https://sishosp.com.br/hospitais/ |
| Observação/internação e leitos | sim | "controla pacientes em observação"; "exata ocupação e disponibilidade de leitos" | https://sishosp.com.br/hospitais/ |
| Painéis/BI em tempo real | sim | Integração Power BI com "mais de 15 dashboards"; app Checkpoint | https://sishosp.com.br/wp-content/uploads/2024/07/SisHOSP-Institucional-2024.pdf |
| Tempos de espera da porta | parcial | Profissional "acompanha quem está em fila, o tempo de espera" (ambulatório) | https://sishosp.com.br/hospitais/ |
| Exportação de dados | parcial | Só a integração com Power BI; exportação genérica não descrita | https://sishosp.com.br/wp-content/uploads/2024/07/SisHOSP-Institucional-2024.pdf |
| MFA | não encontrado | — | — |
| Trilha de auditoria | parcial | "todas as ações ... ficam permanentemente registradas"; registra quem administrou | https://sishosp.com.br/hospitais/ |
| Nuvem no Brasil | parcial | "SisHOSP na Nuvem" com banco gerido pela empresa. Local não informado | https://sishosp.com.br/hospitais/ |
| Adequação LGPD | não encontrado | — | — |
| Certificação SBIS/CFM | não encontrado | Não consta na lista SBIS atual. Uma alegação de "SBIS-CFM edição 2016" apareceu só em resumo de busca, sem confirmação | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |
| Faturamento SUS (AIH/BPA/APAC) | sim | Módulos "SUS AIH" e "SUS Ambulatório – BPA e APAC"; gera CIHA 2.0 | https://sishosp.com.br/hospitais/ |
| Faturamento TISS | sim | "padrões recomendados pela ANS (TISS, TUSS e geração XML)" | https://sishosp.com.br/hospitais/ |
| Integração RNDS | não encontrado | — | — |
| Assinatura digital ICP-Brasil | sim | Certificado digital de autoridades "subordinadas à ICP Brasil" | https://sishosp.com.br/hospitais/ |
| Regulação de vagas | não encontrado | — | — |
| Atenção básica/UBS | não encontrado | — | — |
| Laboratório/PACS (HL7/FHIR) | parcial | "integração com sistemas laboratoriais e de imagem". HL7/FHIR não citado | https://sishosp.com.br/hospitais/ |

---

## Limitações da pesquisa

1. **"Não encontrado" não é "não tem".** Todos os fornecedores vendem por proposta e demonstração, e grande parte da funcionalidade fica em documentação fechada (portais de cliente, manuais). Antes de usar qualquer célula em material externo, confirme em demonstração ou edital.
2. **Fontes datadas.** O folder "Saiba" do Tasy é de 2019. O infográfico HTML5 (Manchester, dois fatores) não tem data. A página de log de auditoria da RM é de 2017. A nota de checagem beira-leito da TOTVS é de 2019 e de outra linha ("Soluções Saúde"/PEP 2.0), não necessariamente da RM.
3. **Inferências declaradas.** Nas linhas de auditoria e assinatura ICP-Brasil de MV e Tasy, parte da evidência vem da certificação SBIS NGS2, cujo manual exige esses controles. Não há página própria do fornecedor sobre o tema.
4. **Certificação SBIS.** Consultamos a lista oficial em 08/10/2026. Os certificados da MV vencem em **23/10/2026**; renovação ou extensão pode ocorrer depois desta data. TOTVS e SisHOSP não aparecem na lista; podem ter tido certificados antigos, já vencidos, que a lista atual não mostra.
5. **Tasy em transição societária.** O produto passou da Philips para a Bionexo (maio/2026). Os folders públicos ainda são da Philips, e não encontramos página de produto da Bionexo Tasy. Oferta, nuvem e preço podem mudar.
6. **Leituras incompletas.**
   - Algumas páginas da MV (Recepção Digital, PACS) foram vistas só pelo menu.
   - O case Bruno Born (Tasy/AIH) foi lido só por resumo de busca.
   - O folder geral do Tasy de 2025 tem texto parcialmente corrompido na extração.
   - O site totvs.com bloqueia o leitor automático; extraímos o texto do HTML bruto.
7. **Ninguém declara a localização da nuvem.** Nenhum fornecedor informa publicamente a região do data center. Por isso "nuvem no Brasil" ficou como "parcial" para todos.
8. **Tempos de espera da porta e exportação de dados** quase não aparecem publicamente em nenhum dos quatro. São possíveis diferenciais do Chefe Coruja, mas é preciso confirmar em demonstração dos concorrentes.
9. **RNDS:** não achamos evidência pública para nenhum dos quatro. A busca no TDN retornou uma página restrita ("Sumário de Alta"), o que sugere trabalho em andamento na TOTVS, mas sem confirmação.
10. **Preço:** nenhum dos quatro publica preço.


---

# Atualização de 15/11/2026

Decisões do RT M1–M4 = A (`docs/comercial/MATRIZ-DIAGNOSTICO.md`). Pesquisa feita por um agente só em fontes públicas, sem login e sem formulário, com acesso em 15/11/2026. As células da SBIS e do SisHOSP foram conferidas de novo antes de entrar.

**O que entrou:**
- critérios novos: IA clínica, IA que cita a fonte, ferramentas/escores/protocolos, interações medicamentosas, alta vigilância e funcionamento sem conexão;
- nova pesquisa em regulação, atenção básica e faturamento SUS;
- a situação dos certificados SBIS;
- o e-SUS APS (PEC) como quinto comparativo.

As demais células seguem com o acesso de 08/10/2026 (seções acima). No e-SUS APS elas aparecem como "n/p" (não pesquisado).

## Consolidado (status)

| Critério | MV | Tasy | TOTVS RM | SisHOSP | e-SUS APS |
|---|---|---|---|---|---|
| Regulação | sim | parcial | parcial | parcial | parcial |
| Atenção básica | parcial | parcial | parcial | parcial | sim |
| Faturamento SUS | parcial (2017) | parcial | sim | sim | parcial (2014) |
| IA clínica | sim | não encontrado | parcial | sim | parcial |
| IA cita fonte | não encontrado | não encontrado | não encontrado | não encontrado | não encontrado |
| Ferramentas/escores/protocolos | parcial | parcial | sim | parcial | sim |
| Interações | sim | sim | parcial | sim | não encontrado |
| Alta vigilância | não encontrado | não encontrado | não encontrado | não encontrado | não encontrado |
| Sem conexão | parcial | não encontrado | não encontrado | parcial | parcial |
| SBIS vigente | sim (até 10/12/2026) | sim (até 20/05/2028) | não consta | não consta | não consta |

## Evidência por concorrente

### MV — Soul MV
| Critério | Status | Evidência curta | URL |
|---|---|---|---|
| Regulação | sim | "regulação de todos os leitos da rede"; módulo "Controle de regulação" (urgências, internações, consultas) | https://mv.com.br/solucao/soul-mv-saude-publica · https://mv.com.br/produto/gestao-estadual · https://mv.com.br/produto/gestao-municipal |
| Atenção básica | parcial | "conecte as unidades básicas"; agenda; app ACS; sem Hiperdia, pré-natal ou puericultura | https://mv.com.br/produto/gestao-municipal |
| Faturamento SUS | parcial | Manual de 2017 cita BPA, APAC e AIH; a página atual só fala de TISS/TUSS | https://app.wiki.saude.es.gov.br/mvsoul/manual_banco_sangue_v1.0.292.pdf · https://mv.com.br/produto/faturamento |
| IA clínica | sim | med.ai: "decisões mais precisas e diagnósticos mais assertivos" | https://mv.com.br/solucao/medai |
| IA cita fonte | não encontrado | — | https://mv.com.br/solucao/medai |
| Ferramentas/protocolos | parcial | "Protocolos assistenciais automatizados"; escores não aparecem | https://mv.com.br/produto/pep |
| Interações | sim | "controle de interações medicamentosas" | https://mv.com.br/produto/pep |
| Alta vigilância | não encontrado | — | https://mv.com.br/produto/pep |
| Sem conexão | parcial | só o app ACS funciona "sem precisar de conexão com a internet" | https://mv.com.br/solucao/soul-mv-saude-publica |
| SBIS | sim | SOUL MV SMA-PEP.2020, 4 modalidades, NGS2, emitido em 23/10/2024, validade atual 10/12/2026 (estendida, sem certificado novo) | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |

### Tasy — Bionexo Tasy
| Critério | Status | Evidência curta | URL |
|---|---|---|---|
| Regulação | parcial | "gestão de leitos e agendamentos"; case de 2020 integrado ao GERINT de Porto Alegre | https://bionexo.com/tasy-hospitais/ |
| Atenção básica | parcial | FAQ "funciona para UBS e ambulatórios do SUS?"; hipertensão e diabetes | https://bionexo.com/tasy-atencao-primaria/ |
| Faturamento SUS | parcial | cases citam atendimentos SUS; AIH, BPA e APAC não aparecem | https://bionexo.com/tasy-hospitais/ |
| IA clínica | não encontrado | a LIA é IA de compras e receita | https://bionexo.com/lia/ |
| IA cita fonte | não encontrado | — | https://bionexo.com/lia/ |
| Ferramentas/protocolos | parcial | "Protocolos gerenciados, alertas de alergia" | https://bionexo.com/tasy/ |
| Interações | sim | "alertas de interação medicamentosa e dosagem assistida" | https://bionexo.com/tasy/ |
| Alta vigilância | não encontrado | — | https://bionexo.com/tasy/ |
| Sem conexão | não encontrado | só "acessível de qualquer dispositivo com navegador" | https://bionexo.com/tasy/ |
| SBIS | sim | Tasy HTML5 5.04.1845 (Tucano do Brasil), 4 modalidades, NGS2, emitido em 20/05/2026, validade 20/05/2028 | https://sbis.org.br/certificacoes/certificacao-software/sistemas-certificados/ |

### TOTVS Saúde Hospitais e Clínicas (Linha RM)
| Critério | Status | Evidência curta | URL |
|---|---|---|---|
| Regulação | parcial | só gestão interna de leitos ("alocação e reservas de leitos") | https://produtos.totvs.com/ficha-tecnica/tudo-sobre-o-totvs-saude-hospitais-e-clinicas/ |
| Atenção básica | parcial | só agendamento de consultas e exames | https://www.totvs.com/saude/hospitais-e-clinicas-linha-rm/ |
| Faturamento SUS | sim | "Automação no Faturamento de Guias do SUS"; "Elaboração de AIH" no TDN | https://produtos.totvs.com/hospitais-e-clinicas/totvs-saude-hospitais-e-clinicas-12-1-2606/ · https://tdn.totvs.com/x/3OKmHQ |
| IA clínica | parcial | DTA Voice "interpreta esse áudio para preencher a anamnese" (documentação, não decisão) | ficha técnica (acima) |
| IA cita fonte | não encontrado | — | — |
| Ferramentas/protocolos | sim | PEP com "Protocolos Clínicos" e "Scores" | ficha técnica (acima) |
| Interações | parcial | alergias e análise farmacêutica; interações não citadas | ficha técnica (acima) |
| Alta vigilância | não encontrado | — | — |
| Sem conexão | não encontrado | — | — |
| SBIS | não consta | — | lista SBIS |

### SisHOSP CORE
| Critério | Status | Evidência curta | URL |
|---|---|---|---|
| Regulação | parcial | "ocupação e disponibilidade de leitos"; transferências são da agenda | https://sishosp.com.br/hospitais/ |
| Atenção básica | parcial | só "agenda de consultas e exames" | https://sishosp.com.br/hospitais/ |
| Faturamento SUS | sim | "SUS AIH" e "SUS Ambulatório – BPA e APAC" (conferido em 15/11) | https://sishosp.com.br/hospitais/ |
| IA clínica | sim | "Com Inteligência Artificial, a SARA acompanha a consulta" (conferido) | https://sishosp.com.br/hospitais/ |
| IA cita fonte | não encontrado | — | https://sishosp.com.br/hospitais/ |
| Ferramentas/protocolos | parcial | "disponibiliza o uso de protocolos"; sem escores clínicos | https://sishosp.com.br/hospitais/ |
| Interações | sim | "mais de 1.000 interações medicamentosas" (conferido) | https://sishosp.com.br/hospitais/ |
| Alta vigilância | não encontrado | — | https://sishosp.com.br/hospitais/ |
| Sem conexão | parcial | contingência por servidor espelho, não modo offline | https://sishosp.com.br/hospitais/ |
| SBIS | não consta | — | lista SBIS |

### e-SUS APS (PEC)
| Critério | Status | Evidência curta | URL |
|---|---|---|---|
| Regulação | parcial | "Garantia do acesso" e cuidado compartilhado; o MS tem um "e-SUS Regulação" à parte | https://sisaps.saude.gov.br/esus/ |
| Atenção básica | sim | pré-natal programado; listas nominais de diabetes e hipertensão | https://sisaps.saude.gov.br/esus/ |
| Faturamento SUS | parcial | produção ao SISAB/SIAPS; "Exportar BPA" numa nota de 2014 | https://saude.rs.gov.br/upload/arquivos/201702/06150820-nota-tecnica-processo-de-implantacao-do-e-sus-ab-outubro-2014.pdf |
| IA clínica | parcial | suporte à decisão clínica da dengue, por regras (NT 280/2025) | gov.br/saude, Nota Técnica Conjunta nº 280/2025 |
| IA cita fonte | não encontrado | — | — |
| Ferramentas/protocolos | sim | classificação da dengue em grupos A–D; "Incorporação da TRIA" (5.2) | https://sisaps.saude.gov.br/esus/ |
| Interações | não encontrado | alergias e prescrição digital, sem alerta de interação | https://sisaps.saude.gov.br/esus/ |
| Alta vigilância | não encontrado | — | — |
| Sem conexão | parcial | o app de vacinação "foi criado para funcionar offline" | https://sisaps.saude.gov.br/esus/ |
| SBIS | não consta | — | lista SBIS |

## Achados

- **Tasy:** hoje é Bionexo Tasy. A aquisição foi anunciada em 30/12/2025 e concluída em 2026, segundo a imprensa [secundária]. Na SBIS, o desenvolvedor aparece como "Tucano do Brasil Sistemas de Informacao Ltda.".
- **SBIS da MV:** o certificado de 23/10/2024 teve a validade estendida até 10/12/2026, sem certificado novo. Outros certificados antigos tiveram a mesma extensão. Acompanhar depois de 10/12/2026.
- **SBIS do Tasy:** certificado novo, emitido em 20/05/2026, válido até 20/05/2028.
- **TOTVS, SisHOSP e e-SUS PEC** não aparecem na lista da SBIS.
- **Páginas que não abriram:** o índice do wiki da SESA-ES (403), o manual do e-SUS APS no GitHub (404) e algumas páginas da TOTVS no leitor web (lidas por download da página).
