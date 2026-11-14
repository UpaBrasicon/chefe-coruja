# Revisão do HCFMUSP, lote 3, N2: cap. 25, trombose venosa profunda (ASH 2020)

Decisão do RT de 14/11/2026 (N2 = A). O RT liberou a produção dos capítulos restantes do N2 nesta data, depois da homologação e do CI verde.

## Fonte

- Ortel TL, Neumann I, Ageno W, et al. American Society of Hematology 2020 guidelines for management of venous thromboembolism: treatment of deep vein thrombosis and pulmonary embolism. Blood Adv 2020;4(19):4693–4738 (PMID 33007077; PMC7556153).
- Li o texto integral no PMC, pelo Chrome do RT: as 28 recomendações e o grau GRADE de cada uma.
- Entram só as que valem para a TVP. As de TEP já estão na AHA/ACC 2026, no lote 2.
- A CHEST 2021 não foi lida.

O lado do manual foi conferido no PDF do livro (cap. 25, p. 345–357).

## O que mudou na Central

- **Módulo novo `src/clinico/adulto/tvp2026.ts`:**
  - fonte `ASH_TEV_2020`;
  - `DIRETRIZ_TVP`, com 11 temas;
  - `DIFERENCAS_TVP`, com 4 frases.
- **Ficha `adulto-anticoagulacao-plena` 2026-11-14.1:** passa a citar a ASH 2020. A tela de anticoagulação plena ganha a tabela "TVP: ASH 2020 — ao lado do manual".
- A nota da SCA (cap. 13–14), que herda as fontes dessa ficha, filtra a fonte nova. Um teste garante isso.
- As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap25-tvp`:** 11 itens.
- **Migration** `20270414000013`.

## Diferenças principais

| Tema | ASH 2020 | Manual de 2022 |
|---|---|---|
| Prevenção secundária | anticoagulante, e não aspirina (condicional) | aspirina depois de parar a anticoagulação na TEV não provocada (p. 355) |
| Duração | 3–6 meses de tratamento primário e depois indefinida na não provocada ou com fator crônico | mínimo de 3 meses; prolongar conforme os riscos (p. 353–354) |
| DOAC ou varfarina | preferir DOAC (condicional) | os dois; DOAC contraindicado na insuficiência renal (p. 353) |
| Recorrência com varfarina | trocar para HBPM (condicional) | não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| tratar em casa ou internar | "não traz critérios para TVP" | ASH: em casa, com os critérios do manual |
| DOAC ou varfarina | "não há trecho para TVP" | ASH: DOAC preferido |
| duração na não provocada | indefinida (artigo aberto) e aspirina (manual) | ASH: indefinida |
| aspirina depois de parar | manual: aspirina | ASH: anticoagulante, e não aspirina; o manual como diferença |
| nova TVP com varfarina na faixa | "os trechos não trazem" | ASH: trocar para HBPM |
| filtro de veia cava | manual: só com contraindicação ou falha | ASH: igual, com filtro removível |

As seis respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- `adulto-anticoagulacao-plena.md` e `nota-hcfmusp-cap25-tvp.md` ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.236, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção (14/11/2026, com o "ok produção" do RT para os capítulos restantes)

- A migration `20270414000013` foi aplicada antes do merge. O #680 foi mesclado com o CI verde.
- O corpus foi gerado do master e os 2 arquivos foram ingeridos. A API foi reiniciada.
- Refiz as perguntas na produção: as seis abrem pela ASH 2020.
