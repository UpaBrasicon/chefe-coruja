# Revisão do HCFMUSP, lote 8, Q2: cap. 9 (manejo da dor no PS)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 8 inteiro. Pela Q2, o cap. 9 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **CDC 2022 de prescrição de opioides:** Dowell et al., MMWR Recomm Rep 2022;71(3):1–95 (PMID 36327391; PMC9639433).
  - Lido no texto integral. Conferi no texto cada trecho e a categoria de cada recomendação: A ou B, com o tipo de evidência de 1 a 4.
  - Vale para adultos ambulatoriais.
  - Exclui doença falciforme, dor do câncer, cuidados paliativos e fim de vida. A nota diz isso em cada item.
  - Ficaram fora a revisão do sistema de monitoramento de receitas, que é dos EUA, e os itens só de dor crônica.
- **Política da ACEP 2020 sobre opioides no PS:** fechada. Não foi lida, e o CDC 2022 cobre o que interessa à alta do PS.
- **Manual:** cap. 9 conferido no PDF, p. 140 e 151 (escada analgésica e prescrição na alta).

## O que mudou na Central

- **Ficha `adulto-dor-analgesia`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_DOR_2022`, com 6 temas e o manual ao lado;
  - na tela, um bloco novo: "CDC 2022 — ao lado do manual";
  - as doses do manual não mudaram.
- **Nota `nota-hcfmusp-cap9-dor`:** 6 itens.
- **Migration:** `20270414000048`.

## Onde a diretriz difere do manual

| Tema | CDC 2022 | Manual |
|---|---|---|
| Primeira escolha | sem opioide, pelo menos tão eficaz em muitas dores agudas (B3) | paracetamol e dipirona na alta |
| Tipo de opioide | liberação imediata (A4) | escada analgésica |
| Dose inicial | menor dose eficaz; cerca de 5–10 MME por dose ou 20–30 MME por dia (A3) | Tabela 3, sem equianalgesia |
| Duração | o mínimo necessário; poucos dias ou menos costumam bastar (A4) | avaliação criteriosa e seguimento |
| Naloxona | oferecer ao prescrever opioide, sobretudo a quem tem risco (A4) | não trata |
| Benzodiazepínico junto | cautela particular (B3) | não trata |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| opioide na alta: quantos dias? | "não há, nos trechos" | CDC 2022: o mínimo; poucos dias ou menos |
| naloxona na receita de opioide | "não encontrei" | CDC 2022: oferecer, sobretudo a quem tem risco |
| analgésico de primeira linha | manual (paracetamol e dipirona) | CDC 2022 com o manual ao lado |
| opioide com benzodiazepínico | ACEP 2026, na sedação | CDC 2022 (cautela) com a sedação |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha foi ingerida em 17 trechos e a nota em 7. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #731, 14/11/2026

- A migration `20270414000048` foi aplicada antes do merge. O #731 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As quatro respostas saíram como na homologação.
