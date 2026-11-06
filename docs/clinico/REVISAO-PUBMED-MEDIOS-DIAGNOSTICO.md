# Revisão PubMed de 09/10/2026: itens de prioridade média

**Pedido do RT em 06/11/2026:** "Todos os médios". Os 11 itens de prioridade alta já estão no master desde outubro (de 09/10 a 01/11). Os médios entram do mesmo jeito: uma nota de novidade ou divergência ao lado do livro, com a fonte citada. Nenhuma dose ou volume muda, nada vem de memória e nada passa do adulto para a criança.

O levantamento foi feito em 06/11/2026, com cada referência conferida no PubMed (metadados e resumo). Algumas também foram conferidas no texto completo do PMC, e isso está marcado.

## Como cada nota entra (o mesmo padrão dos itens altos, e2c000b4)
- Uma constante `Fonte` com a citação completa, o PMID e o DOI.
- Uma constante `NOTA_*` com o texto da nota.
- A ficha passa a ter `{ ...fichaLivro, versao: '2026-11-xx.1', fontes: [..., NOVA], revisadoEm }`. As fichas montadas com `fichaAdulto()` precisam ser expandidas para isso.
- O tipo `Ficha` não tem campo de nota. A nota aparece na tela:
  - como `<p role="note">` no bloco do livro;
  - pela prop `nota` de `LinhaManual`;
  - ou em `cuidados`/`descricao`, nos escores.
- As versões novas vão para o banco por migration gerada com `scripts/fichas-sql.mjs` (como ff12feff). Depois, entram na fila de aprovação do RT.
- Os testes que fixam versão sobem junto, com `>=` como no lote B:
  - `pcr.test.ts:95`
  - `ressuscitacaoVolemica.test.ts:13`
  - `reversaoAnticoagulacao.test.ts:80–81`
  - `loteE2026.test.ts:30`
  - `avc2026.test.ts:9`
  - `emergenciaHipertensiva.test.ts:78`
  - `loteD2026.test.ts:26`
  - `glicemia2024.test.ts:13`
  - `anafilaxia.test.ts:51`

---

## Área 1: adulto, cardiologia e ressuscitação

### 1.1 Transfusão na lesão cerebral aguda
- **Onde:** `transfusao.ts`, ficha `adulto-transfusao-hemocomponentes` (2026-09-28.1); tela `TransfusaoAdulto.tsx`.
  - A nota é uma constante nova. Não pode entrar em `DIFERENCAS_TRANSFUSAO_2023`, porque essa lista é cortada por índice na tela.
- **Fontes:**
  - TRAIN: Taccone FS et al. JAMA 2024;332(19):1623–1633 (PMID 39382241)
  - HEMOTION: Turgeon AF et al. N Engl J Med 2024;391(8):722–735 (PMID 38869931)
  - SAHaRA: English SW et al. N Engl J Med 2025;392(11):1079–1088 (PMID 39655786)
- **Nota:** "Lesão cerebral aguda (TCE, HSA ou hemorragia intraparenquimatosa): a evidência posterior ao livro e à AABB 2023 é dividida. No TRAIN (JAMA 2024; 850 pacientes com Hb < 9 g/dL), transfundir com Hb < 9 g/dL em vez de < 7 g/dL reduziu o desfecho neurológico desfavorável em 180 dias (62,6% × 72,6%). No HEMOTION (NEJM 2024; TCE moderado a grave, ≤ 10 × ≤ 7 g/dL) e no SAHaRA (NEJM 2025; HSA aneurismática, ≤ 10 × ≤ 8 g/dL), a estratégia liberal não reduziu o desfecho desfavorável em 6 e 12 meses; no HEMOTION houve mais SDRA (3,3% × 0,8%). Os números são os limiares testados nos ensaios, não recomendação; o 'Hb < 7' do livro continua."
- **Tipo:** só nota.

### 1.2 Heparina não fracionada
- **Onde:** `anticoagulacao.ts`, ficha `adulto-heparina-nao-fracionada` (2026-09-27.1, montada com `fichaAdulto`); tela `HeparinaNaoFracionadaAdulto.tsx`, bloco "Ajuste pelo TTPA".
- **Fonte:** Gouin-Thibault I et al. (ISTH SSC). J Thromb Haemost 2026;24(8):3051–3062 (PMID 42162738).
- **Nota:** "ISTH 2026 (orientação do SSC por consenso Delphi, posterior ao livro): o anti-Xa é preferido ao TTPa para monitorar a HNF; o alvo sugerido é 0,30–0,70 U/mL na maioria das indicações (TEV, eventos arteriais, prótese valvar mecânica). Se o serviço usa TTPa, é essencial uma faixa terapêutica de TTPa estabelecida pelo laboratório local; as faixas em segundos da Tabela 7 (Raschke, 1996) não substituem essa calibração. A conta desta tela continua a do livro."
- **Tipo:** nota. **Decisão do RT (H1):** mostrar ou não o alvo de anti-Xa, que depende de o laboratório dosar anti-Xa.

