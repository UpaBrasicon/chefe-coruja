# Correção do M9 — gestor aprova o próprio pedido com 2º fator (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (médio M9). Decisão do RT
em 31/10/2026: opção A, "Pode, com 2º fator" (`docs/escala/PROPOSTAS-MEDIOS-M2-M7-M9.md`).

## Problema

O gestor que também está escalado aprovava a própria passagem ou troca sem 2º fator e sem registro
próprio.

## Correção

- Migration `20270208000018_escala_aprovacao_propria.sql`:
  - passagem: gatilho novo `trg_passagem_propria` (BEFORE UPDATE OF status, pendente → aprovado),
    ao lado do `trg_passagem_aprovada` do C2. Se quem aprova é parte do pedido (quem passa ou quem
    recebe), exige o 2º fator (`private.exigir_segundo_fator`, como `aprovar_candidatura`) e grava
    `aprovou_proprio_pedido` no histórico da escala e na auditoria;
  - troca: `aprovar_troca` (corpo do A4) faz o mesmo quando quem aprova é um dos dois lados, com o
    registro nos dois plantões e na auditoria;
  - o pedido dos outros continua como antes. Expand: função e gatilho novos e corpo novo de
    `aprovar_troca` (mesma assinatura); sem DROP/RENAME; idempotente.
- Tela (`Escala.tsx`, aba Pedidos do gestor): o pedido de passagem ou troca do próprio gestor diz
  "pedido seu: aprovar pede o 2º fator e fica registrado". Sem o 2º fator, o servidor recusa com
  `SEGUNDO_FATOR`, e a casca reabre o portão do 2º fator (`seSegundoFatorVenceu`, `App.tsx`).
- `usePedidosEscala.ts`: a troca traz `perfil_a_id` e `perfil_b_id`.

**Atenção:** o 2º fator segue a chave da plataforma `exigir_segundo_fator`, como em
`aprovar_candidatura`. Com a chave desligada (é o caso da homologação), a conferência não barra; o
registro "aprovou o próprio pedido" vale sempre.

## Testes

- `supabase/tests/escala_aprovacao_propria.sql` (7 testes, com a chave ligada na transação), na
  homologação em transação desfeita: falha sem a migration ("o gestor não aprova a própria passagem
  sem o 2º fator — passou sem erro") e passa com ela. Com a migration passam também A4, A2, C2 e C1.
  `fase1_segundo_fator` depende do seed (falha igual sem a migration) e fica com o CI;
  `escala_avisos_decisoes` falha na homologação só porque ela já tem o M2 (#380), e passa no CI.
- Rollback testado (transação desfeita): migration aplicada duas vezes sem erro; depois do rollback o
  gatilho sai e `aprovar_troca` volta idêntica à do A4 (md5 sem `\r`). Grants: `aprovar_troca` com
  execute para `authenticated`, não para `anon`.
- `tsc`, `eslint`, o guia do frontend e `migrations-destrutivas` passam.

## Homologação

Aplicada pelo SQL em 31/10/2026, versão `20270208000018` registrada. Como as contas E2E, em transação
desfeita, com a chave do 2º fator ligada e 009 (gestora) temporariamente plantonista: 009 passa um
plantão dela para 005, que aceita; 009 aprova sem 2º fator (aal1) → "SEGUNDO_FATOR: confirme o código
do autenticador para continuar."; com o 2º fator (aal2) → o plantão vai para 005, o histórico diz "O
gestor aprovou a própria passagem (com 2º fator)" e a auditoria tem 1 registro.

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Produção

Migration `20270208000018` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT, pela sessão principal; versão registrada e grants conferidos com a homologação. PR #384 mesclado em 01/11/2026 (publica a tela). Concluído.
