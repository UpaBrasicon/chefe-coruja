# Cenários A — obstetrícia, materno-infantil e pediatria

Bloco A do catálogo de cenários de teste ponta a ponta da rede (BACKLOG, "Teste ponta a ponta da rede", tarefa 1). Cada cenário percorre a rede de teste F5 da homologação (UBS → UPA → Hospital → Central), papel por papel, com as telas, as RPCs e as tabelas que o `MAPA.md` confirma no código. Nada aqui foi executado contra banco; nenhuma dose ou conduta vem de memória — o cenário remete à ferramenta do sistema pelo id e pela fonte do MAPA (seção 4). A cor da classificação é sempre decisão da enfermeira de teste. Os custos são **fictícios** e servem só para conferir o campo e o momento em que nascem (MAPA, seção 3).

Convenções: contas `*.f5@teste.local` (MAPA 5.1); unidades UBS Fase 5 (`f5100000-…-0001`), UPA Fase 5 24h (`…-0002`, setores Pronto Socorro `…-011`, Observação Adulto `…-012`, Internação `…-013`), Hospital Fase 5 (`…-0003`, Clínica Médica `…-021`) e Central de Regulação Fase 5 (`…-0009`). Antes de cada sessão roda-se `scripts/e2e/41_checkin_fase5.sql` ou faz-se o check-in na tela (MAPA 6, "Janela de escala"). Datas de nascimento são relativas ao dia do teste, porque o corte pediátrico (`ehPediatrico`, 14 anos) e o cadastro "RN de" (27 dias) são contados a partir de hoje.

## Índice

| Id | Título | Rede | Papéis que cobre |
|---|---|---|---|
| A01 | Pré-natal na UBS → pré-eclâmpsia grave e eclâmpsia na UPA → regulação ao hospital → contrarreferência e conta | UBS, UPA, Central, Hospital | recepção, enfermeiro, médico e gestor da UBS; recepção, enfermeiro, médico, farmacêutico, NIR, faturamento e gestor da UPA; regulador; médico do hospital |
| A02 | Gestante hipertensa no hiperdia e no pré-natal com envio à UPA que "não chegou" em 12 h | UBS, UPA (recepção) | recepção, enfermeiro, médico, técnico e gestor da UBS; recepção da UPA |
| A03 | Puericultura que vira bronquiolite na UPA, com observação pediátrica | UBS, UPA | técnico e enfermeiro da UBS; recepção, enfermeiro, médico e farmacêutico da UPA |
| A04 | Duas crianças no mesmo plantão: 13a 11m 29d e 14a 0d (corte de idade: triagem, Central, Fugulin, prescrição com peso) | UPA | recepção, enfermeiro, médico do PS e médico da internação da UPA |
| A05 | Anafilaxia pediátrica na porta da UPA, com liberação da farmácia | UPA | recepção, enfermeiro, médico, farmacêutico e faturamento da UPA |
| A06 | Recém-nascido vinculado à mãe e regulação neonatal com incubadora | UPA, Central, Hospital | recepção, enfermeiro, médico, NIR e gestor da UPA; regulador; médico do hospital |

Regras que valem em todos (MAPA, seção 6): pediatria até 13a 11m 29d; a cor é da enfermagem; o autor é o login; peso aferido, estimado ou referido antes de qualquer prescrição; sinais vitais impressos crus; só homologação.

---

### A01 — Pré-natal na UBS → pré-eclâmpsia grave e eclâmpsia na UPA → regulação ao hospital

