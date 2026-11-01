# VD3 — Escores pediátricos com `current_date`

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P0 clínico**, por decisão do RT em 01/11/2026 ("Registra, clínicos P0" e "Sim, VD3").

## Diagnóstico

O banco roda em UTC: `SHOW TimeZone` dá `UTC`, conferido na produção em 01/11/2026. Das 21h às 24h de Brasília, `current_date` já é o dia seguinte.

Cinco funções calculam a idade da criança com `current_date`:

| Função | O que decide | O que acontecia das 21h às 24h |
|---|---|---|
| `private.calcular_acuidade` | NEWS2 ou PEWS, e o grupo de idade do PEWS | Na véspera dos 14 anos, NEWS2 às 21h em vez de PEWS; na véspera do aniversário de 1, 5 ou 12 anos, grupo do PEWS trocado antes da hora |
| `public.acuidade` | Idade em meses do Phoenix | Faixa de idade adiantada na véspera do aniversário de mês |
| `private.observacao_dispara_pelod2` | Se dispara o PELOD-2 e a faixa de idade | Idem, e na véspera dos 14 anos deixava de disparar |
| `public.alertas_sepse` | Pediatria e faixa de idade do alerta de sepse | Idem |
| `private.pelod2_rotina` | Filtro de pediatria da rotina | Não errava, porque roda às 10h UTC; entra pela regra única |

O corpo delas no repositório é idêntico ao da produção: md5 do `prosrc` sem `\r`, conferido em 01/11/2026.

## Correção

Migration `20270209000002_escores_pediatricos_data.sql`:
- troca `current_date` por `private.data_atual()`, o dia de Brasília que o resto do banco já usa;
- os corpos são os das migrations de origem, só com essa troca;
- mesma assinatura, mesmos grants (`CREATE OR REPLACE`);
- expand, idempotente, sem tela.

Rollback: reaplicar as cinco funções das migrations de origem, listadas no cabeçalho da migration.

## Testes

`supabase/tests/vd3_escores_pediatricos_data.sql`, com o relógio da unidade fixado só na transação:

1. Com o relógio em 30/12/2026: quem nasceu em 31/12/2012 (véspera dos 14 anos) é **PEWS**; quem nasceu em 30/12/2012 (aniversário) é **NEWS2**.
2. Com o relógio em 15/06/2000, quem nasceu em 01/01/1990 tem 10 anos no dia da unidade e é **PEWS**. Isso prova que a escala segue `private.data_atual()`, não o relógio do servidor.
3. Nenhuma das cinco funções usa `current_date`.

Evidência na homologação, em transação desfeita:
- **Sem a migration, falha:** "no aniversário de 14 anos deveria ser NEWS2, veio PEWS".
- **Com a migration, passa.**
- **Rollback testado:**
  - a migration aplicada duas vezes não deu erro;
  - os corpos mudaram;
  - depois do rollback as cinco voltaram com md5 idêntico ao de antes;
  - os grants não mudaram.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000002` registrada. O teste roda e passa na homologação já com a migration aplicada.

## Produção

Aguarda o "ok produção" do RT. A migration entra antes do merge.

## Riscos

- Nenhuma mudança fora da janela das 21h às 24h: nas outras horas `current_date` e `data_atual()` são o mesmo dia.
- `private.observacao_dispara_pelod2` tem `EXECUTE` para `anon` desde antes. Isso não muda aqui, e `anon` não tem acesso ao schema `private`.
