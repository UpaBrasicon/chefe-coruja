# Dose em mL, lote 5: antídotos, metabólico e cardiovascular (plano)

Data: 20/11/2026. Situação: plano para o RT, nenhum código mudou. Base: `docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md` (seção 4, lote 5), decisões ML1 a ML11 de 19/11/2026 e a CMED como fonte da concentração ao lado da bula (lote 3, 20/11/2026).

Lista da CMED: planilha PMC de 09/11/2026 (`scripts/anvisa/lista-cmed.mjs --injetaveis`). Só entram apresentações com "comercializado: Sim".

Já feitos em lotes anteriores e fora daqui: atropina (inclusive organofosforados), fentanil e naloxona.

## 1. Princípios e itens

| Princípio | Itens | CMED 09/11/2026, à venda | Observação | Proposta |
|---|---|---|---|---|
| Flumazenil | `bolus:flumazenil` | 0,1 mg/mL, amp. 5 mL: Fresenius, Cristália, Teuto, União Química, Hipolabor, Biopas | uma concentração | uma ampola |
| Vitamina K (fitomenadiona) | `bolus:vitamina-k` (IV) | 10 mg/mL, amp. 1 mL: Cristália ("sol inj"), Hypofarma ("IM/SC"), Hipolabor ("SC/IM") | **a dose do livro é IV e duas das três apresentações dizem IM/SC na CMED** | só a ampola cuja bula permite IV (L5-2) |
| Pralidoxima | `bolus:pralidoxima` | nenhuma | sem apresentação à venda na CMED | fica sem mL |
| Acetilcisteína IV | `bolus:acetilcisteina-1`, `-2`, `-3` | 100 mg/mL, amp. 3 mL: Zambon, União Química (Blau sem venda) | diagnóstico: aspirar e diluir | uma ampola, com "aspirar e diluir" pela bula |
| Hidralazina | `bolus:hidralazina` | 20 mg/mL, amp. 1 mL: Cristália | uma concentração | uma ampola |
| Esmolol | `bolus:esmolol-bolus` (µg/kg) | 10 mg/mL, frasco 10 mL: Cristália (a de 250 mg/mL está sem venda) | dose em µg: 10 mg/mL = 10.000 µg/mL | uma ampola |
| Milrinona | `bolus:milrinona-ataque` (µg/kg) | 1 mg/mL, amp. 10 mL: Sanofi Medley (Fresenius, Newcom e Farma Vision sem venda) | livro: 1 mg/mL (p. 253) | uma ampola |
| Octreotida | `bolus:octreotida-ataque` (µg/kg) | 0,05, 0,1 e 0,5 mg/mL, amp. 1 mL: Novartis; 0,1 mg/mL: Sun | três concentrações; o pó de depósito (10, 20 e 30 mg) não é IV e fica fora | três ampolas, nenhuma marcada (L5-4) |
| Terbutalina | `bolus:terbutalina-ataque` (µg/kg) | 0,5 mg/mL, amp. 1 mL: Fresenius, União Química, Hipolabor | uma concentração | uma ampola |
| Ondansetrona IV | `fita:fita-ondansetrona-iv` | 2 mg/mL, amp. 2 e 4 mL: Fresenius, Cristália, Halex, Hypofarma, União Química, Aché, Hipolabor, Blau | uma concentração | uma ampola |
| Morfina | `bolus:morfina-menor6m`, `bolus:morfina-maior6m`, `fita:fita-morfina-iv` | 10 mg/mL (Cristália, Hipolabor, União Química); 1 mg/mL (Cristália, União Química); 0,2 mg/mL (Cristália, União Química); 0,1 mg/mL (Cristália) | as de 0,1 e 0,2 mg/mL são as concentrações do neuroeixo: a 0,2 mg/mL da União Química diz "IV/EPI/IT" na CMED, e as da Cristália não dizem a via; a via sai da bula | 1 e 10 mg/mL sem marcação; 0,1 e 0,2 só se a bula permitir IV (L5-3) |
| Insulina regular | `bolus:polarizante-insulina` | 100 UI/mL (vários) | ML7: nunca mL do frasco de 100 UI/mL | só o preparo diluído do livro, 0,1 UI/mL (p. 521), se o RT aprovar para o bolo (L5-5) |
| Neostigmina | `bolus:neostigmina-0a2`, `bolus:neostigmina-maior2` | 0,5 mg/mL, amp. 1 mL: União Química, Blau | não estava na lista do lote 5; o diagnóstico não tinha achado apresentação | entrar neste lote (L5-6) |

## 2. Decisões para o RT (A recomendada)

- **L5-1. Bulas.** A: como no lote 4, o RT baixa no Bulário a bula do profissional de cada princípio da tabela (11 bulas) e a sessão lê via e diluição. B: bula só onde muda algo que já se sabe: vitamina K (via), morfina 0,1 e 0,2 mg/mL (via) e acetilcisteína (diluição); os demais entram pela CMED, sem aviso de diluição.
- **L5-2. Vitamina K.** A: só entra a ampola cuja bula permite IV; se nenhuma permitir, a vitamina K IV fica sem mL. B: entram as três, com o aviso "confira na bula se a ampola pode ser IV".
- **L5-3. Morfina.** A: 1 e 10 mg/mL, nenhuma marcada; 0,1 e 0,2 mg/mL só se a bula permitir IV. B: as quatro.
- **L5-4. Octreotida.** A: 0,05, 0,1 e 0,5 mg/mL, nenhuma marcada. B: só 0,1 mg/mL.
- **L5-5. Insulina na solução polarizante.** A: mL só do preparo de 0,1 UI/mL do livro (p. 521), com o texto do preparo ao lado (0,1 UI/kg = 1 mL/kg desse preparo). B: a insulina fica sem mL.
- **L5-6. Neostigmina.** A: entra neste lote (0,5 mg/mL). B: fica para o lote 6.

## 3. Execução (depois das decisões)

1. Branch `fase-ml/lote5-antidotos-cardio`, PR próprio, depois do lote 4.
2. `ampolas.ts`: princípios novos, fontes (CMED e bulas lidas), `diluir` só quando a bula mandar, chaves `bolus:` e `fita:` da tabela 1.
3. Doses em µg (esmolol, milrinona, octreotida, terbutalina): concentração em µg/mL no cadastro, como a fentanila.
4. Ficha `ped-ampolas` em versão nova, aprovada pelo RT; migration da ficha na homologação, com o rollback testado.
5. Testes: `problemasDasAmpolas()` vazio; volume = dose ÷ concentração em cada apresentação; nenhuma marcada quando há mais de uma; insulina nunca pelo frasco de 100 UI/mL; pralidoxima sem mL.
6. Homologação → conferência do RT → produção com o ok do RT → `BACKLOG.md`.

## 4. Riscos

- Vitamina K: ampola IM/SC usada na veia (L5-2).
- Morfina: quatro concentrações, de 0,1 a 10 mg/mL (100×); a de neuroeixo na veia (L5-3).
- Octreotida: 0,05 a 0,5 mg/mL (10×).
- Insulina: o frasco de 100 UI/mL dá volumes abaixo de 0,1 mL e erro de até 1.000× (ML7).
