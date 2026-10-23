# Lacunas da Central do Plantonista — o que falta e o que atualizar

Pedido do RT de 23/10/2026: avaliar com o PubMed o que falta em **Condutas e cálculos — adulto**,
**Pediatria** e **Escores**, e propor ferramentas novas e melhorias no mesmo molde de frontend
(leitura de manual, opção C da revisão visual 3.8). Pesquisa só de leitura: nenhuma ferramenta
foi criada nem alterada.

**Como foi feito.** Três levantamentos em paralelo (adulto, pediatria, escores). Cada um leu o
registry (`src/content/registry.tsx`), os grupos (`src/content/gruposSecoes.ts`), as fichas em
`src/clinico/**` e as telas em `src/pages/plantonista/**` para não propor o que já existe, e
buscou no PubMed a diretriz ou o estudo de validação de cada proposta. Seis fontes centrais foram
reconferidas pelos metadados do PubMed (AHA 2025 Part 9, PECARN coluna cervical 2024, SOFA-2,
Cockcroft-Gault, ACC/AHA 2025 SCA, validação PECARN 2024).

**Regras que valem para tudo abaixo** (CLAUDE.md e ADR 0007): dose só de fonte citada, com
página ou tabela; nunca converter dose do adulto para a criança; pediatria até 13a 11m 29d; a
ferramenta apoia, não prescreve. Diretrizes não indexadas no PubMed (PCDT do MS, manual do HC,
GOLD, NICE) e os endossos marcados "a conferir" precisam ser lidos no texto antes de entrar.

Nada aqui entra sem decisão do RT: cada item precisa ir ao `BACKLOG.md` com prioridade e fase.

---

## 1. Condutas e cálculos — adulto

### P1 (frequente e de alto risco na UPA)