### 1.3 Reversão de anticoagulação
- **Onde:** `reversaoAnticoagulacao.ts`, ficha `adulto-reversao-anticoagulacao` (2026-10-25.1); tela `ReversaoAnticoagulacaoAdulto.tsx`, bloco dos DOAC.
- **Fonte:** Lopes RD et al. (SBTH). Rev Assoc Med Bras 2026;72(6):e20252032 (PMID 42561189). Conferida também no texto completo do PMC. As doses da Figura 3B não foram conferidas.
- **Nota:** "Consenso brasileiro SBTH 2026 (posterior ao livro): reversor ou agente hemostático só quando há as duas condições: sangramento maior ou com risco de vida e anticoagulante em nível circulante significativo (DOAC dosado ou tomado há menos de 24 h; no antagonista da vitamina K, INR ≥ 2). Carvão ativado se o anticoagulante foi tomado nas últimas 4 h (o livro escreve < 2 h). Idarucizumabe para a dabigatrana; andexanete ou complexo protrombínico para os inibidores do fator Xa, o andexanete com cautela, porque foi retirado do mercado em alguns países. As doses do consenso não foram conferidas; nada aqui muda dose."
- **Tipo:** nota. **Decisão do RT (H2):** trocar "< 2 h" por "< 4 h" na lista do livro. Isso fica coerente com a janela do carvão do CTRC 2026, que já foi aplicada.

### 1.4 PCR
- **Situação:** a ficha `adulto-pcr` (2026-10-25.1) já está na AHA 2025, que manda o acesso IV primeiro, dá classe 2b (utilidade não estabelecida) à troca de vetor e não recomenda bicarbonato de rotina. Faltam só os ensaios por trás dessas recomendações.
- **Onde:** um campo `nota?` em `ItemAls2025`, mostrado em `PcrAdulto.tsx`.
- **Fontes:**
  - IVIO: Vallentin MF et al. N Engl J Med 2025;392(4):349–360 (PMID 39480221)
  - PARAMEDIC-3: Couper K et al. N Engl J Med 2025;392(4):336–348 (PMID 39480216)
  - DOSE VF: Cheskes S et al. N Engl J Med 2022;387(21):1947–1956 (PMID 36342151)
  - Bicarbonato na PCR intra-hospitalar: Granfeldt A et al. JAMA 2026;336(8):647–654 (PMID 42273960)
- **Notas:**
  - **Acesso vascular:** "IVIO (NEJM 2025; 1.479 PCR extra-hospitalares) e PARAMEDIC-3 (NEJM 2025; 6.082): começar pelo intraósseo não melhorou o RCE sustentado nem a sobrevida em 30 dias; no PARAMEDIC-3 o RCE em qualquer momento foi menor com IO primeiro (36,0% × 39,1%). São a base do 'IV primeiro' da AHA 2025; a dose não muda."
  - **Troca de vetor:** "DOSE VF (NEJM 2022; 405 FV refratárias extra-hospitalares; interrompido pela covid-19): sobrevida à alta de 30,4% com dupla desfibrilação sequencial e de 21,7% com troca de vetor (pás anteroposteriores), contra 13,3% com a padrão. A AHA 2025 ainda classifica a utilidade como não estabelecida (2b); a carga do choque não muda."
  - **Bicarbonato:** "Ensaio dinamarquês (JAMA 2026; 779 PCR intra-hospitalares, duplo-cego): bicarbonato × placebo sem diferença no RCE sustentado (39% × 37%), com mais alcalose e hipernatremia. Reforça o livro: bicarbonato só nas indicações específicas."
- **Tipo:** só nota. A troca de vetor não pode aparecer como recomendação.

### 1.5 Choque séptico (ARISE FLUIDS)
- **Onde:** `ressuscitacaoVolemica.ts` (2026-09-28.1), na `nota` da linha "Vasopressor: qual e por onde".
- **Fonte:** ARISE FLUIDS. N Engl J Med 2026;395(14):1387–1398 (PMID 42274006). A autoria precisa ser confirmada (Peake SL, Macdonald SPJ, Howe BD).
- **Nota:** "ARISE FLUIDS (NEJM 2026; 963 adultos com choque séptico no pronto-socorro; posterior à SSC 2026): fluido restrito com vasopressor precoce recebeu mediana de 1.108 mL a menos nas primeiras 24 h, com os mesmos dias vivos e fora do hospital em 90 dias (76 × 76) e menos edema pulmonar (0,6% × 5,0%). As duas estratégias empataram no desfecho principal; o volume da conta (30 mL/kg) não muda."
- **Tipo:** só nota.

### 1.6 IC aguda
- **Onde:** `insuficienciaCardiacaAguda.ts` (2026-09-28.1), entradas novas em `ENSAIOS_ICA`.
- **Fontes:**
  - PUSH-AHF: Ter Maaten JM et al. Nat Med 2023;29(10):2625–2632 (PMID 37640861)
  - Metanálise do SGLT2 na internação: Ahmed HM et al. Cardiovasc Drugs Ther 2026 (PMID 42507311)
- **Notas:**
  - "PUSH-AHF: diurético guiado pela natriurese, intensificado quando o Na urinário pontual ficava < 70 mmol/L — mais natriurese em 24 h (409 × 345 mmol), sem diferença em morte ou reinternação por IC em 180 dias (31% × 31%). O corte de 70 coincide com o limite superior do critério de resposta do livro."
  - "SGLT2 iniciado na internação (metanálise 2026; 18 ECRs, 15.560 pacientes): menos piora ou internação por IC (RR 0,77), sem aumento de LRA, hipotensão, hipoglicemia ou cetoacidose; a queda de mortalidade (RR 0,74) perdeu força na análise de viés de publicação."
- **Tipo:** só nota.

