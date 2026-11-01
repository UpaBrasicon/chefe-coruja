# VD12 — Testes frágeis de competência

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P2**. O RT mandou seguir até o VD12 em 01/11/2026.

## Diagnóstico

`supabase/tests/fase5_conta_documentos_sus.sql` e `supabase/tests/fase5_conta_glosas.sql` montavam a competência e as datas de validade em UTC:
- a competência com `to_char(now(), 'YYYYMM')`;
- as datas com `current_date`.

As funções testadas usam o dia de Brasília. Das 21h às 24h do último dia do mês, o teste já montava a competência seguinte. Hoje os testes passam porque nenhuma função recusa competência futura. Eles quebrariam se viesse uma guarda assim, ou se o teste comparasse com a competência sugerida pelo banco.

Os três testes do ERP de plantões, que tinham o mesmo problema, foram corrigidos no PR #388.

## Correção

Nos dois testes, `to_char(now(), …)` e `current_date` passam a usar `private.data_atual()`, o dia de Brasília. Só os testes mudam: sem migration e sem tela.

## Evidência

Os dois testes rodam na CI (passo `banco`) e passam com a mudança.

## Riscos

Nenhum na aplicação. Outros testes também usam `current_date` em datas relativas, longe da virada. Eles ficam para a revisão final do lote.
