# VD13 — Check-in que reabre a presença sem limpar o check-out

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P1**. Achado na revisão do lote; o RT mandou seguir em 01/11/2026 ("Sim, VD13").

## Diagnóstico

`public.registrar_checkin` grava a presença em `presenca_plantonista` com upsert:

```sql
ON CONFLICT (perfil_id, unidade_id, data, turno)
DO UPDATE SET checkin_em = EXCLUDED.checkin_em, ..., observacao = EXCLUDED.observacao
```

Um segundo check-in no mesmo plantão cai na linha que já existe. O check-in é trocado, mas o check-out antigo fica. A presença reaberta já nasce fechada, e `registrar_checkout` recusa o novo check-out: "Check-out já realizado".

Isso acontece em dois casos:
- **Check-out cedo:** o profissional faz check-out e volta no mesmo plantão.
- **Fechamento automático:** a presença foi fechada por `fechar_presencas_vencidas`, com `checkout_automatico = true`, e o profissional faz check-in de novo.

A revisão apontou o caso sem escala que veio com o VD5: check-in às 19h, check-out às 23h e novo check-in à 1h caem na mesma noite. Hoje esse caminho está desligado. Desde 26/09/2026, `private.tem_acesso_atendimento` responde sempre `false`, e o check-in exige escala. O defeito chega pelo caminho com escala, que já existia antes do VD5.

O corpo no repositório (`20270209000004_checkin_madrugada.sql`) tem o mesmo md5 que a produção e a homologação (`38c077a7…`), em 01/11/2026. Na produção, nenhuma das 3 presenças tem o check-out antes do check-in.

## Correção

Migration `20270209000009_checkin_reabre.sql`:
- O `DO UPDATE` de `registrar_checkin` também limpa `checkout_em`, `checkout_lat`, `checkout_lng` e `checkout_dentro`, e volta `checkout_automatico` para `false`.
- O resto do corpo fica igual ao de `20270209000004`.
- Mesma assinatura, expand, idempotente, sem tela.

Rollback: reaplicar `public.registrar_checkin` de `20270209000004_checkin_madrugada.sql`. Só essa função; `private.data_do_turno` fica.

## Testes

`supabase/tests/vd13_checkin_reabre.sql` cria o próprio cenário, com escala no plantão de agora:
1. check-in;
2. check-out, marcado em seguida como automático;
3. check-in de novo: tem de ser a mesma presença, sem nenhum dado de check-out;
4. check-out de novo: tem de ser aceito.

Evidência:
- **Sem a migration, falha:** na homologação, o passo 3 recusa a presença reaberta com o check-out antigo.
- **Com a migration, passa:** 3 de 3. `vd5_checkin_madrugada.sql` e `checkin_justificativa_curta.sql` seguem passando.
- **Rollback testado na homologação:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback, o md5 de `registrar_checkin` voltou ao de antes (`38c077a7…`) e o teste voltou a falhar;
  - o ACL e o dono ficaram iguais.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000009` registrada. O md5 de `registrar_checkin` é `735a098e…`.

## Produção

Migration `20270209000009` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar:
- versão registrada;
- `registrar_checkin` com md5 `735a098e…`, igual ao da homologação;
- ACL e dono iguais.

PR #405 mesclado em seguida. Concluído.

## Riscos

- A presença reaberta perde os dados do check-out anterior, e o check-in anterior já era trocado antes da correção. O tempo entre o primeiro check-in e o primeiro check-out não fica registrado. Guardar os dois períodos exigiria uma presença por entrada, que é mudança de modelo.
- O fechamento automático pode fechar de novo a presença reaberta, se ela continuar vencida. Isso é o comportamento esperado.
