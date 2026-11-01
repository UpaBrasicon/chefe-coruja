# VD10 — Faturamento e críticas

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P2**. O RT mandou seguir até o VD12 em 01/11/2026.

## Diagnóstico

Quatro funções de faturamento contam a data pelo dia UTC ou pela idade de hoje:

| Função | O que acontecia |
|---|---|
| `public.rede_faturamento` | A APAC sem `validade_inicio` entrava na competência de `solicitada_em::date`, o dia UTC. Uma APAC pedida das 21h às 24h do último dia do mês caía na competência seguinte. |
| `private.criticas_aih` | A crítica de idade do SIGTAP usava `age(current_date, …)`. Das 21h às 24h, o dia já era o de amanhã. A crítica é avaliada na emissão do laudo e na conferência, por isso o dia certo é o de hoje em Brasília. |
| `private.apac_arquivo` | O responsável no arquivo da APAC é o próprio paciente quando ele tem 18 anos ou mais. A idade era a de hoje (`current_date`), não a do procedimento. |
| `private.criticas_lancamento_aih` | A crítica de idade de um procedimento lançado na conta usava `age(nascimento)`, a idade de hoje, e não a idade na data do procedimento. Uma conta revista semanas depois podia criticar ou deixar passar por engano. |

Os corpos das funções são iguais na homologação e na produção (md5), em 01/11/2026.

## Correção

Migration `20270209000007_faturamento_datas.sql`. Cada troca é feita na definição atual da função, lida sem o CR do fim de linha, como em `20270209000003`.

1. **`rede_faturamento`:** a competência da APAC sem início de validade passa a ser `(solicitada_em AT TIME ZONE 'America/Sao_Paulo')::date`, o dia de Brasília.
2. **`criticas_aih`:** a idade passa a ser contada no dia de Brasília, `private.data_atual()`.
3. **`apac_arquivo`:** a idade passa a ser a do início da validade da APAC, que é o procedimento. Sem início de validade, vale o dia de Brasília.
4. **`criticas_lancamento_aih`:**
   - ganha uma versão nova, com `p_data date`, a data do procedimento;
   - `conta_itens` passa a chamar essa versão com o dia de Brasília de `realizado_em`;
   - a versão antiga, de 4 argumentos, fica (expand), com a idade de hoje em Brasília;
   - nenhum papel executa a versão nova direto.

Mesma assinatura, dono e grants. A migration é idempotente: o trecho já trocado não muda. Se a função mudou e não tem mais o trecho antigo nem o novo, a migration para com erro. Sem tela.

Rollback: as mesmas trocas invertidas, na ordem inversa, começando por `conta_itens`, e depois `DROP FUNCTION private.criticas_lancamento_aih(text, integer, text, uuid, date)`.

## Testes

`supabase/tests/vd10_faturamento_datas.sql`:
1. **Idade na data do procedimento.** O teste usa um procedimento de até 11 meses e um paciente nascido em 15/01/2026:
   - em 10/12/2026 ele tem 10 meses e não recebe crítica;
   - em 20/01/2027 ele tem 12 meses e recebe a crítica de idade.
2. **As seis trocas estão nas funções.** O trecho antigo não aparece mais, e `authenticated` não executa a versão nova.

Evidência na homologação, com todas as seções:
- **Sem a migration, falha:** a crítica com a data do procedimento não existe.
- **Com a migration, passa.**
- **Rollback testado, em transação desfeita:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback, o md5 das cinco funções voltou ao de antes, e a versão nova saiu;
  - o ACL e o dono ficaram iguais.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000007` registrada. O teste passa com a migration aplicada.

## Produção

Aguarda o "ok produção" do RT.

## Riscos

- **Arquivo da APAC:** o responsável pode mudar para APACs cujo paciente fez 18 anos entre o início da validade e hoje. O responsável passa a ser o da data do procedimento, que é o certo.
- **Crítica de idade da conta:** a crítica de idade de procedimentos já lançados é recalculada pela data do procedimento. Uma conta aberta pode ganhar ou perder essa crítica.
