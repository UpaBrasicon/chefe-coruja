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
