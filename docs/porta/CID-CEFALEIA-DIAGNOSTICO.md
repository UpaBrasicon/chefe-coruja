# CID de referência: "Cefaleia" sugere O80.0 (parto) — diagnóstico

**Pedido do RT, 16/11/2026** ("CID da cefaleia"). O achado foi guardado em 15/11/2026 e confirmado pelo RT: "o CID O80.0 não tem nada a ver com esse CID de cefaleia".

**Escopo.** Só diagnóstico. Reproduzido na produção com `public.cid_sugerir_do_texto`, que lê só as tabelas de referência e nenhum dado de paciente. Nada mudou.

## O que acontece

Os CIDs de referência da Avaliação (migration `20270302000001_cid_sugerido.sql`) juntam duas fontes:
1. **Termos curados** (`public.cid_termo`, 69 termos), como "cefaleia" → R51.
2. **Busca de texto** na CID-10, para completar até 5 códigos.

A busca de texto usa o dicionário português do Postgres, que reduz cada palavra ao radical antes de comparar. Sem o acento, **"cefaleia" e "cefálico" viram o mesmo radical `cefal`**, então o "Parto espontâneo cefálico" (O80.0) entra na lista.

| Texto | Hoje (5 códigos, na ordem) |
|---|---|
| Cefaleia | R51 Cefaléia · G44.2 tensional · **O80.0 Parto espontâneo cefálico** · G44.3 pós-traumática · G44.8 outras |
| cefaleia em salvas | R51 · G44.2 · **O80.0** · G44.3 · G44.8 (G44.0, a cefaleia em salvas, não aparece) |
| dor de cabeça | **R52.9 Dor não especificada · R07.4 Dor torácica · S09.9 Traumatismo da cabeça · S01.9 Ferimento na cabeça** · R10.4 dor abdominal (R51 não aparece) |
| enxaqueca | G43 · G43.0 · G43.1 · G43.3 · G43.2 (certo) |

O R51 sempre vem primeiro quando a palavra é "cefaleia", porque é termo curado. O problema são as alternativas da busca de texto, que podem levar ao clique errado. A escolha do código continua sendo do médico.

## Decisões para o RT

**G1. Correção da busca de texto (a causa).**
- **A (recomendada):** além do radical, a palavra da descrição precisa começar com a palavra digitada, menos as duas últimas letras, sem acento:
  - "cefaleia" → `cefale` casa com "cefaléia", mas não com "cefálico";
  - "pneumonias" → `pneumoni` continua casando com "pneumonia".

  O mesmo filtro vale para qualquer palavra, não só cefaleia.
- **B:** tirar a busca de texto e deixar só os termos curados e a CIAP-2. É mais seguro, mas deixa de sugerir para o que não está na lista.

**G2. Termos curados novos** (a lista é mantida pelo RT, C7 de 06/11/2026).
- **A (recomendada):** incluir:
  - "dor de cabeça" → R51;
  - "cefaleia em salvas" → G44.0;
  - "cefaleia tensional" → G44.2.
- **B:** só a correção G1.

**G3. Outras colisões como essa.**
- **A (recomendada):** depois do G1, rodar os 69 termos curados e uma lista de queixas comuns do PS e trazer para você qualquer sugestão sem relação, como foi o O80.0.
- **B:** só a cefaleia.

## Riscos

- **G1:**
  - uma palavra muito curta, ou com o fim muito diferente do da descrição, pode deixar de casar, e a lista fica com menos de 5 códigos;
  - o teste roda os termos curados e compara antes e depois.
- **Rollback:** a migration recria a função anterior (a versão de `20270302000001`).

## Critérios de aceite

1. "Cefaleia" e "cefaleia em salvas" não trazem O80.0. "Cefaleia em salvas" traz G44.0, e "dor de cabeça" traz R51 primeiro.
2. Os 69 termos curados mantêm o primeiro código de hoje.
3. Teste de banco no CI.

## Decisão do RT e resultado (16/11/2026)

G1 a G3 = A ("Todas A"). Migration `20270414000065_cid_cefaleia.sql`:
- **G1:** a palavra da descrição precisa começar com a digitada sem as 2 últimas letras (7 letras ou mais) ou sem a última (5 e 6 letras). Palavra de até 4 letras precisa estar inteira.
- **G2:** três termos novos na lista.

Teste: `supabase/tests/cid_cefaleia.sql`.

**G3, varredura** dos 69 termos da lista e de 54 queixas comuns do PS. Comparei a produção de antes com a homologação depois da mudança.
- **Corrigido:**
  - "Cefaleia", "cefaleia em salvas" e "cefaleia tensional" não trazem mais o O80.0;
  - "cefaleia em salvas" → G44.0;
  - "cefaleia tensional" → G44.2;
  - "dor de cabeça" → R51, sem dor torácica nem traumatismo;
  - "picada de escorpião" não traz mais "Pica do lactente".
- **Sem mudança no primeiro código:** todos os outros termos da lista e queixas. "Reação alérgica" segue com T78.4 primeiro.
- **Colisões que a regra de palavras não resolve.** Precisam de um termo na lista (C7). Proposta para o RT:

| Digitado | Hoje | Proposta de termo |
|---|---|---|
| crise de pânico | G40.7 e G40.6 (epilepsia), E27.2 (crise addisoniana), D57 (falciforme) | "crise de pânico" → F41.0 Transtorno de pânico |
| falta de ar | X54.9 Falta de água, X53.9 Falta de alimento, Z59.0 Falta de domicílio | "falta de ar" → R06.0 Dispnéia |
| parada cardiorrespiratória | I46.9, seguido de V17/V27 (ciclista e motociclista em colisão com objeto parado) | "parada cardiorrespiratória" e "PCR" → I46.9 Parada cardíaca não especificada |
| vômitos | O21 (vômitos da gravidez) antes de R11 | "vômitos" → R11 Náusea e vômitos |
| crise hipertensiva | G40.7 (epilepsia) em primeiro | código a escolher pelo RT (ex.: I10 Hipertensão essencial); não incluo sem a decisão |

## Colisões da G3: decisão do RT (16/11/2026)

As 4 propostas foram aceitas, e para a crise hipertensiva o RT escolheu **I10**. A CID-10 do DATASUS não tem o I16.

Migration `20270414000074_cid_termos_colisoes.sql`, com 6 termos na lista e fonte "RT 16/11/2026, colisões G3":

| Termo | Código |
|---|---|
| crise de pânico | F41.0 |
| falta de ar | R06.0 |
| parada cardiorrespiratória | I46.9 |
| PCR | I46.9 |
| vômitos | R11 |
| crise hipertensiva | I10 |

Conferido na homologação: os 6 termos trazem o código escolhido em primeiro, e "cefaleia" e "dor torácica" seguem iguais. Teste: `supabase/tests/cid_colisoes.sql`.
