# Grade de ações do gestor — diagnóstico (27/10/2026)

**Tarefa:** grade de ações no gestor (P1, item próprio depois da 3.9; pedido do RT em 21/10/2026).
**Contexto:** Revisão visual, item novo da tabela "Itens novos pedidos pelo RT em 21/10/2026" do `BACKLOG.md`.
**Objetivo comercial:** o gestor vê, numa tela, onde cada paciente da porta está parado — o quadro de
rastreamento que o Symphony (NHS), o MV e o Epic vendem como "tracking board".
**Objetivo técnico:** uma consulta nova que devolva, por paciente da porta, a hora de cada etapa e se ela
está feita, pedida ou atrasada, sem mudar tabela e sem mudar o contrato de `porta_agora`.
**Módulos afetados:** banco (uma RPC nova; nenhuma tabela nova), gestor (`src/pages/gestor/PortaAgora.tsx`).
**Referência de desenho:** maquete `docs/frontend/revisao-visual/app/ps-modelo-4-claro|escuro.jpg`.

Levantamento feito no esquema da homologação (só metadados: colunas, restrições, índices e funções;
nenhum dado de paciente lido) e no código do `master` em 27/10/2026.

## 1. Diagnóstico do estado atual

**O que já existe e serve.** Toda etapa da grade já tem hora gravada no banco:

| Coluna da grade | Onde mora | Feito | Pedido / pendente | Alvo que já existe |
|---|---|---|---|---|
| No PS | `episodios.chegada_em` | — | — | `private.tempos_alvo_unidade` (porta → médico, por cor; ajuste da unidade › protocolo › Manchester) |
| Classificação | `classificacoes_risco.criado_em` (1ª sem `reclassificacao`); `episodios.classificado_em` | hora da 1ª | `etapa = 'triagem'` | nenhum |
| Chamada | `chamadas` (`etapa = 'atendimento'`, `criado_em`; uma linha por chamada) | hora da última; quantas vezes | classificado e sem chamada | o mesmo alvo da cor (espera desde a 1ª classificação, regra de `porta_agora`) |
| Atendimento | `episodios.atendimento_iniciado_em` | hora | chamado e não iniciado | o mesmo alvo da cor |
| Exames | `exames_pedidos` (`pedido_em`, `situacao`: pedido, coletado, em_analise, realizado, resultado, cancelado; `resolvido_em`) | "N de M" com resultado | algum sem resultado | nenhum |
| Medicação | `prescricoes` (porta: `internacao_id IS NULL`) → `prescricao_itens` → `administracoes` (`situacao = 'feito'`, `registrado_em`) | hora da última checagem | `private.medicacao_sem_checagem(episodio)` (já usada em `porta_agora`) | nenhum |
| Reavaliação | `atendimento_reavaliacoes` (`tipo`: aguardar com `reavaliar_em`, ou reavaliacao); `episodios.reavaliar_em` | hora da reavaliação | `reavaliar_em` no futuro | o próprio `reavaliar_em`, marcado pelo médico |
| Desfecho | `episodios.desfecho`, `desfecho_em` | hora e tipo | — | — |

- `porta_agora(p_unidade)` já é o molde: `SECURITY DEFINER`, `search_path` vazio, exige o segundo fator,
  só o gestor da unidade (`private.gestor_da_unidade`), devolve o nome do paciente e registra
  `ver_porta_agora` na trilha (um registro a cada 15 min por gestor). Tem teste em
  `supabase/tests/fase1_porta_agora.sql`.
- Índices: todas as tabelas filhas têm índice por `episodio_id` (`chamadas_episodio`,
  `classificacoes_episodio`, `atendimento_reavaliacoes_episodio`, `idx_exames_pedidos_episodio_id`,
  `idx_prescricoes_episodio_id`), e `administracoes_item (item_id, registrado_em DESC)`. Para algumas dezenas
  de pacientes na porta, subconsultas laterais por paciente cabem sem índice novo.