- **Objetivo:** provar o caminho inteiro da rede com uma gestante: acompanhamento no pré-natal da UBS (consultas, datas, pressão registrada), piora numa consulta, envio à UPA, chegada, triagem, atendimento com pré-eclâmpsia grave que evolui para eclâmpsia, prescrição remetida à ferramenta do sistema, checagem pela enfermagem, observação, regulação de transferência ao hospital (solicitação, fila, decisão, aceite, reserva de leito, NIR), transferência, internação no hospital, contrarreferência à UBS e conta com custos.
- **Rede e unidades:** UBS Fase 5 → UPA Fase 5 24h (PS e Observação Adulto) → Central de Regulação Fase 5 → Hospital Fase 5 (Clínica Médica) → de volta à UBS Fase 5.
- **Papéis e contas de teste:** `recepcao.ubs.f5`, `enfermeiro.ubs.f5`, `medico.ubs.f5`, `gestor.ubs.f5`; `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `nir.f5`, `faturamento.f5`, `gestor.upa.f5`; `regulador.f5`; `medico.hospital.f5`.
- **Paciente fictício:** Helena F5 Gestante, 29 anos (nascida em 1997-05-10), sexo F, CNS fictício válido, raça/cor "parda", G2P1A0, DUM = hoje − 230 dias (cerca de 32–33 semanas), sem comorbidade declarada. Peso referido na UPA.
- **Pré-condições:** rede F5 criada (`40_rede_fase5.sql`) e escalas do dia com check-in (`41_checkin_fase5.sql`); `gestor.ubs.f5` configurou a agenda de `medico.ubs.f5` (`agenda_definir_configuracao`); na UPA, `bpa_procedimentos_unidade` tem código SIGTAP associado aos usos `classificacao`, `atendimento_medico` e `medicacao` (`associar_procedimento_bpa`, como `supabase/homolog/faturamento-teste.sql` faz na UPA Homologação); catálogo de medicamentos com os itens que a ferramenta cita (`cadastrar_medicamento`, `registrar_entrada_estoque`); `alta_vigilancia_da_unidade` conferida pelo farmacêutico; Hospital F5 com leito CM livre e serviço ofertado no mapa de vagas (`regulacao_ofertar_setor`, `regulacao_confirmar_servico`); central definida (`centrais_regulacao`). Consultas anteriores do pré-natal podem ser carregadas pela tarefa 2 com datas passadas; no teste de tela faz-se a consulta de hoje.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção UBS | `/recepcao` (Nova ficha) | Cadastra Helena e abre ficha `consulta_programada` (1ª consulta do pré-natal, semana 10, data passada se carregada; senão hoje) | Episódio aberto na UBS; sem conta com valor | `registrar_ficha` → `episodios.tipo_atendimento_aps = 'consulta_programada'`; `contas` não ganha item (MAPA 3.7, UBS) |
| 2 | enfermeiro UBS | `/escuta` | Escuta inicial com sinais vitais crus (PA, FC, peso, altura em cm) e saída `consulta` | Fila do médico recebe Helena | `registrar_escuta_aps(p_episodio, p_cor, 'consulta', …, p_sinais)`; técnico é recusado se tentar |
| 3 | médico UBS | `/atendimento` (UBS) | SOAP com problema "pré-natal" e CID/CIAP de gestação; inclui no pré-natal com a DUM | Helena entra no painel do pré-natal com IG calculada | `registrar_soap`, `registrar_conduta_aps(…, p_ciaps)`, `pre_natal_incluir(p_paciente, p_dum, p_episodio)`; `pre_natal_do_paciente` mostra `primeira` feita até 12 s |
| 4 | recepção UBS | `/agenda-consultas` | Marca e registra chegada das consultas seguintes (IG 16, 22, 28 s) | Cada chegada abre um episódio `consulta_agendada` | `agenda_marcar`, `agenda_registrar_chegada(p_agendamento, p_setor, p_queixa)`; `agendamentos.situacao = 'presente' → 'realizado'` |
| 5 | médico UBS | `/atendimento` | Em cada consulta, SOAP com PA no "O" (valores crus) e peso/altura | Itens `consultas`, `pa`, `peso_altura` do painel com data | `pre_natal_do_paciente`; `src/domain/preNatal.ts` (as datas vêm dos episódios) |
| 6 | gestor UBS | `/pre-natal` | Abre o painel da unidade | Helena aparece com os itens feitos e os pendentes (`testes_3tri` a partir de 28 s) | `pre_natal_painel` |
| 7 | enfermeiro UBS | `/escuta` | Consulta de hoje (IG ~33 s): escuta com PA elevada, cefaleia e edema, registrados crus; **a enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste)** | Saída `consulta`, fila do médico | `registrar_escuta_aps(p_cor = 'vermelho', …)` |
| 8 | médico UBS | `/atendimento` → `EnviarUpa.tsx` | SOAP com hipótese de pré-eclâmpsia grave (CID de pré-eclâmpsia existente em `terminologia.cid10`) e envio à UPA Fase 5 com motivo | Envio `enviado`, leva queixa, cor da escuta, último SOAP e sinais | `registrar_soap(…, p_cid)`, `encaminhar_upa(p_episodio, p_destino = UPA F5, p_motivo)` → `encaminhamentos_upa.situacao = 'enviado'` |
| 9 | gestor UBS | `/encaminhados` | Acompanha o envio | Linha "enviado" com hora | `encaminhamentos_upa_origem` |
| 10 | recepção UPA | `/recepcao` → `VindoDaUbs.tsx` | Vê Helena "vinda da UBS", abre a ficha (setor Pronto Socorro, queixa) e marca "Chegou" **com a ficha escolhida** | Episódio na UPA; conta ambulatorial aberta sem itens; envio passa a `chegou` | `encaminhamentos_upa_destino`, `registrar_ficha`, `encaminhamento_upa_marcar_chegada`; `trg_conta_do_episodio` → `contas` (`tipo='ambulatorial'`, `status='aberta'`) |
| 11 | enfermeiro UPA | `/triagem` (`Fila.tsx` → `Classificar.tsx`) | Chama, registra sinais vitais crus, preenche o bloco de gestação (G2P1A0, DUM, IG) e escolhe um fluxograma adulto do protocolo da unidade; **a enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste)** | Classificação gravada com a cor escolhida; item "acolhimento com classificação" nasce na conta | `chamar_paciente`, `classificar_risco(p_episodio, p_cor, p_sinais, p_fluxograma, p_discriminador, …, p_gestacao)` → `classificacoes_risco`; `private.normalizar_gestacao`; `conta_detalhe` mostra o item |
| 12 | médico UPA | `/atendimento` (`JanelaAtendimento.tsx`) | Assume, registra peso **referido**, SOAP com CID de pré-eclâmpsia grave; abre a Central em `/plantonista/emergencias/emergencia-hipertensiva-adulto` e usa o alvo `eclampsia` e o bloco de sulfato de magnésio | Item "consulta médica" nasce na conta; ferramenta aberta com fonte visível | `iniciar_atendimento` → `episodios.atendimento_medico_id`; `registrar_soap`; ficha `adulto-emergencia-hipertensiva` (fonte: HC cap. 19; Diretriz Brasileira de Hipertensão 2025 cap. 11; OMS 2017 Box S-4/S-5; OMS 2011 rec. 12–15) |
| 13 | médico UPA | aba Prescrição (`PrescricaoEstruturada.tsx`) | Prescreve sulfato de magnésio (ataque e manutenção) e anti-hipertensivo **conforme a ferramenta `adulto-emergencia-hipertensiva`** (bloco "Sulfato de magnésio — pré-eclâmpsia grave e eclâmpsia (OMS)" e "Hidralazina — pré-eclâmpsia ou eclâmpsia"); frequência com horário na porta | Itens ativos; se o catálogo marcar o item como alta vigilância, ele fica aguardando liberação | `prescrever(p_paciente, p_item)`, `prescricao_porta_ativa`; `alta_vigilancia_da_unidade`; sem peso o servidor recusa ([M]`20261121000001`) |
| 14 | farmacêutico | `/farmacia` (fila de validação) e `/alta-vigilancia` | Valida e libera os itens de alta vigilância; dispensa para 24 h | `validacoes_prescricao` com `confere`; dispensação gravada **sem valor** | `fila_validacao`, `validar_item`, `itens_para_dispensar`, `dispensar_item` → `dispensacoes`; `private.conta_medicamentos` lista o item na conta da porta sem valor |
| 15 | enfermeiro UPA | `/checagem` | Apraza e checa "feito" a dose de ataque e a 1ª de manutenção; registra sinais crus (PA, FR, reflexos e diurese conforme a ferramenta pede monitorar) | Administração gravada; item "administração de medicamento" nasce na conta (1 por paciente/profissional/dia). **Lacuna (MAPA 2.7): dupla checagem não tem tela** — o testador confere a liberação da farmácia no item e, se quiser provar a RPC legada, `estado_dupla_checagem` pelo SQL Editor | `aprazar`, `checar(p_item, 'feito', p_horario)` → `administracoes`; `conta_detalhe` |
| 16 | enfermeiro UPA | `/checagem` (borda) | Tenta checar um item de alta vigilância ainda sem liberação | Só passa com motivo ≥ 10 letras e fica `sem_liberacao = true` | `checar(…, p_motivo)`; `administracoes_sem_liberacao` para o farmacêutico |
| 17 | médico UPA | aba Reavaliação | Registra crise convulsiva (eclâmpsia): reavaliação com sinais crus, Glasgow pela ficha `glasgow`, atualiza SOAP/CID para eclâmpsia; ajusta prescrição **conforme `adulto-emergencia-hipertensiva`** (toxicidade do magnésio: `TOXICIDADE_MAGNESIO`) | Reavaliação e alteração gravadas com autor = login | `registrar_reavaliacao`, `alterar_item_prescricao` (item alterado é item novo para a farmácia), `classificar_risco` só se o médico quiser reclassificar (motivo ≥ 10) |
| 18 | médico UPA | aba Desfecho | Desfecho `observacao` | Box livre da Observação Adulto; pendência de 6 h ativa | `registrar_desfecho(p_episodio, 'observacao', …)`; `private.box_livre`; `painel_observacao` |
| 19 | enfermeiro UPA | `/enfermagem/pronto-socorro` e `/plantao/observacao` (acompanha) | Sinais vitais seriados crus, SAE, balanço (diurese) | Registros no box com autor | `registrar_avaliacao`, `registrar_sae`, `lancar_balanco` |
| 20 | médico UPA | `/regulacao` (NovaSolicitacao) | Solicita regulação `tipo = 'transferencia'`, prioridade proposta `emergencia`, vulnerabilidade `gestante`, SIGTAP e CID da hipótese, quadro ≥ 20 letras, transporte obrigatório, anexa a prescrição | Solicitação `enviada` para a Central F5 | `regulacao_solicitar` → `regulacao_solicitacoes.status = 'enviada'`, `regulacao_eventos`; `regulacao_registrar_anexo` → bucket `regulacao` |
| 21 | regulador | `/regulacao` (Fila → Detalhe → PainelDecisao) | Assume, prioriza como `emergencia` e autoriza com destino Hospital Fase 5 | `em_analise` → `aguardando_destino`; `prioridade_regulador` separada da proposta | `regulacao_fila`, `regulacao_assumir`, `regulacao_priorizar`, `regulacao_autorizar` |
| 22 | NIR UPA | `/nir` | Vê a pendência `reg_destino` enquanto o hospital não responde; cobra | `nir_cobrancas` com a cobrança; o NIR **não** aceita destino | `nir_pendencias`, `nir_cobrar` |
| 23 | médico hospital | `/regulacao` (destino) | Aceita e escolhe o leito CM | `autorizada`; reserva de leito até max(agora + 24 h, previsto + 8 h) | `regulacao_destino_lista`, `regulacao_leitos_destino`, `regulacao_destino_aceitar` → `regulacao_destino_respostas`, `reservas_leito` |
| 24 | médico UPA | `/plantao/observacao` | Encerra a observação com desfecho de transferência, CID e relato | Episódio encerrado; contrarreferência criada para a UBS (se o encerramento pela observação não a gerar, registrar como achado: o MAPA só garante o gatilho em `registrar_desfecho`/`dar_alta`) | `finalizar_observacao(p_internacao, 'transferencia', p_cid, p_relato, p_detalhes)`; `contrarreferencias_da_unidade` na UBS |
| 25 | NIR ou médico UPA | `/nir` ou `/regulacao` | Marca saída | `em_transito` | `regulacao_marcar_saida` |
| 26 | médico hospital | `/regulacao` → `/recepcao` (sem recepção escalada no Hospital F5) → `/atendimento` | Marca chegada; **a chegada regulada não cria a internação**: abre ficha, assume e interna no leito CM reservado | `realizada`; conta de internação aberta no hospital | `regulacao_marcar_chegada(true)`; `registrar_ficha`, `iniciar_atendimento`, `registrar_desfecho('internacao', p_detalhes.leito_id)`; `trg_conta_da_internacao` → `contas` (`tipo='internacao'`) |
| 27 | médico hospital | caderno do leito (`PacientesInternados.tsx`) | Admissão, diagnóstico e laudo de AIH com o procedimento principal | AIH `solicitada` pelo gatilho; procedimento principal (`valor_sh + valor_sp`) na conta | `registrar_admissao`, `registrar_diagnostico`, `documentos_clinicos` tipo `laudo_aih` → `trg_aih_do_laudo` → `aihs`, `aih_eventos` |
| 28 | regulador | `/aih` | Decide a AIH | `aprovada` (ou `rejeitada` com crítica) | `decidir_aih`; `conferir_aih` usa `sigtap_procedimento_cid` |
| 29 | recepção/enfermeiro/médico UBS | `/encaminhados` (`Retornos.tsx`) | Abre a contrarreferência | `a_ver → visto`; painel do pré-natal continua até o desfecho da gestação | `contrarreferencia_abrir`, `contrarreferencias_do_paciente`; `pre_natal_do_paciente` |
| 30 | faturamento UPA | `/faturamento/contas` | Conduz a conta da porta: `aberta → em_conferencia`, confere itens, lança material sem valor | Pendências da pré-auditoria visíveis; total de referência calculado | `contas_da_unidade`, `conta_detalhe`, `mudar_etapa_conta`, `conta_lancar_material`, `contas_pendencias_resumo` |
| 31 | gestor UPA | `/faturamento/contas` | Libera o fechamento se houver pendência de aviso; faturamento fecha e fatura | `fechada → faturada`; itens congelados; versão para o ERP | `liberar_fechamento_conta`, `mudar_etapa_conta`; `contas.itens_congelados`; `trg_erp_versao` → `conta_versoes_erp` |
| 32 | faturamento UPA | `/faturamento` (BPA) | Confere as linhas do mês | Linhas BPA-I da classificação, consulta e medicação; a UBS não gera linha | `bpa_conferencia`; críticas bloqueantes de CNS/CBO do profissional se faltarem |

**Regulação:** `enviada` (médico UPA) → `em_analise` (regulador assume) → `aguardando_destino` (autoriza, destino Hospital F5) → `autorizada` (médico do hospital aceita e reserva leito CM) → `em_transito` (saída marcada pela origem) → `realizada` (chegada marcada pelo destino). Prazos padrão da central: destino 24 h, pendência 3 h, evolução 12 h; o cron `regulacao-sla-avisos` só alerta (`notificacoes_plantonista` tipo `reg_prazo_destino_<n>`). O NIR cobra (`nir_cobrar`) e não decide.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| UBS: escuta, 5 consultas de pré-natal, envio à UPA | — | — | R$ 0,00 | R$ 0,00 | Nada: a UBS não gera conta com valor nem linha de BPA (MAPA 3.7, decisão D6) |
| Acolhimento com classificação de risco (UPA) | SIGTAP do uso `classificacao` (ex.: 0301060118, como em `faturamento-teste.sql`) | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco` (1ª do episódio) → `private.conta_itens` com `valor_sa`; momento: passo 11 |
| Consulta médica em urgência (UPA) | SIGTAP do uso `atendimento_medico` (ex.: 0301060096) | 1 | R$ 20,00 | R$ 20,00 | `episodios.atendimento_medico_id` quando o médico assume; passo 12 |
| Administração de medicamento (UPA) | SIGTAP do uso `medicacao` (ex.: 0301100012) | 1 por paciente/profissional/dia | R$ 5,00 | R$ 5,00 | `administracoes` com `situacao='feito'`; passo 15 |
| Sulfato de magnésio e hidralazina dispensados | — | conforme dispensado | sem valor | sem valor | `dispensacoes` → `private.conta_medicamentos`; passo 14. **Lacuna:** medicamento não tem preço na conta |
| Material (equipo, cateter) | SIGTAP opcional do grupo 07 | 2 | sem valor | sem valor | `conta_materiais` lançado pelo faturamento; passo 30 |
| Transporte e regulação | — | — | R$ 0,00 | R$ 0,00 | Nada: regulação não gera valor (MAPA 3.7) |
| Internação no hospital: procedimento principal da AIH | procCod do laudo | 1 | R$ 1.000,00 (SH R$ 800,00 + SP R$ 200,00) | R$ 1.000,00 | `aihs` + `documentos_clinicos.conteudo->'aih'->>'procCod'`; momento: laudo ativo (passo 27). **Lacuna (MAPA 5.1):** não há conta de faturamento nem gestor no Hospital F5; a conta da internação é conferida na tabela `contas` pelo SQL Editor |
| **Total fictício da conta da UPA** | | | | **R$ 35,00** | `conta_detalhe.total_referencia`; congelado em `contas.itens_congelados` ao fechar (passo 31) |

