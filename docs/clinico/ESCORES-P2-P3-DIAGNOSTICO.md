# Escores e pediatria P2/P3 do levantamento: diagnóstico dos 15 itens

Origem: pedido do RT em 11/11/2026 para andar com os itens P2/P3 de escores e pediatria que ficaram fora dos lotes. O `BACKLOG.md` os lista como "fora dos lotes, para decisão depois": AIR, FAST-ED, Pádua, EDACS, LRINEC, Roma, Westley, BRUE, TEN-4-FACESp, TWIST, peso de emergência, tétano e raiva na criança, risco de suicídio, epistaxe e pneumotórax. O levantamento original, com as fontes propostas, é `docs/clinico/LACUNAS-CENTRAL-2026-10.md` (itens E7 a E12, P6 a P11 e A11 a A13).

Este documento é só diagnóstico. Nenhum código, dose, corte ou ponto muda aqui. Cada item traz o que existe hoje no app, a fonte, o que a ferramenta faria, os limites e as opções para o RT.

Como foi feito (11/11/2026):
- Cada fonte foi buscada no PubMed (metadados e resumo). Onde havia texto completo aberto no PMC, ele foi lido e está marcado como "texto completo".
- Nada foi preenchido de memória. Ponto de item, corte ou número que não estava no texto lido está como "não conferido".
- O app foi conferido em `src/clinico`, `src/pages/plantonista`, `src/content/registry.tsx`, `src/content/gruposSecoes.ts` e `src/components/evolucao/lnnc.ts`, no `master` de 11/11/2026 (b45e2e80).
- Regras que valem para tudo: dose só de fonte citada e lida; nada passa do adulto para a criança; pediatria vai até 13a 11m 29d; tétano e raiva na criança só com documento do Ministério da Saúde; a ferramenta apoia e não prescreve (ADR 0007).

Fontes que não abriram:
- Sem texto completo no PMC (só resumo lido): Andersson 2008 (AIR), Barbar 2010 (Pádua), Than 2014 (EDACS), Wong 2004 e Fernando 2019 (LRINEC), Barbosa 2013 e Valdivieso-Castro 2025 (TWIST), Brown 2020 (pneumotórax), Reuben 2021 (NoPAC), Tunkel 2020 (epistaxe, resumo estendido).
- Sem resumo e sem texto completo: Celli 2021 (Roma), Tieder 2016 (BRUE, sumário executivo da AAP) e a diretriz da BTS de 2023 (pneumotórax). Nada delas foi lido.
- Nama 2025 (BRUE) está no PMC, mas o texto completo veio vazio. Só o resumo.
- Westley 1978 tem resumo, mas o resumo não traz a pontuação.
- Os documentos do Ministério da Saúde (tétano e raiva) não estão no PubMed e não foram abertos nesta revisão.
- As tabelas de pontos do AIR (meta-análise de 2025) e do FAST-ED (Lima 2016) não vieram no texto do PMC. O texto foi lido; as tabelas, não.

---

## Visão geral

| # | Item | Existe hoje no app | Fonte principal lida | Recomendação |
|---|---|---|---|---|
| E7 | AIR | só uma nota na tela do Alvarado | meta-análise 2025, texto completo (sem a tabela de pontos) | C agora; A quando houver a tabela |
| E8 | FAST-ED | não; o RACE está bloqueado | Lima 2016, texto completo (sem a tabela) | A como única escala de LVO, com a tabela conferida antes |
| E9 | Pádua | a ficha de profilaxia diz que não está no livro | só resumos | C |
| E10 | EDACS | não; o HEART existe | só resumos | C |
| E11 | LRINEC | não | só resumos | C |
| E12 | Roma (DPOC) | a DPOC usa a Tabela 1 do manual | validação de 2023, texto completo; Celli 2021 não lido | C |
| P6 | Westley | o crupe usa a Tabela 6 do ICr; a tela diz que o livro não traz o Westley | só resumos | C |
| P7 | BRUE | não | resumo e texto de segunda mão | C |
| P8 | TEN-4-FACESp | não; a notificação de violência existe | Pierce 2021, texto completo | A |
| P9 | TWIST | não | Barbosa 2013 (resumo com os pontos) e meta-análise 2025 (resumo) | A |
| P10 | Peso de emergência | campo "peso aferido ou estimado" e a fórmula do MS na dengue | Wells 2017, resumo | B |
| P11 | Tétano e raiva na criança | só as telas de adulto (14 anos ou mais) | documentos do MS não lidos nesta revisão | A, depois de ler os PDFs do MS |
| A11 | Risco de suicídio | só a notificação | resumos | C |
| A12 | Epistaxe | só menções em outras telas | resumos | B |
| A13 | Pneumotórax espontâneo | só o hipertensivo no trauma | Brown 2020, resumo; BTS 2023 não lida | C |

---

## E7. AIR (apendicite)

### Onde está
- Não há tela do AIR. O escore aparece só como fonte e nota na tela do Alvarado: `src/clinico/escores/alvarado.ts`, constante `AIR_METANALISE_2025` (linhas 19–22), nota `NOTA_ALVARADO_WSES_2025` (linhas 24–25), fonte na ficha (linha 37). A ficha é de adulto (linha 32).
- Registry: `alvarado` em `src/content/registry.tsx:266`; grupo "Gastroenterologia e hepatologia" em `src/content/gruposSecoes.ts:15`.

### Fontes
- Andersson M, Andersson RE. The appendicitis inflammatory response score: a tool for the diagnosis of acute appendicitis that outperforms the Alvarado score. World J Surg. 2008;32(8):1843–1849. PMID 18553045. doi:10.1007/s00268-008-9649-y. Só o resumo.
- Andersson RE, Stark J. Diagnostic value of the appendicitis inflammatory response (AIR) score. A systematic review and meta-analysis. World J Emerg Surg. 2025;20(1):12. PMID 39923099. PMC11806527. doi:10.1186/s13017-025-00582-x. Texto completo, mas a tabela com os pontos de cada item não veio no texto do PMC.

### O que a fonte diz
- Derivação (resumo): 545 pacientes em quatro hospitais. Oito variáveis: dor em fossa ilíaca direita, descompressão dolorosa, defesa, leucócitos, proporção de neutrófilos, PCR, temperatura e vômito. AUC de 0,93 para qualquer apendicite e 0,97 para a avançada.
- Meta-análise (texto completo): 26 estudos, 15.699 pacientes. AUC de 0,86 para qualquer apendicite e 0,93 para a avançada. Nos 19 estudos com os dois escores, AIR 0,85 contra Alvarado 0,79.
- Corte baixo acima de 4: sensibilidade de 0,91 (qualquer) e 0,95 (avançada); especificidade de 0,63 e 0,71.
- Corte baixo acima de 3: sensibilidade de 0,95 e 0,99; especificidade de 0,47 e 0,46.
- Corte alto acima de 8: especificidade de 0,98 e 0,99; sensibilidade de 0,30 e 0,43.
- Os autores propõem três zonas: baixa (4 ou menos), intermediária e alta (acima de 8).

