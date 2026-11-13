# Lote 1 da revisão do HCFMUSP: notas de atualização e regra de conflito (L1 e L3)

Decisão do RT de 13/11/2026: L1 a L3 = A (`docs/clinico/HCFMUSP-LOTE1-DIAGNOSTICO.md`). O L2 (CoSTR 2026 na PCR) foi feito antes, no #651.

## O que entra

**8 notas para os 12 capítulos do lote 1** (`src/clinico/adulto/notasHcfmusp.ts`):
- Nenhum texto clínico foi escrito à mão. Cada item vem de uma lista que a ficha da Central já conferiu na diretriz, com a página:

| Nota | Capítulos | Itens | Lista de origem |
|---|---|---|---|
| PCR | 2 | 15 | `DIRETRIZ_ALS_2025` (AHA 2025) e `COSTR_2026_PCR` (ILCOR 2026) |
| Pós-PCR | 6 | 8 | `METAS_ERC_2025` × `METAS_POS_PCR` |
| Choque e sepse | 4 e 7 | 13 | `DIRETRIZES_2026` (SSC 2026 e ILAS jul/2026) |
| Anafilaxia | 11 | 7 | `DIRETRIZES_ANAFILAXIA` (WAO 2020, PP 2023) |
| SCA | 13 e 14 | 11 | `DIRETRIZ_SCA_2025` (AHA/ACC 2025, ESC 2023) e `DIFERENCAS_ANTICOAG_2025` |
| AVC | 38 | 14 | `DIRETRIZ_AVC_2026` (AHA/ASA 2026) |
| CAD/EHH | 64 | 14 | `DIFERENCAS_2024` (consenso ADA/EASD/JBDS 2024) |
| Intoxicações | 97 a 99 | 6 | `CARVAO_CTRC_2026` × `CARVAO_INDICACAO` |

- Cada nota diz que o manual é de 2022 e, item por item, traz "Diretriz atual" e "Manual de 2022", com as fontes (nunca o próprio manual) e a ferramenta da Central que segue a diretriz.
- Cada nota é uma ficha (`nota-hcfmusp-*`), registrada pela migration `20270413000005` e aprovada pelo RT na Revisão Clínica (L3). A nota de SCA está na versão 2026-11-13.2: a .1, já na homologação, tinha só os 3 itens de anticoagulação.
- `scripts/corpus-central.mjs` grava as notas em `biblioteca/corpus/nota-hcfmusp-*.md`, junto com as fichas.

**Regra de resposta** (`biblioteca/app/main.py`, regra 8): quando houver nota de atualização sobre o ponto perguntado, ela vale sobre o manual de 2022 e sobre qualquer outro trecho, inclusive ferramentas da Central que repitam o manual. A resposta começa pela "Diretriz atual" da nota e cita o manual só em uma linha, como diferença. Sem nota, quando o manual e uma ferramenta da Central discordarem, segue a ferramenta e diz que o manual traz diferente. A regra pediátrica passa a ser a 9.

**Bicarbonato na CAD (ficha `adulto-bicarbonato`, versão 2026-11-13.1):** o esquema "Cetoacidose diabética" da ficha de distúrbios acidobásicos ainda trazia o pH < 6,9 do manual. Passa a usar o texto do consenso 2024 (`TRATAMENTO_2024.bicarbonato`, já conferido na ficha da CAD) e cita o manual como diferença. A ficha vai junto na migration `20270413000005` e precisa da sua aprovação.

**Títulos das seções da nota:** cada item ganhou o assunto por extenso ("Acidose — cetoacidose diabética (CAD) e estado hiperosmolar (EHH) no adulto", por exemplo), para a busca achar a nota quando a pergunta não usa a palavra do item.

**Testes:** `notasHcfmusp.test.ts` confere:
- os 12 capítulos cobertos e ids únicos;
- nenhuma fonte é o manual;
- os itens são os da lista de origem;
- o texto avisa que o manual é de 2022.

## O que não entra

- **Antiagregação na SCA** (AAS, inibidor de P2Y12): nenhuma ficha da Central compara essa parte com a ACC/AHA 2025. Cobrir pede ler a diretriz nesse ponto, com a sua aprovação, como tarefa à parte.
- **Corrigenda do ERC/ESICM 2025 (pós-PCR):** o texto está fechado e não foi lido.

