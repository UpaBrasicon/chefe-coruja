# LG4: inventário das operações de tratamento

<!-- Gerado por scripts/inventario-lgpd.mjs a partir de docs/regulatorio/inventario/operacoes.json. Não edite à mão: edite o JSON e rode `node scripts/inventario-lgpd.mjs`. -->

Versão 2026-11-17. Rascunho técnico do registro das operações de tratamento (LGPD, art. 37). Não é parecer jurídico. Prazos e bases legais são propostas para o advogado confirmar.

28 operações cobrem 305 tabelas.

## Papéis

- **Operador:** A Chefe Coruja trata em nome do cliente (prefeitura, hospital ou unidade), que é o controlador. Vale o anexo de operador (LG1).
- **Controlador:** A Chefe Coruja decide a finalidade e é o controlador. Vale a política de privacidade da plataforma (LG2).

## Medidas de segurança comuns a todas as operações

- acesso por papel na unidade (RLS em todas as tabelas, função papel_na_unidade)
- login com segundo fator para quem vê dado clínico
- cifra em trânsito (TLS) e em repouso no banco
- registro de quem fez o quê (autor = login)
- migrations revisadas em homologação antes da produção

## Resumo

| Operação | Papel | Dado sensível | Prazo de guarda | Tabelas |
|---|---|---|---|---|
| Cadastro e identificação do paciente | operador | sim | 20 anos a partir do último registro | 9 |
| Recepção, classificação de risco e chamada | operador | sim | 20 anos a partir do último registro | 12 |
| Atendimento médico, evolução e alta | operador | sim | 20 anos a partir do último registro | 22 |
| Observação e protocolos de cuidado | operador | sim | 20 anos a partir do último registro | 4 |
| Intercorrências, eventos adversos, notificação e óbito | operador | sim | 20 anos a partir do último registro | 8 |
| Prescrição, checagem e administração de medicamentos | operador | sim | 20 anos a partir do último registro | 16 |
| Cuidado de enfermagem | operador | sim | 20 anos a partir do último registro | 7 |
| Internação, leitos e transferência | operador | sim | 20 anos a partir do último registro | 11 |
| Regulação de vagas | operador | sim | 20 anos a partir do último registro | 13 |
| Rede entre unidades e acesso ao prontuário de outra unidade | operador | sim | 20 anos a partir do último registro | 7 |
| Atenção primária: agenda e programas da UBS | operador | sim | 20 anos a partir do último registro | 8 |
| Pedido e resultado de exames | operador | sim | 20 anos a partir do último registro | 7 |
| Documentos, termos, anexos e destinação do prontuário | operador | sim | 20 anos a partir do último registro | 9 |
| Farmácia e estoque | operador | sim | 20 anos para o que compõe o prontuário; 5 anos para estoque | 10 |
| Faturamento SUS e contas | operador | sim | 5 anos | 20 |
| Escala, presença e remuneração dos profissionais | operador | não | 5 anos | 14 |
| Conta do profissional, login e permissões | operador | não | enquanto durar o vínculo; depois, 5 anos | 21 |
| Preferências e avisos ao profissional | operador | não | enquanto durar a conta | 5 |
| Comunicação interna da equipe | operador | não | a definir com o advogado | 9 |
| Auditoria e registro de acesso ao prontuário | operador | sim | 20 anos | 3 |
| Registro de acesso à aplicação (Marco Civil) | controlador | não | 6 meses | 2 |
| Erros do aplicativo e vigilância técnica | controlador | não | a definir com o advogado (proposta: 1 ano) | 5 |
| Apoio por IA: busca clínica e assistentes | operador | sim | 30 dias para o texto; registro técnico sem texto por 20 anos | 12 |
| RNDS, API e integrações com outros sistemas | operador | sim | 20 anos para o que compõe o prontuário; registro de acesso da API por 20 anos | 12 |
| Cliente, unidades e implantação | controlador | não | duração do contrato; depois, 5 anos | 8 |
| Site comercial e pedido de demonstração | controlador | não | 2 anos | 1 |
| Catálogos clínicos, terminologias e regras (sem dado de paciente) | controlador | não | enquanto estiver em uso; versões antigas das fichas ficam como histórico | 46 |
| Testes automáticos da homologação | controlador | não | enquanto servir aos testes | 4 |

## Operações

### Cadastro e identificação do paciente

`cadastro-paciente` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Identificar o paciente com segurança em todo o atendimento e evitar cadastro duplicado.

**Base legal (LGPD)**
- art. 11, II, f (tutela da saúde, por profissional de saúde)
- art. 11, II, a (obrigação legal: prontuário, Lei 13.787/2018)

