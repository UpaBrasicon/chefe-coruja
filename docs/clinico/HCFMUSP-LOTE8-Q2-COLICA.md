# Revisão do HCFMUSP, lote 8, Q2: cap. 62 (cólica nefrética)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 8 inteiro. Pela Q2, o cap. 62 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **EAU 2025 de urolitíase:** Skolarikos et al., Eur Urol 2025;88(1):64–75 (PMID 40268592).
  - Ao abrir o texto no Chrome, o ScienceDirect pediu verificação de navegador, e ela não foi contornada.
  - Li o resumo. Ele diz que as recomendações são graduadas, mas não mostra a força de cada uma; cada item diz isso.
- **Manual:** cap. 62 conferido no PDF, p. 846–849.

## O que mudou na Central

- **Ficha `adulto-colica-renal`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_COLICA_2025`, com 3 temas e o manual ao lado;
  - na tela, um bloco novo: "EAU 2025 — ao lado do manual";
  - as doses do manual não mudaram.
- **Nota `nota-hcfmusp-cap62-colica-nefretica`:** 3 itens.
- **Migration:** `20270414000047`.

## Onde a diretriz difere do manual

A EAU 2025 confirma o manual na imagem e na analgesia. Duas coisas são novas:

- **Imagem:** a TC passa a ser "de baixa dose".
- **Terapia expulsiva:** a EAU diz "pacientes escolhidos"; o manual diz "5 a 10 mm". Ao lado continua o ensaio de Meltzer 2018, sem benefício abaixo de 9 mm.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| imagem na cólica | manual (ultrassom, TC helicoidal) | EAU 2025 (ultrassom, TC de baixa dose) com o manual |
| AINE ou opioide | manual (AINE primeiro) | EAU 2025 e manual, que concordam |
| tansulosina com 6 mm | manual e Meltzer: "não recomenda de rotina" | EAU 2025 (pacientes escolhidos) e manual (5–10 mm) lado a lado |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha foi ingerida em 8 trechos e a nota em 4. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #730, 14/11/2026

- A migration `20270414000047` foi aplicada antes do merge. O #730 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As três respostas saíram como na homologação.
