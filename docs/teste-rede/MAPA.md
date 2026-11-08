# Mapa de referência — teste ponta a ponta da rede

Frente "Teste ponta a ponta da rede" (BACKLOG, pedido do RT em 06/11/2026), tarefa 1. Este mapa sustenta o catálogo de 20 ou mais cenários: diz, com evidência do código, o que cada papel vê e faz, quais RPCs cada passo da rede chama, onde o custo nasce, quais ferramentas clínicas o cenário pode remeter e o que já existe na homologação para rodar. Nada aqui foi executado contra banco; tudo foi lido em `src/`, `supabase/migrations/`, `scripts/e2e/` e `supabase/tests/`.

Convenções: caminhos relativos à raiz do repositório; `[M]` = `supabase/migrations/`. Valores de custo nos cenários são fictícios; aqui só se mapeiam os campos.

## 1. Papéis

### 1.1 Como o papel abre a tela

- O papel é um `vinculo` por unidade (`public.vinculos`, enum `public.papel`); o papel ativo é o da unidade selecionada (`src/contexts/UnidadeContext`). `private.papel_na_unidade(u)` devolve o papel mais forte e devolve `''` sem vínculo ([M]`20270208000019_papel_mais_forte.sql`, correção P0 de [M]`20270219000001_papel_vazio_nega_acesso.sql`).
- A rota é guardada por `RequireRole` em `src/App.tsx`; o menu lateral por papel está em `src/components/casca/navegacao.ts` (`POR_PAPEL`). Numa UBS, `FORA_DA_UBS` tira porta, leito, internação, AIH, APAC, NIR e triagem do menu; `SO_NA_UBS` só mostra escuta, agenda, encaminhados, hiperdia, pré-natal e puericultura na UBS.
- A escala é a porta: `private.plantoes_agora()` só libera quem está na janela do turno com check-in ou dentro da tolerância (seção 6). Gestor, admin e faturamento não dependem de escala; o farmacêutico, o NIR e o regulador dependem (os scripts `03`/`41` fazem o check-in deles).
- Não existe papel "médico da UBS" nem "ACS": o médico da UBS é `plantonista` numa unidade `tipo = 'ubs'`; o enfermeiro é `enfermeiro`; o ACS não existe no app (nota C2/C3: "não registrado").

### 1.2 Tabela por papel

| Papel (`papel`) | Rotas e telas (arquivo) | Ações principais | RPCs que as ações chamam |
|---|---|---|---|
| **recepcao** | `/recepcao` e `/recepcao/:tela` (`src/pages/recepcao/Recepcao.tsx`: Nova ficha, fila da triagem, fila médica, painel de chamada); `/cadastros-duplicados` (`CadastrosDuplicados.tsx`); `/agenda-consultas` (UBS); `/encaminhados` (UBS); `/minha-escala` | Abrir ficha (cadastro do paciente, queixa, setor); registrar chegada do agendado e do encaminhado; painel público de chamada; unificar duplicados | `buscar_pacientes`, `registrar_ficha(p_setor, p_queixa, p_paciente, p_cadastro jsonb, …)`, `fila_da_porta`, `atendimento_aberto_do_paciente`, `ultimas_chamadas_porta`, `gerar_link_painel`, `setores_na_escala_agora`; UBS: `agenda_dia`, `agenda_marcar`, `agenda_registrar_chegada`, `agenda_cancelar`, `encaminhamentos_upa_destino`, `encaminhamento_upa_marcar_chegada` |
| **enfermeiro** | `/triagem` e `/escuta` (`src/pages/enfermagem/Triagem.tsx` → `triagem/Fila.tsx`, `Classificar.tsx`, `EscutaInicial.tsx`, `Espera.tsx`, `Gestacao.tsx`, `Dor.tsx`); `/enfermagem/pronto-socorro`, `/enfermagem/internacao`, `/enfermagem` (`ProntoSocorroEnfermagem.tsx`, `InternacaoEnfermagem.tsx`, `InicioEnfermagem.tsx`, `PassagemEnfermagem.tsx`); `/checagem` (`Checagem.tsx`); `/dispensacao` (retirada sem farmacêutico); `/alta-vigilancia`; `/notificacao-compulsoria`; `/contingencia`; `/prontuarios`; UBS: `/agenda-consultas`, `/encaminhados`, `/hiperdia`, `/pre-natal`, `/puericultura` | Chamar e classificar (cor é dele); reclassificar antes do médico; escuta inicial do CAB 28 na UBS e envio à UPA pela escuta; checar/aprazar medicação; sinais, SAE, Fugulin, balanço, curativos, dispositivos; passagem de plantão da enfermagem; avaliação dos pés; notificação | `chamar_paciente`, `classificar_risco(p_episodio, p_cor, p_sinais, p_fluxograma, p_discriminador, …, p_motivo, p_justificativa, …, p_dor, p_oxigenio, p_gestacao)`, `classificacoes_do_episodio`, `protocolo_classificacao_da_unidade`, `registrar_escuta_aps`, `encaminhar_upa`; `fila_checagem`, `liberacao_farmacia`, `sugestoes_aprazamento`, `aprazar`, `checar(p_item, p_situacao, p_horario, p_motivo)`; `enfermagem_pacientes_do_setor`, `enfermagem_leitos`, `situacao_leitos`, `registrar_avaliacao`, `registrar_evolucao`, `registrar_sae`, `registrar_fugulin`, `lancar_balanco`, `registrar_curativo`, `registrar_dispositivo`, `cuidados_enfermagem`, `entregar_passagem_enfermagem`, `receber_passagem_enfermagem`, `painel_observacao`; `registrar_avaliacao_pes`; `abrir_notificacao`, `salvar_ficha_notificacao`, `registrar_notificacao` |
| **tecnico_enfermagem** | `/enfermagem/pronto-socorro`, `/enfermagem/internacao`, `/checagem`, `/dispensacao`, `/prontuarios`, `/minha-escala`; UBS: agenda, hiperdia, pré-natal, puericultura (só leitura dos painéis) | Checagem e cuidados; sinais vitais; não classifica, não faz escuta (teste `F5.1.tecnico_nao_classifica` em `scripts/e2e/43_fase5_ubs.sql`), não notifica | Mesmas RPCs de enfermagem, exceto `classificar_risco` e `registrar_escuta_aps` |
| **plantonista** (médico da UPA, do hospital e da UBS) | `/plantonista` e `/plantonista/:section/:tool` (Central: fichas, escores, calculadoras — `src/pages/plantonista/ToolRouter.tsx`, `src/content/registry.tsx`); `/plantao` e `/plantao/:secao/:tool` (`src/pages/plantao/PlantaoToolRouter.tsx`, `src/content/plantaoRegistry.tsx`: check-in, observação, internação, evolução, documentos); `/atendimento` (`src/pages/plantao/AtendimentoPorta.tsx` → `porta/FilaPS.tsx`, `JanelaAtendimento.tsx`, abas Atendimento, Conduta, Prescrição, Exames, Reavaliação, Desfecho, Atestado/Receita); `/pendencias-pep`, `/impressao-prontuario`; `/teleinterconsulta`, `/pareceres`, `/regulacao`, `/notificacao-compulsoria`, `/interacoes`, `/prontuarios`, `/agenda` (escala), `/preferencias-prescricao`; UBS: `/agenda-consultas`, `/encaminhados`, `/hiperdia`, `/pre-natal`, `/puericultura` | Assumir, SOAP, reclassificar depois de iniciar, prescrever, pedir e resolver exames, reavaliar, desfecho (alta, observação, internação, transferência, evasão, óbito), admissão, evolução, alta da internação, pacote de alta, regulação, AIH/APAC (laudo), tele e parecer, notificação; na UBS: consulta com CIAP-2 e conduta | `painel_atendimento_ps`, `iniciar_atendimento`, `registrar_soap(p_episodio, S, O, A, P, p_cid)`, `salvar_rascunho_atendimento`, `descartar_rascunho`, `classificar_risco` (reclassificação com `p_motivo` ≥ 10), `prescrever(p_paciente, p_item jsonb)`, `suspender_item`, `alterar_item_prescricao`, `pedir_exames(p_episodio, p_itens jsonb, p_urgencia, p_observacao)`, `pedir_exames_internacao`, `resolver_exame`, `buscar_exames`, `exames_da_unidade`, `registrar_reavaliacao`, `aguardar_reavaliacao(p_episodio, p_reavaliar_em)`, `registrar_desfecho(p_episodio, p_desfecho, p_relato, p_detalhes)`, `leitos_para_ocupar`, `reservar_leito`, `registrar_admissao(p_internacao, p_conteudo, p_ficha)`, `registrar_diagnostico`, `dar_alta(p_internacao, p_tipo, p_cid, p_quando, p_justificativa, p_observacoes, p_detalhes)`, `cancelar_alta`, `impeditivos_alta`, `gerar_pacote_alta`, `transferir_paciente`, `marcar_agravo`, `resolver_agravo`, `regulacao_solicitar`, `solicitar_teleinterconsulta`, `solicitar_parecer`, `solicitar_apac`; UBS: `registrar_conduta_aps(p_episodio, p_tipo, p_problemas, p_cids, p_condutas, p_obs, p_ciaps)`, `encaminhar_upa`, `encaminhar_interno`, `pre_natal_*`, `puericultura_*`, `hiperdia_*` |
| **farmaceutico** | `/farmacia` (`src/pages/farmacia/Farmacia.tsx`: fila de validação, estoque, faltas, diluições — `Diluicoes.tsx`, `PainelFarmacia.tsx`); `/alta-vigilancia`; `/unidade-consumo`; `/dispensacao`; `/interacoes`; `/minha-escala`. **Sem** `/prontuarios` (RT 27/10/2026; [M]`20270105000001`) | Validar/liberar item (alta vigilância), dispensar e devolver, entrada e ajuste de estoque, faltas, diluição padrão da unidade, interações críticas, unidade de consumo | `fila_validacao`, `validar_item`, `alta_vigilancia_da_unidade`, `definir_alta_vigilancia`, `administracoes_sem_liberacao`, `itens_para_dispensar`, `dispensar_item`, `dispensar_avulso`, `devolver_dispensacao`, `conferir_dispensacao`, `dispensacoes_da_unidade`, `farmacia_estoque`, `registrar_entrada_estoque`, `ajustar_estoque`, `extrato_estoque`, `sinalizar_falta`, `faltas_priorizadas`, `avancar_falta`, `registrar_retorno_falta`, `padrao_diluicao_unidade`, `salvar_diluicao`, `publicar_diluicao_versao`, `lista_interacoes`, `salvar_interacao`, `medicamentos_unidade_consumo`, `definir_unidade_consumo`, `cadastrar_medicamento` |
| **gestor** | `/gestao` (`src/pages/gestor/PainelGestor.tsx`), `/gestao/porta`, `/gestao/intercorrencias`, `/cadastros-duplicados`, `/internacao` e `/observacao` (`InternacaoPainel.tsx`), `/nir`, `/gestao/farmacia`, `/dispensacao`, `/alta-vigilancia`, `/interacoes`, `/unidade-consumo`, `/gestao/exames`, `/faturamento/*`, `/aih`, `/apac`, `/unidade` (setores, configurações, CNES, críticas da AIH, remuneração de plantão), `/escala` (`EscalaMes.tsx`, `PresencasDoDia.tsx`), `/indicadores`, `/gestao/gaviao`, `/auditoria` (pedidos de prontuário, revisão sem conexão), `/gestao/protocolos`, `/revisao-clinica`, `/gestao/chamados`, `/regulacao`, `/integracoes`, `/exportar`, `/implantacao`; UBS: agenda, encaminhados, hiperdia, pré-natal, puericultura | Montar e publicar escala; liberar pós-plantão; aprovar pedido de prontuário; reabrir conta e liberar fechamento; marcar glosa perdida; definir CNES, BPA, críticas da AIH; mapa de leitos e transferência interna; indicadores; zerar 2FA de alguém | `escala_mes_gestor`, `publicar_escala`, `marcar_vaga_escala`, `adicionar_plantao_escala`, `presencas_do_dia_gestor`, `liberar_pos_plantao`, `pedidos_acesso_da_unidade`, `decidir_pedido_acesso`, `mudar_etapa_conta(…,'aberta', motivo)`, `liberar_fechamento_conta`, `mudar_glosa`, `definir_cnes_unidade`, `definir_bpa_config`, `definir_critica_aih`, `mapa_leitos_gestor`, `transferir_internado`, `ocupacao_setores`, `porta_agora`, `panorama_gestor`, `indicador_evasao`, `indicador_espera_triagem`, `indicador_espera_medico`, `relatorio_intercorrencias`, `decidir_revisao_sincronizacao`, `equipe_segundo_fator`, `zerar_segundo_fator`, `regulacao_mapa_vagas`, `regulacao_ofertar_setor` |
| **faturamento** | `/faturamento` (BPA, `src/pages/faturamento/Bpa.tsx`), `/faturamento/contas` (`Contas.tsx`), `/faturamento/glosas` (`Glosas.tsx`), `/faturamento/erp` (`EnvioErp.tsx`), `/faturamento/materiais` (`Materiais.tsx`), `/apac` (execução e arquivo), `/minha-escala`. Não abre `/aih` | Conduzir a conta (aberta → em conferência → fechada → faturada), lançar procedimento, material e medicamento fora; BPA: associar SIGTAP, conferir, fechar competência, baixar arquivo; APAC: execução, fechamento, arquivo; glosa; baixar versão para o ERP | `contas_da_unidade`, `conta_detalhe`, `mudar_etapa_conta`, `trocar_pagador_conta`, `lancar_procedimento_conta`, `retirar_procedimento_conta`, `conta_lancar_material`, `conta_retirar_material`, `medicamento_fora_da_conta`, `registrar_procedimento`, `bpa_config`, `associar_procedimento_bpa`, `buscar_sigtap`, `bpa_conferencia`, `fechar_competencia_bpa`, `reabrir_competencia_bpa`, `arquivo_bpa`, `registrar_execucao_apac`, `apac_conferencia`, `fechar_competencia_apac`, `arquivo_apac`, `registrar_glosa`, `mudar_glosa`, `glosas_da_unidade`, `erp_contas_da_unidade`, `erp_baixar` |
| **regulador** (médico, com CRM; vinculado à unidade da central) | `/regulacao` (`src/pages/regulacao/Regulacao.tsx`: Fila, Detalhe, PainelDecisao, Criterios), `/aih` (`Aih.tsx`), `/apac` (`Apac.tsx`), `/minha-escala` | Assumir, priorizar, autorizar, negar, devolver, abrir pendência, registrar regulação externa; decidir AIH e APAC; prazos e SLA da central; indicadores | `regulacao_fila`, `regulacao_assumir`, `regulacao_soltar`, `regulacao_priorizar`, `regulacao_autorizar`, `regulacao_negar`, `regulacao_devolver`, `regulacao_pendencia`, `regulacao_registrar_externo`, `regulacao_definir_prazos`, `regulacao_sla_painel`, `regulacao_indicadores`, `decidir_aih`, `ajustar_competencia_aih`, `cancelar_aih`, `decidir_apac`, `cancelar_apac` |
| **nir** (precisa de escala) | `/nir` (`src/pages/nir/Nir.tsx`), `/regulacao`, `/notificacoes`, `/minha-escala` | Cobrar pendências de AIH, APAC e regulação; solicitar regulação pela origem; marcar saída e chegada | `nir_pendencias`, `nir_cobrar`, `regulacao_solicitar`, `regulacao_responder_pendencia`, `regulacao_marcar_saida`, `regulacao_marcar_chegada` |
| **telemedicina** | `/teleinterconsulta` (`src/pages/telemedicina/Teleinterconsulta.tsx`), `/telemedicina/:tela` (`Telemedicina.tsx`: salas, telemonitoramento, assinaturas, histórico, credenciais), `/pareceres`, `/prontuarios`, `/minha-escala` | Check-in remoto (sem raio), disponibilidade, aceitar e responder teleinterconsulta por escrito | `registrar_checkin`, `definir_minha_disponibilidade_tele`, `minha_situacao_tele`, `aceitar_teleinterconsulta`, `responder_teleinterconsulta`, `tele_pendencias`, `tele_historico`, `teleinterconsultas_da_unidade` |
| **admin** (organização; super admin ganha mais) | `/painel` (`src/pages/grupos/OrganizacaoGrupo.tsx`), `/plataformas`, `/pendencias-tecnicas`, `/servidores`, `/escala`, `/gaviao`; super admin: `/erros-e-alertas`, `/integracoes`, `/exportar`, `/implantacao`, `/regulacao` (centrais), `/rede` | Criar unidade, ver agregado da organização, chaves da API, webhooks, RNDS, definir a central de regulação | `admin_criar_unidade`, `admin_editar_unidade`, `painel_organizacao`, `api_criar_chave`, `api_revogar_chave`, `webhook_criar_destino`, `rnds_*`, `regulacao_definir_central`, `verificacoes_sistema` |
| **secretaria / regulacao_regional / faturamento_rede** | `/rede` (`src/pages/rede/Rede.tsx`) | Ler mapa de vagas, indicadores, SLA e arquivos de BPA fechados da rede | `rede_contexto`, `rede_faturamento`, `rede_baixar_arquivo`, `regulacao_mapa_vagas` |

