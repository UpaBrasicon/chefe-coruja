# H7. Antídotos do adulto: conferência dose por dose com a AHA 2023 e a AHA 2025

**Origem:** pedido do RT em 11/11/2026, depois da decisão A no H7 (`PUBMED-H7-H14-H19-H22-DIAGNOSTICO.md`). A decisão A pôs a nota do Andrews 2023 na digoxina e deixou a conferência com a AHA para uma segunda rodada. Esta é a segunda rodada.

**Fontes:** o RT baixou e entregou os PDFs completos das duas diretrizes. Os PDFs não entram no repositório.
- **AHA 2023:** Lavonas EJ, et al. 2023 American Heart Association Focused Update on the Management of Patients With Cardiac Arrest or Life-Threatening Toxicity Due to Poisoning. Circulation. 2023;148(16):e149–e184. PMID 37721023. doi:10.1161/CIR.0000000000001161.
- **AHA 2025:** Cao D, et al. Part 10: Adult and Pediatric Special Circumstances of Resuscitation. 2025 AHA Guidelines for CPR and ECC. Circulation. 2025;152(16 Suppl 2):S578–S672. PMID 41122889. doi:10.1161/CIR.0000000000001380. Só a parte de toxicologia (p. S632–S667 e a Tabela 5, p. S668–S670).

**Este documento é só conferência.** Nenhum código, dose ou tela muda aqui. Cada mudança depende de decisão do RT e vai em PR próprio.

## Como foi feito

- Texto completo lido nas duas diretrizes: as tabelas de dose (AHA 2023, Tabela 2, p. e155; AHA 2025, Tabela 4, p. S633–S634), todas as tabelas de recomendação de toxicologia e o texto de apoio de cada uma.
- Os números de linha são do master de 11/11/2026 (commit `8ebb01ae`). A tabela do diagnóstico anterior tem linhas antigas, deslocadas em 4 a 5 linhas. Valem as daqui.
- `ts` = `src/clinico/adulto/intoxicacoes.ts` (ficha versão `2026-11-11.1`, linha 60). `tsx` = `src/pages/plantonista/manual/IntoxicacoesAntidotosAdulto.tsx`.
- Dose só do texto lido. As colunas pediátricas das tabelas da AHA não foram usadas: a ferramenta é de adulto, e nada passa do adulto para a criança.
- "Não achado no texto" quer dizer que procurei na diretriz e ela não traz aquilo.
- Força da recomendação (COR): 1 forte; 2a moderada; 2b fraca; 3: Sem benefício; 3: Dano. Nível de evidência (LOE): A, B-R, B-NR, C-LD, C-EO (opinião de especialistas).

**Um cuidado de leitura.** As duas tabelas da AHA se chamam "doses comumente usadas". A própria AHA diz que a dose ideal da maioria dos antídotos não é conhecida, que há esquemas alternativos com o mesmo apoio e que a dose se titula pela resposta (nota da Tabela 2, p. e155, e da Tabela 4, p. S634). "Diverge" aqui quer dizer "difere da tabela da AHA". Não quer dizer que o livro esteja errado.

## Escopo: o que a AHA não cobre

Busquei no texto completo das duas: paracetamol, N-acetilcisteína, metanol, etilenoglicol, fomepizol, salicilato, anticolinérgico, fisostigmina, lítio e carvão ativado.
- Nenhum deles tem seção nem recomendação. A leitura do resumo estava certa.
- A N-acetilcisteína só aparece como "3: Sem benefício" na **metemoglobinemia** (AHA 2023 p. e167; AHA 2025 p. S649). Não tem relação com o paracetamol.
- O carvão só aparece como pergunta em aberto (descontaminação no betabloqueador e no BCC) nas lacunas de pesquisa (AHA 2023 p. e182; AHA 2025 p. S669).
- O monóxido de carbono não tem seção. Aparece só junto do cianeto.
- ISRS não estão na lista. A venlafaxina está entre os bloqueadores de canal de sódio (AHA 2023, Tabela 3, p. e175).

## Tabela dose por dose

