# Revisão PubMed: itens H7, H14 e H19 a H22 (tarefa à parte)

**Origem:** na revisão dos itens médios (`REVISAO-PUBMED-MEDIOS-DIAGNOSTICO.md`, decisão do RT de 06/11/2026), seis itens ficaram "para tarefa à parte": antídotos (H7), rótulos do NEWS2 (H14), faixas da Braden (H19), redação do GCS-P (H20), combinação tripla de Light (H21) e cálcio na hiperpotassemia (H22).

**Este documento é só diagnóstico.** Nenhum código, dose, corte ou ponto muda aqui. Cada item traz onde está no app, o que a fonte diz, a divergência e as opções para o RT.

**Como foi feito (11/11/2026):**
- Cada referência foi buscada no PubMed (metadados e resumo).
- Onde havia texto completo aberto no PMC, ele foi lido. Isso está marcado como "texto completo".
- Nada foi preenchido de memória. Onde a fonte não abriu, está escrito "não conferido".
- Regras que valem para tudo: dose só de fonte citada; nada passa do adulto para a criança; pediatria vai até 13a 11m 29d; a cor da classificação é da enfermagem.

**Fontes que não abriram:**
- AHA 2023 (Lavonas, PMID 37721023) e AHA 2025 Parte 10 (Cao, PMID 41122889): fora do PMC; o site da AHA respondeu 403 à ferramenta. Só o resumo foi lido.
- Hack 2025 (digoxina, PMID 39265879): fora do PMC. Só o resumo.
- Vreeburg 2024 (GCS-P, PMID 39686742) e Jessen 2025 (hiperpotassemia, PMID 39761907): fora do PMC. Só o resumo.
- Oliveira 2020 (NEWS2, PMID 33111761): fora do PMC, mas aberto no SciELO. O texto do Quadro 1 foi lido pela página do SciELO. A Figura 1 (a escala final) é imagem e não foi lida.

---

## H7. Antídotos: dose por dose

### Onde está
- `src/clinico/adulto/intoxicacoes.ts`, ficha `adulto-intoxicacoes-antidotos`, versão `2026-11-06.1` (linhas 48–58).
- Tela: `src/pages/plantonista/manual/IntoxicacoesAntidotosAdulto.tsx`. A nota da AHA aparece na linha 109; a da digoxina, na 173.
- Fonte das doses: Manual de Medicina de Emergência do HCFMUSP, 3ª ed., caps. 97–99.
- A nota atual (`NOTA_AHA_INTOXICACOES`, linha 42–43) já diz que as linhas de antídoto não foram conferidas com o texto completo da AHA.

### Fontes
- Lavonas EJ, Akpunonu PD, Arens AM, et al. 2023 American Heart Association Focused Update on the Management of Patients With Cardiac Arrest or Life-Threatening Toxicity Due to Poisoning. Circulation. 2023;148(16):e149–e184. PMID 37721023. doi:10.1161/CIR.0000000000001161. **Só o resumo.**
- Cao D, Arens AM, Chow SL, et al. Part 10: Adult and Pediatric Special Circumstances of Resuscitation: 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025;152(16 Suppl 2):S578–S672. PMID 41122889. doi:10.1161/CIR.0000000000001380. **Só o resumo.**
- Andrews P, Anseeuw K, Kotecha D, et al. Diagnosis and practical management of digoxin toxicity: a narrative review and consensus. Eur J Emerg Med. 2023;30(6):395–401. PMID 37650725. PMC10599802. doi:10.1097/MEJ.0000000000001065. **Texto completo.**
- Hack JB, Wingate S, Zolty R, et al. Expert Consensus on the Diagnosis and Management of Digoxin Toxicity. Am J Med. 2025;138(1):25–33.e14. PMID 39265879. doi:10.1016/j.amjmed.2024.08.018. **Só o resumo** (sem dose).

