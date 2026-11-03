# VD9 — Avisos com `current_date`

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P2**. O RT mandou seguir até o VD12 em 01/11/2026.

## Diagnóstico

`notificacoes_plantonista` guarda um aviso por perfil, unidade, data e tipo (`ON CONFLICT (perfil_id, unidade_id, data, tipo)`). Dez funções gravavam a data do aviso com `current_date`. O banco roda em UTC: das 21h às 24h de Brasília, `current_date` já é amanhã. Com isso:
- **avisos diários repetidos:** os avisos de prazo da regulação (`regulacao_sla_avisar`) e a cobrança do NIR saíam de novo às 21h, porque a chave do dia mudava;
- **data errada:** os avisos dessa faixa saíam com a data de amanhã.

As funções são:
- `public.enviar_mensagem`, o aviso de mensagem do chat;
- `public.nir_cobrar`;
- `public.regulacao_atualizar_evolucao` e `public.regulacao_responder_pendencia`;
- `private.regulacao_avisar`, `private.regulacao_avisar_destino` e `private.regulacao_avisar_regulador`;
- `private.regulacao_sla_avisar`;
- `private.rnds_avisar`;
- `private.webhook_manutencao`.

Em todas, o único uso de `current_date` é a data do aviso. Isso foi conferido na produção em 01/11/2026. O corpo das dez é igual na homologação e na produção (md5).

## Correção

Migration `20270209000006_avisos_data_brasilia.sql`: troca `current_date` por `private.data_atual()`, o dia de Brasília.
- **Como:** a troca é feita na definição atual de cada função, lida de `pg_get_functiondef` e sem o CR do fim de linha. É o mesmo método de `20270209000003`.
- **O que não muda:** assinatura, dono e grants.
- **Idempotente:** se a função já usa `data_atual` e não tem mais `current_date`, a migration não mexe nela. Se a função mudou e não tem nenhum dos dois, a migration para com erro.
- Expand, sem tela.

Rollback: o mesmo bloco com a troca invertida. Nenhuma das dez funções usava `data_atual` antes, por isso a volta é exata.

## Testes

`supabase/tests/vd9_avisos_data.sql`:
1. **Aviso com o dia de Brasília.** Com o relógio de Brasília fixo em 01/01/2001, `rnds_avisar` grava o aviso para o gestor do seed com a data 01/01/2001. Sem a correção, a data seria a de hoje em UTC.
2. **Nenhuma das dez funções usa `current_date`.** Todas usam `private.data_atual()`.

A seção 1 usa o seed do CI. A homologação não tem esse seed, por isso lá roda a seção 2.

Evidência na homologação:
- **Sem a migration, falha:** `enviar_mensagem(uuid,text) ainda usa current_date`.
- **Com a migration, passa.**
- **Rollback testado, em transação desfeita:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback, o md5 das dez funções (sem o CR) voltou ao de antes;
  - o ACL e o dono ficaram iguais.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000006` registrada. A seção 2 passa com a migration aplicada, e os corpos mantêm as quebras de linha.

## Produção

Migration `20270209000006` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar: versão registrada; as dez funções com md5 igual ao da homologação e sem `current_date`; ACL igual.

PR mesclado em seguida. Concluído.

## Riscos

- Muda só a data gravada nos avisos novos. Os avisos já gravados ficam como estão.
- Na primeira noite depois da troca, um aviso diário já mandado às 21h com a data de amanhã não se repete à meia-noite: a chave dele já é a de amanhã.
