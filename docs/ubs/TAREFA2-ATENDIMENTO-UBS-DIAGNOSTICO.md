# 5A, tarefa 2: atendimento UBS simples

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P1**. Começada pelo RT em 02/11/2026 ("Sim, tarefa 2").

Aceite do backlog: "UBS registra atendimento básico". Subtarefas do backlog: fluxo de atendimento; evolução; CID/CIAP; conduta; encaminhamento.

Este documento é o diagnóstico. **Decisões do RT em 02/11/2026: A em D1 a D7** ("Sim, todas A"). A implementação segue as partes 2.1 a 2.4, cada uma com o próprio PR.

## Fonte da atenção primária

**Ministério da Saúde, e-SUS Atenção Básica, *Manual do Sistema com Coleta de Dados Simplificada – CDS*, versão 2.1, 2016, Ficha de Atendimento Individual (p. 57 a 71).** É a ficha que alimenta o SISAB e é a referência do registro do atendimento na UBS.

- **Tipo de atendimento (obrigatório), p. 57 e 58:**
  - consulta agendada programada/cuidado continuado;
  - consulta agendada;
  - demanda espontânea: escuta inicial/orientação, consulta no dia e atendimento de urgência.
- **Problema/condição avaliada (obrigatório; ao menos um), p. 62 a 65:**
  - uma lista fixa: asma, desnutrição, diabetes, DPOC, hipertensão arterial, obesidade, pré-natal, puericultura, puerpério, saúde sexual e reprodutiva, tabagismo, uso de álcool, uso de outras drogas, saúde mental, reabilitação, doenças transmissíveis e rastreamentos;
  - "Outros", com CIAP-2 e/ou CID-10, só quando o problema não está na lista;
  - vale o que foi avaliado e manejado na consulta, não os antecedentes.
- **Conduta/desfecho (ao menos uma), p. 69 a 71:**
  - retorno para consulta agendada;
  - retorno para cuidado continuado/programado;
  - agendamento para grupos;
  - agendamento para Nasf;
  - alta do episódio;
  - encaminhamento interno no dia;
  - encaminhamento para serviço especializado, CAPS, internação hospitalar, urgência, serviço de atenção domiciliar ou intersetorial.
- **Escuta inicial e consulta são registros diferentes**, p. 58. A escuta é feita na chegada, por profissional de nível superior. Ela resolve por orientação ou faz a classificação de risco e a análise de vulnerabilidade, e encaminha para a consulta no dia ou em outra data.

A escala da classificação de risco da demanda espontânea na UBS é a do Caderno de Atenção Básica nº 28 (MS). Ela não está transcrita aqui: confiro na fonte antes de implementar (D3). A cor da classificação continua sendo da enfermagem.

## 1. Diagnóstico do estado atual

O atendimento de hoje é o da porta. Todo o caminho depende de quatro coisas que a UBS não tem.

| Passo | Como é hoje | Trava de porta |
|---|---|---|
| Ficha | `registrar_ficha` cria o `episodios` em `etapa = 'triagem'` | o setor tem de ser de `emergencia` ("A ficha abre numa porta"), e a pessoa tem de estar no plantão do setor |
| Classificação | `classificar_risco`, com fluxograma, discriminador e sinais vitais obrigatórios | é o **único** caminho de `triagem` para `atendimento`: sem classificação, o médico não abre o atendimento |
| Consulta | `iniciar_atendimento`, `registrar_soap` (S, O, A, P e CID-10 opcional), rascunho, reavaliação | `medico_na_porta`: setor na escala de agora, com check-in |
| Desfecho | `registrar_desfecho`: alta, observação, internação, transferência, evasão, óbito | exige CID de alta; os desfechos são os de pronto-socorro |
| Fila | `FilaPS` ordena por cor, idade de 80 ou mais e prioridade legal; mostra a espera contra o alvo da cor | Manchester |
| Produção | `bpa_i_linhas` gera a linha do BPA do atendimento e da classificação | a produção da UBS vai ao SISAB (e-SUS APS), não ao BPA |