### O que a ferramenta faria
Oito itens, soma, três zonas pelos cortes acima. O peso de cada item não foi conferido: está numa tabela que não veio no texto lido. Sem essa tabela, não dá para escrever o cálculo.

### Limites e riscos
- Prevalência mediana de apendicite de 56,6% nos estudos, bem acima dos cerca de 30% de um PS sem seleção, como os próprios autores dizem.
- Um estudo só em criança e três só em gestante. A tela do Alvarado é de adulto; a criança não deve herdar o AIR sem fonte pediátrica.
- Os dois autores da meta-análise criaram o escore.
- Zona baixa não exclui: é para reexame após observação, não para alta sem reavaliação.

### Opções
- A: tela do AIR ao lado do Alvarado, adulto, com as três zonas. Só depois de ler a tabela de pontos (Andersson 2008 ou a Tabela 1 da meta-análise em PDF).
- B: deixar como está (a nota já mostra a AUC do AIR na tela do Alvarado).
- C (recomendada agora): esperar a tabela de pontos. Motivo: o cálculo depende de um texto que não foi lido. Com a tabela em mãos, A é barata (mesmo molde da `EscoreTela`).

### Não conferido no E7
- O peso de cada item e as faixas de PCR, leucócitos e neutrófilos.

---

## E8. FAST-ED (oclusão de grande vaso)

### Onde está
- Não existe. O grupo "Neurologia" dos escores tem Glasgow, FOUR, NIHSS e ABCD2 (`src/content/gruposSecoes.ts:14`). O NIHSS é a escala do manual (`registry.tsx:291`; `src/clinico/adulto/avcTrombolise.ts:10`).
- O RACE (E3, P1) está bloqueado: a pontuação de cada item não foi confirmada e o artigo original não abriu (`BACKLOG.md`, linhas 1749 e 1765).
- O levantamento já dizia: escolher só uma escala de oclusão de grande vaso.

### Fontes
- Lima FO, Silva GS, Furie KL, et al. Field Assessment Stroke Triage for Emergency Destination: A Simple and Accurate Prehospital Scale to Detect Large Vessel Occlusion Strokes. Stroke. 2016;47(8):1997–2002. PMID 27364531. PMC4961538. doi:10.1161/STROKEAHA.116.013301. Texto completo, sem a tabela da escala. Os dois primeiros autores são de Fortaleza e da Unifesp.
- Jahr SH, Selseth MN, Larsen KT, et al. Diagnostic performance of prehospital large-vessel occlusion detection scales in patients with suspected acute stroke: a retrospective validation study. Eur Stroke J. 2026;11(6). PMID 42319233. PMC13280950. doi:10.1093/esj/aakag067. Só o resumo.
- Kothari SA, Morsi RZ, Kozel OA, et al. Comparing validated stroke screening scales for identifying large and medium vessel occlusions: a prospective observational cohort study. J Neurointerv Surg. 2025;17(12):1320–1324. PMID 39488340. doi:10.1136/jnis-2024-022309. Só o resumo.

### O que a fonte diz
- Lima 2016 (texto completo): seis itens, cinco com pontos. Paralisia facial 0–1, fraqueza do braço 0–2, alteração da fala 0–2, tempo (registro, sem pontos), desvio do olhar 0–2, negligência 0–2. Máximo de 9.
- A escala foi calculada a partir do NIHSS feito na admissão, numa coorte de 727 pacientes com angio-TC. Não foi aplicada por equipe de campo.
- AUC de 0,81 (NIHSS 0,80; RACE 0,77; CPSS 0,75).
- FAST-ED 4 ou mais: sensibilidade de 0,60, especificidade de 0,89, VPP 0,72, VPN 0,82. FAST-ED 3 ou mais: sensibilidade de 0,71, especificidade de 0,78.
- Os autores descrevem três grupos: 0–1 com menos de 15% de oclusão, 2–3 com cerca de 30%, 4 ou mais com cerca de 60% ou mais.
- Jahr 2026 (resumo): 1.150 adultos em código AVC, 46 escalas. A maior AUC foi a do FAST-ED (0,855), igual ao NIHSS contínuo (0,851). Nenhuma escala passou de 80% em sensibilidade e especificidade ao mesmo tempo. Os autores concluem que nenhuma é precisa o bastante para detectar oclusão sozinha.
- Kothari 2025 (resumo): 198 pacientes; LAMS 0,750, FAST-ED 0,736, VAN 0,735, sem diferença significativa entre as escalas.

### O que a ferramenta faria
Cinco itens com pontos, soma de 0 a 9 e a faixa de probabilidade dos autores. Saída: "sugere oclusão de grande vaso" a partir de 4, com a tela dizendo que não substitui angio-TC. A definição de cada ponto (o que vale 1 e o que vale 2 em cada item) está na tabela do artigo e não foi conferida.

### Limites e riscos
- Cerca de 40% das oclusões ficam abaixo de 4 (sensibilidade de 0,60).
- Derivada do NIHSS de pesquisador treinado, não de quem atende na porta.
- Desempenho pior nos extremos de gravidade e no AVC de hemisfério direito (Jahr 2026, resumo).
- Na UPA, o uso é decidir transferência para centro com trombectomia. A decisão de rede é do protocolo regional, não da escala.

### Opções
- A (recomendada): FAST-ED como a única escala de oclusão de grande vaso, no lugar do RACE, que sai do backlog. Antes do código, conferir a tabela de pontos (Tabela 1 do Lima 2016, aberta no PMC pelo navegador). Motivo: tem texto aberto, autores brasileiros e a maior AUC na validação de 2026; o RACE segue sem fonte.
- B: só uma nota na tela do NIHSS de que as escalas de oclusão não bastam sozinhas (Jahr 2026). Efeito: nenhuma escala nova.
- C: esperar o RACE. Efeito: nada anda; o RACE está bloqueado desde outubro.

### Não conferido no E8
- A definição de cada ponto do FAST-ED.
- O texto completo do Jahr 2026 e do Kothari 2025.

---

## E9. Pádua (risco de TEV no paciente clínico)

### Onde está
- Não existe. A ficha de profilaxia diz que o livro não tem escore de risco: `src/clinico/adulto/profilaxiaTev.ts:4–5` e `:82` ("Escores de risco (Caprini, Pádua): não estão no livro."). Registry: "Doses de profilaxia pelo manual HC (sem escore de risco)" (`registry.tsx:71`).

### Fontes
- Barbar S, Noventa F, Rossetto V, et al. A risk assessment model for the identification of hospitalized medical patients at risk for venous thromboembolism: the Padua Prediction Score. J Thromb Haemost. 2010;8(11):2450–2457. PMID 20738765. doi:10.1111/j.1538-7836.2010.04044.x. Só o resumo.
- Darzi AJ, Repp AB, Spencer FA, et al. Risk-assessment models for VTE and bleeding in hospitalized medical patients: an overview of systematic reviews. Blood Adv. 2020;4(19):4929–4944. PMID 33049056. PMC7556144. doi:10.1182/bloodadvances.2020002482. Só o resumo.
- Drozdinsky G, Zusman O, Kushnir S, et al. The effect of obligatory Padua prediction scoring in hospitalized medically ill patients: A retrospective cohort study. PLoS One. 2024;19(2):e0292661. PMID 38324562. PMC10849389. doi:10.1371/journal.pone.0292661. Só o resumo.
- Chen X, Shi H, Chang J, et al. External Validation of the Risk Assessment Model of Venous Thromboembolism in Multicenter Internal Medicine Inpatients. Clin Appl Thromb Hemost. 2024;30:10760296241247205. PMID 38632943. PMC11025444. doi:10.1177/10760296241247205. Só o resumo.