Observações para o catálogo:
- Quem lê o prontuário sem pedido: o gestor da unidade (policy `documentos_select`, [M]`20260815000034_fase1_adt.sql`) e quem cuida agora do paciente (plantão ou teleinterconsulta vigente). O farmacêutico não lê nem pede. O gestor **não** pede (teste `15_gestor_transversais.sql`, decisão do RT em 04/11/2026).
- Só o plantonista tem `/atendimento`, `/plantao` e `/plantonista`; o gestor e o admin veem `/plantonista` (Central de fichas) e `/agenda`.

## 2. Fluxos da rede

Cada tabela: passo → papel → tela → RPC/tabela → estado ou regra.

### 2.1 UBS (unidade `tipo = 'ubs'`)

| Passo | Papel | Tela | RPC / tabela | Estado ou regra |
|---|---|---|---|---|
| Agenda: configurar horários do profissional | gestor | `/agenda-consultas` (`src/pages/agenda/ConfiguracaoAgenda.tsx`) | `agenda_configuracao`, `agenda_definir_configuracao(p_unidade, p_perfil, p_horarios)`, `agenda_fechar`, `agenda_reabrir` ([M]`20270214000001_agenda_ubs.sql`) | — |
| Agenda: marcar, reservar, chegada, falta, cancelar | recepção, enfermagem, médico, gestor | `AgendaConsultas.tsx` (`useAgenda.ts`) | `agenda_dia`, `agenda_marcar`, `agenda_reservar`, `agenda_registrar_chegada(p_agendamento, p_setor, p_queixa)`, `agenda_registrar_falta`, `agenda_desfazer_falta`, `agenda_cancelar` | `situacao`: `agendado, presente, realizado, nao_aguardou, nao_compareceu, cancelado`. A chegada abre o episódio (`tipo_atendimento_aps = 'consulta_agendada'`) |
| Ficha na UBS | recepção | `/recepcao` | `registrar_ficha` com `tipo_atendimento` no cadastro jsonb ([M]`20270211000002_atendimento_ubs.sql`) | `episodios.tipo_atendimento_aps`: `consulta_programada, consulta_agendada, escuta_inicial, consulta_no_dia, atendimento_urgencia` |
| Escuta inicial (CAB 28) | enfermeiro | `/escuta` (`triagem/EscutaInicial.tsx`) | `registrar_escuta_aps(p_episodio, p_cor, p_saida, p_relato, p_sinais jsonb, …)` ([M]`20270213000001_escuta_inicial_ubs.sql`); altura em cm desde PR #434 | Cores `vermelho, amarelo, verde, azul`. `azul` → `orientacao` ou `agendamento` (encerra); as outras → `consulta` (fila do médico). O técnico é recusado |
| Envio à UPA pela escuta (vermelho) | enfermeiro | `src/components/encaminhamento/EnviarUpa.tsx` | `encaminhar_upa(p_episodio, p_destino, p_motivo)` → `encaminhamentos_upa` ([M]`20270216000001`) | `situacao`: `enviado → chegou / nao_chegou / cancelado`; cron `encaminhamento-upa-prazo` marca `nao_chegou` em 12 h |
| Consulta | médico (plantonista) | `/atendimento` na UBS (textos da UBS desde PR #436; aba Conduta mantém estado, PR #435) | `iniciar_atendimento`, `registrar_soap`, `registrar_conduta_aps(p_episodio, p_tipo, p_problemas, p_cids, p_condutas, p_obs, p_ciaps)` ([M]`20270215000001_ciap2.sql`), `terminologia_buscar('ciap2')` | `conduta_aps` ⊂ `retorno_consulta_agendada, retorno_cuidado_continuado, agendamento_grupos, agendamento_nasf, alta_episodio, encaminhamento_interno, encaminhamento_especializado, encaminhamento_caps, encaminhamento_internacao, …`. A UBS **não** gera linha de BPA (decisão D6) |
| Regulação pela conduta (consulta especializada) | médico | aba Conduta → `/regulacao` | `regulacao_solicitar(tipo = 'consulta')` com SIGTAP, CID e CBO (coorte F5 #8: `scripts/e2e/44_fase5_ubs_complemento.sql`) | `enviada` |
| Hiperdia | enfermagem, médico, gestor | `/hiperdia` (`src/pages/hiperdia/Hiperdia.tsx`, `src/components/hiperdia/*`, `HiperdiaNaConsulta.tsx`) | `programa_incluir`, `programa_retirar`, `hiperdia_painel`, `hiperdia_do_paciente`, `registrar_avaliacao_pes(p_episodio, p_resultado, p_observacao)` ([M]`20270218000001_hiperdia.sql`); regra em `src/domain/hiperdia.ts` | Itens: `consulta`, `pa` (6 meses), `peso_altura`, `hba1c` (12 meses, pelo resultado do exame), `pes` (12 meses), `acs` (não registrado) |
| Pré-natal | enfermagem, médico, gestor | `/pre-natal` (`src/pages/preNatal/PreNatal.tsx`, `src/components/preNatal/*`) | `pre_natal_incluir(p_paciente, p_dum, p_episodio)`, `pre_natal_definir_dum`, `pre_natal_registrar_desfecho(p_gestacao, 'parto'/'aborto', p_data)`, `pre_natal_retirar`, `pre_natal_painel`, `pre_natal_do_paciente` ([M]`20270222000001_pre_natal.sql`); regra em `src/domain/preNatal.ts` | Entrada pela consulta com problema "pré-natal" ou CID/CIAP de gestação da nota C3; gestação = DUM até desfecho ou DUM + 294 d; puerpério 42 d. Itens: `primeira` (1ª consulta até 12 s), `consultas`, `pa`, `peso_altura`, `testes_1tri` (até 13s6d), `testes_3tri` (de 28 s), `puerperio`. Datas vêm dos episódios e dos resultados de exame; não há ficha de conduta obstétrica (seção 4) |
| Puericultura | enfermagem, médico, gestor | `/puericultura` (`src/pages/puericultura/Puericultura.tsx`) | `puericultura_painel`, `puericultura_do_paciente`, `puericultura_retirar(p_paciente, p_motivo)`, `puericultura_desfazer_saida` ([M]`20270224000001_puericultura.sql`); regra em `src/domain/puericultura.ts` | Entra toda criança cadastrada com menos de 2 anos; sai aos 2 anos ou à mão. Itens: `primeira` (até o 30º dia), `consultas`, `peso_altura`; ACS e vacina não existem (teto 60/100) |
| Retorno (contrarreferência) | UBS: recepção, enfermagem, médico, gestor | `/encaminhados` (`src/pages/encaminhados/Retornos.tsx`, `useRetornos.ts`) | gatilho em `registrar_desfecho`/`dar_alta` cria a contrarreferência; `contrarreferencias_da_unidade`, `contrarreferencias_do_paciente`, `contrarreferencia_abrir` ([M]`20270217000001_contrarreferencia_ubs.sql`) | `a_ver → visto`; `cancelada` se a alta for desfeita. Só episódios que encerram (alta, alta após medicação, alta a pedido, transferência, evasão, óbito) |

### 2.2 Encaminhamento UBS → UPA e chegada

| Passo | Papel | Tela | RPC / tabela | Regra |
|---|---|---|---|---|
| Enviar (da escuta ou da consulta) | enfermeiro ou médico da UBS | `EnviarUpa.tsx` | `encaminhar_upa` | Leva queixa, cor da escuta, último SOAP e sinais |
| Acompanhar | UBS | `/encaminhados` (`Encaminhados.tsx`) | `encaminhamentos_upa_origem`, `encaminhamentos_upa_do_paciente`, `encaminhamento_upa_cancelar` | `cancelado` pela UBS (coorte F5 #4) |
| Chegada na UPA | recepção da UPA | `/recepcao` → `VindoDaUbs.tsx` | `encaminhamentos_upa_destino`, `encaminhamento_upa_marcar_chegada` | "Chegou" só com a ficha escolhida (PR #438); sem registro em 12 h → `nao_chegou` (coorte F5 #3) |
| Encaminhamento interno (consultório ↔ sala de procedimentos) | médico | `AbaEncaminhamentoInterno.tsx`, `EncaminhamentosRecebidos.tsx` | `encaminhar_interno`, `aceitar_encaminhamento`, `recusar_encaminhamento`, `concluir_encaminhamento`, `cancelar_encaminhamento` → `encaminhamentos_internos` | `pendente, aceito, recusado, atendido, cancelado` |

### 2.3 Porta da UPA

| Passo | Papel | Tela | RPC / tabela | Estado ou regra |
|---|---|---|---|---|
| Ficha | recepção (ou plantonista/enfermeiro/gestor sem recepção escalada) | `/recepcao` | `registrar_ficha(p_setor, p_queixa, p_paciente, p_cadastro, …)` ([M]`20261003000003_cadastro_paciente.sql`) → `episodios`, `pacientes`; `trg_conta_do_episodio` abre a conta | Raça/cor só as 5 do IBGE (PR #441); CNS com dígito válido |
| Chamada e triagem | enfermeiro | `/triagem` (`Fila.tsx`, `Classificar.tsx`) | `chamar_paciente(p_episodio, p_sala)`, `protocolo_classificacao_da_unidade`, `classificar_risco(...)` → `classificacoes_risco` | Cores `vermelho, laranja, amarelo, verde, azul` ([M]`20260927000002`); protocolo da unidade em `supabase/dados/protocolo_aparecida_2025.sql` (24 fluxogramas adulto, 19 pediátricos, nenhum obstétrico; "Dor na coluna" acha por "costas"/"lombar", PR #439). Pediatria/adulto por `ehPediatrico` (seção 6). Bloco de gestação (`Gestacao.tsx`, `p_gestacao`) só acompanha o registro; não classifica. Rascunho cifrado 2 h (`src/lib/rascunhoTriagem.ts`) |
| Reclassificação | enfermeiro antes do médico; médico depois de `iniciar_atendimento` | `Classificar.tsx` / `AbaReavaliacao.tsx` | `classificar_risco` com `p_motivo` ≥ 10 letras ([M]`20270209000001_corte_14_anos.sql`, l. 88–104) | Só antes do desfecho |
| Espera e painel | recepção, gestor | `/recepcao/fila-medica`, `/painel/:token` (`src/pages/public/PainelChamada.tsx`), `/gestao/porta` | `fila_da_porta`, `ultimas_chamadas_porta`, `porta_agora`, `porta_grade` | Indicadores `indicador_espera_triagem`, `indicador_espera_medico` |
| Atendimento (SOAP) | plantonista | `/atendimento` (`JanelaAtendimento.tsx`, `AbaAtendimento.tsx`) | `painel_atendimento_ps`, `iniciar_atendimento`, `registrar_soap(…, p_cid)`, `salvar_rascunho_atendimento` | CID precisa existir ([M]`20261119000003_cid_existente.sql`) |
| Prescrição na porta | plantonista | `AbaPrescricao.tsx` (`src/components/prescricao/PrescricaoEstruturada.tsx`) | `prescrever(p_paciente, p_item jsonb)`, `alterar_item_prescricao`, `suspender_item`, `prescricao_porta_ativa`, `buscar_medicamento`, `diluicao_vigente`, `interacoes_justificadas` | Exige idade e **peso aferido, estimado ou referido** no atendimento ([M]`20261121000001_prescricao_idade_peso.sql`); frequência com horário na porta e "Agora" como dose única ([M]`20270301000001`, falta "ok produção"); interação ativa trava sem justificativa; alta vigilância pede liberação da farmácia |
| Checagem | enfermagem do setor | `/checagem` | `fila_checagem`, `aprazar`, `checar(p_item, p_situacao, p_horario, p_motivo)` → `administracoes` | `feito, nao_feito, recusado`; sem liberação só com motivo ≥ 10 (`sem_liberacao = true`). Alta só com as doses vencidas feitas ou não feitas com motivo |
| Exames | plantonista | `AbaExames.tsx` (`src/components/clinico/ExamesEAgravos.tsx`) | `exames_da_unidade`, `buscar_exames`, `pedir_exames(p_episodio, p_itens, p_urgencia, p_observacao)`, `resolver_exame(p_exame, p_resultado, p_motivo_cancelamento)`; catálogo do gestor em `/gestao/exames` ([M]`20261205000001_catalogo_exames.sql`) | LIS/RIS buscam e devolvem por FHIR R4 na Edge Function `supabase/functions/api` (`fhir.ts`, `api_v1_fhir`: `pedidos`, `coleta`, `estudo`); resultado liberado em `exame_resultado_itens` (usado pelo hiperdia). Sem valor nos exames |
| Reavaliação | plantonista | `AbaReavaliacao.tsx` | `registrar_reavaliacao`, `aguardar_reavaliacao(p_episodio, p_reavaliar_em)` | Reavaliação com mais de 12 h "não é observação" |
| Desfecho | plantonista | `AbaDesfecho.tsx` | `registrar_desfecho(p_episodio, p_desfecho, p_relato, p_detalhes)` ([M]`20260927000004`, versão final em [M]`20261119000003`) | `desfecho` ∈ `alta, alta_apos_medicacao, alta_a_pedido, transferencia, evasao, obito, observacao, internacao` (`cancelado` só por constraint). `evasao`, `alta_a_pedido` e `obito` exigem relato ≥ 15; só `evasao` dispensa registro de atendimento; `obito` fecha com CID. Avisa a UBS de origem (contrarreferência) |
| Observação | plantonista; enfermagem acompanha | desfecho `observacao` → `/plantao/observacao` (`secoes/PacientesObservacao.tsx`, `src/components/observacao/*`) | `private.box_livre` escolhe o box; `painel_observacao`, `observacao_atender`, `observacao_reavaliar`, `observacao_reavaliado`, `observacao_iniciar_protocolo(p_internacao, p_sigla)`, `observacao_avancar_protocolo`, `observacao_encerrar_protocolo`, `finalizar_observacao(p_internacao, p_desfecho, p_cid, p_relato, p_detalhes)` ([M]`20261004000007_observacao.sql`) | Pendência de 6 h de permanência; reavaliação até 12 h; prescrição com horários; "Vindos da porta" na prescrição do leito |
| Internação | plantonista | desfecho `internacao` com `p_detalhes.leito_id` → `/plantao/internacao/pacientes` (`PacientesInternados.tsx`, `src/components/internacao/*`, caderno do leito) | `leitos_para_ocupar`, `reservar_leito(p_leito, p_horas, p_paciente, p_motivo)`, `trg_conta_da_internacao` abre a conta de internação, `registrar_admissao(p_internacao, p_conteudo, p_ficha)` ([M]`20270203000005`), `registrar_diagnostico`, `registrar_evolucao` (porta e leito), `prescricao_vigente`, `pedir_exames_internacao`, `acuidade` (NEWS2/qSOFA no leito), `registrar_reavaliacao_quadro`, `enviar_passagem` / `colegas_para_passagem` (passagem médica), laudo de AIH (`documentos_clinicos` tipo `laudo_aih` → `trg_aih_do_laudo`) | Leito: `tipo_leito` ∈ `clinico, isolamento, estabilizacao, observacao`; `status_leito` ∈ `livre, ocupado, bloqueado, higienizacao`; ciclo com `bloquear_leito`, `desbloquear_leito`, `concluir_higienizacao`, `liberar_leito_sem_paciente`, `cancelar_reserva` (Fase 0, tarefas 6–7) |
| Transferência interna de leito/setor | plantonista; gestor | caderno do leito; `/internacao` do gestor | `transferir_paciente(p_paciente, p_destino, p_motivo)`; gestor: `transferir_internado` ([M]`20260926000003`) | — |
| Alta da internação | plantonista | `src/components/alta/*` (`FormularioAlta`, pacote de alta) | `impeditivos_alta(p_internacao)`, `dar_alta(p_internacao, p_tipo, p_cid, p_quando, p_justificativa, p_observacoes, p_detalhes)`, `gerar_pacote_alta(p_internacao, p_orientacoes, p_retorno)`, `registrar_impressao_pacote_alta`, `/alta/:token` (`src/pages/public/PacoteAlta.tsx`), `cancelar_alta(p_internacao, p_justificativa)` | `p_tipo` ∈ `alta_melhorada, alta_pedido, alta_evasao, transferencia_externa, obito`; `alta_pedido`/`alta_evasao` com observação ≥ 15; `obito` e `transferencia_externa` com detalhes. Impeditivos: documento em rascunho, passagem pendente, parecer aberto, notificação aberta, doses vencidas. Alta desfeita cancela a contrarreferência (coorte F5 #9) |
| Evasão | plantonista (porta) / plantonista (leito) | `AbaDesfecho.tsx` com `src/components/porta/MotivoEvasao.tsx`; `dar_alta('alta_evasao')` | `registrar_desfecho('evasao', relato ≥ 15)`; indicador `indicador_evasao` ([M]`20261029000006_evasao.sql`) | Conta como evasão no painel do gestor e nos filtros de BI |
| Óbito | plantonista | `AbaDesfecho.tsx` / alta | `registrar_desfecho('obito')` ou `dar_alta('obito')` com CID; declaração como documento clínico | Cancela pareceres abertos; fecha a conta como terminada |
| Transferência externa | plantonista + regulação | desfecho `transferencia` ou `dar_alta('transferencia_externa')`; regulação tipo `transferencia` (seção 2.4) | `registrar_desfecho('transferencia')`; `regulacao_solicitar(tipo='transferencia', transporte obrigatório)` | A chegada regulada **não** cria a internação no destino: o destino abre a ficha e interna pelo fluxo normal |

### 2.4 Regulação, NIR e mapa de vagas

Telas: `src/pages/regulacao/Regulacao.tsx` (NovaSolicitacao, Lista, Detalhe, Fila, PainelDecisao, ResponderPendencia, Reenviar, Criterios, Centrais), `src/components/regulacao/{AnexosRegulacao,DestinoRegulacao,HistoricoRegulacao,IndicadoresRegulacao,MapaVagas,SlaRegulacao}.tsx`, `src/pages/nir/Nir.tsx`, `src/pages/rede/Rede.tsx`. Migrations [M]`20261107000001` a [M]`20261118000001`.

| Passo | Papel | RPC / tabela | Estado produzido |
|---|---|---|---|
| Central da organização | super admin | `regulacao_definir_central` → `centrais_regulacao`; o `regulador` é vínculo na unidade da central | — |
| Solicitar | plantonista, gestor ou NIR da origem (com CNES) | `regulacao_solicitar` → `regulacao_solicitacoes`, `regulacao_eventos` | `enviada`. `tipo` ∈ `consulta, exame, leito, transferencia`; `prioridade` proposta ∈ `emergencia, urgencia, prioritaria, eletiva, nao_classificada`; `vulnerabilidades` inclui `gestante`, `crianca`, `idoso`; MIRA: SIGTAP, CID, quadro ≥ 20 letras |
| Anexos | origem e central | `regulacao_registrar_anexo`, `regulacao_anexar_documento`, `regulacao_anexos`, `regulacao_retirar_anexo` (motivo) → `regulacao_anexos`, bucket `regulacao` | — |
| Fila regulada | regulador, gestor da central | `regulacao_fila` (ordem: `nao_classificada`, prioridade, espera; atualiza a cada 30 s) | — |
| Assumir / priorizar | regulador | `regulacao_assumir`, `regulacao_soltar`, `regulacao_priorizar`, `regulacao_criterios` | `em_analise`; `prioridade_regulador` à parte da proposta |
| Decisão | regulador | `regulacao_autorizar` (destino obrigatório), `regulacao_negar` (motivo ∈ `sem_indicacao, sem_oferta, fora_escopo, duplicidade, ja_atendido_obito, outro`), `regulacao_devolver`, `regulacao_pendencia` | `aguardando_destino`, `negada`, `devolvida`, `pendencia` |
| Responder pendência / reenviar | solicitante, médico assistente, gestor, NIR | `regulacao_responder_pendencia`, `regulacao_reenviar` | volta à fila mantendo a posição |
| Aceite do destino | plantonista ou gestor do destino | `regulacao_destino_lista`, `regulacao_leitos_destino`, `regulacao_destino_aceitar` → `regulacao_destino_respostas`, `reservas_leito`; `regulacao_destino_recusar` (motivo ∈ `sem_vaga, sem_recurso, perfil_incompativel, outro`, ≥ 10 letras) | `autorizada`; reserva até max(agora + 24 h, previsto + 8 h) |
| Destino fora da rede | central | `regulacao_registrar_externo`, `regulacao_registrar_resposta_externa` | `autorizada` |
| Saída e chegada | origem; destino (ou central se externo) | `regulacao_marcar_saida`, `regulacao_marcar_chegada(p_chegou)` | `em_transito` → `realizada` ou `falta` |
| Cancelar | origem ou central | `regulacao_cancelar` (motivo ≥ 10) | `cancelada` |
| SLA e prazos | central configura; origem evolui | `regulacao_definir_prazos`, `regulacao_prazos`, `regulacao_atualizar_evolucao`, `regulacao_sla_painel` → `regulacao_prazos`, `regulacao_evolucoes`, `regulacao_status_tempos` | Padrões: evolução 12 h, 72 h sem evolução, pendência 3 h, destino 24 h (1–168). Só alerta: cron `regulacao-sla-avisos` (15 min) → `notificacoes_plantonista` tipo `reg_prazo_destino_<n>`, para origem, regulador e destino; no painel da origem, `destino_atrasado = 1` |
| Histórico | origem, central, leito, porta, prontuário | `regulacao_historico_paciente`, `regulacao_historico_detalhe` → `regulacao_eventos` (só inserção) | — |
| Mapa de vagas | gestor de cada unidade edita; central vê tudo | `regulacao_mapa_vagas`, `regulacao_setores_oferta`, `regulacao_ofertar_setor`, `regulacao_salvar_servico`, `regulacao_confirmar_servico` → `regulacao_servicos` | Serviço "desatualizado" após 12 h sem confirmação; leitos em tempo real |
| NIR | `nir` escalado; gestor sempre | `nir_pendencias`, `nir_cobrar` → `nir_cobrancas` | Itens: `aih_sem_aih, aih_sem_decisao, aih_rejeitada, apac_sem_decisao, apac_rejeitada, reg_pendencia, reg_evolucao, reg_destino, reg_chegada`. O NIR não aceita destino nem decide |
| Indicadores | central e gestor | `regulacao_indicadores` | — |

Status completos do CHECK: `rascunho, enviada, em_analise, pendencia, devolvida, aguardando_destino, autorizada, agendada, em_transito, realizada, falta, negada, cancelada, excluida`. Nenhuma RPC grava `rascunho`, `agendada` ou `excluida`.

### 2.5 Telemedicina, teleinterconsulta e parecer

| Passo | Papel | Tela | RPC / tabela | Estado |
|---|---|---|---|---|
| Solicitar teleinterconsulta | plantonista ou gestor que atua no paciente | `/teleinterconsulta` | `telemedicina_na_unidade`, `solicitar_teleinterconsulta` (pergunta ≥ 10; consentimento ∈ `obtido, representante_legal, emergencia_sem_condicao`) → `teleinterconsultas`, `documentos_clinicos` | `aberta` |
| Aceitar e responder | telemedicina escalada (não o solicitante) | `/teleinterconsulta`, `/telemedicina/:tela` | `aceitar_teleinterconsulta`, `responder_teleinterconsulta` (parecer ≥ 20) | `em_atendimento` → `respondida`; `cancelar_teleinterconsulta` só antes do aceite |
| Parecer presencial | médico com o paciente pede; plantonista/telemedicina com a especialidade responde (não quem pediu) | `src/components/parecer/AbaParecer.tsx`; `/pareceres` | `solicitar_parecer` (≥ 15), `pareceres_fila`, `iniciar_analise_parecer`, `salvar_rascunho_parecer`, `concluir_parecer`, `cancelar_parecer`, `definir_minhas_especialidades` | `solicitado → em_analise → realizado / cancelado`; parecer aberto impede a alta; fechar a porta cancela os abertos |

Tudo é escrito: não há vídeo nem assinatura ICP-Brasil (pendente).

### 2.6 Notificação compulsória e SINAN

| Passo | Papel | Tela | RPC / tabela | Regra |
|---|---|---|---|---|
| Suspeita | médico | `AbaExames.tsx`, `EvolucaoMedica.tsx` | `marcar_agravo`, `resolver_agravo` → `agravos_notificacao` (`suspeito, notificado, descartado`; origem `suspeita_medica, cid, manual`) | O CID que bate com `lnnc_cids` sugere o agravo (mapeamento ainda não conferido pela vigilância) |
| Lista e abertura | gestor sempre; plantonista e enfermeiro na escala | `/notificacao-compulsoria` (`NotificacaoCompulsoria.tsx`, `dados.ts`) | `notificacao_compulsoria_periodo`, `abrir_notificacao` | Situações: `sugerido, a_registrar, reaberto, notificado, descartado`; aberta, impede a alta |
| Ficha SINAN | idem | `FichaSinan.tsx` | `notificacao_ficha`, `salvar_ficha_notificacao`, `registrar_notificacao(p_numero_sinan)`, `reabrir_notificacao(p_motivo)` | Obrigatórios: data dos sintomas, nome, nascimento ou idade, sexo, gestante (se F). Notificador = login. Envio ao SINAN é fora do sistema |

Catálogo `lnnc_agravos` (Portaria GM/MS 10.175/2026): imediata (24 h) ou semanal, destino MS/SES/SMS.

### 2.7 Farmácia

| Passo | Papel | Tela | RPC / tabela | Estado ou regra |
|---|---|---|---|---|
| Validação / liberação | farmacêutico | `/farmacia` (fila), `/alta-vigilancia` | `fila_validacao`, `validar_item` → `validacoes_prescricao` | `confere` / `devolvido`; na alta vigilância a liberação é a última validação `confere`; item alterado é item novo |
| Alta vigilância | farmacêutico ou gestor define | `AltaVigilancia.tsx`, `SeloAltaVigilancia.tsx` | `alta_vigilancia_da_unidade`, `definir_alta_vigilancia` → `alta_vigilancia_unidade`; regras ISMP Brasil 2019 em `private.regras_alta_vigilancia` | Sem liberação, a enfermagem administra só com motivo ≥ 10; `administracoes_sem_liberacao` para o farmacêutico conferir depois |
| Dupla checagem | — | **nenhuma tela chama** | `conferir_alta_vigilancia`, `estado_dupla_checagem`, `duplas_pendentes` → `duplas_checagens` ([M]`20261031000001`) | Substituída pela liberação da farmácia em 09/10/2026; `checar` ainda aceita dupla completa das últimas 2 h |
| Dispensação | farmacêutico; enfermagem com a farmácia fechada (`sem_farmaceutico` + justificativa) | `/dispensacao` | `itens_para_dispensar`, `dispensar_item`, `dispensar_avulso`, `devolver_dispensacao`, `conferir_dispensacao` → `dispensacoes` (`prescricao`/`avulsa`), `dispensacao_devolucoes` | Quantidade sugerida para 24 h; dispensar valida o item; saldo pode ficar negativo |
| Estoque | farmacêutico | `Farmacia.tsx` | `farmacia_estoque`, `registrar_entrada_estoque` (documento), `ajustar_estoque` (inventário, motivo), `extrato_estoque` → `estoque_medicamento`, `movimentos_estoque` (`saldo_inicial, entrada, saida_prescricao, saida_avulsa, devolucao, ajuste_inventario`) | **Sem lote nem validade** (RT 27/10/2026) e sem preço |
| Faltas | farmacêutico; médico sinaliza | `Farmacia.tsx`, `PainelFarmacia.tsx` | `sinalizar_falta`, `faltas_priorizadas`, `avancar_falta`, `registrar_retorno_falta` → `faltas_medicamento` | `registrada → em_cotacao → reposta` |
| Interações críticas | farmacêutico mantém; médico justifica | `/interacoes` | `lista_interacoes`, `salvar_interacao`, `interacoes_justificadas` → `interacoes_criticas` (`proposta, ativa, inativa`) | 15 pares ONC entram como proposta |
| Diluições | farmacêutico (unidade), super admin (modelo) | `Diluicoes.tsx`, `/plantonista/farmacia/referencia-diluicao` | `padrao_diluicao_unidade`, `salvar_diluicao`, `publicar_diluicao_versao`, `diluicao_publicada` | `rascunho → publicado → substituido`; sem CRF não publica |
| Unidade de consumo | farmacêutico ou gestor | `/unidade-consumo` | `medicamentos_unidade_consumo`, `definir_unidade_consumo` → `medicamento.unidade_consumo`, `medicamento_unidade_historico` | Sugerida pela apresentação na entrada do cadastro |

### 2.8 Prontuário completo e pedido de acesso

| Passo | Papel | Tela | RPC / tabela | Regra |
|---|---|---|---|---|
| Pedir | plantonista, telemedicina, enfermeiro, técnico | `/prontuarios` (`PedidosProntuario.tsx`) | `buscar_paciente_para_pedido`, `pedir_acesso_prontuario` (motivo ≥ 10), `meus_pedidos_acesso`, `cancelar_pedido_acesso` → `pedidos_acesso_prontuario` | `pendente`; um pendente por pessoa e paciente; farmacêutico e gestor não pedem |
| Decidir | gestor da unidade | `/auditoria` | `pedidos_acesso_da_unidade`, `decidir_pedido_acesso` | `aprovado` (`valido_ate = now() + 24 h`) ou `recusado` (motivo ≥ 5); ninguém decide o próprio; sem prazo para decidir |
| Ler | quem teve aprovação; gestor direto; quem cuida agora | `/prontuarios/:pacienteId` (`ProntuarioLeitura.tsx`), `HistoricoEncerrado.tsx` | `abrir_prontuario`, `historico_encerrado`, `abrir_historico_encerrado` (motivo ≥ 10, vale 12 h) → `private.acessos_historico` | Só leitura por 24 h (`private.acesso_encerrado_vigente`) |
| Impressão e anexos | plantonista | `/impressao-prontuario`, `/pendencias-pep` | `documentos_do_paciente`, `registrar_impressao_prontuario`, `registrar_anexo_prontuario` | Fora do pedido de acesso |

### 2.9 Escala e check-in — a porta de entrada

| Passo | Papel | Tela | RPC / tabela | Regra |
|---|---|---|---|---|
| Montar e publicar | gestor | `/escala` (`EscalaMes.tsx`) | `escala_mes_gestor`, `publicar_escala`, `marcar_vaga_escala`, `adicionar_plantao_escala`, `gerar_escala_mensal_detalhada` → `escala_plantao` (`turno` ∈ `manha, tarde, noite, madrugada`; `duracao_min` ∈ `360, 720`) | A escala recusa sobreposição de pessoa no mesmo horário |
| Vagas, troca, passagem | profissional; colega; gestor | `/agenda?aba=vagas`, `PedidosEscala.tsx`, `PedidosParaVoce.tsx` | `vagas_abertas`, `candidatar_vaga`, `solicitar_troca`, `passar_plantao`, `aceitar_passagem`, `aprovar_troca`, `fracionar_plantao` → `solicitacoes_escala`, `trocas_plantao`, `candidaturas_escala` | Decisões A1–C2 em `docs/escala/` |
| A escala abre a porta | todos os escalados | `src/components/AppShell.tsx`, `src/hooks/usePlantao.ts` (relê a cada 60 s) | `situacao_checkin`, `turno_atual`, `meu_plantao_agora`, `setores_na_escala_agora`, `horario_servidor`; `private.plantoes_agora()` ([M]`20260926000003_fase1_turno_como_janela.sql`, [M]`20261014000001_checkin_tolerancia_porta.sql`) | Ver seção 6 (janela) |
| Check-in | escalado | `src/components/GateCheckIn.tsx`, `checkin/FormularioCheckin.tsx`, `/plantao/check-in`, `src/lib/geolocalizacao.ts` | `registrar_checkin(p_unidade, p_lat, p_lng, p_observacao, p_justificativa)` → `presenca_plantonista`; `registrar_checkout`; cron `checkout-automatico` | Ver seção 6 (raio) |
| Presenças e liberação | gestor | `PresencasDoDia.tsx` | `presencas_do_dia_gestor`, `liberar_pos_plantao(p_unidade, p_perfil, p_minutos, p_motivo)` | 5–120 min, até 12 h depois do fim |

## 3. Custos e faturamento

Resumo: o único valor em reais ligado ao atendimento é o **valor de referência do SIGTAP** (`valor_sa` na porta; `valor_sh + valor_sp` na internação), calculado na hora por `private.conta_itens` e congelado em `contas.itens_congelados` (jsonb) quando a conta fecha. Medicamentos e materiais entram na conta **sem valor**. O outro valor em reais é o do **plantão** (`remuneracoes_plantao`), que vai ao ERP e não entra na conta do paciente. Nos cenários, os valores são fictícios: o que importa é o campo e o momento.

### 3.1 Conta do atendimento

| Item | Tabela(s) | Colunas de valor | Origem do valor | Momento em que nasce | RPC | Tela |
|---|---|---|---|---|---|---|
| Conta da porta (`tipo='ambulatorial'`) | `contas`, `conta_eventos`, `private.conta_sequencia` | nenhuma coluna numérica; `itens_congelados` jsonb (`valor_unitario`, `valor_total`); `total_referencia` calculado em `conta_detalhe` | SIGTAP `valor_sa` | gatilho `trg_conta_do_episodio` ao abrir a ficha ([M]`20261127000001_conta_atendimento.sql`) | `contas_da_unidade`, `conta_detalhe`, `mudar_etapa_conta(p_conta, p_para, p_motivo)`, `trocar_pagador_conta` | `src/pages/faturamento/Contas.tsx` |
| Conta da internação (`tipo='internacao'`, `conta_origem_id` → conta da porta) | as mesmas | as mesmas | SIGTAP `valor_sh + valor_sp` | gatilho `trg_conta_da_internacao` ao gravar `internacoes.internado_em` | as mesmas | a mesma |
| Etapas | `contas.status` | — | — | `aberta → em_conferencia → fechada → faturada`; fechar só depois do desfecho/alta e sem pendência bloqueante; reabrir só o gestor com motivo ≥ 10 | `mudar_etapa_conta` ([M]`20261203000001_conta_pre_auditoria.sql`) | Contas.tsx |
| Pagador | `contas.pagador` ∈ `sus, convenio, particular` | — | `pacientes.categoria` | abertura; troca só pelo faturamento com a conta aberta | `trocar_pagador_conta` | Contas.tsx |
| Consulta médica (porta) | derivada de `episodios.atendimento_medico_id` | `valor_sa` × qt | SIGTAP; código da unidade em `bpa_procedimentos_unidade` (uso `atendimento_medico`) | quando o médico assume (`iniciar_atendimento`); calculado na leitura | `conta_detalhe` → `private.conta_itens` ([M]`20261128000001_conta_procedimentos.sql`) | Contas.tsx |
| Acolhimento com classificação de risco | `classificacoes_risco` (1ª do episódio) | `valor_sa` | SIGTAP, uso `classificacao` | na primeira classificação | idem | Contas.tsx |
| Medicação administrada (porta) | `administracoes` com `situacao='feito'`, agrupadas por paciente, profissional e dia | `valor_sa` do código de uso `medicacao` | SIGTAP | quando a enfermagem checa "feito" | idem | Contas.tsx |
| Procedimento registrado (porta) | `procedimentos_realizados` ([M]`20261103000002_bpa_i.sql`) | `valor_sa` calculado | SIGTAP; código na lista da unidade (uso `lista`) | registrado por quem fez ou lançado pelo faturamento | `registrar_procedimento`, `cancelar_procedimento_realizado`, `lancar_procedimento_conta`, `retirar_procedimento_conta` | Contas.tsx |
| Procedimento principal da AIH (internação) | `aihs` + laudo (`documentos_clinicos.conteudo->'aih'->>'procCod'`) | `valor_sh + valor_sp`, qt 1 | SIGTAP | emissão do laudo de AIH | `conta_detalhe` | Contas.tsx |
| Procedimento especial/secundário da internação | `conta_lancamentos` | `qt × (valor_sh + valor_sp)` | SIGTAP; código digitado e conferido | lançado pelo faturamento | `lancar_procedimento_conta`, `retirar_procedimento_conta` | Contas.tsx |
| Medicamentos | `dispensacoes`, `dispensacao_devolucoes`, conferidas com `administracoes`; `conta_medicamentos_fora` ([M]`20261201000001`) | **nenhuma**: só `dispensado`, `devolvido`, `liquido`, `administrado` | — | na dispensação (`dispensar_item`); antes de `internado_em` vai à conta da porta, depois à da internação | `private.conta_medicamentos`, `medicamento_fora_da_conta` | Contas.tsx, Dispensacao.tsx |
| Unidade de consumo | `medicamento.unidade_consumo`, `medicamento_unidade_historico` ([M]`20261129000001`) | nenhuma | catálogo | entrada do medicamento no cadastro | `definir_unidade_consumo` | UnidadeConsumo.tsx |
| Materiais | `materiais_unidade` (cadastro, SIGTAP opcional do grupo 07), `conta_materiais` (`quantidade numeric(10,2)`) ([M]`20270226000001_materiais.sql`) | **nenhuma**, mesmo com código SIGTAP | — | lançado à mão pelo faturamento com a conta aberta ou em conferência | `materiais_da_unidade`, `material_salvar`, `conta_lancar_material`, `conta_retirar_material` | Materiais.tsx, Contas.tsx |

### 3.2 BPA-I e BPA-C

| Item | Tabela(s) | Valor | Momento | RPC | Tela |
|---|---|---|---|---|---|
| Configuração | `bpa_config_unidade` (órgão, sigla, CNPJ, destino, caráter, INE), `bpa_procedimentos_unidade` (código por fonte e lista; `sempre_bpa_c`); CNES em `unidades` | — | — | `bpa_config`, `definir_bpa_config`, `associar_procedimento_bpa`, `marcar_sempre_bpa_c`, `buscar_sigtap`, `definir_cnes_unidade` (gestor) | `Bpa.tsx`, `CnesUnidade.tsx` |
| Linhas | calculadas por `private.bpa_i_linhas` e `private.bpa_linhas` (BPA-I, BPA-C ou "fora"); a UBS não gera linha ([M]`20270211000002`, l. 141–143) | **o arquivo não tem valor**, só procedimento e quantidade | mês do fato, horário de Brasília | `bpa_conferencia` | Bpa.tsx |
| Críticas bloqueantes | — | — | — | sem código SIGTAP da fonte; procedimento inexistente; CNS inválido do profissional (`perfis.cns`); CBO (`perfis.cbo`); CBO de enfermagem na medicação; raça/cor; etnia se indígena; sexo; nascimento. BPA-C: instrumento, CBO não aceito, quantidade acima de `qt_maxima`. Paciente sem CNS/CPF e endereço são só aviso; CID sai na linha mas não é crítica | Bpa.tsx |
| Fechamento da competência | `bpa_fechamentos` (`linhas`, `linhas_bpa_c`, `folhas`, `controle`, `excluidas`, `avisos`, `sigtap_competencia`) | nenhuma | pelo faturamento ou gestor (`e_faturamento`); bloqueia CNES fora do formato, cabeçalho incompleto, competência futura | `fechar_competencia_bpa`, `reabrir_competencia_bpa` (motivo ≥ 10), `arquivo_bpa` (.txt BPA Magnético 05.00) | Bpa.tsx |
| Trava | — | — | com a competência fechada, `registrar_procedimento` e `cancelar_procedimento_realizado` são recusados | — | — |

### 3.3 AIH e APAC

| Item | Tabela(s) | Valor | Momento | RPC | Tela |
|---|---|---|---|---|---|
| AIH | `aihs` (`status` ∈ `solicitada, aprovada, rejeitada, cancelada`; `numero` 13 dígitos; `competencia`; `criticas`), `aih_eventos` ([M]`20261102000002_aih_ciclo.sql`) | **nenhuma**; o valor aparece na conta (SH + SP do procCod) | gatilho `trg_aih_do_laudo` quando o laudo (`documentos_clinicos` tipo `laudo_aih`) fica ativo; cancelar o laudo cancela a AIH | `decidir_aih`, `ajustar_competencia_aih`, `cancelar_aih` (regulador com CRM), `aihs_da_unidade`, `conferir_aih`, `meus_laudos_aih_do_plantao` | `src/pages/regulacao/Aih.tsx`; laudo no caderno do leito |
| Críticas da AIH | `private.catalogo_criticas_aih()` (10 códigos), `aih_criticas_unidade` (gestor: bloqueante ou aviso) | — | emissão do laudo | `criticas_aih_da_unidade`, `definir_critica_aih` | `CriticasAih.tsx` em `/unidade?aba=configuracoes` |
| APAC | `apacs` (`solicitada, autorizada, rejeitada, cancelada`; `numero`; validade), `apac_eventos`, `apac_execucoes` (`procedimentos` jsonb `{procedimento, quantidade}`), `apac_fechamentos` ([M]`20261104000001_apac.sql`) | **nenhuma**; só a glosa usa `valor_sa` | médico com CRM solicita; regulador decide; faturamento executa e fecha | `solicitar_apac`, `buscar_sigtap_apac`, `decidir_apac`, `cancelar_apac`, `registrar_execucao_apac`, `apac_conferencia`, `fechar_competencia_apac`, `arquivo_apac`, `definir_apac_orgao_emissor` | `Apac.tsx`, `src/components/apac/SolicitarApac.tsx` |

Não existe exportação da AIH (SISAIH01).

### 3.4 Pré-auditoria e glosas

| Item | Tabela(s) | Valor | Estados | RPC | Tela |
|---|---|---|---|---|---|
| Pré-auditoria | colunas em `contas`: `liberada_em`, `liberada_por`, `liberacao_motivo`, `liberacao_pendencias`, `pendencias_fechamento`; `conta_eventos.detalhes` | — | pendência bloqueante ou aviso por grupo: unidade, paciente, profissional, procedimento (inclui CID exigido pelo SIGTAP), documento, medicamento, material | `private.conta_pendencias`, `contas_pendencias_resumo`, `liberar_fechamento_conta` (gestor, conta em conferência) | Contas.tsx |
| Glosa | `conta_glosas`, `conta_glosa_eventos` ([M]`20261204000001_conta_glosas.sql`) | `valor`, `valor_sugerido`, `valor_recuperado` (`numeric(12,2)`); sugerido = referência SIGTAP do item (`private.glosaveis_da_conta`); faturamento edita | `aberta → em_recurso → recuperada / perdida` (recurso negado volta a `aberta`; só o gestor marca `perdida`); só em conta fechada ou faturada; motivos `cns, cbo, cid, quantidade, duplicidade, prazo, documento, outro` | `registrar_glosa`, `mudar_glosa`, `glosas_da_unidade` | `Glosas.tsx` |

Glosa é registrada à mão: não há importação do retorno do SIA/SIH.

### 3.5 ERP: contas e plantões

| Item | Tabela(s) | Valor | Momento | RPC / API | Tela |
|---|---|---|---|---|---|
| Conta para o ERP | `conta_versoes_erp` (`dados` jsonb, `total`, `valor_lancado`, `conciliacao` ∈ `pendente, conciliada, divergente, estornada`) ([M]`20270120000001_erp_contas.sql`) | `total` (só itens faturáveis), `valor_lancado` | gatilho `trg_erp_versao` ao faturar; reabrir torna a versão "substituída"; glosa atualiza `alterada_em` | `erp_contas_da_unidade`, `erp_baixar` (CSV/JSON) | `EnvioErp.tsx` |
| Plantões para o ERP | `plantao_versoes_erp` ([M]`20270120000002_erp_plantoes.sql`); `remuneracoes_plantao` (por unidade, setor e turno; digitada pelo gestor em `src/pages/Configuracao.tsx`) | `total`; por plantão `valor_referencia` e `valor` (zero sem presença); proporcional no fracionado (`private.plantao_erp_valor`) | gestor fecha o mês depois de acabar; reabrir pede motivo | `plantoes_erp_previa`, `fechar_plantoes_erp`, `reabrir_plantoes_erp`, `erp_baixar('plantoes')` | EnvioErp.tsx (aba do gestor) |
| Comunicação | o ERP **busca**: `public.api_v1_financeiro` (service_role) pela Edge Function `supabase/functions/api/financeiro.ts`: `/financeiro/contas`, `/contas/{id}`, `/contas/{id}/versoes/{n}/retorno`, `/financeiro/plantoes`, `/plantoes/{id}/retorno`; chave com recurso `financeiro` | — | — | `api_criar_chave` ([M]`20270120000003`) | `src/pages/admin/Integracoes.tsx` |

Webhooks (`private.webhook_tipos()`, [M]`20270201000001`): paciente, atendimento, internação, prescrição e regulação; nenhum de conta, glosa ou ERP.

### 3.6 SIGTAP

| Item | Tabela | Colunas de valor | Como o app consulta |
|---|---|---|---|
| Procedimentos | `terminologia.sigtap_procedimento` ([M]`20260817000003_terminologia.sql`; `qt_maxima` em [M]`20261103000004`) | `valor_sa`, `valor_sh`, `valor_sp` (`numeric(12,2)`), `competencia`, `sexo`, `idade_min`, `idade_max`, `complexidade` | `buscar_sigtap(p_termo)`, `buscar_sigtap_apac`, `procedimentos_do_cid`, `terminologia_buscar`, `private.sigtap_competencia()` |
| Compatibilidade com CID | `terminologia.sigtap_procedimento_cid` (`principal`) ([M]`20260929000003_fase4_aih_sigtap.sql`) | — | `conferir_aih`, `criticas_aih`, `criticas_apac`, pré-auditoria |
| Instrumento de registro | `terminologia.sigtap_procedimento_registro` (01 BPA-C, 02 BPA-I, 04/05 AIH, 06/07 APAC) | — | `bpa_linhas`, críticas |
| CBO aceito | `terminologia.sigtap_procedimento_ocupacao` | — | idem |
| Carga | `data/terminologia/sigtap/*.txt` (competência 202609), `scripts/terminologia/gerar-sigtap-sql.ts`, `importar-sigtap.ts`; na homologação, `supabase/homolog/partes/sigtap_cid_parte1..4.sql` | só `valor_sa/sh/sp` e `qt_maxima` são carregados; `QT_DIAS_PERMANENCIA`, pontos, financiamento e rubrica não | — |

Também existe `terminologia.medicamento_cmed` (`pf_sem_impostos`, ANVISA), só na busca de terminologia; não entra na conta nem na dispensação.

### 3.7 Onde o custo nasce em cada fluxo (resumo para os cenários)

| Fluxo | O que gera valor | Campo | Papel que dispara |
|---|---|---|---|
| UBS: escuta, consulta, hiperdia, pré-natal, puericultura | **nada** (sem BPA, sem conta com valor) | — | — |
| UPA: ficha | abre a conta ambulatorial, ainda sem itens | `contas` | recepção |
| UPA: classificação | item "acolhimento com classificação" | `classificacoes_risco` → `valor_sa` | enfermeiro |
| UPA: médico assume | item "consulta médica" | `episodios.atendimento_medico_id` → `valor_sa` | plantonista |
| UPA: medicação checada "feito" | item "administração de medicamento" (1 por paciente/profissional/dia) | `administracoes` → `valor_sa` | enfermagem |
| UPA: procedimento registrado | item com `valor_sa` | `procedimentos_realizados` | quem fez ou faturamento |
| Dispensação | medicamento na conta **sem valor** | `dispensacoes` | farmacêutico |
| Material | item **sem valor** | `conta_materiais` | faturamento |
| Internação: leito ocupado | abre a conta de internação | `internacoes.internado_em` | plantonista |
| Internação: laudo de AIH | procedimento principal `valor_sh + valor_sp` | `aihs` + laudo | plantonista emite; regulador decide |
| Internação: secundário/especial | `qt × (valor_sh + valor_sp)` | `conta_lancamentos` | faturamento |
| Alta/desfecho | libera o fechamento da conta | `contas.status` | plantonista → faturamento → gestor (liberação) |
| Glosa | `valor`, `valor_sugerido`, `valor_recuperado` | `conta_glosas` | faturamento; gestor marca perdida |
| Plantão | `valor_referencia`, `valor` por presença | `remuneracoes_plantao`, `plantao_versoes_erp` | gestor |
| Regulação, telemedicina, parecer, notificação | **nada** | — | — |

## 4. Ferramentas clínicas

O índice é `src/clinico/indice.ts` (`ROTA_DA_FICHA`, gerado por `scripts/rotas-fichas.mjs` do `src/content/registry.tsx`); o tipo `Ficha` (`src/clinico/ficha.ts`) tem `id, titulo, versao, publico ('adulto' | 'pediatrico' | 'ambos'), fontes[], revisadoEm`. A rota é `/plantonista/<seção>/<slug>`; `/plantao/...` não tem ficha clínica. Fontes-base: **HC** = Manual de Medicina de Emergência HCFMUSP, 3ª ed., 2022 (`src/clinico/adulto/fonte.ts`); **ICr** = Pronto-Socorro Pediatria ICr-HCFMUSP, 4ª ed., 2023 (`src/clinico/pediatria/fonte.ts`). Nenhuma dose é copiada aqui: o cenário remete ao id.

### 4.1 Gestação, pré-eclâmpsia e eclâmpsia

| id | Título | Lógica | Tela / rota | Fonte citada |
|---|---|---|---|---|
| `adulto-emergencia-hipertensiva` | Emergência hipertensiva — alvos e drogas EV (adulto); traz o bloco "Sulfato de magnésio — pré-eclâmpsia grave e eclâmpsia (OMS)" (`mlSulfatoMagnesio`, `MAGNESIO_PE`, `TOXICIDADE_MAGNESIO`), "Hidralazina — pré-eclâmpsia ou eclâmpsia" e o alvo `eclampsia` (pré-eclâmpsia/eclâmpsia ou HELLP) | `src/clinico/adulto/emergenciaHipertensiva.ts` | `src/pages/plantonista/manual/EmergenciaHipertensivaAdulto.tsx` → `/plantonista/emergencias/emergencia-hipertensiva-adulto` | HC cap. 19; Diretriz Brasileira de Hipertensão 2025 (cap. 11, gestação); OMS *Managing complications in pregnancy and childbirth* 2017 (Box S-4/S-5); OMS pré-eclâmpsia/eclâmpsia 2011 (rec. 12–15); INTERACT4 2024; ESO 2025 |
| `triagem-gestacao-naegele` | IG e DPP pela DUM (Naegele); bloco de gestação da triagem (tipo, G/P/A, DUM ou IG, intercorrências) — **não classifica risco** | `src/clinico/triagem/gestacao.ts`; servidor `private.normalizar_gestacao` | `src/pages/enfermagem/triagem/Gestacao.tsx` (em `Classificar.tsx`, sexo F); sem rota na Central | ACOG Committee Opinion 700, 2017 |
| (pré-natal) | Painel de boas práticas C3 (seção 2.1); sem conduta | `src/domain/preNatal.ts` | `/pre-natal` | Nota C3 SAPS/MS 2026; CAB 32 |

**Não existe**: ficha própria de pré-eclâmpsia, eclâmpsia, HELLP ou sulfato de magnésio (só dentro da emergência hipertensiva); hemorragia pós-parto, ocitocina, ectópica, descolamento; escore obstétrico (MEOWS — o `news2` diz que não se aplica à gestante); fluxograma "Gestante" no protocolo Aparecida 2025 (gestação só como discriminador em "Sangramentos" e condição na "Dengue"). `adulto-reposicao-magnesio` é hipomagnesemia, não eclâmpsia.

### 4.2 Sepse e deterioração

| id | Título | Lógica | Rota | Fonte |
|---|---|---|---|---|
| `sepse-adulto` | Sepse no adulto — SOFA, choque e lactato; itens qSOFA "só alerta" | `src/clinico/escores/sepseAdulto.ts` | `/plantonista/escores/sepse-adulto` | Sepsis-3 (JAMA 2016); SSC 2026; ILAS 2026; SOFA-2 (JAMA 2025) |
| `sofa-2` | SOFA-2 | `escores/sofa2.ts` | `/plantonista/escores/sofa-2` | Ranzani, JAMA 2025 |
| `news2` | NEWS2 (também `acuidade` no leito via `src/clinico/news2.ts`) | `escores/news2.ts` | `/plantonista/escores/news2` | RCP 2017; SSC 2026; versão brasileira 2020/2025 |
| `adulto-ressuscitacao-volemica` | Ressuscitação volêmica no choque e na sepse | `adulto/ressuscitacaoVolemica.ts` | `/plantonista/emergencias/ressuscitacao-volemica-adulto` | HC; SSC 2026; ILAS 2026; ARISE FLUIDS 2026 |
| `ped-phoenix` | Phoenix — sepse e choque séptico (criança) | `pediatria/choque.ts` | `/plantonista/pediatria/phoenix` | Phoenix (JAMA 2024) |
| `ped-choque-icr` | Choque séptico — criança | `pediatria/choque.ts` | `/plantonista/pediatria/choque-pediatrico` | ICr cap. 5; SSC pediátrica 2026; PRoMPT BOLUS 2026 |
| `ped-pews-icr`, `ped-pops-icr` | PEWS / POPS | `pediatria/triagem.ts` | `/plantonista/pediatria/pews`, `/pops` | ICr cap. 82 |

Alertas de sepse para o gestor: `alertas_sepse` (`src/pages/gestor/*`). Não há ficha própria de qSOFA nem SOFA clássico.

### 4.3 AVC e neuro

| id | Título | Lógica | Rota | Fonte |
|---|---|---|---|---|
| `adulto-trombolise-avc` | Trombólise no AVC isquêmico | `adulto/avcTrombolise.ts` | `/plantonista/emergencias/trombolise-avc-adulto` | HC cap. 38; AHA/ASA 2026; INTERACT4 2024; ESO 2025 |
| `adulto-nihss` | NIHSS | `adulto/avcTrombolise.ts` | `/plantonista/escores/nih-avc` | HC cap. 38 |
| `adulto-rankin-modificada` | Rankin modificada | idem | `/plantonista/emergencias/rankin-modificada` | HC cap. 38 |
| `abcd2` | ABCD2 | `escores/abcd2.ts` | `/plantonista/escores/abcd2` | ver ficha |
| `adulto-escore-ich` | Escore ICH | `adulto/reversaoAnticoagulacao.ts` | `/plantonista/emergencias/escore-ich` | HC cap. 39 |
| `adulto-cefaleia`, `adulto-hsa`, `adulto-ottawa-hsa`, `adulto-hunt-hess`, `adulto-wfns`, `adulto-fisher-hsa` | Cefaleia; HSA e escalas | `adulto/cefaleia.ts`, `adulto/hsa.ts` | `/plantonista/emergencias/cefaleia-adulto`, `hsa-adulto`, `ottawa-hsa`, `hunt-hess`, `wfns-hsa`, `fisher-hsa` | HC caps. 41; AHA/ASA 2023; ESO 2026 |
| `adulto-meningite` / `ped-meningite` | Meningite | `adulto/meningite.ts`, `pediatria/meningitePed.ts` | `/plantonista/emergencias/meningite-adulto`, `/plantonista/pediatria/meningite-ped` | HC cap. 43; MS 2024; ICr cap. 40 |
| `adulto-estado-de-mal-epileptico` / `ped-crise-epileptica-icr` | Estado de mal / crise epiléptica | `adulto/estadoDeMal.ts`, `pediatria/criseEpileptica.ts` | `/plantonista/calculadoras/hidantalizacao`, `/plantonista/pediatria/crise-epileptica-pediatrica` | HC cap. 46; ESETT 2019; ICr cap. 9 |
| `glasgow`, `four`, `ped-glasgow-icr` | Glasgow (GCS-P), FOUR, Glasgow criança | `escores/glasgow.ts`, `escores/four.ts`, `pediatria/tceDecisao.ts` | `/plantonista/escores/glasgow`, `/four`, `/plantonista/pediatria/glasgow-pediatrico` | Teasdale 1974; Brennan 2018; ICr cap. 16 |

### 4.4 SCA e cardiologia

| id | Título | Lógica | Rota | Fonte |
|---|---|---|---|---|
| `adulto-sca-inicial` | SCA — conduta inicial | `adulto/scaInicial.ts` | `/plantonista/emergencias/sca-inicial-adulto` | HC caps. 13–14; ACC/AHA 2025; ESC 2023 |
| `heart` | HEART | `escores/heart.ts` | `/plantonista/escores/heart` | Six 2008; SBC Dor Torácica 2025 |
| `adulto-timi-nstemi`, `timi-iamcsst`, `grace`, `killip` | TIMI, GRACE, Killip | `adulto/timi.ts`, `escores/timiIamcsst.ts`, `escores/grace.ts`, `escores/killip.ts` | `/plantonista/escores/timi`, `/timi-iamcsst`, `/grace`, `/killip` | HC; Morrow 2000; Granger 2003; Killip 1967 |
| `adulto-fibrinoliticos` | Fibrinolíticos (IAM com supra e TEP) | `adulto/anticoagulacao.ts` | `/plantonista/emergencias/fibrinoliticos-adulto` | HC caps. 14 e 32; ACC/AHA 2025 |
| `sgarbossa-modificado` | Sgarbossa modificado | `escores/sgarbossaModificado.ts` | `/plantonista/escores/sgarbossa-modificado` | ver ficha |
| `adulto-ic-aguda` | IC aguda | `adulto/insuficienciaCardiacaAguda.ts` | `/plantonista/emergencias/insuficiencia-cardiaca-aguda-adulto` | HC cap. 21; ESC 2021 |
| `adulto-fibrilacao-atrial`, `adulto-bradicardia`, `adulto-taquiarritmias` | Arritmias | `adulto/fibrilacaoAtrial.ts`, `adulto/pcr.ts` | `/plantonista/emergencias/fibrilacao-atrial-adulto`, `bradicardia-adulto`, `taquiarritmias-adulto` | HC; ERC 2025; AHA 2025 |
| `adulto-sindrome-aortica`, `adulto-add-rs` | Síndrome aórtica / ADD-RS | `adulto/emergenciaHipertensiva.ts` | `/plantonista/emergencias/sindrome-aortica-adulto`, `add-rs-disseccao-aorta` | HC cap. 20 |

### 4.5 PCR, pós-PCR e neonatal

| id | Título | Lógica | Rota | Fonte |
|---|---|---|---|---|
| `adulto-pcr` | Drogas e desfibrilação na PCR | `adulto/pcr.ts` | `/plantonista/emergencias/pcr-adulto` | HC cap. 2; AHA ALS 2025 |
| `adulto-pos-pcr` | Cuidados pós-PCR | `adulto/posPcr.ts` | `/plantonista/emergencias/pos-pcr-adulto` | HC cap. 6; ERC-ESICM 2025 |
| `ped-rcp-icr` | RCP pediátrica | `pediatria/rcp.ts` | `/plantonista/pediatria/rcp-pediatrica` | ICr caps. 1–2; PALS 2025 |
| `ped-reanimacao-neonatal` | Reanimação do RN ≥ 34 s | `pediatria/reanimacaoNeonatal.ts` | `/plantonista/pediatria/reanimacao-neonatal` | SBP/PRN 2026 |
| `ped-ictericia-neonatal` | Icterícia neonatal ≥ 35 s | `pediatria/ictericia.ts` | `/plantonista/pediatria/ictericia-neonatal` | AAP 2022 |

### 4.6 Trauma

| id | Título | Lógica | Rota | Fonte |
|---|---|---|---|---|
| `adulto-trauma-inicial` | Politraumatizado — atendimento inicial | `adulto/trauma.ts` | `/plantonista/emergencias/trauma-inicial-adulto` | HC caps. 47–48; PATCH-Trauma, CRYOSTAT-2 (2023) |
| `adulto-triage-rts`, `adulto-mgap`, `iss` | Triage-RTS, MGAP, ISS | `adulto/trauma.ts`, `escores/iss.ts` | `/plantonista/emergencias/triage-rts-trauma`, `mgap-trauma`, `/plantonista/escores/iss` | HC cap. 48; Baker 1974 |
| `adulto-nexus`, `adulto-regra-canadense-coluna`, `canadian-ct-head` | Coluna cervical e TC de crânio | `adulto/trauma.ts`, `escores/canadianCtHead.ts` | `/plantonista/emergencias/nexus-coluna-cervical`, `regra-canadense-coluna-cervical`, `/plantonista/escores/canadian-ct-head` | HC cap. 47; Stiell 2001/2005 |
| `adulto-abc-score` | ABC — transfusão maciça | `adulto/transfusao.ts` | `/plantonista/emergencias/abc-score-transfusao-macica` | HC |
| `ped-pecarn-menor2-icr`, `ped-pecarn-maior2-icr`, `ped-tce-icr`, `ped-pecarn-coluna-cervical`, `ped-pecarn-abdome` | TCE e PECARN (criança) | `pediatria/tceDecisao.ts`, `pediatria/pecarnTrauma.ts` | `/plantonista/pediatria/pecarn-menor-2-anos`, `pecarn-2-anos-ou-mais`, `tce-grave-pediatrico`, `pecarn-coluna-cervical`, `pecarn-abdome` | ICr cap. 16; Leonard, Lancet 2024; Holmes 2013 |
| `adulto-queimadura` / `ped-queimadura` | Queimadura | `adulto/queimadura.ts`, `pediatria/queimadura.ts` | `/plantonista/emergencias/queimadura-adulto`, `/plantonista/pediatria/queimadura-ped` | HC; ICr |

Os escores de trauma do adulto devolvem "não se aplica" para menor de 14 anos.

### 4.7 Pediatria (demais) e anafilaxia

| id | Título | Lógica | Rota | Fonte |
|---|---|---|---|---|
| `ped-anafilaxia-icr` / `adulto-anafilaxia` | Anafilaxia | `pediatria/anafilaxia.ts`, `adulto/anafilaxia.ts` | `/plantonista/pediatria/anafilaxia-pediatrica`, `/plantonista/emergencias/anafilaxia-adulto` | ICr cap. 6; HC cap. 11; WAO 2020; GALEN 2024 |
| `ped-bolus`, `ped-infusoes` | Doses por peso; infusões contínuas | `pediatria/bolus.ts`, `pediatria/infusoes.ts` | `/plantonista/pediatria/bolus`, `/infusoes` | ICr Apêndice |
| `ped-sinais-vitais-icr` | Sinais vitais por idade | `pediatria/sinaisVitais.ts` | `/plantonista/pediatria/sinais-vitais-pediatricos` | ICr caps. 2, 5, 6, 8 |
| `ped-asma-icr`, `ped-pram`, `ped-bronquiolite`, `ped-pneumonia` | Respiratório | `pediatria/asma.ts`, `escores/pram.ts`, `pediatria/bronquiolite.ts`, `pediatria/pneumoniaPed.ts` | `/plantonista/pediatria/asma-pediatrica`, `/pram`, `/bronquiolite-ped`, `/pneumonia-ped` | ICr caps. 8, 29, 30; SBP 2024 |
| `ped-diarreia-desidratacao`, `ped-fluidoterapia-manutencao` | Desidratação; Holliday-Segar | `pediatria/diarreia.ts`, `pediatria/manutencao.ts` | `/plantonista/pediatria/desidratacao-diarreia-ped`, `/fluidoterapia-manutencao-ped` | ICr caps. 32, 77 |
| `ped-febre-sem-sinais`, `ped-infeccao-urinaria` | Febre sem sinais; ITU | `pediatria/febreSemSinaisPed.ts`, `pediatria/ituPed.ts` | `/plantonista/pediatria/febre-sem-sinais-ped`, `/infeccao-urinaria-ped` | ICr caps. 45, 57; AAP 2021/2026 |
| `ped-cad-ehh`, `ped-hipoglicemia`, `ped-crise-hipertensiva`, `ped-dengue`, `ped-intoxicacoes`, `ped-via-aerea` | Metabólico, PA, dengue, tóxico, via aérea | `pediatria/cadPed.ts`, `hipoglicemiaPed.ts`, `criseHipertensivaPed.ts`, `denguePed.ts`, `intoxicacaoPed.ts`, `viaAerea.ts` | `/plantonista/pediatria/cad-ehh-ped`, `/hipoglicemia-ped`, `/crise-hipertensiva-ped`, `/dengue-ped`, `/intoxicacoes-ped`, `/via-aerea` | ICr caps. 52, 51, 26, 44, 18, 4/13; AAP 2017; MS Dengue 2024 |
| `curva-crescimento-oms` | Curva de crescimento (OMS 2006/2007) | `src/clinico/crescimento/curvas.ts` | `src/components/avaliacao/CurvaCrescimento.tsx` em `JanelaAtendimento` e `LeitoAberto`; sem rota | OMS 2006/2007; SISVAN 2011 |

### 4.8 Outros temas de adulto usados em urgência

| id | Tema | Rota |
|---|---|---|
| `dengue-classificacao` | Dengue — classificação e hidratação (MS 2024) | `/plantonista/dengue/classificacao-conduta-hidratacao` |
| `adulto-intoxicacoes-antidotos`, `adulto-animais-peconhentos` | Tóxico e peçonhentos | `/plantonista/emergencias/intoxicacoes-antidotos-adulto`, `animais-peconhentos-adulto` |
| `adulto-infusoes`, `adulto-isr` | Infusões contínuas; IOT em sequência rápida | `/plantonista/calculadoras/infusoes-adulto`, `/plantonista/calculadoras/iot` |
| `hiperpotassemia` (público `ambos`) | Hiperpotassemia | `/plantonista/protocolos/hiperpotassemia` |
| `adulto-hipoglicemia`, `adulto-cad-ehh-avaliacao`, `adulto-cad-ehh-tratamento` | Glicemia | `/plantonista/emergencias/hipoglicemia-adulto`, `cad-ehh-criterios`, `cad-ehh-tratamento` |
| `adulto-itu`, `curb-65`, `crb-65`, `psi-port`, `adulto-pac-antibiotico` | Infecção | `/plantonista/emergencias/itu-adulto`, `/plantonista/escores/curb-65`, `crb-65`, `psi-port`, `/plantonista/emergencias/pac-antibiotico-adulto` |
| `wells-tep`, `genebra-revisado`, `years`, `adulto-pesi`, `spesi`, `adulto-perc`, `adulto-hestia`, `wells-tvp` | TEP e TVP | `/plantonista/escores/wells-tep`, `genebra-revisado`, `years`, `pesi`, `spesi`, `wells-tvp`; `/plantonista/emergencias/perc`, `hestia` |

### 4.9 Como o app decide pediatria

`src/domain/idade.ts`: `IDADE_ADULTO_ANOS = 14`; `ehPediatrico(nascimento, hoje)` = `anos < 14` (isto é, até 13a 11m 29d); `faixaEtaria()` devolve `'desconhecida'` sem data de nascimento. A triagem (`Classificar.tsx` l. 87, `EscutaInicial.tsx` l. 71) escolhe o grupo de fluxogramas por isso; a Central bloqueia ferramenta por público (`src/content/publicoFerramentas.ts`, `src/lib/pacienteCentral.ts`). No banco, [M]`20270209000001_corte_14_anos.sql`.

## 5. Ambiente de teste da homologação

### 5.1 A rede de teste F5 (`scripts/e2e/40_rede_fase5.sql`)

| Objeto | Id | Detalhe |
|---|---|---|
| Organização "Rede E2E Fase 5" | `f5000000-…-000000000001` | própria, isolada das rodadas anteriores |
| UBS Fase 5 | `f5100000-…-000000000001` | `tipo='ubs'`, CNES `9995011`; setor Consultório 1 (`f5300000-…-000000000001`) |
| UPA Fase 5 24h | `f5100000-…-000000000002` | `tipo='upa'`, CNES `9995028`; setores Pronto Socorro (`…-011`, 4 leitos PS), Observação Adulto (`…-012`, 4 boxes OA), Internação (`…-013`, 4 leitos INT) |
| Hospital Fase 5 | `f5100000-…-000000000003` | `tipo='hospital'`, CNES `9995036`; Clínica Médica (`…-021`, 4 leitos CM, `regulacao_tipo_leito='clinico'`) |
| Central de Regulação Fase 5 | `f5100000-…-000000000009` | sem CNES; setor Regulação (`…-091`); registrada em `centrais_regulacao` |
| Escala | — | ontem a depois de amanhã, nos três turnos, uma pessoa por setor |
| Protocolo de classificação | — | o primeiro de `protocolos_classificacao` na UPA e no hospital |

Contas (uma por papel; senha definida pelo RT, fora do repositório — o script recebe só o hash por `HASH_E2E`):

| Conta | Papel | Unidade | Chave em `e2e.conta` |
|---|---|---|---|
| `recepcao.ubs.f5@teste.local` | recepcao | UBS | `f5_rec_ubs` |
| `enfermeiro.ubs.f5@teste.local` | enfermeiro | UBS | `f5_enf_ubs` |
| `tecnico.ubs.f5@teste.local` | tecnico_enfermagem | UBS | `f5_tec_ubs` |
| `medico.ubs.f5@teste.local` (CRM 950004) | plantonista | UBS | `f5_med_ubs` |
| `gestor.ubs.f5@teste.local` | gestor | UBS | `f5_ges_ubs` |
| `recepcao.upa.f5@teste.local` | recepcao | UPA | `f5_rec_upa` |
| `enfermeiro.upa.f5@teste.local` | enfermeiro | UPA | `f5_enf_upa` |
| `medico.upa.f5@teste.local` (CRM 950008) | plantonista | UPA (PS) | `f5_med_upa` |
| `medico.internacao.f5@teste.local` (CRM 950015) | plantonista | UPA (Internação) | `f5_med_int` |
| `gestor.upa.f5@teste.local` | gestor | UPA e Central | `f5_ges_upa` |
| `faturamento.f5@teste.local` | faturamento | UPA | `f5_fat` |
| `farmaceutico.f5@teste.local` | farmaceutico | UPA | `f5_farm` |
| `nir.f5@teste.local` | nir | UPA | `f5_nir` |
| `regulador.f5@teste.local` (CRM 950012) | regulador | Central | `f5_regulador` |
| `medico.hospital.f5@teste.local` (CRM 950011) | plantonista | Hospital | `f5_med_hosp` |

O que falta na rede F5 para alguns cenários: não há conta de **telemedicina**, de **técnico de enfermagem na UPA**, de **admin** da organização F5, nem de **secretaria/regulação regional/faturamento da rede**; não há setor de observação pediátrica nem leito de isolamento; as unidades não têm coordenadas (o raio do check-in não é conferido). As rodadas anteriores (`01_rede_e2e.sql`, `30_rede_coorte2.sql`) tinham maternidade, UTI, infantil, alto risco e CIATox, mas a Rede E2E foi apagada da homologação em 03/11/2026 (BACKLOG, l. 1370).

### 5.2 Scripts de `scripts/e2e/`

| Script | Papel no catálogo |
|---|---|
| `04_framework_e2e.sql` + `42_framework_fase5.sql` | esquema `e2e`: `e2e.passo(codigo, paciente, conta, tela, descricao, sql, esperado, chave)` roda como o papel com RLS; `e2e.resultados` (`ok, falha, lacuna, ajuste`); `e2e.lacuna`, `e2e.ajuste`, `e2e.u(chave)`, `e2e.confere` |
| `40_rede_fase5.sql` | cria a rede F5 (idempotente) |
| `41_checkin_fase5.sql` | check-in dos plantões em curso das contas F5; rodar no começo de cada sessão (a porta fecha 30 min depois do início sem check-in) |
| `43_fase5_ubs.sql`, `44_fase5_ubs_complemento.sql` | coorte F5 de 9 pacientes: hiperdia; escuta vermelha → UPA → alta → retorno; envio que não chega em 12 h; envio cancelado; gestante e criança (consultas); evasão na UPA; regulação de consulta pela conduta; internação com alta e alta desfeita; permissão de outra rede |
| `45_fase5_faturamento.sql` | conta, procedimentos, materiais, medicamentos, AIH/APAC, pré-auditoria e glosa (passos `F5.B.*`) |
| `10`–`16`, `17`–`23`, `32`–`34` | roteiros da UPA das rodadas 1 e 2 (porta, atendimento, desfecho, internação, farmácia, regulação, transferência, óbito, gestor, carga, correções); reaproveitáveis como modelo de passos, mas apontam para a rede antiga |
| `02_catalogo_e2e.sql`, `31_coorte2_catalogo.sql` | catálogo de medicamentos de teste (nome e apresentação, sem dose) |
| `99_limpar_rede_e2e.sql` | apaga a Rede E2E (não a F5) |
| `homolog/preparar.mjs` | tira `\set` e troca `crypt(:'senha', …)` pelo hash `HASH_E2E` para colar no SQL Editor; na homologação o plugin não entende psql |

Resultados anteriores: `produto/docs/teste-e2e/RELATORIO_E2E_FASE5_2026-11-03.md` (UBS 75 ok, faturamento 15 ok, integrações 10/16), `RELATORIO_E2E_2026-10-11.md` e `RELATORIO_E2E_R2_2026-10-12.md` (UPA: 532 ok, 0 falhas após os roteiros atualizados em 04/11/2026). Telas percorridas em 04/11/2026 pelo link da Vercel (achados F5-T1 a T6, todos resolvidos).

### 5.3 Seeds e apoio

| Arquivo | Uso |
|---|---|
| `supabase/seed.sql` | só banco local: contas `*@teste.local` (senha no arquivo), Unidade Teste, pacientes fictícios. Não roda na homologação |
| `supabase/homolog/seed-homolog.sql` | estrutura fictícia da homologação, sem usuários (trava: recusa banco com atendimento) |
| `supabase/homolog/vincular-usuario-teste.sql` | dá todos os papéis na "UPA Homologação" (`31000000-…-0001`) a um e-mail e escala 7 dias (`npm run homolog:copiar -- 8 <email>`) |
| `supabase/homolog/demo-preparar.sql`, `demo-medicamentos.sql` | escala de demo e catálogo de medicamentos |
| `supabase/homolog/faturamento-teste.sql` | códigos SIGTAP das fontes automáticas da UPA Homologação, CBO 225125 e CNS provisório na conta de teste |
| `supabase/homolog/partes/cid10_parte1..5.sql`, `sigtap_cid_parte1..4.sql`, `data/terminologia/sigtap/` | CID-10, SIGTAP (202609) e compatibilidade; já carregados na homologação |
| `supabase/dados/protocolo_aparecida_2025.sql` | protocolo de classificação da unidade |
| `supabase/tests/*.sql` (`npm run test:banco`, via `db query --linked` em transação desfeita) | testes de banco por tarefa: `5a_*` (UBS), `5b_materiais`, `fase5_*` (conta, glosas, pré-auditoria, dispensação), `fase4_*` (regulação, NIR, SLA, vagas), `fase2_*`, `fase3_*`, `escala_*`, `checkin_*`, `fase1_evasao`, `portao2_prescricao_idade_peso`, `f5_aviso_turno_ubs`, `depois_frequencia_ps` |
| `scripts/ambiente/usuario-homolog.mjs`, `npm run homolog:usuario` | gera o hash da senha fora do SQL |

Como executar depois (K2 do portão): banco pelo SQL Editor da homologação (`kswurfyx…`), passo a passo como o papel; telas pelo link de compartilhamento da Vercel (`homolog.chefecoruja.com.br`) no Chrome do RT — o navegador embutido reprova no desafio da Cloudflare. O RT guarda o link, a senha e o segundo fator (`docs/qa-homolog-como-usuario`, memória).

## 6. Regras que todo cenário respeita

| Regra | Onde está | O que o cenário faz |
|---|---|---|
| Pediatria até 13a 11m 29d | `src/domain/idade.ts` (`ehPediatrico` = `anos < 14`); [M]`20270209000001_corte_14_anos.sql`; `publicoFerramentas.ts` | Criança com data de nascimento; fluxograma pediátrico na triagem; ferramentas `ped-*`; escores de trauma de adulto "não se aplica" abaixo de 14 anos |
| A cor é da enfermagem | `/triagem` só para `enfermeiro` (`App.tsx` l. 334); `classificar_risco` grava a cor escolhida; o sistema não sugere cor (PRODUCT.md, princípio 5) | O cenário diz os sinais e o fluxograma; a cor aparece como decisão do enfermeiro, nunca como "o sistema classificou". Reclassificação com motivo ≥ 10; depois de `iniciar_atendimento`, só o médico |
| O autor é o login | RPCs `SECURITY DEFINER` usam `private.meu_perfil_id()`/`auth.uid()`; notificador do SINAN = logado; `administracoes`, `documentos_clinicos` guardam o perfil | Cada passo roda com a conta do papel; nada é "registrado em nome de" (exceto o faturamento lançar procedimento em nome de quem fez, que é regra própria) |
| 2FA | `public.portao_requisicao` (pre-request) recusa toda RPC e Storage sem segundo fator válido ([M]`20261023000001_segundo_fator_servidor.sql`); TOTP ou código por e-mail; dispositivo confiável 30 dias; validade 24 h; 10 códigos de recuperação; `zerar_segundo_fator` pelo gestor/super admin com motivo | Na tela, cada conta passa pelo 2FA no primeiro acesso do dia; no banco, os scripts rodam com a sessão simulada. Erro `SEGUNDO_FATOR*` reabre o portão (`App.tsx` l. 116) |
| Janela de escala | `private.plantoes_agora()`: `inicio ≤ now < inicio + duracao_min` e (dentro da tolerância ou com check-in); tolerância `configuracoes_unidade.checkin_tolerancia_min` 0–120, padrão 30; sem tolerância antes do início; 20 min depois do fim só com check-in; depois, liberação do gestor 5–120 min até 12 h ([M]`20261014000001`, [M]`20261022000018`) | O cenário começa com `41_checkin_fase5.sql` ou com o check-in na tela; um passo "fora da escala" espera recusa; gestor, admin e faturamento não dependem |
| Check-in no raio | `registrar_checkin(p_unidade, p_lat, p_lng, p_observacao, p_justificativa)`; `unidades.raio_metros` padrão 500 m; erros `CHECKIN_FORA_DO_RAIO`, `CHECKIN_SEM_LOCALIZACAO`, `CHECKIN_JUSTIFICATIVA_CURTA`; na 2ª recusa, justificativa ≥ 10 e o check-in passa marcado "fora do raio" para o gestor; telemedicina não passa pelo raio; unidade sem coordenadas não confere ([M]`20260926000008_fase1_checkin_raio.sql`) | Na rede F5 as unidades não têm coordenadas: o raio não barra. Um cenário de raio precisa de unidade com latitude/longitude |
| Virada de data | turno como janela (início + duração), não rótulo com data ([M]`20260926000003`); grade 12 h 07–19/19–07, grade 6 h 07–13/13–19/19–01/01–07; check-in 00h–06h59 usa `private.data_do_turno` (dia anterior); avisos na data de Brasília ([M]`20270209000006`); VD1–VD15 em `docs/virada-de-data/` | Cenário noturno atravessa a meia-noite sem perder o acesso; o desfecho e a conta ficam na data de Brasília; a competência do BPA é o mês do fato |
| Modo sem conexão | `src/lib/offline/{fila,regras,relogio,sincronizar}.ts`: fila IndexedDB cifrada (AES-GCM, chave do servidor por `chave_fila`), tipos `observacao` e `documento`, limite de 2 h sem contato, `sincronizar_registros` idempotente; registro com mais de 24 h vai à `RevisaoSemConexao.tsx` do gestor (`decidir_revisao_sincronizacao`); recarga sem conexão guarda o que a enfermagem leu (`ligarConsultasSemConexao`); contingência em papel após 15 min (`Contingencia.tsx`, `registrar_contingencia`, `marcar_reentrada_contingencia`); rascunho cifrado da triagem vale 2 h | Um cenário sem conexão cobre: sinais vitais e evolução na fila, sincronização, revisão tardia pelo gestor e reentrada da contingência. Só observação e documento entram na fila: prescrição, desfecho e alta exigem conexão |
| Dose só de fonte citada | `Ficha.fontes[]`; `temReferenciaPediatrica`; PRODUCT.md | O cenário escreve "ver `<id da ficha>`" e nunca a dose |
| Peso e idade para prescrever | [M]`20261121000001_prescricao_idade_peso.sql` (aferido, estimado ou referido; vale o atendimento inteiro) | Todo cenário com prescrição registra o peso antes (os roteiros `11` e `17` caíram por isso) |
| Sinais vitais impressos crus | `src/components/documento/*` | A ficha impressa mostra o valor como foi aferido, sem marca de crítico |
| Nada em produção | CLAUDE.md; `scripts/e2e/README.md` | Só homologação `kswurfyx…`; conferir a URL antes de colar |

## Lacunas — o que o sistema NÃO faz (um cenário não pode exigir)

Clínico e obstétrico
- Ficha própria de pré-eclâmpsia, eclâmpsia, HELLP ou sulfato de magnésio: só o bloco dentro de `adulto-emergencia-hipertensiva`.
- Hemorragia pós-parto, ocitocina, gravidez ectópica, descolamento, parto na UPA, escore obstétrico (MEOWS) e fluxograma "Gestante" na triagem.
- Pré-natal e puericultura com conduta, vacina, saúde bucal ou visita do ACS: são só painéis de boas práticas (C3 e C2); ACS não é papel do app.
- Ficha própria de qSOFA, SOFA clássico ou RTS completo; curva de crescimento e escalas de dor não têm rota na Central.
- Vídeo na teleinterconsulta, teleconsulta eletiva agendada e assinatura ICP-Brasil.

Rede e regulação
- Status `rascunho`, `agendada` e `excluida` da regulação não são gravados por nenhuma RPC; `cancelamento_origem = 'prazo'` existe sem cancelamento automático: o SLA só alerta.
- A chegada regulada (`regulacao_marcar_chegada`) não cria a internação no destino; o destino abre a ficha e interna.
- Mapa de vagas sem agendamento de consulta ou exame: o serviço só é ofertado e confirmado.
- Envio ao SINAN, à RNDS do SINAN e mapeamento CID → agravo conferido pela vigilância.
- "Chegou" na recepção da UPA sem ficha aberta não liga o envio depois.
- Linha de BPA, SISAB ou e-SUS APS para a UBS.

Farmácia
- Lote, validade, preço e custo de medicamento; base comercial de interações; dupla checagem com tela (só RPC legada).
- Estoque de materiais e OPME.

Custos e faturamento
- Diária de leito, tempo de permanência com valor, centro de custo, rateio, custeio por absorção, honorário por procedimento.
- Valor de medicamento, material e exame na conta; CMED não entra na conta.
- Valor gravado na AIH e na APAC (só calculado na conta e na glosa); exportação da AIH (SISAIH01); importação do retorno SIA/SIH (glosa é à mão); TISS/TUSS e tabela de convênio ou particular (o `pagador` existe, o valor é sempre SIGTAP).
- Financiamento, rubrica e teto do SIGTAP (não carregados); webhook ou push de conta, glosa ou ERP (o ERP busca pela API).

Acesso e escala
- Prazo para o gestor decidir o pedido de prontuário e expiração do pedido pendente.
- Janela de check-in antes do início do plantão; raio na rede F5 (unidades sem coordenadas).
- Conta de telemedicina, técnico da UPA, admin e papéis de rede na rede F5; setor pediátrico, isolamento, maternidade e UTI na rede F5.
- Modo sem conexão para prescrição, desfecho, alta e regulação (só observação e documento entram na fila); divergência documentada de 15 vs 20 min depois do fim do plantão (`usePlantao.ts` × `regras.ts`).
- `conduta_aps` não grava "encaminhamento à UPA" como conduta própria: o envio é `encaminhar_upa`, e a regulação é `regulacao_solicitar`.