### O que o resumo da AHA permite dizer
O resumo da AHA 2023 lista as intoxicações cobertas: benzodiazepínicos, betabloqueadores, bloqueadores de canal de cálcio, cocaína, cianeto, digoxina, anestésicos locais, metemoglobinemia, opioides, organofosforados e carbamatos, bloqueadores de canal de sódio e simpatomiméticos. A AHA 2025 acrescenta hidrocarbonetos voláteis.

Paracetamol, álcoois tóxicos, salicilato e anticolinérgicos **não** estão nessa lista. Para essas linhas, a AHA não é a fonte certa de conferência.

### Tabela dose por dose

| Antídoto | Dose no app (arquivo:linha) | Dose na fonte | Confere? |
|---|---|---|---|
| N-acetilcisteína VO | 140 mg/kg + 70 mg/kg de 4/4 h por 72 h (`intoxicacoes.ts:171–172`) | Paracetamol fora do escopo da AHA 2023/2025 (pelo resumo) | Sem fonte nova. Não conferido |
| N-acetilcisteína EV | 150 mg/kg em 1 h, 50 mg/kg em 4 h, 100 mg/kg em 16 h (`:173–182`) | Idem | Sem fonte nova. Não conferido |
| Flumazenil | 0,2 mg EV em 30 s, até 1 mg (`:209–210`) | AHA 2023 cobre benzodiazepínicos e flumazenil; dose não lida | Não conferido |
| Naloxona | 0,04 mg com drive; 0,2–1 mg em apneia; 2 mg na PCR; sem máximo, reconsiderar após 5–10 mg (`:215–225`) | AHA 2023 cobre opioides e naloxona; dose não lida | Não conferido |
| Fisostigmina | 0,5–2 mg EV lento (`:227–232`) | Anticolinérgicos fora da lista da AHA (pelo resumo) | Sem fonte nova. Não conferido |
| Betabloqueador: atropina | 1 mg, até 3 doses (`:237`) | AHA cobre betabloqueador e atropina; dose não lida | Não conferido |
| Betabloqueador: glucagon | 5 mg EV em 1 min; infusão de 2–5 mg/h (`:238–239`) | AHA cobre glucagon; dose não lida | Não conferido |
| Betabloqueador: cálcio | gluconato 10% 30 mL + SF 100 mL em 10 min (`:240`) | AHA cobre cálcio; dose não lida | Não conferido |
| Betabloqueador: adrenalina | início a 1 µg/min (`:241`) | AHA cobre vasopressores; dose não lida | Não conferido |
| Betabloqueador: insulina | 1 UI/kg + 0,5 UI/kg/h, teto de 10 UI/kg (`:242–244`) | AHA cobre insulina; dose não lida | Não conferido |
| BCC: cálcio | 3–6 g + 0,5 mEq/kg/h (0,6–1,2 mL/kg/h de gluconato 10%) (`:260–266`); Figura 2: 10 mL a 10%, até 3 vezes (`:269`) | AHA cobre BCC e cálcio; dose não lida | Não conferido |
| BCC: glucagon (Figura 2) | 3–10 mg (0,03–0,05 mg/kg); infusão de 1–5 mg/h (`:271–273`) | Dose não lida | Não conferido |
| BCC: insulina (Figura 2) | 0,5–1 UI/kg + 0,5–1 UI/kg/h (`:274–275`) | Dose não lida | Não conferido |
| Emulsão lipídica 20% | Figura 2: 1,5 mL/kg em 2–3 min + 0,5 mL/kg/min (`:277–279`); PCR por anestésico local: 0,25 mL/kg/min (divergência, `:286`) | AHA cobre anestésicos locais e emulsão; dose não lida | Não conferido |
| Anticorpo antidigoxina | 10 frascos empíricos (`:311`; tela, linha 168); dose ingerida × 0,8 ÷ 0,5 (`:321–323`); digoxinemia × peso ÷ 100 (`:326–328`) | **Andrews 2023:** na PCR, 5 frascos (40 mg cada) de imediato e mais 5 se não houver resposta em 30 min; sem PCR, com risco de vida, 1–2 frascos repetidos conforme a resposta; sem risco de vida, metade da dose de neutralização total, arredondada para cima | **Diverge** (ver abaixo). AHA: não conferido |
| Bicarbonato de sódio | 1–2 mEq/kg em bolus, com os alvos de pH por uso (`:336–347`) | AHA cobre bloqueadores de canal de sódio e bicarbonato; dose não lida. Salicilato e alcalinização fora do escopo da AHA | Não conferido |
| Fomepizol | 15 mg/kg + 10 mg/kg de 12/12 h por 48 h (`:361–363`) | Álcoois tóxicos fora do escopo da AHA (pelo resumo) | Sem fonte nova. Não conferido |
| Etanol EV / VO | 10 mL/kg + 1,2 mL/kg/h a 10% (`:364–367`) | Idem | Sem fonte nova. Não conferido |
| Ácido fólico, piridoxina, tiamina | `:368–371` | Idem | Sem fonte nova. Não conferido |
| Organofosforado: atropina | 2–5 mg, dobrando a cada 3–5 min (`:395–398`) | AHA cobre organofosforados e atropina; dose não lida | Não conferido |
| Pralidoxima | 30 mg/kg em 30 min + 8 mg/kg/h (`:399`) | AHA cobre pralidoxima; dose não lida | Não conferido |
| Hidroxocobalamina | 5 g em 15 min, até 10 g no total (`:432–434`) | AHA cobre cianeto e hidroxocobalamina; dose não lida | Não conferido |
| Tiossulfato de sódio | 12,5 g (25%) (`:435–436`) | AHA cobre tiossulfato; dose não lida | Não conferido |
| Nitrito de sódio / amila | 3% 10 mL EV lento; amila 1–2 ampolas inaladas (`:437–438`) | AHA cobre nitrito de sódio; dose não lida | Não conferido |