### O que a fonte diz
- Barbar 2010: 1.180 internados em clínica médica. 39,7% classificados como alto risco. Sem profilaxia, TEV em 11,0% dos de alto risco; com profilaxia, 2,2%; no baixo risco, 0,3%.
- Darzi 2020 (revisão que embasou a diretriz da ASH de 2018): o Pádua está entre os modelos com validação externa e entre os que, em estudos de impacto, aumentaram a profilaxia adequada.
- Drozdinsky 2024: 18.890 pacientes em Israel. Preencher o Pádua aumentou a profilaxia (OR 1,66), sem reduzir mortalidade nem TEV.
- Chen 2024: em 595 internados na China, AUC do Pádua de 0,72.

### O que a ferramenta faria
Soma de fatores de risco, com corte de alto risco. Os fatores, os pesos e o corte estão no texto completo do Barbar 2010, que não foi lido.

### Limites e riscos
- Feito para paciente internado em clínica médica. A UPA tem observação, não enfermaria; o tempo de permanência que justifica profilaxia não está definido no app.
- A dose de profilaxia já está no app pelo livro; um escore sem fonte lida pode empurrar prescrição sem benefício demonstrado (Drozdinsky 2024).

### Opções
- A: tela do Pádua ao lado da profilaxia, depois de ler o Barbar 2010.
- B: uma linha na ficha de profilaxia dizendo que existem modelos validados (Pádua, IMPROVE) e que o benefício clínico do escore não está demonstrado.
- C (recomendada): não fazer agora. Motivo: pesos não lidos, população de enfermaria e ganho clínico duvidoso na UPA.

### Não conferido no E9
- Itens, pesos e corte do Pádua.

---

## E10. EDACS e EDACS-ADP (dor torácica)

### Onde está
- Não existe. O HEART está no app (`src/clinico/escores/heart.ts`; `registry.tsx:264`; grupo "Cardiologia", `gruposSecoes.ts:12`).

### Fontes
- Than M, Flaws D, Sanders S, et al. Development and validation of the Emergency Department Assessment of Chest pain Score and 2 h accelerated diagnostic protocol. Emerg Med Australas. 2014;26(1):34–44. PMID 24428678. doi:10.1111/1742-6723.12164. Só o resumo.
- Flaws D, Than M, Scheuermeyer FX, et al. External validation of the emergency department assessment of chest pain score accelerated diagnostic pathway (EDACS-ADP). Emerg Med J. 2016;33(9):618–625. PMID 27406833. doi:10.1136/emermed-2015-205028. Só o resumo.
- Shin YS, Ahn S, Kim YJ, et al. External validation of the emergency department assessment of chest pain score accelerated diagnostic pathway (EDACS-ADP). Am J Emerg Med. 38(11):2264–2270 (online em 2019). PMID 31757670. doi:10.1016/j.ajem.2019.09.019. Só o resumo.
- Nasr Isfahani M, Mohseni H, Nasri Nasrabadi E, Sarrafzadegan N. Improving chest pain risk assessment: validation of HEART, TIMI, GRACE, EDACS-ADP, and HET for MACE prediction in the emergency department. BMC Emerg Med. 2025;25(1):165. PMID 40847270. PMC12374469. doi:10.1186/s12873-025-01327-4. Só o resumo.

### O que a fonte diz
- Than 2014: na validação (608 pacientes), o EDACS-ADP classificou 51,3% como baixo risco, com sensibilidade de 100% e especificidade de 59,0%.
- Flaws 2016: baixo risco = EDACS abaixo de 16, sem isquemia nova no ECG e troponina não elevada em 0 h e 2 h. Sensibilidade de 100% e especificidade de 46,4% para evento em 30 dias.
- Shin 2020 (Coreia, 1.273 pacientes): sensibilidade de 97,7%, mas 1,1% de evento entre os de baixo risco, taxa que os autores acham alta para alta sem investigação.
- Nasr Isfahani 2025 (Irã, 274 pacientes): AUC do HEART 0,925 e do EDACS-ADP 0,803.

### O que a ferramenta faria
Soma do EDACS (itens e pesos não lidos), combinada com ECG e duas troponinas (0 h e 2 h).

### Limites e riscos
- Depende de troponina seriada em 2 horas. Se a UPA não tem esse fluxo, a ferramenta não se aplica.
- Duplica a função do HEART, que já está no app, sem ganho claro nos estudos lidos.

### Opções
- A: tela do EDACS-ADP, depois de ler o Than 2014.
- B: nada na tela do HEART (não há o que acrescentar a ele vindo do EDACS).
- C (recomendada): não fazer. Motivo: o HEART já cobre a pergunta e o EDACS pede troponina de 2 h.

### Não conferido no E10
- Itens e pesos do EDACS.

---

## E11. LRINEC (fasceíte necrosante)

### Onde está
- Não existe no adulto. A erisipela e a celulite estão nas dermatoses graves (`src/clinico/adulto/dermatoses.ts:152–153`). Na criança, a tabela de partes moles cita "celulite, fasceíte, miosite necrotizante" com o esquema do ICr (`src/clinico/pediatria/choqueToxicoPartesMolesPed.ts:96`).

### Fontes
- Wong CH, Khin LW, Heng KS, et al. The LRINEC (Laboratory Risk Indicator for Necrotizing Fasciitis) score: a tool for distinguishing necrotizing fasciitis from other soft tissue infections. Crit Care Med. 2004;32(7):1535–1541. PMID 15241098. doi:10.1097/01.ccm.0000129486.35458.7d. Só o resumo.
- Fernando SM, Tran A, Cheng W, et al. Necrotizing Soft Tissue Infection: Diagnostic Accuracy of Physical Examination, Imaging, and LRINEC Score: A Systematic Review and Meta-Analysis. Ann Surg. 2019;269(1):58–65. PMID 29672405. doi:10.1097/SLA.0000000000002774. Só o resumo.

### O que a fonte diz
- Wong 2004: seis exames (leucócitos, hemoglobina, sódio, glicose, creatinina, PCR), corte de 6, estudo retrospectivo de dois hospitais.
- Fernando 2019: 23 estudos, 5.982 pacientes. LRINEC 6 ou mais: sensibilidade de 68,2%, especificidade de 84,8%. LRINEC 8 ou mais: 40,8% e 94,9%. Os autores dizem que o escore tem sensibilidade ruim e não deve ser usado para descartar a doença. Na suspeita clínica alta, avaliação cirúrgica precoce.

### O que a ferramenta faria
Seis exames em faixas, soma e corte. As faixas e os pontos não foram lidos.

