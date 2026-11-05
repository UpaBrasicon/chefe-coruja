# 5B: as pendências do faturamento

A 5B foi encerrada pelo RT em 17/10/2026 (`produto/docs/fase5/ENCERRAMENTO-5B.md`). O RT pediu as pendências em 05/11/2026 ("Pendências da 5B").

Este documento é o diagnóstico. **Decisões do RT em 05/11/2026: A em L1 a L5** ("Sim, todas A").

## 1. Estado de cada pendência (conferido no código em 05/11/2026)

| # | Pendência | Estado hoje |
|---|---|---|
| 1 | **Defeito latente** em `conta_medicamentos_fora` (5B-3) | Continua aberto. O usuário logado ainda tem leitura direta da tabela (`GRANT SELECT`). A política chama `private.pode_ver_contas`, que o usuário não pode executar, então a leitura direta daria erro. O app só usa as funções, por isso nada quebra hoje. As tabelas das glosas já nasceram sem leitura direta. |
| 2 | **Tela de AIH para o faturamento** (5B-4) | A rota `/aih` abre só para o regulador e o gestor. A conta da internação já mostra as AIHs (número, situação, competência), como pedia a decisão 3a. |
| 3 | **Homologação sem configuração de faturamento** | A UPA da homologação não tem CNES nem os códigos do BPA. Por isso toda conta aparece com pendência bloqueante, e o teste do fechamento só passa com a liberação do gestor. |
| 4 | **Materiais** (5B-3, decisão "3-i") | Não existem. Os medicamentos entram na conta pela dispensação, sem valor (só o consumo). |
| 5 | **Importar o retorno do SIA/SIH** (5B-6) | A glosa é registrada à mão a partir do relatório de rejeição. |
| 6 | **TISS/TUSS** (5B-7) | Adiada até haver cliente de convênio. Nada a decidir agora. |

## 2. O retorno do SIA/SIH na fonte

Busca feita em 05/11/2026. Não há layout público oficial dos arquivos de retorno.

- **SIH:** o hospital exporta a produção do SISAIH01, e a secretaria a processa no SIHD.
  - As AIHs rejeitadas voltam do DATASUS em três arquivos: RJ (as AIHs rejeitadas), ER (o motivo de cada rejeição) e RD (os dados de origem). Fonte: POP da Ebserh sobre o SIHD2.
  - A reapresentação vale por até 6 meses, contados do mês da alta (Portaria SAES/MS nº 1.110/2021).
- **SIA:** o prestador recebe da secretaria a síntese mensal e o relatório de glosas e advertências do BPA. Não há arquivo padrão de retorno.

Conclusão: para importar, é preciso um arquivo real, com o layout, vindo da secretaria de saúde do município. Montar o formato de memória não vale.

## 3. Decisões do RT

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| L1 | Defeito de `conta_medicamentos_fora` | **A)** Tirar a leitura direta da tabela, como nas glosas; o app continua pelas funções. **B)** Corrigir a política para a leitura direta funcionar | **A.** Menos acesso e o mesmo padrão das glosas. Uma migration pequena, com o seu ok de produção |
| L2 | O faturamento vê a tela de AIH? | **A)** Não: a conta da internação já mostra o que o faturamento precisa. **B)** Sim, só para consulta | **A.** Menor acesso. A decisão 3a já está atendida pela conta |
| L3 | Configuração de faturamento na homologação | **A)** Cadastrar CNES e códigos do BPA de teste na UPA da homologação, para o fechamento ser testado sem a liberação do gestor. **B)** Manter como está | **A.** Só dados de teste na homologação; nada vai à produção |
| L4 | Materiais | **A)** Cadastro simples da unidade (nome, unidade de consumo e código SIGTAP do grupo 07, opcional) e lançamento à mão na conta pelo faturamento, sem valor e sem estoque, como os medicamentos. **B)** Com estoque, como a farmácia. **C)** Continua adiado até um cliente pedir | **A.** Fecha a pendência com o mínimo. O estoque de materiais fica para quando houver almoxarifado |
| L5 | Retorno do SIA/SIH | **A)** Pedir à secretaria de saúde um arquivo de retorno real, com o layout, e só então implementar a importação. **B)** Continuar à mão | **A.** Enquanto o arquivo não chega, a glosa continua à mão, como hoje |

## 4. Ordem, se as decisões forem A

1. **L1:** a migration da leitura direta, com homologação, rollback e ok de produção.
2. **L3:** os dados de teste na homologação e o teste do fechamento sem a liberação.
3. **L4:** materiais.
   - **Banco:** o cadastro, o lançamento na conta e a pré-auditoria.
   - **Telas:** com opções do Refero para o RT escolher.
4. **L5:** a importação, quando o arquivo da secretaria chegar.

L2 não gera trabalho se for A.

## 5. Andamento

- **L3, feita em 05/11/2026 na homologação:**
  - O CNES já estava preenchido; o que travava eram os códigos SIGTAP das fontes da unidade e o CBO e o CNS do profissional.
  - O arquivo `supabase/homolog/faturamento-teste.sql` cadastra os três códigos, escolhidos na tabela SIGTAP carregada: 03.01.06.009-6, 03.01.06.011-8 e 03.01.10.001-2.
  - O mesmo arquivo grava o CBO 225125 e um CNS de teste na conta "Teste Homologação".
  - Resultado: 19 contas da UPA Homologação ficaram sem pendência bloqueante.
  - Evidência numa transação desfeita, como o faturamento: a conta limpa passou de aberta para em conferência e fechou sem a liberação do gestor. A conta com raça/cor e sexo ausentes continuou barrada.
  - A medicação continua com a pendência "CBO de enfermagem", porque a conta de teste tem um só CBO. Raça/cor e sexo ausentes são pendências reais do cadastro.