| # | App (arquivo:linha) | AHA 2023 | AHA 2025 (Parte 10) | Status |
|---|---|---|---|---|
| 1 | **Carvão ativado**: 10 g por 1 g ingerido; 25–100 g (1 g/kg); tricíclico 1 g/kg até 50 g; múltiplas doses 12,5 g/h (`ts:82–99`; `tsx:25–55`) | Sem recomendação; só lacuna de pesquisa (p. e182) | Idem (p. S669) | **Fora do escopo da AHA** |
| 2 | **NAC VO**: 140 mg/kg + 70 mg/kg 4/4 h por 72 h (`ts:176–177`; `tsx:85–86`) | Paracetamol não coberto | Idem | **Fora do escopo da AHA** |
| 3 | **NAC EV**: 150 mg/kg em 1 h, 50 mg/kg em 4 h, 100 mg/kg em 16 h (`ts:178–187`; `tsx:87–100`) | Paracetamol não coberto | Idem | **Fora do escopo da AHA** |
| 4 | **Flumazenil**: 0,2 mg EV em 30 s, repetir até 1 mg (`ts:214–215`; `tsx:110`) | 0,2 mg, titular até 1 mg (Tab. 2, p. e155). 2a B-NR em BZD pura sem contraindicação; 3: Sem benefício C-EO na PCR; 3: Dano B-R com risco de convulsão ou arritmia (p. e156) | Mesma dose (Tab. 4, p. S633). 2a **C-LD**; 3: Sem benefício C-EO; 3: Dano B-R (p. S634) | **Confere**. "30 s" não achado no texto |
| 5 | **Naloxona, drive presente**: 0,04 mg IV (`ts:222`; `tsx:111–113`) | Dose inicial 0,2–2 mg IV/IO/IM, ou 2–4 mg intranasal; repetir a cada 2–3 min (Tab. 2, p. e155) | Igual (Tab. 4, p. S633) | **Diverge**: 0,04 mg é 5 vezes menor que o piso da tabela (0,2 mg). Ressalva: a tabela é para intoxicação grave, e a dose inicial ideal é lacuna de pesquisa (p. e182) |
| 6 | **Naloxona, apneia**: 0,2–1 mg IV (`ts:223`) | Dentro de 0,2–2 mg. Parada respiratória com pulso: 2a B-NR (p. e169) | Dentro de 0,2–2 mg. Parada respiratória com pulso: **1 B-NR** (p. S651) | **Confere** |
| 7 | **Naloxona, PCR**: 2 mg IV (`ts:224`) | Dose no teto de 0,2–2 mg. Na PCR, a RCP vem antes da naloxona (1 C-EO, p. e169) | Naloxona na PCR "pode ser razoável" se não atrapalhar a RCP (2b B-NR, p. S651) | **Confere** na dose. Falta a ressalva da RCP (ver lacunas) |
| 8 | **Naloxona, repetição e teto**: repetir em poucos minutos até FR > 12; sem máximo; reconsiderar após 5–10 mg (`ts:226–227`; `tsx:114`) | Repetir a cada 2–3 min; titular até reverter a depressão respiratória e voltar o reflexo de via aérea (p. e155). Sem dose máxima | Igual (p. S633) | **Confere**. FR > 12 e "5–10 mg" não achados no texto |
| 9 | **Naloxona, alta**: sem naloxona nas últimas 3 h (`ts:228`) | Observar em serviço de saúde até risco baixo de recorrência, consciência e sinais vitais normais (1 C-LD, p. e170). Sem número de horas | Igual (1 C-LD, p. S653). Sem número de horas | **AHA recomenda mas sem dose** (sem tempo fixo) |
| 10 | **Fisostigmina**: 0,5–2 mg EV lento (`ts:232–237`; `tsx:115`) | Anticolinérgico não coberto | Idem | **Fora do escopo da AHA** |
| 11 | **Betabloqueador, atropina**: 1 mg, até 3 doses (`ts:242`; `tsx:128–129`) | 0,5–1 mg a cada 3–5 min, até 3 mg (Tab. 2, p. e155). 2b C-LD (p. e157) | A linha da atropina para betabloqueador **saiu** da Tab. 4. Recomendação não achada na seção (p. S636) | **Confere** (com a 2023) |
| 12 | **Betabloqueador, glucagon**: 5 mg EV em 1 min; repetir após 10–15 min; infusão 2–5 mg/h (`ts:243–244`; `tsx:130`) | 2–10 mg; infusão 1–15 mg/h; prever vômito (Tab. 2, p. e155). 2a C-LD (p. e157) | Igual (Tab. 4, p. S633). 2a C-LD (p. S636) | **Confere** (dentro das faixas). "1 min" e "10–15 min" não achados |
| 13 | **Betabloqueador, cálcio**: gluconato 10% 30 mL (3 g) + SF 100 mL em 10 min (`ts:245`; `tsx:131`) | Sem recomendação de cálcio no betabloqueador. A Tab. 2 dá cálcio só para BCC | **Novo:** 2b C-EO (p. S636). Tab. 4 inclui o betabloqueador: gluconato 6.000 mg = 60 mL a 10% (28 mEq de Ca); manutenção 0,6–1,2 mL/kg/h; titular pela PA; Ca iônico até 1,5–2 × LSN (p. S633) | **Diverge**: o livro dá metade do ataque (30 mL x 60 mL) e não dá manutenção |
| 14 | **Betabloqueador, adrenalina**: infusão a partir de 1 µg/min, alvo PAM > 60 (`ts:246`; `tsx:132`) | Vasopressor: 1 C-LD (p. e157). Sem dose | Vasopressor: 1 **C-EO** (p. S636). Cita noradrenalina e adrenalina. Sem dose | **AHA recomenda mas sem dose** |
| 15 | **Betabloqueador, insulina, bolus**: 1 UI/kg (`ts:247`; `tsx:133–134`) | 1 U/kg (Tab. 2, p. e155). 1 B-NR, refratária ou junto do vasopressor (p. e157) | 1 U/kg (p. S633). 1 **C-LD**, hipotensão refratária ao vasopressor (p. S636) | **Confere** |
| 16 | **Betabloqueador, insulina, infusão**: 0,5 UI/kg/h, teto de 10 UI/kg (`ts:247–249`; `tsx:133–134`) | 1–10 U/kg/h; insulina regular; vigiar hipoglicemia, hipocalemia e volume (Tab. 2, p. e155) | Igual (p. S633) | **Diverge**: o livro começa em 0,5, abaixo do piso de 1 U/kg/h. O teto de 10 bate com o teto da AHA, que é **por hora**: isso confirma a leitura da errata do app (`ts:249`) |
| 17 | **Glicose de suporte**: G50% 50 mL se glicemia < 200; SG 10% a 100 mL/h (livro, p. 1318) ou 200 mL/h (Figura 2) (`ts:248`, `ts:281`) | Só "vigiar hipoglicemia"; o texto diz que protocolo com glicose suplementar reduz hipoglicemia (p. e157). Sem dose | Igual (p. S636, S638). Sem dose | **AHA recomenda mas sem dose** |
| 18 | **Betabloqueador, emulsão lipídica**: só após centro de toxicologia; sem dose (`ts:250`; `tsx:135`) | 3: Sem benefício C-LD (p. e157) | **Mudou:** 2b C-EO, utilidade incerta no choque refratário (p. S636) | **Confere** (sem dose dos dois lados; a conduta restritiva cabe nas duas) |
| 19 | **BCC, cálcio, ataque**: "3–6 g de cálcio" (`ts:266`; `tsx:138–139`) | Gluconato 6.000 mg (60 mL a 10%) ou cloreto 2.000 mg (20 mL a 10%); os dois = 28 mEq de Ca (Tab. 2, p. e155). 2a C-LD (p. e158) | Igual (p. S633). 2a **C-EO** (p. S638) | **Diverge**: 6 g bate com o gluconato da AHA; o piso de 3 g é metade. A AHA diz o sal e o teor em mEq, que o livro não diz |
| 20 | **BCC, cálcio, manutenção**: 0,5 mEq/kg/h (0,6–1,2 mL/kg/h de gluconato 10%) (`ts:266–268`; `tsx:138–139`) | Gluconato 60–120 mg/kg/h = 0,28–0,56 mEq/kg/h = 0,6–1,2 mL/kg/h (Tab. 2, p. e155) | Igual (p. S633) | **Confere**. A AHA resolve a errata do app (`ts:270`): 0,6–1,2 mL/kg/h são 0,28–0,56 mEq/kg/h, e o 0,5 do livro cai dentro |
| 21 | **BCC, cálcio, Figura 2**: gluconato ou cloreto 10% 10 mL; repetir até 3 vezes (`ts:274`; `tsx:140`) | Cloreto 20 mL ou gluconato 60 mL a 10%, os dois com 28 mEq (p. e155) | Igual (p. S633) | **Diverge**: a figura usa o mesmo volume para os dois sais. No cloreto, 10 mL é metade do ataque da AHA; no gluconato, é 1/6 (3 doses = 30 mL, metade) |
| 22 | **BCC, vasopressor, Figura 2**: adrenalina ou noradrenalina 1–5 µg/min (`ts:275`; `tsx:141`) | Vasopressor: 1 B-NR (p. e158). Sem dose. O texto cita uma série com noradrenalina até 100 µg/min em adultos (relato, não recomendação; p. e159) | Vasopressor: 1 **C-LD** (p. S638). Mesmo relato (p. S638). Sem dose | **AHA recomenda mas sem dose** |
| 23 | **BCC, glucagon, Figura 2**: 3–10 mg (0,03–0,05 mg/kg); repetir a cada 10 min ou infusão 1–5 mg/h (`ts:276–278`; `tsx:142–143`) | 2–10 mg; infusão 1–15 mg/h (p. e155). 2b C-LD, utilidade incerta (p. e158) | Igual (p. S633). 2b **C-EO** (p. S638) | **Confere** (dentro das faixas). Dose em mg/kg para adulto não achada (a faixa em mg/kg da tabela é pediátrica e não serve aqui) |
| 24 | **BCC, insulina, Figura 2**: 0,5–1 UI/kg + 0,5–1 UI/kg/h (`ts:279–280`; `tsx:144–145`) | 1 U/kg; 1–10 U/kg/h (p. e155). 1 B-NR (p. e158) | Igual (p. S633). 1 B-NR (p. S638) | **Diverge**: o piso de 0,5 fica abaixo da AHA no bolus e na infusão; o teto da infusão é 1, contra 10 na AHA |
| 25 | **BCC, emulsão lipídica 20%, Figura 2**: 1,5 mL/kg em 2–3 min + 0,5 mL/kg/min (`ts:282–284`; `tsx:146–147`) | Dose da tabela é para anestésico local: 1,5 mL/kg até 100 mL; 0,25 mL/kg/min por até 30 min (p. e155). No BCC: uso rotineiro não recomendado (3: Sem benefício C-LD, p. e158) | Anestésico local: < 70 kg 1,5 mL/kg; > 70 kg 100 mL em 2–3 min; manutenção < 70 kg 0,25 mL/kg/min por até 30 min; > 70 kg 200–250 mL em 15–20 min (p. S633). No BCC: **mudou** para 2b C-EO, utilidade incerta no choque refratário (p. S638) | **Diverge**: a infusão do livro é o dobro (0,5 x 0,25 mL/kg/min); o bolus não tem o teto de 100 mL; a AHA não põe a emulsão como passo de rotina no BCC |
| 26 | **Emulsão na PCR por anestésico local**: 0,25 mL/kg/min (livro, cap. 2, p. 50; citado em `ts:291`) | 0,25 mL/kg/min por até 30 min (p. e155). Emulsão no anestésico local: 1 C-LD (p. e166) | Igual para < 70 kg (p. S633). 1 C-LD (p. S647) | **Confere** |
| 27 | **BCC, depois da Figura 2**: atropina ou marca-passo se bradicardia sintomática; extracorpórea se refratário; sem dose (`ts:285`; `tsx:148`) | Atropina 2a C-LD; marca-passo 2b C-LD; VA-ECMO 2a C-LD (p. e158) | Atropina e marca-passo: recomendação não achada. ECLS no adulto: 2a **B-NR** (p. S638) | **Confere** (sem dose no app) |
| 28 | **Digoxina, 10 frascos** com quantidade e nível desconhecidos (`ts:316`; `tsx:168`) | Aguda, grave, dose desconhecida: 10–20 frascos; 1 frasco = 40 mg de Fab; "doses menores podem ser igualmente eficazes" (Tab. 2, p. e155). Fab: 1 B-NR (p. e163) | Igual (p. S633). 1 B-NR (p. S646) | **Confere** (10 é o piso da faixa) |
| 29 | **Digoxina, quantidade conhecida**: frascos = dose (mg) × 0,8 ÷ 0,5 (`ts:317–318`, `ts:326–328`; `tsx:169–170`) | Aguda: 1 frasco para cada 0,5 mg ingeridos, sem fator de biodisponibilidade (p. e155) | Igual (p. S633) | **Diverge**: o livro dá 80% dos frascos da AHA (ex.: 5 mg ingeridos = 8 frascos no app, 10 na AHA) |
| 30 | **Digoxina, nível e peso**: frascos = digoxinemia (ng/mL) × peso ÷ 100 (`ts:331–333`; `tsx:171–172`) | Mesma fórmula, indicada para intoxicação **crônica** (p. e155) | Igual (p. S633) | **Confere** (a AHA rotula a fórmula como crônica) |
| 31 | **Bicarbonato, tricíclico**: 1–2 mEq/kg em bolus + 150 mEq em SG 5% 1.000 mL a 200–250 mL/h; alvo pH 7,45–7,55, sem passar de 7,6 (`ts:344–345`; `tsx:182–187`) | Bolus 50–150 mEq; infusão de solução a 150 mEq/L a 1–3 mL/kg/h (Tab. 2, p. e155). Tricíclico: 1 B-NR (p. e176). Limites: sódio até 150–155 mEq/L, pH até 7,50–7,55 (p. e176) | Igual na dose (p. S633). Tricíclico: 1 B-NR (p. S659). Limites: sódio até 155, pH até 7,55; alvo inicial pH ≈ 7,50 ou fim da hipotensão e do QRS largo (p. S660) | **Diverge**: (a) o teto de pH do app (7,6) passa do limite da AHA (7,55); (b) não há limite de sódio; (c) o bolus é por peso: em 70 kg dá 70–140 mEq e cabe nos 50–150, mas acima de 75 kg os 2 mEq/kg passam de 150; (d) a infusão é fixa (200–250 mL/h); a AHA usa 1–3 mL/kg/h (70–210 mL/h em 70 kg) |
| 32 | **Bicarbonato, cocaína**: 1 mEq/kg EV (`ts:348`; `tsx:182–187`) | Bolus 50–150 mEq (p. e155). Cocaína com taquicardia de QRS largo ou PCR: 2a C-LD (p. e160) | Igual (p. S633). 2a C-LD (p. S640) | **Confere** (em peso adulto usual) |
| 33 | **ISRS, QTc**: bicarbonato 1–2 mEq/kg; magnésio 2 g em 2 min (`ts:346`) | ISRS não cobertos. Magnésio para taquicardia de QRS largo: sem apoio para recomendar (p. e176) | ISRS não cobertos | **Fora do escopo da AHA** |
| 34 | **Bicarbonato fora do escopo**: alcalinização urinária, salicilato, álcoois tóxicos, lítio (`ts:342–343`, `ts:347`, `ts:349`, `ts:352`) | Não cobertos | Idem | **Fora do escopo da AHA** |
| 35 | **Metanol e etilenoglicol**: fomepizol, etanol EV e VO, ácido fólico, piridoxina, tiamina, cálcio, hemodiálise (`ts:364–382`; `tsx:194–210`) | Não cobertos | Idem | **Fora do escopo da AHA** |
| 36 | **Organofosforado, atropina**: prova com 1 mg; 2–5 mg IV, dobrar a cada 3–5 min até melhorar a broncorreia e o broncoespasmo (`ts:400–403`; `tsx:218–221`) | 1–2 mg, dobrar a cada 5 min; manutenção de 10–20% da dose total de ataque por hora, até 2 mg/h (Tab. 2, p. e155). Alvo: tórax limpo, FC > 80, PAS > 80. 1 **A** (p. e174) | Igual (p. S633). 1 A (p. S657–S658) | **Diverge**: início do app 2–5 mg x 1–2 mg na AHA (só 2 mg em comum); intervalo 3–5 x 5 min; o app não tem a infusão de manutenção. Prova com 1 mg não achada |
| 37 | **Pralidoxima**: 30 mg/kg em 30 min + 8 mg/kg/h (`ts:404`; `tsx:222–223`) | 1–2 g; 400–600 mg/h (Tab. 2, p. e155). 2a A (p. e174) | **Mudou:** 2 g EV em 15–30 min (sem bolus rápido) ou 0,6 g IM até 3 doses; manutenção **1 g/h** (Tab. 4, p. S633). 2a A (p. S657). O texto liga a dose maior a dois ECR de dose alta x baixa (p. S658) | **Diverge**: em 70 kg o app dá ≈ 2,1 g e 560 mg/h. O ataque fica perto dos 2 g; a infusão bate com a 2023 e fica em pouco mais da metade de 1 g/h da 2025 |
| 38 | **Hidroxocobalamina**: 5 g em 15 min; repetir até 10 g no total (`ts:437–439`, `ts:449–454`; `tsx:236–237`) | 5 g (p. e155). 1 C-LD (p. e162) | 5 g; "doses repetidas podem ser necessárias"; hipertensão transitória (p. S633). 1 C-LD (p. S644) | **Confere** (5 g). "15 min" e teto de 10 g não achados |
| 39 | **Tiossulfato de sódio**: 12,5 g (50 mL a 25%) (`ts:440–441`, `ts:459`; `tsx:238–239`) | 12,5 g (p. e155). Junto com hidroxocobalamina ou nitrito: 2a C-LD (p. e162) | 12,5 g (p. S634). Com nitrito, sem hidroxocobalamina: 1 C-LD. Sozinho, com CO junto e sem hidroxocobalamina: 2a C-EO. Junto com hidroxocobalamina: **2b** C-EO (p. S644) | **Confere** |
| 40 | **Nitrito de sódio**: 3% 10 mL EV lento = 300 mg (`ts:443`, `ts:460`; `tsx:240–241`) | 300 mg; vigiar hipotensão (p. e155). Sem hidroxocobalamina: 1 C-LD (p. e162) | 300 mg (p. S634). Em combinação com tiossulfato, sem hidroxocobalamina: 1 C-LD (p. S644) | **Confere** |
| 41 | **Nitrito de amila**: 1–2 ampolas (0,3 mL) inaladas em 30 s (`ts:442`; `tsx:240`) | Não achado no texto | Não achado no texto | **Não achado no texto** |
| 42 | **Monóxido de carbono**: O2 100%; critérios de hiperbárica (`ts:429–433`; `tsx:243`) | Sem seção de CO. O2 100% aparece só no cianeto (2a C-EO, p. e162) | Sem seção de CO. A recomendação de O2 100% no cianeto não achada na 2025 | **Fora do escopo da AHA** |