**O que já serve à UBS sem mudança:**
- o prontuário e o `episodios`, com a conta "ambulatorial" que abre sozinha;
- o SOAP (`atendimento_registros`), a busca de CID-10 (`terminologia_buscar`) e os diagnósticos do episódio;
- a prescrição, os exames, o atestado e a receita;
- o encaminhamento interno (`encaminhar_interno`), o encaminhamento SMS003a e a regulação (`regulacao_solicitar`).

**O que falta:**
- um setor que não seja de emergência: o `tipo_setor` só tem emergência, observação, internação, isolamento, UTI e outro;
- um caminho da ficha à consulta sem a classificação de Manchester;
- o tipo de atendimento, o problema/condição avaliada e a conduta da ficha do e-SUS APS;
- a CIAP-2, que não existe em lugar nenhum. Ela é a tarefa 4: aqui fica só o lugar dela.

**O que está fora desta tarefa:** a agenda (tarefa 3), a CIAP-2 (tarefa 4), o encaminhamento à regulação acompanhado (tarefa 5) e o envio ao SISAB pelo e-SUS APS.

## Decisões do RT

Todas na opção A, em 02/11/2026.

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Onde mora a consulta da UBS | **A)** o mesmo `episodios` da porta, com um caminho próprio da UBS e campos novos. **B)** uma tabela nova de consulta da atenção primária | A: prontuário, prescrição, exames, documentos, regulação e conta já se ligam ao episódio |
| D2 | Quem pode atender | **A)** a equipe da UBS entra na escala, com expediente e check-in, como hoje; a escala fixa semanal monta o mês. **B)** o vínculo com a unidade basta no horário de funcionamento, sem escala | A: mantém a regra "a escala é a porta" e não abre uma segunda forma de acesso |
| D3 | Acolhimento | **A)** escuta inicial opcional da enfermagem, com a classificação da demanda espontânea do CAB 28 (conferida na fonte antes de implementar); a recepção pode mandar direto para a consulta. **B)** classificação obrigatória antes do médico, como na porta | A: a consulta agendada não passa por escuta |
| D4 | O que se registra na consulta | **A)** SOAP de hoje, mais o tipo de atendimento, o problema/condição avaliada (lista da ficha mais CID-10; a CIAP-2 entra na tarefa 4) e a conduta, tudo como na ficha do e-SUS APS. **B)** só o SOAP com CID | A: é o que o SISAB vai pedir |
| D5 | Setor da UBS | **A)** um tipo de setor novo, `consultorio`, aceito pela ficha só em UBS, com sala padrão de consultório. **B)** usar o tipo `outro` | A |
| D6 | BPA dos atendimentos da UBS | **A)** não geram linha de BPA até a decisão do e-SUS APS. **B)** geram como na porta | A: a UBS não fatura consulta pelo BPA |
| D7 | Tela do médico | **A)** a mesma tela "Atendimento" de hoje, com a fila da UBS por ordem de chegada (e prioridade da escuta, quando houver) e a janela sem cor, sem reclassificação e com "Conduta" no lugar de "Desfecho"; layout pelo Refero antes. **B)** uma tela nova só da UBS | A |

## Parte 2.1, banco (02/11/2026)

Migrations `20270211000001_tipo_setor_consultorio.sql` e `20270211000002_atendimento_ubs.sql`; teste `supabase/tests/5a_atendimento_ubs.sql`.

