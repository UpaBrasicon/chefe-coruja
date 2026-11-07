# Observação que vira internação não abre a conta: diagnóstico (B P1-1)

Achado P1-1 do teste da rede (B01, `EXECUCAO-B01-B06.md`), diagnosticado em 07/11/2026. Nada foi corrigido: as decisões P1 a P3 estão no fim, à espera do RT.

## 1. O que acontece
No B01, a paciente foi da porta para a observação e da observação para a internação na UPA (`finalizar_observacao(..., 'internacao', ...)`).
- **A internação existe:** ela está `internado` e tem `internado_em` preenchido.
- **A conta de internação não existe:** o faturamento não acha conta para essa internação.
- **A AIH ficou fora:** ela foi aprovada pelo regulador (procedimento principal 0303010037, que no SIGTAP carregado vale R$ 865,91) e não entra em conta nenhuma.
- **O fechamento travou** para o faturamento.

O caminho direto `registrar_desfecho('internacao')` (porta → internação) abre a conta normalmente.

## 2. Causa
Dois gatilhos em `public.internacoes` (lidos no banco da homologação):

| Gatilho | Quando dispara | O que faz |
|---|---|---|
| `trg_internacao_tipo_na_conversao` | `BEFORE INSERT OR UPDATE OF status` | Na passagem `em_observacao` → `admitido`/`internado`, preenche `internado_em := now()` e troca o tipo para `urgencia`. |
| `trg_conta_da_internacao` (`20261127000001`) | `AFTER INSERT OR UPDATE OF internado_em` | Com `internado_em` preenchido e sem conta de internação, abre a conta (`private.abrir_conta('internacao', …)`), com origem na conta ambulatorial da porta. |

- **Por que falha:** no PostgreSQL, `UPDATE OF <coluna>` olha só as colunas **da instrução UPDATE**, não as que um gatilho BEFORE alterou. A conversão faz `UPDATE … SET status = 'internado'`, o gatilho BEFORE preenche `internado_em`, e o gatilho da conta não dispara.
- **O webhook acerta:** o gatilho de webhook da mesma tabela (`trg_webhook`) usa `UPDATE OF internado_em, status`, por isso dispara certo (`internacao.iniciada`).
- **A função da conta já é idempotente:** ela só abre a conta se ainda não existir uma para a internação.

### Alcance
- **Afetados:** todo paciente que passa da observação à internação ou à admissão, na UPA e no hospital.
- **Homologação:** 93 internações com `internado_em`, das quais **5 estão sem conta**, todas "urgência" vindas da observação. 1 delas tem AIH e 2 seguem internadas.
- **Produção:** o gatilho é o mesmo, mas **ainda não há nenhuma internação**, então nada foi afetado até agora.
- **Itens que voltam com a conta:** a AIH e os outros itens que a conta calcula na leitura entram assim que a conta existir, porque `conta_itens` busca a AIH pela internação. Os lançamentos manuais (`conta_lancamentos`) exigem a conta, então nada ficou gravado sem conta; o que falhou foi o lançamento, e ele pode ser refeito.

## 3. Decisões para o RT

### P1. Como corrigir
- **A (recomendada):** o gatilho da conta passa a disparar também na mudança de `status`, ou seja `AFTER INSERT OR UPDATE OF internado_em, status`, igual ao do webhook. A função não muda e já não abre conta repetida. É uma migration pequena, que só troca o gatilho.
- **B:** abrir a conta dentro de `finalizar_observacao`. Isso resolve só esse caminho; qualquer outra conversão por status (ADT, regulação) ficaria de fora.

### P2. Contas que já faltam
- **A (recomendada):** a mesma migration abre as contas que faltam para internações com `internado_em` e sem conta, com a data de abertura igual a `internado_em` e a origem na conta da porta. Tudo pela própria `abrir_conta`, auditado e reaplicável. Na produção não abre nada (são 0 internações). Na homologação, abre as 5.
- **B:** corrigir só daqui para frente. As 5 da homologação seriam acertadas por um script de teste.

### P3. Quando vai à produção
- **A (recomendada):** depois do CI do banco **verde** no PR e da homologação, com o seu "ok produção" (lição do #484).
- **B:** junto com o próximo lote.

## 4. Plano com A em P1 a P3
1. **Teste primeiro** (`supabase/tests/fix_conta_internacao_observacao.sql`), cobrindo:
   - porta → observação → internação abre **uma** conta de internação, com origem na conta da porta;
   - o caminho direto porta → internação continua abrindo uma só;
   - uma nova mudança de status (por exemplo, a alta) não abre segunda conta;
   - a AIH da internação aparece na conta;
   - a abertura das contas que faltam é idempotente.
2. **Migration** `<data>_conta_na_conversao.sql`: `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` com `UPDATE OF internado_em, status`, mais a abertura das contas que faltam. O rollback (o gatilho antigo) fica escrito no cabeçalho.
3. **Homologação:** aplicar, conferir que as 5 contas foram abertas e repetir o trecho do B01 (`scripts/e2e/60_cenario_b01.sql`, passos `B01.15` e `B01.29`) esperando **ok**.
4. **PR** (`correcoes/conta-internacao-observacao`), **CI verde**, depois o "ok produção", o push com conferência e o merge.
5. **Telas:** nenhuma muda. Na conferência do faturamento, a conta de internação aparece com a AIH.

**Critério de aceite:** o teste novo e o CI do banco verdes, e os passos B01.15 e B01.29 ok na homologação.

**Riscos:**
- **Conta duplicada:** a função só abre se não existir conta de internação para a internação, e o teste cobre isso.
- **Conta antiga aberta para trás:** na homologação, a conta recebe a data de `internado_em`. Se a competência dela já estiver fechada, ela aparece como pendente para o faturamento, e é exatamente o que precisa ser visto.