### Notas da digoxina
- A AHA não dá cortes de potássio nem de digoxinemia para indicar o anticorpo (`ts:319`). Não achado no texto.
- A AHA 2023 diz que doses menores podem ser tão eficazes quanto as da tabela (p. e155, citando o estudo ATOM-6). Isso conversa com o esquema titulado do Andrews 2023, já mostrado na tela (`ts:50–51`; `tsx:174`).
- A dose empírica ideal na PCR é lacuna de pesquisa nas duas (AHA 2023 p. e182; AHA 2025 p. S670).

## Recomendações da AHA sobre antídotos que a ferramenta tem, mas que faltam nela

| # | Recomendação | AHA 2023 | AHA 2025 | Onde ficaria |
|---|---|---|---|---|
| L1 | Flumazenil não tem papel na PCR por benzodiazepínico | 3: Sem benefício C-EO (p. e156) | Igual (p. S634) | Flumazenil (`ts:215`) |
| L2 | Opioide junto com benzodiazepínico: naloxona primeiro | 2a B-NR (p. e156) | 2a B-NR (p. S634) | Flumazenil ou naloxona |
| L3 | Na PCR, RCP de qualidade antes da naloxona; naloxona só se não atrapalhar | 1 C-EO (p. e169) | 2b B-NR (p. S651) | Naloxona, PCR (`ts:224`) |
| L4 | Naloxona intranasal 2–4 mg; infusão de 2/3 da dose que acordou o paciente, por hora | Tab. 2 (p. e155); doses repetidas ou infusão 2a C-LD (p. e170) | Tab. 4 (p. S633); 2a C-LD (p. S653) | Naloxona (`ts:220–230`) |
| L5 | Entregar naloxona e orientação na alta de quem teve overdose de opioide | Não achado | **Novo:** 1 C-LD (p. S653) | Naloxona, alta (`ts:228`) |
| L6 | Emulsão lipídica no BCC: não é rotina | 3: Sem benefício C-LD (p. e158) | 2b C-EO, incerta (p. S638) | Figura 2 do BCC (`ts:282–284`) |
| L7 | Digoxina: hemodiálise, hemofiltração, hemoperfusão e plasmaférese não são recomendadas | 3: Sem benefício B-NR (p. e163) | Igual (p. S646) | Digoxina (`ts:315–323`) |
| L8 | Digoxina: lidocaína ou fenitoína para arritmia ventricular até chegar o anticorpo | 2b C-LD, com bretílio (p. e163) | 2b C-EO, sem bretílio (p. S646) | Digoxina |
| L9 | Cianeto com CO junto (incêndio) e sem hidroxocobalamina: tiossulfato sozinho é razoável; o nitrito forma metemoglobina e piora o transporte de O2 | O texto avisa do risco do nitrito com CO (p. e162) | **Novo:** 2a C-EO (p. S644) | Sequência do cianeto (`ts:444`), que hoje manda nitrito antes do tiossulfato |
| L10 | Organofosforado: atropina em infusão de manutenção; alvo FC > 80 e PAS > 80 | Tab. 2 e p. e174 | Tab. 4 e p. S658 | Atropina do OP (`ts:401–403`) |
| L11 | Organofosforado: não usar succinilcolina nem mivacúrio | 3: Sem benefício C-LD (p. e174) | 3: Sem benefício C-EO (p. S657) | Organofosforado |
| L12 | Bicarbonato: sódio até 155 mEq/L e pH até 7,55; no intubado, hiperventilar junto com o bicarbonato | Limites no texto (p. e176) | Limites (p. S660); hiperventilação **nova**, 2a C-LD (p. S659) | Bicarbonato (`ts:344–345`) |
| L13 | Cocaína: betabloqueador não recomendado no vasoespasmo ou na emergência hipertensiva; lidocaína na taquicardia de QRS largo | Lidocaína 2a C-LD (p. e160) | Betabloqueador **novo**, 3: Sem benefício C-LD; lidocaína 2a C-LD (p. S640) | Bicarbonato, cocaína (`ts:348`) |
| L14 | Hemodiálise na intoxicação grave por atenolol, sotalol ou nadolol | 2b C-LD, sem nadolol (p. e157) | 2b C-LD, com nadolol (p. S636) | Betabloqueador |

