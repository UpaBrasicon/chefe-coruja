# Revisão do HCFMUSP, lote 2, M2: cap. 20, síndrome aórtica aguda (ESC 2024)

Decisão do RT de 13/11/2026 (M2 = A): ler a diretriz nova, atualizar a ficha e só depois fazer a nota. O diagnóstico do lote 2 está em `HCFMUSP-LOTE2-DIAGNOSTICO.md`.

## Fonte

2024 ESC Guidelines for the management of peripheral arterial and aortic diseases. Eur Heart J. 2024;45(36):3538–3700 (PMID 39210722).

- O texto integral está fechado na editora.
- O RT autorizou baixar o slideset oficial da ESC (13/11/2026). O arquivo é um PowerPoint de 194 slides, cada um uma imagem EMF. Os slides foram convertidos para PNG e as partes de aorta foram lidas.
- Slides usados:
  - recomendações com classe e nível: 105, 110, 112, 116, 117, 118, 121, 124, 125 e 137;
  - Figura 30 (ADD-RS): slide 178;
  - Figura 31 (tratamento clínico): slide 179.
- Os slides não trazem dose.

## O que mudou na Central

**Ficha `adulto-sindrome-aortica` 2026-11-13.1:**
- fonte nova `ESC_AORTA_2024`;
- `DIRETRIZ_AORTA_2024`: 19 temas, cada um com classe, slide e o que o manual traz;
- `DIFERENCAS_AORTA_2024`: 8 frases;
- a tela ganha a tabela "ESC 2024 — ao lado do manual";
- alvos do manual, cortes, Tabela 3 e doses não mudam.

**ADD-RS 2026-11-13.1:** fonte ESC 2024 e um cuidado com o fluxograma da Figura 30. A leitura do escore continua a do livro.

**Nota `nota-hcfmusp-cap20-sindrome-aortica`:** 19 itens tirados de `DIRETRIZ_AORTA_2024`.

**Migration** `20270413000009`. As três fichas aguardam a aprovação do RT.

## Diferenças principais

| Tema | ESC 2024 | Manual de 2022 |
|---|---|---|
| Cirurgia na aorta ascendente | ≥ 55 mm (I, B); acima de 52 mm com baixo risco (IIa, B) | acima de 5 cm |
| Marfan | seio aórtico ≥ 50 mm (I, B); ≥ 45 mm só com fatores de risco (IIa, C) | 4,5 cm indica cirurgia |
| ADD-RS de 0 ou 1 | ECG, radiografia, exames e POCUS. D-dímero e radiografia negativos levam a pensar em outro diagnóstico. O fluxograma não mostra corte | D-dímero < 500 ng/mL FEU encerra |
| Contraindicação ao betabloqueador | diltiazem ou verapamil (IIa, B) | não está na ferramenta |
| Dor, monitorização, via oral | opioide IV; PAI, ECG contínuo e UTI; betabloqueador oral depois de 24 h (I) | não estão na ferramenta |
| Tipo B complicada | intervenção de emergência, TEVAR de primeira linha (I, B) | cirurgia nas complicações |

O labetalol aparece como exemplo da ESC, mas a DBHA 2025 o marca como não disponível no Brasil. A ficha diz isso.

## Antes e depois (13/11/2026)

Perguntas direto à API da biblioteca (`conflito_aorta.py`). "Antes" é a produção, sem a ESC 2024. "Depois" é a homologação, com as fichas e a nota novas.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| diâmetro para operar a aorta ascendente | > 5 cm (manual) | ≥ 55 mm (ESC 2024, I, B), com o manual como diferença |
| Marfan | 4,5 cm (manual) | ≥ 50 mm (I, B); ≥ 45 mm com fatores de risco (IIa, C) |
| alvo de FC e PA na dissecção | PAS < 120 (DBHA) e FC < 60 (manual) | PAS < 120 e FC ≤ 60 (ESC 2024, I, B), PAM mais alta na isquemia medular |
| dissecção sem poder usar betabloqueador | "não encontrei no material" | diltiazem ou verapamil (ESC 2024) |
| ADD-RS 1 com D-dímero negativo | "sim", pelo manual | "sim", pelo manual, com o fluxograma da ESC 2024 logo abaixo |
| tipo B complicada | controle de PA e FC; cirurgia nas complicações | intervenção de emergência com TEVAR (ESC 2024, I, B) |

A resposta do ADD-RS ainda abre pelo manual. As duas fontes não se contradizem: a ESC também manda pensar em outro diagnóstico com D-dímero negativo, e soma a radiografia.

## Produção, com o "ok produção"

1. Aplicar a migration `20270413000009`.
2. Copiar e ingerir os quatro arquivos do corpus: `adulto-add-rs.md`, `adulto-emergencia-hipertensiva.md`, `adulto-sindrome-aortica.md` e `nota-hcfmusp-cap20-sindrome-aortica.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (13/11/2026, com o "ok produção" do RT)

- A migration `20270413000009` está aplicada. As fichas `adulto-sindrome-aortica`, `adulto-add-rs` e `nota-hcfmusp-cap20-sindrome-aortica` estão na versão 2026-11-13.1.
- O corpus foi gerado do master depois do merge e ingerido na coleção da produção. A API foi reiniciada.
- A Vercel publicou o master (`733fb002`) com sucesso.
- As seis perguntas foram refeitas na produção:
  - cinco abrem pela ESC 2024 (ascendente ≥ 55 mm, Marfan ≥ 50 mm, FC ≤ 60, diltiazem ou verapamil, TEVAR);
  - a do ADD-RS abre pelo manual, com a ESC logo abaixo, como na homologação.