### Digoxina: a divergência com o Andrews 2023
O Andrews 2023 é um consenso europeu (Delphi) para **adultos**. O texto completo foi lido.

| Ponto | App (livro, p. 1319–1322) | Andrews 2023 |
|---|---|---|
| Esquema empírico | 10 frascos, quantidade e nível desconhecidos | PCR: 5 frascos de imediato, mais 5 após 30 min sem resposta. Sem PCR, com risco de vida: 1–2 frascos, repetidos |
| Sem risco de vida | cálculo pela dose ou pelo nível | metade da dose de neutralização total, pelo nível; arredondar para o frasco inteiro acima |
| Arredondamento | o livro não diz; a conta sai com uma casa decimal (`:317`) | para cima |
| Potássio como sinal de gravidade | K⁺ > 5–5,5 mEq/L na lista de indicações (`:314`) | K⁺ > 6,5 mmol/L entre os sinais de risco de vida; de 5,5 a 6,5 deve ceder com o anticorpo |
| Digoxinemia | > 10 ng/mL (aguda) ou > 4 ng/mL (crônica) (`:314`) | > 12 ng/mL entre as situações sem risco de vida em que o anticorpo é apropriado |
| Coleta do nível | idealmente 6 h após a ingestão (`:315`) | pelo menos 6 h, de preferência 8–12 h |

Três cuidados antes de qualquer decisão:
- A fórmula da metade da neutralização saiu como imagem no PMC e **não foi lida**.
- O Andrews diz que 5 frascos neutralizam 3 mg de digoxina. Pela razão que o app usa (≈ 0,5 mg por frasco, `:312`), seriam 2,5 mg. A conferência é com a bula do produto disponível no Brasil, não com o artigo.
- Um redator médico do consenso foi pago pela Protherics, fabricante do DigiFab. Os autores declaram que a empresa não opinou no conteúdo.

### Lacuna achada (fora do H7)
A ferramenta de adulto não tem azul de metileno. A AHA 2023 cobre metemoglobinemia. Isto é pedido novo: só entra se o RT incluir no backlog, com fonte lida.

