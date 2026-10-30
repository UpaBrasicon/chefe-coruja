# Correção dos bugs altos A2 e A3 — troca com o gestor (29/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, itens A2 e A3.
Autorização: RT, "Sim, A1 a A5", repassado pela sessão principal.

## A3 — já fechado pelo C1

Quem recebe a troca reescrevia a troca por update direto (`trocas_update` sem `WITH CHECK`). A
migration `20270208000001` (C1, em produção desde 29/10) tirou INSERT/UPDATE/DELETE de
`trocas_plantao` de `authenticated` e a política `trocas_update`. Conferido de novo aqui
(`escala_troca_gestor.sql`, seção 2): o update direto de quem recebe dá `permission denied`.

## A2 — diagnóstico

- `aprovar_troca` aceitava o colega que recebe (`perfil_b`) como aprovador e aplicava a troca na
  hora, mesmo na unidade que exige aprovação (o padrão). A tela da E4 diz "a coordenação decide".
- A aba Pedidos do gestor e o aviso do calendário do mês não liam `trocas_plantao`: o gestor não via
  troca nenhuma.
- A tela "Minhas solicitações de troca" mostrava "Aprovar" a quem pediu e a quem recebe (o erro era
  ignorado).

**Produção, só esquema (29/10/2026):** `aprovar_troca` com `perfil_b_id = v_perfil OR gestor OR
super admin` (md5 `21ca0bb1…`). **O bug existe na produção.**

## Correção

**Banco — migration `20270208000005_escala_troca_gestor.sql`:** `aprovar_troca` só aplica com o
gestor da unidade (ou o super admin); o colega recebe "Só o gestor da unidade aprova a troca. O
colega pode recusar." O resto do corpo é o mesmo. `recusar_troca` não muda (o colega recusa). Na
unidade sem aprovação, `solicitar_troca` continua aplicando na hora. Idempotente; rollback no
cabeçalho, testado (devolve o corpo idêntico, md5 igual).

**Tela:**
- `usePedidosEscala.ts`: `useTrocasEscala` (trocas da unidade, com os dois plantões e os dois nomes)
  e `contarPedidos` contando as trocas pendentes.
- Aba Pedidos do gestor (`Escala.tsx`): as trocas pendentes aparecem com "Fulano · troca com
  Ciclano", os dois plantões e Aprovar/Recusar (pelas RPCs); erro visível no alto da lista.
- Calendário do mês do gestor (`EscalaMes.tsx`): o aviso de pedidos conta as trocas.
- "Minhas solicitações de troca": sai o "Aprovar"; quem pediu lê "Aguardando a coordenação"; quem
  recebe lê "A coordenação decide." e pode recusar.

Esta parte vale para as duas propostas do fluxo de aceite (A4) mandadas ao RT. Se o RT escolher a
opção A (o colega aceita antes do gestor), o aceite entra depois, junto com o A4.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_troca_gestor.sql` sem a migration | **falha**: `A2: o colega que recebe não aplica a troca — passou sem erro` |
| Com a migration | **6 de 6** (inclui A3 e a unidade sem aprovação) |
| `escala_troca_forcada.sql` (C1) | ajustado: quem não é gestor agora para em "Só o gestor…"; passa |
| `escala_pedidos_categorias`, `escala_categoria`, `fase0_rpcs` com a migration | passam |
| `tsc`, `eslint`, guia do frontend | limpos |

## Homologação

Migration aplicada pelo SQL em 29/10/2026, versão `20270208000005` registrada. Como as contas E2E,
em transação desfeita:

| Passo | Quem | Resultado |
|---|---|---|
| Escala 004 em 31/10 tarde e 005 em 31/10 manhã | Gestora E2E | OK |
| Pede a troca | Plantonista E2E (004) | OK, pendente |
| Tenta aprovar | Plantonista Dois E2E (005) | "Só o gestor da unidade aprova a troca. O colega pode recusar." |
| Lê a troca como a aba Pedidos (com os dois plantões) | Gestora E2E | 1 pendente |
| Aprova | Gestora E2E | manhã = Plantonista E2E; tarde = Plantonista Dois E2E |

## Produção

PR #353 mesclado em 29/10/2026: a tela está no ar (o colega não vê mais "Aprovar", e o gestor vê e decide as trocas). A migration `20270208000005` ainda aguarda o "ok produção" do RT. Até ela entrar, o colega ainda consegue aprovar a troca chamando a RPC direto.