**Critérios de aceite:**
- O painel do pré-natal mostra `primeira`, `consultas`, `pa` e `peso_altura` com as datas dos episódios e nenhum valor de conduta (é só painel).
- O envio à UPA carrega queixa, cor da escuta, último SOAP e sinais; "Chegou" só é aceito com a ficha escolhida.
- A cor registrada em `classificacoes_risco` é exatamente a que a enfermeira escolheu; nenhum texto da tela diz "sugerido".
- A prescrição sem peso é recusada pelo servidor; com peso referido, passa.
- O item de alta vigilância só sai da fila com `validar_item` = `confere`; a checagem sem liberação exige motivo ≥ 10 e aparece em `administracoes_sem_liberacao`.
- A regulação percorre `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` com um evento por transição em `regulacao_eventos`; a reserva de leito aparece em `reservas_leito`.
- No hospital, a chegada não cria internação: a internação só existe depois de `registrar_desfecho('internacao')`.
- A contrarreferência aparece na UBS como `a_ver` e vira `visto`.
- A conta da UPA tem três itens com valor (classificação, consulta, medicação) e os medicamentos/materiais sem valor; o total congelado é igual ao calculado antes do fechamento.
- Todo registro tem autor = conta logada (`administracoes`, `documentos_clinicos`, `regulacao_eventos`).