- **`consultorio`** no `tipo_setor`, numa migration só.
- **`episodios`:** `tipo_atendimento_aps`, `problemas_aps`, `cid_aps` e `conduta_aps`, anuláveis, com CHECK pelas listas da ficha. O episódio da UBS é o que tem `tipo_atendimento_aps`.
- **Códigos das listas** (Manual do CDS 2.1):
  - tipo de atendimento: `consulta_programada`, `consulta_agendada`, `escuta_inicial`, `consulta_no_dia`, `atendimento_urgencia`;
  - problema/condição: `asma`, `desnutricao`, `diabetes`, `dpoc`, `hipertensao_arterial`, `obesidade`, `pre_natal`, `puericultura`, `puerperio`, `saude_sexual_reprodutiva`, `tabagismo`, `uso_alcool`, `uso_outras_drogas`, `saude_mental`, `reabilitacao`, `tuberculose`, `hanseniase`, `dengue`, `dst`, `rastreamento_cancer_colo_utero`, `rastreamento_cancer_mama`, `rastreamento_risco_cardiovascular`; fora da lista, CID-10 em `cid_aps`;
  - conduta: `retorno_consulta_agendada`, `retorno_cuidado_continuado`, `agendamento_grupos`, `agendamento_nasf`, `alta_episodio`, `encaminhamento_interno`, `encaminhamento_especializado`, `encaminhamento_caps`, `encaminhamento_internacao`, `encaminhamento_urgencia`, `encaminhamento_atencao_domiciliar`, `encaminhamento_intersetorial`.
- **`registrar_ficha`:** numa UBS, só no consultório e com `p_dados.tipo_atendimento`; o episódio nasce em `atendimento`. Fora da UBS, nada muda (o consultório de uma UPA é recusado).
- **`registrar_conduta_aps`** (nova): médico de plantão no consultório, atendimento aberto, SOAP com Avaliação, tipo, ao menos um problema (lista ou CID-10) e uma conduta. Encerra o episódio sem `desfecho` (o `desfecho` é da porta), com `desfecho_por` e `encerrado_por`; encerra a prescrição e cancela o parecer pendente, como a alta da porta. Auditoria `consulta_aps_encerrada`.
- **`registrar_desfecho`:** recusa o episódio da UBS, menos a evasão (o paciente que sai sem a consulta).
- **`bpa_i_linhas`:** a unidade UBS não gera linha. O BPA-C e a conta usam a mesma fonte, então também ficam sem linha.
- **Sem mudança:** `iniciar_atendimento` e `registrar_soap` já servem; `classificar_risco` já recusa o episódio da UBS (não está em triagem e não tem cor).
- **Frontend só de tipos:** o enum, o rótulo "Consultório" e a nova RPC. A tela de Setores mostra "Consultório" em toda unidade; filtrar pelo tipo da unidade fica para a parte 2.2.

**Homologação (02/11/2026):**
- as duas migrations aplicadas duas vezes (idempotentes) e as versões registradas;
- `5a_atendimento_ubs.sql`: ok (ficha, consulta, conduta, evasão, BPA, listas iguais);
- rollback: as três funções voltam ao md5 de antes, que é o da produção (`registrar_ficha` cb88de2a…, `registrar_desfecho` 5daa9634…, `bpa_i_linhas` b6bc780c…); o teste falha; reaplicado, o retrato fica igual ao de depois;
- `src/lib` (235), testes clínicos (1105), tipos e lint passando.

**Produção (02/11/2026, ok do RT):** as duas migrations aplicadas por `producao:push`. Versões registradas; md5 das funções (`registrar_ficha` b466e655…, `registrar_desfecho` 4b0de6a8…, `bpa_i_linhas` 42636c5e…, `registrar_conduta_aps` eb104c86…, `lista_aps` 8f05aa7f…), grants, dono, colunas, CHECKs e enum iguais aos da homologação.

## Telas: escolha do RT (02/11/2026)

Três opções da aba Conduta, montadas a partir de telas do Refero e mostradas ao RT:
- A, grade de marcação, como a ficha em papel (Yelp, "More Categories", tela f7caf399);
- B, pílulas que acendem ao toque (Pop Site, seleção do cadastro inicial, tela a4cc8729);
- C, busca única, com o escolhido em etiquetas e a conduta em caixas de marcar (Intercom, escolha de tags, tela 2ab15aa7).

**O RT escolheu a C.** A busca mostra primeiro a lista da ficha e depois a CID-10. A fila e a recepção seguem o padrão de hoje.

## Parte 2.2, recepção e fila (02/11/2026)

Migration `20270212000001_consultorio_fila_salas.sql`; teste `supabase/tests/5a_consultorio_fila.sql`.