**Titulares**
- pacientes
- responsáveis legais de crianças

**Dados**
- nome, nome social, data de nascimento, sexo
- CPF e CNS
- endereço e telefone
- alergias e isolamento

**Quem acessa**
- recepção
- enfermagem
- médico
- gestor da unidade

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- unificação de cadastro só com decisão registrada

**Tabelas (9)**

`public.pacientes`, `public.pacientes_identidade_provisoria`, `public.pedidos_unificacao`, `public.revisoes_cadastro`, `public.alergias_paciente`, `public.alergias_negacoes`, `public.isolamentos_paciente`, `public.impressoes_pulseira`, `private.prontuario_sequencia`

### Recepção, classificação de risco e chamada

`recepcao-classificacao` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Registrar a chegada, classificar o risco e chamar o paciente na ordem certa.

**Base legal (LGPD)**
- art. 11, II, f

**Titulares**
- pacientes

**Dados**
- episódio de atendimento
- queixa, sinais vitais e cor da classificação
- nome no painel de chamada

**Quem acessa**
- recepção
- enfermagem
- médico
- painel da sala de espera (só nome e sala)

**Onde fica**
- Supabase (São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- o painel entra por token próprio, sem login, e mostra só o necessário para a chamada

**Tabelas (12)**

`public.episodios`, `public.episodio_eventos`, `public.classificacoes_risco`, `public.acuidade_afericoes`, `public.chamadas`, `public.salas`, `public.salas_do_plantao`, `public.contingencias`, `public.reentradas_contingencia`, `public.painel_config`, `public.painel_propagandas`, `private.paineis`

### Atendimento médico, evolução e alta

`atendimento` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Registrar a consulta, o raciocínio clínico, as reavaliações e a alta.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, a (prontuário)

**Titulares**
- pacientes
- profissionais (autoria)

**Dados**
- anamnese, exame físico, hipóteses e CID
- escalas e escores
- pareceres e teleinterconsultas
- pendências e resumo de alta
- teleinterconsulta: termo de consentimento, forma da concordância, nome da testemunha ou do representante, endereço do paciente e endereço profissional do médico (LG8)

**Quem acessa**
- médico
- enfermagem
- equipe da unidade com papel clínico

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- rascunho guardado com chave por sessão
- registro fechado não se edita: correção vira novo registro

**Tabelas (22)**

`public.atendimento_registros`, `public.atendimento_rascunhos`, `private.rascunho_chave`, `public.atendimento_reavaliacoes`, `public.evolucoes_estruturadas`, `public.resumos_clinicos`, `public.diagnosticos_episodio`, `public.reavaliacoes_quadro`, `public.avisos_sepse_atendimento`, `public.pareceres_medicos`, `public.encaminhamentos_internos`, `public.teleinterconsultas`, `public.cuidados_plantonistas`, `public.avaliacoes_escala`, `public.avaliacoes_pes`, `public.pendencias`, `public.sincronizacao_revisao`, `public.admissao_fichas`, `public.checklist_admissao`, `public.alta_paciente`, `public.pacotes_alta`, `public.pacotes_alta_acessos`

### Observação e protocolos de cuidado

`observacao` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Acompanhar o paciente em observação e as etapas dos protocolos.

**Base legal (LGPD)**
- art. 11, II, f

**Titulares**
- pacientes
- profissionais (autoria)

**Dados**
- entrada e saída da observação
- etapas cumpridas e horários

**Quem acessa**
- médico
- enfermagem

**Onde fica**
- Supabase (São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (4)**

`public.observacao`, `public.observacao_protocolos`, `public.observacao_protocolo_etapas`, `public.observacao_eventos`

### Intercorrências, eventos adversos, notificação e óbito

`seguranca-paciente` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Registrar o que deu errado no cuidado, as contenções, as notificações compulsórias e o óbito.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, a (notificação compulsória e declaração de óbito)
- art. 11, II, e (proteção da vida)

**Titulares**
- pacientes
- familiares avisados do óbito
- profissionais (autoria)

**Dados**
- descrição do evento e do grau de dano
- agravo notificado
- contenção e revisões
- óbito e comunicação à família (nome e parentesco de quem recebeu)

**Quem acessa**
- médico
- enfermagem
- gestor da unidade
- núcleo de segurança do paciente

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- anulação de declaração de óbito fica registrada, não apaga

**Tabelas (8)**

`public.intercorrencias`, `public.eventos_adversos`, `public.agravos_notificacao`, `public.contencoes`, `public.contencao_revisoes`, `public.obitos`, `public.obito_do_anuladas`, `public.obito_comunicacoes`

### Prescrição, checagem e administração de medicamentos

`prescricao` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Prescrever, conferir e registrar cada dose dada ao paciente.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, a (receita de controle especial, Portaria SVS/MS 344/1998)

**Titulares**
- pacientes
- profissionais (autoria e assinatura)

**Dados**
- medicamentos, doses e horários
- administração, atraso e omissão de dose
- alertas de interação
- assinatura digital (CPF do certificado do médico)
- receitas retidas

**Quem acessa**
- médico
- enfermagem
- farmácia

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- dupla checagem para alta vigilância
- link público da receita com prazo e sem dado além da receita

**Tabelas (16)**

`public.prescricoes`, `public.prescricao_itens`, `public.sugestoes_prescricao`, `public.preferencias_prescricao`, `public.validacoes_prescricao`, `public.duplas_checagens`, `public.aprazamentos`, `public.administracoes`, `public.doses_atrasadas`, `public.omissoes_dose`, `public.diluicao`, `public.diluicao_encerramentos`, `public.alertas_interacao`, `public.assinaturas`, `public.receitas_retidas`, `public.links_publicos_receita`

### Cuidado de enfermagem

`enfermagem` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Registrar a sistematização da assistência de enfermagem, dispositivos, curativos, balanço e passagem de turno.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, a (Resolução COFEN 736/2024)

**Titulares**
- pacientes
- profissionais (autoria)

**Dados**
- diagnósticos e intervenções de enfermagem
- dispositivos e curativos
- balanço hídrico
- escalas Fugulin e Dini

**Quem acessa**
- enfermagem
- médico

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (7)**

`public.sae_registros`, `public.passagens_enfermagem`, `public.dispositivos_enfermagem`, `public.balanco_hidrico`, `public.curativos_enfermagem`, `public.classificacoes_fugulin`, `public.classificacoes_dini`

### Internação, leitos e transferência

`internacao-leitos` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Controlar quem ocupa cada leito, as transferências e a passagem de plantão.

**Base legal (LGPD)**
- art. 11, II, f

**Titulares**
- pacientes
- profissionais (autoria)

**Dados**
- internação, leito e setor
- movimentos de entrada, transferência e saída
- censo diário
- passagem de plantão

**Quem acessa**
- médico
- enfermagem
- núcleo interno de regulação
- gestor da unidade

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (11)**

`public.internacoes`, `public.leitos`, `public.setores`, `public.reservas_leito`, `public.eventos_leito`, `public.censo_ocupacao`, `public.eventos_adt`, `public.transferencias_paciente`, `public.transferencia_checklist`, `public.nir_cobrancas`, `public.passagens_plantao`

### Regulação de vagas

`regulacao` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Pedir e acompanhar vaga em outro serviço, com os documentos e prazos da central.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, b (execução de política pública pelo SUS)

**Titulares**
- pacientes
- profissionais (autoria)

**Dados**
- pedido de vaga, quadro clínico e anexos
- respostas dos destinos e da central
- tempos de cada etapa

**Quem acessa**
- médico
- núcleo interno de regulação
- central de regulação liberada pela unidade

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- anexo só abre para quem a unidade liberou

**Tabelas (13)**

`public.regulacao_solicitacoes`, `public.regulacao_evolucoes`, `public.regulacao_eventos`, `public.regulacao_anexos`, `private.regulacao_anexo_liberacao`, `public.regulacao_destino_respostas`, `public.regulacao_status_tempos`, `public.regulacao_prazos`, `public.regulacao_prazos_historico`, `public.regulacao_servicos`, `public.regulacao_servicos_historico`, `public.regulacao_criterios`, `public.centrais_regulacao`

### Rede entre unidades e acesso ao prontuário de outra unidade

`rede` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Encaminhar o paciente entre unidades da mesma rede e liberar a leitura do prontuário quando há motivo clínico.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, b

**Titulares**
- pacientes
- profissionais (quem pediu e quem decidiu)

**Dados**
- encaminhamento e contrarreferência
- pedido de acesso, motivo e decisão

**Quem acessa**
- médico
- gestor da unidade
- unidades liberadas no contrato da rede

**Onde fica**
- Supabase (São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- acesso de outra unidade só com pedido, motivo e prazo de validade

**Tabelas (7)**

`public.rede_modulo`, `public.rede_unidades_liberadas`, `public.rede_liberacoes_historico`, `public.contratos_rede`, `public.encaminhamentos_upa`, `public.contrarreferencias`, `public.pedidos_acesso_prontuario`

### Atenção primária: agenda e programas da UBS

`ubs` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Agendar consultas e acompanhar pré-natal, puericultura e outros programas.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, b

**Titulares**
- pacientes
- gestantes
- crianças e responsáveis

**Dados**
- agendamentos
- gestação e consultas do pré-natal
- entrada e saída de programas

**Quem acessa**
- recepção da UBS
- enfermagem
- médico
- agente comunitário (quando houver papel)

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (8)**

`public.agendamentos`, `public.agenda_configuracoes`, `public.agenda_fechamentos`, `public.ubs_funcionamento`, `public.pre_natal_gestacoes`, `public.pre_natal_parcerias`, `public.puericultura_saidas`, `public.programa_participantes`

### Pedido e resultado de exames

`exames` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Pedir exames, receber o resultado do laboratório ou da imagem e registrar quem tomou ciência.

**Base legal (LGPD)**
- art. 11, II, f

**Titulares**
- pacientes
- profissionais (autoria e ciência)

**Dados**
- exames pedidos
- resultados e laudos
- ciência do médico

**Quem acessa**
- médico
- enfermagem
- laboratório integrado

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- laudo só aparece depois de liberado
- imagem externa só de domínio cadastrado pela unidade

**Tabelas (7)**

`public.exames_pedidos`, `public.exame_resultados`, `public.exame_resultado_itens`, `public.exame_cientes`, `private.exame_laudo_liberacao`, `public.exames_unidade`, `public.imagem_dominios`

### Documentos, termos, anexos e destinação do prontuário

`documentos` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Emitir atestados, termos e outros documentos, guardar anexos e registrar a destinação do prontuário vencido.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, a (Lei 13.787/2018)

**Titulares**
- pacientes
- profissionais (autoria)

**Dados**
- documentos emitidos e cancelados
- arquivos anexados
- impressões do prontuário
- pedido e decisão de destinação
- assinatura ICP-Brasil do documento: certificado (serial, emissor e só o final do CPF), sessão e hash do PDF (LG7)

**Quem acessa**
- médico
- enfermagem
- recepção (impressão)
- gestor da unidade (destinação)

**Onde fica**
- Supabase (São Paulo, banco e arquivos)
- cofre da guarda (AWS S3, São Paulo)
- servidor Hostinger (Brasil): o assinador gera o PDF e guarda, cifrado, o token da sessão com o provedor

**Prazo.** 20 anos a partir do último registro (Lei 13.787/2018). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- destinação só com aprovação registrada; a identificação fica como hash
- o token do provedor de certificado nunca vai ao navegador nem ao banco

**Tabelas (9)**

`public.documentos_clinicos`, `public.anexos_prontuario`, `public.impressoes_prontuario`, `private.documento_sequencia`, `public.termos_cancelamentos`, `public.destinacoes_prontuario`, `public.assinaturas_documento`, `private.sessoes_assinatura`, `public.pdfs_assinados`

### Farmácia e estoque

`farmacia` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Controlar estoque, dispensação e falta de medicamentos e materiais.

**Base legal (LGPD)**
- art. 11, II, f
- art. 11, II, a (controle especial, Portaria SVS/MS 344/1998)

**Titulares**
- pacientes (dispensação)
- profissionais (autoria)

**Dados**
- dispensações e devoluções
- movimentos de estoque
- faltas e respostas
- arquivos da farmácia

**Quem acessa**
- farmácia
- enfermagem
- gestor da unidade

**Onde fica**
- Supabase (São Paulo, banco e arquivos)

**Prazo.** 20 anos para o que compõe o prontuário; 5 anos para estoque (Lei 13.787/2018; prazo fiscal). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (10)**

`public.estoque_medicamento`, `public.movimentos_estoque`, `public.dispensacoes`, `public.dispensacao_devolucoes`, `public.faltas_medicamento`, `public.retornos_falta`, `public.farmacia_limites_padrao`, `public.arquivos_farmacia`, `public.medicamento_unidade_historico`, `public.materiais_unidade`

### Faturamento SUS e contas

`faturamento` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Gerar AIH, APAC, BPA e contas a partir do atendimento e enviar ao ERP do cliente.

**Base legal (LGPD)**
- art. 11, II, a (faturamento SUS)
- art. 11, II, b

**Titulares**
- pacientes
- profissionais (CBO e autoria)

**Dados**
- procedimentos realizados e CID
- AIH, APAC e BPA
- contas, glosas e lançamentos

**Quem acessa**
- faturamento
- gestor da unidade

**Onde fica**
- Supabase (São Paulo)
- ERP do cliente (por integração)

**Prazo.** 5 anos (prazo fiscal (V3)). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (20)**

`public.contas`, `public.conta_eventos`, `public.conta_glosas`, `public.conta_glosa_eventos`, `public.conta_medicamentos_fora`, `public.conta_lancamentos`, `public.conta_materiais`, `public.conta_versoes_erp`, `private.conta_sequencia`, `public.aihs`, `public.aih_eventos`, `public.aih_criticas_unidade`, `public.apacs`, `public.apac_eventos`, `public.apac_execucoes`, `public.apac_fechamentos`, `public.bpa_procedimentos_unidade`, `public.bpa_fechamentos`, `public.bpa_config_unidade`, `public.procedimentos_realizados`

### Escala, presença e remuneração dos profissionais

`escala` · papel da Chefe Coruja: **operador** · dado sensível: **não**

**Finalidade.** Montar a escala, registrar presença e trocas e calcular a remuneração do plantão.

**Base legal (LGPD)**
- art. 7º, V (execução de contrato)
- art. 7º, II (obrigação trabalhista e fiscal)

**Titulares**
- profissionais

**Dados**
- plantões, vagas, candidaturas e trocas
- presença e horários
- valores de remuneração

**Quem acessa**
- o próprio profissional
- gestor da escala
- gestor da unidade

**Onde fica**
- Supabase (São Paulo)
- ERP do cliente (por integração)

**Prazo.** 5 anos (prazo trabalhista (V3)). Descarte: rotina com registro, depois do prazo (V3).

**Tabelas (14)**

`public.escala_plantao`, `public.escala_fixa`, `public.escala_vagas`, `public.escala_publicacoes`, `public.historico_escala`, `public.candidaturas_escala`, `public.solicitacoes_escala`, `public.trocas_plantao`, `public.presenca_plantonista`, `public.remuneracoes_plantao`, `public.plantao_versoes_erp`, `public.chronos_alertas_escala`, `public.liberacao_pos_plantao`, `public.disponibilidade_telemedicina`

### Conta do profissional, login e permissões

`conta-acesso` · papel da Chefe Coruja: **operador** · dado sensível: **não**

**Finalidade.** Identificar quem entra, conferir o segundo fator e dar a cada um só o acesso do seu papel.

**Base legal (LGPD)**
- art. 7º, V (execução de contrato)
- art. 11, II, g (segurança do titular em identificação e autenticação)

**Titulares**
- profissionais
- responsáveis técnicos

**Dados**
- nome, e-mail, conselho e registro
- papel em cada unidade
- eventos do segundo fator e dispositivos confiáveis
- convites e aceite dos termos
- endereço profissional do médico (LG8)

**Quem acessa**
- o próprio profissional
- gestor da unidade
- suporte da Chefe Coruja (só para atender chamado)

**Onde fica**
- Supabase (São Paulo)
- Resend (EUA, e-mail do código de acesso)

**Prazo.** enquanto durar o vínculo; depois, 5 anos (proposta técnica, a confirmar com o advogado). Descarte: a definir com o advogado.

**Medidas próprias**
- segredos guardados só como hash
- tentativas limitadas por tempo

**Tabelas (21)**

`public.perfis`, `public.vinculos`, `public.acessos_plantonista`, `public.super_admins`, `public.convites`, `private.tentativas_convite_conta`, `private.tentativas_primeiro_acesso`, `private.primeiro_acesso_pendente`, `private.segundo_fator_eventos`, `private.segundo_fator_recuperacao`, `private.segundo_fator_recuperacao_falhas`, `private.segundo_fator_tentativas`, `private.segundo_fator_email_codigo`, `private.segundo_fator_sessao_ok`, `private.totp_confiavel`, `public.dispositivos_confiaveis`, `private.chave_fila`, `public.responsaveis_tecnicos`, `public.especialidades_perfil`, `public.aceites_termo`, `public.adesoes_contrato`

### Preferências e avisos ao profissional

`preferencias` · papel da Chefe Coruja: **operador** · dado sensível: **não**

**Finalidade.** Guardar as escolhas de cada profissional e mandar avisos no aparelho dele.

**Base legal (LGPD)**
- art. 7º, V (execução de contrato)

**Titulares**
- profissionais

**Dados**
- preferências de aviso e de tela
- inscrição de notificação do navegador
- ferramentas favoritas

**Quem acessa**
- o próprio profissional

**Onde fica**
- Supabase (São Paulo)

**Prazo.** enquanto durar a conta (proposta técnica, a confirmar com o advogado). Descarte: apagado com a conta.

**Tabelas (5)**

`public.preferencias_aviso`, `public.panorama_preferencias`, `public.push_subscriptions`, `public.notificacoes_plantonista`, `public.ferramenta_uso`

### Comunicação interna da equipe

`comunicacao` · papel da Chefe Coruja: **operador** · dado sensível: **não**

**Finalidade.** Mensagens entre profissionais, avisos da unidade e chamados ao suporte.

**Base legal (LGPD)**
- art. 7º, V (execução de contrato)
- art. 7º, IX (legítimo interesse do cliente na organização do serviço)

**Titulares**
- profissionais

**Dados**
- mensagens e participantes
- avisos e pedidos da equipe
- chamados técnicos

**Quem acessa**
- participantes da conversa
- gestor da unidade (avisos)
- suporte da Chefe Coruja (chamados)

**Onde fica**
- Supabase (São Paulo)

**Prazo.** a definir com o advogado (sem regra específica; orientar não escrever dado de paciente). Descarte: a definir com o advogado.

**Medidas próprias**
- o canal de WhatsApp está desligado desde 17/11/2026

**Tabelas (9)**

`public.conversas`, `public.conversa_participantes`, `public.mensagens_chat`, `public.chat_mensagens`, `public.notificacoes_whatsapp`, `public.banners`, `public.medidas_pedidas`, `public.chamados_tecnicos`, `public.chamados_tecnicos_andamento`

### Auditoria e registro de acesso ao prontuário

`auditoria` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Saber quem viu ou mudou cada dado, para responder ao paciente, ao cliente e à fiscalização.

**Base legal (LGPD)**
- art. 11, II, a (integridade do prontuário)
- art. 11, II, g

**Titulares**
- profissionais
- pacientes (o prontuário acessado)

**Dados**
- quem, quando, o quê e de onde
- alterações em tabelas clínicas

**Quem acessa**
- gestor da unidade
- encarregado de dados do cliente
- suporte da Chefe Coruja (só investigação de incidente)

**Onde fica**
- Supabase (São Paulo)
- cofre da guarda (AWS S3, São Paulo)

**Prazo.** 20 anos (integridade do prontuário (V3)). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- só inclusão: ninguém edita nem apaga pelo app

**Tabelas (3)**

`public.log_auditoria`, `public.log_acesso_prontuario`, `private.acessos_historico`

### Registro de acesso à aplicação (Marco Civil)

`acesso-aplicacao` · papel da Chefe Coruja: **controlador** · dado sensível: **não**

**Finalidade.** Guardar data, hora e IP de cada entrada e uso do sistema por 6 meses, como pede o Marco Civil, e entregar só com ordem judicial.

**Base legal (LGPD)**
- art. 7º, II (Marco Civil da Internet, art. 15; Decreto 8.771/2016, art. 13)

**Titulares**
- profissionais

**Dados**
- usuário, data, hora, ação (entrada, renovação da sessão, saída) e IP
- guarda pedida pela autoridade: usuário, data final e número do pedido

**Quem acessa**
- super admin, com o segundo fator, só por ordem judicial (cada extração fica na auditoria)

**Onde fica**
- Supabase (São Paulo)

**Prazo.** 6 meses (Marco Civil, art. 15, e Decreto 8.771/2016, art. 13, § 2º (LG9, R2)). Descarte: rotina diária às 03:45 de Brasília, com a quantidade apagada na auditoria; o que está sob guarda fica até a data da guarda.

**Medidas próprias**
- só o banco grava, por gatilho na sessão; ninguém lê pela API
- papel (operador ou controlador) é a pergunta 1 do LG9 ao advogado

**Tabelas (2)**

`private.registros_acesso_aplicacao`, `private.guardas_registros_acesso`

### Erros do aplicativo e vigilância técnica

`seguranca-tecnica` · papel da Chefe Coruja: **controlador** · dado sensível: **não**

**Finalidade.** Achar e corrigir falhas e ataques antes que afetem o atendimento.

**Base legal (LGPD)**
- art. 7º, IX (legítimo interesse)
- art. 46 (dever de segurança)

**Titulares**
- profissionais

**Dados**
- mensagem de erro higienizada, navegador, versão e IP
- incidentes técnicos detectados

**Quem acessa**
- equipe técnica da Chefe Coruja

**Onde fica**
- Supabase (São Paulo)
- Sentry (União Europeia)

**Prazo.** a definir com o advogado (proposta: 1 ano) (proposta técnica). Descarte: a definir com o advogado.

**Medidas próprias**
- a mensagem passa por higienização antes de gravar: sem nome de paciente

**Tabelas (5)**

`public.erros_cliente`, `public.erros_cliente_resolvidos`, `public.cerbero_incidentes`, `public.cerbero_quarentena`, `public.cerbero_url_cache`

### Apoio por IA: busca clínica e assistentes

`apoio-ia` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Responder dúvidas clínicas com fonte citada e apoiar a gestão, sem decidir pelo profissional.

**Base legal (LGPD)**
- art. 11, II, f
- art. 7º, V (execução de contrato)

**Titulares**
- profissionais
- pacientes (só se o profissional escrever dado no texto, o que a tela desaconselha)

**Dados**
- pergunta e resposta (texto apagado em 30 dias)
- avaliação da resposta
- vínculo da conta com o assistente
- uso e custo do modelo

**Quem acessa**
- o próprio profissional
- equipe técnica da Chefe Coruja (registro sem texto)

**Onde fica**
- Supabase (São Paulo)
- servidor Hostinger (Brasil)
- provedor do modelo (DeepSeek, China, até a troca do LG6; depois AWS Bedrock, São Paulo)
- Telegram (assistentes da equipe)

**Prazo.** 30 dias para o texto; registro técnico sem texto por 20 anos (LG6, I3 (já em vigor)). Descarte: rotina diária private.apagar_texto_ia_vencido.

**Medidas próprias**
- texto desidentificado no gateway antes de ir ao modelo
- lembrete de não escrever dado do paciente
- auditoria guarda hash, não o texto

**Tabelas (12)**

`public.clinical_search_logs`, `public.clinical_search_feedback`, `public.ia_gateway_log`, `private.ia_preco_modelo`, `public.hermes_sessions`, `public.hermes_identidades`, `private.hermes_codigos_vinculo`, `public.hermes_almanaque`, `public.hermes_resumo_unidade`, `public.hermes_audit_log`, `public.gaviao_relatorios_semanais`, `public.gaviao_decisoes`

### RNDS, API e integrações com outros sistemas

`rnds-integracoes` · papel da Chefe Coruja: **operador** · dado sensível: **sim**

**Finalidade.** Enviar dados à Rede Nacional de Dados em Saúde e trocar dados com sistemas que o cliente autorizou.

**Base legal (LGPD)**
- art. 11, II, a (Portaria GM/MS 1.434/2020, RNDS)
- art. 11, II, b
- art. 11, II, f

**Titulares**
- pacientes
- profissionais

**Dados**
- registros clínicos em FHIR
- chaves e credenciais de integração (como hash)
- acessos à API e exportações

**Quem acessa**
- Ministério da Saúde (RNDS)
- sistemas autorizados pelo cliente
- gestor da unidade (exportação)

**Onde fica**
- Supabase (São Paulo)
- servidor Hostinger (Brasil, envio à RNDS)
- Ministério da Saúde

**Prazo.** 20 anos para o que compõe o prontuário; registro de acesso da API por 20 anos (Lei 13.787/2018; V3). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- certificado da RNDS no cofre do servidor
- exportação pode sair mascarada e pede motivo

**Tabelas (12)**

`public.rnds_credenciais`, `public.rnds_chaves_publicas`, `public.rnds_bloqueios`, `public.rnds_config_unidade`, `private.rnds_conferencias`, `public.interop_outbox`, `public.webhook_destinos`, `public.webhook_eventos`, `public.webhook_entregas`, `public.api_chaves`, `public.api_acessos`, `public.exportacoes`

### Cliente, unidades e implantação

`implantacao-cliente` · papel da Chefe Coruja: **controlador** · dado sensível: **não**

**Finalidade.** Cadastrar o cliente e as unidades, conduzir a implantação e guardar os aceites de cada etapa.

**Base legal (LGPD)**
- art. 7º, V (execução de contrato)

**Titulares**
- representantes do cliente
- profissionais treinados

**Dados**
- nome e CNPJ do cliente
- unidades e configurações
- treinamentos e aceites da implantação

**Quem acessa**
- equipe de implantação da Chefe Coruja
- gestor do cliente

**Onde fica**
- Supabase (São Paulo)

**Prazo.** duração do contrato; depois, 5 anos (prazo civil e fiscal, a confirmar com o advogado). Descarte: a definir com o advogado.

**Tabelas (8)**

`public.organizacoes`, `public.unidades`, `public.implantacoes`, `public.implantacao_itens`, `public.implantacao_treinamentos`, `public.implantacao_aceites`, `public.configuracoes_unidade`, `public.configuracao_plataforma`

### Site comercial e pedido de demonstração

`site-comercial` · papel da Chefe Coruja: **controlador** · dado sensível: **não**

**Finalidade.** Responder quem pede contato ou demonstração pelo site e limitar abuso do formulário.

**Base legal (LGPD)**
- art. 7º, IX (legítimo interesse)
- art. 7º, V (procedimentos preliminares a contrato)

**Titulares**
- visitantes do site que pedem contato

**Dados**
- nome, e-mail, telefone e mensagem (no e-mail, pela Resend)
- contagem de pedidos por hora (sem o conteúdo)

**Quem acessa**
- equipe comercial da Chefe Coruja

**Onde fica**
- Supabase (São Paulo, só o limite de pedidos)
- Resend (EUA)
- caixa de e-mail do contato
- Cloudflare e Vercel (tráfego do site)

**Prazo.** 2 anos (legítimo interesse (V3)). Descarte: rotina com registro, depois do prazo (V3).

**Medidas próprias**
- o banco guarda só a contagem por hora, não o pedido

**Tabelas (1)**

`private.pedido_demonstracao_limite`

### Catálogos clínicos, terminologias e regras (sem dado de paciente)

`catalogos` · papel da Chefe Coruja: **controlador** · dado sensível: **não**

**Finalidade.** Conteúdo que o sistema usa para funcionar: CID, SIGTAP, medicamentos, interações, fichas clínicas e protocolos.

**Base legal (LGPD)**
- não se aplica ao conteúdo (não é dado pessoal)
- art. 7º, V para o nome de quem aprovou cada ficha

**Titulares**
- responsáveis técnicos e revisores do comitê clínico (nome e registro de quem aprovou ou revisou a versão)

**Dados**
- conteúdo técnico
- aprovação e revisão das fichas por profissão, com autor, conselho e data (LG13)

**Quem acessa**
- todos os usuários (leitura)
- responsável técnico (aprovação)

**Onde fica**
- Supabase (São Paulo)

**Prazo.** enquanto estiver em uso; versões antigas das fichas ficam como histórico (rastreabilidade clínica (LG10)). Descarte: não se aplica.

**Medidas próprias**
- versão nova de ficha só entra aprovada (gate do LG10)

**Tabelas (46)**

`terminologia.cid10`, `terminologia.ciap2`, `terminologia.cbo`, `terminologia.loinc`, `terminologia.medicamento_cmed`, `terminologia.sigtap_procedimento`, `terminologia.sigtap_procedimento_cid`, `terminologia.sigtap_procedimento_ocupacao`, `terminologia.sigtap_procedimento_registro`, `public.conceito`, `public.conceito_opcao`, `public.medicamento`, `public.medicamento_sinonimo`, `public.medicamento_bula`, `private.correcao_nome_medicamento`, `public.substancias_controladas`, `public.cid_termo`, `public.cid_infeccao_regras`, `public.lnnc_agravos`, `public.lnnc_cids`, `public.ferramentas_clinicas`, `public.ferramenta_versoes`, `public.ferramenta_revisoes`, `public.ferramenta_unidade`, `public.protocolos_classificacao`, `public.protocolo_fluxogramas`, `public.classificacao_fluxograma_unidade`, `public.protocolos_observacao`, `public.tipos_intercorrencia`, `public.eventos_adversos_graus`, `public.especialidades_parecer`, `public.grupos_interacao`, `public.grupos_interacao_membros`, `public.interacoes_criticas`, `private.modelos_interacao`, `private.modelos_grupo_membro`, `public.classe_alergenica`, `public.classe_alergenica_membro`, `private.regras_alta_vigilancia`, `public.alta_vigilancia_unidade`, `public.receita_protocolos`, `public.receita_protocolos_versoes`, `public.admissao_detalhes_esquemas`, `public.admissao_detalhes_obrigatorio`, `public.termos_modelos`, `private.marcos`

### Testes automáticos da homologação

`testes-homologacao` · papel da Chefe Coruja: **controlador** · dado sensível: **não**

**Finalidade.** Conferir o sistema de ponta a ponta antes de cada publicação.

**Base legal (LGPD)**
- não se aplica (dados fictícios)

**Titulares**
- nenhum: pacientes e profissionais fictícios

**Dados**
- resultados dos testes e dados inventados

**Quem acessa**
- equipe técnica da Chefe Coruja

**Onde fica**
- Supabase da homologação (São Paulo); não existe na produção

**Prazo.** enquanto servir aos testes (não se aplica). Descarte: não se aplica.

**Medidas próprias**
- proibido usar dado real na homologação

**Tabelas (4)**

`e2e.coorte`, `e2e.coorte2`, `e2e.resultados`, `e2e.vars`

## Fora das migrations

O esquema e2e é criado pelos scripts de teste (scripts/e2e) só na homologação. Tabelas: `e2e.coorte`, `e2e.coorte2`, `e2e.resultados`, `e2e.vars`.
