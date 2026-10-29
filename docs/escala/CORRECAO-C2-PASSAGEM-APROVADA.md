# Correção do bug crítico C2 — passagem aprovada não move o plantão (29/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (PR #347), item C2.
Autorização: o RT mandou corrigir agora os dois críticos (C1 e C2), como exceção de bug crítico em
produção prevista no `CLAUDE.md`. Os altos (A1–A5) ficam para depois; o A4 ("assumir" de quem
recebe) não entra aqui.

## 1. Diagnóstico

O gestor clicava "Aprovar" na passagem e o plantão não mudava de dono. A tela
(`Escala.tsx`, mutação `decidir`) só grava `status = 'aprovado'` em `solicitacoes_escala`, e não havia
RPC nem gatilho de UPDATE que aplicasse a passagem (só `trg_passagem_mesma_categoria`, no INSERT, e
o `updated_at`). Agravante: quem passou lia "Plantão passado com sucesso." sempre, porque
`passar_plantao` devolve um uuid nos dois casos (o do plantão quando passa na hora, o do pedido quando
espera o gestor). Risco: o plantonista falta achando que passou e o setor fica descoberto.

**Produção (`saqjrjtrkzkswsxxvdxn`), conferida em 29/10/2026, só esquema** (gatilhos, políticas,
corpo de `passar_plantao`; nenhum dado lido): em `solicitacoes_escala` só os gatilhos
`trg_passagem_mesma_categoria` (INSERT) e `trg_solicitacoes_escala_updated_at`; a política
`solic_escala_update` deixa o gestor gravar o status; `passar_plantao` igual à homologação.
**O bug existe na produção.**

## 2. Por que gatilho, e não fechar o update

A migration vai à produção antes do merge (o merge publica a tela na hora). Se a correção fosse só
uma RPC nova com o UPDATE direto fechado, a tela de hoje deixaria de aprovar pedidos nesse intervalo.
O gatilho aplica a passagem quando o pedido passa de pendente para aprovado, **venha a aprovação de
onde vier**: a tela de hoje passa a funcionar no instante em que a migration entra, sem depender do
merge. Nada de acesso é fechado. Levar a decisão inteira para uma RPC (com histórico de quem decide,
2FA e aviso) é o M6/M9/M5 do relatório, para depois.

## 3. Banco — migration `20270208000002_escala_passagem_aprovada.sql`

Gatilho `trg_passagem_aprovada` (BEFORE UPDATE OF status em `solicitacoes_escala`, só
`tipo = 'passar_plantao'`, `pendente → aprovado`) chama `private.passagem_aprovada()`, que confere:

- o plantão ainda está ativo e é de quem pediu ("A passagem não confere com a escala: o plantão não é
  mais de quem pediu. Recuse o pedido.");
- o destino tem vínculo ativo na unidade;
- o destino não tem plantão no mesmo setor e horário ("Conflito de horário: …").

Depois muda o dono do plantão; a categoria e a sobreposição em outro setor são conferidas pelos
gatilhos de `escala_plantao` já existentes. A passagem aplicada vai para `historico_escala`
(`passagem_aplicada`, com quem passou, quem recebeu e quem decidiu). Se algo falha, a aprovação
inteira volta: o pedido continua pendente.

Expand: só cria função e gatilho. Idempotente (aplicada duas vezes seguidas na homologação, em
transação desfeita, sem erro). Rollback no cabeçalho: `DROP TRIGGER` + `DROP FUNCTION`.

## 4. Tela — `src/pages/Escala.tsx`

- Mensagem de quem passa: "Plantão passado com sucesso." só quando `passar_plantao` devolve o id do
  próprio plantão (passou na hora); senão "Passagem pedida. O plantão continua com você até o gestor
  aprovar." (a tela da E4, `PedidosEscala.tsx`, já comparava assim).
- Aba Pedidos do gestor: o erro da aprovação aparece no alto da lista (antes o clique não fazia nada;
  agora, com as conferências, o gestor precisa ler o motivo).

## 5. Testes

`supabase/tests/escala_passagem_aprovada.sql` (8 testes). Rodado na homologação dentro de transação
desfeita (o Docker local não subiu nesta máquina; o CI roda a suíte inteira num Supabase limpo):

| Rodada | Resultado |
|---|---|
| Sem a migration | **falha**: `FALHOU: C2: aprovada a passagem, o plantão passa para o destino` |
| Com a migration | **8 de 8** |
| Suíte da escala com a migration (`escala_categoria`, `escala_da_unidade`, `escala_gestor_categorias`, `escala_pedidos_categorias`, `checkin_tolerancia`, `fase0_rpcs`, `fase5c_erp_plantoes`, `porte_correcoes_nomes`, `porte_correcoes_pentest`) | todos passam |
| `fase1_escala_por_setor` e os outros que dependem do seed local | não rodam na homologação nem sem a migration (mesmo erro); ficam com o CI |
| Rollback | migration + rollback devolvem os mesmos gatilhos e nenhuma função nova |

`tsc` e `eslint` do `Escala.tsx` limpos.

## 6. Homologação (`kswurfyxxvfydpjfrivy`)

Migration aplicada pelo SQL em 29/10/2026 e versão `20270208000002` registrada. Fluxo do relatório
repetido como as contas E2E (UPA E2E 24h, Pronto Socorro), cada passo como o próprio usuário, em
transação desfeita:

| Passo | Quem | Resultado |
|---|---|---|
| Escala 004 no PS em 30/10 manhã | Gestora E2E | OK |
| Passa o plantão para 005 | Plantonista E2E (004) | pedido criado; `passar_plantao` devolve o id do pedido (a tela agora diz "Passagem pedida…") |
| Dono antes de aprovar | — | Plantonista E2E |
| Tenta aprovar por update | Plantonista Dois E2E (005) | 0 linhas (só o gestor decide) |
| Aprova como a tela faz (`status = 'aprovado'`) | Gestora E2E | aprovado |
| Dono depois de aprovar | — | **Plantonista Dois E2E** |
| Histórico do plantão | — | `criar`, `passagem_solicitada`, `alterar`, `passagem_aplicada` |

A tela da homologação fica atrás do login do Vercel e a senha das contas E2E não está no repositório.

## 7. Riscos

- Pedido aprovado antes desta correção ficou "aprovado" sem mover o plantão; o gatilho não age sobre
  ele (só pendente → aprovado). Na produção não há escala real em uso (memória da E0); conferir só se o
  RT pedir.
- Pedido pendente cujo plantão mudou de dono: a aprovação dá erro claro; o gestor recusa.

## 8. Produção

Nada aplicado. Ordem: "ok produção" do RT → migration na produção pelo SQL, versão registrada →
merge do PR (o merge publica a tela pela Vercel).
