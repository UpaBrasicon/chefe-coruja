# Revisão do Manual HCFMUSP, lote 1 (riscos primeiro): diagnóstico

**Pedido.** RT, 13/11/2026 (`BACKLOG.md`, "Revisão do Manual HCFMUSP e guia da cetoacidose"):
- revisar tudo o que subiu do HCFMUSP contra as diretrizes mais recentes, por lotes, com os riscos primeiro;
- o livro não é editado: cada ponto desatualizado vira uma nota de atualização com a fonte nova, que entra na biblioteca da IA e passa pela aprovação do RT;
- o RT mandou começar o lote 1 no mesmo dia.

**Escopo.** Só diagnóstico. Nenhuma ficha, nota ou trecho muda aqui.

## Capítulos do lote 1

O manual tem 108 capítulos (lista tirada das seções da biblioteca, depois do E3b). O lote 1 tem 12:

| Cap. | Tema | Páginas |
|---|---|---|
| 2 | Parada cardiorrespiratória no adulto | 43–53 |
| 4 | Choque circulatório | 66–79 |
| 6 | Cuidados pós-parada cardíaca | 98–113 |
| 7 | Sepse | 114–129 |
| 11 | Anafilaxia | 168–181 |
| 13 | IAM sem supra de ST | 199–211 |
| 14 | IAM com supra de ST | 212–222 |
| 38 | AVC isquêmico | 513–541 |
| 64 | Emergências hiperglicêmicas | 864–876 |
| 97 | Manejo inicial das intoxicações exógenas | 1297–1306 |
| 98 | Intoxicações específicas | 1307–1324 |
| 99 | Intoxicações ambientais e drogas de abuso | 1325–1337 |

## O que a Central já atualizou

As ferramentas da Central do Plantonista já comparam o manual com as diretrizes novas, e na maioria dos temas do lote 1 a conduta da tela já segue a diretriz nova. Pela busca no PubMed de 13/11/2026 (diretrizes e consensos de 2025–2026), estas são as fontes mais recentes:

| Tema | Ficha da Central (versão) | Diretriz mais recente já citada | Mais nova no PubMed? |
|---|---|---|---|
| PCR (2) | `adulto-pcr` (06/11) | AHA 2025, Part 9 (ALS); ensaios IVIO e de via de droga | **Sim: resumo do CoSTR 2026 do ILCOR** (Resuscitation 2026, PMID 42988037), a conferir |
| Pós-PCR (6) | `adulto-pos-pcr` (09/10) | ERC/ESICM 2025, Post-resuscitation care | Corrigenda de 2026 (PMID 42766977), a conferir |
| Choque e sepse (4, 7) | `adulto-ressuscitacao-volemica` (06/11) | Surviving Sepsis Campaign 2026; ILAS jul/2026 | Não: em 2026 só saíram comentários da SSC 2026 |
| Anafilaxia (11) | `adulto-anafilaxia` (06/11) | WAO 2020; practice parameter 2023; consenso GALEN 2024 | Não para a emergência (só a perioperatória francesa de 2025) |
| SCA (13, 14) | `adulto-sca-inicial`, `adulto-fibrinoliticos`, `adulto-anticoagulacao-plena` | ACC/AHA 2025; ESC 2023; diretriz brasileira | Não |
| AVC (38) | `adulto-trombolise-avc` (11/11) | AHA/ASA 2026; ESO 2025; INTERACT4 | Não |
| CAD/EHH (64) | `adulto-cad-ehh-*` (13/11) | Consenso ADA/EASD/JBDS 2024, que agora manda na tela | Não |
| Intoxicações (97–99) | `adulto-intoxicacoes-antidotos` (11/11) | CTRC (carvão ativado); AHA 2023 de toxicologia; AHA 2025 Part 10 | Não para o que a Central cobre |

Ficam só com o manual, sem diretriz nova citada:
- TIMI de IAM sem supra;
- NIHSS e Rankin modificada.

São escalas que não mudaram e não precisam de nota.

## O problema que sobra

A **biblioteca da IA** ainda entrega o texto do manual como ele está. Numa pergunta sobre um desses temas, o modelo recebe ao mesmo tempo o trecho do manual de 2022 e o trecho da ficha da Central, e as regras de resposta não dizem qual vale quando os dois discordam. Exemplos do lote 1 em que o manual diverge da diretriz que a Central segue:
- CAD: bolus de insulina, potássio de 3,3 e bicarbonato com pH abaixo de 6,9;
- sepse: volume e metas da SSC 2026;
- PCR: o que mudou na AHA 2025.

Sem regra, a resposta pode citar o dado antigo do livro.

## Decisões para o RT

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| L1 | Como a atualização chega à IA | **A.** Uma nota de atualização por capítulo, na biblioteca, como fonte própria ("Notas de atualização do Chefe Coruja"). Cada nota traz o que mudou, a diretriz nova, a página e a data, a partir do que as fichas já conferiram. As regras de resposta ganham uma linha: quando o manual e uma nota ou ficha mais nova discordarem, seguir a mais nova e dizer que o manual é de 2022. **B.** Só a regra de resposta, sem notas. **C.** Tirar da biblioteca os capítulos do lote 1, já que a Central cobre | **A.** As notas dão à IA o texto novo para citar, e a regra resolve o conflito. Com C, a IA perde o que o manual tem e a Central não |
| L2 | CoSTR 2026 do ILCOR (PCR) e corrigenda do ERC/ESICM 2025 (pós-PCR) | **A.** Ler os dois agora, antes das notas, e, se mudarem conduta, atualizar as fichas, com versão nova e sua aprovação. **B.** Deixar para depois do lote 1 | **A.** É a fonte mais nova do tema de maior risco |
| L3 | Aprovação | **A.** Uma aprovação por nota, na Revisão Clínica, como as fichas. **B.** Uma aprovação para o lote inteiro | **A.** É o mesmo caminho das fichas, e cada nota cita a sua fonte |

## Se o RT escolher as recomendações, a ordem é

1. **L2:** ler o CoSTR 2026 e a corrigenda; se mudarem conduta, atualizar as fichas de PCR e pós-PCR, pela homologação e com o seu ok.
2. **L1:** escrever as 12 notas do lote 1 (8 temas) a partir das fichas, cada uma com a diretriz e a página, e acrescentar a regra de resposta na biblioteca.
3. Ingerir as notas na homologação, rodar as evals e conferir perguntas com conflito (CAD, sepse e PCR) antes e depois.
4. Produção com o seu "ok produção" e a sua aprovação de cada nota.

## Riscos

- **Nota mal resumida vira erro com cara de oficial.** Por isso cada nota cita a página da diretriz, só repete o que a ficha já conferiu e passa pela aprovação do RT.
- **O conflito pode continuar** se a busca trouxer só o trecho do manual, sem a nota. As evals com perguntas de conflito medem isso.
