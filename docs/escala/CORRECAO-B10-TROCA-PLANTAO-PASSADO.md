# Correção do bug baixo B10 — troca de plantão que já passou (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item B10.
Ordem da sessão principal (RT fora): baixos depois dos médios.

## Diagnóstico

A troca do plantonista (`Escala.tsx`) listava e o banco (`solicitar_troca`) aceitava plantões que já
tinham passado, o meu e o do colega. Trocar plantão encerrado mexe no registro do que aconteceu.

**Produção, só esquema (30/10/2026):** `trocas_plantao` sem conferência de data na inserção.
**O bug existe na produção.**

## Correção

- **Banco — migration `20270208000013_escala_troca_plantao_passado.sql`:** gatilho
  `trg_troca_plantao_passado` (BEFORE INSERT em `trocas_plantao`): se um dos dois plantões já terminou,
  "Um dos plantões da troca já terminou; só se trocam plantões que ainda não terminaram." Vale para
  qualquer versão de `solicitar_troca` (inclusive a do A4). O plantão em curso continua podendo entrar
  (o "já iniciado" é decisão do RT, B12). Idempotente; rollback testado.
- **Tela (`Escala.tsx`):** as listas da troca (meu plantão, plantão do colega) mostram só os que ainda
  não terminaram. A troca dos outros papéis (`PedidosEscala.tsx`) já filtrava.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_troca_plantao_passado.sql` sem a migration | **falha**: `B10: meu plantão que já terminou não entra em troca — passou sem erro` |
| Com a migration | **3 de 3** |
| `escala_pedidos_categorias`, `escala_categoria` com a migration | passam |
| `tsc`, `eslint`, guia | limpos |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000013` registrada. Como as contas E2E, em transação
desfeita: 004 pede a troca do plantão de 27/10 (passado) → "Um dos plantões da troca já terminou…"; a
troca de 10/11 com 09/11 → criada.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