- **Banco:** a fila da recepção (`fila_da_porta`) e as últimas chamadas aceitam o consultório. O consultório novo ganha uma sala com o nome dele (D5, "sala padrão de consultório"); sem ela, o médico não chama o paciente. Os consultórios que já existem ganham a sala que faltava.
- **Recepção da UBS:** a ficha abre no consultório de plantão e pede o tipo de atendimento. As telas são só "Nova ficha" e "Fila do consultório", sem triagem e sem painel. A fila ordena por prioridade legal e chegada, sem cor nem alvo.
- **Fila do médico na UBS (tela Atendimento, título "Consultório"):** sem as colunas Cor e Alvo; a espera conta da ficha; a coluna Tipo mostra o tipo de atendimento. As saídas mostram a conduta, a CID-10 e a observação.
- **Listas da ficha no frontend:** `src/domain/aps.ts`; o teste `src/lib/apsListas.test.ts` confere que são as mesmas do banco.
- O menu da UBS já começa em Atendimento para o médico (tarefa 1), sem mudança.

**Homologação (02/11/2026):**
- migration aplicada duas vezes (idempotente) e versão registrada;
- `5a_consultorio_fila.sql` ok; `5a_atendimento_ubs.sql` segue ok;
- rollback: as duas funções voltam ao md5 de antes; o teste falha; reaplicado, o retrato fica igual ao de depois;
- telas conferidas numa página de teste com dados fictícios (fila, saídas, ficha com o tipo obrigatório, fila da recepção);
- `src/lib` (241), testes clínicos (1105), tipos e lint passando.

## 2. Subtarefas técnicas

Com as recomendações:

| Parte | Entrega |
|---|---|
| 2.1 banco | `consultorio` no `tipo_setor`; ficha da UBS; `iniciar_atendimento` sem classificação na UBS; tipo de atendimento, problema/condição e conduta; `registrar_conduta_aps`; BPA sem linha na UBS; testes |
| 2.2 recepção e fila | ficha da UBS na recepção (tipo de atendimento); fila da UBS na tela Atendimento; menu da UBS volta a ter Atendimento como início do médico |
| 2.3 janela da consulta | SOAP, problema/condição e conduta; sem cor nem reclassificação; opções do Refero antes |
| 2.4 escuta inicial | escuta da enfermagem com a classificação do CAB 28; depois da 2.1 a 2.3 |

## 3. Banco (expand/contract e rollback)

- `ALTER TYPE public.tipo_setor ADD VALUE 'consultorio'`, numa migration só, como na tarefa 1. O rollback trava o uso com um CHECK.
- **`episodios`:** colunas novas, todas anuláveis, sem mexer na porta:
  - `tipo_atendimento_aps` (CHECK com os cinco tipos da ficha);
  - `problemas_aps text[]` (CHECK pela lista da ficha);
  - `cid_aps text[]`;
  - `conduta_aps text[]` (CHECK pela lista da ficha).

  O rollback é DROP dessas colunas, que só a UBS usa.
- **Um novo valor de `etapa`?** Não. A consulta da UBS usa `atendimento` e `encerrado`. A UBS entra direto em `atendimento`, porque não tem triagem obrigatória (D3).
- **Funções:**
  - `registrar_ficha`: ganha um ramo para o setor `consultorio` em unidade UBS;
  - `bpa_i_linhas`: deixa de fora o episódio de UBS;
  - as duas trocas são feitas na definição atual, como no lote VD.

## 4. Backend e RPC

