# Cronômetro da parada (criança e adulto) — conferência de fontes

Data: 18/11/2026. Só fontes abertas, lidas no texto (PMC pelo PubMed; cpr.heart.org e resus.org.uk no navegador). Trechos copiados como estão, em inglês. Nenhum arquivo do repositório foi alterado.

## Fontes

| # | Citação | PMID | PMC | DOI | Acesso |
|---|---|---|---|---|---|
| K8 | Kim DK, Kim JT, Na JY, et al. 2025 Korean Guidelines for Cardiopulmonary Resuscitation: Part 8. Pediatric advanced life support. Clin Exp Emerg Med. 2026;13(Suppl 1):S115-S141 | 42297411 | PMC13277418 | 10.15441/ceem.26.103 | Texto integral aberto no PMC (lido pelo get_full_text_article) |
| K4 | Kim TY, Ahn GJ, Cha KC, et al. 2025 Korean Guidelines for Cardiopulmonary Resuscitation: Part 4. Adult advanced life support. Clin Exp Emerg Med. 2026;13(Suppl 1):S32-S60 | 42297407 | PMC13277415 | 10.15441/ceem.26.073 | Texto integral aberto no PMC (lido) |
| A8 | American Heart Association. 2025 AHA Guidelines for CPR and ECC — Part 8: Pediatric Advanced Life Support (texto e Figura 2 "Pediatric Cardiac Arrest Algorithm", © AHA e AAP) | — | — | — | Aberto em cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support; Figura 2 lida na imagem do próprio site |
| A9 | American Heart Association. 2025 AHA Guidelines for CPR and ECC — Part 9: Adult Advanced Life Support (texto e Figura 2 "Adult Cardiac Arrest Algorithm (VF/pVT/Asystole/PEA)") | — | — | — | Aberto em cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-advanced-life-support; Figura 2 lida na imagem do próprio site |
| UK | Resuscitation Council UK. 2025 Resuscitation Guidelines — Adult advanced life support guidelines (versão britânica da ERC 2025) | — | — | — | Aberto em resus.org.uk/professional-library/2025-resuscitation-guidelines/adult-advanced-life-support-guidelines |
| E | Soar J, Böttiger BW, Carli P, et al. European Resuscitation Council Guidelines 2025 Adult Advanced Life Support. Resuscitation. 2025;215 Suppl 1:110769 | 41117572 | sem PMC | 10.1016/j.resuscitation.2025.110769 | NÃO lido: resuscitationjournal.com respondeu 403 com desafio anti-robô (não contornado). O texto da RCUK (UK) foi usado no lugar |

Não lidos: ERC 2025 Paediatric Life Support (sem PMC; a página da RCUK de pediatria deu 404), Korean 2025 Part 3 adult BLS (não buscado). As figuras da AHA são imagem: os trechos delas abaixo foram transcritos da imagem, marcados "(Figura 2, imagem)".

## Tabela

Legenda "app hoje": arquivo:linha no worktree `calculadoras-central-diagnostico-fcd936`; `rcp.ts` = `src/clinico/pediatria/rcp.ts` (fonte: livro do ICr, caps. 1–2, mais AHA/AAP 2025 Part 8); `pcr.ts` = `src/clinico/adulto/pcr.ts` (fonte: Manual do HCFMUSP 3ª ed., cap. 2, p. 48–51, mais AHA 2025 Part 9 e CoSTR 2026).

