# Dose em mL, lote 7: os itens que esperavam bula

Data: 23/11/2026. Situação: decisões L7-1 a L7-7 = A (RT, 23/11/2026); implementado na branch `fase-ml/lote7-bulas` (seção 5). Base: `docs/clinico/DOSES-ML-BULAS-PENDENTES.md` (lista única dos lotes 4 a 6), as decisões ML1 a ML11, L4 a L6 e a regra "CMED + bula, só à venda". As 25 bulas foram baixadas pelo RT no Bulário Eletrônico em 23/11/2026 e lidas pela sessão (texto extraído, sem cópia no repositório).

## 1. O que as bulas dizem

| Princípio | Bula lida (fabricante) | Concentração e base | Via e diluição | Itens |
|---|---|---|---|---|
| Difenidramina | Difenidrin (Cristália), única injetável à venda | 50 mg/mL de cloridrato de difenidramina | IV ou IM; sem ordem de diluir | `anafilaxia:difenidramina-tabela`, `-texto`, `bolus:difenidramina`, `fita:fita-difenidramina` |
| Dexametasona | Eurofarma, Farmace (2 e 4 mg/mL), Hipolabor (2 e 4 mg/mL) | "4 mg/mL" = 4 mg de **fosfato de dexametasona** (4,37 mg do sal dissódico); nenhuma diz dexametasona base | IV, IM | L7-1 |
| Acetilcisteína | Fluimucil injetável (Zambon) | 100 mg/mL, ampola de 3 mL | IV por infusão (antídoto): aspirar e diluir | `bolus:acetilcisteina-1` a `-3` |
| Esmolol | Brevibloc (Cristália) | 10 mg/mL de **cloridrato** (10 mg = 8,9 mg de base); 250 mg/mL concentrado, sem venda na CMED | 10 mg/mL pronto; 250 mg/mL deve ser diluído | `bolus:esmolol-bolus` (L7-4) |
| Milrinona | Primacor (Sanofi Medley) | composição: 1 mg/mL de milrinona (na forma de lactato); apresentação: "1 mg de lactato = 0,699 mg de base" | IV; ataque em bolo | `bolus:milrinona-ataque` (L7-2) |
| Clindamicina | Hipolabor; União Química | 150 mg/mL de clindamicina base | IV sempre diluída (máx. 18 mg/mL, 30 mg/min); IM sem diluir | `choqueToxicoPartesMolesPed:clinda-iv` (os outros dois itens não escrevem a via) |
| Gentamicina | Santisa e Hipolabor (40 mg/mL) | "sulfato de gentamicina 40 mg", **sem dizer se é a base** | IM, IV diluída (50 a 200 mL no adulto, menos na criança) | `ituPed:gentamicina`, `pneumoniaPed:genta` (L7-3) |
| Amicacina | Teuto (50 e 250 mg/mL); Newcom (250) | "equivalente a amicacina base" | IM, IV | `ituPed:amicacina`, `oncologiaPed:amicacina`, `pneumoniaPed:amicacina` |
| Tobramicina | Tobramina (Antibióticos do Brasil) | 50 mg/mL de tobramicina | IV diluída em 50 a 100 mL | `ituPed:tobramicina` |
| SMX-TMP | Bac-Sulfitrin (Brainfarma) | 80 + 16 mg/mL; as doses do livro estão em TMP (16 mg/mL, L6-5) | ampolas devem ser diluídas | nenhum item tem via só IV: `choqueToxico:smxtmp` e `oncologia:tmp` são "IV ou VO"; `imunodeprimido:tmp` e `osteoarticular:tmpsmx` não escrevem a via |
| Desmopressina | DDAVP (Ferring) | 4 µg/mL de **acetato** (= 3,56 µg de desmopressina) | IV, IM, SC; o item já diz "em 50 mL de SF" | `hemostasiaTromboPed:ddavp` (L7-5) |
| Salbutamol injetável | Hipolabor, única à venda | 0,5 mg/mL de salbutamol base | IV, IM, SC; bula **"uso adulto"** | `injuriaRenalPed:beta2` (L7-6) |
| Morfina 0,1 e 0,2 mg/mL | Dimorf (lida em 20/11) | — | "uso intravenoso, intratecal e epidural" | entram pela L5-3 A ao lado de 1 e 10 mg/mL |

**Sem mL, sem decisão nova:**
- Vitamina K IV (`bolus:vitamina-k`): Kavit só IM (a bula contraindica a IV); Hyvit K IM/SC e Eskavit SC/IM pela CMED. L5-2 A: sem ampola IV, sem mL. A SC (`intoxicacao:vitk-sc`) entra com Hyvit K e Eskavit quando as bulas das duas forem lidas.
- Azul de metileno: sem injetável na CMED nem no Bulário. Segue como hoje (L4-4 A): solução a 1% do livro (p. 102), 10 mg/mL.
- Gentamicina e clindamicina sem via escrita (`imunodeprimido:gentamicina`, `choqueToxico:clindamicina`, `osteoarticular:clindamicina`) e SMX-TMP: critério do lote 6b.