### Opções
- **A (recomendada):** nota de divergência na digoxina, ao lado do livro, com o esquema do Andrews 2023 (fonte lida). O cálculo do livro não muda. A nota da AHA continua dizendo "não conferido". O RT obtém o PDF da AHA 2023 e da AHA 2025 Parte 10, e a conferência dose por dose das demais linhas vira uma segunda rodada. **Efeito:** o médico vê o esquema europeu ao lado do livro; nenhuma dose muda.
- **B:** não mexer em nada até haver o PDF da AHA e conferir tudo de uma vez. **Efeito:** a divergência da digoxina, já confirmada, fica invisível até lá.
- **C:** trocar os 10 frascos empíricos pelo esquema do Andrews. **Efeito:** troca a fonte primária (o livro) por um consenso com apoio do fabricante. Não recomendado sem o RT e sem a bula.

### Não conferido no H7
- Todas as doses da AHA 2023 e da AHA 2025 (texto inacessível).
- O consenso Hack 2025 além do resumo (o resumo não traz dose).
- A fórmula da metade da neutralização do Andrews (imagem).
- Os antídotos pediátricos (`src/clinico/pediatria/bolus.ts`, grupo "antidoto", e `intoxicacaoPed.ts`) ficaram fora deste item: a criança segue o livro do ICr-HCFMUSP, e nada do adulto passa para ela.

---

## H14. NEWS2: rótulos do app × versão brasileira oficial

### Onde está
- Tela do escore: `src/clinico/escores/news2.ts`, ficha `news2`, versão `2026-11-06.1`. Rótulos nas linhas 42–53; faixas na linha 82.
- Cálculo: `src/clinico/news2.ts` (cortes do RCP 2017; mesmos da acuidade no banco, `private.calcular_acuidade`).
- Laudo de AIH: `src/components/documentos/apoioNews2.ts`, linhas 23–25 (nomes das faixas e conduta).
- Acuidade do leito: `src/components/internacao/caderno/Acuidade.tsx:24` (`'risco baixo'`, `'atenção'`, `'risco alto'`). Esse rótulo serve ao NEWS2 e ao PEWS.

### Fonte
Oliveira APA, Urbanetto JS, Caregnato RCA. National Early Warning Score 2: transcultural adaptation to Brazilian Portuguese. Rev Gaúcha Enferm. 2020;41:e20190424. PMID 33111761. doi:10.1590/1983-1447.2020.20190424. Texto do Quadro 1 lido no SciELO; a Figura 1 (escala final) é imagem e não foi lida.

### Rótulos lado a lado

| Item | App (`news2.ts`) | Versão oficial (Quadro 1, versão final) |
|---|---|---|
| Frequência respiratória | "Frequência respiratória" (irpm) | "Frequência Respiratória (por minuto)" |
| SpO₂ | "Saturação de O₂"; "Escala 1 (padrão)" / "Escala 2 (hipercapnia, alvo 88–92%)" | "SpO2 % - Escala 1" / "SpO2 % - Escala 2" |
| Oxigênio | "Oxigênio suplementar": "Ar ambiente" / "Em oxigênio" | "Ar ambiente ou oxigênio?": "Ar ambiente" / "Oxigênio" |
| Pressão | "Pressão sistólica" | "Pressão Arterial Sistólica (mmHg)" |
| Frequência cardíaca | "Frequência cardíaca" (bpm) | "Pulso (por minuto)" |
| Consciência | "Consciência (ACVPU)": "Alerta" / "Confusão nova, responde à voz, à dor ou sem resposta" | "Consciência": "Alerta" / "Confusão aguda / Resposta a voz ou a dor / Irresponsivo" |
| Temperatura | "Temperatura" (°C) | "Temperatura (°C)" |
| Faixas | "0–4 baixa · 3 em um parâmetro baixa-média · 5–6 média · 7 ou mais alta" (linha 82) | "Total 1-4"; "3 em um único parâmetro"; "Total de 5 ou mais / Limite de resposta urgente"; "Total de 7 ou mais / Limite de resposta de emergência" |

No Quadro 1 não aparecem as palavras "risco", "baixo", "médio" ou "alto". Se a Figura 1 as usa, não foi possível ver.

### Laudo de AIH: a conduta diverge do Quadro 1
`apoioNews2.ts:24` escreve a conduta por faixa. O Quadro 1 dá outra coisa:

| Faixa | App (laudo de AIH) | Quadro 1 (monitoramento) |
|---|---|---|
| Total 0 | "Monitorar no mínimo de 6 em 6 horas." (junto com 1–4) | mínimo a cada 12 horas |
| Total 1–4 | idem | mínimo a cada 4–6 horas; o enfermeiro avalia |
| 3 em um único parâmetro | "Monitorar de 1 em 1 hora e acionar a equipe." (junto com 5–6) | mínimo a cada 1 hora; o enfermeiro informa a equipe médica |
| Total 5 ou mais | idem | resposta urgente; o Quadro 1 não traz frequência nesta linha |
| Total 7 ou mais | "Resposta clínica imediata." | monitoramento contínuo; avaliação de emergência |

Há também uma incoerência interna: a tela do escore diz que a resposta de cada faixa é do protocolo da unidade (`news2.ts:87`), e o laudo de AIH escreve uma conduta.

### Opções
- **A (recomendada):** com a enfermagem, abrir a Figura 1 da versão oficial e então alinhar os rótulos da tela do escore aos do Quadro 1 (parâmetros, oxigênio, consciência e nome das faixas). No laudo de AIH, a conduta passa a ser a do Quadro 1, com a fonte, ou sai e fica "protocolo da unidade". Cortes e pontos não mudam. **Efeito:** a tela fala como a versão oficial; nada muda no cálculo nem no banco.
- **B:** só os nomes dos parâmetros. Faixas e conduta do laudo ficam como estão. **Efeito:** troca menor; a divergência da conduta continua.
- **C:** não mexer. **Efeito:** a nota atual continua avisando que os rótulos não foram alinhados.

O rótulo da acuidade do leito (`Acuidade.tsx:24`) também é do PEWS. Se for mudar, é decisão separada, para não mexer no PEWS sem fonte.

### Não conferido no H14
- A Figura 1 (escala final) e a Figura 2 (definições operacionais) da versão oficial: são imagem.
- A leitura do Quadro 1 foi feita por um leitor automático da página do SciELO. A enfermagem deve conferir no PDF antes da troca.

---

## H19. Braden: faixas de risco

### Onde está
- `src/clinico/crescimento/escalasAvaliacao.ts`, ficha `avaliacao-braden`, versão `2026-09-29.1` (linhas 41–51). Faixas nas linhas 102–108.
- Cópia no servidor: `private.escala_avaliacao`, migration `20261004000003_encaminhamento_interno_avaliacao.sql`, linha 140–142 (mesmas faixas e a mesma versão dentro do JSON).
- Faixas do app: 9 ou menos risco muito alto; 10–12 alto; 13–14 moderado; 15–18 baixo; 19–23 sem risco.
- As fontes da ficha são Bergstrom 1987 e Paranhos 1999. A ficha não diz de onde vêm as cinco faixas.

### Fontes
- Hillier B, Scandrett K, Coombe A, et al. Accuracy and clinical effectiveness of risk prediction tools for pressure injury occurrence: An umbrella review. PLoS Med. 2025;22(2):e1004518. PMID 39913541. PMC11844857. doi:10.1371/journal.pmed.1004518. **Texto completo** (trechos da Braden).
- Velozo BC, Budri AMV, Bernardo LC, et al. Comparison of the Validity and Reliability of Five Pressure Injury Risk Scales in Intensive Care. Nurs Crit Care. 2026;31(6):e70734. PMID 42845173. PMC13647097. doi:10.1111/nicc.70734. **Texto completo.**

### O que as fontes dizem
- **Velozo 2026** (Botucatu, 150 adultos em UTI, versão em português): a Tabela 1 usa exatamente as cinco faixas do app. Na UTI, a Braden teve AUC de 0,610; o melhor corte foi abaixo de 9,5. Nenhuma das cinco escalas passou de 0,70.
- **Hillier 2025:** na maior meta-análise citada (60 estudos, 49.326 pacientes), os cortes usados variaram de ≤ 10 a ≤ 20. Sensibilidade de 0,78 e especificidade de 0,72 no conjunto. Os dois ensaios que testaram o uso de escala não mostraram queda de lesão por pressão.