| item | criança | adulto | fonte | trecho literal | app hoje |
|---|---|---|---|---|---|
| Causas reversíveis — criança (AHA) | 11 itens | — | A8 (Figura 2, imagem) | "Reversible Causes: Hypovolemia; Hypoxia; Hydrogen ion (acidosis); Hypoglycemia; Hypo-/hyperkalemia; Hypothermia; Tension pneumothorax; Tamponade, cardiac; Toxins; Thrombosis, pulmonary; Thrombosis, coronary" | Sem lista em `rcp.ts`. `src/content/guiaParadaCrianca.ts:16` tem o título "Causas reversíveis" só com doses (glicose, cálcio, bicarbonato, magnésio), sem os H e T |
| Causas reversíveis — criança (Coreia) | 6H + 5T | — | K8, "Nonshockable rhythm" | "In nonshockable rhythms, 6H (hypothermia, hypoxia, hypovolemia, hypokalemia/hyperkalemia, hypoglycemia, and hydrogen ion-acidosis) and 5T (cardiac tamponade, thrombosis-pulmonary or cardiac, toxin, tension pneumothorax, and trauma) should be sought to identify reversible causes of pediatric cardiac arrest, and corrected when identified." | idem: ausente |
| Causas reversíveis — adulto (AHA) | — | 10 itens (sem hipoglicemia) | A9 (Figura 2, imagem) | "Reversible Causes: Hypovolemia; Hypoxia; Hydrogen ion (acidosis); Hypo-/hyperkalemia; Hypothermia; Tension pneumothorax; Tamponade, cardiac; Toxins; Thrombosis, pulmonary; Thrombosis, coronary" | Sem lista em `pcr.ts`. Há drogas por causa: `pcr.ts:112` bicarbonato (tricíclicos, hipercalemia, acidose), `:114` cálcio (hipercalemia), `:115` KCl (hipocalemia), `:117` alteplase (TEP), `:119` glicose+insulina (hipercalemia), p. 49–51 do manual |
| Causas reversíveis — adulto (Coreia, RCUK) | — | sem lista no texto | K4, UK | K4 só diz "The identification and early correction of reversible causes of cardiac arrest ... are essential for achieving ROSC." UK: "Identify and treat reversible causes of cardiac arrest without delay." (lista dos 4H/4T não aparece no texto lido; deve estar no algoritmo em imagem, não conferido) | — |
| Ritmo a cada 2 min | sim | sim | K8 | "After 2 minutes of CPR, the rhythm should be checked again." | `rcp.ts:117` "checar pulso a cada 2 min" (só na ventilação de resgate, p. 26); `rcp.ts:119` rodízio "a cada 2 minutos" (p. 26). Ciclo de 2 min com checagem de ritmo na PCR: ausente |
| | | | K4 | "After 2 minutes of CPR, cardiac rhythm should be reassessed." | `pcr.ts`: ausente |
| | | | A8 / A9 (Figura 2, imagem) | caixas "CPR for 2 min" (criança) e "CPR 2 min" (adulto) entre cada "Rhythm shockable?" | — |
| | | | UK | "...the underlying cardiac arrest rhythm may guide the decision to perform a rhythm and pulse check every two minutes." | — |
| Troca de quem comprime a cada 2 min | sim | sim | A8 (Figura 2, imagem) | "Change compressor every 2 min, sooner if fatigued" | `rcp.ts:119` "a cada 2 minutos" (livro ICr p. 26) |
| | | | A9 (Figura 2, imagem) | "Change compressor every 2 minutes, or sooner if fatigued." | `pcr.ts`: ausente |
| | | | K8 | "...the rescuer performing chest compressions should rotate with another rescuer at 2-minute intervals." | — |
| Adrenalina a cada 3–5 min | sim | sim | A8 | "For infants and children in cardiac arrest in any setting, it may be reasonable to administer epinephrine every 3–5 minutes until ROSC is achieved." (2b, C-LD) | `rcp.ts:122` "repetir a cada 3 a 5 min" (p. 31, 35); `rcp.ts:171` (Tabela 2, p. 31); `rcp.ts:53` (Part 8) |
| | | | K8 | "During resuscitation, epinephrine is administered repeatedly at the same dose every 3 to 5 minutes." | — |
| | | | A9 | "It is reasonable to administer epinephrine (1 mg) every 3 to 5 min for adult patients in cardiac arrest." (2a, B-R) | `pcr.ts:108` "1 mg IV ou IO a cada 3 a 5 minutos" (p. 49); `pcr.ts:174` (AHA seção 10) |
| | | | K4 | "Epinephrine should be administered every 3 to 5 minutes until ROSC is achieved or resuscitation efforts are terminated." | — |
| | | | UK | "Repeat adrenaline 1 mg every 3-5 minutes whilst ALS continues." | — |
| Adrenalina no ritmo não chocável: o mais cedo possível | sim | sim | A8 | "For infants and children in cardiac arrest with initial nonshockable rhythm, it is reasonable to administer the initial dose of epinephrine as early as possible." (2a, C-LD); Figura 2: "Epinephrine ASAP" | `rcp.ts:122` "o mais cedo possível, idealmente até 5 minutos" (p. 31, 35); `rcp.ts:45` |
| | | | K8 | "In particular, rapid administration within 5 minutes after cardiac arrest has a positive effect on the patient's treatment prognosis" | — |
| | | | A9 | "With respect to timing, for adult patients in cardiac arrest with a nonshockable rhythm, it is reasonable to administer epinephrine as soon as feasible." (2a, B-NR); Figura 2: "Epinephrine ASAP" | `pcr.ts:108` "em AESP/assistolia o mais precocemente possível" (p. 49); `pcr.ts:174` |
| | | | K4 | "Intravenous or intraosseous access should be established as quickly as possible, and a 1-mg bolus of epinephrine should be administered" | — |
| | | | UK | "Give adrenaline 1 mg as soon as possible for adult patients in cardiac arrest with a non-shockable rhythm." | — |
| Adrenalina no ritmo chocável: depois do 2º choque | sim (AHA, Coreia) | AHA: "depois das primeiras tentativas" (Figura 2 = após o 2º); RCUK/ERC: após o 3º; Coreia: já no 1º ciclo | A8 | "For infants and children in cardiac arrest with initial shockable rhythm, it may be reasonable to administer epinephrine after 2 attempts at defibrillation or sooner, only when rapid defibrillation is not possible." (2b, C-LD); Figura 2: caixa 6 "CPR for 2 min — Epinephrine every 3-5 min" vem depois do choque 5 (2º choque) | `rcp.ts:53` "Depois de 2 tentativas de desfibrilação" (Part 8) |
| | | | K8 | "...increase the defibrillation energy dose to 4 J/kg. ... Immediately resume chest compressions after the second defibrillation. Continue resuscitation for approximately 2 minutes. During resuscitation, administer epinephrine at a dose of 0.01 mg/kg ... every 3 to 5 minutes via vascular access." | — |
| | | | A9 | "With respect to timing, for adult patients in cardiac arrest with a shockable rhythm, it is reasonable to administer epinephrine after initial defibrillation attempts have failed." (2a, B-NR); Figura 2: "Epinephrine every 3-5 min" na caixa 6, depois do 2º choque (caixa 5) | `pcr.ts:108` "após o 2º choque em FV/TV sem pulso" (manual p. 49); `pcr.ts:174` ("depois que as primeiras tentativas de desfibrilação falharem") |
| | | | UK (ERC) | "Give adrenaline 1 mg after the third shock for adult patients in cardiac arrest with a shockable rhythm." | DIVERGE de `pcr.ts:108` (2º choque) |
| | | | K4 | "Following defibrillation, CPR should be resumed immediately and continued for 2 minutes without rhythm analysis. ... During CPR, intravenous or intraosseous access should be established, and a 1-mg bolus of epinephrine should be administered" (no ciclo depois do 1º choque) | DIVERGE (Coreia antecipa) |
| Amiodarona/lidocaína depois do 3º choque | sim | sim | A8 | "For infants and children with shock-refractory VF/pVT, either amiodarone or lidocaine may be considered." (2b, B-NR); Figura 2: caixa 8 "CPR for 2 min — Amiodarone or lidocaine" depois do choque 7 (3º choque) | `rcp.ts:174` e `:176` "na FV/TV sem pulso refratária ao choque" (Tabela 2, p. 32); número do choque: ausente |
| | | | K8 | "After checking the ECG rhythm, if a shockable rhythm is identified, perform defibrillation. If defibrillation is unsuccessful, administer amiodarone or lidocaine while continuing resuscitation." (vem depois do 2º choque a 4 J/kg, ou seja, no 3º) | — |
| | | | A9 | "For adults in cardiac arrest amiodarone or lidocaine may be considered for ventricular fibrillation (VF) or pulseless ventricular tachycardia (pVT) that is unresponsive to defibrillation." (2b, B-R); Figura 2: caixa 8 "CPR 2 min — Amiodarone or lidocaine" depois do 3º choque (caixa 7) | `pcr.ts:109` "1ª dose após o 3º choque, 2ª após o 5º" (p. 49); `pcr.ts:175` |
| | | | UK (ERC) | "Give amiodarone 300 mg IV for adult patients in cardiac arrest who are in VF/pVT after a total of three shocks have been given." | confere com `pcr.ts:109` |
| | | | K4 | "...a third defibrillation should be delivered ... followed immediately by 2 minutes of CPR. ... Amiodarone or lidocaine should be administered during CPR." | — |
| RCP logo após o choque, 2 min sem checar pulso | sim | sim | K8 | "...chest compressions should be resumed immediately after defibrillation. After 2 minutes of CPR, the rhythm should be checked again." | `rcp.ts`: ausente |
| | | | K4 | "Following defibrillation, CPR should be resumed immediately and continued for 2 minutes without rhythm analysis." | `pcr.ts`: ausente |
| | | | UK | "Immediately resume chest compressions after shock delivery." | — |
| | | | A8 / A9 (Figura 2, imagem) | "Shock" → "CPR for 2 min" / "CPR 2 min" sem checagem entre eles | — |
| Frequência 100–120/min | sim | sim | A8 (Figura 2, imagem) | "Push fast: 100-120/min" | `rcp.ts:81` "100 a 120 compressões por minuto" (livro ICr p. 26, 30–31, Tabela 1) |
| | | | K8 | "at an appropriate rate (at least 100–120 compressions per minute)" (sic, "at least") | — |
| | | | A9 (Figura 2, imagem) | "Push fast (100-120/min) and allow complete chest recoil." | `pcr.ts:93` "100–120 por minuto" (ILCOR CoSTR 2026, BLS 2501) |
| | | | K4 | só cita estudo: "Chest compression rates of 100 to 120 per minute and compression depths of 6 cm were associated with diastolic blood pressure values of approximately 30 mmHg" (a recomendação está na Part 3, BLS do adulto, não lida) | — |

## Divergências para o RT

1. Hipoglicemia: está na lista da criança (AHA e Coreia), não na do adulto (AHA).
2. Trauma: só a Coreia pediátrica põe "trauma" como 5º T e junta trombose em "thrombosis-pulmonary or cardiac"; a AHA pediátrica separa "Thrombosis, pulmonary" e "Thrombosis, coronary" e não tem trauma.
3. Adrenalina no ritmo chocável do adulto: AHA = depois das primeiras tentativas (Figura 2 a põe depois do 2º choque, como `pcr.ts:108`); ERC/RCUK 2025 = depois do 3º choque; Coreia 2025 = já no ciclo depois do 1º choque. O cronômetro precisa escolher uma e citar.
4. Antiarrítmico depois do 3º choque: só os algoritmos (AHA, imagem) e o texto da RCUK (adulto) e da Coreia dizem o número do choque; a recomendação da AHA em texto diz só "unresponsive to defibrillation"/"shock-refractory".
