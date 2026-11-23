# Dose em mL no adulto, lote A4: cardiologia, anticoagulação, endócrino e AVC

Data: 23/11/2026. Situação: decisões A4-1 a A4-4 = A (RT, 23/11/2026). Primeira parte na branch fase-ml/adulto-a4: esmolol 250 mg/mL (criança e adulto), fibrilação atrial (magnésio IV), emergência hipertensiva e AVC. Primeira parte na produção (PR #1066). Segunda parte na branch fase-ml/adulto-a4b: metoprolol (Betacris) e protamina (Protamina 1000) pelas bulas lidas em 23/11/2026, dexametasona do endócrino, furosemida da IC e enoxaparina; o metoprolol da crise tireotóxica passa a escrever IV (A4-2), e as outras 4 fichas do arquivo do endócrino sobem pela regra 1b. Base: `docs/clinico/DOSES-ML-ADULTO-DIAGNOSTICO.md` (MA1 a MA7 = A).

## Correção achada no levantamento

A CMED de 09/11/2026 tem uma apresentação de **esmolol 250 mg/mL à venda**: Brevibloc 250 mg/mL, "solução para diluição para infusão", registro 1029802270046. Os lotes 5 e 7 disseram que a de 250 mg/mL estava sem venda, olhando só a outra apresentação (1029802270011), que de fato não está à venda. A bula manda diluir a de 250 mg/mL. Ver A4-1.

## Itens e ampolas

| Tela | Item | Ampola (fonte) | mL |
|---|---|---|---|
| Fibrilação atrial | esmolol, ataque | 10 mg/mL (e 250 mg/mL, A4-1) | entra |
| Fibrilação atrial | amiodarona, ataque | 50 mg/mL, a aspirar e diluir | entra |
| Fibrilação atrial | magnésio 1–2 g (p. 249), sem via escrita | 10% e 50% em g | A4-2 |
| Fibrilação atrial | diltiazem, verapamil, digoxina | sem injetável à venda (há só deslanosídeo, que é outro fármaco) | sem mL |
| Emergência hipertensiva | esmolol, ataque; hidralazina | esmolol; hidralazina 20 mg/mL | entra |
| Emergência hipertensiva | metoprolol 5 mg IV até 20 mg | metoprolol 1 mg/mL (CMED: Cristália, Halex, Teuto) | espera a bula (A4-3) |
| Endócrino (crise tireotóxica) | metoprolol 5 mg (sem via escrita, p. 954) | metoprolol 1 mg/mL | A4-2 e A4-3 |
| Endócrino | dexametasona EV | 2 e 4 mg/mL (rótulo do fosfato, L7-1) | entra |
| Endócrino | propranolol EV, T3 e T4 | sem injetável à venda | sem mL |
| Insuficiência cardíaca | furosemida mg/kg | 10 mg/mL | entra |
| Anticoagulação | enoxaparina mg/kg SC | seringa de 100 mg/mL (lote 6b) | entra |
| Reversão | protamina | 10 mg/mL (CMED: Cellera) | espera a bula (A4-3) |
| Reversão | vitamina K "VO ou EV" | as três bulas contraindicam a veia | sem mL |
| AVC | ácido tranexâmico mg/kg | 50 mg/mL | entra |

**Ficam sem mL:**
- pó: alteplase, tenecteplase (já tem a tabela de mL da diretriz), bivalirudina, estreptoquinase, complexo protrombínico e hidrocortisona;
- sem injetável à venda: fondaparinux e ácido épsilon-aminocaproico;
- infusões sem preparo próprio: levosimendana (2,5 mg/mL à venda) e esmolol da crise tireotóxica (MA5).

## Decisões para o RT (A recomendada)

- **A4-1. Esmolol 250 mg/mL.** A: entra ao lado da de 10 mg/mL, nenhuma marcada, sempre "aspirar e diluir", no adulto e na criança (bolus da criança, lote 7). O texto das fontes que dizia "sem venda" é corrigido. B: só no adulto. C: não entra; só a correção do texto.
- **A4-2. Vias que o item não escreve.** São duas: o magnésio da FA (p. 249) e o metoprolol da crise tireotóxica (p. 954). A: você confere na fonte, e o item passa a escrever a via. B: os dois ficam sem mL.
- **A4-3. Bulas.** A: você baixa as 2 bulas abaixo; até elas chegarem, metoprolol e protamina ficam sem mL.
  - metoprolol 1 mg/mL (Betacris, Cristália): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=102980448
  - protamina 10 mg/mL (Cellera): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=104400184
- **A4-4. Enoxaparina no adulto.** A: escolha da seringa de 100 mg/mL com o volume a aplicar, como na criança. B: sem mL (a dose por kg costuma cair entre as seringas de 40, 60, 80 e 100 mg).
