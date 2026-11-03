# VD14 — Diluição e exportação pelo dia UTC

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P2**. Achado na revisão do lote; o RT mandou seguir em 01/11/2026 ("Sim, VD14").

## Diagnóstico

O banco roda em UTC. Das 21h às 24h de Brasília, o dia UTC já é amanhã.

1. **`publicar_diluicao_versao`** grava `data_revisao = current_date`. A diluição publicada das 21h às 24h fica revisada amanhã; em 31/12, no ano seguinte. O teste pegou isso ao vivo: rodado em 01/11/2026 depois das 21h, a revisão saiu `2026-11-02`.
2. **`publicar_diluicao`**, a publicação antiga da curadoria, tem `p_data_revisao date DEFAULT CURRENT_DATE`. A tela não a chama mais, mas ela segue executável por `authenticated`.
3. **`private.exp_linhas`** monta o período da exportação estruturada (LGPD) com `desde::timestamptz` e `(ate + 1)::timestamptz`, meia-noite UTC. Uma exportação de 10/05 trazia o que aconteceu de 21h de 09/05 até 21h de 10/05.

Os corpos na homologação têm o mesmo md5 que a produção em 01/11/2026:
- `publicar_diluicao_versao`: `cd985926…`;
- `publicar_diluicao`: `5f722d84…`;
- `exp_linhas`: `8ae4f37b…`.

## Correção

Migration `20270209000010_diluicao_exportacao_datas.sql`, com as trocas feitas na definição atual de cada função, como em `20270209000003`:

1. **`publicar_diluicao_versao`:** `data_revisao = private.data_atual()`.
2. **`publicar_diluicao`:** o default passa a `NULL`, e o corpo grava `coalesce(p_data_revisao, private.data_atual())`. O default não chama `private.data_atual()` direto porque é avaliado com o papel de quem chama, que não enxerga o esquema `private`. Quem informa a data continua gravando a data informada.
3. **`private.exp_linhas`:** o período vai de `desde::timestamp AT TIME ZONE 'America/Sao_Paulo'` a `(ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'`, isto é, de 00h do primeiro dia a 24h do último, em Brasília.

Mesma assinatura, dono e grants. Idempotente: trecho já trocado não muda, e função mudada para com erro.

Rollback: as mesmas trocas invertidas, na ordem inversa, com o mesmo helper.

```sql
SELECT pg_temp.vd14_trocar('private.exp_linhas(public.exportacoes, integer, integer)', 'v_fim timestamptz := ((x.ate + 1)::timestamp AT TIME ZONE ''America/Sao_Paulo'');', 'v_fim timestamptz := (x.ate + 1)::timestamptz;');
SELECT pg_temp.vd14_trocar('private.exp_linhas(public.exportacoes, integer, integer)', 'v_ini timestamptz := (x.desde::timestamp AT TIME ZONE ''America/Sao_Paulo'');', 'v_ini timestamptz := x.desde::timestamptz;');
SELECT pg_temp.vd14_trocar('public.publicar_diluicao(uuid, text, date)', 'data_revisao = coalesce(p_data_revisao, private.data_atual())', 'data_revisao = p_data_revisao');
SELECT pg_temp.vd14_trocar('public.publicar_diluicao(uuid, text, date)', 'p_data_revisao date DEFAULT NULL::date', 'p_data_revisao date DEFAULT CURRENT_DATE');
SELECT pg_temp.vd14_trocar('public.publicar_diluicao_versao(uuid)', 'data_revisao = private.data_atual()', 'data_revisao = current_date');
```

## Testes

`supabase/tests/vd14_diluicao_exportacao.sql` cria o próprio cenário, sem o seed, e roda também na homologação:
1. **Exportação:** quatro pacientes cadastrados às 22h de 09/05/2031, 8h e 22h de 10/05 e 00h30 de 11/05. A exportação de 10/05 tem de trazer só os de 8h e 22h.
2. **Diluição**, com `private.data_atual()` fixada em 31/12/2031 dentro da transação:
   - a farmacêutica publica pela tela nova: a revisão tem de sair 31/12/2031;
   - o super admin publica pela função antiga sem a data: 31/12/2031;
   - e com a data: a data informada.

Evidência:
- **Sem a migration, falha:**
  - a exportação de 10/05 trouxe os cadastros das 22h de 09/05 e das 8h de 10/05, e deixou de fora o das 22h de 10/05;
  - com a seção 1 retirada, a seção 2 falha na primeira conferência: a revisão saiu `2026-11-02`, o dia UTC.
- **Com a migration, passa.** `diluicao_da_unidade.sql` segue passando.
- **Rollback testado na homologação:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback, o md5 das três funções, a lista de argumentos com os defaults, o ACL e o dono voltaram aos de antes, e o teste voltou a falhar;
  - reaplicada, ficou igual à primeira aplicação.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000010` registrada. md5 depois:
- `publicar_diluicao_versao`: `323081b7…`;
- `publicar_diluicao`: `ad0b0ffb…`;
- `exp_linhas`: `b33f9ce8…`.

## Produção

Migration `20270209000010` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar:
- versão registrada;
- md5 das três funções e lista de argumentos iguais aos da homologação;
- ACL e dono iguais.

PR #406 mesclado em seguida. Concluído.

## Riscos

- Diluições já publicadas das 21h às 24h seguem com a revisão do dia seguinte. A correção não refaz datas antigas.
- Uma exportação já feita não é refeita. Pedir de novo o mesmo período passa a trazer os dias de Brasília.
- Quem chamava `publicar_diluicao` passando `NULL` de propósito agora grava o dia de hoje. Nenhuma tela chama essa função.
