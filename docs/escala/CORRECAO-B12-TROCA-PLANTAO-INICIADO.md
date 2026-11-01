# Correção do B12 — troca de plantão já iniciado (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (baixo B12). Decisão do
RT em 31/10/2026: opção A, "Passa sim, troca não" (`docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md`).

## Problema

O plantão em curso podia ser trocado. O B10 (#368) já barrava o plantão encerrado; o que já começou e
ainda não terminou continuava entrando na troca, no pedido, no aceite do colega e na aprovação.

## Correção

- Migration `20270208000014_escala_troca_plantao_iniciado.sql`: a função do gatilho do B10
  (`private.troca_plantao_passado`) passa a recusar também o plantão que já começou ("Um dos plantões
  da troca já começou; só se trocam plantões que ainda não começaram. Para sair do plantão em curso,
  passe o plantão."). O gatilho `trg_troca_plantao_passado` vale na inserção e na atualização que
  efetiva a troca: o aceite do colega (`aceito_em`) e a aprovação (`status = 'aprovado'`). Recusar e
  cancelar continuam livres. O texto do B10 fica para o plantão encerrado.
- A passagem não muda: o plantão em curso continua podendo ser passado (quem precisa sair no meio).
- Tela: em "Seu plantão" (`PedidosEscala.tsx`), o plantão em curso mostra "Plantão em curso: dá para
  passar, mas não para trocar." com Passar e Justificar falta, sem Trocar. Na troca do plantonista
  (`Escala.tsx`), as listas só trazem plantões que ainda não começaram.
- Expand/contract: sem DROP/RENAME de coluna; a função e o gatilho são recriados. Idempotente.

## Testes

`supabase/tests/escala_troca_plantao_iniciado.sql` (10 testes), na homologação, em transação desfeita:

| Situação | Sem a migration | Com a migration |
|---|---|---|
| `escala_troca_plantao_iniciado` | falha no 1º ("meu plantão em curso não entra em troca — passou sem erro") | FIM ok |
| `escala_troca_plantao_passado` (B10), `escala_aceite_colega` (A4), `escala_troca_gestor` (A2), `escala_troca_forcada` (C1), `escala_passagem_conferencia` (M3), `escala_avisos_decisoes` (M5/M6), `escala_passagem_aprovada` (C2) | — | FIM ok |

Cobertos: meu plantão e o do colega em curso não entram em troca; o B10 continua para o encerrado; a
troca de dois plantões futuros vale; o plantão que começa depois do pedido não é aceito pelo colega,
que ainda recusa; o plantão que começa depois do aceite não é trocado na aprovação, e a escala não
muda; o plantão em curso continua podendo ser passado.

Rollback testado (transação desfeita): migration aplicada duas vezes sem erro, depois o B10 reaplicado
devolve a função e o gatilho idênticos aos de antes (md5 sem `\r`).

## Homologação

Aplicada pelo SQL em 31/10/2026, versão `20270208000014` registrada. Como as contas E2E, em transação
desfeita, na UPA E2E: 004 com um plantão em curso (começou há 1 h) pede a troca com um plantão futuro
de 005 → "Um dos plantões da troca já começou…"; 004 passa o mesmo plantão para 005 → pedido criado;
004 troca um plantão futuro com o de 005 → criada.

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