## Antídotos e medidas da AHA que a ferramenta não tem

Só a lista. Nenhum entra sem o RT incluir no backlog, com fonte lida.
- **Azul de metileno** na metemoglobinemia (1 B-NR nas duas; p. e167, p. S649) e no choque vasoplégico do BCC (2b; p. e158, p. S638). Já registrado como pedido fora do backlog.
- Exsanguineotransfusão e oxigênio hiperbárico na metemoglobinemia sem resposta ao azul (2b nas duas). Ácido ascórbico: 3: Sem benefício em 2023; 2b em 2025, só se o azul faltar ou for contraindicado (p. S649).
- Emulsão lipídica como linha própria na intoxicação por anestésico local (1 C-LD nas duas). Hoje só aparece citada numa divergência (`ts:291`).
- Lidocaína nos bloqueadores de canal de sódio Ia e Ic (2b nas duas).
- Anticorpo antidigoxina para sapo Bufo e espirradeira-amarela (2a nas duas).
- Benzodiazepínico para convulsão na intoxicação por anestésico local e no organofosforado (1 nas duas); sedação na cocaína e nos simpatomiméticos (1).
- Resfriamento rápido na hipertermia por cocaína e simpatomimético (1); vasodilatador no vasoespasmo (2a).
- VA-ECMO na intoxicação refratária (2a nas duas).
- Betabloqueador na arritmia ventricular refratária por hidrocarboneto volátil (seção **nova** de 2025, 2b C-EO, p. S665).
- Nalmefeno: citado na 2025 como outro antagonista de opioide, sem recomendação própria (p. S651–S652).