- `private.config_unidade_int(unidade, chave, padrão, mín, máx)` guarda ajustes da unidade sem tabela nova:
  serve para alvos que ainda não existem.

**O que falta.**
- Uma consulta que junte as oito colunas por paciente. Hoje `porta_agora` devolve só etapa, cor, setor,
  leito, espera e `medicacao_pendente` (sim ou não).
- Alvo para classificação, exames, medicação e permanência total. Não existe nenhum. Pela regra do
  backlog, número de alvo não se inventa: sem alvo, a coluna mostra feito ou pedido, nunca vermelho.

**O que está errado ou ambíguo** (decisões do RT antes da RPC):

| # | Pergunta | Proposta |
|---|---|---|
| D1 | Onde a grade entra? | Aba "Grade de ações" em Porta (`/gestao/porta`), ao lado da lista de hoje, que fica como está |
| D2 | Quem aparece? | Triagem e atendimento (a porta). Observação fica fora: tem prazo e tela próprios. Quem recebeu desfecho some da grade, salvo se o RT quiser ver as saídas da última hora |
| D3 | "No PS" em vermelho quando? | Antes do médico: acima do alvo da cor (o que já existe). Depois do médico: só se a unidade definir um alvo de permanência (chave nova `alvo_permanencia_min`, sem valor padrão) |
| D4 | Alvos de exame, medicação e classificação | Chaves novas por unidade (`alvo_exame_min`, `alvo_medicacao_min`, `alvo_classificacao_min`), sem valor padrão: o vermelho só acende onde a unidade definir o número |
| D5 | Chamada repetida | Mostrar a hora da última e "3ª chamada" quando houver mais de uma |

## 2. Subtarefas técnicas

1. Decisões D1–D5 do RT, registradas no `BACKLOG.md`.
2. Migration: função `public.porta_grade(p_unidade uuid)` (expand; nada é removido).
3. Teste de banco `supabase/tests/porta_grade.sql`, no molde do teste de `porta_agora`.
4. Homologação: aplicar a migration e rodar o teste.
5. Frontend: aba e tabela na Porta, com a referência do Refero e as opções mostradas ao RT antes.
6. Homologação do frontend, conferência do RT, produção.

## 3. Alterações de banco

- **Nenhuma tabela, coluna ou índice novo.** Uma função nova, idempotente: `CREATE OR REPLACE FUNCTION`.
- Alvos novos (D3, D4) entram por `config_unidade_int`. Sem linha de configuração, o alvo é nulo e nada
  fica vermelho. Não há valor gravado na migration.
- **Rollback:** `DROP FUNCTION IF EXISTS public.porta_grade(uuid);`. Nada mais depende dela; testado em
  homologação antes da produção.

## 4. Backend / RPC

**`public.porta_grade(p_unidade uuid) RETURNS jsonb`**, `SECURITY DEFINER`, `SET search_path = ''`,
`VOLATILE`, porque grava a auditoria.

| Item | Definição |
|---|---|
| Permissão | `private.exigir_segundo_fator()`; `private.gestor_da_unidade(p_unidade)`, senão `insufficient_privilege`. `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated` |
| Entrada | episódios da unidade em `etapa IN ('triagem','atendimento')` (D2) |
| Saída | `{gerado_em, tempos, alvos, pacientes: [{episodio_id, nome, cor, setor, chegada_em, no_ps_min, no_ps_atrasado, classificacao: {em}, chamada: {em, vezes, atrasada}, atendimento: {em, atrasado}, exames: {feitos, total, desde, atrasado}, medicacao: {ultima_em, pendentes, atrasada}, reavaliacao: {feita_em, prevista_em, atrasada}, desfecho: {tipo, em}}]}` |
| Estados | cada etapa: feito (tem hora), pedido (pendente sem alvo vencido), atrasado (pendente com alvo vencido), ou vazio |
| Auditoria | `ver_porta_grade` em `log_auditoria`, um registro a cada 15 min por gestor e unidade, com o número de pacientes (mesma regra de `ver_porta_agora`) |
| Chamada repetida | só leitura; repetir não muda nada além do registro de auditoria a cada 15 min |

