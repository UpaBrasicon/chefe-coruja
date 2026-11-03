# Fila do PS com dados novos — diagnóstico (27/10/2026)

> **Decisão final do RT (27/10/2026), depois das opções de desenho:** a fila fica como está, sem as colunas
> novas; a RPC `fila_ps_detalhes` (PR #278) foi fechada sem merge e removida da homologação. Entram só o
> consultório do plantão (escolhido uma vez no topo da fila, guardado no banco) e o alvo da cor da unidade
> na fila do médico (achado D5 abaixo). O restante deste documento fica como registro do levantamento.

**Tarefa:** fila do PS com dados novos (P2; pedido do RT em 21/10/2026, "Itens novos" do `BACKLOG.md`).
**Pedido:** colunas de alergia, sala, médico responsável, exames (prontos de pedidos) e medicação (pedida,
feita), como nos quadros de rastreamento dos concorrentes. O backlog já diz: consultas novas, diagnóstico de
banco e RPC antes do frontend.
**Objetivo comercial:** o médico vê, na própria fila, o que hoje só aparece abrindo cada atendimento (o que o
Epic, o Cerner e o Symphony mostram no quadro do PS).
**Objetivo técnico:** uma RPC de leitura para a fila do médico, sem tabela nova, e as colunas na tabela da 3.3.
**Módulos afetados:** banco (uma RPC), `src/pages/plantao/porta/FilaPS.tsx`.

Levantamento feito no código do `master` e nos metadados da homologação (colunas, restrições, políticas e
funções; nenhum dado de paciente).

## 1. Diagnóstico do estado atual

**Hoje** a fila (`FilaPS.tsx`) lê `episodios` direto pela API, filtrando pelos setores em que o médico está
na escala agora (`setores_na_escala_agora`), e conta as chamadas por episódio (`useChamadasPorEpisodio`).
São três abas, em tabela:
- **Aguardando:** cor, paciente, queixa, espera, alvo e situação (quantas chamadas).
- **Em atendimento:** cor, paciente, queixa, há quanto tempo e situação (reavaliação).
- **Saídas do plantão:** desfecho, CID, destino e hora.

**Onde mora cada dado novo:**

| Coluna | Onde mora | Quem vê hoje, pela política do banco |
|---|---|---|
| Alergia | `alergias_paciente` (ativas: `inativada_em` nulo; `tipo`, `gravidade` leve/moderada/grave/desconhecida, `substancia`) e `alergias_negacoes` ("nega" ou "desconhece", vigente sem `encerrada_em`) | Plantonista com o paciente no plantão (`paciente_no_meu_plantao`) e gestor |
| Sala | `chamadas.sala_id` da última chamada → `salas.nome` | Quem está na escala do setor |
| Médico responsável | `episodios.atendimento_medico_id` → `perfis.nome_completo` | Membros da unidade |
| Exames | `exames_pedidos` do episódio (`situacao`; "resultado" é pronto; cancelado fora) | Plantonista com o paciente no plantão |
| Medicação | `prescricoes` da porta → `prescricao_itens` → `administracoes` (a regra de `private.medicacao_sem_checagem`) | **Só o médico que prescreveu** (`prescricoes_select` exige `medico_id` = eu), além do gestor |

**O que falta.**
- Uma consulta que traga as cinco colunas de uma vez. Pela API seriam cinco leituras a mais a cada 20 s,
  por médico.
- A medicação de um colega não aparece para o médico pela política de hoje. Na fila, a coluna sairia vazia
  para metade dos pacientes, e o médico acharia que não há medicação pedida.

**O que está errado** (achado, não estilo):
- **Alvo da cor fixo na fila do médico.** A fila usa o alvo de Manchester fixo no código (`ALVO_MIN`, em
  `src/domain/risco.ts`). A Porta, a grade do gestor e os indicadores usam o alvo da unidade
  (`tempos_alvo_unidade`, ajustável em Unidade › Configurações). Se a unidade muda o alvo do amarelo para
  30 min, o gestor vê o paciente atrasado e o médico não. A espera conta certo, desde a 1ª classificação:
  `classificado_em` não muda na reclassificação.

**Decisões do RT antes da RPC:**

| # | Pergunta | Proposta |
|---|---|---|
| D1 | Que colunas em cada aba? | Aguardando: + Alergia e Sala. Em atendimento: + Alergia, Médico, Exames e Medicação. Saídas: nada novo |
| D2 | Como mostrar a alergia? | "Nega", "Desconhece", ou as substâncias (até duas, "+N"), com a grave em vermelho; "Não perguntado" em âmbar quando não há registro nem negação |
| D3 | Medicação de outro médico | A RPC mostra a qualquer médico na escala do setor só a contagem e a hora (por exemplo "2 pendentes", "última 10:24"), **sem o nome do remédio**. A política de `prescricoes` não muda: o detalhe continua só com quem prescreveu |
| D4 | Exames | "N de M" prontos, como na grade do gestor; sem alvo, sem vermelho |
| D5 | Corrigir o alvo fixo da fila | Sim, junto: a fila passa a usar o alvo da unidade, que vem da mesma RPC |

## 2. Subtarefas técnicas

1. Decisões D1–D5 do RT, registradas no `BACKLOG.md`.
2. Migration com `public.fila_ps_detalhes()` (expand).
3. Teste de banco `supabase/tests/fila_ps_detalhes.sql`.
4. Homologação: migration, teste e rollback.
5. Desenho das colunas com referência do Refero; opções ao RT; aplicação na `FilaPS.tsx`.
6. Homologação do frontend, teste do RT, produção.

## 3. Alterações de banco

- **Nenhuma tabela, coluna, índice ou política nova.** Uma função nova, `CREATE OR REPLACE`.
- Índices: já existem por `episodio_id` em `chamadas`, `exames_pedidos`, `prescricoes` e
  `atendimento_reavaliacoes`; e por `paciente_id` nas alergias ativas (`alergias_paciente_idx`) e na negação
  vigente (`alergias_negacoes_vigente`).
- **Rollback:** `DROP FUNCTION IF EXISTS public.fila_ps_detalhes();`.

## 4. RPC

**`public.fila_ps_detalhes() RETURNS jsonb`**, `SECURITY DEFINER`, `SET search_path = ''`, só leitura.

| Item | Definição |
|---|---|
| Permissão | segundo fator (`private.exigir_segundo_fator`); devolve só episódios em triagem ou atendimento dos setores em que quem chama está na escala agora (`setores_na_escala_agora`), o mesmo recorte da fila. Fora da escala, lista vazia. `REVOKE ... FROM PUBLIC, anon` |
| Saída | `{tempos (alvo da cor da unidade), episodios: {<id>: {alergia: {situacao: nega/desconhece/nao_perguntado/tem, itens: [{substancia, gravidade}]}, sala, medico, exames: {feitos, total}, medicacao: {pendentes, ultima_em}}}}` |
| O que não sai | Nome de remédio, resultado de exame, texto clínico |
| Auditoria | Não registra: a fila já mostra o nome do paciente a quem está na escala do setor, e os dados novos são contagens e alergias que a política já libera a esse médico. O RT pode pedir o registro, como em `porta_agora` |
| Chamada repetida | Só leitura; sem efeito |

## 5. Frontend

- `FilaPS.tsx`: uma consulta a mais (`fila_ps_detalhes`, a cada 20 s, junto com a fila) e as colunas de D1,
  com texto em cada estado, não só cor.
- A tabela da 3.3 já é densa: as colunas novas pedem o desenho com o Refero (opções ao RT), sobretudo na
  aba Em atendimento, que passa de 6 para 10 colunas.
- O alvo da cor (D5) sai da RPC, e não mais de `ALVO_MIN`.

## 6. Permissões e auditoria

- Mesmo recorte da fila: quem não está na escala do setor não recebe nada.
- D3 é a única abertura nova: a contagem da medicação de colegas, sem o nome do remédio. O resto já é
  visível ao médico pelas políticas de hoje.

## 7. Testes

| Teste | Onde |
|---|---|
| Plantonista na escala recebe os episódios do setor; fora da escala, lista vazia; anon não executa | `supabase/tests/fila_ps_detalhes.sql` |
| Alergia: nega, desconhece, não perguntado, substâncias com gravidade; inativada não aparece | idem |
| Sala da última chamada; médico pelo `atendimento_medico_id` | idem |
| Exames "N de M" sem os cancelados; medicação de outro médico em contagem, sem nome de remédio | idem |
| O alvo da cor segue o ajuste da unidade | idem |
| Colunas, estados e os dois temas | página de teste com a fila real e dados fictícios |

## 8. Critérios de aceite

| Critério (do backlog) | Evidência |
|---|---|
| Colunas de alergia, sala, médico, exames e medicação na fila | teste de banco + foto da página de teste |
| Consultas novas com diagnóstico de banco e RPC antes do frontend | este documento + RPC testada na homologação antes da tela |
| Desenho escolhido pelo RT | opções no `PLANO.md` com a escolha |

## 9. Riscos

- **Mostrar medicação de colega (D3):** abre uma informação que hoje é só de quem prescreveu. Mitigação: só
  contagem e hora, sem remédio; só para quem está na escala do setor.
- **Alergia "não perguntado" confundida com "sem alergia":** mitigação: texto explícito e cor de atenção.
- **Tabela larga demais:** mitigação: o desenho com o Refero e as colunas só na aba em que servem (D1).
- **Desempenho:** uma chamada a cada 20 s por médico, com subconsultas indexadas por episódio. Medir na
  homologação com 80 pacientes, como na `porta_grade` (~10 ms).

## 10. Ordem

D1–D5 com o RT → migration e teste na homologação → opções de desenho (Refero) → escolha do RT → frontend →
homologação → teste do RT → produção (banco com o "ok produção") → registro no `BACKLOG.md`.

## 11. Como demonstrar comercialmente

Na demo, a fila do médico mostra de relance: o alérgico à dipirona em vermelho, quem foi chamado para a sala
2, quem já está com o Dr. Fulano, quem tem 2 de 3 exames prontos e quem tem medicação pendente, sem abrir
nenhum atendimento. É a leitura do quadro do PS dos sistemas grandes, dentro da fila que o médico já usa.