| # | Proposta | Tipo | Grupo | O que entra e o que sai | Fonte principal (PubMed) |
|---|---|---|---|---|---|
| A1 | **SCA — conduta inicial na UPA**, com o Sgarbossa modificado (Smith) para BRE ou marca-passo | conduta + calculadora | Cardiovascular | tipo de SCA, início dos sintomas, tempo até a ICP, peso, ClCr, anticoagulante em uso; sai ICP ou fibrinólise (link para `fibrinoliticos-adulto`), equivalentes de IAMCSST, carga de antiagregante com dose da tabela e página da diretriz, anticoagulação (link para `anticoagulacao-plena-adulto`) | ACC/AHA/ACEP 2025 [DOI](https://doi.org/10.1161/CIR.0000000000001309); ESC 2023 [DOI](https://doi.org/10.1093/eurheartj/ehad191); Smith 2012 [DOI](https://doi.org/10.1016/j.annemergmed.2012.07.119) |
| A2 | **Clearance de creatinina (Cockcroft-Gault)** | calculadora | Digestivo, fígado e rim (ou Nefrologia nos escores) | idade, sexo, peso (real; ideal ou ajustado como opção), creatinina; sai ClCr em mL/min e os cortes que outras telas usam | Cockcroft e Gault 1976 [DOI](https://doi.org/10.1159/000180580); DOAC por CG × CKD-EPI [DOI](https://doi.org/10.1002/jcph.2283) |
| A3 | **QTc** (Bazett, Fridericia, Framingham, Hodges) | calculadora | Parada, ritmo e choque | QT, FC ou RR, sexo; sai QTc nas quatro fórmulas e alerta acima de 500 ms ou aumento acima de 60 ms | AHA/ACCF 2010 [DOI](https://doi.org/10.1161/CIRCULATIONAHA.109.192704); AHA 2020 [DOI](https://doi.org/10.1161/CIR.0000000000000905) |
| A4 | **ITU no adulto** — cistite, pielonefrite, ITU complicada | conduta | Digestivo, fígado e rim (ou grupo novo "Infecções") | sexo, gestação, sinais sistêmicos, risco de resistência, ClCr; sai esquema com dose do manual HC, duração e troca EV→VO, com aviso de resistência local | IDSA 2025 cUTI: empírico [DOI](https://doi.org/10.1093/cid/ciaf460), duração [DOI](https://doi.org/10.1093/cid/ciaf462), EV→VO [DOI](https://doi.org/10.1093/cid/ciaf461) |
| A5 | **PEP de HIV** (sexual, violência sexual, ocupacional) | conduta | Toxicologia e profilaxias | exposição, horas (até 72 h), fonte, gestação, ClCr; sai indicação e o esquema do PCDT PEP do MS; na violência sexual, checklist de IST, contracepção, hepatite B e notificação | PCDT PEP do MS (não indexado); CDC 2025 [DOI](https://doi.org/10.15585/mmwr.rr7401a1) |
| A6 | **Cefaleia aguda** — sinais de alarme (SNNOOP10) e conduta inicial | referência + conduta | Neurológico | checklist; sai indicação de TC ou punção (ACEP 2019) e analgesia da enxaqueca com dose do manual HC | SNNOOP10 [DOI](https://doi.org/10.1212/WNL.0000000000006697); ACEP 2019 [DOI](https://doi.org/10.1016/j.annemergmed.2019.07.009) — consenso, validação limitada |

### P2

| # | Proposta | Tipo | Grupo | Resumo | Fonte |
|---|---|---|---|---|---|
| A7 | **Cólica renal** — analgesia, sinais de alarme, alta, escore STONE | conduta | Digestivo, fígado e rim | AINE como primeira linha; tansulosina com evidência conflitante, mostrada como divergência | metanálise [DOI](https://doi.org/10.1016/j.eururo.2017.11.001); STONE [DOI](https://doi.org/10.1136/bmj.g2191); Meltzer 2018 [DOI](https://doi.org/10.1001/jamainternmed.2018.2259) |
| A8 | **Intermação** | conduta | Trauma e ambientais | imersão em água fria com meta e taxa; sem antitérmico | WMS 2024 [DOI](https://doi.org/10.1177/10806032241227924) |
| A9 | **Queimadura no adulto** — superfície e reposição | calculadora | Trauma e ambientais | regra dos 9 ou Lund-Browder; volume pela faixa da ABA e do manual HC a partir da hora da queimadura | ABA [DOI](https://doi.org/10.1093/jbcr/irad125) |
| A10 | **Meningite bacteriana no adulto** | conduta | Neurológico | dexametasona, esquema empírico com dose do manual HC e da ESCMID, aciclovir, quimioprofilaxia | ESCMID 2016 [DOI](https://doi.org/10.1016/j.cmi.2016.01.007) — antiga; NICE 2024 não indexada |

### P3

| # | Proposta | Fonte |
|---|---|---|
| A11 | **Risco de suicídio** — triagem e plano de segurança (evidência fraca em adulto de PS) | ED-SAFE [DOI](https://doi.org/10.1001/jamapsychiatry.2017.0678) |
| A12 | **Epistaxe** (ensaios de tranexâmico heterogêneos) | AAO-HNS 2020 [DOI](https://doi.org/10.1177/0194599819890327) |
| A13 | **Pneumotórax espontâneo** | BTS 2023 [DOI](https://doi.org/10.1136/thorax-2023-220304); Brown 2020 [DOI](https://doi.org/10.1056/NEJMoa1910775) |

### Melhorias em ferramentas que já existem

| Ferramenta | Onde | O que atualizar | Fonte |
|---|---|---|---|
| `pcr-adulto` | `src/clinico/adulto/pcr.ts:100` | o texto diz que a AHA 2025 não pôde ser aberta: ela está indexada; conferir doses e incluir a dupla desfibrilação sequencial | AHA 2025 Part 9 [DOI](https://doi.org/10.1161/CIR.0000000000001376) |
| `hidantalizacao` (estado de mal) | `src/clinico/adulto/estadoDeMal.ts:50-60` | segunda linha sem levetiracetam (ESETT: equivalente); conferir se o manual HC traz | ESETT [DOI](https://doi.org/10.1056/NEJMoa1905795); AES 2016 [DOI](https://doi.org/10.5698/1535-7597-16.1.48) |
| `emergencia-hipertensiva-adulto` | `src/clinico/adulto/emergenciaHipertensiva.ts:44,71,96` | sulfato de magnésio na pré-eclâmpsia grave sem dose | ACOG PB 222 [DOI](https://doi.org/10.1097/AOG.0000000000003891) |
| `anafilaxia-adulto` | `src/clinico/adulto/anafilaxia.ts:9` | só o manual HC; acrescentar critérios, observação e reação bifásica ao lado do livro | WAO 2020 [DOI](https://doi.org/10.1016/j.waojou.2020.100472); Practice Parameter 2023 [DOI](https://doi.org/10.1016/j.anai.2023.09.015) |
| `reversao-anticoagulacao-adulto` | `src/clinico/adulto/reversaoAnticoagulacao.ts:8-9` | andexanete: ANNEXA-I com mais trombose, entra como divergência | ANNEXA-I [DOI](https://doi.org/10.1056/NEJMoa2313040) |
| `insuficiencia-cardiaca-aguda-adulto` | `insuficienciaCardiacaAguda.ts:46` | atualização focada ESC 2023 | [DOI](https://doi.org/10.1093/eurheartj/ehad195) |

**Divergências já existentes para o RT olhar (não são erro, são indicação):** a nitroglicerina
aparece em µg/kg/min na tela de infusões e em µg/min na emergência hipertensiva e na IC aguda; as
faixas de midazolam e quetamina do estado de mal passam do teto da tela de infusões, que então
não calcula.

---

## 2. Pediatria

### P1

| # | Proposta | Tipo | Grupo | Resumo | Fonte | Faixa validada |
|---|---|---|---|---|---|---|
| P1 | **Lactente febril 8–60 dias** (AAP 2021 + regra PECARN) | melhoria de `febre-sem-sinais-ped` | Infecções | estratos por idade e marcadores (PCT, CAN, PCR); caminho "sem PCR/PCT"; doses seguem no ICr | AAP 2021 [DOI](https://doi.org/10.1542/peds.2021-052228); PECARN 2019 [DOI](https://doi.org/10.1001/jamapediatrics.2018.5501) — sensível, pouco específica | a termo, 8–60 dias |
| P2 | **PECARN — coluna cervical (2024)** | escore | Trauma, toxicologia e acidentes | alto risco e risco não desprezível; sai imagem ou nenhuma imagem; sem dose | Leonard 2024 [DOI](https://doi.org/10.1016/S2352-4642(24)00104-4) — sensibilidade 94,3%, VPN 99,9% | 0–17 anos |
| P3 | **PECARN — trauma abdominal fechado** | escore | Trauma, toxicologia e acidentes | 7 achados; sai risco muito baixo ou não | Holmes 2013 [DOI](https://doi.org/10.1016/j.annemergmed.2012.11.009); validação 2024 [DOI](https://doi.org/10.1016/S2352-4642(24)00029-4) — sensibilidade e VPN 100% | < 18 anos |
| P4 | **Apendicite pediátrica (pARC)** | escore | Triagem e escores | probabilidade e estratos; coeficientes só do texto integral | Kharbanda 2018 [DOI](https://doi.org/10.1542/peds.2017-2699); Cotton 2019 [DOI](https://doi.org/10.1016/j.annemergmed.2019.04.023) | ≥ 5 anos |
| P5 | **Dor na criança** — FLACC, FPS-R, escala numérica | escore (reaproveita `src/clinico/triagem/dor.ts`) | Doses e infusões | escala pela idade; sai nota e faixa, com link para analgésicos do ICr | Birnie 2019 [DOI](https://doi.org/10.1097/j.pain.0000000000001377) | FLACC 0–7/10 anos; FPS-R e NRS ≥ 6 anos |

### P2

| # | Proposta | Fonte | Ressalva |
|---|---|---|---|
| P6 | **Escore de Westley** (crupe), ao lado da Tabela 6 do ICr | Cochrane 2023 [DOI](https://doi.org/10.1002/14651858.CD001955.pub5) | validação psicométrica fraca |
| P7 | **BRUE** — critérios de menor risco (AAP 2016) | Tieder 2016 [DOI](https://doi.org/10.1542/peds.2016-0591); validação 2025 [DOI](https://doi.org/10.1001/jamapediatrics.2024.4399) | especificidade de 6,7% na validação |
| P8 | **TEN-4-FACESp** — hematomas suspeitos de maus-tratos, com notificação | Pierce 2021 [DOI](https://doi.org/10.1001/jamanetworkopen.2021.5832) | validação interna, centros dos EUA; < 4 anos |
| P9 | **TWIST** — torção testicular | Valdivieso-Castro 2025 [DOI](https://doi.org/10.1097/PEC.0000000000003394) | 3 meses a 18 anos |
| P10 | **Peso de emergência** — referência (pesado > pais > fita > Broselow) | Wells 2017 [DOI](https://doi.org/10.1186/s12245-017-0156-5) | evidência fraca para o Brasil |
| P11 | **Tétano e raiva na criança** — doses só do MS | MS (não indexado) | não converter do adulto |

### P3 (dependem de decisão de escopo)

- **Icterícia neonatal (AAP 2022)** [DOI](https://doi.org/10.1542/peds.2022-058859) e **reanimação neonatal
  2025** [DOI](https://doi.org/10.1161/CIR.0000000000001367): a seção hoje é "sem neonato"
  (`registry.tsx:77`); só entram se o RT incluir o neonato.
- **Critérios de Kocher**: evidência conflitante; no máximo uma nota em `artrite-osteomielite-ped`.

### Melhorias em ferramentas que já existem

| Ferramenta | Onde | O que atualizar | Fonte |
|---|---|---|---|
| Kawasaki | `src/clinico/pediatria/kawasaki.ts:3-6` | algoritmo AHA 2017; existe AHA 2024 (alto risco de aneurisma, terapia intensificada) | AHA 2024 [DOI](https://doi.org/10.1161/CIR.0000000000001295) |
| RCP pediátrica | `RcpPediatrica.tsx:76` | diz que o PALS 2025 não foi aberto: está indexado | PALS 2025 [DOI](https://doi.org/10.1161/CIR.0000000000001368) |
| Crise hipertensiva | `criseHipertensivaPed.ts:5-7` | o médico digita p90/p95; calcular pelas tabelas AAP 2017 com o percentil de estatura de `crescimento/lms.ts` | Flynn 2017 [DOI](https://doi.org/10.1542/peds.2017-1904) |
| PECARN TCE | `tceDecisao.ts:13-44`; `registry.tsx:91-92` | acrescentar a validação 2024 e trocar a descrição genérica | [DOI](https://doi.org/10.1016/S2352-4642(24)00029-4) |
| Alvarado | `registry.tsx:251` | aviso de que na criança tem mais falso positivo, com link para o pARC | [DOI](https://doi.org/10.1055/s-0040-1710534) |

---

## 3. Escores (adulto)

### P1

| # | Escore | Grupo | Desempenho | Fonte | Aviso na tela |
|---|---|---|---|---|---|
| E1 | **Regras de Ottawa — tornozelo e pé** | Trauma | metanálise: sensibilidade 0,92, LR− 0,13 | derivação [DOI](https://doi.org/10.1016/s0196-0644(05)82656-3); validação [DOI](https://doi.org/10.1001/jama.269.9.1127) | só descarta fratura; não vale em intoxicado |
| E2 | **Regra de Ottawa — joelho** | Trauma | sensibilidade 0,98–0,99 | derivação [DOI](https://doi.org/10.1016/s0196-0644(95)70106-0); metanálise [DOI](https://doi.org/10.1007/s00330-020-06804-x) | não avalia ligamento nem menisco |
| E3 | **RACE** — suspeita de oclusão de grande vaso no AVC | Neurologia | ≥ 5: sensibilidade 0,75–0,85 | derivação [DOI](https://doi.org/10.1161/STROKEAHA.113.003071); metanálise 2026 [DOI](https://doi.org/10.1161/JAHA.125.048588) | não substitui angio-TC; ~25% de falso negativo |
| E4 | **Centor / McIsaac** — faringite (adulto) | grupo novo "Infectologia" | AUC ~0,7 | McIsaac/Centor metanálise [DOI](https://doi.org/10.3399/bjgp20X708833) | orienta teste rápido, não prescreve |
| E5 | **4AT** — delirium no idoso no PS | grupo novo "Geriatria e fragilidade" (ou Neurologia) | LR+ 7,5, LR− 0,18 no PS | metanálise PS 2024 [DOI](https://doi.org/10.1111/acem.14935) | rastreio, não diagnóstico |

(O Cockcroft-Gault e o Sgarbossa também apareceram aqui; estão em A2 e A1.)

### P2 e P3

| # | Escore | Situação |
|---|---|---|
| E6 | **Escala Clínica de Fragilidade (CFS)** — P2 | PS: AUC 0,82 para óbito em 30 dias [DOI](https://doi.org/10.1016/j.annemergmed.2025.05.018); não é critério de recusa de UTI |
| E7 | **AIR** — apendicite, ao lado do Alvarado — P2 | derivação AUC 0,93 [DOI](https://doi.org/10.1007/s00268-008-9649-y) |
| E8 | **FAST-ED** — alternativa ao RACE (autores brasileiros) — P2 | [DOI](https://doi.org/10.1161/STROKEAHA.116.013301); escolher só uma escala de LVO |
| E9 | **Pádua** — P2, **validação externa fraca** | [DOI](https://doi.org/10.1111/j.1538-7836.2010.04044.x) |
| E10 | **EDACS-ADP** — P3, pouco ganho sobre o HEART | [DOI](https://doi.org/10.1111/1742-6723.12164) |
| E11 | **LRINEC** — P3, **não serve para descartar** | metanálise [DOI](https://doi.org/10.1097/SLA.0000000000002774) |
| E12 | **Classificação de Roma (DPOC)** — P3 | [DOI](https://doi.org/10.1164/rccm.202108-1819PP) |

Não propostos: SIRS, MEWS e qSOFA como rastreio (a SSC desencoraja); APACHE II e Charlson (fora do
perfil de UPA); ROSE e OESIL (superados pelo Canadian Syncope).

### Melhorias em escores que já existem

| Escore | Onde | O que atualizar | Fonte |
|---|---|---|---|
| Sepse (SOFA) | `src/clinico/escores/sepseAdulto.ts` | **SOFA-2 (2025)**, AUROC 0,79 × 0,77 em 3,34 milhões; antes, conferir se SSC 2026 e ILAS 2026 já adotam; se não, mostrar em paralelo | SOFA-2 [DOI](https://doi.org/10.1001/jama.2025.20516) |
| PESI | `src/clinico/adulto/pesi.ts:7,75` | acrescentar o **sPESI** | Jiménez 2010 [DOI](https://doi.org/10.1001/archinternmed.2010.199) |
| CURB-65 | `src/clinico/escores/curb65.ts` | modo **CRB-65** (sem ureia), com aviso de que superestima mortalidade fora do hospital | [DOI](https://doi.org/10.3399/bjgp10X532422) |
| Canadian Syncope | `src/clinico/escores/sincopeCanadense.ts:14-16` | só a derivação é citada; acrescentar as validações | [DOI](https://doi.org/10.7326/M21-2313); 2026 [DOI](https://doi.org/10.1001/jamanetworkopen.2026.17362) |
| HEART | `src/clinico/escores/heart.ts:15-19` | acrescentar SBC 2025 (preferencial) e nota de troponina de alta sensibilidade | [DOI](https://doi.org/10.1186/s12873-025-01327-4) |

---

## 4. Sugestão de lotes (para o RT decidir)

1. **Lote rápido, sem dose (só escore ou regra):** Cockcroft-Gault, QTc, Ottawa tornozelo e
   joelho, PECARN coluna cervical e trauma abdominal, dor pediátrica (reaproveita a FLACC da
   triagem). Mesmo molde da `EscoreTela`; risco clínico baixo, ganho alto.
2. **Lote de condutas com dose (precisa ler a fonte e transcrever com página):** SCA, ITU do
   adulto, PEP de HIV, meningite, cólica renal, intermação, queimadura do adulto.
3. **Atualizações de diretriz nas ferramentas existentes:** AHA 2025 (PCR) e PALS 2025, levetiracetam
   no estado de mal, Kawasaki AHA 2024, SOFA-2 em paralelo, sPESI, CRB-65.
4. **Decisões de escopo:** incluir neonato (icterícia, reanimação)? AAP 2021 ou ICr no lactente
   febril? Grupos novos nos escores ("Infectologia", "Geriatria e fragilidade")?

Fonte de tudo: PubMed (metadados conferidos por PMID e DOI). Os PMIDs completos estão nos três
levantamentos registrados nesta sessão; os principais aparecem nas tabelas acima como DOI.
