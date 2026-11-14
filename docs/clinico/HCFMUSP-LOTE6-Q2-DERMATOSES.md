# Revisão do HCFMUSP, lote 6, Q2: cap. 96 (dermatoses graves, SSJ/NET)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q2, o cap. 96 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **Diretriz latino-americana de SSJ/NET 2025:** Murillo-Casas et al., World Allergy Organ J 2025;18(4):101046 (PMID 40226820; PMC11986972).
  - O texto integral foi lido pelo PMC.
  - A tabela do tratamento sistêmico não veio no texto. Li essa tabela na página do PMC, pelo Chrome do RT.
  - Conferi no texto cada trecho usado.
- **Graus:** são os que a diretriz escreve.
  - Suspender a droga tem nível de evidência B.
  - O suporte vem em grau D.
  - O tratamento sistêmico é condicional a favor, com certeza muito baixa (consenso de especialistas).
  - A diretriz adaptou diretrizes existentes, avaliadas pelo AGREE II.
- **Manual:** cap. 96 conferido no PDF, Tabela 5 (p. 1284–1285).

## O que mudou na Central

- **Ficha `adulto-dermatoses-graves`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_SSJ_NET_2025`, com 9 temas e o manual ao lado;
  - na tela de dermatoses graves, um bloco novo: "SSJ/NET: diretriz latino-americana 2025 — ao lado do manual";
  - as doses do manual não mudaram.
- **Nota `nota-hcfmusp-cap96-dermatoses`:** 9 itens.
- **Migration:** `20270414000038`.

## Onde a diretriz difere do manual

| Tema | Diretriz 2025 | Manual |
|---|---|---|
| Tratamento sistêmico | corticoide com imunoglobulina EV (condicional; certeza muito baixa); sem recomendação sobre ciclosporina | prednisona 1–2 mg/kg/dia por 3–5 dias; ciclosporina 3–5 mg/kg/dia |
| Local | centro especializado, UTI com experiência em queimados; SCORTEN nos dias 0, 1 e 3 | UTI com 2 dos 7 itens do SCORTEN |
| Líquidos | diurese 0,5–1 mL/kg/h; Brooke modificada (protocolo francês) | não trata |
| Via aérea | VNI contraindicada | radiografia ou TC de tórax se houver sintoma |
| Pele | não remover a epiderme descolada; sem sulfadiazina de rotina | curativos vaselinados |
| Olhos | oftalmologia nas primeiras 24 h | avaliação multidisciplinar |
| Antibiótico profilático | não | não trata |
| Tromboprofilaxia | sugerida | não trata |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| corticoide, imunoglobulina ou ciclosporina | manual; "sem dado" sobre imunoglobulina | diretriz 2025 com o manual ao lado |
| antibiótico profilático | "não encontrei" | não recomendado (grau D) |
| hidratação | "não encontrei" | diurese 0,5–1 mL/kg/h; Brooke modificada |
| VNI | "não encontrei" | contraindicada (grau D) |
| tirar a pele descolada | "não encontrei" | não remover (grau D) |
| oftalmologista | sem gatilho | primeiras 24 h (grau D) |
| critérios de UTI (controle) | 2 dos 7 itens do SCORTEN | diretriz com o manual ao lado |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha foi ingerida em 9 trechos e a nota em 10. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.