### 1.7 Marca-passo transcutâneo
- **Onde:** `procedimentos.ts`, ficha `adulto-marca-passo-provisorio` (2026-09-28.1), bloco do marca-passo transcutâneo.
- **Fonte:** Kimbrell JM et al. Am J Emerg Med 2026;110:74–78 (PMID 42600263).
- **Nota:** "Estudo multicêntrico retrospectivo pré-hospitalar (2026; 253 pacientes em marca-passo transcutâneo): só 11,5% tinham captura elétrica sustentada. A subida da PA, a subida do EtCO2 e a sincronia da onda do oxímetro não identificaram a captura com segurança. Confirmar a captura elétrica no monitor e a mecânica no pulso, como o livro já pede."
- **Tipo:** só nota.

---

## Área 2a: adulto, neurologia e respiratório

### 2.1 INTERACT4
- **Onde:** duas fichas possíveis:
  - `emergenciaHipertensiva.ts` (2026-10-25.1), em `DBHA_2025_ALVOS`, na linha do AVC isquêmico sem trombólise;
  - `avcTrombolise.ts` (2026-09-28.1), em `ALVOS_PA_AVC`.
- **Fontes:**
  - INTERACT4: Li G et al. N Engl J Med 2024;390(20):1862–1872 (PMID 38752650)
  - Opcional: ESO 2025 de PA, Sandset EC et al. Eur Stroke J 2026;11(5):aakag004 (PMID 42095756)
- **Nota:** "INTERACT4 (NEJM 2024, posterior ao livro): ECR na China com 2.404 pacientes com suspeita de AVC agudo, déficit motor e PAS ≥ 150 mmHg, avaliados na ambulância em até 2 h do início. Baixar a PAS na hora (alvo 130–140 mmHg), antes da imagem, não mudou o Rankin em 90 dias. Na análise por tipo (subgrupo), piorou o desfecho no isquêmico (OR 1,30) e melhorou no hemorrágico (OR 0,75). Reforça não baixar a PA antes de a imagem separar isquemia de hemorragia. A ESO 2025 desaconselha baixar a PA de rotina no pré-hospitalar. Os alvos do livro e da DBHA não mudam."
- **Tipo:** nota. **Decisão do RT (H3):** a nota vai numa ferramenta ou nas duas.

### 2.2 Oxigenação e VNI (ATS 2026 e SOHO)
- **Onde:**
  - `oxigenacao.ts`, ficha `adulto-oxigenacao-irpa` (2026-09-27.1, montada com `fichaAdulto`): linha do cateter nasal de alto fluxo (CNAF) e pós-extubação;
  - `vniPassos.ts` (2026-09-30.1);
  - DPOC: `asmaDpoc.ts`, `INDICACOES_VNI_DPOC`.
- **Fontes:**
  - ATS 2026: Goel NN et al. Am J Respir Crit Care Med 2026;212(9):2135–2158 (PMID 42371750)
  - SOHO: Frat JP et al. N Engl J Med 2026;394(21):2095–2106 (PMID 41841715)
- **Notas:**
  - **Hipoxêmica:** "ATS 2026: na IRpA hipoxêmica, recomendação forte de CNAF e condicional de VNI ou CPAP, com vigilância próxima para escalar o suporte; o benefício é na necessidade de intubação. SOHO (NEJM 2026; 1.110 adultos com P/F ≤ 200): a CNAF não reduziu a mortalidade em 28 dias (14,6% nos dois grupos), reduziu a intubação (42,4% vs 48,4%) e teve mais parada cardíaca ou pneumotórax durante a respiração espontânea (2,3% vs 1,1%). A CNAF não deve atrasar a intubação indicada. Os alvos de SatO2 do livro não mudam."
  - **Hipercápnica** (vale também para a DPOC): "ATS 2026: na IRpA hipercápnica, recomendação forte de VNI para reduzir mortalidade e intubação. A CNAF entra só como condicional, na hipercapnia menos grave com acidemia leve, com vigilância e escalada rápida para VNI. Concorda com o livro."
  - **Pós-extubação:** "ATS 2026: após a extubação, sugere CNAF no paciente de baixo risco e VNI no de alto risco, para reduzir reintubação."
  - **Pré-oxigenação:** "ATS 2026: recomendação forte de CNAF ou VNI na pré-oxigenação antes da intubação, para prevenir hipoxemia peri-intubação."
- **Tipo:** nota. **Decisão do RT (H4):** onde entra a pré-oxigenação, que não tem texto do livro ao lado. A opção é a sequência rápida de intubação (`adulto-isr`).

### 2.3 SDRA: bloqueio neuromuscular (SCCM 2026)
- **Onde:** `ventilacaoMecanica.ts`, ficha `adulto-vm-sdra` (2026-09-28.1), linha do bloqueio neuromuscular em `DIRETRIZ_SDRA_2024`.
- **Fonte:** Erstad BL et al. Crit Care Med 2026;54(3):634–643 (PMID 41773929).
- **Nota:** "SCCM 2026 (posterior ao livro e às diretrizes ATS 2024 e ESICM 2023): recomendação condicional de usar bloqueio neuromuscular no adulto com SDRA e P/F < 150; sem recomendação para dose fixa ou titulada, para monitorar a sedação antes do BNM nem para BNM durante a prona. O corte coincide com o do livro (P/F < 150) e é mais amplo que o da ATS (SDRA grave precoce); a ESICM é contra a infusão contínua de rotina. As três posições ficam lado a lado."
- **Tipo:** só nota.
- **Errata do volume corrente (3–6 mL/kg):** já está aplicada no app desde 27/09/2026 (b81e4e83). Falta só atualizar `produto/docs/pesquisa/erratas-manual-hc.md`, que ainda a dá como urgente.

