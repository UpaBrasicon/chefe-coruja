# Correção do bug médio M8 — candidatura da Escala geral pela RPC (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item M8.
Ordem da sessão principal (RT fora): médios na ordem da seção 7.

## Diagnóstico

"Candidatar-se" na Escala geral do plantonista (faixa livre, sem vaga marcada) gravava direto em
`candidaturas_escala`. A RLS exige `papel_na_unidade = 'plantonista'` (quem também é gestor falhava
calado) e o caminho pulava as conferências de `candidatar_vaga`: dia que já passou, conflito de horário,
faixa já ocupada.

**Produção, só esquema (30/10/2026):** sem RPC para a candidatura sem vaga; a tela grava direto.
**O bug existe na produção.**

## Correção

- **Banco — migration `20270208000010_escala_candidatura_faixa.sql`:** RPC `candidatar_faixa(setor,
  data, faixa)`, com as conferências de `candidatar_vaga` para a faixa sem vaga: vínculo ativo de
  plantonista (gestor que também é plantonista passa), dia que não passou, sem plantão meu sobreposto,
  faixa sem plantonista escalado, sem candidatura repetida. Expand: a política de INSERT direto fica (a
  tela antiga grava por ela); fechá-la é uma migration seguinte, depois do merge. Idempotente;
  rollback testado.
- **Tela:** `Escala.tsx` (mutação `candidatar`) chama a RPC; `database.ts` com a função. O erro aparece
  na tela pelo M10 (#361).

Não muda a regra: a faixa livre continua aceitando candidatura do plantonista sem vaga marcada.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_candidatura_faixa.sql` sem a migration | **falha**: `function public.candidatar_faixa(…) does not exist` |
| Com a migration | **7 de 7** |
| `escala_pedidos_categorias` com a migration | passa |
| `tsc`, `eslint` | limpos |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000010` registrada. Como as contas E2E, em transação
desfeita: o plantonista 004 se candidata ao PS em 06/11 noite (OK); de novo → "Você já se candidatou a
esta faixa."; em 27/10 → "Este plantão já passou."; a enfermeira 002 → "A candidatura pela Escala geral
é do plantonista…" (antes: "new row violates row-level security policy").

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
