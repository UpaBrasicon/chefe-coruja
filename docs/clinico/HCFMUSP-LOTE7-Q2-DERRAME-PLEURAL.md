# Revisão do HCFMUSP, lote 7, Q2: cap. 36 (derrame pleural)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 7 inteiro. Pela Q2, o cap. 36 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **BTS 2023 de doença pleural:** Roberts et al., Thorax 2023;78(11):1143–1156 (PMID 37553157), versão resumida. A versão completa saiu no suplemento: Thorax 2023;78(Suppl 3):s1–s42 (PMID 37433578).
  - A versão resumida foi lida no texto integral pelo Chrome do RT, sem CAPTCHA.
  - Cada recomendação traz a força como a diretriz escreve: forte ou condicional, por evidência ou por consenso.
- **Manual:** cap. 36 conferido no PDF, p. 485–494.

## O que mudou na Central

- **Ficha `light`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_PLEURA_2023`, com 8 temas e o manual ao lado;
  - na tela dos critérios de Light, um bloco novo: "BTS 2023 — ao lado do manual";
  - o cálculo do Light não mudou.
- **Nota `nota-hcfmusp-cap36-derrame-pleural`:** 8 itens.
- **Migration:** `20270414000044`.

## Onde a diretriz difere do manual

| Tema | BTS 2023 | Manual |
|---|---|---|
| pH e drenagem | ≤ 7,2 drena; 7,2–7,4 é intermediário (DHL > 900 favorece drenar); ≥ 7,4 não drena de imediato | pH < 7,2, glicose < 40 ou < 60, DHL > 1.000, cultura positiva ou pus |
| Sem pH | glicose < 3,3 mmol/L indica alta probabilidade | glicose < 60 mg/dL sugere complicado |
| Calibre do dreno | fino, 14F ou menor (condicional) | drenagem fechada; tabela de calibres de outro capítulo |
| Terapia intrapleural | TPA com DNase; nada de TPA ou DNase sozinhos nem estreptoquinase | trombolítico no dreno ou videotoracoscopia |
| Toracocentese | sempre guiada por imagem | guiada por ultrassom |
| Prognóstico | escore RAPID (condicional) | não trata |

## Ajuste feito na homologação

- Na primeira versão, as três faixas de pH eram itens separados.
- A pergunta "pH 7,3: drenar?" não trazia a faixa intermediária, e a resposta encaixava 7,3 no baixo risco.
- As três faixas foram juntadas num só item ("pH do líquido e drenagem"), com 7,3 como exemplo da faixa intermediária.
- Depois do ajuste, a resposta classifica 7,3 como risco intermediário e manda medir a DHL.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| quando drenar pelo pH | manual (< 7,2) | BTS 2023 com as três faixas e o manual ao lado |
| pH 7,3: drenar? | "o material não lista esse valor" | BTS 2023: risco intermediário; DHL > 900 favorece drenar |
| guiar a toracocentese | POCUS, pelo artigo aberto | BTS 2023: sempre guiada por imagem |
| fibrinolítico no empiema | manual (trombolítico no dreno) | BTS 2023: TPA com DNase; não estreptoquinase |
| calibre do dreno | tabela de calibres (28 Fr no empiema) | BTS 2023: 14F ou menor, com o manual ao lado |
| critérios de Light (controle) | ficha e manual | igual |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha e a nota foram ingeridas, e a API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #725, 14/11/2026

- A migration `20270414000044` foi aplicada antes do merge. O #725 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As seis respostas saíram como na homologação; pH 7,3 aparece como risco intermediário.