### 2.4 HSA
- **Onde:** `hsa.ts`, ficha `adulto-hsa` (2026-09-28.1), linhas do antifibrinolítico e da fenitoína.
- **Fontes:**
  - ESO/EANS/ESMINT: Vergouwen MDI et al. Eur Stroke J 2026;11(5):aakag043 (PMID 42095754)
  - NCS 2026: Rowe AS et al. Neurocrit Care 2026;45(2):445–463 (PMID 42552475)
- **Notas:**
  - **Antifibrinolítico:** "ESO/EANS/ESMINT 2026: com evidência alta, recomenda nimodipino oral e é contra o antifibrinolítico de rotina antes do tratamento do aneurisma, e contra tirilazade, estatina, sulfato de magnésio e antagonista de endotelina; por consenso, tratar o aneurisma em até 24 h, em centro com volume mínimo. Reforça a AHA 2023 e diverge do livro, que traz o antifibrinolítico como opção nas primeiras 72 h."
  - **Fenitoína:** "NCS 2026 (posterior à AHA 2023): a profilaxia anticonvulsivante pode ser feita ou não (condicional, qualidade baixa); se feita, levetiracetam ou fenitoína/fosfenitoína (condicional, qualidade muito baixa), por tempo curto ou longo. Diverge do 'associada a dano' da AHA 2023; as duas posições ficam lado a lado."
- **Tipo:** nota. **Decisão do RT (H5):** mostrar a posição da NCS 2026 ao lado da classe "3: dano" da AHA.

### 2.5 Escore ICH
- **Onde:** `adulto-escore-ich` (2026-09-27.1), em `cuidados`.
- **Fonte:** Hwang DY et al. (NCS). Neurocrit Care 2024;40(2):395–414 (PMID 37923968).
- **Nota:** "NCS 2023: nenhuma variável isolada e nenhum escore, nem o ICH, foi considerado confiável sozinho para aconselhar paciente e família sobre o desfecho funcional em 3 meses ou a mortalidade em 30 dias. Boa prática: adiar o prognóstico por pelo menos 48–72 h de UTI, exceto nos casos mais devastadores. A mortalidade da tabela não decide limitação de suporte."
- **Tipo:** só nota.

### 2.6 Desmame
- **Onde:** `adulto-vm-desmame` (2026-09-27.1), bloco do teste de respiração espontânea (TRE).
- **Fontes:**
  - AARC: Roberts KJ et al. Respir Care 2024;69(7):891–901 (PMID 38443142)
  - Burns KEA et al. JAMA 2024;332(21):1808–1821 (PMID 39382222)
- **Nota:** "AARC 2024 (posterior ao livro; recomendações condicionais): o índice de respiração rápida e superficial (IRRS) não é necessário para decidir se o paciente está pronto para o TRE; o TRE pode ser feito com ou sem pressão de suporte; não aumentar a FiO2 durante o TRE. Num ECR de 797 pacientes (JAMA 2024), o TRE com pressão de suporte e o tubo T não mudaram o tempo até a extubação bem-sucedida. O livro não usa o IRRS, e o TRE em PSV 5–7 cmH2O está dentro do que a AARC aceita."
- **Tipo:** só nota.

### 2.7 Extra: MASCC
- **Onde:** `neutropeniaFebril.ts`, em `cuidados`.
- **Fonte:** Cooksley T et al. Support Care Cancer 2026;34(8) (PMID 42525130).
- **Nota:** "Consenso MASCC 2026: MASCC ≥ 21 continua indicando candidato a manejo ambulatorial, mas o escore não foi validado em quem usa quimioterapia combinada com inibidor de checkpoint imune; MASCC < 21 é alto risco e segue o manejo padrão."
- **Tipo:** só nota.

---

## Área 2b: adulto, metabolismo, gastro, toxicologia e trauma

### 3.1 Hepatite alcoólica (ACG 2024)
- **Onde:** `hepatopata.ts`, ficha `adulto-maddrey` (2026-09-27.1), em `cuidados` e `descricao`.
- **Fonte:** Jophlin LL et al. Am J Gastroenterol 2024;119(1):30–54 (PMID 38174913). Conferida também no texto completo do PMC.
- **Nota:** "ACG 2024 (posterior ao livro): o MELD é o escore mais acurado para estratificar a hepatite alcoólica, e MELD > 20 define a forma grave; no STOPAH (1.068 pacientes) o Maddrey discriminou pior a mortalidade em 28 e 90 dias que MELD, GAHS e ABIC. O benefício do corticoide em 28 dias aparece com MELD de 21 a 39, é limitado entre 40 e 50 e não existe acima de 50. O Lille no dia 4 do corticoide é tão acurado quanto no dia 7. A ferramenta mantém o Maddrey e o corte do livro; a escolha é do médico."
- **Tipo:** só nota.

### 3.2 Úlcera péptica sangrante (ESGE 2026)
- **Onde:** `hemorragiaDigestiva.ts` (2026-09-27.1), bloco "HDA — metas e gatilhos".
- **Fonte:** Gralnek IM et al. Endoscopy 2026;58(8):899–924 (PMID 42127996); errata C12 (PMID 42173116).
- **Nota:** "ESGE 2026 (úlcera péptica sangrante, posterior ao livro): não recomenda EDA emergente (≤ 6 h) nem urgente (≤ 12 h), salvo instabilidade hemodinâmica que persiste apesar da ressuscitação adequada — reforça o livro. Sugere considerar IBP EV em dose alta antes da EDA, sem atrasá-la; metoclopramida EV antes da EDA em casos selecionados graves ou com sangramento ativo, se não houver eritromicina; e dieta oral em até 24 h após hemostasia durável. Doses não mudam."
- **Tipo:** só nota.