### Limites e riscos
- Um terço das fasceítes fica abaixo de 6. O uso mais provável na prática (tranquilizar com escore baixo) é justamente o que a meta-análise desaconselha.
- Na UPA, a conduta diante da suspeita é transferir para cirurgia; o escore não muda isso.

### Opções
- A: tela do LRINEC com aviso forte de que não descarta.
- B: uma linha na ficha das dermatoses: "na suspeita de infecção necrosante, escore laboratorial baixo não exclui; avaliação cirúrgica" (Fernando 2019).
- C (recomendada): não fazer a tela. Motivo: a fonte mais forte diz que ele não serve para o uso que a UPA faria dele.

### Não conferido no E11
- Faixas e pontos de cada exame.

---

## E12. Classificação de Roma (exacerbação de DPOC)

### Onde está
- A tela de DPOC classifica a exacerbação pelos sintomas cardinais da Tabela 1 do manual: `src/clinico/adulto/asmaDpoc.ts:272–277` (`classificarDpoc`, p. 418), com os cortes gasométricos do cap. 31 em `:290` em diante. Ficha `adulto-dpoc-exacerbacao` (`:41`); registry `registry.tsx:188`.

### Fontes
- Celli BR, Fabbri LM, Aaron SD, et al. An Updated Definition and Severity Classification of Chronic Obstructive Pulmonary Disease Exacerbations: The Rome Proposal. Am J Respir Crit Care Med. 2021;204(11):1251–1258. PMID 34570991. doi:10.1164/rccm.202108-1819PP. Não lido (sem resumo no PubMed, fora do PMC).
- Lee HJ, Lee JK, Park TY, et al. Validation of the Rome proposal for severity of acute exacerbation of chronic obstructive pulmonary disease. Ther Adv Respir Dis. 2023;17:17534666231172917. PMID 37338152. PMC10286168. doi:10.1177/17534666231172917. Texto completo.
- Zeng J, Zhou C, Yi Q, et al. Validation of the Rome Severity Classification of Chronic Obstructive Pulmonary Disease Exacerbation: A Multicenter Cohort Study. Int J Chron Obstruct Pulmon Dis. 2024;19:193–204. PMID 38249828. PMC10800102. doi:10.2147/COPD.S442382. Só o resumo.

### O que a fonte diz
- Lee 2023 (texto completo) descreve os critérios como usou: escala visual de dispneia 5 ou mais, FR 24 ou mais, FC 95 ou mais, SaO₂ em repouso e PCR 1 mg/dL ou mais. Leve: até 2 critérios. Moderada: mais de 2. Grave: hipercapnia (PaCO₂ > 45 mmHg) com acidose (pH < 7,35).
- O texto lido escreve "SaO₂ ⩾ 92%" como critério de gravidade. Parece erro de digitação (o esperado seria abaixo de 92%), mas a direção não foi conferida no Celli 2021.
- Em 740 eventos coreanos, a classe grave previu UTI (AUC 0,850), ventilação (0,870) e óbito hospitalar (0,779). Nenhum paciente leve teve desfecho adverso. Concordância com o DECAF e o GesEPOC foi baixa (kappa 0,18 e 0,17).
- Os autores dizem que a classificação não deve ser vista como versão final.
- Zeng 2024 (resumo): 7.712 internados na China. A gravidade previu UTI e ventilação; a mortalidade em 60 dias não diferiu entre moderada e grave.

### O que a ferramenta faria
Cinco critérios clínicos e laboratoriais e a gasometria, com saída leve, moderada ou grave. Exige PCR e gasometria arterial.

### Limites e riscos
- A definição original (Celli 2021) não foi lida; a única descrição lida é a de um estudo de validação, com um provável erro de digitação.
- Conviveria com a classificação do manual na mesma tela, com resultados diferentes para o mesmo paciente.
- Validado em internados e em PS com dispneia de 5 ou mais.

### Opções
- A: Roma ao lado da Tabela 1 do manual, depois de ler o Celli 2021.
- B: nota na tela de DPOC citando a validação, sem calcular.
- C (recomendada): não fazer agora. Motivo: a fonte primária não foi lida e a tela já tem a classificação do livro.

### Não conferido no E12
- Os critérios exatos do Celli 2021, incluindo a direção do corte de saturação e se há classe moderada por hipoxemia sem acidose.

---

## P6. Escore de Westley (crupe)

### Onde está
- A gravidade do crupe é a Tabela 6 do livro do ICr, qualitativa, sem pontuação: `src/clinico/pediatria/viasAereasSuperiores.ts:74–81` (`GRAVIDADE_CRUPE`). O comentário das linhas 5–6 registra que o livro não traz o Westley.
- A tela repete isso: `src/pages/plantonista/pediatria/ViasAereasSuperioresPed.tsx:31` ("O livro não traz o escore de Westley") e `:56` ("a tabela não tem pontuação e a tela não classifica").
- As doses do crupe são do ICr (`viasAereasSuperiores.ts:59–65`).

### Fontes
- Westley CR, Cotton EK, Brooks JG. Nebulized racemic epinephrine by IPPB for the treatment of croup: a double-blind study. Am J Dis Child. 1978;132(5):484–487. PMID 347921. doi:10.1001/archpedi.1978.02120300044008. Só o resumo, que não traz a pontuação.
- Aregbesola A, Tam CM, Kothari A, et al. Glucocorticoids for croup in children. Cochrane Database Syst Rev. 2023;1(1):CD001955. PMID 36626194. PMC9831289. doi:10.1002/14651858.CD001955.pub5. Só o resumo.
- Khemani RG, Schneider JB, Morzov R, et al. Pediatric upper airway obstruction: interobserver variability is the road to perdition. J Crit Care. 2013;28(4):490–497. PMID 23337481. PMC3644547. doi:10.1016/j.jcrc.2012.11.009. Só o resumo.

### O que a fonte diz
- O escore nasceu como desfecho de um ensaio com 20 crianças (Westley 1978), não como estudo de validação.
- A Cochrane 2023 trata de corticoide e usa escores de crupe como desfecho; não valida o Westley.
- Khemani 2013 (UTI pediátrica, pós-extubação): concordância entre observadores moderada para estridor (kappa 0,43) e tiragem (0,47), e ruim para cianose (0,01).

### O que a ferramenta faria
Cinco itens somados com faixas de gravidade. Itens, pesos e faixas não foram lidos.

### Limites e riscos
- Validação psicométrica fraca, como o levantamento já dizia.
- Criaria uma segunda classificação ao lado da Tabela 6 do ICr, que é a fonte das doses.

### Opções
- A: tela do Westley ao lado da Tabela 6, depois de ler a pontuação numa fonte aberta.
- B: uma linha na tela do crupe explicando por que o Westley não entrou (Khemani 2013).
- C (recomendada): não fazer. Motivo: o livro do ICr não usa o escore, a pontuação não foi lida e a confiabilidade entre observadores é moderada.

### Não conferido no P6
- Itens, pesos e faixas do Westley.

---

## P7. BRUE (evento breve resolvido e inexplicado)