### Divergência
Nas faixas, nenhuma. O que falta é a fonte das faixas na ficha e um aviso de que o valor preditivo é modesto, sobretudo na UTI.

### Opções
- **A (recomendada):** manter as faixas. Acrescentar o Velozo 2026 como fonte das cinco faixas e uma nota curta de limitação (Hillier 2025 e Velozo 2026), sem conduta. **Efeito:** a faixa ganha fonte; nada muda na soma, na leitura ou no banco, exceto a versão (a versão também está no JSON do servidor; se subir, a migration acompanha).
- **B:** só a nota, sem nova fonte para as faixas. **Efeito:** a origem das faixas continua sem citação.
- **C:** não mexer.

### Não conferido no H19
- Bergstrom 1987 e Paranhos 1999 não foram abertos. Não sei se trazem as cinco faixas.
- O Hillier foi lido só nos trechos da Braden.

---

## H20. Glasgow com pupilas (GCS-P): a redação

### Onde está
- `src/clinico/escores/glasgow.ts`, ficha `glasgow`, versão `2026-09-27.1`.
- O app pergunta quantas pupilas não reagem (linhas 34–36) e calcula GCS-P = total − pupilas não reativas, mínimo 1 (linha 45).
- O GCS-P aparece na nota da faixa (linha 53) e em "GCS-P" (linha 57).
- A linha "Componentes — registre assim" (linha 56) traz O, V e M, **sem as pupilas**.
- A criança tem o seu GCS-Pupilas em `src/clinico/pediatria/comaHicPed.ts:14–15` (livro do ICr, p. 374). Não entra neste item.

### Fonte
Vreeburg RJG, van Leeuwen FD, Manley GT, et al. Validation of the GCS-Pupil Scale in Traumatic Brain Injury: Incremental Prognostic Value of Pupillary Reactivity with GCS in the Prospective Observational Cohorts CENTER-TBI and TRACK-TBI. J Neurotrauma. 42(9-10):798–813 (online em 17/12/2024). PMID 39686742. doi:10.1089/neu.2024.0458. **Só o resumo.**

### O que a fonte diz (resumo)
- Coortes CENTER-TBI (3.521) e TRACK-TBI (1.439), trauma cranioencefálico.
- O GCS-P teve associação mais forte com o desfecho em 6 meses do que o Glasgow sozinho.
- Mas capturou cerca de metade do ganho prognóstico que as pupilas dão quando entram como variável separada.
- Os autores preferem, para modelos prognósticos, Glasgow e pupilas como fatores separados.

### Divergência
O cálculo do app bate com a definição do artigo. O problema é a redação: o app pede para registrar O, V e M, mas não as pupilas. Quem copia a linha "registre assim" perde justamente a informação que o artigo diz valer mais separada.

### Opções
- **A (recomendada):** manter o GCS-P. Incluir as pupilas na linha "registre assim" (por exemplo, "O3 V4 M5 · 1 pupila não reativa") e acrescentar um cuidado curto com o Vreeburg 2024: o GCS-P resume; Glasgow e pupilas separados guardam mais informação. **Efeito:** muda só texto; o número continua o mesmo.
- **B:** só o cuidado, sem mudar a linha de registro. **Efeito:** o registro copiado continua sem as pupilas.
- **C:** não mexer.

### Não conferido no H20
- O texto completo do Vreeburg (faixa etária das coortes, detalhes por subgrupo).
- O texto de Brennan 2018, já citado na ficha, não foi reaberto.

---

## H21. Critérios de Light: combinação tripla

### Onde está
- `src/clinico/escores/light.ts`, ficha `light`, versão `2026-09-28.1`.
- O cálculo (linhas 39–46) segue Light: exsudato se qualquer um dos três critérios for positivo, com o 2/3 do limite superior do LDH do laboratório.
- Linha 65: "sensibilidade 98% · especificidade 72%", sem fonte.
- Linha 75: "Sem amostra sérica, a regra alternativa é LDH pleural acima de 67% do LSN sérico OU colesterol pleural acima de 55 mg/dL, com capacidade discriminativa equivalente". Sem fonte.

