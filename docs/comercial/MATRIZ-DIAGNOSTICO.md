# Backlog comercial, item 7: matriz competitiva — diagnóstico da atualização

**Pedido.** Em 15/11/2026, com a one-page aprovada (item 2), o RT pediu o próximo item ("Próximo item"). O item 7 diz: "Matriz competitiva — concorrentes; módulos; vantagens; lacunas; ataque comercial — atualizada após cada fase". A matriz é de 08/10/2026, e vieram as Fases 2 a 5.

**Escopo.** Só diagnóstico. Nada muda aqui.

## Como está hoje

A matriz de 08/10/2026 fica em `produto/docs/comercial/` (`matriz.tpl.html`, o PDF e `pesquisa-concorrentes.md`, fora do git).

- **Uso interno** (decisão do RT): nunca vai a cliente.
- **Concorrentes:** MV (Soul MV), Tasy (Philips → Bionexo), TOTVS RM Saúde e SisHOSP CORE.
- **21 critérios** em quatro grupos: clínico da porta, gestão e BI, segurança e LGPD, SUS/faturamento/integrações.
- **Cada célula tem fonte pública.** "Não encontrado" não quer dizer "não tem".
- **Página "Como ler a matriz":** onde ganhamos, onde perdemos e os cuidados.

## O que mudou na coluna do Chefe Coruja (fontes: BACKLOG e produção)

| Critério | Outubro | Hoje |
|---|---|---|
| Faturamento SUS (AIH, BPA, APAC) | em construção, só laudo de AIH | **tem:** contas, BPA, AIH, APAC e glosas. Falta importar o retorno do SIA/SIH, que espera o arquivo da secretaria |
| Regulação de vagas | em construção | **tem:** Central, prioridade, prazo, alerta e mapa de vagas |
| Atenção básica (UBS) | em construção | **tem:** agenda, escuta, encaminhados, Hiperdia, pré-natal e puericultura |
| Checagem de enfermagem | tem, por horário | tem, com aprazamento e motivo de não feito |
| Integração RNDS | FHIR gerado, sem envio | segue sem envio: espera a unidade piloto e a credencial do DATASUS |
| Assinatura ICP-Brasil | em construção | segue em construção: a prova de conceito espera as credenciais da Valid |
| Faturamento de convênios (TISS) | não tem | segue sem: adiado até haver cliente de convênio |
| Certificação SBIS/CFM | não tem | segue sem |
| Laboratório e PACS | não tem | segue sem |

**Critérios novos** que o produto tem hoje e que outubro não media:
- IA clínica com fonte citada;
- ferramentas clínicas revistas e aprovadas pelo responsável técnico;
- interações medicamentosas e alta vigilância;
- funcionamento sem conexão.

## Decisões para o RT

**M1. Escopo da atualização.**
- **A (recomendada):**
  - atualizar a coluna do Chefe Coruja;
  - acrescentar os quatro critérios novos;
  - pesquisar os concorrentes de novo só onde isso muda a leitura: os critérios novos, a regulação, a UBS e o faturamento SUS, e se os certificados SBIS da MV, que venciam em 23/10/2026, foram renovados.
  - O resto fica como em outubro, com a data de acesso antiga marcada.
- **B:** refazer a pesquisa de todas as células.
- **C:** só a coluna do Chefe Coruja.

**M2. Concorrentes.**
- **A (recomendada):** manter os quatro e acrescentar o **e-SUS APS (PEC)**, o sistema gratuito do Ministério da Saúde. Ele é a comparação natural nos critérios da UBS.
- **B:** só os quatro.

**M3. Onde fica e como sai.**
- **A (recomendada):** fonte no repositório, em `docs/comercial/matriz/` (página HTML e pesquisa célula a célula), revisada por PR. O PDF é gerado e entregue a você e não vai para o git. Continua marcado "uso interno, não enviar a cliente".
- **B:** seguir em `produto/`, fora do git.

**M4. Pesquisa.**
- **A (recomendada):** um agente pesquisa só as fontes públicas dos fornecedores: site, documentação, lista de certificados da SBIS e o portal do e-SUS APS. Ele marca a data de acesso e a evidência curta de cada célula, sem login e sem formulário. Eu confiro cada célula antes de entrar.
- **B:** você indica as fontes.

**Decisão do RT, 15/11/2026:** M1 a M4 = A ("Todas A").

## Regras

- "Não encontrado" nunca vira "não tem".
- Nenhuma afirmação sobre concorrente sem fonte pública com data de acesso.
- Uso interno: a matriz não vai a cliente, e nenhum material de cliente cita marca de concorrente (decisão de outubro).

## Depois

Com a matriz atualizada, os materiais de outubro ficam em dia. Restam a proposta de piloto (item 5) e o roteiro de objeções (item 6), que usa a matriz.
