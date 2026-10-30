# Correção do bug baixo B4 — justificativa curta no check-in (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item B4.
Ordem da sessão principal (RT fora): baixos depois dos médios.

## Diagnóstico

No check-in, a justificativa vazia era aceita onde não é pedida (unidade sem coordenadas, ou dentro do
raio), mas a curta ("Trânsito", "curta") era recusada com `CHECKIN_JUSTIFICATIVA_CURTA`: escrever pouco
era pior que não escrever. A conferência das 10 letras ficava no começo de `registrar_checkin`, antes de
saber se a justificativa era necessária. Regra do RT: a localização registra mas não exige; a
justificativa de 10 letras (decisão de 26/09/2026) é pedida quando o GPS falha ou está fora do raio.

**Produção, só esquema (30/10/2026):** a conferência vem antes de `CHECKIN_SEM_LOCALIZACAO`.
**O bug existe na produção.**

## Correção — migration `20270208000012_checkin_justificativa_curta.sql`

A conferência das 10 letras sai do começo e vai para os dois pontos em que a justificativa libera o
check-in (sem localização; fora do raio). Corpo de `20261014000001`; só isso muda. Mesma assinatura.
Sem tela (o formulário já pede 10 letras quando oferece a justificativa). Rollback (reaplicar o corpo
antigo) **testado**: corpo e ACL voltam iguais.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/checkin_justificativa_curta.sql` sem a migration | **falha**: `CHECKIN_JUSTIFICATIVA_CURTA` na unidade sem coordenadas |
| Com a migration | **4 de 4** (fora do raio, a curta continua recusada; sem localização e sem justificativa continua recusado) |
| `checkin_tolerancia`, `pos_plantao_tolerancia` com a migration | passam |
| `fase1_checkin_raio` | depende do seed local (falha igual sem a migration na homologação); fica com o CI |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000012` registrada. A UPA E2E não tem coordenadas; a
enfermeira E2E, escalada agora, faz check-in sem GPS com "Trânsito" → aceito (antes: recusado).

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (sem tela).