### Fonte
Porcel JM, Porcel L, Palma R, Bielsa S. Revisiting Light's criteria: a validated blood-free triple combination matches diagnostic accuracy in over 7000 patients. ERJ Open Res. 2026;12(2):00821-2025. PMID 41846683. PMC12991015. doi:10.1183/23120541.00821-2025. **Texto completo.**

### O que a fonte diz
- 7.280 toracocenteses de um centro (derivação 5.000; validação 2.280).
- **Combinação tripla**, só no líquido pleural: proteína > 3 g/dL **ou** LDH > 2/3 do limite superior do laboratório **ou** colesterol > 55 mg/dL.
  - AUC igual à de Light nas duas coortes.
  - Sensibilidade de 99% × 98% (derivação) e 98% × 98% (validação).
  - Na derivação, deixou passar um pouco mais de exsudatos (p < 0,001); na validação, não houve diferença.
  - Reclassificou certo 19–20% dos transudatos que Light chamou de exsudato.
- **Combinação dupla** (LDH ou colesterol), a mesma da linha 75 do app: deixou de achar 240 exsudatos na derivação e 113 na validação. Os autores dizem que ela não pode ser recomendada como rotina.
- Light no estudo: sensibilidade de 98% e especificidade de 71% (derivação); 98% e 69% (validação).
- No estudo, 250 U/L era 2/3 do limite superior do laboratório deles (378 U/L). O corte depende do laboratório, como o app já diz.

### Divergência
A linha 75 recomenda, sem fonte, justamente a regra dupla que o estudo maior desaconselha. A linha 65 traz números sem fonte.

### Opções
- **A (recomendada):** reescrever a linha 75 com a combinação tripla do Porcel 2026, dizendo que a dupla perde exsudatos. Trocar a linha 65 pelos números do Porcel, com a fonte. Light continua o critério da tela; o cálculo não muda. **Efeito:** só texto e fonte nova; a regra sem soro passa a ter fonte.
- **B:** A, e também calcular a combinação tripla quando não houver soro (item novo de colesterol, testes novos). **Efeito:** ferramenta nova dentro da tela; mais trabalho e mais revisão.
- **C:** só uma nota, mantendo a linha 75. **Efeito:** a tela fica com duas mensagens contraditórias.

### Não conferido no H21
- A ERS 2024 (Sundaralingam), citada na ficha, não foi reaberta.
- O Porcel é de um centro só, retrospectivo com dados prospectivos.

---

## H22. Hiperpotassemia: cálcio

### Onde está
- `src/clinico/hiperpotassemia.ts`, ficha `hiperpotassemia`, versão `2026-10-09.1`, público "ambos".
- **Adulto** (Geldermann 2026): cálcio indicado com ECG alterado ou K ≥ 6,5 mEq/L (linha 74). A tela diz que o cálcio não reduz o potássio e só protege o miocárdio (linha 87). A dose no adulto fica com o protocolo da unidade (linha 88). O manual do HCFMUSP aparece como divergência, com dose (linha 301).
- **Criança:** só o livro do ICr-HCFMUSP, cap. 54, p. 546–549 (gluconato e cloreto de cálcio em `src/clinico/pediatria/eletrolitosPed.ts:84–86` e `:98`). O neonato fica fora.

### Fonte
Jessen MK, Andersen LW, Djakow J, et al. Pharmacological interventions for the acute treatment of hyperkalaemia: A systematic review and meta-analysis. Resuscitation. 2025;208:110489. PMID 39761907. doi:10.1016/j.resuscitation.2025.110489. **Só o resumo.**