`episodio_id` volta na saída para a tela abrir o atendimento, se o RT quiser (hoje `porta_agora` não devolve).

## 5. Frontend

- `PortaAgora.tsx`: aba "Grade de ações" (`TabsPagina`, `?aba=grade`); a lista de hoje vira a outra aba.
- Tabela da 3.3 (`Table variante="referencia"`): paciente com a pílula da cor, "No PS", e uma coluna por
  etapa. Texto em preto quando feito, em verde (`conforme`) quando pedido e em vermelho (`critico`) quando atrasado. A legenda fica
  em cima, e cada estado também tem texto ("falta", "1 de 3"), não só cor.
- `useQuery` com `refetchInterval` de 30 s, como a Porta.
- Desenho: referência do Refero e duas ou três opções mostradas ao RT antes de aplicar, como na trilha.

## 6. Permissões e auditoria

- Só o gestor da unidade, com o segundo fator. O enfermeiro, o médico e o administrador recebem
  `insufficient_privilege`.
- O nome do paciente na tela do gestor já é aceito em `porta_agora`; a grade segue a mesma regra e grava
  `ver_porta_grade` na trilha encadeada (`private.registrar_auditoria`).
- Sem política RLS nova: a função é `SECURITY DEFINER` e não abre tabela ao cliente.

## 7. Testes

| Teste | Onde |
|---|---|
| Gestor da unidade recebe a grade; outro papel e outra unidade recebem `insufficient_privilege` | `supabase/tests/porta_grade.sql` |
| Cada coluna: feito, pedido, atrasado e vazio, com episódios montados no teste | idem |
| Sem alvo configurado, exame e medicação nunca vêm atrasados; com a chave, vêm | idem |
| Chamada repetida conta as vezes e mostra a última | idem |
| Auditoria: um registro na primeira chamada, nenhum na segunda dentro de 15 min | idem |
| Tela: estados com texto, ordenação, tema escuro | página de teste com a tela real e dados fictícios |

## 8. Critérios de aceite

| Critério (do backlog) | Evidência |
|---|---|
| Uma linha por paciente e uma coluna por etapa, com a hora de cada uma | teste de banco + foto da página de teste |
| Preto feito, verde pedido, vermelho atrasado | teste de banco (estados) + foto nos dois temas |
| Tempo no PS em vermelho acima do alvo da cor | teste de banco com um laranja acima de 10 min |
| Desenho com referência do Refero | opções no `PLANO.md` com a escolha do RT |

## 9. Riscos

- **Vermelho sem base:** um alvo inventado faria o gestor cobrar a equipe por um número que ninguém
  definiu. Mitigação: sem chave da unidade, não há vermelho (D3, D4).
- **Dado de paciente:** mais uma tela do gestor com nome. Mitigação: as mesmas regras de `porta_agora`
  (segundo fator, só o gestor, trilha a cada 15 min).
- **Desempenho:** subconsultas por paciente; numa UPA cheia (80 pacientes na porta) são cerca de 500
  leituras indexadas a cada 30 s por gestor. Medir com `EXPLAIN ANALYZE` na homologação.
- **Medicação "se necessário":** fica fora do pendente, como em `medicacao_sem_checagem`.

## 10. Ordem de implementação

D1–D5 com o RT → migration e teste em homologação → opções de desenho (Refero) → escolha do RT →
frontend → homologação → conferência do RT → produção → registro no `BACKLOG.md`.

## 11. Como demonstrar comercialmente

Na demo, abrir Porta → "Grade de ações" com a unidade cheia: em segundos o gestor vê quem espera o médico
acima do alvo da cor, quem tem exame sem resultado e quem passou da hora da reavaliação marcada pelo
médico. Comparar com o quadro do Symphony: a mesma leitura, sem planilha e sem perguntar ao plantão.