## O que mudou da AHA 2023 para a AHA 2025

Só o que toca as linhas da ferramenta.
- **Betabloqueador:** cálcio passou a ter recomendação (2b C-EO) e entrou na tabela; a atropina e o marca-passo saíram; a emulsão foi de "3: Sem benefício" para "2b, incerta"; a insulina passou a ser para hipotensão refratária ao vasopressor (1 C-LD).
- **BCC:** atropina e marca-passo saíram; emulsão foi de "não recomendada de rotina" para "2b, incerta"; cálcio, glucagon e azul de metileno mantiveram a classe, com LOE C-EO.
- **Tabela de doses:** a linha da atropina 0,5–1 mg para betabloqueador, BCC, digoxina e anestésico local saiu; a pralidoxima foi para 2 g em 15–30 min + 1 g/h; a emulsão ganhou dose por faixa de peso (< 70 kg e > 70 kg); o teto do azul de metileno foi para 7 mg/kg; a hidroxocobalamina ganhou "doses repetidas podem ser necessárias".
- **Digoxina:** atropina e marca-passo saíram das recomendações, porque já fazem parte do suporte avançado (p. S646); o bretílio saiu.
- **Cianeto:** o nitrito passou a ser recomendado junto com o tiossulfato; o tiossulfato sozinho ficou razoável com CO junto; o tiossulfato somado à hidroxocobalamina caiu de 2a para 2b; a recomendação de O2 100% não foi achada na 2025.
- **Opioide:** naloxona na parada respiratória com pulso subiu para 1 B-NR; na PCR, foi de "RCP tem prioridade" para "pode ser razoável se não atrapalhar a RCP" (2b); a entrega de naloxona na alta é nova (1).
- **Bloqueador de canal de sódio:** hiperventilação no intubado é nova (2a); os limites ficaram em sódio 155 e pH 7,55.
- **Flumazenil:** dose igual; o LOE da indicação no adulto foi de B-NR para C-LD.