### Onde está
- Não existe. A seção de pediatria é "até antes dos 14 anos; neonato só na icterícia e na reanimação em sala de parto" (`registry.tsx:79`). O BRUE é do lactente abaixo de 1 ano, e o critério de idade passa pelos 60 dias, o que inclui o neonato.

### Fontes
- Tieder JS, Bonkowsky JL, Etzel RA, et al. Brief Resolved Unexplained Events (Formerly Apparent Life-Threatening Events) and Evaluation of Lower-Risk Infants: Executive Summary. Pediatrics. 2016;137(5). PMID 27244836. doi:10.1542/peds.2016-0591. Não lido (sem resumo, fora do PMC).
- Nama N, Shen Y, Bone JN, et al. External Validation of Brief Resolved Unexplained Events Prediction Rules for Serious Underlying Diagnosis. JAMA Pediatr. 2025;179(2):188–196. PMID 39680379. PMC11791710. doi:10.1001/jamapediatrics.2024.4399. Só o resumo (o texto do PMC veio vazio).
- Hellström Schmidt S, Sotoca Fernandez J, Pronk CJ, Orfanos I. Etiology of apneic episodes in infants aged <1 year and validation of brief resolved unexplained events risk-stratification criteria without age as a risk factor. Front Pediatr. 2026;14:1731324. PMID 41756183. PMC12932530. doi:10.3389/fped.2026.1731324. Texto completo.

### O que a fonte diz
- Nama 2025 (resumo): 1.042 lactentes em 11 hospitais canadenses. Os critérios de maior risco da AAP classificaram 93,8% como maior risco. Para diagnóstico grave: sensibilidade de 100%, especificidade de 6,7%, AUC de 0,53. A nova regra de predição teve AUC de 0,71 após recalibração.
- Hellström Schmidt 2026 (texto completo) aplicou parte dos critérios da AAP: idade gestacional abaixo de 32 semanas, idade de 60 dias ou menos, doença crônica, RCP por profissional, sintomas respiratórios recentes. Não teve dados de idade pós-concepcional, história familiar e eventos repetidos. Os autores acham que a idade deveria ser reavaliada como critério.
- A lista completa dos critérios de menor risco da AAP não foi lida na fonte primária. O que está acima é de segunda mão.

### O que a ferramenta faria
Definição de BRUE e checklist de menor risco da AAP, com saída "menor risco" ou "maior risco". Sem dose.

### Limites e riscos
- Mais de 90% saem como "maior risco": a ferramenta quase nunca muda conduta.
- Entra na faixa neonatal, que a seção não cobre.
- A regra nova (Nama 2025) não foi lida e pede modelo de predição, não checklist.

### Opções
- A: checklist da AAP, depois de ler o Tieder 2016 e de o RT decidir o neonato.
- B: só a definição de BRUE como referência, sem estratificação.
- C (recomendada): não fazer agora. Motivo: fonte primária não lida, baixa especificidade e escopo neonatal fora da seção.

### Não conferido no P7
- Os critérios de menor risco da AAP 2016, palavra por palavra.
- A regra de predição do Nama 2025.

---

## P8. TEN-4-FACESp (hematomas suspeitos de maus-tratos)

### Onde está
- Não existe. A lista de notificação já tem "Violência doméstica e/ou outras violências" (`src/components/evolucao/lnnc.ts:70`, não imediata) e "Violência sexual e tentativa de suicídio" (`:71`, imediata).

### Fontes
- Pierce MC, Kaczor K, Lorenz DJ, et al. Validation of a Clinical Decision Rule to Predict Abuse in Young Children Based on Bruising Characteristics. JAMA Netw Open. 2021;4(4):e215832. PMID 33852003. PMC8047759. doi:10.1001/jamanetworkopen.2021.5832. Texto completo.
- Raut A, Pierce MC, Kaczor K, et al. Single Bruise Characteristics Associated With Abusive vs Accidental Injury. Pediatrics (online em 18/02/2025). PMID 39961331. doi:10.1542/peds.2024-067932. Só o resumo.

### O que a fonte diz
- Pierce 2021 (texto completo): estudo prospectivo em 5 PS pediátricos dos EUA. 21.123 crianças triadas, 2.161 com hematoma, 410 classificadas como maus-tratos por painel de especialistas.
- A regra é positiva se houver qualquer um destes três componentes, em criança abaixo de 4 anos com hematoma:
  - TEN: hematoma no tronco (tórax, abdome, dorso, nádegas, região genital), orelha ou pescoço;
  - FACES: frênulo, ângulo da mandíbula, bochecha (parte carnosa), pálpebra ou hemorragia subconjuntival;
  - 4: qualquer hematoma em lactente de 4,99 meses ou menos;
  - p: hematoma com padrão (mordida, alça, tapa, aperto, preensão, múltiplas linhas).
- Sensibilidade de 95,6%, especificidade de 87,1%, VPN de 98,8%, VPP de 63,9%. O desempenho não mudou muito pelo tom de pele.
- Os autores dizem que é rastreio, não diagnóstico, e que a regra não se aplica a criança sem hematoma.
- Raut 2025 (resumo): com hematoma único, sensibilidade de 81,5% e especificidade de 87,6%. Regra negativa deve ser lida com cautela.

### O que a ferramenta faria
Pergunta de entrada (criança abaixo de 4 anos com hematoma?) e os três componentes marcáveis. Saída: "regra positiva: indica avaliação para maus-tratos", com link para a notificação. Sem dose, sem pontuação.

### Limites e riscos
- Validação interna (bootstrap) em centros dos EUA; não há validação no Brasil entre as fontes lidas.
- Hematoma é mais difícil de ver em pele escura (o próprio estudo contou menos hematomas nesses grupos).
- Regra negativa não exclui maus-tratos, sobretudo com hematoma único.
- O fluxo legal de proteção da criança (Conselho Tutelar e rede local) não foi conferido aqui e é decisão do RT.

### Opções
- A (recomendada): escore novo na seção de pediatria (grupo "Trauma, toxicologia e acidentes"), com a regra completa do Pierce 2021 e o aviso de rastreio. Motivo: fonte lida inteira, sem dose, sem peso a conferir, alto valor clínico e barato no molde da `EscoreTela`.
- B: só a regra como texto de referência, sem marcação.
- C: não fazer.

### Não conferido no P8
- O texto completo do Raut 2025.
- O fluxo de notificação e proteção da criança (fora do PubMed).

---

## P9. TWIST (torção testicular)

### Onde está
- Não existe. Nada no app sobre escroto agudo ou torção.

