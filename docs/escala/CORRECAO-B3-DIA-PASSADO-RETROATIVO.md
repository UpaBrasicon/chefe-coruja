# Correção do B3 — escalar em dia que já passou (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (baixo B3). Decisão do
RT em 31/10/2026: opção A, "Aceita como retroativo" (`docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md`).

## Problema

`adicionar_plantao_escala` aceitava dia que já passou sem marcar nada (gravado 28/10 noite às 04 h de
29/10). A RPC já era só do gestor (e do super admin).

## Correção

- Migration `20270208000015_escala_dia_passado_retroativo.sql`: o corpo de
  `adicionar_plantao_escala` é o de `20270202000003` com um bloco a mais. Quando o plantão gravado já
  começou, o histórico da escala ganha a ação `retroativo` ("Acerto retroativo: plantão escalado
  depois de começar", com data, turno, profissional e categoria), com o gestor como autor. Continua só
  para o gestor e o super admin. Mesma assinatura e mesmo retorno; sem DROP/RENAME; idempotente.
- Tela: nas duas janelas de escalar (mês do gestor, `EscalaMes.tsx`, e grade semanal, `Escala.tsx`),
  o plantão que já começou mostra "Este plantão já começou: fica como acerto retroativo no histórico
  da escala." antes de confirmar (`ehRetroativo`, `src/lib/retroativo.ts`, com o mesmo horário de
  `private.inicio_do_turno`).

## Testes

- `supabase/tests/escala_dia_passado_retroativo.sql` (5 testes), na homologação, em transação desfeita:
  falha sem a migration ("o histórico marca o plantão de dia passado como retroativo") e passa com ela.
  `escala_gestor_categorias` e `escala_categoria` passam com a migration.
- `src/lib/retroativo.test.ts` (2 de 2).
- Rollback testado (transação desfeita): migration aplicada duas vezes sem erro, depois o corpo de
  `20270202000003` reaplicado devolve a função idêntica (md5 sem `\r`).

## Homologação

Aplicada pelo SQL em 31/10/2026, versão `20270208000015` registrada. Como as contas E2E, em transação
desfeita, na UPA E2E: 004 (plantonista) tenta escalar em 29/10 → "Acesso negado: apenas o gestor pode
montar a escala."; 009 (gestora) escala 004 em 29/10 manhã → criado, e o histórico que a gestora vê
traz `criar` e `retroativo (Acerto retroativo: plantão escalado depois de começar)`.

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
