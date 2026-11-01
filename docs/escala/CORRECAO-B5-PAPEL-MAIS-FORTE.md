# Correção do B5 — ordem do "papel mais forte" (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (baixo B5). Decisão do RT
em 31/10/2026: opção A, "Completar a lista", com teste de cada par afetado
(`docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md`).

## Problema

`private.papel_na_unidade`, usada em quase toda a RLS, ordenava admin, gestor, plantonista,
telemedicina, enfermeiro, técnico, farmacêutico e recepção. Regulador, NIR, faturamento e os papéis de
rede ficavam fora: entre dois deles, a ordem era indefinida.

## Correção

- Migration `20270208000019_papel_mais_forte.sql`: a lista ganha, depois da recepção, regulador (8),
  NIR (9), faturamento (10), secretaria (11), regulação regional (12) e faturamento da rede (13). Um
  papel que venha a existir sem estar na lista fica por último (99), e o nome desempata. A ordem dos que
  já estavam não muda. Mesma assinatura e mesmo retorno (os grants ficam); sem DROP/RENAME; idempotente.
- Quem muda: só quem tem dois dos papéis novos na mesma unidade (antes, resultado indefinido). Papel da
  lista antiga com papel novo: a lista antiga continua ganhando (antes também, porque o papel fora da
  lista ia para o fim).

## Testes

`supabase/tests/papel_mais_forte.sql` (68 verificações), na homologação, em transação desfeita:

- os 15 pares entre os papéis novos, gravando primeiro o vínculo do mais fraco: sem a migration falha
  no 1º ("regulador com nir → regulador (veio nir)"); com ela, todos certos;
- os 48 pares "papel antigo × papel novo": o antigo ganha, como antes;
- pares da lista antiga, papel único e sem vínculo: sem mudança.

Os 14 testes de banco que usam regulador, NIR, faturamento ou papéis de rede (`fase3_*`, `fase4_*`)
dependem do seed: dão o mesmo erro de chave estrangeira com e sem a migration na homologação e ficam
com o CI.

Rollback testado (transação desfeita): migration aplicada duas vezes sem erro; com o corpo de
`20260926000005` reaplicado, a função volta idêntica (md5 sem `\r`). Os privilégios da função não mudam
(`CREATE OR REPLACE`).

## Homologação

Aplicada pelo SQL em 31/10/2026, versão `20270208000019` registrada. Com a conta E2E 001, em transação
desfeita, na UPA E2E: hoje (recepção) → `recepcao`; com faturamento, NIR e regulador a mais →
`recepcao` (a lista antiga ganha); sem a recepção → `regulador`; só faturamento e NIR → `nir`.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (sem tela).