| RPC | Mudança | Permissão | Estados | Auditoria | Repetida |
|---|---|---|---|---|---|
| `registrar_ficha` | aceita setor `consultorio` numa UBS, com `p_dados.tipo_atendimento` | recepção ou plantão do setor, como hoje | cria o episódio em `atendimento` | a de hoje | a de hoje: um episódio aberto por paciente |
| `iniciar_atendimento` | sem mudança: a UBS já nasce em `atendimento` | `medico_na_porta` de hoje (setor na escala de agora e papel plantonista; não olha o tipo do setor) | o de hoje | o de hoje | o de hoje |
| `registrar_conduta_aps` (nova) | `(p_episodio uuid, p_tipo text, p_problemas text[], p_cids text[], p_condutas text[], p_obs text)` encerra a consulta da UBS | o médico do atendimento, de plantão no consultório | `atendimento` → `encerrado`; exige SOAP com Avaliação e ao menos um problema e uma conduta | `consulta_aps_encerrada` | episódio já encerrado: erro claro |
| `registrar_desfecho` | recusa o episódio de UBS: a consulta da UBS encerra pela conduta (a ida à urgência é uma conduta) | o de hoje | o de hoje | o de hoje | o de hoje |

## 5. Frontend

- **Recepção da UBS:** "Nova ficha" com o tipo de atendimento. A ficha vai ao consultório, sem a fila da triagem.
- **Atendimento:**
  - a fila da UBS ordena por chegada, com a prioridade legal;
  - a janela tira a cor, a reclassificação e o tempo-alvo;
  - a aba "Conduta" traz o tipo de atendimento, o problema/condição avaliada (lista mais CID-10), as condutas e o encaminhamento SMS003a para serviço especializado.
- **Menu da UBS:** o início do médico passa a ser Atendimento.
- O layout sai de opções do Refero, com escolha do RT.

## 6. Permissões e auditoria

- Nenhuma policy nova. O acesso continua pela escala do setor (D2).
- **Testes de banco:**
  - a ficha num consultório de UPA é recusada;
  - a ficha num setor de emergência de UBS é recusada;
  - o médico fora da escala não registra;
  - a conduta exige problema e conduta;
  - o evento `consulta_aps_encerrada` vai para a cadeia de auditoria.

## 7. Testes

- **`supabase/tests/5a_atendimento_ubs.sql`:**
  - ficha, consulta, SOAP e conduta numa UBS;
  - a mesma ficha recusada numa UPA, e a ficha da porta igual;
  - BPA sem linha da UBS;
  - CHECKs das listas.
- **Testes de tela:** a fila da UBS sem cor e a aba Conduta com as listas da ficha.
- **Regressão:**
  - os testes de banco da porta (`fase2_*`, `portao*`, BPA);
  - `src/lib`, os testes clínicos, os tipos e o lint.

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| UBS registra atendimento básico | teste do banco do caminho inteiro; na homologação, uma consulta numa UBS de teste, da ficha à conduta |
| Evolução, CID/CIAP, conduta e encaminhamento | SOAP mais problema/condição com CID-10 (a CIAP-2 fica para a tarefa 4), conduta da ficha e SMS003a, todos no teste |
| A porta não muda | testes de banco e de tela da porta passando sem alteração |

## 9. Riscos

- **A tarefa é grande.** Por isso vai em quatro partes (2.1 a 2.4), cada uma com o próprio PR.
- **Escala na UBS (D2A):** o gestor precisa montar a escala do expediente. Sem ela, ninguém atende. A escala fixa semanal já existe.
- **Listas da ficha:** o MS pode ter mudado alguma desde a versão 2.1 (2016). Confiro na versão atual antes do envio ao SISAB. Para o registro clínico, a lista de 2016 basta.
- **Telas abertas por endereço direto:** a porta continua bloqueada pelo banco numa UBS, porque o setor não é de emergência.

## 10. Ordem de implementação

1. As decisões D1 a D7.
2. A parte 2.1 (banco), na homologação, com o rollback testado.
3. O "ok produção".
4. As partes 2.2 e 2.3 (telas), com as opções do Refero antes.
5. A parte 2.4 (escuta inicial), com a escala do CAB 28 conferida na fonte.

## 11. Demonstração comercial

A mesma secretaria acompanha a UPA e a UBS no mesmo prontuário. Por exemplo, o paciente atendido na UBS de manhã chega à UPA à noite com o SOAP, os problemas e as condutas da consulta já à vista. A UBS registra no padrão da ficha do e-SUS APS desde o primeiro dia, e isso prepara o envio ao SISAB sem redigitar.
