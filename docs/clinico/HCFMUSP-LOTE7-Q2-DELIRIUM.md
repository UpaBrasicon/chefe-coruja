# Revisão do HCFMUSP, lote 7, Q2: cap. 8 (delirium)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 7 inteiro. Pela Q2, o cap. 8 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **Geriatric ED Guidelines 2.0, delirium:** Lee et al., Acad Emerg Med 2025;33(2):e70167 (PMID 41146403; PMC12875304).
  - As seis recomendações GRADE estão inteiras no resumo, e o resumo foi lido.
  - Todas são condicionais, com certeza muito baixa.
- **Manual:** cap. 8 conferido no PDF, p. 130–134 (Tabelas 1 a 3 e exames).

## O que mudou na Central

- **Ficha `4at-delirium`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_DELIRIUM_2025`, com 6 temas e o manual ao lado;
  - na tela do 4AT, um bloco novo: "Diretrizes geriátricas de PS 2025 — ao lado do manual";
  - o cálculo do 4AT não mudou.
- **Nota `nota-hcfmusp-cap8-delirium`:** 6 itens.
- **Migration:** `20270414000043`.

## Onde a diretriz difere do manual

| Tema | GED 2.0 2025 | Manual |
|---|---|---|
| Quem rastrear | Delirium Risk Score para não rastrear todos; Zucchelli (> 65 anos em observação) e REDEEM (> 75) | fatores predisponentes e desencadeantes (Tabelas 1 e 2) |
| Diagnóstico | 4AT, bCAM, CAM-ICU, mCAM, AMT-4 ou RASS | CAM (Tabela 3) |
| DTS | só para afastar | não trata |
| TC de crânio | sem evidência para recomendar a favor ou contra | TC quando indicada para afastar outros diagnósticos |

## Antes e depois (14/11/2026)

A produção já tinha o texto aberto da GED 2.0 no acervo de artigos CC BY, e várias respostas já vinham por ele. Na homologação, a nota põe a diretriz e o manual lado a lado.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| qual escala no PS | 4AT, pela ficha | 4AT e REDEEM, com o manual |
| TC de crânio para todos | GED 2.0, pelo artigo aberto | GED 2.0 com o grau (condicional, muito baixa) |
| rastrear todo idoso | GED 2.0, pelo artigo aberto | igual, pela nota |
| DTS confirma? | GED 2.0, pelo artigo aberto | igual |
| critérios do CAM (controle) | manual | igual |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- O 4AT foi ingerido em 2 trechos e a nota em 7. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #724, 14/11/2026

- A migration `20270414000043` foi aplicada antes do merge. O #724 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As cinco respostas saíram como na homologação.
