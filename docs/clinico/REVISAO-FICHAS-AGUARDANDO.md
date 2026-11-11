# Fichas aguardando aprovação: guia de revisão do RT

Este guia ajuda o RT a aprovar as versões de ferramentas clínicas que estão na fila. Não muda nada no app. Data: 11/11/2026.

## Números de hoje

- 127 versões aguardando aprovação, em 110 ferramentas.
- 15 dessas versões entraram hoje (11/11/2026), em 13 ferramentas.
- 40 ferramentas nunca tiveram versão aprovada. Elas precisam da primeira aprovação.
- 13 ferramentas têm mais de uma versão na fila.
- Por área: Adulto — condutas, 42 ferramentas (54 versões); Adulto — escores, 37 ferramentas (38 versões); Pediatria, 20 ferramentas (21 versões); Enfermagem, triagem e escalas, 11 ferramentas (14 versões).

De onde vêm os dados: a tabela `ferramenta_versoes` da produção (só os metadados das versões, nenhum dado de paciente) e o código em `src/clinico` no `master` de 11/11/2026 (0bbe958f).

## Como a aprovação funciona

- A tela é **Revisão clínica** (`/revisao-clinica`), no grupo Unidade do menu. Só o RT médico nomeado decide.
- Cada versão tem dois botões: aprovar ou reprovar. Para reprovar, escreva a correção (10 caracteres ou mais).
- A decisão fica registrada com o nome do RT, o conselho, o número do registro e a UF, a data e a hora. Também vai para a auditoria.
- Aprovar uma versão troca a versão aprovada anterior para "substituída". A versão nova passa a ser a aprovada.

### Aprove na ordem, da mais antiga para a mais nova

Quando a ferramenta tem mais de uma versão na fila, a ordem importa:

- Aprovar só a mais nova funciona, mas a mais antiga continua na fila como "aguardando aprovação".
- Se depois você aprovar a mais antiga, ela vira a aprovada e a mais nova vira "substituída". A ferramenta volta para a versão antiga.
- Por isso: aprove da mais antiga para a mais nova. Ou aprove só a mais nova e não aprove mais as antigas dessa ferramenta.
- A mesma tela tem a aprovação em lote (#604): marque as versões (ou "Marcar todas") e use "Aprovar marcadas". Ela aprova uma por uma, da mais antiga para a mais nova em cada ferramenta, com o seu nome e registro em cada versão. Reprovar continua uma por uma.

Ferramentas com mais de uma versão na fila: `adulto-anafilaxia` (2), `adulto-cefaleia` (2), `adulto-emergencia-hipertensiva` (2), `adulto-intoxicacoes-antidotos` (5), `adulto-meningite` (2), `adulto-pcr` (2), `adulto-reversao-anticoagulacao` (3), `avaliacao-braden` (2), `hiperpotassemia` (2), `ped-kawasaki` (2), `sofa-2` (2), `triagem-dor-flacc` (2), `triagem-dor-numerica` (2).

## Como ler as tabelas

- **Versões aguardando**: da mais antiga para a mais nova, com a data em que entrou na fila.
- **Versão aprovada hoje**: a que vale agora. "nenhuma" quer dizer que a ferramenta nunca foi aprovada.
- **O que mudou**: resumo do campo "revisado em" da versão mais nova no código, e do comentário de versão no mesmo arquivo. As versões antigas da fila não estão mais no código: a mais nova contém o que elas trouxeram. Onde há mais de uma data, cada data diz o que entrou nela.
- **Fontes novas**: citações da versão na fila que não estão na versão aprovada (autor e ano). Na primeira versão, são todas as fontes.
- **Muda dose?**: "não" quando o texto só acrescenta nota, aviso ou citação. "sim" diz qual dose ou valor mudou. "conferir" pede que o RT olhe a tela antes de aprovar. "1ª versão" quando tudo é novo; "com doses" quando a ferramenta traz dose.

## Adulto — condutas (42 ferramentas)

| Ferramenta | Versões aguardando | Versão aprovada hoje | O que mudou | Fontes novas | Muda dose? |
|---|---|---|---|---|---|
| `adulto-abstinencia-alcoolica`<br>Síndrome de abstinência alcoólica — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do fenobarbital no PS e da diretriz BAP 2026. | Lee CM 2024; Sinclair JMA 2026 | não |
| `adulto-anafilaxia`<br>Anafilaxia — adulto | 2026-10-25.1 (25/10)<br>2026-11-06.1 (06/11) | 2026-09-27.1 | 25/10: critérios da WAO 2020 e do Practice Parameter 2023 ao lado do manual (critérios, adrenalina por peso, reação bifásica, observação, triptase). 06/11: nota do consenso GALEN 2024. Manual segue como base. | Cardona V 2020; Golden DBK 2023; Dribin TE 2024 | conferir: adrenalina por peso da WAO/AAAAI aparece ao lado do manual (25/10) |
| `adulto-ascite-pbe-hepatorrenal`<br>Ascite, PBE e síndrome hepatorrenal — adulto | 2026-10-09.1 (09/10) | 2026-09-27.1 | Critérios de SRH do ADQI-ICA 2024 ao lado do livro, com a divergência da EASL (48 h de albumina). | Nadim MK 2024; Schleicher EM 2025 | não (o código diz "nenhuma dose nova") |
| `adulto-bicarbonato`<br>Bicarbonato de sódio — déficit e esquemas do manual | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do ensaio BICARICU-2. | Jung B 2025 | não |
| `adulto-bradicardia`<br>Bradicardia sintomática — adulto | 2026-10-27.1 (27/10) | 2026-09-28.1 | AHA 2025 lida no texto integral (seção 19 e Figura 8) e ERC/RCUK 2025. Manual segue como base. | Wigginton JG 2025 | conferir: atropina da AHA (1 mg, até 3 mg) agora conferida no texto, ao lado do ERC (0,5 mg) |
| `adulto-cad-ehh-tratamento`<br>CAD e EHH — hidratação, insulina, potássio e bicarbonato | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota da insulina basal precoce na transição; consenso 2024 conferido no texto. Manual do HC segue como base. | AbuJlambo A 2026 | não |
| `adulto-cefaleia`<br>Cefaleia aguda — sinais de alarme e tratamento (adulto) | 2026-10-24.1 (24/10)<br>2026-10-27.1 (28/10) | nenhuma (1ª versão) | Sinais de alarme (SNNOOP10) e tratamento. 27/10: doses da migrânea pelo consenso da SBCe 2000, com página; níveis da AHS 2025 pelo resumo. | Brandão Neto RA 2022; Do TP 2019; SBCe 2000; Robblee J 2025 | 1ª versão, com doses (migrânea) |
| `adulto-colica-renal`<br>Cólica nefrética — analgesia, cálculo e internação (adulto) | 2026-10-24.1 (24/10) | nenhuma (1ª versão) | Analgesia, cálculo e internação. Doses conferidas no manual, com página; Meltzer 2018 pelo resumo. | Brandão Neto RA 2022; Meltzer AC 2018 | 1ª versão, com doses (analgesia) |
| `adulto-dpoc-exacerbacao`<br>Exacerbação de DPOC — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da ATS 2026 sobre VNI na IRpA hipercápnica. | Goel NN 2026 | não |
| `adulto-emergencia-hipertensiva`<br>Emergência hipertensiva — alvos e drogas EV (adulto) | 2026-10-25.1 (25/10)<br>2026-11-06.1 (06/11) | 2026-09-28.1 | 25/10: sulfato de magnésio na pré-eclâmpsia grave e na eclâmpsia, esquemas EV e IM do manual da OMS (o manual do HC não traz; a DBHA 2025 não dá dose). 06/11: nota do INTERACT4 e da ESO 2025 no AVC isquêmico sem trombólise. | Brandão AA 2025; OMS 2017; OMS 2011; Li G 2024; Sandset EC 2025 | sim: sulfato de magnésio (esquemas EV e IM da OMS), 25/10 |
| `adulto-estado-de-mal-epileptico`<br>Estado de mal epiléptico — adulto | 2026-10-25.1 (25/10) | 2026-09-27.1 | Levetiracetam na 2ª linha pelo ESETT e pela AES 2016, em linha separada das do manual. | Brandão Neto RA 2022; Kapur J 2019; Glauser T 2016 | sim: levetiracetam 60 mg/kg, máx. 4.500 mg (AES 2016/ESETT) |
| `adulto-falciforme`<br>Anemia falciforme — crise álgica e síndrome torácica aguda (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do TASC (anticoagulação na síndrome torácica aguda). | Mekontso Dessap A 2025 | não |
| `adulto-hemorragia-digestiva`<br>Hemorragia digestiva alta e baixa — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da ESGE 2026 na úlcera péptica. | Gralnek IM 2026 | não |
| `adulto-heparina-nao-fracionada`<br>Heparina não fracionada EV — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da ISTH 2026 sobre anti-Xa e TTPa. | Gouin-Thibault I 2026 | não |
| `adulto-hipernatremia`<br>Hipernatremia — água livre e Adrogué-Madias | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da velocidade de correção (J Crit Care 2025). O limite do manual continua. | Kitisin N 2025 | não |
| `adulto-hiponatremia`<br>Hiponatremia — NaCl 3% pelo manual | 2026-10-09.1 (09/10) | 2026-09-27.1 | Alerta contra a subcorreção (JAMA Intern Med 2025). O teto de 8 mEq/L em 24 h continua. | Ayus JC 2025 | não |
| `adulto-hsa`<br>Hemorragia subaracnóidea — nimodipino e metas (adulto) | 2026-11-06.1 (06/11) | 2026-09-28.1 | Notas da ESO/EANS/ESMINT 2026 (antifibrinolítico) e da NCS 2026 (fenitoína). | Vergouwen MDI 2026; Rowe AS 2026 | não |
| `adulto-ic-aguda`<br>Insuficiência cardíaca aguda — adulto | 2026-11-06.1 (06/11) | 2026-09-28.1 | Notas do PUSH-AHF e da metanálise do SGLT2 na internação. | Ter Maaten JM 2023; Ahmed HM 2026 | não |
| `adulto-intermacao`<br>Intermação — resfriamento e meta (adulto) | 2026-10-24.1 (25/10) | nenhuma (1ª versão) | Resfriamento e meta. Recomendações conferidas no texto completo da SCCM 2025. | Barletta JF 2025 | 1ª versão |
| `adulto-intoxicacoes-antidotos`<br>Intoxicações e antídotos — adulto | 2026-10-09.1 (09/10)<br>2026-11-06.1 (06/11)<br>2026-11-11.1 (11/11)<br>2026-11-11.2 (11/11)<br>2026-11-11.3 (11/11) | 2026-09-27.1 | 09/10: carvão ativado com o consenso CTRC 2026 ao lado do livro (janela maior, "dose adicional"). 06/11: notas da AHA 2023/2025 e dos consensos da digoxina. 11/11.1: esquema do Andrews 2023 na digoxina ao lado do livro (decisão H7). 11/11.2: conferência dose por dose com a AHA, divergências como nota. 11/11.3: azul de metileno na metemoglobinemia (pedido do RT, opção A). | Hoegberg LCG 2026; Lavonas EJ 2023; Cao D 2025; Hack JB 2025; Andrews P 2023 | sim: azul de metileno 1–2 mg/kg IV, máx. 7 mg/kg (11/11.3). Conferir também o carvão do CTRC (09/10) e os frascos da digoxina do Andrews (11/11.1), ao lado do livro; as doses do livro não mudam |
| `adulto-isr`<br>Intubação em sequência rápida — adulto | 2026-11-06.1 (06/11) | 2026-09-27.2 | Nota da ATS 2026 na pré-oxigenação. | Goel NN 2026 | não |
| `adulto-itu`<br>ITU — cistite, pielonefrite e sonda vesical (adulto) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Cistite, pielonefrite e sonda vesical. Doses conferidas no manual, com página; IDSA 2025 pelo resumo. | Brandão Neto RA 2022; Trautner BW 2025 | 1ª versão, com doses (antibióticos) |
| `adulto-marca-passo-provisorio`<br>Marca-passo provisório — transcutâneo e transvenoso (adulto) | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota da captura elétrica no marca-passo transcutâneo. | Kimbrell JM 2026 | não |
| `adulto-meningite`<br>Meningite e encefalite — conduta inicial (adulto) | 2026-10-24.1 (24/10)<br>2026-10-27.1 (27/10) | nenhuma (1ª versão) | Conduta inicial. 27/10: quimioprofilaxia de contatos pelo Guia de Vigilância em Saúde 2024, com página. | Brandão Neto RA 2022; MS, Guia de Vigilância 2024 | 1ª versão, com doses (inclui quimioprofilaxia) |
| `adulto-oxigenacao-irpa`<br>Oxigenação e insuficiência respiratória aguda — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Notas da ATS 2026 e do SOHO no cateter nasal de alto fluxo e da ATS 2026 na pós-extubação. | Goel NN 2026; Frat JP 2026 | não |
| `adulto-pac-antibiotico`<br>PAC — antibiótico por grupo de risco (adulto) | 2026-10-09.1 (09/10) | 2026-09-28.1 | Citação da ATS corrigida; REMAP-CAP 2025 ao lado do corticoide. | Jones BE 2026; REMAP-CAP 2025 | não |
| `adulto-pcr`<br>Drogas e desfibrilação na PCR — adulto | 2026-10-25.1 (25/10)<br>2026-11-06.1 (06/11) | 2026-09-27.1 | 25/10: AHA 2025 Part 9 lida no texto integral, ao lado da Tabela 2 do manual. 06/11: notas do IVIO, PARAMEDIC-3, DOSE VF e do bicarbonato na PCR intra-hospitalar. | Wigginton JG 2025; Vallentin MF 2025; Couper K 2025; Cheskes S 2022; Granfeldt A 2026 | sim: 2ª dose de lidocaína da AHA (0,5–0,75 mg/kg), que o manual não traz, calculada ao lado (25/10) |
| `adulto-pep-hiv`<br>PEP de HIV, IST e hepatite B — adulto | 2026-10-23.1 (24/10) | nenhuma (1ª versão) | PEP de HIV, IST e hepatite B. Doses e critérios conferidos no PCDT, com página. | MS, PCDT PEP 2024 | 1ª versão, com doses (PCDT 2024) |
| `adulto-pos-pcr`<br>Cuidados pós-PCR — metas, temperatura e prognóstico (adulto) | 2026-10-09.1 (09/10) | 2026-09-27.1 | Metas pela ERC-ESICM 2025: prevenção de febre (≤ 37,5 °C), PAM > 60–65, SpO2 94–98%, PaCO2 35–45. Os números do livro continuam visíveis. | Nolan JP 2025 | sim (metas, não dose): temperatura, PAM, SpO2 e PaCO2 pela ERC-ESICM 2025 |
| `adulto-queimadura`<br>Queimadura — superfície queimada e reposição inicial (adulto) | 2026-10-24.2 (25/10) | nenhuma (1ª versão) | Superfície queimada e reposição inicial pela ABA 2024. Coluna adulto de Lund e Browder conferida no livro do ICr, com errata. | Cartotto R 2024; Schvartsman C 2023 | 1ª versão, com volume de reposição |
| `adulto-rabdomiolise`<br>Rabdomiólise — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota de divergência do corte de CPK (ENMC). | Kruijt N 2024 | não |
| `adulto-ressuscitacao-volemica`<br>Ressuscitação volêmica no choque e na sepse — adulto | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota do ARISE FLUIDS na linha do vasopressor. | ARISE FLUIDS 2026 | não |
| `adulto-reversao-anticoagulacao`<br>Reversão de anticoagulação e sangramento — adulto | 2026-10-25.1 (25/10)<br>2026-11-06.1 (06/11)<br>2026-11-11.1 (11/11) | 2026-09-27.1 | 25/10: andexanete como divergência (ANNEXA-I), sem dose. 06/11: nota do consenso SBTH 2026; janela do carvão ativado nos DOAC passa de < 2 h para < 4 h. 11/11: epistaxe pela AAO-HNS 2020, tratamento local antes de reverter; tranexâmico tópico só como divergência, sem dose. | Connolly SJ 2024; Lopes RD 2026; Tunkel DE 2020; Reuben A 2021; Fatahi M 2026 | sim (janela, não dose): carvão ativado nos DOAC de < 2 h para < 4 h (06/11) |
| `adulto-sca-inicial`<br>SCA — conduta inicial (adulto) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Conduta inicial na SCA. Doses conferidas no manual, com página; ACC/AHA 2025 e ESC 2023. | Brandão Neto RA 2022; Rao SV 2025; Byrne RA 2023 | 1ª versão, com doses (antiagregante e anticoagulante) |
| `adulto-sintomas-paliativos`<br>Dor, dispneia e sedação em cuidados paliativos — adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do marco EAPC 2024 na sedação paliativa. | Surges SM 2024 | não |
| `adulto-transfusao-hemocomponentes`<br>Transfusão de hemocomponentes — adulto | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota da lesão cerebral aguda (TRAIN, HEMOTION e SAHaRA). | Taccone FS 2024; Turgeon AF 2024; English SW 2025 | não |
| `adulto-trauma-inicial`<br>Politraumatizado — tempos e volumes do atendimento inicial (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do PATCH-Trauma no ácido tranexâmico e dos ensaios sem benefício na circulação. | PATCH-Trauma 2023; Davenport R 2023; Jansen JO 2023; Bouzat P 2023; Smith JE 2026; Sperry JL 2026 | não |
| `adulto-trombolise-avc`<br>Trombólise no AVC isquêmico — adulto | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota do INTERACT4 e da ESO 2025 na PA. | Li G 2024; Sandset EC 2025 | não |
| `adulto-vm-desmame`<br>Desmame e teste de respiração espontânea (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Notas da AARC 2024 no TRE e da ATS 2026 na pós-extubação. | Roberts KJ 2024; Burns KEA 2024; Goel NN 2026 | não |
| `adulto-vm-sdra`<br>SDRA — Berlim, definição global 2024, ventilação protetora e tabelas PEEP × FiO2 (adulto) | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota da SCCM 2026 no bloqueio neuromuscular. | Erstad BL 2026 | não |
| `adulto-vni-cinco-passos`<br>Ventilação não invasiva em cinco passos (adulto) | 2026-11-06.1 (06/11) | 2026-09-30.1 | Nota da ATS 2026 na IRpA hipercápnica. | Goel NN 2026 | não |
| `hiperpotassemia`<br>Hiperpotassemia — conduta por nível e por ECG | 2026-10-09.1 (09/10)<br>2026-11-11.1 (11/11) | 2026-09-27.2 | Adulto e criança. 09/10: citação de Arzayus-Patiño corrigida. 11/11: nota do Jessen 2025 sobre o cálcio no adulto (decisão H22). O texto registra também a auditoria de 03/10/2026: na criança tudo sai do livro do ICr. | Geldermann N 2026; Arzayus-Patiño L 2026; Brandão Neto RA 2022; Schvartsman C 2023; Jessen MK 2025 | conferir: na criança, desde a auditoria de 03/10 (posterior à versão aprovada), tudo sai do livro do ICr |

## Adulto — escores (37 ferramentas)

| Ferramenta | Versões aguardando | Versão aprovada hoje | O que mudou | Fontes novas | Muda dose? |
|---|---|---|---|---|---|
| `4at-delirium`<br>4AT — rastreio de delirium no idoso | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Rastreio de delirium no idoso. Pontos conferidos no texto da fonte. | Bellelli G 2014; Shenkin SD 2019 | 1ª versão |
| `abcd2`<br>ABCD2 — risco de AVC depois do AIT | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do AVC no próprio atendimento no risco baixo. | Lumia S 2026; Deris D 2025 | não |
| `adulto-duke-modificado`<br>Endocardite infecciosa — critérios de Duke-ISCVID 2023 (adulto) | 2026-10-09.1 (09/10) | 2026-09-30.1 | Duke-ISCVID 2023 conferido na página da revista. Livro mantido como referência. | Fowler VG Jr 2023; Brandão Neto RA 2022 | não |
| `adulto-escore-ich`<br>Escore ICH — hemorragia intraparenquimatosa (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da NCS sobre neuroprognóstico. | Hwang DY 2024 | não |
| `adulto-hints-plus`<br>HINTS e HINTS plus — síndrome vestibular aguda (adulto) | 2026-10-09.1 (09/10) | 2026-09-27.1 | Aviso de uso pela GRACE-3 2023. | Edlow JA 2023 | não |
| `adulto-maddrey`<br>Função discriminante de Maddrey — hepatite alcoólica (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da ACG 2024 sobre MELD e Maddrey. | Jophlin LL 2024 | não |
| `adulto-mascc`<br>MASCC — risco na neutropenia febril (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do consenso MASCC 2026 nos cuidados. | Cooksley T 2026 | não |
| `adulto-qtc`<br>QTc — Bazett, Fridericia, Framingham e Hodges (adulto) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Bazett, Fridericia, Framingham e Hodges. Fórmulas e limiares conferidos no texto da fonte. | Drew BJ 2010; Sagie A 1992; Patel PJ 2016; Vandenberk B 2016 | 1ª versão |
| `adulto-regiscar`<br>RegiSCAR — escore para DRESS (adulto) | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do consenso Delphi de DRESS 2024. | Brüggen MC 2024 | não |
| `alvarado`<br>Alvarado — probabilidade de apendicite aguda | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da WSES 2025 e do AIR. A WSES 2020 segue como fonte da regra. | Podda M 2025; Andersson RE 2025 | não |
| `bisap`<br>BISAP — gravidade da pancreatite aguda | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do desempenho dos escores na pancreatite grave. | Capurso G 2023; IAP 2025; Cárdenas-Jaén K 2026 | não |
| `canadian-ct-head`<br>Canadian CT Head Rule — TCE leve no adulto | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da validação japonesa (2026). | Kimoto K 2026 | não |
| `civd-isth`<br>CIVD manifesta — escore do ISTH | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da definição ISTH 2025. O escore de 2001 continua. | Iba T 2025 | não |
| `ckd-epi-2021`<br>TFG estimada — CKD-EPI 2021 e 2009 (adulto) | 2026-10-09.1 (09/10) | 2026-09-30.1 | CKD-EPI 2009 (sem coeficiente racial) ao lado da 2021, pelo estudo brasileiro de 2024. | Levey AS 2009; Escott GM 2024 | sim (valor, não dose): mostra também a TFG pela CKD-EPI 2009 |
| `cockcroft-gault`<br>Clearance de creatinina — Cockcroft-Gault (adulto) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Fórmula conferida no texto da fonte. | Cockcroft DW 1976; Scappaticci GB 2017; Quadri KH 1994 | 1ª versão |
| `crb-65`<br>CRB-65 — gravidade da pneumonia comunitária sem ureia | 2026-10-25.1 (25/10) | nenhuma (1ª versão) | CRB-65, sem ureia. | Lim WS 2003; McNally M 2010 | 1ª versão |
| `fast-ed`<br>FAST-ED — suspeita de oclusão de grande vaso no AVC | 2026-11-11.1 (11/11) | nenhuma (1ª versão) | Escala de oclusão de grande vaso (item E8). Tabela 1 conferida no PDF do artigo. | Lima FO 2016 | 1ª versão |
| `glasgow`<br>Escala de Coma de Glasgow (GCS-P) | 2026-11-11.1 (11/11) | 2026-09-27.1 | Pupilas na linha de registro do GCS-P (Vreeburg, decisão H20). O número do Glasgow e do GCS-P não muda. | Vreeburg RJG 2025 | não |
| `glasgow-blatchford`<br>Glasgow-Blatchford — hemorragia digestiva alta | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da ESGE 2026 sobre o horário da EDA. | Gralnek IM 2026 | não |
| `grace`<br>GRACE — risco na síndrome coronariana aguda | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota do GRACE 3.0, com o endereço da calculadora oficial. | Wenzl FA 2022; Wenzl FA 2025; calculadora GRACE 3.0 (Wenzl 2023) | não |
| `heart`<br>HEART — dor torácica no pronto-socorro | 2026-10-25.1 (25/10) | 2026-09-27.1 | Diretriz brasileira de dor torácica 2025. | de Barros e Silva PGM 2025 | não |
| `light`<br>Critérios de Light — exsudato ou transudato | 2026-11-11.1 (11/11) | 2026-09-28.1 | Regra sem soro passa a ser a combinação tripla do Porcel 2026: proteína > 3 g/dL, LDH > 2/3 do LSN ou colesterol > 55 mg/dL (decisão H21). O cálculo de Light não muda. | Porcel JM 2026 | sim (critério, não dose): regra sem soro trocada pela tripla do Porcel 2026 |
| `mcisaac-centor`<br>McIsaac (Centor modificado) — faringite | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Faringite, adulto e criança. Itens conferidos no texto da fonte. | McIsaac WJ 1998; Brennan-Krohn T 2018; Fine AM 2012 | 1ª versão |
| `news2`<br>NEWS2 — escore de alerta precoce | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota da versão brasileira oficial. Rótulos sem mudança. | Oliveira APA 2020; Sousa AS 2025 | não |
| `ottawa-joelho`<br>Regra de Ottawa — joelho (adulto) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Critérios conferidos no texto da fonte. | Stiell IG 1995; Bachmann LM 2004 | 1ª versão |
| `ottawa-tornozelo-pe`<br>Regras de Ottawa — tornozelo e pé (adulto) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Critérios conferidos no texto da fonte. | Stiell IG 1993; Bachmann LM 2003; Schiper SP 2023; Yazdani S 2006 | 1ª versão |
| `paliativo-pergunta-surpresa`<br>Pergunta surpresa — cuidados paliativos | 2026-10-31.1 (06/11) | nenhuma (1ª versão) | Resumo da metanálise conferido no PubMed. | Downar J 2017 | 1ª versão |
| `psi-port`<br>PSI / PORT — gravidade da pneumonia adquirida na comunidade | 2026-10-09.1 (09/10) | 2026-09-27.1 | Citação de Bai e Loeb corrigida (NEJM Evidence). | Bai AD 2025 | não |
| `ranson`<br>Ranson — gravidade da pancreatite não biliar | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do desempenho dos escores na pancreatite grave. | Capurso G 2023; IAP 2025; Cárdenas-Jaén K 2026 | não |
| `sepse-adulto`<br>Sepse no adulto — SOFA, choque e lactato (Sepsis-3 · SSC 2026 · ILAS 2026) | 2026-11-06.1 (06/11) | 2026-09-28.3 | Nota do SOFA-2 e das validações no pronto-socorro. O SOFA-1 continua. | Ranzani OT 2025; Ahn S 2026; Yen CC 2026 | não |
| `sgarbossa-modificado`<br>Sgarbossa modificado (Smith) — BRE ou marca-passo | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | BRE ou marca-passo. Critérios conferidos no texto das fontes. | Smith SW 2012; Sgarbossa EB 1996; Meyers HP 2015; Dodd KW 2021; Lindow T 2023 | 1ª versão |
| `sincope-canadense`<br>Canadian Syncope Risk Score — síncope no pronto-socorro (adulto) | 2026-10-25.1 (25/10) | 2026-09-30.1 | Validações de 2020, 2022 e 2026. | Thiruganasambandamoorthy V 2020; Zimmermann T 2022; Suh EH 2026 | não |
| `sofa-2`<br>SOFA-2 — disfunção orgânica no adulto em UTI (2025) | 2026-10-25.1 (25/10)<br>2026-11-06.1 (06/11) | nenhuma (1ª versão) | 25/10: SOFA-2 (2025). 06/11: nota das validações no pronto-socorro (Ahn 2026 e Yen 2026). | Ranzani OT 2025; Ahn S 2026; Yen CC 2026 | 1ª versão |
| `spesi`<br>sPESI — PESI simplificado no TEP (adulto) | 2026-10-25.1 (25/10) | nenhuma (1ª versão) | PESI simplificado no TEP. | Jiménez D 2010; Bonsu KO 2026 | 1ª versão |
| `twist`<br>TWIST — torção testicular (14 a 18 anos) | 2026-11-11.1 (11/11) | nenhuma (1ª versão) | Torção testicular de 14 a 18 anos (item P9). Pontos e cortes conferidos nos resumos. | Barbosa JA 2013; Lewis S 2026 | 1ª versão |
| `wells-tvp`<br>Wells para TVP — probabilidade de trombose venosa profunda | 2026-11-06.1 (06/11) | 2026-09-27.1 | Nota do D-dímero ajustado à idade. | Le Gal G 2026 | não |
| `years`<br>YEARS — suspeita de embolia pulmonar | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota do ensaio Hydra no câncer ativo. | Akerboom B 2026 | não |

## Pediatria (20 ferramentas)

| Ferramenta | Versões aguardando | Versão aprovada hoje | O que mudou | Fontes novas | Muda dose? |
|---|---|---|---|---|---|
| `curva-crescimento-oms`<br>Curva de crescimento (OMS 2006 e 2007) | 2026-09-29.1 (09/10) | nenhuma (1ª versão) | Porte do protótipo. Valores conferidos contra as tabelas de escore-z da OMS no teste. | OMS 2006; de Onis M 2007; Cole TJ 1990; MS, SISVAN 2011 | 1ª versão |
| `ped-bolus`<br>Doses pediátricas por peso | 2026-11-11.1 (11/11) | 2026-09-27.3 | Nota de peso de emergência (Wells 2017, item P10). | Wells M 2017 | não |
| `ped-cad-ehh`<br>Cetoacidose diabética e EHH — criança | 2026-11-06.1 (06/11) | 2026-09-27.3 | Nota do Ringer lactato × SF 0,9%. | Agarwal A 2025; Singhal D 2025 | não |
| `ped-choque-icr`<br>Choque séptico — criança | 2026-10-09.1 (09/10) | 2026-09-28.1 | Nota do PRoMPT BOLUS no fluido. Livro do ICr segue como base. | Balamuth F 2026 | não |
| `ped-crise-hipertensiva`<br>Crise hipertensiva — criança | 2026-10-25.1 (25/10) | 2026-09-27.3 | p90 e p95 calculados pelas Tabelas 4 e 5 da AAP 2017, com sexo e estatura. Os campos manuais continuam. Livro do ICr segue como base. | Flynn JT 2017 | sim (valor, não dose): p90/p95 da PA pela AAP 2017 |
| `ped-dengue`<br>Dengue — criança (grupos e hidratação) | 2026-11-11.1 (11/11) | 2026-09-28.1 | Nota de divergência do Wells 2017 ao lado do peso aproximado do MS (item P10). | Wells M 2017 | não |
| `ped-emergencias-oncologicas`<br>Emergências oncológicas — criança | 2026-11-06.1 (06/11) | 2026-09-28.1 | Nota do ensaio de suspensão precoce do antibiótico na neutropenia febril. | Vissing NH 2026 | não |
| `ped-febre-sem-sinais`<br>Febre sem sinais localizatórios — criança | 2026-10-25.1 (26/10) | 2026-09-27.3 | Lactente de 8 a 60 dias: AAP 2021 e PECARN 2019 ao lado do livro. | Pantell RH 2021; Kuppermann N 2019 | não (doses só do ICr) |
| `ped-ictericia-neonatal`<br>Icterícia neonatal ≥ 35 semanas — fototerapia e escalonamento (AAP 2022) | 2026-10-25.1 (25/10) | nenhuma (1ª versão) | Fototerapia e escalonamento pela AAP 2022. Limiares das tabelas suplementares conferidos na imagem. | Kemper AR 2022 | 1ª versão, com limiares de bilirrubina |
| `ped-infeccao-urinaria`<br>Infecção urinária — criança | 2026-10-09.1 (09/10) | 2026-09-27.3 | Aviso da diretriz AAP 2026. Os limiares novos esperam o texto integral; seguem os do livro. | Alverson BK 2026; Forster CS 2026; AlShenaiber L 2026 | não |
| `ped-kawasaki`<br>Doença de Kawasaki — critérios e doses | 2026-10-25.1 (25/10)<br>2026-11-06.1 (06/11) | 2026-09-27.3 | 25/10: AHA 2024 ao lado do livro (alto risco de aneurisma, intensificação inicial, doses da Tabela 3). 06/11: nota do ensaio de prednisolona adjuvante. | Jone PN 2024; Lin S 2026; Tufail U 2026 | sim: doses da Tabela 3 da AHA 2024 ao lado do livro (25/10) |
| `ped-pecarn-abdome`<br>PECARN — lesão intra-abdominal no trauma contuso (criança) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Fatores conferidos no texto da fonte. | Holmes JF 2013; Holmes JF 2024 | 1ª versão |
| `ped-pecarn-coluna-cervical`<br>PECARN — coluna cervical no trauma contuso (criança) | 2026-10-23.1 (23/10) | nenhuma (1ª versão) | Fatores conferidos no texto da fonte. | Leonard JC 2024 | 1ª versão |
| `ped-phoenix`<br>Escore de Phoenix — sepse e choque séptico (criança) | 2026-11-06.1 (06/11) | 2026-09-30.1 | Nota das validações externas (SENTINEL e Hong Kong). Mesma regra. | Long E 2025; He S 2026 | não |
| `ped-pram`<br>PRAM — gravidade da crise de asma (criança) | 2026-11-06.1 (06/11) | 2026-09-30.1 | Notas do CASPER, da coorte brasileira e do estudo em lactentes; faixa etária reescrita. A conta não muda. | Gray C 2026; Pergo LS 2026; Courselle A 2026 | não |
| `ped-rcp-icr`<br>RCP pediátrica — parâmetros, choque e drogas | 2026-10-25.1 (25/10) | 2026-09-28.1 | Part 8 da AHA 2025 lido no texto integral: doses e cargas conferem com o livro; entram o teto de 1 mg da epinefrina e temas novos. | Lasa JJ 2025 | sim: teto de 1 mg da epinefrina (AHA 2025) |
| `ped-reanimacao-neonatal`<br>Reanimação do RN ≥ 34 semanas em sala de parto (SBP 2026) | 2026-10-25.1 (25/10) | nenhuma (1ª versão) | RN ≥ 34 semanas pela SBP 2026. Doses e quadros conferidos no PDF, com página. | Almeida MFB 2026 | 1ª versão, com doses (SBP 2026) |
| `ped-ten-4-facesp`<br>TEN-4-FACESp — hematomas suspeitos de maus-tratos (criança abaixo de 4 anos) | 2026-11-11.1 (11/11) | nenhuma (1ª versão) | Hematomas suspeitos de maus-tratos abaixo de 4 anos (item P8). Regra conferida no texto completo. | Pierce MC 2021; Raut A 2025 | 1ª versão |
| `ped-tetano-raiva`<br>Tétano e raiva — profilaxia e doses na criança (MS) | 2026-11-11.1 (11/11) | nenhuma (1ª versão) | Profilaxia de tétano e raiva só pelo MS (item P11): GVS 2024 e notas técnicas 8/2022, 134/2022 e 35/2026. | MS, Guia de Vigilância 2024; MS, NT 8/2022; MS, NT 134/2022; MS, NT 35/2026 | 1ª versão, com doses (MS) |
| `ped-twist`<br>TWIST — torção testicular (criança) | 2026-11-11.1 (11/11) | nenhuma (1ª versão) | Torção testicular na criança (item P9). Pontos e cortes conferidos nos resumos. | Barbosa JA 2013; Lewis S 2026 | 1ª versão |

## Enfermagem, triagem e escalas (11 ferramentas)

| Ferramenta | Versões aguardando | Versão aprovada hoje | O que mudou | Fontes novas | Muda dose? |
|---|---|---|---|---|---|
| `acesso-venoso`<br>Escolha do acesso venoso | 2026-11-06.1 (06/11) | nenhuma (1ª versão) | Escolha do acesso venoso (adulto). Nota da 9ª edição da INS e citação completa da 8ª. | Gorski LA 2021; Nickel B 2024 | 1ª versão |
| `avaliacao-braden`<br>Braden — risco de lesão por pressão | 2026-09-29.1 (09/10)<br>2026-11-11.1 (11/11) | nenhuma (1ª versão) | 11/11: fonte das cinco faixas e nota de valor preditivo modesto (decisão H19). | Bergstrom N 1987; Paranhos WY 1999; Velozo BC 2026; Hillier B 2025 | 1ª versão |
| `avaliacao-morse`<br>Morse — risco de queda | 2026-10-09.1 (09/10) | nenhuma (1ª versão) | Citação da versão brasileira corrigida pelo PubMed. | Morse JM 1989; Urbanetto JS 2013; Urbanetto JS 2016 | 1ª versão |
| `dini-pediatrico`<br>Dini — classificação de pacientes pediátricos (11 indicadores) | 2026-11-06.1 (06/11) | nenhuma (1ª versão) | Classificação de pacientes pediátricos, 11 indicadores. Decisão do RT: A em D1 a D7. | Dini AP 2014; Dini AP 2011 | 1ª versão |
| `enfermagem-sae`<br>SAE — Processo de Enfermagem | 2026-09-29.1 (09/10) | nenhuma (1ª versão) | Processo de Enfermagem (porte do protótipo). | COFEN 2024; NANDA-I/NOC/NIC (licença da unidade) | 1ª versão |
| `fugulin-12-areas`<br>Fugulin — classificação de pacientes (12 áreas) | 2026-10-09.1 (09/10) | nenhuma (1ª versão) | Decisão do RT: 12 áreas, com resumo das graduações. | Fugulin FMT 2005; Santos F 2007; de Brito AP 2012 | 1ª versão |
| `triagem-anexos-sinais-vitais`<br>Sinais vitais — Anexos III e IV do protocolo de classificação de risco | 2026-09-29.1 (09/10) | nenhuma (1ª versão) | Anexos III e IV do protocolo de classificação de risco. Texto conferido contra o PDF. | Protocolo SMS Aparecida de Goiânia 2025; Protocolo SMS Aparecida de Goiânia 2025 (Anexo IV) | 1ª versão |
| `triagem-dor-flacc`<br>FLACC — escala comportamental de dor | 2026-09-29.1 (09/10)<br>2026-10-27.1 (27/10) | nenhuma (1ª versão) | 27/10: autorrelato a partir de 6 anos (decisão do RT). | Merkel SI 1997; Batalha 2009; Birnie KA 2019 | 1ª versão |
| `triagem-dor-nips`<br>NIPS — escala de dor no recém-nascido e lactente | 2026-09-29.1 (09/10) | nenhuma (1ª versão) | Porte do protótipo. | Lawrence J 1993; MS, Atenção ao RN v. 2 | 1ª versão |
| `triagem-dor-numerica`<br>Dor por autorrelato (0 a 10) | 2026-09-29.1 (09/10)<br>2026-10-27.1 (27/10) | nenhuma (1ª versão) | 27/10: autorrelato a partir de 6 anos (decisão do RT). | Protocolo SMS Aparecida de Goiânia 2025; Birnie KA 2019 | 1ª versão |
| `triagem-gestacao-naegele`<br>Idade gestacional e data provável do parto pela DUM (regra de Naegele) | 2026-09-29.1 (09/10) | nenhuma (1ª versão) | Regra de Naegele (porte do protótipo). | ACOG 2017 | 1ª versão |

## Ferramentas sem versão aprovada (primeira versão)

Estas 40 ferramentas nunca foram aprovadas. Precisam da primeira aprovação.

- **Adulto — condutas** (8): `adulto-cefaleia`: Cefaleia aguda — sinais de alarme e tratamento (adulto) (**com dose ou valor**); `adulto-colica-renal`: Cólica nefrética — analgesia, cálculo e internação (adulto) (**com dose ou valor**); `adulto-intermacao`: Intermação — resfriamento e meta (adulto); `adulto-itu`: ITU — cistite, pielonefrite e sonda vesical (adulto) (**com dose ou valor**); `adulto-meningite`: Meningite e encefalite — conduta inicial (adulto) (**com dose ou valor**); `adulto-pep-hiv`: PEP de HIV, IST e hepatite B — adulto (**com dose ou valor**); `adulto-queimadura`: Queimadura — superfície queimada e reposição inicial (adulto) (**com dose ou valor**); `adulto-sca-inicial`: SCA — conduta inicial (adulto) (**com dose ou valor**).
- **Adulto — escores** (13): `4at-delirium`: 4AT — rastreio de delirium no idoso; `adulto-qtc`: QTc — Bazett, Fridericia, Framingham e Hodges (adulto); `cockcroft-gault`: Clearance de creatinina — Cockcroft-Gault (adulto); `crb-65`: CRB-65 — gravidade da pneumonia comunitária sem ureia; `fast-ed`: FAST-ED — suspeita de oclusão de grande vaso no AVC; `mcisaac-centor`: McIsaac (Centor modificado) — faringite; `ottawa-joelho`: Regra de Ottawa — joelho (adulto); `ottawa-tornozelo-pe`: Regras de Ottawa — tornozelo e pé (adulto); `paliativo-pergunta-surpresa`: Pergunta surpresa — cuidados paliativos; `sgarbossa-modificado`: Sgarbossa modificado (Smith) — BRE ou marca-passo; `sofa-2`: SOFA-2 — disfunção orgânica no adulto em UTI (2025); `spesi`: sPESI — PESI simplificado no TEP (adulto); `twist`: TWIST — torção testicular (14 a 18 anos).
- **Pediatria** (8): `curva-crescimento-oms`: Curva de crescimento (OMS 2006 e 2007); `ped-ictericia-neonatal`: Icterícia neonatal ≥ 35 semanas — fototerapia e escalonamento (AAP 2022) (**com dose ou valor**); `ped-pecarn-abdome`: PECARN — lesão intra-abdominal no trauma contuso (criança); `ped-pecarn-coluna-cervical`: PECARN — coluna cervical no trauma contuso (criança); `ped-reanimacao-neonatal`: Reanimação do RN ≥ 34 semanas em sala de parto (SBP 2026) (**com dose ou valor**); `ped-ten-4-facesp`: TEN-4-FACESp — hematomas suspeitos de maus-tratos (criança abaixo de 4 anos); `ped-tetano-raiva`: Tétano e raiva — profilaxia e doses na criança (MS) (**com dose ou valor**); `ped-twist`: TWIST — torção testicular (criança).
- **Enfermagem, triagem e escalas** (11): `acesso-venoso`: Escolha do acesso venoso; `avaliacao-braden`: Braden — risco de lesão por pressão; `avaliacao-morse`: Morse — risco de queda; `dini-pediatrico`: Dini — classificação de pacientes pediátricos (11 indicadores); `enfermagem-sae`: SAE — Processo de Enfermagem; `fugulin-12-areas`: Fugulin — classificação de pacientes (12 áreas); `triagem-anexos-sinais-vitais`: Sinais vitais — Anexos III e IV do protocolo de classificação de risco; `triagem-dor-flacc`: FLACC — escala comportamental de dor; `triagem-dor-nips`: NIPS — escala de dor no recém-nascido e lactente; `triagem-dor-numerica`: Dor por autorrelato (0 a 10); `triagem-gestacao-naegele`: Idade gestacional e data provável do parto pela DUM (regra de Naegele).

## Como aprovar rápido

Ordem sugerida. Em cada passo, aprove as versões de uma ferramenta da mais antiga para a mais nova.

1. **Primeiras versões da triagem e da enfermagem, de uso diário** (11, sem dose): `acesso-venoso`, `avaliacao-braden`, `avaliacao-morse`, `dini-pediatrico`, `enfermagem-sae`, `fugulin-12-areas`, `triagem-anexos-sinais-vitais`, `triagem-dor-flacc`, `triagem-dor-nips`, `triagem-dor-numerica`, `triagem-gestacao-naegele`.
2. **Outras primeiras versões sem dose** (19, escores, regras e a intermação): `4at-delirium`, `adulto-intermacao`, `adulto-qtc`, `cockcroft-gault`, `crb-65`, `curva-crescimento-oms`, `fast-ed`, `mcisaac-centor`, `ottawa-joelho`, `ottawa-tornozelo-pe`, `paliativo-pergunta-surpresa`, `ped-pecarn-abdome`, `ped-pecarn-coluna-cervical`, `ped-ten-4-facesp`, `ped-twist`, `sgarbossa-modificado`, `sofa-2`, `spesi`, `twist`.
3. **Atualizações só de nota, aviso ou citação** (56, "Muda dose?" = não): `abcd2`, `adulto-abstinencia-alcoolica`, `adulto-ascite-pbe-hepatorrenal`, `adulto-bicarbonato`, `adulto-cad-ehh-tratamento`, `adulto-dpoc-exacerbacao`, `adulto-duke-modificado`, `adulto-escore-ich`, `adulto-falciforme`, `adulto-hemorragia-digestiva`, `adulto-heparina-nao-fracionada`, `adulto-hints-plus`, `adulto-hipernatremia`, `adulto-hiponatremia`, `adulto-hsa`, `adulto-ic-aguda`, `adulto-isr`, `adulto-maddrey`, `adulto-marca-passo-provisorio`, `adulto-mascc`, `adulto-oxigenacao-irpa`, `adulto-pac-antibiotico`, `adulto-rabdomiolise`, `adulto-regiscar`, `adulto-ressuscitacao-volemica`, `adulto-sintomas-paliativos`, `adulto-transfusao-hemocomponentes`, `adulto-trauma-inicial`, `adulto-trombolise-avc`, `adulto-vm-desmame`, `adulto-vm-sdra`, `adulto-vni-cinco-passos`, `alvarado`, `bisap`, `canadian-ct-head`, `civd-isth`, `glasgow`, `glasgow-blatchford`, `grace`, `heart`, `news2`, `ped-bolus`, `ped-cad-ehh`, `ped-choque-icr`, `ped-dengue`, `ped-emergencias-oncologicas`, `ped-febre-sem-sinais`, `ped-infeccao-urinaria`, `ped-phoenix`, `ped-pram`, `psi-port`, `ranson`, `sepse-adulto`, `sincope-canadense`, `wells-tvp`, `years`. Nelas a conta e a dose não mudam; basta ler a nota na tela.
4. **Por último, com calma: tudo o que mexe em dose ou valor.** Abra a tela da ferramenta e confira com a fonte citada.
   - "sim" (11):
     - `adulto-emergencia-hipertensiva`: Sulfato de magnésio (esquemas EV e IM da OMS), 25/10.
     - `adulto-estado-de-mal-epileptico`: Levetiracetam 60 mg/kg, máx. 4.500 mg (AES 2016/ESETT).
     - `adulto-intoxicacoes-antidotos`: Azul de metileno 1–2 mg/kg IV, máx. 7 mg/kg (11/11.3). Conferir também o carvão do CTRC (09/10) e os frascos da digoxina do Andrews (11/11.1), ao lado do livro; as doses do livro não mudam.
     - `adulto-pcr`: 2ª dose de lidocaína da AHA (0,5–0,75 mg/kg), que o manual não traz, calculada ao lado (25/10).
     - `adulto-pos-pcr`: Temperatura, PAM, SpO2 e PaCO2 pela ERC-ESICM 2025 (metas, não dose).
     - `adulto-reversao-anticoagulacao`: Carvão ativado nos DOAC de < 2 h para < 4 h (06/11) (janela, não dose).
     - `ckd-epi-2021`: Mostra também a TFG pela CKD-EPI 2009 (valor, não dose).
     - `light`: Regra sem soro trocada pela tripla do Porcel 2026 (critério, não dose).
     - `ped-crise-hipertensiva`: p90/p95 da PA pela AAP 2017 (valor, não dose).
     - `ped-kawasaki`: Doses da Tabela 3 da AHA 2024 ao lado do livro (25/10).
     - `ped-rcp-icr`: Teto de 1 mg da epinefrina (AHA 2025).
   - "conferir" (3):
     - `adulto-anafilaxia`: Adrenalina por peso da WAO/AAAAI aparece ao lado do manual (25/10).
     - `adulto-bradicardia`: Atropina da AHA (1 mg, até 3 mg) agora conferida no texto, ao lado do ERC (0,5 mg).
     - `hiperpotassemia`: Na criança, desde a auditoria de 03/10 (posterior à versão aprovada), tudo sai do livro do ICr.
   - Primeiras versões com dose ou valor (10): `adulto-cefaleia`, `adulto-colica-renal`, `adulto-itu`, `adulto-meningite`, `adulto-pep-hiv`, `adulto-queimadura`, `adulto-sca-inicial`, `ped-ictericia-neonatal`, `ped-reanimacao-neonatal`, `ped-tetano-raiva`.

Toda versão que muda dose ou valor está marcada na coluna "Muda dose?" com "sim" ou "conferir". Em caso de dúvida, reprove com a correção escrita: a versão fica reprovada e a aprovada anterior não muda.