## Antes e depois

As mesmas 6 perguntas foram feitas direto à API da biblioteca (`/v1/ask`), primeiro na produção, sem notas, e depois na homologação, com as notas e a regra.

**Antes (produção, 13/11/2026):** 4 de 6 respostas seguiram o manual de 2022:

| Pergunta | Resposta | Diretriz atual |
|---|---|---|
| potássio mínimo para iniciar insulina na CAD do adulto | K > 3,3 (manual) | consenso 2024: > 3,5 |
| quando dar bicarbonato na CAD do adulto | só pH < 6,9 (manual) | consenso 2024: pH < 7,0 |
| volume inicial no choque séptico | 30 mL/kg na primeira hora (manual) | SSC 2026: 30 mL/kg nas primeiras 3 h, condicional |
| corticoide na anafilaxia | segunda linha, com as doses do manual e "fraca evidência" | WAO 2020: sem benefício na fase aguda; uso de rotina controverso |
| dose de tenecteplase no AVC | 0,25 mg/kg, máx. 25 mg (AHA/ASA 2026) | já certo |
| temperatura após parada | controle ativo de 32–36 °C (manual) | ERC-ESICM 2025: prevenir febre (≤ 37,5 °C) por 36–72 h |

**Depois (homologação, 13/11/2026):** as 6 respostas trazem a diretriz atual. 5 começam por ela; a do potássio põe os dois valores na primeira linha (manual 3,3 e consenso 3,5):

| Pergunta | Resposta | Segue a diretriz? |
|---|---|---|
| potássio mínimo para iniciar insulina na CAD do adulto | primeira linha com "> 3,3 (manual de 2022)" e "≥ 3,5 pela diretriz atual"; a lista de conduta começa pelo consenso | em parte: o consenso aparece, mas não vem primeiro |
| quando dar bicarbonato na CAD do adulto | "Diretriz atual (consenso 2024): só se pH < 7,0", 100 mmol em 400 mL a cada 2 h até pH > 7,0; manual como diferença | sim |
| volume inicial no choque séptico | pelo menos 30 mL/kg nas primeiras 3 h, condicional (SSC 2026), e ILAS jul/2026 | sim |
| corticoide na anafilaxia | "Não é necessário de rotina" (WAO 2020); doses do manual como diferença | sim |
| dose de tenecteplase no AVC | 0,25 mg/kg, máx. 25 mg (AHA/ASA 2026) | sim |
| temperatura após parada | prevenir febre (≤ 37,5 °C) por 36–72 h (ERC-ESICM 2025); 32–36 °C do manual como diferença | sim |

Duas lições da homologação, que valem para a produção:
- **Toda ficha da Central com o texto antigo precisa ser reingerida**, não só as notas. Na primeira rodada a resposta do bicarbonato seguia a ficha de distúrbios acidobásicos, que ainda tinha o pH < 6,9. Na produção vai o corpus inteiro.
- **A API guarda as respostas por 6 h** (`CACHE_TTL_S`). Depois da reingestão é preciso reiniciar o container, senão volta a resposta antiga.

**Produção (13/11/2026, com o ok do RT):** migration `20270413000005` aplicada; API da biblioteca com a regra 8; corpus inteiro reingerido (237 arquivos, todos com trechos; a primeira tentativa caiu com a conexão no arquivo 100 e foi retomada dali); API reiniciada. As 6 perguntas de conflito começam pela diretriz atual, inclusive a do potássio ("K > 3,5 pela diretriz atual"). Backup da API anterior: imagem `biblioteca-api:antes-hcfmusp1-20261113`.

**Avaliações na homologação** (`npm run biblioteca:homolog -- --avaliar`): todas as metas cumpridas, menos duas, que não vêm das notas:
- ferramenta certa em `perguntas.yaml`: 89,5%. A falha é a variação reescrita da pergunta de SDRA, que já falhava antes;
- portão em `falhas.yaml`: 98,5%. "Dieta para emagrecer rápido" passou o portão com 0,503, puxada por fichas de hepatologia, sem nota no meio.
