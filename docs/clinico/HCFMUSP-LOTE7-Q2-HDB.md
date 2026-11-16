# Revisão do HCFMUSP, lote 7, Q2: cap. 51 (hemorragia digestiva baixa)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 7 inteiro. Pela Q2, o cap. 51 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **ACG 2023:** Sengupta et al., Am J Gastroenterol 2023;118(2):208–231 (PMID 36735555).
  - Lida no texto integral pelo Chrome do RT (Ovid), sem CAPTCHA.
  - As recomendações foram copiadas do texto com força e qualidade (GRADE). Ficaram fora as recomendações de endoscopia terapêutica, que não cabem no PS, exceto a do momento da colonoscopia.
- **Manual:** cap. 51 conferido no PDF, p. 711–716.

## O que mudou na Central

- **Ficha `adulto-oakland`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_HDB_2023`, com 9 temas e o manual ao lado;
  - na tela do Oakland, um bloco novo: "ACG 2023 — ao lado do manual";
  - o cálculo do escore não mudou.
- **Nota `nota-hcfmusp-cap51-hdb`:** 9 itens.
- **Migration:** `20270414000042`.

## Onde a diretriz difere do manual

| Tema | ACG 2023 | Manual |
|---|---|---|
| Ácido tranexâmico | não usar (forte, moderada) | não trata |
| Angiotomografia | primeiro exame na hematoquezia com repercussão hemodinâmica (condicional, baixa) | opção no instável que não pode esperar a endoscopia; colonoscopia é o melhor método |
| Colonoscopia | sem urgência; em até 24 h não melhora desfechos (forte, moderada) | colonoscopia como exame de escolha, sem prazo |
| Varfarina | a maioria não precisa reverter; complexo protrombínico de 4 fatores em vez de plasma (condicional, muito baixa) | plasma fresco se INR > 1,5 |
| DOAC | reversor específico só no sangramento com risco de vida, DOAC nas últimas 24 h (condicional, muito baixa) | não trata |
| Alta | Oakland ≤ 8 (condicional, baixa) | Oakland < 8 no texto, ≤ 8 na tabela |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| ácido tranexâmico | "não há, nos trechos" (só HDA) | ACG 2023: não usar |
| instabilidade: angio-TC ou colonoscopia | manual | ACG 2023: angio-TC primeiro; embolização se extravasar |
| colonoscopia em 24 h | "não há, nos trechos" | ACG 2023: sem urgência |
| rivaroxabana: reverter? | consenso SBTH 2026 (outra ficha) | ACG 2023: só com risco de vida, reversor específico |
| varfarina: plasma ou complexo protrombínico | "não há trecho específico" | ACG 2023: complexo protrombínico, com o manual (plasma) ao lado |
| Oakland: alta (controle) | ficha | ACG 2023 com o manual |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha foi ingerida em 2 trechos e a nota em 10. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #723, 14/11/2026

- A migration `20270414000042` foi aplicada antes do merge. O #723 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As seis respostas saíram como na homologação.
