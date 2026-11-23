# Dose em mL, lote 8: pendências decididas pelo RT

Data: 23/11/2026. Situação: decisões do RT em 23/11/2026, implementadas na branch `fase-ml/lote8-pendencias`. Base: as pendências que ficaram dos lotes 4 a 7 (`docs/clinico/DOSES-ML-BULAS-PENDENTES.md`, seção 3, e `DOSES-ML-LOTE7-BULAS.md`).

## Decisões do RT (23/11/2026)

| Pendência | Decisão |
|---|---|
| Itens "IV ou VO" com o volume da forma IV (linezolida, metronidazol e levofloxacino da oncologia, linezolida da pele, dipirona da crise álgica) | A: o mL fica, com o aviso "Volume da forma injetável. Por via oral a concentração é outra: não use este volume." |
| Dexametasona da asma e do crupe (VO, IM ou IV) | A: a escolha da ampola de 2 e 4 mg/mL, com o mesmo aviso |
| Glicose | Todas as concentrações à venda, com a de 50%; a de 75% fica fora (pergunta de segurança, decisão do RT) |
| Enoxaparina no lactente (volume abaixo de 0,1 mL) | A: o volume fica, com o aviso de seringa de 1 mL (sem mudança) |
| Ácido tranexâmico da doença de von Willebrand (p. 682) | O livro dá IV ou VO: a ampola de 50 mg/mL entra com o aviso de via mista |
| Fenitoína profilática da oncologia (p. 720) | O livro dá IV: a ampola de 50 mg/mL entra, a aspirar e diluir |

## O que muda

- Aviso de via mista (`viaMista` em `ITENS_COM_AMPOLA`) nos itens acima. SMX-TMP "IV ou VO" (choque tóxico e oncologia) entra pela mesma regra, com a dose em trimetoprima (16 mg/mL, L6-5) e "aspirar e diluir" (bula Bac-Sulfitrin).
- Glicose 5% e 10% (frascos, volume a infundir), 25% e 50% (ampolas), nenhuma marcada. Itens em g (injúria renal, solução polarizante dos eletrólitos) usam a dose direto; itens em mL de glicose 25% (bolus, crise, coma, oncologia) convertem a dose para g (× 0,25) antes da conta. A RCP e o guia de parada já mostram o volume da glicose 25% e ficam sem a escolha (sem dois volumes na mesma dose).
- Texto da via escrito no item, conferido pelo RT no livro: tranexâmico da DVW "IV ou VO" (p. 682) e fenitoína profilática "IV" (p. 720). As fichas `ped-hemostasia-trombose` e `ped-emergencias-oncologicas` sobem para 2026-11-23.1.
- Ficha `ped-ampolas` 2026-11-23.2. Migration `20270416000024` na homologação (volta testada em transação desfeita).

## Riscos

- Glicose de 5% a 50% (10×), nenhuma marcada; a 50% é hipertônica.
- Item de via mista: o volume vale só para a forma injetável (aviso fixo).