## Divergências: opções para o RT

Padrão das opções:
- **A:** trocar a linha pelo valor da AHA, citando a AHA.
- **B:** manter o livro e mostrar a AHA como nota de divergência ao lado, no mesmo padrão de `NOTA_DIGOXINA_ANDREWS`.
- **C:** não mudar nada.

| # | Divergência | Recomendação | Por quê |
|---|---|---|---|
| D1 (linha 5) | Naloxona 0,04 mg com drive presente x piso de 0,2 mg da AHA | **C** | A tabela da AHA é para intoxicação com risco de vida, e a dose inicial ideal é lacuna de pesquisa na própria AHA |
| D2 (linha 13) | Cálcio no betabloqueador: 30 mL x 60 mL de gluconato 10%; sem manutenção | **B** | A recomendação da AHA é nova e fraca (2b C-EO); a nota mostra a dose sem trocar a fonte |
| D3 (linha 16) | Insulina no betabloqueador: infusão começa em 0,5 x 1–10 U/kg/h | **B** | A classe é forte (1), e a nota também confirma que o teto de 10 é por hora |
| D4 (linha 19) | Cálcio no BCC: ataque 3–6 g x 6 g de gluconato (ou 2 g de cloreto) | **B** | A AHA dá o sal e os mEq que faltam no livro; a nota fecha a errata sem mexer na conta |
| D5 (linha 21) | Cálcio na Figura 2: 10 mL para os dois sais x 20 mL de cloreto ou 60 mL de gluconato | **B** | Mesmo motivo da D4; dá para juntar D4 e D5 numa nota só |
| D6 (linha 24) | Insulina na Figura 2: piso 0,5 e teto 1 U/kg/h x 1 U/kg e 1–10 U/kg/h | **B** | Junta com a D3 numa nota só da insulina |
| D7 (linha 25) | Emulsão na Figura 2: 0,5 x 0,25 mL/kg/min; bolus sem teto de 100 mL; AHA não põe como rotina no BCC | **B** | A dose da AHA é de anestésico local, não de BCC, então não substitui a linha; a nota soma a AHA à divergência que a tela já mostra com o cap. 2 |
| D8 (linha 29) | Digoxina com dose conhecida: × 0,8 ÷ 0,5 x 1 frasco por 0,5 mg | **B** | Mesmo padrão do Andrews; cabe na nota de divergência que já existe na digoxina |
| D9 (linha 31) | Bicarbonato no tricíclico: teto de pH 7,6 x 7,55; sem limite de sódio; bolus e infusão por peso x fixos | **B** | A errata do app já mostra que o livro tem alvos diferentes por página; a nota põe os limites da AHA (sódio 155, pH 7,55) ao lado |
| D10 (linha 36) | Atropina no organofosforado: início 2–5 mg x 1–2 mg; sem manutenção | **B** | Recomendação 1 A; a nota mostra o início e a infusão da AHA sem tirar a escolha do médico |
| D11 (linha 37) | Pralidoxima: 30 mg/kg + 8 mg/kg/h x 2 g + 1 g/h (AHA 2025) | **B** | A AHA 2025 mudou a dose e a apoia em ECR de dose alta; a nota mostra a dose nova ao lado do livro |

