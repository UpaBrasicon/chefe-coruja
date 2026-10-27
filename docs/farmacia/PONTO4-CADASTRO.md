# Ponto 4 — cadastro de medicamentos pela farmácia

Pedido do RT em 27/10/2026 ("Unidade de consumo não tem como adicionar itens novos com apresentação e
forma"), aprovado no mesmo dia como o segundo dos seis pontos (`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`,
PR #262).

**Decisões do RT em 27/10/2026:**

- o item novo vale primeiro **só na unidade** de quem cadastrou. Outra unidade passa a usá-lo quando
  o farmacêutico ou o gestor dela escolhe "Usar nesta unidade", ou quando o super admin o leva para a
  rede;
- a forma farmacêutica vira **campo próprio**, com lista fixa e a opção "outra", obrigatória no item
  novo. Os itens que já existem ficam em branco para a farmácia preencher.

## O que mudou

### Banco

Migration `supabase/migrations/20270106000001_cadastro_medicamentos.sql`, só aditiva.

- **Colunas novas em `medicamento`:**
  - `forma_farmaceutica` e `forma_farmaceutica_outra`;
  - `unidades_locais`: `NULL` é item da rede, como todos os itens de hoje; preenchida, lista as
    unidades que usam o item;
  - `cadastrado_na_unidade`, `cadastrado_por` e `cadastrado_em`.
- **A leitura da tabela continua aberta.** Alergias e prescrições antigas apontam para o item, e
  esconder a linha apagaria o nome em outra unidade. Quem filtra por unidade é a busca das telas e
  as listas da farmácia.
- **Gatilhos impedem gravar um item de outra unidade** em seis lugares: prescrição, estoque, falta,
  dispensação, ajuste de alta vigilância e diluição. A diluição de um item da unidade também precisa
  ser da unidade. Até o ponto 2, a "Nova diluição" cria modelo da rede, então ela recusa o item da
  unidade, com mensagem.
- **Funções novas:**

  | Função | O que faz | Quem pode |
  |---|---|---|
  | `medicamentos_parecidos` | lista o que já existe com aquele nome | farmacêutico ou gestor da unidade |
  | `cadastrar_medicamento` | cadastra o item novo | farmacêutico ou gestor da unidade |
  | `usar_medicamento_na_unidade` | faz a unidade passar a usar um item de outra unidade | farmacêutico ou gestor da unidade |
  | `corrigir_medicamento` | corrige o item, com motivo | só a unidade de origem |
  | `inativar_medicamento` | inativa o item, com motivo | só a unidade de origem |
  | `definir_forma_farmaceutica` | preenche a forma do item da rede | farmacêutico ou gestor, como a unidade de consumo |
  | `levar_medicamento_para_rede` | passa o item para a rede | super admin |

  - Toda mudança grava auditoria. Corrigir, usar, inativar, mudar a forma e levar para a rede
    também guardam o antes e o depois em `revisoes_cadastro` (lote "tela").
  - O item novo passa pelos gatilhos que já existiam: a unidade de consumo é a escolhida e já sai
    conferida, e a alta vigilância segue a regra do ISMP.
- **Quatro listas ganham o filtro da unidade**, com a mesma assinatura: `farmacia_estoque`,
  `disponibilidade`, `alta_vigilancia_da_unidade` e `medicamentos_unidade_consumo`. Esta última
  devolve também a forma e a origem do item, e "a conferir" passa a contar o item sem forma.

### Tela

- **Unidade de consumo** (`src/pages/farmacia/UnidadeConsumo.tsx`):
  - botão "Novo medicamento", com princípio ativo, forma, apresentação, concentração e unidade de
    consumo;
  - a lista dos parecidos aparece antes de gravar, com "Usar nesta unidade" no item que outra
    unidade cadastrou;
  - a tabela ganhou a coluna "Forma";
  - o item desta unidade mostra quem cadastrou e tem "Corrigir" e "Inativar", os dois com motivo.
- **As nove buscas no cadastro** passam a mostrar só a rede e a unidade ativa (`filtroDaUnidade` em
  `src/lib/medicamentoCadastro.ts`): prescrição, receitas, favoritos, alergias, referência de
  diluição, prescrição de teste, dispensação avulsa e nova diluição.

## O que não cobre

- **Quem trabalha em duas unidades** vê, na busca da unidade B, só os itens da rede e os de B. Os
  gatilhos do banco barram o resto mesmo que alguma busca o ofereça.
- **Levar um item para a rede** não tem tela: é a função do super admin.
- **Diluição de item da unidade:** fica para o ponto 2. Hoje ela é recusada, com mensagem.
- **Interações críticas:** os grupos de fármacos não usam o filtro, porque são listas da própria
  unidade.

## Rollback

- Reaplicar estas quatro funções nas versões anteriores:

  | Função | Migration |
  |---|---|
  | `farmacia_estoque` | `20261009000001` |
  | `disponibilidade` | `20260929000008` |
  | `alta_vigilancia_da_unidade` | `20261031000001` |
  | `medicamentos_unidade_consumo` | `20261129000001` |

- Fazer DROP dos gatilhos `trg_medicamento_da_unidade_*` e das funções novas.
- As colunas novas saem só numa janela declarada (contract), depois de inativar os itens da
  unidade. Até lá ficam sem uso.

## Evidência

- **Teste do banco** `supabase/tests/cadastro_medicamentos.sql`. Ele cria o próprio cenário (rede,
  duas unidades, farmacêutico de cada uma e um plantonista) e roda no CI e na homologação. Cobre:
  - só o farmacêutico ou o gestor da unidade cadastra;
  - a forma é obrigatória;
  - o opioide novo entra na alta vigilância;
  - o mesmo item não entra duas vezes;
  - a unidade B não vê, não grava, não duplica e não corrige o item da unidade A;
  - "Usar nesta unidade" libera o item;
  - a prescrição e a diluição da rede recusam item de outra unidade;
  - a correção e a inativação são da unidade de origem e ficam em `revisoes_cadastro` e na
    auditoria;
  - a forma do item da rede é preenchida pela farmácia.
- **Teste da tela** `src/lib/medicamentoCadastro.test.ts`: a lista de formas é a mesma do banco, e
  as nove buscas usam o filtro da unidade.
- **Local:** typecheck, lint, catraca, os 131 testes de `src/lib`, os 1089 testes clínicos e o build,
  todos verdes.
- **Homologação** (`kswurfyxxvfydpjfrivy`), 27/10/2026:
  - a migration foi aplicada e registrada como `20270106000001 cadastro_medicamentos`;
  - o teste do banco rodou inteiro lá, dentro de uma transação desfeita, e todos os passos
    passaram;
  - depois do ROLLBACK, nenhuma linha de teste ficou para trás (zero unidades, usuários e itens
    locais).

## Teste do RT na homologação

1. Como farmacêutico: abrir Unidade de consumo, clicar em "Novo medicamento" e digitar um princípio
   ativo que já existe. Os parecidos aparecem.
2. Cadastrar um item novo com forma, apresentação e unidade de consumo. Ele aparece na lista como
   "desta unidade", com quem cadastrou.
3. Na Disponibilidade, o item novo aparece para informar o saldo.
4. Como médico da mesma unidade: o item aparece na busca da prescrição.
5. "Corrigir" com motivo muda o item; "Inativar" o tira das buscas.
6. Na coluna "Forma", preencher a forma de um item da rede.