### 3.3 Síndrome torácica aguda (TASC 2025)
- **Onde:** `falciforme.ts` (2026-09-27.1), bloco da síndrome torácica aguda (STA).
- **Fonte:** Mekontso Dessap A et al. Am J Respir Crit Care Med 2025;211(5):832–841 (PMID 40209087).
- **Nota:** "TASC (2025, posterior ao livro): ECR duplo-cego, 172 adultos com STA sem trombose na angio-TC, tinzaparina em dose terapêutica × profilática por 7 dias. A dose terapêutica encurtou a STA (HR 0,71; média 4,8 × 6,1 dias) e reduziu o opioide parenteral, sem sangramento maior. É um ECR único: a ferramenta não muda a conduta do livro e não traz dose de anticoagulante."
- **Tipo:** **decisão do RT (H6):** se a nota aparece.

### 3.4 CAD: insulina basal precoce
- **Onde:** `glicemia.ts`, ficha `adulto-cad-ehh-tratamento` (2026-09-28.1), bloco da transição para insulina SC.
- **Fonte:** AbuJlambo A et al. Endocrinol Diabetes Metab 2026;9(4):e70277 (PMID 42405473), só com adultos.
- **Nota:** "Insulina basal precoce (posterior ao consenso 2024): metanálise de 8 ECRs em adultos (407 pacientes) — a insulina basal SC iniciada durante a infusão EV encurtou a resolução da CAD (diferença média −4,06 h) e reduziu o fluido total em cerca de 400 mL, sem diferença em hipoglicemia, hipocalemia, hiperglicemia de rebote, recorrência ou mortalidade. Momento e dose da basal seguem o livro e o consenso 2024."
- **Tipo:** só nota. Nada vai para a CAD pediátrica.

### 3.5 Antídotos (AHA 2023 e 2025) e digoxina (consenso de 2024)
- **Onde:** `intoxicacoes.ts`, ficha `adulto-intoxicacoes-antidotos` (2026-10-09.1).
- **Fontes:**
  - Lavonas EJ et al. Circulation 2023;148(16):e149–e184 (PMID 37721023)
  - Cao D et al. Circulation 2025;152(16 Suppl 2):S578–S672 (PMID 41122889)
  - Hack JB et al. Am J Med 2025;138(1):25–33.e14 (PMID 39265879)
  - Andrews P et al. Eur J Emerg Med 2023;30(6):395–401 (PMID 37650725)
- **Notas:**
  - **AHA:** "AHA 2023 (atualização focada) e AHA 2025 (Parte 10), posteriores ao livro, organizam a ressuscitação e o choque refratário nas intoxicações graves e o uso de ECMO VA. As doses desta tela continuam as do livro; as linhas de antídoto ainda não foram conferidas com o texto completo dessas diretrizes."
  - **Digoxina:** "Consenso de especialistas de 2024 (Delphi, 33 enunciados): considerar o momento da ingestão e o tipo de exposição (aguda, aguda sobre crônica, crônica) e usar o anticorpo antidigoxina na exposição com risco de vida. O cálculo de frascos segue o livro."
- **Tipo:** nota. **Decisão do RT (H7):** abrir o texto completo da AHA 2023/2025 e do Andrews 2023 para conferir dose por dose, que é um trabalho à parte.

### 3.6 Anafilaxia (GALEN 2024)
- **Onde:** `anafilaxia.ts` (2026-10-25.1), bloco dos critérios da WAO 2020.
- **Fonte:** Dribin TE et al. J Allergy Clin Immunol 2025;156(2):406–417.e6 (PMID 39880313).
- **Nota:** "GALEN 2024 (posterior ao livro e às diretrizes desta tela): consenso Delphi (46 especialistas, 31 sociedades) com nova definição — anafilaxia é uma reação alérgica grave, que pode progredir rápido e levar à morte — e uma ferramenta clínica com critérios de probabilidade e indicações de adrenalina IM. Os autores propõem que substituam os critérios NIAID/FAAN 2006 e WAO 2020. A tela mantém os critérios da WAO 2020 e as doses atuais."
- **Tipo:** só nota no adulto. A anafilaxia pediátrica é decisão separada.

### 3.7 Trauma: ensaios negativos
- **Onde:** `trauma.ts`, ficha `adulto-trauma-inicial` (2026-09-27.1), nos blocos do ácido tranexâmico (TXA) e da circulação.
- **Fontes:**
  - PATCH-Trauma: N Engl J Med 2023;389(2):127–136 (PMID 37314244)
  - CRYOSTAT-2: JAMA 2023;330(19):1882–1891 (PMID 37824155)
  - UK-REBOA: JAMA 2023;330(19):1862–1871 (PMID 37824132)
  - PROCOAG: JAMA 2023;329(16):1367–1375 (PMID 36942533)
  - Sangue total pré-hospitalar: Smith JE et al. N Engl J Med 2026;394(23):2305–2316 (PMID 41841706) e Sperry JL et al. N Engl J Med 2026;394(23):2317–2328 (PMID 42150044)
- **Notas:**
  - **TXA:** "PATCH-Trauma (NEJM 2023): 1.310 adultos com trauma grave e suspeita de coagulopatia; TXA pré-hospitalar no mesmo esquema do livro (1 g + 1 g em 8 h) × placebo. Não aumentou a sobrevida com bom desfecho funcional em 6 meses (53,7% × 53,5%); a morte em 28 dias foi menor (17,3% × 21,8%), como desfecho secundário, sem diferença em eventos oclusivos. Reforça o esquema do livro."
  - **Circulação:** "Ensaios posteriores ao livro, todos sem benefício — nada disto como rotina: crioprecipitado empírico precoce em dose alta (CRYOSTAT-2) não reduziu a morte em 28 dias; REBOA na sala de emergência (UK-REBOA) não reduziu e pode ter aumentado a mortalidade; complexo protrombínico sistemático no risco de transfusão maciça (PROCOAG) não reduziu hemocomponentes e teve mais eventos tromboembólicos (35% × 24%); sangue total pré-hospitalar (dois ECRs, NEJM 2026) não foi superior aos componentes. Reforçam o protocolo do livro."
