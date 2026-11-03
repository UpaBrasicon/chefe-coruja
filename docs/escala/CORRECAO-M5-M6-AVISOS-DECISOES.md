# Correção dos bugs médios M5 e M6 — avisos e auditoria das decisões (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, itens M5 e M6.
Ordem da sessão principal (RT fora): médios na ordem da seção 7. Mesmo código, um PR.

## Diagnóstico

- **M5:** nenhum aviso das decisões do gestor: candidatura aprovada ou recusada, falta e saída do
  fixo decididas. As telas prometem o aviso ("você recebe o aviso", `PedidosEscala.tsx`,
  `EscalaEquipe.tsx`, `EscalaMes.tsx`). Só a vaga aberta avisava.
- **M6:** essas decisões não iam para `historico_escala` nem para `log_auditoria` (eram feitas por
  update direto, fora de RPC). A passagem e a troca ficam com o C2 e o A4.

**Produção, só esquema (30/10/2026):** `candidaturas_escala` só com o gatilho de `updated_at`;
`solicitacoes_escala` sem gatilho de decisão para falta e saída do fixo; `aprovar_candidatura` sem
aviso nem histórico. **O bug existe na produção.**

## Correção — migration `20270208000008_escala_avisos_decisoes.sql`

Gatilhos `AFTER UPDATE OF status`, que valem pela RPC (`aprovar_candidatura`, inclusive as outras
candidaturas da vaga recusadas por ela) e pelo update direto da tela do gestor:

- `trg_candidatura_decidida` (candidaturas): aviso "Candidatura aprovada: o plantão de … é seu." /
  "Candidatura recusada: …"; histórico `candidatura_aprovada`/`candidatura_recusada`; auditoria.
- `trg_solicitacao_decidida` (falta e saída do fixo): aviso "A justificativa de falta do plantão de …
  foi aprovada pela coordenação."; histórico `falta_aprovada`/`falta_recusada`/`sair_fixo_*`; auditoria.

A auditoria usa `private.registrar_auditoria` (payload só estrutural, pela lista de campos
permitidos). Nada muda no que a decisão faz (isso é o M2, que espera o RT). `private.avisar` igual à da
`20270208000006` (A4), para cada migration valer sozinha. Sem tela. Idempotente; rollback no
cabeçalho, **testado** (gatilhos voltam iguais).

Fica de fora: o histórico "alterar" sem texto do gatilho genérico de `escala_plantao` (a troca já
grava `troca_aprovada` com o id).

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_avisos_decisoes.sql` sem a migration | **falha**: `M5: a candidatura aprovada avisa o candidato` |
| Com a migration | **9 de 9** |
| `escala_pedidos_categorias`, `escala_gestor_categorias`, `escala_categoria`, `fase5c_erp_plantoes` com a migration | passam |
| `escala_passagem_aprovada` na homologação | falha só lá: a homologação já tem o aceite do A4 aplicado e a versão do master deste teste não aceita antes (no CI, sem o A4, passa) |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000008` registrada. Como as contas E2E, em transação
desfeita: a gestora abre vaga de enfermeiro; a enfermeira 002 se candidata; a gestora aprova → sino da
enfermeira: "Candidatura aprovada: o plantão de Pronto Socorro em 03/11 (noite) é seu."; a enfermeira
justifica falta nesse plantão e a gestora aprova como a tela faz → "A justificativa de falta do plantão
de Pronto Socorro em 03/11 (noite) foi aprovada pela coordenação."; histórico `candidatura_aprovada`,
`falta_aprovada`; auditoria `candidatura_aprovada`, `justificar_falta_aprovado`.

## Produção

Migration `20270208000008` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 30/10/2026, com o "ok produção" do RT, pela sessão principal; versão registrada e conferida (gatilhos e grants: RPCs com execute para `authenticated`, não para `anon`). PR #359 mesclado em 30/10/2026, com o arquivo da migration idêntico ao aplicado. Concluído.