### O que a fonte diz (resumo)
- 101 estudos; só 2 com parada cardíaca.
- Adulto sem parada: insulina com glicose, salbutamol inalado ou EV, ou a combinação, baixaram o potássio em média de 0,7 a 1,2 mmol/L (certeza baixa a muito baixa). Bicarbonato sem efeito.
- Neonato e criança: salbutamol inalado ou EV baixou de 0,9 a 1,0 mmol/L.
- Cálcio: não houve evidência de benefício clínico.

### Divergência
Nenhuma de conduta no adulto. O app já diz que o cálcio não baixa o potássio e não dá dose. A revisão acrescenta que nem o benefício clínico do cálcio está demonstrado, e o app não diz isso.

Na criança, os dados pediátricos do resumo são do salbutamol, não do cálcio. Pela regra, a criança segue o ICr e nada vem desta revisão para ela.

### Opções
- **A (recomendada):** nota só no adulto, ao lado da linha do cálcio: revisão sistemática de 2025 sem evidência de benefício clínico do cálcio; a indicação (ECG alterado ou K ≥ 6,5) continua a da referência. Criança sem mudança. **Efeito:** o médico vê a incerteza; nenhuma indicação ou dose muda.
- **B:** a mesma nota também na criança. **Efeito:** leva para a criança uma conclusão que o resumo não separa por idade. Não recomendado.
- **C:** não mostrar.

### Não conferido no H22
- O texto completo do Jessen (cálcio separado por idade, por parada × sem parada).
- A AHA 2025 Parte 10 tem seção de hiperpotassemia; não foi lida (texto inacessível).

---

## Resumo do que ficou sem conferir
1. Todas as doses de antídoto da AHA 2023 e da AHA 2025 Parte 10. Precisa do PDF.
2. Consenso Hack 2025 da digoxina além do resumo.
3. Fórmula da metade da neutralização do Andrews 2023 (imagem) e a razão por frasco na bula do produto do Brasil.
4. Antídotos pediátricos (fora do escopo; a criança segue o ICr).
5. Figuras 1 e 2 da versão brasileira do NEWS2 (imagem).
6. Bergstrom 1987 e Paranhos 1999 (origem das faixas da Braden).
7. Texto completo do Vreeburg 2024 e do Jessen 2025.
8. ERS 2024 (Light) e seção de hiperpotassemia da AHA 2025.

---

## Decisões do RT

| # | Item | A (recomendada) | B | C |
|---|---|---|---|---|
| H7 | Antídotos | nota de divergência na digoxina com o Andrews 2023, sem trocar o cálculo do livro; AHA dose por dose numa segunda rodada, com o PDF | esperar o PDF da AHA e fazer tudo junto | trocar os 10 frascos pelo esquema do Andrews |
| H14 | NEWS2: rótulos | com a enfermagem, alinhar rótulos e faixas ao Quadro 1 (depois de ver a Figura 1); conduta do laudo de AIH igual ao Quadro 1 ou "protocolo da unidade" | só os nomes dos parâmetros | não mexer |
| H19 | Braden: faixas | manter as faixas; Velozo 2026 como fonte delas; nota de limitação (Hillier 2025, Velozo 2026) | só a nota | não mexer |
| H20 | GCS-P: redação | pupilas na linha "registre assim" e cuidado do Vreeburg 2024; cálculo igual | só o cuidado | não mexer |
| H21 | Light: regra sem soro | linha 75 com a combinação tripla (Porcel 2026) e linha 65 com números com fonte; cálculo de Light igual | A, e calcular a tripla sem soro | só nota |
| H22 | Hiperpotassemia: cálcio | nota no adulto (Jessen 2025), sem mudar indicação nem dose; criança sem mudança | nota também na criança | não mostrar |

**Fora destas decisões:** azul de metileno na ferramenta de adulto (lacuna achada no H7). É pedido novo: precisa entrar no backlog, com prioridade e fase, antes de qualquer código.

## Se for A em tudo
- Um branch e um PR por item, com os testes antes.
- As fichas que mudam de versão vão para o banco por migration gerada com `scripts/fichas-sql.mjs`, testada na homologação. A Braden tem a versão também no JSON de `private.escala_avaliacao`.
- Depois, as versões entram na fila de aprovação do RT.
