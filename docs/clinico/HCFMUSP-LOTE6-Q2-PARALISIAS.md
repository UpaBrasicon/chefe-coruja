# Revisão do HCFMUSP, lote 6, Q2: cap. 44 (paralisias flácidas agudas)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q2, o cap. 44 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota. O capítulo trata quase todo da SGB. Ele só cita a miastenia e o botulismo entre as causas, na Tabela 2 (p. 599–600).

## Fontes

- **SGB, EAN/PNS 2023:**
  - van Doorn et al., Eur J Neurol 2023;30(12):3646–3674 (PMID 37814552), metodologia GRADE.
  - O texto integral não está no PMC. Li o resumo, que traz as recomendações e a força de cada uma: "recomenda", "recomenda fraco" ou "ponto de boa prática".
- **Botulismo, CDC 2021:**
  - Rao et al., MMWR Recomm Rep 2021;70(2):1–30 (PMID 33956777; PMC8112830).
  - Texto integral lido. O guia não gradua as recomendações: elas vêm de revisões sistemáticas e de especialistas.
- **Botulismo no Brasil, Guia de Vigilância em Saúde do MS:**
  - 6ª ed. rev., 2024, vol. 1, p. 371 (tratamento específico), lido no PDF.
  - Entrou porque a primeira resposta da homologação trazia só o BAT, o produto dos EUA. O SAB é o produto usado no Brasil.
- **Miastenia:** a atualização de 2020 do consenso internacional não foi lida e não entrou na nota.
- **Manual:** conferi no PDF as p. 599–606.

## O que mudou na Central

- **Ficha `adulto-guillain-barre`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_SGB_2023`, com 10 temas e o manual ao lado;
  - na tela, um bloco novo: "EAN/PNS 2023 — ao lado do manual".
  - As doses e contas do manual não mudaram: imunoglobulina 0,4 g/kg/dia e plasmaférese 250 mL/kg.
- **Nota `nota-hcfmusp-cap44-paralisias-flacidas`, versão 2026-11-14.2, com 16 itens:**
  - 10 itens da SGB, tirados da ficha;
  - 1 item do MS 2024 (soro antibotulínico);
  - 5 itens do CDC 2021.
  - A versão .1 existiu só na homologação, antes de o item do MS entrar.
- **Migration:** `20270414000035`.

## Onde a diretriz difere do manual

| Tema | Diretriz | Manual |
|---|---|---|
| Corticoide | EAN/PNS 2023: oral, recomenda contra; EV, recomenda fraco contra | AAN 2003: não há recomendação (Tabela 6) |
| Segundo curso de imunoglobulina | EAN/PNS 2023: não dar no prognóstico ruim | não trata |
| Plasmaférese seguida de imunoglobulina | EAN/PNS 2023: não recomenda | não há evidência do uso concomitante |
| Dor | EAN/PNS 2023: gabapentinoide, tricíclico ou carbamazepina (recomenda fraco) | descreve a dor e não diz como tratar |
| Risco de ventilação | EAN/PNS 2023: mEGRIS | Tabela 4 (1 maior ou 2 menores) |
| Antitoxina botulínica | MS 2024: SAB até 7 dias, uma ampola EV diluída 1:10 em 1 h. CDC 2021: sem esperar o laboratório; maior benefício em 2 dias | não trata |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| corticoide na SGB | AAN 2003 (manual) | EAN/PNS 2023 contra, com o manual ao lado |
| segundo curso de imunoglobulina | "os trechos não trazem" | EAN/PNS 2023: não dar no prognóstico ruim |
| quem tratar | manual | EAN/PNS 2023 com o manual |
| dor na SGB | "não encontrei" | EAN/PNS 2023: gabapentinoide, tricíclico ou carbamazepina |
| antitoxina sem confirmação | Guia do MS | MS 2024 e CDC 2021 lado a lado |
| vigilância respiratória no botulismo | Guia do MS | CDC 2021 com o Guia do MS |
| critérios de ventilação na SGB (controle) | Tabela 4 | Tabela 4, mais o mEGRIS |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- A ficha foi ingerida em 6 trechos e a nota em 17. A API foi reiniciada.
- Os testes da nota e da SGB passam, e o typecheck está limpo.