- **Tipo:** só nota.

### 3.8 Extras da área 2b
| Tema | Fonte | Tipo |
|---|---|---|
| Hipernatremia: velocidade de correção | Kitisin N et al. J Crit Care 2025;87:155012 (PMID 39765195) | **Decisão do RT (H8)** |
| Bicarbonato (BICARICU-2) | Jung B et al. JAMA 2025;334(22):2000–2010 (PMID 41159812) | Só nota |
| Crise tireotóxica e mixedema | ETJ 2026 (PMID 42554462 e 42466568) | Só referência |
| Rabdomiólise: corte de CPK do ENMC | Kruijt N et al. Neuromuscul Disord 2025;50:105344 (PMID 40220353) | **Decisão do RT (H9)**: a divergência com o livro é real |
| Encefalopatia hepática | ACG 2026, Bajaj JS et al. (PMID 41773757) | Só referência |
| DRESS | Brüggen MC et al. JAMA Dermatol 2024;160(1):37–44 (PMID 37966824) | Só nota |
| Sedação paliativa | Surges SM et al. Palliat Med 2024;38(2):213–228 (PMID 38297460) | Só nota |
| Abstinência alcoólica | Lee CM et al. Acad Emerg Med 2024 (PMID 37923363) e BAP 2026 (PMID 41731947) | Só nota |

---

## Área 3: pediatria e escores

### 4.1 Kawasaki
- **Onde:** `kawasaki.ts` (2026-10-25.1), na linha "Corticoide" de `DIFERENCAS_KAWASAKI_2024`. É preciso criar o campo `nota?`.
- **Fontes, pediátricas:**
  - Lin S et al. N Engl J Med 2026;394(15):1480–1490 (PMID 41985133)
  - Tufail U et al. Eur J Pediatr 2026;185(10) (PMID 42736452)
- **Nota:** "ECR de prednisolona adjuvante (NEJM 2026, posterior à AHA 2024): 3.208 crianças chinesas com Kawasaki recém-diagnosticado, não selecionadas por risco. Lesão coronariana em 1 mês: 16,0% com prednisolona + tratamento padrão e 13,8% só com o padrão, sem redução. Houve menos terapia de resgate (4,6% vs 10,1%) e febre mais curta, mas aneurisma médio a gigante em 3 meses de 1,9% vs 1,1%. Meta-análise de 8 ECRs (4.106 crianças, certeza muito baixa) também sem benefício coronariano; o ensaio não estudou à parte o alto risco da AHA 2024, e nenhuma dose muda."
- **Tipo:** só nota.

### 4.2 Phoenix
- **Onde:** `choque.ts`, ficha `ped-phoenix` (2026-09-30.1), abaixo de `PHOENIX_TEXTO.naoVale`.
- **Fontes, pediátricas:**
  - Long E et al. JAMA Netw Open 2025;8(3):e251412 (PMID 40116825)
  - He S et al. JAMA Netw Open 2026;9(6):e2616305 (PMID 42228369)
- **Nota:** "Validação externa no pronto-socorro (SENTINEL, 2025): 6.232 crianças internadas por suspeita de sepse em 11 prontos-socorros da Austrália e Nova Zelândia. Só 4,9% preencheram o Phoenix, a sensibilidade para morte hospitalar foi de 55,0%, e a coagulação faltava em mais de 85%. Em Hong Kong (140.633 internações), o Phoenix-8 discriminou bem a mortalidade (AUROC 0,91), mas os dados para calculá-lo existiam em só 43,3%: o Phoenix define sepse, não faz triagem."
- **Tipo:** só nota.

### 4.3 Neutropenia febril pediátrica
- **Onde:** `oncologiaPed.ts` (2026-09-28.1), depois de `DIFERENCAS_NF_2023`.
- **Fonte, pediátrica:** Vissing NH et al. Lancet Child Adolesc Health 2026;10(6):418–428 (PMID 41990768).
- **Nota:** "ECR dinamarquês (2026, posterior à IPFNG 2023): 70 crianças em quimioterapia intensiva com neutropenia febril de alto risco, sem infecção documentada (88 episódios). Suspender o antibiótico EV após 48 h sem febre e com estabilidade clínica, sem esperar a recuperação dos neutrófilos, reduziu em 4,0 dias o antibiótico em 28 dias, com eventos graves semelhantes (22% vs 21%) e sem óbitos. O estudo não tem poder para eventos raros e não é diretriz: a IPFNG 2023 continua admitindo a suspensão sem recuperação medular só no baixo risco."
- **Tipo:** só nota.

### 4.4 PRAM
- **Onde:** `pram.ts` (2026-09-30.1), em `cuidados`. A linha 46 diz "fora dessa faixa o escore não foi estudado", o que ficou desatualizado.
- **Fontes, pediátricas:**
  - CASPER: Gray C et al. Arch Dis Child 2026 (PMID 42392843)
  - Pergo LS et al. J Pediatr (Rio J) 2026;102(5):101583 (PMID 42448296)
  - Courselle A et al. Arch Pediatr 2026;33(4):105511 (PMID 41996743)
