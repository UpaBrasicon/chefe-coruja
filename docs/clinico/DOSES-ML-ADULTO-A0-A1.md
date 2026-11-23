# Dose em mL no adulto, lotes A0 e A1: cadastro único, PCR e arritmias

Data: 23/11/2026. Situação: decisões A1-1 a A1-4 = A (RT, 23/11/2026); implementado na branch fase-ml/adulto-a0-a1, na produção pelo PR #1049; KCl e aminofilina pelas bulas lidas em 23/11/2026 (Farmace, Equiplex e Hipolabor), na branch fase-ml/adulto-a1-bulas. Base: `docs/clinico/DOSES-ML-ADULTO-DIAGNOSTICO.md` (MA1 a MA7 = A).

## A0. Cadastro único

- As telas do adulto passam a usar o cadastro da pediatria (`AMPOLAS` em `src/clinico/pediatria/ampolas.ts`), com chaves próprias: `adulto-pcr:<id>`, `adulto-bradi:<id>` e `adulto-taqui:<id>`.
- A guarda (`problemasDasAmpolas`) aceita esses prefixos.
- A PCR do adulto já mostra o mL desde o lote 1 (adrenalina, amiodarona, lidocaína, bicarbonato e magnésio, em `ampolasAdulto.ts`) e não muda neste lote.
- O magnésio do adulto tem a dose em g; ganha o princípio `magnesio-g` (10% = 0,1 g/mL; 50% = 0,5 g/mL), o mesmo que a PCR já usa.

## A1. PCR, bradicardia e taquiarritmias

| Tela | Item | Dose (fonte) | Ampola | mL |
|---|---|---|---|---|
| Bradicardia | Atropina | 0,5 mg (ERC) ou 1 mg (AHA) IV, a cada 3–5 min, até 3 mg | 0,25 e 0,5 mg/mL (CMED), nenhuma marcada | entra |
| Bradicardia | Aminofilina | 250 mg EV em bolus (p. 229); 100–200 mg IV lenta (ERC) | 24 mg/mL, ampola de 10 mL (CMED: Teuto, Farmace, Hipolabor) | espera a bula (A1-3) |
| Taquiarritmias | Adenosina | 6 mg → 12 mg → 12 mg em bolus rápido; metade por acesso central (p. 265) | 3 mg/mL (bula do lote 1) | entra se a via for confirmada (A1-1) |
| Taquiarritmias | Amiodarona, ataque | 150 mg em 10 min (p. 265) | 50 mg/mL, a aspirar e diluir (bulas do lote 1) | entra |
| Taquiarritmias | Lidocaína, ataque | 0,7–1,4 mg/kg a 50 mg/min (p. 265) | 1% e 2% (CMED e bulas do lote 1) | entra |
| Taquiarritmias | Magnésio no torsades | 2 g em 15 min (p. 266) | 10% e 50%, a aspirar e diluir (infusão de 15 min) | entra |
| PCR | KCl na hipocalemia | 20 mEq em 10 min (p. 50) | 19,1% (2,56 mEq/mL) e 10% (1,34 mEq/mL), a aspirar e diluir | via e bula (A1-1, A1-2, A1-3) |
| PCR | Glicose da hipercalemia | 25 g de glicose (p. 51) | glicose 5% a 50% (lote 8), nenhuma marcada | entra |

**Ficam sem mL:**
- verapamil, diltiazem e isoprenalina: nenhum injetável à venda na CMED de 09/11/2026;
- glucagon e alteplase: pó (MA6);
- insulina da hipercalemia: só pelo preparo de 0,1 UI/mL (ML7), que não serve para um bolo de 10 U;
- dopamina e adrenalina da bradicardia: infusões (MA5); a adrenalina já tem mL/h.

## Decisões para o RT (A recomendada)

- **A1-1. Vias que o item não escreve.** A adenosina diz "bolus rápido", e o KCl da PCR diz só "2 mEq/min por 10 min". A: você confere na fonte que as duas são IV (adenosina p. 265; KCl p. 50) e o item passa a escrever "IV". B: as duas ficam sem mL.
- **A1-2. KCl na PCR.** A: 19,1% e 10%, nenhuma marcada, com "aspirar e diluir". B: só 19,1%.
- **A1-3. Bulas.** A: você baixa as bulas da aminofilina e do KCl; até elas chegarem, os dois itens ficam sem mL. Links pelo número do registro da CMED:
  - aminofilina (Hipolabor): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=113430118
  - KCl 19,1% (Equiplex): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=117720007
  - KCl 10% (Farmace): https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=110850015
- **A1-4. Atropina.** A: as duas ampolas (0,25 e 0,5 mg/mL), nenhuma marcada, para a dose do ERC e para a da AHA. B: só 0,5 mg/mL.

## Implementação (depois das decisões)

1. Cadastro: prefixos do adulto e o princípio `magnesio-g` em `ampolas.ts`; chaves dos itens da tabela.
2. Telas: Bradicardia e Taquiarritmias com a escolha da ampola; na PCR, KCl e glicose.
3. Fichas: `ped-ampolas` sobe de versão; as fichas da bradicardia, da taquiarritmia e da PCR sobem se o texto da via mudar (A1-1).
4. Testes, migration, homologação e aprovação do RT.