## Decisões do RT

O RT respondeu em 11/11/2026: seguir a recomendação (D1 sem mudança; D2 a D11 como nota de divergência) e, das recomendações que faltam, L1, L3, L6, L7, L9 e L11. Entrega na branch `pubmed/h7-aha-notas`, ficha 2026-11-11.2.

| Item | Recomendação | Decisão |
|---|---|---|
| D1. Naloxona 0,04 mg com drive presente | C | C |
| D2. Cálcio no betabloqueador (AHA 2025: 60 mL de gluconato 10% + 0,6–1,2 mL/kg/h) | B | B |
| D3. Insulina no betabloqueador (AHA: 1–10 U/kg/h; teto por hora) | B | B |
| D4. Cálcio no BCC, ataque (AHA: gluconato 6 g ou cloreto 2 g, 28 mEq) | B | B |
| D5. Cálcio na Figura 2 (AHA: cloreto 20 mL ou gluconato 60 mL) | B (junto com D4) | B |
| D6. Insulina na Figura 2 (AHA: 1 U/kg + 1–10 U/kg/h) | B (junto com D3) | B |
| D7. Emulsão lipídica na Figura 2 (AHA: 0,25 mL/kg/min; não é rotina no BCC) | B | B |
| D8. Digoxina, dose conhecida (AHA: 1 frasco por 0,5 mg, sem × 0,8) | B (na nota da digoxina) | B |
| D9. Bicarbonato no tricíclico (AHA: 50–150 mEq; 150 mEq/L a 1–3 mL/kg/h; sódio até 155, pH até 7,55) | B | B |
| D10. Atropina no organofosforado (AHA: 1–2 mg, dobrar a cada 5 min; manutenção 10–20%/h até 2 mg/h) | B | B |
| D11. Pralidoxima (AHA 2025: 2 g em 15–30 min + 1 g/h) | B | B |
| L1–L14. Recomendações que faltam (sobretudo L3, L6, L7, L9 e L11) | B (notas curtas, só as que o RT escolher) | L1, L3, L6, L7, L9 e L11 como nota |
| Nota `NOTA_AHA_INTOXICACOES` (`ts:42–43`): hoje diz que as linhas "ainda não foram conferidas" | Trocar o texto depois das decisões acima, citando este documento | Texto trocado |

## Resumo

42 linhas da ferramenta conferidas:
- **Confere:** 18
- **Diverge:** 11
- **AHA recomenda mas sem dose:** 4
- **Fora do escopo da AHA:** 8
- **Não achado no texto:** 1 (nitrito de amila)

Recomendações da AHA que faltam para antídotos presentes: 14 (L1–L14). Antídotos e medidas da AHA ausentes na ferramenta: 10 itens na lista, só para registro.

## Não conferido aqui
- Os antídotos pediátricos (`src/clinico/pediatria/`): a criança segue o livro do ICr-HCFMUSP, e nada do adulto passa para ela.
- O suplemento da AHA 2023 (estratégias de busca) não foi lido; ele não traz doses.
- A bula dos produtos disponíveis no Brasil (anticorpo antidigoxina, hidroxocobalamina, emulsão lipídica) não foi conferida.
