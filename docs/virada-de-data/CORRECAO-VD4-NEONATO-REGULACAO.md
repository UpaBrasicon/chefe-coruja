# VD4 — Neonato no pedido de regulação pelo dia UTC

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P0 clínico**, por decisão do RT em 01/11/2026 ("Registra, clínicos P0" e "Sim, VD4").

## Diagnóstico

`public.regulacao_solicitar` decide se o paciente é recém-nascido com:

```sql
v_neonato := pa.data_nascimento IS NOT NULL AND pa.data_nascimento > current_date - 28;
```

Se for recém-nascido, a transferência exige que se informe a incubadora (Portaria 2.048/2002).

O banco roda em UTC: das 21h às 24h de Brasília, `current_date` já é amanhã. Nessa janela, um RN de 27 dias passava por não neonato, e o pedido seguia sem a pergunta da incubadora. É o único `current_date` da função, conferido na produção.

O corpo atual da função vem de `20261117000002_nir.sql`, com a troca feita depois por `20261124000001_rn_vinculado_mae.sql` (marca de não identificado). O corpo é igual na homologação e na produção, com o mesmo md5, em 01/11/2026.

## Correção

Migration `20270209000003_neonato_regulacao_data.sql`:
- troca só o trecho, `current_date - 28` por `private.data_atual() - 28`;
- faz a troca na definição atual, no mesmo padrão de `20261124000001`, procurando o trecho sem `\r`;
- é idempotente: se o trecho já foi trocado, não faz nada; se o trecho antigo sumiu, para com erro;
- mantém a mesma assinatura e os mesmos grants, e não mexe em tela.

O corte de 28 dias (do dia 0 ao dia 27) não muda.

Rollback: o mesmo bloco com os trechos invertidos.

## Testes

`supabase/tests/fase4_regulacao_solicitacao.sql`, seção 5 nova, com o relógio da unidade fixado em 28/01/2000 só na transação:
- o RN nascido em 01/01/2000 tem 27 dias no dia da unidade;
- a transferência sem incubadora é recusada com "Recém-nascido: informe se a transferência precisa de incubadora";
- `regulacao_solicitar` não usa `current_date`.

Evidência:

- **Sem a migration, o teste falha no CI.** Commit `fa9ce6e1`, só com o teste: "FALHOU: RN de 27 dias no dia da unidade pede incubadora — passou sem erro".
- **Com a migration, passa.**
- **Rollback testado na homologação**, em transação desfeita:
  - a migration aplicada duas vezes não deu erro;
  - o md5 mudou;
  - depois do rollback o md5 voltou idêntico ao de antes (`c8e7976c…`);
  - o ACL ficou igual (`authenticated` e `service_role` executam; `anon` não).
- O teste de regulação usa o seed do CI, que a homologação não tem. Ali rodam só a migration e o rollback.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000003` registrada. Conferido:
- o trecho novo está na função e nenhum `current_date` sobrou;
- a troca do RN vinculado à mãe (`paciente_tem_documento`) foi mantida;
- o ACL ficou igual;
- md5 `a7a35cd1…`, igual ao do teste de rollback.

## Produção

Migration `20270209000003` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar:
- versão registrada;
- trecho novo presente e nenhum `current_date` restante;
- troca do RN vinculado à mãe mantida;
- ACL igual;
- md5 `a7a35cd1…`, igual ao da homologação.

PR #395 mesclado em seguida. Concluído.

## Riscos

- Nenhuma mudança fora da janela das 21h às 24h.
- Se uma migration futura reescrever o trecho, esta para com erro em vez de aplicar em silêncio.