### Fontes
- Barbosa JA, Tiseo BC, Barayan GA, et al. Development and initial validation of a scoring system to diagnose testicular torsion in children. J Urol. 2013;189(5):1859–1864. PMID 23103800. doi:10.1016/j.juro.2012.10.056. Só o resumo.
- Lewis S, Peeraully R, Ghazy E, et al. A systematic review and meta-analysis to inform the management of children and young people with acute testicular pain. BJU Int. 137(3):417–429 (online em 19/11/2025). PMID 41261439. doi:10.1111/bju.70080. Só o resumo.
- Valdivieso-Castro MP, Vázquez-Gómez L, Olabarri M, et al. Clinical Prediction Rules for Identifying Children With Testicular Torsion: A Multicenter Prospective Study. Pediatr Emerg Care. 2025;41(8):620–627. PMID 40231580. doi:10.1097/PEC.0000000000003394. Só o resumo.
- Wilson A, Louise J, Khurana S, et al. Performance of the TWIST Score Versus Clinical Acumen in the Diagnosis of Testicular Torsion in an Australian Paediatric Emergency Department. ANZ J Surg. 96(10):2959–2967 (online em 17/11/2025). PMID 41246924. doi:10.1111/ans.70388. Só o resumo.

### O que a fonte diz
- Barbosa 2013 (resumo; primeiro autor de Boston): edema testicular 2 pontos, testículo endurecido 2, reflexo cremastérico ausente 1, náusea ou vômito 1, testículo elevado 1. Máximo de 7. Cortes de risco baixo e alto em 2 e 5 pontos; ultrassom só no risco intermediário. Na coorte prospectiva, VPN e VPP de 100% nesses cortes.
- Lewis 2025 (resumo): 10 estudos do TWIST. Comparando alto risco (5–7) com baixo risco (0–2), sensibilidade de 94,2% e especificidade de 98%.
- Valdivieso-Castro 2025 (resumo): 903 crianças de 3 meses a 18 anos em 21 PS espanhóis. O TWIST classificou 37,9% como baixo risco. Um escore novo (TEST) classificou 63,6%.
- Wilson 2025 (resumo): 307 pacientes de 3 meses a 18 anos. AUC do TWIST no PS de 0,768, contra 0,866 da suspeita clínica do médico. Sem evidência de que o TWIST seja melhor que o julgamento clínico.

### O que a ferramenta faria
Cinco achados marcáveis, soma de 0 a 7. Faixas: 0–2 baixo, 3–4 intermediário, 5–7 alto (Barbosa 2013 e Lewis 2025). Saída de alto risco: "torção provável, avaliação cirúrgica urgente". Saída de baixo risco: "não dispensa avaliação". Sem dose.

### Limites e riscos
- O valor do escore está nos extremos; o intermediário não decide nada.
- No PS, não foi melhor que a suspeita clínica (Wilson 2025).
- A torção é comum no adolescente. A seção de pediatria do app vai até 13a 11m 29d; o adolescente de 14 anos ou mais cai no adulto, e os estudos vão até 18 anos (Lewis até 25). Se for só pediatria, metade da faixa validada fica de fora. Decidir o público (criança, adulto ou ambos) é do RT.
- Na UPA sem ultrassom, o risco é usar o baixo risco para não transferir. O texto da tela precisa impedir isso.

### Opções
- A (recomendada): escore com as três faixas, público a decidir pelo RT, com o aviso de que baixo risco não dispensa avaliação. Motivo: pontos e cortes lidos na derivação, sem dose, barato.
- B: só a tabela de pontos como referência, sem saída.
- C: não fazer.

### Não conferido no P9
- O texto completo de todas as fontes. Se "2 pontos" no Barbosa é "2 ou menos" (o resumo diz "cortes de 2 e 5"; a meta-análise usa 0–2 e 5–7).

---

## P10. Peso de emergência na criança

### Onde está
- "Doses por peso" pede "Peso aferido ou estimado", sem dizer como estimar: `src/pages/plantonista/pediatria/BolusPediatrico.tsx:80`.
- A dengue da criança calcula peso aproximado pela idade, pela fórmula do MS (Apêndice B, p. 71): `src/clinico/pediatria/denguePed.ts:46–47`. A tela diz "só quando não for possível pesar" (`DenguePed.tsx:140`).
- A via aérea tem a tabela de equipamento por idade e peso do ICr (`src/clinico/pediatria/viaAerea.ts:67`).

### Fonte
- Wells M, Goldstein LN, Bentley A. The accuracy of emergency weight estimation systems in children: a systematic review and meta-analysis. Int J Emerg Med. 2017;10(1):29. PMID 28936627. PMC5608658. doi:10.1186/s12245-017-0156-5. Só o resumo.

### O que a fonte diz
- Proposta de exatidão mínima: 70% das estimativas dentro de 10% do peso real e 95% dentro de 20%.
- Métodos mais exatos: Mercy (70,9% e 95,3%), fita PAWPER (78,0% e 96,6%) e estimativa dos pais (69,8% e 87,1%). Broselow: 55,6% e 81,2%.
- Fórmulas por idade tiveram exatidão muito baixa; os autores recomendam abandoná-las.
- Fórmulas por idade e por comprimento erram em sentidos diferentes em países de renda alta e de renda baixa ou média.

### O que a ferramenta faria
Não uma calculadora. Uma referência curta: pesar sempre; se não der, a ordem de preferência das fontes lidas.

### Limites e riscos
- Mercy e PAWPER pedem fita ou medidas que a UPA pode não ter.
- A fórmula da dengue é do MS e é a fonte daquela tela. A meta-análise vai contra fórmulas por idade em geral. Mexer na dengue seria trocar documento oficial por meta-análise; não é o caso.

### Opções
- A: calculadora de peso estimado. Não recomendada: as fórmulas que caberiam numa calculadora são as por idade, que a fonte manda abandonar.
- B (recomendada): nota em "Doses por peso": pesar sempre; se não for possível, a estimativa dos pais foi mais exata que a fita de Broselow e muito mais que fórmula por idade (Wells 2017). Na dengue, uma nota de divergência ao lado da fórmula do MS, sem trocá-la. Motivo: barato, sem dose, e corrige um campo que hoje não orienta.
- C: não fazer.

### Não conferido no P10
- O texto completo do Wells 2017 (subgrupos por país).

---

## P11. Tétano e raiva na criança

### Onde está
- Só no adulto. `src/clinico/adulto/profilaxiaPosExposicao.ts`, fichas `adulto-tetano-profilaxia` (linha 30) e `adulto-raiva-pos-exposicao` (linha 186). As telas dizem "Adulto (14 anos ou mais)": `src/pages/plantonista/manual/ProfilaxiasPosExposicaoAdulto.tsx:37` e `:121`. Registry `registry.tsx:171–172`.
- Fontes do MS já transcritas na tela de adulto, lidas em PDF em 28/09/2026: Guia de Vigilância em Saúde 2024, tétano (linhas 21–24); Notas Técnicas 8/2022, 134/2022 e 35/2026, raiva (linhas 165–181).
- Algumas linhas dessa transcrição já citam a criança ou o peso: o antibiótico do Quadro 3 do GVS traz uma dose para criança (linha 40); a vacina antirrábica cita o vasto lateral abaixo de 2 anos (linha 233); soro e imunoglobulina antirrábicos são por kg (linhas 214–221).
- Na seção de pediatria não há nada de tétano nem de raiva.

