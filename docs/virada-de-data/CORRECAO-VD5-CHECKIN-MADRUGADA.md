# VD5 — Check-in sem escala de madrugada

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P1**, decidida pelo RT em 01/11/2026 ("Sim, VD5").

## Diagnóstico

`public.registrar_checkin` funciona assim quando não há escala na janela (quem tem acesso de atendimento sem estar escalado):

```sql
v_data := coalesce(v_escala.data, private.data_atual());
v_turno := coalesce(v_escala.turno, private.turno_atual());
```

Entre 00h e 6h59 de Brasília, isso dá (hoje, `noite`), mas a noite em curso começou ontem às 19h. A presença ficava gravada na noite de hoje, que ainda nem começou. O check-in real das 19h fazia upsert na mesma linha (`ON CONFLICT (perfil_id, unidade_id, data, turno)`) e a presença da madrugada se perdia.

Com escala, a data vem da escala e já estava certa.

O corpo da função no repositório (`20270208000012_checkin_justificativa_curta.sql`) é igual ao da produção, com o mesmo md5, em 01/11/2026.

## Correção

Migration `20270209000004_checkin_madrugada.sql`:

- **Função nova** `private.data_do_turno(instante default now())`: o dia em que começou o plantão em curso, no fuso de Brasília. Antes das 7h é ontem; nos outros horários, hoje. Nenhum papel a executa direto: só a RPC, que é `SECURITY DEFINER`.
- **Check-in sem escala:** `registrar_checkin` passa a usar `private.data_do_turno()` quando não há escala. Com escala, nada muda.
- **O resto da função:** fica igual ao de `20270208000012`.
- Expand, idempotente, sem tela.

Rollback: reaplicar `registrar_checkin` de `20270208000012` e `DROP FUNCTION private.data_do_turno(timestamptz)`.

## Testes

`supabase/tests/vd5_checkin_madrugada.sql`.

`now()` não se simula dentro da transação, por isso a regra é testada na função nova com horários fixos:

- 00h, 3h30 e 6h59 caem na noite de ontem;
- 7h, 13h, 19h e 23h59 caem em hoje, inclusive 23h59, quando em UTC já é amanhã;
- o instante dado em UTC é lido em Brasília;
- viradas de ano e de fevereiro.

O teste também confere que o check-in sem escala usa a função nova e que, no horário em que roda, a data dela bate com a de `turno_atual()`.

Evidência na homologação, em transação desfeita:
- **Sem a migration, falha:** `private.data_do_turno` não existe.
- **Com a migration, passa.**
- **Rollback testado:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback o md5 de `registrar_checkin` voltou idêntico ao de antes (`01dca216…`) e a função nova saiu;
  - o ACL ficou igual (`authenticated` e `service_role` executam, `anon` não).

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000004` registrada. O teste passa já com a migration aplicada.

## Produção

Aguarda o "ok produção" do RT. A migration entra antes do merge.

## Riscos

- Muda só o check-in sem escala entre 00h e 6h59. O com escala e os outros horários seguem iguais.
- Quem fez check-in sem escala de madrugada antes desta correção tem a presença gravada na data errada. Isso não é corrigido aqui, mas a produção ainda não tem equipe em uso (UPA Centro, 31/10/2026).
