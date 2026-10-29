# Correção do bug crítico C1 — troca forçada (29/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (PR #347), item C1.
Autorização: o RT mandou corrigir agora os dois críticos (C1 e C2), como exceção de bug crítico em
produção prevista no `CLAUDE.md`. Os altos (A1–A5) ficam para depois.

## 1. Diagnóstico

Qualquer escalado trocava o plantão de um colega sem o colega e sem o gestor:

1. gravava a troca direto em `trocas_plantao` (PostgREST, sem `solicitar_troca`), com o plantão do
   colega como A e ele mesmo como B. A política `trocas_insert` só conferia `perfil_a_id = eu`;
2. aprovava com `aprovar_troca`, que aceita o aprovador quando ele é o `perfil_b_id` gravado;
3. `private.aplicar_troca` trocava os **donos reais** dos dois plantões, sem conferir os donos gravados.

A política `trocas_update` (sem `WITH CHECK`) também deixava quem recebe reescrever a troca (outro
plantão, outro dono, status) e chegar ao mesmo resultado (é o A3 do relatório, pelo mesmo caminho).

**Produção (`saqjrjtrkzkswsxxvdxn`), conferida em 29/10/2026, só esquema** (políticas, grants e corpo
das funções; nenhum dado lido): `trocas_insert` = `WITH CHECK (perfil_a_id = meu_perfil_id())`;
`trocas_update` = `USING (perfil_b_id = eu OR gestor OR super admin)`, sem `WITH CHECK`; `authenticated`
com INSERT, UPDATE e DELETE em `trocas_plantao`; `aprovar_troca` aceita `perfil_b`; `aplicar_troca`
sem conferência de dono. Corpos iguais aos da homologação (md5 sem `\r`). **O bug existe na produção.**

## 2. O que a tela usa

A tela não grava em `trocas_plantao`: só lê (`Escala.tsx`, "Minhas solicitações de troca";
`usePedidosDaEquipe.ts`) e chama as RPCs `solicitar_troca`, `aprovar_troca` e `recusar_troca`
(`Escala.tsx`, `PedidosEscala.tsx`), todas `SECURITY DEFINER`. O Hermes só lê (`hermes_job`).
Fechar a escrita direta não muda nenhuma tela.

## 3. Banco — migration `20270208000001_escala_troca_forcada.sql`

1. `REVOKE INSERT, UPDATE, DELETE ON trocas_plantao FROM anon, authenticated`; saem as políticas
   `trocas_insert` e `trocas_update`. A leitura (`trocas_select`) fica como está.
2. `private.aplicar_troca` confere, antes de trocar, que o dono de agora de cada plantão é o gravado
   na troca e que são duas pessoas. Senão: "A troca não confere com a escala: um dos plantões não é
   mais de quem está na troca. Peça a troca de novo." Pega a troca forjada já gravada e o plantão que
   mudou de dono depois do pedido.

Expand/contract: sem DROP/RENAME de coluna, sem troca de tipo; idempotente (`DROP POLICY IF EXISTS`,
`CREATE OR REPLACE`). Rollback escrito no cabeçalho da migration.

Não muda (fica para A2, decisão do RT): quem recebe a troca continua podendo aprová-la por
`aprovar_troca` — agora só quando a troca nasceu pela RPC, com os donos certos.

## 4. Testes

`supabase/tests/escala_troca_forcada.sql` (11 testes). Rodado na homologação dentro de transação
desfeita (o Docker local não subiu nesta máquina; o CI roda a suíte inteira num Supabase limpo):

| Rodada | Resultado |
|---|---|
| Sem a migration | **falha** no 1º teste: `FALHOU: C1: o escalado não grava a troca forçada direto na tabela — passou sem erro` |
| Com a migration | **11 de 11** |
| Suíte da escala com a migration (`escala_categoria`, `escala_gestor_categorias`, `escala_pedidos_categorias`, `fase0_rpcs`, `fase5c_erp_plantoes`, `porte_correcoes_nomes`, `porte_correcoes_pentest`, `fase5c_webhooks`, `fase5c_rnds_cofre`) | todos passam |
| Testes que dependem do seed local (`porte_redteam_v3_v4`, `portao2_escala_sobreposicao`, `porte_limites_chamados_fracionar` e outros) | não rodam na homologação nem sem a migration (mesmo erro de chave estrangeira do seed); ficam com o CI |
| CI, 1ª rodada | `portao2_escala_sobreposicao` falhou: chamava `private.aplicar_troca` com uma troca sem `perfil_a_id`/`perfil_b_id` e a 1ª versão da migration tirava o EXECUTE da função. Corrigido: a migration não mexe mais no ACL da função, e o teste passa os donos de agora (a troca sem donos agora é recusada, como deve) |

**Rollback testado** na homologação (transação desfeita): migration + rollback devolvem as mesmas
políticas, os mesmos grants e o mesmo corpo de `aplicar_troca`.

## 5. Homologação (`kswurfyxxvfydpjfrivy`)

Migration aplicada pelo SQL em 29/10/2026 e versão `20270208000001` registrada em
`supabase_migrations.schema_migrations`. Conferido: políticas `hermes_job_select` e `trocas_select`;
`authenticated` só com SELECT; `aplicar_troca` com a conferência. A 1ª versão aplicada tirava o
EXECUTE de `aplicar_troca`; devolvido na homologação com `GRANT EXECUTE … TO PUBLIC` (mesmo efeito do
ACL padrão), para bater com a migration final.

Fluxo do relatório repetido como as contas E2E (UPA E2E 24h, Pronto Socorro), cada passo como o
próprio usuário (JWT simulado, RLS valendo), em transação desfeita:

| Passo | Quem | Resultado |
|---|---|---|
| Escala 005 em 03/11 manhã e 004 em 02/11 noite | Gestora E2E | OK |
| Grava a troca forçada direto (plantão de 005 como A, ele mesmo como B) | Plantonista E2E (004) | `permission denied for table trocas_plantao` |
| Pede a troca pela RPC (caminho da tela) | 004 | OK, pendente |
| Reescreve a troca por update direto (`status = 'aprovado'`) | Plantonista Dois E2E (005) | `permission denied for table trocas_plantao` |
| Aprova a própria troca | 004 | `Acesso negado` |
| Aprova pela RPC | Gestora E2E | OK: 02/11 noite = Plantonista Dois E2E; 03/11 manhã = Plantonista E2E |

A tela da homologação fica atrás do login do Vercel e a senha das contas E2E não está no repositório;
a correção não muda tela.

## 6. Riscos

- Troca já gravada fora da RPC (forjada) e ainda pendente: deixa de se aplicar (erro claro). Esperado.
- Pedido feito antes de o plantão mudar de dono: deixa de se aplicar; a pessoa pede de novo.

## 7. Produção

Nada aplicado. Ordem: "ok produção" do RT → migration na produção pelo SQL, versão registrada →
merge do PR (o merge não muda tela; a ordem vale por regra).