### Fontes
- Documentos do MS (não indexados no PubMed): Guia de Vigilância em Saúde, 6ª ed. revisada, 2024, vol. 1, cap. Tétano acidental; Notas Técnicas nº 8/2022 e nº 134/2022-CGZV/DEIDT/SVS/MS; Nota Técnica Conjunta nº 35/2026. Não foram abertos nesta revisão.

### O que a fonte diz
Não conferido nesta revisão. O que o app já transcreveu foi lido em 28/09/2026 para o adulto; não foi conferido agora se cada linha vale para todas as idades. Nenhuma dose está escrita aqui de propósito.

### O que a ferramenta faria
Duas telas na pediatria, ou as telas de adulto abertas para a criança, só com as linhas que o MS escreve para a criança ou para todas as idades:
- raiva: tipo de exposição, animal, conduta (vacina, soro ou observação) e soro ou imunoglobulina por kg;
- tétano: ferimento × situação vacinal, com o esquema pela idade da criança.

### Limites e riscos
- Regra do projeto: dose da criança só do MS, nunca convertida do adulto. Nada pode ser reaproveitado da tela de adulto sem conferir no PDF que a linha vale para a criança.
- A situação vacinal da criança segue o calendário (vacina diferente por idade). Isso não está no app e não foi lido.
- Peso: a dose por kg depende do peso da criança; vale a nota do P10.

### Opções
- A (recomendada): telas pediátricas de raiva e tétano, depois de ler de novo os PDFs do MS procurando as linhas para criança e o calendário vacinal. Motivo: agravo frequente na UPA, as fontes são oficiais e já usadas no app, e hoje a criança não tem nada.
- B: um aviso na seção de pediatria apontando para as telas de adulto. Não recomendado: leva a criança para uma tela com dose de adulto.
- C: esperar.

### Não conferido no P11
- Todos os documentos do MS, nesta revisão.

---

## A11. Risco de suicídio

### Onde está
- Só a notificação: "Violência sexual e tentativa de suicídio", imediata (`src/components/evolucao/lnnc.ts:71`). A ficha de violência interpessoal/autoprovocada é citada na PEP (`src/clinico/adulto/pepHiv.ts:137`).
- Não há triagem, avaliação de risco nem plano de segurança.

### Fontes
- Miller IW, Camargo CA, Arias SA, et al. Suicide Prevention in an Emergency Department Population: The ED-SAFE Study. JAMA Psychiatry. 2017;74(6):563–570. PMID 28456130. PMC5539839. doi:10.1001/jamapsychiatry.2017.0678. Só o resumo.
- Horowitz LM, Bridge JA, Teach SJ, et al. Ask Suicide-Screening Questions (ASQ): a brief instrument for the pediatric emergency department. Arch Pediatr Adolesc Med. 2012;166(12):1170–1176. PMID 23027429. PMC6889955. doi:10.1001/archpediatrics.2012.1276. Só o resumo.
- Goklish NA, Haroz EE, Dayal RR, et al. Combining Machine Learning Models and Screening to Enhance Suicide Risk Identification for American Indian Patients: Retrospective Cohort Study. J Med Internet Res. 2026;28:e82669. PMID 42114005. PMC13160258. doi:10.2196/82669. Só o resumo.

### O que a fonte diz
- ED-SAFE: 8 PS dos EUA, 1.376 adultos com tentativa ou ideação recente. A triagem universal sozinha não mudou nada (23% × 22% de tentativa em 52 semanas). A triagem com intervenção (avaliação pelo médico, recursos na alta e ligações depois) reduziu o risco absoluto em 5 pontos (23% × 18%) e o total de tentativas em 30%.
- ASQ 2012: quatro perguntas, 524 pacientes de 10 a 21 anos. Sensibilidade de 96,9% e especificidade de 87,6% contra um questionário de ideação.
- Goklish 2026: em adultos de um PS do serviço indígena dos EUA, o ASQ teve sensibilidade de 0,178 para tentativa ou morte em 90 dias.
- A busca no PubMed não achou validação do ASQ em português do Brasil.

### O que a ferramenta faria
Triagem curta, avaliação de risco e roteiro de plano de segurança, com encaminhamento para a rede (CAPS, RAPS) e notificação. Sem dose.

### Limites e riscos
- Triagem sozinha não reduziu tentativas; o que reduziu foi o pacote com seguimento por telefone, que a UPA não faz.
- Sem instrumento validado em português entre as fontes achadas.
- A sensibilidade do ASQ em adulto foi muito baixa num estudo.
- Tema com peso legal e de rede; o fluxo local é do RT e da coordenação, não de uma fonte do PubMed.

### Opções
- A: ficha de triagem e plano de segurança, depois de uma fonte brasileira lida (MS ou instrumento validado em português).
- B: uma linha no registro da notificação lembrando o encaminhamento à rede local.
- C (recomendada): não fazer a ficha agora. Motivo: sem instrumento validado em português e com evidência de que triagem isolada não muda desfecho.

### Não conferido no A11
- Texto completo das três fontes. Documentos do MS sobre o tema (não buscados fora do PubMed).

---

## A12. Epistaxe

### Onde está
- Não há ficha. A epistaxe aparece em três lugares:
  - como sangramento menor na reversão de anticoagulação (`src/clinico/adulto/reversaoAnticoagulacao.ts:188`);
  - como sangramento mucoso na hemofilia da criança, com dose de fator do ICr (`src/clinico/pediatria/hemostasiaTromboPed.ts:66`);
  - como limiar de plaquetas na oncologia da criança (`src/clinico/pediatria/oncologiaPed.ts:166`).

### Fontes
- Tunkel DE, Anne S, Payne SC, et al. Clinical Practice Guideline: Nosebleed (Epistaxis). Otolaryngol Head Neck Surg. 2020;162(1_suppl):S1–S38. PMID 31910111. doi:10.1177/0194599819890327. Só o resumo estendido.
- Reuben A, Appelboam A, Stevens KN, et al. The Use of Tranexamic Acid to Reduce the Need for Nasal Packing in Epistaxis (NoPAC): Randomized Controlled Trial. Ann Emerg Med. 2021;77(6):631–640. PMID 33612282. doi:10.1016/j.annemergmed.2020.12.013. Só o resumo.
- Fatahi M, Aghajani S, Samadi Y, Sadaqat A. A meta-analysis on the efficacy of topical tranexamic acid for epistaxis: Does the method of administration affect the success rate? Australas Emerg Care. 2026;29(4):343–353. PMID 42297643. doi:10.1016/j.auec.2026.06.001. Só o resumo.

### O que a fonte diz
- AAO-HNS 2020 (resumo): vale para 3 anos ou mais. Entre as recomendações:
  - separar quem precisa de manejo imediato;
  - compressão firme do terço inferior do nariz por 5 minutos ou mais;
  - tamponamento se o ponto não for visto;
  - tampão reabsorvível em quem tem distúrbio de coagulação ou usa anticoagulante ou antiagregante;
  - registrar fatores de risco (distúrbio de coagulação, anticoagulante, antiagregante, droga intranasal);
  - rinoscopia anterior;
  - sem sangramento com risco de vida, tratamento local antes de transfundir, reverter ou suspender o anticoagulante.