**Só o aviso de diluir (não bloqueavam):** magnésio (direto ou diluído; 50% segue diluir pelo livro), flumazenil (bolo sem diluir), hidralazina (IM/IV/infusão), terbutalina (não diluir em solução alcalina), ondansetrona (bolo em 5 min ou diluída), octreotida (bolo ou infusão), neostigmina (IV muito lenta), furosemida (máx. 4 mg/min), tranexâmico (IV lenta sem diluir, 50 mg/min), dipirona (máx. 1 mL/min), bicarbonato 8,4% (1 mEq/mL). Nenhum manda diluir no bolo; a tela ganha a velocidade máxima no aviso quando a bula a dá.

## 2. Decisões para o RT (A recomendada)

- **L7-1. Dexametasona.** A bula dá o valor em fosfato de dexametasona (4 mg/mL), não em dexametasona base (cerca de 3,3 mg/mL). A: a ampola entra como 2 e 4 mg/mL e a dose do livro é lida no mesmo rótulo (é como se prescreve e como as bulas de outros países escrevem). B: dexametasona sem mL. Nos itens "VO, IM ou IV" (asma, crupe) o mL só entra depois da decisão da via mista; a meningite (EV) entra já.
- **L7-2. Milrinona.** A bula se contradiz. A: 1 mg/mL de milrinona, pela composição da bula e pelo livro (p. 253). B: sem mL.
- **L7-3. Gentamicina.** As bulas de 40 mg/mL não dizem a base. A: o RT baixa a bula da Fresenius (20 e 40 mg/mL, registro 100410210); se ela disser base, entram 20 e 40 mg/mL, nenhuma marcada (L6-4). B: entra 40 mg/mL pelo rótulo, sem esperar. C: gentamicina sem mL.
- **L7-4. Esmolol.** A: a dose do livro (µg/kg) é do cloridrato, como o rótulo; entra 10 mg/mL. B: sem mL.
- **L7-5. Desmopressina.** A: a dose do livro (0,3 µg/kg) é do acetato, como o rótulo; entra 4 µg/mL com "aspirar e diluir em 50 mL de SF". B: sem mL.
- **L7-6. Salbutamol injetável.** A única ampola à venda diz "uso adulto". A: sem mL na criança; a tela diz por quê. B: mL com o aviso "bula: uso adulto".
- **L7-7. Volume muito pequeno.** Difenidramina e esmolol dão menos de 0,1 mL em lactentes (ex.: difenidramina 0,5 mg/kg em 3 kg = 0,03 mL; esmolol 100 µg/kg em 3 kg = 0,03 mL do frasco de 10 mg/mL). A: o aviso do lote 4 ("abaixo de 0,1 mL: seringa de 1 mL") vale; nada novo. B: abaixo de 0,1 mL a tela pede diluir antes.

## 3. Implementação (depois das decisões)

1. `src/clinico/pediatria/ampolas.ts`: princípios e fontes novos (bulas com fabricante, expediente e data), chaves da seção 1 em `ITENS_COM_AMPOLA`, `diluir` onde a bula manda.
2. Avisos de velocidade no texto do item quando a bula dá o limite.
3. Testes: `problemasDasAmpolas()` vazio; mesma base em cada item; nenhuma ampola marcada; SMX-TMP e itens sem via fora.
4. Ficha `ped-ampolas` nova versão; migration de fichas; homologação; aprovação do RT; produção com o ok do RT.

## 4. Riscos

- Dexametasona: fosfato × base, cerca de 17% (L7-1).
- Gentamicina 20 × 40 mg/mL (2×) e base não escrita (L7-3).
- Morfina de 0,1 a 10 mg/mL (100×): nenhuma marcada, como nas outras.
- Salbutamol "uso adulto" (L7-6).

## 5. Decisões do RT (23/11/2026) e andamento

L7-1 a L7-7 = A. Implementado:
- difenidramina 50 mg/mL na anafilaxia, nos bolus e no guia de parada;
- dexametasona 2 e 4 mg/mL (rótulo do fosfato) só nos itens EV ou IV: meningite (a tela da meningite ganhou a escolha da ampola) e oncologia (compressão medular, compressão de vias aéreas e HIC); asma, crupe e coma/HIC (sem via escrita) ficam sem mL;
- acetilcisteína 100 mg/mL, clindamicina 150 mg/mL (só a IV do choque tóxico), amicacina 50 e 250 mg/mL (pneumonia e oncologia), tobramicina 50 mg/mL e desmopressina 4 µg/mL, todas "aspirar e diluir";
- esmolol 10 mg/mL (10.000 µg/mL) e milrinona 1 mg/mL (1.000 µg/mL);
- morfina 0,1 e 0,2 mg/mL (Dimorf) ao lado de 1 e 10 mg/mL, nenhuma marcada.
- vitamina K 10 mg/mL só na via SC da intoxicação (bulas Eskavit e Hyvit K, lidas em 23/11/2026: IM e SC).

Gentamicina: a bula da Fresenius não está no Bulário (nem nos dados abertos de 23/11/2026). O RT escolheu a L7-3 B em 23/11/2026: entra 40 mg/mL pelo rótulo (Santisa e Hipolabor), a aspirar e diluir, só na pneumonia EV; a de 20 mg/mL fica fora.

Ficam sem mL: amicacina e gentamicina da ITU (IV ou IM; o aviso de diluir só vale na veia), salbutamol injetável (L7-6), vitamina K IV (as três bulas contraindicam a veia), SMX-TMP e clindamicina sem via só IV.

Ficha `ped-ampolas` 2026-11-23.1; migration `20270416000023` na homologação (volta testada em transação desfeita).
