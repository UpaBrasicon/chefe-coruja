# Correção do B11 — o portão do check-in abre só a aba Escala (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (baixo B11). Decisão do
RT em 31/10/2026: opção A, "Libera só a aba Escala" (`docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md`).

## Problema

Quem passava da tolerância do check-in via só o portão (fazer o check-in ou sair). A aba Escala não
abria, e a falta do plantão não podia ser justificada.

## Correção (só tela, sem migration)

- `src/components/GateCheckIn.tsx`: com a porta fechada, o portão ganha "Ver minha escala (justificar
  falta)". Abre só a escala (`EscalaEquipe`, a mesma do "Fora do seu horário"), com "Voltar ao
  check-in" e o aviso "Só a escala abre até o check-in…". Nenhuma rota, menu ou tela clínica abre; o
  resto da casca continua atrás do portão.
- O banco já deixava: a escala e a justificativa de falta não dependem do portão, e o clínico segue
  fechado pelo servidor (`private.plantoes_agora`).

## Testes

- `supabase/tests/escala_portao_checkin.sql` (4 testes, guarda, sem migration), na homologação em
  transação desfeita: com o portão fechado, o paciente do setor continua fora; a escala da unidade
  abre (o meu plantão e o da equipe); a falta do plantão é justificada. FIM ok.
- `tsc`, `eslint` e o guia do frontend passam.

## Homologação

Tela publicada na homologação. Como a conta E2E 002 (enfermeira), em transação desfeita, na UPA E2E,
com um plantão que começou há 1 h e sem check-in: `situacao_checkin` → bloqueado; pacientes visíveis
→ 0; `escala_da_unidade` traz o plantão; justificativa de falta → enviada.

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Produção

Sem migration. PR #379 mesclado em 31/10/2026 (publica a tela). Concluído.
