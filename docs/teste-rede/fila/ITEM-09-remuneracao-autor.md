# Item 9: a remuneração de plantão grava o autor e vai à auditoria

**Achado:** C P2-C1 do teste da rede (`EXECUCAO-C01-C06.md`, C05.01).

**Decisão:** opção A em M1 e M2, recomendação aplicada. Em 08/11/2026 o RT delegou as próximas ações e ficou com o "ok produção" e o merge.

**Branch:** `correcoes/remuneracao-autor`.

## O que acontecia
- A tela cadastrava o valor da remuneração com um `insert` direto em `remuneracoes_plantao`, mandando `criado_por: null`.
- A desativação era um `update ... set ativo = false`.
- A tabela não tinha gatilho nem auditoria.
- Resultado: não ficava registrado quem incluiu, mudou ou desativou o valor que vai ao ERP de pagamento. Isso fere a regra "o autor é o login".

## Decisões
| # | Decisão | A (aplicada) | B |
|---|---|---|---|
| M1 | Autor | O servidor grava o login em `criado_por` na inclusão e ignora o que vem da tela. A coluna nova `atualizado_por` guarda quem mudou ou desativou por último, e `criado_por` não muda depois. | Exigir que a tela mande o autor. |
| M2 | Auditoria | A inclusão, a mudança (com o valor anterior) e a desativação vão a `log_auditoria`, com setor, turno e valor, sem nenhum dado de pessoa. | Auditar só a desativação. |

As linhas antigas continuam com `criado_por` nulo, porque não se inventa autor.

## Feito
- **Migration `20270308000004_remuneracao_autor_auditoria.sql`:**
  - gatilho BEFORE `trg_remuneracao_autor`, que grava o autor;
  - gatilho AFTER `trg_remuneracao_auditoria`, que registra na auditoria;
  - coluna nova `atualizado_por`;
  - o rollback está no cabeçalho.
- **Tela (`src/pages/Configuracao.tsx`):** deixa de mandar `criado_por: null`, porque quem grava o autor é o servidor.
- **Teste novo `supabase/tests/fix_remuneracao_autor_auditoria.sql`:**
  - antes da migration, falhou no autor;
  - depois, passou na homologação;
  - cobre o autor, a mudança feita por outro gestor, a desativação, o autor forjado pela tela e o plantonista sem gravar.
- **Testes de plantão do ERP:** seguem passando com a migration.
- **Reconferência na homologação (`scripts/e2e/103_reconferencia_remuneracao.sql`):**
  - o gestor da UPA F5 incluiu um valor como a tela faz;
  - o autor gravado foi o login dele;
  - ele desativou o valor;
  - a inclusão e a desativação foram para a auditoria.
  - O valor de teste (R$ 1,23, turno da noite) ficou desativado.

## Não feito (anotado)
- A tela ainda não mostra quem cadastrou cada valor.
