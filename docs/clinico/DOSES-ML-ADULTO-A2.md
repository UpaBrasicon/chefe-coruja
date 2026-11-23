# Dose em mL no adulto, lote A2: anafilaxia, sedação, agitação, abstinência e analgesia

Data: 23/11/2026. Situação: decisões do RT em 23/11/2026: A2-1 = B (escetamina com aviso), A2-2 = A, A2-3 = IM, A2-4 = A. As duas partes na branch fase-ml/adulto-a2 (PR #1057): anafilaxia e sedação, depois agitação, abstinência e analgesia pelas 4 bulas lidas em 23/11/2026 (Uni Haloper, Acesyl, Tramadon e Dolosal). A morfina da analgesia já mostra o mL do preparo do livro (1 mg/mL) e fica sem a segunda escolha. Base: `docs/clinico/DOSES-ML-ADULTO-DIAGNOSTICO.md` (MA1 a MA7 = A) e o cadastro único do A0.

## Itens e ampolas

| Tela | Itens | Ampola (fonte) | mL |
|---|---|---|---|
| Anafilaxia | difenidramina 25–50 mg IV | Difenidrin 50 mg/mL (bula lida no lote 7) | entra; o texto vira número (MA2) |
| Anafilaxia | magnésio 2 g EV em 20–30 min | 10% e 50% em g, a aspirar e diluir | entra |
| Sedação para procedimento | lidocaína 0,5 mg/kg EV e 0,5–1 mg/kg no propofol; midazolam 0,05 e 0,03 mg/kg e 1–2 mg IV; fentanil (teto 0,5 µg/kg) | lidocaína 1% e 2%, midazolam 1 e 5 mg/mL, fentanila 50 µg/mL (bulas dos lotes 1 e 2) | entra |
| Sedação (reversores) | flumazenil 0,2 mg EV; naloxona 0,4–2 mg | 0,1 mg/mL; 0,4 mg/mL (CMED e bula) | entra |
| Sedação | haloperidol 5 mg antes da quetamina (sem via escrita) | haloperidol 5 mg/mL | A2-2 e A2-3 |
| Agitação e delirium | midazolam IM; haloperidol IM; haloperidol e lorazepam "oral, IM, IV" | midazolam 1 e 5 mg/mL; haloperidol 5 mg/mL; lorazepam sem injetável à venda | midazolam entra; haloperidol pela A2-2 |
| Agitação | quetamina mg/kg IM/IV | só escetamina 50 mg/mL à venda | A2-1 |
| Abstinência | diazepam EV; haloperidol IM; tiamina IM | diazepam 5 mg/mL; haloperidol 5 mg/mL; tiamina 100 mg/mL (CMED: Vasconcelos) | diazepam entra; haloperidol e tiamina esperam a bula |
| Analgesia | tramadol "VO, EV, IM"; meperidina IM; fentanil EV; morfina e midazolam em bolo | tramadol 50 mg/mL; petidina 50 mg/mL; fentanila, morfina e midazolam já cadastrados | fentanil, morfina e midazolam entram; tramadol (via mista) e meperidina esperam a bula |

**Ficam sem mL:**
- pó: hidrocortisona, metilprednisolona, glucagon e dantroleno (MA6);
- sem injetável à venda na CMED de 09/11/2026: ranitidina, icatibanto, olanzapina, lorazepam e cetamina racêmica;
- haloperidol decanoato 50 mg/mL: é de depósito e nunca entra.

## Decisões para o RT (A recomendada)

- **A2-1. Quetamina no adulto.** O manual dá a dose da quetamina racêmica, que não tem injetável à venda. Só a escetamina (50 mg/mL) está à venda, e ela tem cerca do dobro da potência. A: sem mL nos itens de quetamina do adulto (a sequência rápida, que já mostra mL, não muda). B: escetamina 50 mg/mL com o aviso "a dose do manual é da cetamina racêmica".
- **A2-2. Haloperidol 5 mg/mL.** As apresentações à venda dizem "IM". A: mL nos itens IM; nos itens "oral, IM, IV" e "IV", mL com o aviso de via mista e a nota "a bula registra IM". B: só nos itens IM.
- **A2-3. Via que o item não escreve.** O haloperidol 5 mg antes da quetamina (p. 165) não diz a via. A: você confere na fonte e o item passa a escrever a via. B: sem mL.
- **A2-4. Bulas.** A: você baixa as 4 bulas abaixo; até chegarem, os itens ficam sem mL.
  - haloperidol 5 mg/mL (Cristália): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=102980020
  - tiamina 100 mg/mL (Vasconcelos): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=164000001
  - tramadol 50 mg/mL (Cristália): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=102980261
  - petidina 50 mg/mL (Cristália): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=102980034

## Implementação

Chaves `adulto-anafilaxia:`, `adulto-sedacao:`, `adulto-agitacao:`, `adulto-abstinencia:` e `adulto-analgesia:` no cadastro único. Os itens em texto viram número (MA2), com a versão das fichas subindo. Depois vêm os testes, a migration, a homologação e a sua aprovação.