- NoPAC (resumo): 496 adultos em 26 PS do Reino Unido. Tranexâmico tópico em rolete de algodão não reduziu o tamponamento (43,7% × 41,3%).
- Fatahi 2026 (resumo): 18 estudos, 2.760 pacientes. Mais parada do sangramento em 10 minutos (OR 2,54) e menos ressangramento. O efeito dependeu da técnica: gaze embebida funcionou; spray, não.

### O que a ferramenta faria
Referência sem dose: os passos da AAO-HNS e o tranexâmico tópico como divergência entre o ensaio e a meta-análise. Nenhuma dose de tranexâmico foi lida.

### Limites e riscos
- A diretriz foi lida só no resumo.
- O tranexâmico tópico tem resultado conflitante; sem dose lida, não entra como conduta.
- A criança de 3 anos ou mais está na diretriz, mas a regra do projeto pede fonte pediátrica própria para qualquer dose.

### Opções
- A: ficha de epistaxe no adulto, depois de ler a diretriz inteira.
- B (recomendada): nota na reversão de anticoagulação com a recomendação da AAO-HNS (tratamento local antes de reverter ou suspender o anticoagulante, fora do risco de vida) e uma referência curta de passos, sem dose. Motivo: barato, sem dose, e evita reversão desnecessária num caso comum.
- C: não fazer.

### Não conferido no A12
- O texto completo da AAO-HNS 2020.
- Qualquer dose de tranexâmico tópico.

---

## A13. Pneumotórax espontâneo

### Onde está
- Só o pneumotórax hipertensivo do trauma: punção e dreno (`src/clinico/adulto/trauma.ts:294`, p. 644 do manual).
- Aparece também como causa na ventilação mecânica (`src/clinico/adulto/ventilacaoMecanica.ts:188` e `:504`, DOPE) e como exclusão no HEART (`src/clinico/escores/heart.ts:57`).
- Não há conduta do pneumotórax espontâneo.

### Fontes
- Roberts ME, Rahman NM, Maskell NA, et al. British Thoracic Society Guideline for pleural disease. Thorax. 2023;78(Suppl 3):s1–s42. PMID 37433578. doi:10.1136/thorax-2022-219784. Há também a versão de Thorax. 2023;78(11):1143–1156, PMID 37553157, doi:10.1136/thorax-2023-220304 (o DOI do levantamento). Não lida: sem resumo e fora do PMC.
- Brown SGA, Ball EL, Perrin K, et al. Conservative versus Interventional Treatment for Spontaneous Pneumothorax. N Engl J Med. 2020;382(5):405–415. PMID 31995686. doi:10.1056/NEJMoa1910775. Só o resumo.

### O que a fonte diz
- Brown 2020 (resumo): 316 pacientes de 14 a 50 anos, primeiro pneumotórax espontâneo primário, unilateral, moderado a grande. Reexpansão em 8 semanas em 98,5% com intervenção e 94,4% com conduta conservadora, dentro da margem de não inferioridade. Na análise que contou os dados faltantes como falha, a diferença saiu da margem. Menos eventos adversos graves e menos recidiva no grupo conservador.
- A BTS 2023 não foi lida.

### O que a ferramenta faria
Fluxo de conduta (observação, aspiração ou dreno) por tipo de pneumotórax, sintomas e tamanho. Os critérios de tamanho e de escolha estão na BTS, não lida.

### Limites e riscos
- O único dado lido vem de um ensaio em jovens com pneumotórax primário. Não serve para o secundário (DPOC, por exemplo).
- A UPA geralmente estabiliza e transfere; a conduta definitiva não é dela.

### Opções
- A: ficha de pneumotórax espontâneo, depois de ler a BTS 2023.
- B: nada no trauma (o hipertensivo já está lá).
- C (recomendada): esperar a BTS 2023. Motivo: sem a diretriz, não há critério de tamanho nem de conduta lido.

### Não conferido no A13
- A BTS 2023 inteira. O texto completo do Brown 2020.

---

## Prioridade e ordem sugerida

Prioridade:
- Alta: P8 (TEN-4-FACESp) e P11 (tétano e raiva na criança). O primeiro tem fonte inteira lida e alto valor; o segundo cobre um buraco real na pediatria.
- Média: P9 (TWIST), E8 (FAST-ED), P10 (nota de peso), A12 (nota de epistaxe).
- Baixa ou não fazer: E7 (até a tabela), E9, E10, E11, E12, P6, P7, A11, A13.

Ordem de execução, do mais barato e seguro para o que depende de leitura:
1. P8 TEN-4-FACESp: sem dose, sem peso a conferir, fonte inteira lida.
2. P9 TWIST: sem dose; pontos e cortes no resumo da derivação. Antes, o RT decide o público (criança, adulto ou ambos).
3. P10 nota de peso em "Doses por peso" e A12 nota na reversão de anticoagulação: só texto com fonte.
4. E8 FAST-ED: depois de conferir a tabela de pontos no Lima 2016. O RACE sai do backlog na mesma decisão.
5. P11 tétano e raiva na criança: depois de reler os PDFs do MS procurando as linhas para criança e o calendário.
6. E7 AIR: só quando houver a tabela de pontos.
7. Os demais ficam como C até haver fonte ou pedido novo.

Cada um em branch e PR próprios, com os testes antes. Fichas novas vão para o banco por migration gerada com `scripts/fichas-sql.mjs`, testada na homologação, e entram na fila de aprovação do RT.

---

## Resumo do que ficou sem conferir
1. Tabela de pontos do AIR e definição de cada ponto do FAST-ED (tabelas fora do texto do PMC).
2. Itens e pesos do Pádua, do EDACS, do LRINEC e do Westley.
3. Celli 2021 (Roma), incluindo a direção do corte de saturação.
4. Tieder 2016 (BRUE) e a regra do Nama 2025.
5. Documentos do MS de tétano e raiva, para a criança.
6. Texto completo da AAO-HNS 2020 e qualquer dose de tranexâmico tópico.
7. BTS 2023 (pneumotórax).
8. Fluxo legal de proteção da criança e rede de saúde mental (fora do PubMed).

---

## Decisões do RT

| # | Item | Opção recomendada | Decisão do RT |
|---|---|---|---|
| E7 | AIR | C agora; A quando houver a tabela de pontos | |
| E8 | FAST-ED | A, como única escala de oclusão de grande vaso, com a tabela conferida antes; RACE sai do backlog | |
| E9 | Pádua | C | |
| E10 | EDACS | C | |
| E11 | LRINEC | C | |
| E12 | Roma | C | |
| P6 | Westley | C | |
| P7 | BRUE | C | |
| P8 | TEN-4-FACESp | A | |
| P9 | TWIST | A, com o público decidido pelo RT | |
| P10 | Peso de emergência | B (nota em "Doses por peso"; divergência na dengue sem trocar a fórmula do MS) | |
| P11 | Tétano e raiva na criança | A, depois de reler os PDFs do MS | |
| A11 | Risco de suicídio | C | |
| A12 | Epistaxe | B (nota na reversão de anticoagulação e referência sem dose) | |
| A13 | Pneumotórax espontâneo | C | |