- **Nota:** "CASPER (2026): em 4 prontos-socorros australianos, 1.238 crianças de 2 a 18 anos, nenhum dos 10 escores de asma (PRAM incluído) atingiu AUC ≥ 0,80 para prever internação após o broncodilatador inicial. Numa coorte brasileira (428 atendimentos), o PRAM previu melhor a internação na 2ª hora (AUC 0,829) do que na triagem (0,791). O escore mede gravidade e serve para reavaliar; não decide sozinho a internação. Abaixo de 2 anos há só um estudo pequeno (92 lactentes)."
- **Tipo:** nota. **Decisão do RT (H10):** reescrever a linha 46.

### 4.5 SOFA-2
- **Situação:** o app já tem o SOFA-2 como ferramenta separada (`sofa2.ts`, 2026-10-25.1, à espera da aprovação do RT). A tela de sepse segue no SOFA-1 (`sepseAdulto.ts`, 2026-09-28.3).
- **Fontes:**
  - Ranzani OT et al. JAMA 2025;334(23):2090–2103 (PMID 41159833)
  - Ahn S et al. J Intensive Care 2026;14(1) (PMID 42687193)
  - Yen CC et al. Int J Infect Dis 2026;171:109030 (PMID 42542312)
- **Nota (na tela de sepse):** "SOFA-2 (JAMA 2025): mesmos 6 sistemas, com variáveis novas e cortes revistos, desenvolvido em UTI. No pronto-socorro, em choque séptico (duas coortes, 2.669 e 1.443 pacientes), discriminou a mortalidade um pouco melhor que o SOFA-1. Em 173.079 atendimentos por suspeita de infecção em Taiwan, a AUROC foi igual (0,78 vs 0,78), mas o SOFA-2 deu pontuação menor em 62,3% dos pacientes. O Sepsis-3 continua definido pelo SOFA original, que é o desta tela; o SOFA-2 está em ferramenta separada."
- **Tipo:** nota. **Decisão do RT (H11):** manter o SOFA-1 como critério da sepse. A linha 84 do `sofa2.ts` ("validado só em UTI") passa a citar as validações no PS.

### 4.6 Acesso venoso
- **Onde:** `acessoVenoso.ts` (2026-09-27.1), com a citação da 8ª edição incompleta.
- **Fontes:**
  - 9ª ed.: Nickel B et al. J Infus Nurs 2024;47(1S Suppl 1):S1–S285 (PMID 38211609)
  - 8ª ed.: Gorski LA et al. J Infus Nurs 2021;44(1S Suppl 1):S1–S224 (PMID 33394637)
- **Nota:** "Existe a 9ª edição dos Infusion Therapy Standards of Practice (2024), que substitui a 8ª citada aqui. O PubMed não traz resumo de nenhuma das duas, e o que mudou entre as edições não foi conferido: a regra desta tela segue a 8ª edição até o RT ler o texto."
- **Tipo:** nota. A citação da 8ª é completada. **Decisão do RT (H12):** trocar a fonte depois de ler a 9ª.

### 4.7 Wells TVP e YEARS
- **Wells TVP** (`wellsTvp.ts`, 2026-09-27.1)
  - **Fonte:** Le Gal G et al. JAMA 2026;335(5):416–424 (PMID 41490105).
  - **Nota:** "D-dímero ajustado à idade na TVP (JAMA 2026): estudo prospectivo de manejo em 27 centros, 3.205 pacientes do pronto-socorro. Nos 2.169 com Wells improvável, o corte idade × 10 µg/L (a partir de 50 anos) não teve nenhuma falha em 3 meses entre 500 µg/L e o corte ajustado. Com 75 anos ou mais, o D-dímero negativo passou de 8,7% para 26,1%. Esta tela não calcula o corte."
  - **Tipo:** só nota.
- **YEARS** (`years.ts`, 2026-09-28.1)
  - **Fonte:** Akerboom B et al. JAMA 2026;336(8):655–663 (PMID 42437322).
  - **Nota:** "Câncer ativo (Hydra, JAMA 2026): ECR com 698 pacientes com câncer ativo e suspeita de TEP. O YEARS foi não inferior à angio-TC: TEV sintomático ou morte possivelmente por TEP em 90 dias, após excluir TEP, em 1,8% vs 5,5%. Dispensou a angio-TC em 22%."
  - **Tipo:** só nota.

### 4.8 Outros escores
| Escore | Fonte | Nota | Tipo |
|---|---|---|---|
| CIVD (ISTH) | Iba T et al. J Thromb Haemost 2025;23(7):2356–2362 (PMID 40216223) | nova definição ISTH 2025; o D-dímero passa a ser medido em múltiplos do limite superior; a tela segue o escore de 2001 até o RT ler | **Decisão do RT (H13)** |
| NEWS2 | Oliveira APA et al. Rev Gaúcha Enferm 2020;41:e20190424 (PMID 33111761); Sousa AS et al. 2025 (PMID 40767651) | versão brasileira oficial; validada no PS em sepse | nota. **Decisão do RT (H14):** alinhar os rótulos à versão oficial |
| GRACE | Wenzl FA et al. Lancet 2022;400(10354):744–756 (PMID 36049493); Lancet Digit Health 2025 (PMID 41107201) | GRACE 3.0 separado por sexo; a limitação foi medida no 2.0 | nota. **Decisão do RT (H15):** pôr link para o GRACE 3.0 |
| Canadian CT Head | Kimoto K et al. Am J Emerg Med 2026;104:34–39 (PMID 41791185) | coorte japonesa (mediana de 71 anos): sensibilidade de 91,1% e especificidade de 33,8% | só nota |
| Alvarado | Podda M et al. (WSES 2025). JAMA Surg 2026;161(3):283–295 (PMID 41604201); Andersson RE et al. World J Emerg Surg 2025 (PMID 39923099) | WSES 2025 substitui a 2020; o AIR teve AUC 0,86 e o Alvarado 0,79 | nota. **Decisão do RT (H16):** trocar a WSES 2020 pela 2025 depois de ler |
| BISAP e Ranson | Capurso G et al. UEG J 2023;11(9):825–836 (PMID 37755341); IAP 2025 (PMID 40651900); iLATAM-AP 2026 (PMID 42216617) | os escores têm desempenho ruim para prever pancreatite grave | só nota |
| Glasgow-Blatchford | ESGE 2026 (PMID 42127996) | não recomenda EDA emergente nem urgente sem instabilidade | só nota |

