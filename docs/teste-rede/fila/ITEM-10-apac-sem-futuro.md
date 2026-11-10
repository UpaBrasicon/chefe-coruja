# Item 10: a execução de APAC não aceita competência nem data no futuro

Achado: C P2-C2 do teste da rede (`EXECUCAO-C01-C06.md`, C03.08).

Decisão: opção A em F1 e F2, aplicada porque o RT delegou as próximas ações em 08/11/2026. Ele ficou com o "ok produção" e o merge.

Branch: `correcoes/apac-sem-futuro`.

## O que acontecia
- Em 07/11/2026, `registrar_execucao_apac(apac, '202612', …, '2026-12-07', …)` foi aceito.
- A RPC só conferia se a competência estava dentro da validade da APAC e se não estava fechada.
- A glosa registrada depois herdou a competência 202612, de uma produção que ainda não existe.

## Decisões
| # | Decisão | A (aplicada) | B |
|---|---|---|---|
| F1 | Competência depois da atual (mês de Brasília) | Recusada com "Competência no futuro", mesmo que esteja dentro da validade da APAC | Aceita, com aviso |
| F2 | Data de ocorrência depois de hoje (Brasília) | Recusada com "Data de ocorrência no futuro", como `registrar_procedimento` já faz | Aceita |

O que já está gravado não muda. Na homologação ficam a execução de 202612 do C03 e a glosa que veio dela.

## Feito
- Migration `20270308000005_apac_sem_futuro.sql`: troca de texto reaplicável em `registrar_execucao_apac`, com o rollback no cabeçalho.
- Teste `supabase/tests/fix_apac_sem_futuro.sql`: com cenário próprio. Antes da migration, falhou no F1; depois, passou na homologação.
  - Recusa a competência do mês que vem e a data de amanhã.
  - Aceita a competência atual e a anterior.
- Reconferência do C03.08 (`scripts/e2e/104_reconferencia_apac_futuro.sql`): na APAC do C03, a competência seguinte foi recusada, e a data de amanhã também.