**Bordas a provar:**
- Técnico da UBS tentando fazer a escuta: recusado.
- "Chegou" sem ficha: a tela não permite (PR #438).
- Reclassificação pela enfermagem depois de `iniciar_atendimento`: recusada; pelo médico, só com motivo ≥ 10.
- Checar dose vencida depois do encerramento da observação: a saída só passa com as doses vencidas feitas ou não feitas com motivo.
- Regulação sem transporte, sem SIGTAP, sem CID válido ou com quadro < 20 letras: recusada.
- Destino recusando com motivo < 10 letras: recusado; recusa válida devolve à central.
- Fechar a conta antes do desfecho: recusado; reabrir conta fechada só pelo gestor com motivo ≥ 10.
- Faturamento tentando abrir `/aih`: não tem rota.

**Lacunas tocadas:**
- Lacuna (MAPA): não há ficha própria de pré-eclâmpsia, eclâmpsia, HELLP ou sulfato de magnésio; o testador confere o bloco dentro de `adulto-emergencia-hipertensiva`.
- Lacuna (MAPA): não há fluxograma "Gestante" no protocolo Aparecida 2025; a enfermeira escolhe um fluxograma adulto e o bloco de gestação só acompanha o registro.
- Lacuna (MAPA): escore obstétrico (MEOWS) não existe; `news2` diz que não se aplica à gestante — o testador confere a mensagem.
- Lacuna (MAPA): dupla checagem sem tela; substituída pela liberação da farmácia.
- Lacuna (MAPA): medicamento, material e transporte sem valor na conta; não há diária de leito.
- Lacuna (MAPA): sem conta de faturamento, gestor ou recepção no Hospital F5; sem maternidade ou UTI na rede F5 (o leito CM faz as vezes de destino).
- Lacuna (MAPA): a chegada regulada não cria a internação no destino.
- Lacuna (MAPA): `conduta_aps` não grava "encaminhamento à UPA" como conduta própria; o envio é `encaminhar_upa`.

---

### A02 — Gestante hipertensa no hiperdia e no pré-natal com envio que "não chegou" em 12 h

- **Objetivo:** provar o painel do hiperdia e do pré-natal na mesma paciente, o envio à UPA pela escuta, o prazo de 12 h que marca `nao_chegou`, o acompanhamento pela UBS e o que a recepção da UPA consegue fazer quando a paciente aparece depois do prazo.
- **Rede e unidades:** UBS Fase 5; UPA Fase 5 24h (só a recepção).
- **Papéis e contas de teste:** `recepcao.ubs.f5`, `enfermeiro.ubs.f5`, `tecnico.ubs.f5`, `medico.ubs.f5`, `gestor.ubs.f5`; `recepcao.upa.f5`.
- **Paciente fictício:** Marta F5 Hipertensa, 36 anos (nascida em 1990-08-15), sexo F, hipertensa crônica já incluída no hiperdia, DUM = hoje − 170 dias (cerca de 24 semanas), CPF fictício válido.
- **Pré-condições:** rede F5 e check-in do dia; Marta já no hiperdia (`programa_incluir`) com consulta e PA registradas há mais de 6 meses, para o painel mostrar pendência; agenda do médico configurada.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | gestor UBS | `/hiperdia` | Abre o painel | Marta com `pa` e `consulta` vencidos (regra de 6 meses em `src/domain/hiperdia.ts`) | `hiperdia_painel`, `hiperdia_do_paciente` |
| 2 | técnico UBS | `/hiperdia` e `/pre-natal` | Só lê os painéis | Não consegue incluir, retirar nem registrar avaliação | Rotas de leitura; `registrar_avaliacao_pes` e `programa_incluir` recusados ao técnico |
| 3 | recepção UBS | `/agenda-consultas` | Chegada da consulta agendada de hoje | Episódio `consulta_agendada` | `agenda_registrar_chegada` |
| 4 | médico UBS | `/atendimento` → `HiperdiaNaConsulta.tsx` | Consulta com PA crua no "O", peso/altura, problema "pré-natal" e inclusão no pré-natal com a DUM; avaliação dos pés não se aplica (sem diabetes) — deixa em branco | Hiperdia e pré-natal atualizados pelo mesmo episódio | `registrar_soap`, `registrar_conduta_aps`, `pre_natal_incluir`; `hiperdia_do_paciente` e `pre_natal_do_paciente` com a data de hoje |
| 5 | recepção UBS | `/recepcao` | Marta volta no mesmo dia, à tarde, com cefaleia e PA alta: ficha `escuta_inicial` | Episódio novo | `registrar_ficha` com `tipo_atendimento = 'escuta_inicial'` |
| 6 | enfermeiro UBS | `/escuta` | Escuta com sinais crus; **a enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste)**; envia à UPA pela própria escuta com motivo | Envio `enviado`; a escuta vermelha vai à fila do médico, mas a paciente sai para a UPA | `registrar_escuta_aps(p_cor = 'vermelho', p_saida = 'consulta')`, `encaminhar_upa(p_episodio, UPA F5, p_motivo)` → `encaminhamentos_upa` |
| 7 | gestor UBS | `/encaminhados` | Acompanha | Linha `enviado` com a hora | `encaminhamentos_upa_origem`, `encaminhamentos_upa_do_paciente` |
| 8 | — (cron) | — | Passam 12 h sem registro de chegada na UPA. **O testador antecipa o prazo só na homologação (ajuste de `enviado_em` pelo SQL Editor) ou aguarda** | `situacao = 'nao_chegou'` | cron `encaminhamento-upa-prazo`; `encaminhamentos_upa.situacao` |
| 9 | médico UBS | `/encaminhados` | Vê `nao_chegou`; registra o contato no próximo episódio (não há campo próprio de busca ativa) | Painel da UBS mostra o não comparecimento | `encaminhamentos_upa_origem`; **Lacuna (MAPA): ACS e busca ativa não existem no app** — o testador confere só a marca `nao_chegou` |
| 10 | recepção UPA | `/recepcao` → `VindoDaUbs.tsx` | 14 h depois do envio, Marta aparece na UPA. A recepção procura o envio | Comportamento a registrar: se o envio `nao_chegou` ainda aparecer em `encaminhamentos_upa_destino`, "Chegou" com ficha escolhida muda a situação; se não aparecer, a recepção abre ficha comum e o envio fica `nao_chegou` (achado, não falha) | `encaminhamentos_upa_destino`, `encaminhamento_upa_marcar_chegada`, `registrar_ficha` |
| 11 | recepção UPA | `/recepcao` (borda) | Tenta marcar "Chegou" sem abrir ficha | Não permite (PR #438) | — |
| 12 | enfermeiro UBS | `/encaminhados` (borda) | Tenta cancelar um envio já `nao_chegou` | Recusado ou sem efeito; cancelar só vale em `enviado` (coorte F5 #4) | `encaminhamento_upa_cancelar` |

**Regulação:** não há.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Hiperdia, pré-natal, consulta e escuta na UBS | — | — | R$ 0,00 | R$ 0,00 | Nada: a UBS não gera conta nem linha de BPA (MAPA 3.7) |
| Ficha na UPA (passo 10, se aberta) | — | 1 | R$ 0,00 | R$ 0,00 | `contas` ambulatorial aberta pelo `trg_conta_do_episodio`, ainda sem itens; o primeiro valor só nasce na classificação |

**Critérios de aceite:**
- O mesmo episódio alimenta `hiperdia_do_paciente` e `pre_natal_do_paciente` (consulta, PA, peso/altura com a data de hoje).
- O técnico lê os painéis e não grava nada neles.
- O envio pela escuta vermelha fica `enviado` e, 12 h sem chegada, `nao_chegou`, sem intervenção da UBS.
- A UBS vê a situação em `/encaminhados`; a marca não some quando a paciente aparece depois do prazo sem ligar o envio.
- A escuta vermelha gravou `p_cor = 'vermelho'` escolhido pela enfermeira.

**Bordas a provar:**
- Escuta `azul` com saída `orientacao` encerra sem fila do médico (contraste com a vermelha).
- `programa_incluir` duplicado para a mesma paciente: idempotente ou recusado, sem linha dupla no painel.
- Pré-natal com DUM futura ou sem DUM: `pre_natal_incluir` recusa ou pede `pre_natal_definir_dum`.
- Envio para a própria UBS como destino: recusado.

**Lacunas tocadas:**
- Lacuna (MAPA): "Chegou" na recepção da UPA sem ficha aberta não liga o envio depois.
- Lacuna (MAPA): ACS, busca ativa e visita domiciliar não existem; o não comparecimento fica só como `nao_chegou`.
- Lacuna (MAPA): hiperdia e pré-natal são painéis sem conduta; nenhuma meta de PA é sugerida pelo sistema.
- Lacuna (MAPA): a UBS não gera BPA nem conta com valor.

---

### A03 — Puericultura que vira bronquiolite na UPA, com observação pediátrica

- **Objetivo:** provar o painel de puericultura, a escuta pediátrica na UBS, o envio à UPA, a triagem com fluxograma pediátrico, o atendimento com a ferramenta de bronquiolite, a dispensação pela farmácia, a observação de uma criança numa rede sem setor pediátrico e a volta à puericultura pela contrarreferência.
- **Rede e unidades:** UBS Fase 5 → UPA Fase 5 24h (PS e Observação Adulto, por falta de observação pediátrica) → UBS Fase 5.
- **Papéis e contas de teste:** `recepcao.ubs.f5`, `tecnico.ubs.f5`, `enfermeiro.ubs.f5`, `medico.ubs.f5`; `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `faturamento.f5`.
- **Paciente fictício:** Théo F5 Lactente, 4 meses (nascido em hoje − 4 meses), sexo M, responsável = mãe (Carla F5), nome da mãe preenchido, sem CNS (só aviso no BPA), peso **aferido** na UPA.
- **Pré-condições:** rede F5 e check-in; Théo cadastrado na UBS com menos de 2 anos (entra na puericultura automaticamente) e com a consulta `primeira` registrada até o 30º dia (carga da tarefa 2); catálogo da UPA com os itens que `ped-bronquiolite` cita e estoque de entrada (`registrar_entrada_estoque`); Observação Adulto com box livre.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | técnico UBS | `/puericultura` | Lê o painel | Théo listado, `primeira` feita, `consultas` e `peso_altura` com as datas; teto 60/100 porque ACS e vacina não existem | `puericultura_painel`; `src/domain/puericultura.ts` |
| 2 | recepção UBS | `/recepcao` | Ficha `escuta_inicial`: tosse, "cansaço" e dificuldade para mamar há 2 dias | Episódio na UBS | `registrar_ficha` |
| 3 | enfermeiro UBS | `/escuta` | Escuta com sinais crus (FR, SpO2, temperatura, peso, comprimento em cm); grupo pediátrico escolhido pelo app pela data de nascimento; **a enfermagem classifica; cor esperada no teste: amarelo (escolha da enfermeira de teste)**; saída `consulta` | Fila do médico | `registrar_escuta_aps`; `ehPediatrico` em `EscutaInicial.tsx` l. 71 |
| 4 | médico UBS | `/atendimento` → `EnviarUpa.tsx` | SOAP com CID de bronquiolite existente e envio à UPA por sinais de esforço respiratório, conforme os critérios de encaminhamento da ferramenta `ped-bronquiolite` | Envio `enviado` com queixa, cor, SOAP e sinais | `registrar_soap`, `encaminhar_upa` → `encaminhamentos_upa` |
| 5 | recepção UPA | `/recepcao` → `VindoDaUbs.tsx` | Abre a ficha no PS e marca "Chegou" | `chegou`; conta ambulatorial aberta | `encaminhamento_upa_marcar_chegada`, `registrar_ficha`, `trg_conta_do_episodio` |
| 6 | enfermeiro UPA | `/triagem` | Chama; o app oferece os fluxogramas pediátricos (19 no protocolo Aparecida 2025); sinais crus; **a enfermagem classifica; cor esperada no teste: laranja (escolha da enfermeira de teste)** | `classificacoes_risco` com a cor escolhida; item de classificação na conta | `classificar_risco`; `Classificar.tsx` l. 87 (`ehPediatrico`) |
| 7 | médico UPA | `/atendimento` | Assume; registra peso **aferido**; SOAP; abre `/plantonista/pediatria/bronquiolite-ped` e `/plantonista/pediatria/sinais-vitais-pediatricos` | Item consulta na conta; a Central libera as ferramentas `ped-*` porque o paciente é pediátrico | `iniciar_atendimento`, `registrar_soap`; fichas `ped-bronquiolite` (fonte: ICr caps. 8/29/30; SBP 2024; NT 109/2025-MS; Guia VSR 2026; Australasian Bronchiolitis Guideline 2025) e `ped-sinais-vitais-icr` (fonte: ICr caps. 2, 5, 6, 8); `src/content/publicoFerramentas.ts` |
| 8 | médico UPA | aba Prescrição | Prescreve suporte **conforme a ferramenta `ped-bronquiolite`** (o que ela indica e o que ela diz não usar); nada é convertido de ficha de adulto | Itens ativos com peso aferido | `prescrever`; o servidor recusa sem peso |
| 9 | farmacêutico | `/farmacia`, `/dispensacao` | Valida a prescrição e dispensa a quantidade sugerida para 24 h; confere o saldo | `dispensacoes` tipo `prescricao`; saldo do estoque baixado (pode ficar negativo) | `fila_validacao`, `validar_item`, `itens_para_dispensar`, `dispensar_item`, `extrato_estoque` (`saida_prescricao`) |
| 10 | enfermeiro UPA | `/checagem` | Apraza e checa "feito"; registra SpO2 e FR cruas | Item medicação na conta | `aprazar`, `checar` → `administracoes` |
| 11 | médico UPA | aba Desfecho | `observacao` | **Lacuna (MAPA 5.1): não há setor de observação pediátrica na rede F5** — o box vai para a Observação Adulto; o testador confere que o paciente continua pediátrico na tela (ferramentas e escalas) apesar do setor | `registrar_desfecho('observacao')`; `private.box_livre`; `painel_observacao` |
| 12 | enfermeiro UPA | `/enfermagem/pronto-socorro` (`AbasRegistro.tsx`) | Sinais vitais seriados crus; tenta a Fugulin | Fugulin não aparece para criança; a tela mostra a nota "Fugulin é instrumento do adulto… o instrumento pediátrico (Dini) ainda não está no produto" | `registrar_avaliacao`; `AbasRegistro.tsx` l. 188–192 |
| 13 | médico UPA | `/plantao/observacao` | Reavaliações dentro de 12 h; pendência de 6 h de permanência | Pendência exibida e resolvida | `observacao_reavaliar`, `observacao_reavaliado` |
| 14 | médico UPA | `/plantao/observacao` | Encerra com alta, orientações e CID | Episódio encerrado; contrarreferência para a UBS (ver nota do A01 passo 24) | `finalizar_observacao(p_internacao, 'alta', p_cid, p_relato, p_detalhes)`; `contrarreferencias_da_unidade` |
| 15 | enfermeiro UBS | `/encaminhados` → `/puericultura` | Abre a contrarreferência e confere o painel | `visto`; Théo segue na puericultura, sem item novo (o episódio da UPA não é consulta de puericultura) | `contrarreferencia_abrir`, `puericultura_do_paciente` |
| 16 | faturamento UPA | `/faturamento/contas` e `/faturamento` | Conta em conferência e fechamento; BPA do mês | Três itens com valor; aviso (não crítica) por paciente sem CNS | `conta_detalhe`, `mudar_etapa_conta`, `bpa_conferencia` |

**Regulação:** não há.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| UBS: puericultura, escuta, consulta, envio | — | — | R$ 0,00 | R$ 0,00 | Nada (MAPA 3.7) |
| Acolhimento com classificação (UPA) | SIGTAP do uso `classificacao` | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco`; passo 6 |
| Consulta médica (UPA) | SIGTAP do uso `atendimento_medico` | 1 | R$ 20,00 | R$ 20,00 | `episodios.atendimento_medico_id`; passo 7 |
| Administração de medicamento | SIGTAP do uso `medicacao` | 1 | R$ 5,00 | R$ 5,00 | `administracoes` `feito`; passo 10 |
| Medicamentos dispensados | — | conforme | sem valor | sem valor | `dispensacoes`; passo 9 |
| Observação (permanência no box) | — | 1 | R$ 0,00 | R$ 0,00 | **Lacuna (MAPA): diária de leito e permanência não têm valor** |
| **Total fictício** | | | | **R$ 35,00** | `conta_detalhe.total_referencia` |

**Critérios de aceite:**
- O painel da puericultura inclui Théo sem cadastro no programa (regra: toda criança com menos de 2 anos) e o técnico só lê.
- A triagem oferece o grupo pediátrico pela data de nascimento, sem escolha manual.
- A Central abre `ped-bronquiolite` e `ped-sinais-vitais-icr` e bloqueia ferramentas de público `adulto` para este paciente.
- A prescrição exige peso aferido; a dispensação baixa o estoque e entra na conta sem valor.
- A Fugulin não aparece para a criança; a nota explica a ausência do instrumento pediátrico.
- A contrarreferência chega à UBS e a puericultura não registra o episódio da UPA como consulta do programa.

**Bordas a provar:**
- Médico abrindo uma ficha `adulto-*` com o paciente pediátrico selecionado: bloqueio por público.
- Reavaliação com mais de 12 h na observação: aviso "não é observação".
- Dispensar com saldo zero: passa e o saldo fica negativo (regra documentada), extrato mostra a saída.
- Técnico da UBS tentando `registrar_escuta_aps`: recusado (teste `F5.1.tecnico_nao_classifica`).

**Lacunas tocadas:**
- Lacuna (MAPA): sem setor de observação pediátrica, isolamento ou leito infantil na rede F5.
- Lacuna (MAPA): instrumento pediátrico de classificação de enfermagem (Dini) não existe; Fugulin é só do adulto.
- Lacuna (MAPA): puericultura sem vacina, ACS ou conduta (teto 60/100).
- Lacuna (MAPA): sem valor de medicamento ou de permanência na conta.

---

### A04 — Duas crianças no mesmo plantão: 13a 11m 29d e 14a 0d (corte de idade)

- **Objetivo:** provar, com dois pacientes atendidos lado a lado, que o corte de 14 anos governa a triagem (grupo de fluxogramas), a Central (público das ferramentas), as escalas de trauma ("não se aplica"), a Fugulin na internação e a prescrição com peso — sem nenhuma conversão de adulto para criança.
- **Rede e unidades:** UPA Fase 5 24h (PS e Internação).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `medico.internacao.f5`.
- **Pacientes fictícios:** Luan F5 Treze, nascido em **hoje − 14 anos + 1 dia** (13a 11m 29d: faz 14 amanhã), sexo M, responsável = pai; Bia F5 Quatorze, nascida em **hoje − 14 anos** (14a 0m 0d), sexo F. Ambos: queda de bicicleta com TCE leve e dor no punho, peso **aferido**.
- **Pré-condições:** rede F5 e check-in; dois leitos livres na Internação (`…-013`); o teste **tem de ser feito no mesmo dia civil de Brasília** em que as datas foram calculadas.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção UPA | `/recepcao` | Abre as duas fichas no PS com as datas de nascimento acima | Dois episódios; duas contas ambulatoriais | `registrar_ficha` ×2; `trg_conta_do_episodio` |
| 2 | enfermeiro UPA | `/triagem` | Chama Luan: o app oferece os fluxogramas **pediátricos**; sinais crus; **a enfermagem classifica; cor esperada no teste: amarelo (escolha da enfermeira de teste)** | Cor gravada; grupo pediátrico | `classificar_risco`; `ehPediatrico(nascimento, hoje)` = `anos < 14` em `src/domain/idade.ts` |
| 3 | enfermeiro UPA | `/triagem` | Chama Bia: o app oferece os fluxogramas **adultos** (24); mesma queixa; **a enfermagem classifica; cor esperada no teste: amarelo (escolha da enfermeira de teste)** | Cor gravada; grupo adulto | idem; [M]`20270209000001_corte_14_anos.sql` |
| 4 | médico UPA | `/atendimento` (Luan) | Assume; peso aferido; SOAP com CID de TCE; na Central, `/plantonista/pediatria/pecarn-2-anos-ou-mais` e `/plantonista/pediatria/glasgow-pediatrico`; tenta `/plantonista/escores/canadian-ct-head` e `/plantonista/emergencias/triage-rts-trauma` | PECARN e Glasgow criança abrem; os escores de trauma do adulto devolvem "não se aplica" para menor de 14 anos | fichas `ped-pecarn-maior2-icr` (fonte: ICr cap. 16; Holmes 2013), `ped-glasgow-icr` (ICr cap. 16); `adulto-triage-rts`, `canadian-ct-head` (MAPA 4.6: "não se aplica" < 14) |
| 5 | médico UPA | `/atendimento` (Bia) | Assume; peso aferido; SOAP; na Central, `canadian-ct-head`, `glasgow` e `adulto-triage-rts` | Ferramentas de adulto aplicam-se; `ped-*` bloqueadas por público para esta paciente | `src/content/publicoFerramentas.ts`, `src/lib/pacienteCentral.ts` |
| 6 | médico UPA | aba Prescrição (Luan) | Analgesia **conforme a ferramenta pediátrica da Central (`ped-bolus`, fonte: ICr Apêndice)**, com o peso aferido | Item ativo; o campo de dose é o da ficha pediátrica | `prescrever`; nunca a dose da ficha de adulto dividida |
| 7 | médico UPA | aba Prescrição (Bia) | Analgesia conforme a ficha de adulto pertinente da Central, com o peso aferido | Item ativo | `prescrever` |
| 8 | médico UPA | aba Exames | Pede radiografia do punho para os dois | Pedidos `pedidos` por FHIR se LIS/RIS integrado; sem valor | `pedir_exames`, `exames_da_unidade` |
| 9 | enfermeiro UPA | `/checagem` | Checa "feito" nos dois | Item medicação em cada conta | `checar` → `administracoes` |
| 10 | médico UPA | aba Desfecho (os dois) | `internacao` com `leito_id` na Internação para observação de 24 h (sem setor pediátrico, o mesmo setor para os dois) | Duas internações; duas contas de internação com `conta_origem_id` | `registrar_desfecho('internacao', p_detalhes.leito_id)`; `reservar_leito`; `trg_conta_da_internacao` |
| 11 | médico internação | `/plantao/internacao/pacientes` | Admissão dos dois; `acuidade` (NEWS2) no leito | Em Luan, `news2` não se aplica (pediátrico); em Bia, aplica-se | `registrar_admissao`; `src/clinico/news2.ts` |
| 12 | enfermeiro UPA | `/enfermagem/internacao` (`AbasRegistro.tsx`) | Fugulin em Bia; tenta em Luan | Bia: `CartaoFugulin` grava (12 áreas); Luan: nota "Fugulin é instrumento do adulto… (Dini) ainda não está no produto" | `registrar_fugulin`; `fugulin-12-areas` (fonte: Fugulin 2005; de Brito & Guirardello 2012); `AbasRegistro.tsx` l. 189–192 |
| 13 | médico internação | caderno do leito (borda de virada) | No dia seguinte (Luan com 14a 0d), abre a Central com Luan selecionado | A Central passa a tratar Luan como adulto; as fichas `ped-*` ficam bloqueadas e a Fugulin passa a aparecer; os registros antigos continuam com autor e data originais | `faixaEtaria()` recalculada pela data de hoje; `administracoes`, `documentos_clinicos` imutáveis |
| 14 | médico internação | `FormularioAlta` | Alta melhorada dos dois, pacote de alta | `dar_alta('alta_melhorada')`; `/alta/:token` | `impeditivos_alta`, `dar_alta`, `gerar_pacote_alta` |

**Regulação:** não há.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Classificação (Luan e Bia) | SIGTAP do uso `classificacao` | 2 | R$ 10,00 | R$ 20,00 | `classificacoes_risco`; passos 2–3 |
| Consulta médica (Luan e Bia) | SIGTAP do uso `atendimento_medico` | 2 | R$ 20,00 | R$ 40,00 | `episodios.atendimento_medico_id`; passos 4–5 |
| Administração de medicamento | SIGTAP do uso `medicacao` | 2 | R$ 5,00 | R$ 10,00 | `administracoes`; passo 9 |
| Radiografia do punho | — | 2 | sem valor | sem valor | **Lacuna (MAPA): exame não tem valor na conta** |
| Internação (contas de internação) | — | 2 | R$ 0,00 | R$ 0,00 | `internacoes.internado_em` abre a conta; sem AIH neste cenário, sem valor (**Lacuna:** diária de leito) |
| **Total fictício (duas contas da porta)** | | | | **R$ 70,00** | `conta_detalhe` de cada conta; a conta de internação aponta `conta_origem_id` |

**Critérios de aceite:**
- Luan recebe os fluxogramas pediátricos e Bia os adultos, sem escolha manual, no mesmo plantão.
- Os escores de trauma do adulto respondem "não se aplica" para Luan; a Central bloqueia `ped-*` para Bia.
- Nenhuma dose de Luan foi derivada de ficha de adulto: a prescrição cita a ficha pediátrica.
- Fugulin grava para Bia e mostra a nota para Luan; no dia seguinte, Luan passa a adulto e os registros anteriores não mudam.
- Cada criança tem conta da porta e conta de internação ligadas por `conta_origem_id`.

**Bordas a provar:**
- Cadastro sem data de nascimento: `faixaEtaria()` devolve `desconhecida`; a triagem precisa pedir a data antes de oferecer o grupo.
- Prescrever antes de aferir o peso: recusado nos dois.
- Reclassificar Luan pela enfermagem depois de o médico assumir: recusado.
- Virada de meia-noite durante a internação: o plantão noturno não perde acesso (turno como janela) e a conta fica na data de Brasília.

**Lacunas tocadas:**
- Lacuna (MAPA): instrumento pediátrico de enfermagem (Dini) não existe; só a nota.
- Lacuna (MAPA): sem setor pediátrico na rede F5.
- Lacuna (MAPA): exame e permanência sem valor; curva de crescimento e escalas de dor sem rota na Central.

---

### A05 — Anafilaxia pediátrica na porta da UPA, com liberação da farmácia

- **Objetivo:** provar a emergência pediátrica por demanda espontânea: triagem vermelha, atendimento imediato com a ferramenta de anafilaxia, prescrição de alta vigilância administrada antes da liberação (com motivo), liberação e conferência pela farmácia, dispensação, observação e alta com receita; conta e BPA.
- **Rede e unidades:** UPA Fase 5 24h (PS e Observação Adulto).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `faturamento.f5`.
- **Paciente fictício:** Sofia F5 Alergia, 6 anos (nascida em hoje − 6 anos − 2 meses), sexo F, responsável = mãe, CNS fictício válido, peso **aferido** na porta; urticária, edema de lábios e sibilos minutos depois de comer amendoim.
- **Pré-condições:** rede F5 e check-in; `farmaceutico.f5` escalado e com check-in; `alta_vigilancia_da_unidade` revisada (as regras ISMP Brasil 2019 em `private.regras_alta_vigilancia` dizem quais itens exigem liberação); catálogo e estoque dos itens que `ped-anafilaxia-icr` cita.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção UPA | `/recepcao` | Ficha de Sofia no PS com queixa "reação alérgica" | Episódio; conta aberta | `registrar_ficha`, `trg_conta_do_episodio` |
| 2 | enfermeiro UPA | `/triagem` | Chama; sinais crus (FC, FR, SpO2, PA); fluxograma pediátrico escolhido pela enfermeira; **a enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste)** | Cor gravada; item classificação | `chamar_paciente`, `classificar_risco` |
| 3 | médico UPA | `/atendimento` | Assume na hora; peso aferido; SOAP com CID de anafilaxia existente; abre `/plantonista/pediatria/anafilaxia-pediatrica` | Item consulta; ferramenta com fonte | `iniciar_atendimento`, `registrar_soap`; ficha `ped-anafilaxia-icr` (fonte: ICr cap. 6; WAO 2020; GALEN 2024) |
| 4 | médico UPA | aba Prescrição | Prescreve a primeira linha e o suporte **conforme `ped-anafilaxia-icr`**, com "Agora" como dose única e o que a ferramenta manda repetir com horário | Itens ativos; os de alta vigilância aguardam liberação | `prescrever`; `alta_vigilancia_da_unidade`; "Agora" = dose única ([M]`20270301000001`) |
| 5 | enfermeiro UPA | `/checagem` | Administra a primeira dose **antes** da liberação (emergência) com motivo ≥ 10 letras; checa "feito" | `administracoes.sem_liberacao = true`; item medicação na conta | `checar(p_item, 'feito', p_horario, p_motivo)`; `administracoes_sem_liberacao` |
| 6 | farmacêutico | `/farmacia` e `/alta-vigilancia` | Vê a administração sem liberação, valida os itens (`confere`), dispensa o restante para 24 h | Última validação `confere` = liberação; `dispensacoes`; saldo baixado | `fila_validacao`, `validar_item`, `administracoes_sem_liberacao`, `dispensar_item`, `extrato_estoque` |
| 7 | farmacêutico | `/interacoes` | Confere se há interação crítica ativa entre os itens prescritos | Se houver, o médico precisa ter justificado; se não, nada a fazer | `lista_interacoes`, `interacoes_justificadas` |
| 8 | médico UPA | aba Reavaliação | Reavaliação com sinais crus; se piora, segunda dose **conforme a ferramenta** | Reavaliação gravada | `registrar_reavaliacao`, `prescrever` |
| 9 | médico UPA | aba Desfecho | `observacao` para o período que a ferramenta recomenda observar | Box na Observação Adulto (sem setor pediátrico) | `registrar_desfecho('observacao')`, `painel_observacao` |
| 10 | enfermeiro UPA | `/enfermagem/pronto-socorro` | Sinais crus seriados no box | Registros com autor | `registrar_avaliacao` |
| 11 | médico UPA | `/plantao/observacao` | Alta com orientações, receita e atestado para o responsável | Documentos clínicos assinados pelo login (sem ICP-Brasil) | `finalizar_observacao(…, 'alta', …)`; aba Atestado/Receita → `documentos_clinicos` |
| 12 | médico UPA | `/notificacao-compulsoria` (borda) | Confere se o CID sugeriu agravo | Anafilaxia alimentar não é agravo da LNNC; nada sugerido (se sugerir, registrar achado do mapeamento CID → agravo, que o MAPA diz não conferido) | `agravos_notificacao`, `lnnc_cids` |
| 13 | faturamento UPA | `/faturamento/contas`, `/faturamento` | Conta em conferência → fechada; BPA | Três itens com valor; medicamentos sem valor | `conta_detalhe`, `mudar_etapa_conta`, `bpa_conferencia` |

**Regulação:** não há.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação | SIGTAP do uso `classificacao` | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco`; passo 2 |
| Consulta médica | SIGTAP do uso `atendimento_medico` | 1 | R$ 20,00 | R$ 20,00 | `episodios.atendimento_medico_id`; passo 3 |
| Administração de medicamento | SIGTAP do uso `medicacao` | 1 (uma por paciente/profissional/dia, mesmo com duas doses) | R$ 5,00 | R$ 5,00 | `administracoes` `feito`; passo 5 |
| Medicamentos dispensados (inclusive o administrado sem liberação) | — | conforme | sem valor | sem valor | `dispensacoes`; passo 6 |
| Observação | — | 1 | R$ 0,00 | R$ 0,00 | **Lacuna:** sem valor de permanência |
| **Total fictício** | | | | **R$ 35,00** | `conta_detalhe.total_referencia` |

**Critérios de aceite:**
- A primeira dose foi checada antes da liberação só com motivo ≥ 10 e ficou marcada `sem_liberacao`; a farmácia a vê em `administracoes_sem_liberacao`.
- Depois de `validar_item` = `confere`, as doses seguintes checam sem motivo.
- A dispensação entra na conta sem valor; o extrato mostra a saída por prescrição.
- A prescrição cita `ped-anafilaxia-icr` e nenhuma dose foi derivada de `adulto-anafilaxia`.
- A conta tem exatamente um item de medicação no dia, mesmo com duas administrações pelo mesmo profissional.
- Receita e atestado têm autor = login do médico.

**Bordas a provar:**
- Checar sem liberação com motivo de 9 letras: recusado.
- Item alterado pelo médico volta à fila como item novo e perde a liberação anterior.
- Farmacêutico tentando `/prontuarios` ou `pedir_acesso_prontuario`: sem rota e recusado.
- Dispensação pela enfermagem com a farmácia fechada: só com `sem_farmaceutico` + justificativa.
- Enfermeiro checando dose de outro setor: a fila é do setor.

**Lacunas tocadas:**
- Lacuna (MAPA): dupla checagem sem tela; o caminho é a liberação da farmácia.
- Lacuna (MAPA): medicamento sem preço, lote ou validade; sem setor pediátrico na F5.
- Lacuna (MAPA): sem assinatura ICP-Brasil nos documentos.
- Lacuna (MAPA): mapeamento CID → agravo ainda não conferido pela vigilância.

---

### A06 — Recém-nascido vinculado à mãe e regulação neonatal com incubadora

- **Objetivo:** provar o cadastro "RN de <mãe>" a partir do cadastro da mãe (até 27 dias de vida), a identificação do RN pelo documento da mãe na regulação, a triagem e o atendimento pediátrico do neonato, a ferramenta de icterícia neonatal, a regulação de transferência com a pergunta obrigatória da incubadora, o aceite do destino, o NIR e a chegada.
- **Rede e unidades:** UPA Fase 5 24h (PS) → Central de Regulação Fase 5 → Hospital Fase 5 (Clínica Médica, por falta de maternidade ou UTI neonatal na rede F5).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `nir.f5`, `gestor.upa.f5`; `regulador.f5`; `medico.hospital.f5`.
- **Pacientes fictícios:** Joana F5 Puérpera, 24 anos (nascida em 2002-03-20), sexo F, CNS fictício válido, parto há 5 dias fora da rede (o app não faz parto); RN de Joana F5 Puérpera, nascido em **hoje − 5 dias**, sexo M, sem nome nem CNS próprios, ictérico e mamando pouco; peso **aferido** na UPA.
- **Pré-condições:** rede F5 e check-in; Hospital F5 com leito CM livre e serviço ofertado no mapa; central definida; catálogo com os itens de suporte.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção UPA | `/recepcao` | Cadastra Joana (CNS válido) e abre ficha dela no PS (queixa puerperal: dor mamária) — isso garante o cadastro da mãe na unidade | Episódio de Joana; conta aberta | `registrar_ficha` → `pacientes` (mãe), `episodios` |
| 2 | recepção UPA | `/recepcao` → `FormRn` (`CadastroRn.tsx`) | Cadastra o RN a partir do cadastro de Joana: data de nascimento (hoje − 5), sexo M, parto único | Paciente "RN de Joana F5 Puérpera", `mae_id` = Joana, `responsavel_parentesco = 'mãe'`, prontuário próprio; auditoria `cadastrar_rn` | `cadastrar_rn(p_mae, p_data_nascimento, 'M')` → `pacientes.mae_id`, `rn_ordem` nulo; `private.registrar_auditoria('cadastrar_rn', …)` |
| 3 | recepção UPA | `/recepcao` (borda) | Tenta cadastrar de novo o RN de Joana com a mesma data sem ordem de gemelar | Recusado: "Já existe recém-nascido de … Para gêmeos, informe a ordem" | `cadastrar_rn` |
| 4 | recepção UPA | `/recepcao` | Abre a ficha do RN no PS com queixa "icterícia, mama pouco" | Episódio do RN; conta própria | `registrar_ficha(p_paciente = RN)`; `trg_conta_do_episodio` |
| 5 | enfermeiro UPA | `/triagem` | Chama o RN; grupo pediátrico; sinais crus (temperatura, FC, FR, SpO2, peso, glicemia se o fluxograma pedir); **a enfermagem classifica; cor esperada no teste: laranja (escolha da enfermeira de teste)** | Cor gravada; item classificação | `classificar_risco` |
| 6 | médico UPA | `/atendimento` | Assume; peso aferido; SOAP com CID de icterícia neonatal existente; abre `/plantonista/pediatria/ictericia-neonatal` com idade em horas e os dados que a ficha pede | Item consulta; ferramenta com fonte | `iniciar_atendimento`, `registrar_soap`; ficha `ped-ictericia-neonatal` (fonte: AAP 2022) |
| 7 | médico UPA | aba Exames | Pede bilirrubinas e tipagem conforme a ferramenta | Pedido gravado; resultado volta por `resolver_exame` ou FHIR | `pedir_exames`, `resolver_exame` → `exame_resultado_itens` |
| 8 | médico UPA | aba Prescrição | Suporte **conforme `ped-ictericia-neonatal`** (o que ela indica e o limiar de escalonamento); fototerapia não existe na UPA F5: motivo da transferência | Itens ativos com peso aferido | `prescrever` |
| 9 | médico UPA | `/regulacao` (NovaSolicitacao) | Solicita `tipo = 'transferencia'`, vulnerabilidade `crianca`, prioridade proposta `urgencia`, SIGTAP e CID, quadro ≥ 20 letras, transporte; **deixa "incubadora" em branco** | Recusado: "Recém-nascido: informe se a transferência precisa de incubadora." | `regulacao_solicitar` ([M]`20261107000001`, l. 330–334: neonato = nascido há menos de 28 dias) |
| 10 | médico UPA | `/regulacao` | Repete com incubadora informada | `enviada`; o RN conta como identificado pelo CNS da mãe; a solicitação mostra o documento da mãe | `regulacao_solicitar` → `regulacao_solicitacoes.paciente_nao_identificado = false`, `incubadora`; `private.paciente_tem_documento`; `regulacao_vinculos_paciente` traz `mae` |
| 11 | regulador | `/regulacao` (Fila → PainelDecisao) | Assume, abre pendência pedindo o resultado da bilirrubina | `pendencia`; prazo padrão 3 h | `regulacao_assumir`, `regulacao_pendencia` → `regulacao_eventos` |
| 12 | NIR UPA | `/nir` | Vê `reg_pendencia`; responde a pendência com o resultado anexado | Volta à fila mantendo a posição | `nir_pendencias`, `regulacao_responder_pendencia`, `regulacao_anexar_documento` |
| 13 | regulador | `/regulacao` | Autoriza com destino Hospital Fase 5 | `aguardando_destino` | `regulacao_autorizar` |
| 14 | médico hospital | `/regulacao` (destino) | Aceita e reserva leito CM | `autorizada`; `reservas_leito` | `regulacao_destino_aceitar`, `regulacao_leitos_destino` |
| 15 | gestor UPA | `/regulacao` (origem) | Vê o histórico do RN e o SLA | Eventos com autor; `destino_atrasado = 0` | `regulacao_historico_paciente`, `regulacao_sla_painel` |
| 16 | médico UPA | aba Desfecho (RN) | `transferencia` com relato | Episódio do RN encerrado; sem contrarreferência (sem UBS de origem) | `registrar_desfecho('transferencia', p_relato)` |
| 17 | NIR UPA | `/nir` | Marca saída (mãe acompanha; a ficha de Joana segue com desfecho próprio) | `em_transito` | `regulacao_marcar_saida` |
| 18 | médico hospital | `/regulacao` → `/recepcao` → `/atendimento` | Marca chegada; abre ficha do RN no hospital (cadastro novo na unidade, `nome_mae` preenchido; o vínculo `mae_id` é por unidade e só existe se Joana também for cadastrada lá) e interna | `realizada`; internação e conta de internação no hospital | `regulacao_marcar_chegada(true)`; `registrar_ficha`, `registrar_desfecho('internacao', leito_id)`, `trg_conta_da_internacao` |
| 19 | médico UPA | `/atendimento` (Joana) | Alta de Joana com orientações | Episódio da mãe encerrado; conta dela independente da do RN | `registrar_desfecho('alta')` |

**Regulação:** `enviada` (com incubadora obrigatória para nascido há menos de 28 dias) → `em_analise` → `pendencia` (3 h padrão) → respondida pelo NIR, volta à fila na mesma posição → `aguardando_destino` → `autorizada` (leito CM reservado) → `em_transito` → `realizada`. O RN é "identificado" pelo CNS ou CPF válido da mãe (`private.paciente_tem_documento`); a solicitação e a tela de vínculos mostram os dados da mãe.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Classificação do RN | SIGTAP do uso `classificacao` | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco` do episódio do RN; passo 5 |
| Consulta médica do RN | SIGTAP do uso `atendimento_medico` | 1 | R$ 20,00 | R$ 20,00 | `episodios.atendimento_medico_id`; passo 6 |
| Exames do RN (bilirrubinas, tipagem) | — | 2 | sem valor | sem valor | `pedidos` de exame; **Lacuna:** exame sem valor |
| Consulta médica de Joana (conta própria) | SIGTAP do uso `atendimento_medico` | 1 | R$ 20,00 | R$ 20,00 | conta de Joana, separada da do RN |
| Transporte com incubadora | — | 1 | R$ 0,00 | R$ 0,00 | `regulacao_solicitacoes.incubadora`; regulação não gera valor |
| Internação do RN no hospital | — | 1 | R$ 0,00 (sem laudo de AIH neste cenário) | R$ 0,00 | `internacoes.internado_em` abre a conta; **Lacuna:** sem faturamento no Hospital F5 |
| **Total fictício (conta do RN na UPA)** | | | | **R$ 30,00** | `conta_detalhe` da conta do RN; a de Joana tem R$ 20,00 à parte |

**Critérios de aceite:**
- O RN nasce no sistema com nome "RN de Joana F5 Puérpera", `mae_id` apontando para Joana, prontuário próprio e auditoria `cadastrar_rn`.
- O segundo cadastro do mesmo parto sem ordem de gemelar é recusado; com `p_gemelar` 1 e 2 passa ("RN 1 de …", "RN 2 de …").
- A regulação recusa a transferência do neonato sem a resposta sobre incubadora e aceita com ela.
- O RN sem CNS é "identificado" porque a mãe tem CNS válido; a solicitação exibe o documento da mãe.
- A pendência respondida pelo NIR devolve a solicitação à fila sem perder a posição.
- As contas de Joana e do RN são independentes; a classificação e a consulta de cada um nascem no seu episódio.
- No hospital, a internação só existe depois da ficha e do desfecho `internacao`; a chegada regulada não a cria.

**Bordas a provar:**
- Cadastrar "RN de" com 28 dias ou mais: recusado ("só até 27 dias de vida").
- Data de nascimento futura: recusada.
- Escolher como mãe um cadastro que é ele próprio um RN: recusado.
- Quem não está na escala da unidade (nem gestor) tentando `cadastrar_rn`: recusado.
- Depois que o RN ganha nome e CNS (edição normal do cadastro), `mae_id` permanece.
- BPA: paciente sem CNS/CPF é só aviso; `nome_mae` em branco entraria como pendência em documentos — aqui vem preenchido pelo `cadastrar_rn`.

**Lacunas tocadas:**
- Lacuna (MAPA): parto, hemorragia pós-parto e ocitocina não existem; o parto aconteceu fora da rede.
- Lacuna (MAPA): sem maternidade, UTI neonatal ou leito infantil na rede F5; o leito CM faz as vezes de destino.
- Lacuna (MAPA): a chegada regulada não cria a internação; o vínculo `mae_id` não é copiado ao cadastro da outra unidade.
- Lacuna (MAPA): fototerapia, exame e transporte sem valor; sem faturamento no Hospital F5.
- Lacuna (MAPA): `ped-reanimacao-neonatal` é para sala de parto (RN ≥ 34 s) e não entra neste cenário; `ped-ictericia-neonatal` cobre só ≥ 35 semanas — o RN fictício é de termo.