### 4.9 Extras da área 3
| Tema | Fonte | Tipo |
|---|---|---|
| CAD pediátrica: Ringer lactato | Agarwal A et al. 2025 (PMID 40194836); Singhal D et al. 2024 (PMID 39302535) | só nota, sem dose |
| CAD pediátrica: glargina precoce | Shah A et al. 2025 (PMID 41296041); Bansal D et al. 2025 (PMID 40623843) | **Decisão do RT (H17)**: o resumo traz a dose, e ela não entra sem o RT |
| Manchester: subtriagem no idoso | Ingielewicz A et al. PLoS One 2025 (PMID 40961061) | **Decisão do RT e da enfermagem (H18)** |
| Braden: faixas | Hillier B 2025 (PMID 39913541); Velozo BC 2026 (PMID 42845173) | **Decisão do RT (H19)** |
| Glasgow com pupilas (GCS-P) | Vreeburg RJG 2024 (PMID 39686742) | **Decisão do RT (H20)** sobre a redação |
| ABCD2 | Deris D 2025 (PMID 40944027); Lumia S 2026 (PMID 41718567) | só nota: 17,7% dos de baixo risco tiveram AVC no próprio atendimento |
| Light | Porcel JM 2026 (PMID 41846683) | **Decisão do RT (H21)** sobre a combinação tripla |
| Hiperpotassemia: cálcio | Jessen MK 2025 (PMID 39761907) | **Decisão do RT (H22)** |
| RCP pediátrica (ERC 2025), HDA pediátrica (ESPGHAN), IC pediátrica (AHA 2026), meningite (OMS 2025) | — | só referência ou leitura; o resumo não permite nota |
| Dengue (OMS 2025) | PMID 40690567 não encontrado pela ferramenta | fica de fora |

---

## Decisões do RT

| # | Item | A (recomendada) | B |
|---|---|---|---|
| H1 | HNF: alvo de anti-Xa | mostrar o alvo 0,30–0,70 U/mL só na nota, sem mexer na conta | não mostrar |
| H2 | Reversão de DOAC: janela do carvão | trocar "< 2 h" por "< 4 h", com a fonte (SBTH 2026), coerente com o CTRC | só nota, sem trocar |
| H3 | INTERACT4 | nas duas ferramentas (emergência hipertensiva e AVC) | só na do AVC |
| H4 | Pré-oxigenação (ATS 2026) | nota na sequência rápida de intubação | não entra |
| H5 | HSA: NCS 2026 sobre fenitoína | mostrar ao lado da AHA, como divergência | não mostrar |
| H6 | STA: TASC | mostrar como novidade, sem conduta | não mostrar ainda |
| H7 | Antídotos: conferir dose por dose (AHA 2023/2025, Andrews 2023) | tarefa à parte, depois deste lote | junto deste lote |
| H8 | Hipernatremia: velocidade de correção | só nota, limite do livro mantido | não mostrar |
| H9 | Rabdomiólise: corte de CPK do ENMC | nota de divergência, critério do livro mantido | não mostrar |
| H10 | PRAM, linha 46 | reescrever: "validado de 2 a 17 anos; abaixo de 2 anos, só um estudo pequeno" | manter |
| H11 | SOFA na sepse | manter o SOFA-1; nota do SOFA-2; corrigir a linha 84 do `sofa2.ts` | trocar pelo SOFA-2 |
| H12 | Acesso venoso, 9ª edição | nota agora; troca da fonte depois de o RT ler | trocar já |
| H13 | CIVD ISTH 2025 | nota agora; troca do escore depois de ler | trocar já |
| H14 | NEWS2: rótulos da versão oficial | tarefa à parte, com a enfermagem | não mexer |
| H15 | GRACE 3.0 | nota com link externo para a calculadora oficial | só nota |
| H16 | Alvarado: WSES 2025 | nota agora; troca da fonte depois de ler | trocar já |
| H17 | CAD pediátrica: glargina precoce | não entra (dose só com o RT) | nota com a dose do estudo |
| H18 | Manchester no idoso | nota de alerta na triagem, sem sugerir cor | não mostrar |
| H19–H22 | Braden, GCS-P, Light, cálcio na hiperpotassemia | ficam para tarefa à parte | entram neste lote |

## Plano de entrega (com A em tudo)
Um PR por área, cada um com testes antes:
1. Área 1
2. Área 2a
3. Área 2b
4. Pediatria
5. Escores

Ao fim, uma migration com as versões novas (`scripts/fichas-sql.mjs`), testada na homologação, pede o "ok produção". Depois, as versões entram na fila de aprovação do RT.
