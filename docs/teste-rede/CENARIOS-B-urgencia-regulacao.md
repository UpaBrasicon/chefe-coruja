# Cenários B — Urgência adulta, regulação, NIR, telemedicina e transferências

Propósito: seis roteiros ponta a ponta (B01 a B06) que levam um adulto fictício da porta da UPA (ou da consulta da UBS) até a regulação, o NIR, o parecer, a teleinterconsulta e a transferência, passando por recepção, enfermeiro, técnico, plantonista, regulador, NIR, gestor, farmácia, faturamento e telemedicina. Tudo aqui se apoia no `docs/teste-rede/MAPA.md` (telas, RPCs, contas, ids e lacunas) e na frente "Teste ponta a ponta da rede" do `BACKLOG.md` (tarefa 1: catálogo; nada é gravado no banco). Obstetrícia e pediatria ficam no bloco A.

## Índice

- [Convenções do bloco](#convenções-do-bloco)
- [B01 — Sepse: porta, observação, internação e UTI fora da rede](#b01--sepse-porta-observação-internação-e-uti-fora-da-rede)
- [B02 — AVC: destino recusa, central nega, novo pedido devolvido e reenviado](#b02--avc-destino-recusa-central-nega-novo-pedido-devolvido-e-reenviado)
- [B03 — SCA: transferência para o hospital da rede com leito reservado](#b03--sca-transferência-para-o-hospital-da-rede-com-leito-reservado)
- [B04 — Trauma: aceite com leito, em trânsito e "não chegou"](#b04--trauma-aceite-com-leito-em-trânsito-e-não-chegou)
- [B05 — UBS: regulação de consulta pela conduta e teleinterconsulta](#b05--ubs-regulação-de-consulta-pela-conduta-e-teleinterconsulta)
- [B06 — SLA estourado (só alerta), cobrança do NIR e cancelamento pela origem](#b06--sla-estourado-só-alerta-cobrança-do-nir-e-cancelamento-pela-origem)
- [Cobertura dos 14 status da regulação](#cobertura-dos-14-status-da-regulação)

## Convenções do bloco

- **Rede F5** (`scripts/e2e/40_rede_fase5.sql`): UBS Fase 5 `f5100000-…-0001` (CNES 9995011, Consultório 1 `f5300000-…-0001`); UPA Fase 5 24h `f5100000-…-0002` (CNES 9995028; Pronto Socorro `…-011`, Observação Adulto `…-012`, Internação `…-013`); Hospital Fase 5 `f5100000-…-0003` (CNES 9995036; Clínica Médica `…-021`, 4 leitos CM, `regulacao_tipo_leito = 'clinico'`); Central de Regulação Fase 5 `f5100000-…-0009`.
- **Contas**: as de `*.f5@teste.local` da seção 5.1 do MAPA. O hospital F5 não tem recepção, gestor, faturamento nem NIR: lá a ficha é aberta pelo `medico.hospital.f5` (MAPA 2.3: "recepção ou plantonista sem recepção escalada"). Não há conta de telemedicina, de técnico na UPA nem de admin.
- **Antes de cada cenário**: rodar `scripts/e2e/41_checkin_fase5.sql` (ou fazer o check-in na tela) para as contas que dependem de escala, inclusive NIR e regulador; passar o 2FA de cada conta no primeiro acesso do dia; conferir a URL da homologação (`kswurfyx…` e `homolog.chefecoruja.com.br`), nunca produção.
- **Cor da classificação**: em todo passo de triagem, a enfermagem classifica. O cenário escreve "cor esperada no teste: X (escolha da enfermeira de teste)". O sistema não sugere cor.
- **Sinais vitais**: digitados e impressos crus, como aferidos. Os números dos cenários são fictícios e servem só para preencher a tela.
- **Doses e condutas**: nunca de memória. O cenário remete ao id da ferramenta e à fonte que o MAPA registra (seção 4). O médico de teste abre a ferramenta em `/plantonista/<seção>/<slug>` e decide.
- **Autor = login**: cada linha da tabela roda com a conta do papel. A conferência de autoria é `criado_por`/`perfil_id` das tabelas e `private.registrar_auditoria`.
- **Custos**: fictícios. Toda tabela de custo começa pela linha de aviso. O código SIGTAP, quando aparece, existe em `data/terminologia/sigtap/tb_procedimento.txt` (competência 202609, carregada na homologação); o valor é sempre inventado e redondo. "Onde nasce" aponta a tabela ou RPC do MAPA (seção 3).
- **Regulação**: `regulacao_solicitar(p_unidade, p_paciente, p_dados jsonb)` exige CNES da origem, CNS ou CPF válido do paciente (ou `paciente_nao_identificado = true`), CID-10 existente, procedimento SIGTAP, quadro clínico com 20 letras ou mais, `carater` (`eletivo`, `urgencia`) e `prioridade` (`emergencia`, `urgencia`, `prioritaria`, `eletiva`, `nao_classificada`). Transferência exige `transporte`; consulta exige `cbo`.
- **Técnico de enfermagem na UPA**: Lacuna (MAPA 5.1): sem conta na rede F5. Nos cenários da UPA, os passos de checagem e sinais vitais rodam com `enfermeiro.upa.f5`; o passo marcado "técnico" fica registrado para quando a conta existir, com a prova de que `classificar_risco` é recusado (teste `F5.1.tecnico_nao_classifica`). O técnico aparece de fato em B05, na UBS.

---

### B01 — Sepse: porta, observação, internação e UTI fora da rede

- **Objetivo:** percorrer a sepse do adulto da ficha ao leito: classificação, atendimento, exames, prescrição com liberação da farmácia, checagem, observação com alerta de sepse para o gestor, parecer entre médicos, internação com laudo de AIH e regulação de leito de UTI com destino fora da rede (`enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada`), até o fechamento das duas contas.
- **Rede e unidades:** UPA Fase 5 24h (PS, Observação Adulto, Internação) e Central de Regulação Fase 5. Destino: serviço de UTI de fora da rede (registrado pela central).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5` (PS), `medico.internacao.f5` (Internação), `farmaceutico.f5`, `gestor.upa.f5` (UPA e Central), `regulador.f5`, `nir.f5`, `faturamento.f5`. Técnico: ver Convenções.
- **Paciente fictício:** Severino Tavares da Luz, 68 anos, masculino, CNS fictício com dígito válido, raça/cor parda, peso referido 70 kg. Queixa: febre, confusão e dor ao urinar há dois dias.
- **Pré-condições:** check-in das contas da UPA e da central; central registrada em `centrais_regulacao`; CNES da UPA preenchido; catálogo de exames da unidade com ao menos "lactato", "hemograma" e "hemocultura" (`/gestao/exames`, gestor); catálogo de medicamentos de teste carregado (`02_catalogo_e2e.sql`); ao menos um medicamento marcado como alta vigilância em `/alta-vigilancia`; leitos OA e INT livres.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção | `/recepcao` (Nova ficha) | `registrar_ficha(setor PS …-011, queixa "febre e confusão", cadastro com CNS, nascimento, raça/cor)` | Ficha aberta no PS; conta ambulatorial aberta | `episodios` (etapa de triagem); `contas` tipo `ambulatorial`, status `aberta` (gatilho `trg_conta_do_episodio`) |
| 2 | enfermeiro | `/triagem` (Fila → Classificar) | `chamar_paciente`; sinais crus: FC 118, PA 88x54, FR 26, SatO2 93%, Tax 38,9 °C, Glasgow 14; fluxograma "Mal-estar geral" do protocolo Aparecida 2025 (ou "Queixas urinárias"); `classificar_risco` | A enfermagem classifica; cor esperada no teste: laranja (escolha da enfermeira de teste) | `classificacoes_risco` (1ª do episódio, autora = login); item "acolhimento com classificação" em `conta_detalhe` |
| 3 | técnico | `/triagem` | Tenta classificar | Recusado | Lacuna (MAPA): sem conta de técnico na UPA F5; registrar como "não executado" e repetir quando houver conta |
| 4 | plantonista (PS) | `/atendimento` (Fila PS → Janela) | `iniciar_atendimento`; `registrar_soap(S, O, A, P, p_cid = 'A41.9')` | Atendimento assumido; SOAP gravado | `episodios.atendimento_medico_id`; item "consulta médica" em `conta_detalhe` |
| 5 | plantonista (PS) | `/plantonista/escores/sepse-adulto`, `/plantonista/escores/news2`, `/plantonista/emergencias/ressuscitacao-volemica-adulto` | Calcula e decide conforme a ferramenta `sepse-adulto` (fonte: Sepsis-3, SSC 2026, ILAS 2026, SOFA-2), `news2` (RCP 2017) e `adulto-ressuscitacao-volemica` (HC; SSC 2026; ILAS 2026) | Resultado exibido; a decisão é do médico de teste e vai para o SOAP ou a evolução | Nada no banco além do SOAP; a ferramenta é apoio |
| 6 | plantonista (PS) | aba Exames | `pedir_exames(p_episodio, [lactato, hemograma, hemocultura], 'urgente', obs)`; depois `resolver_exame` com resultado em texto | Pedidos e resultados registrados | `exames_pedidos`; resultado em `exame_resultado_itens` quando vier por FHIR, ou texto de `resolver_exame` |
| 7 | plantonista (PS) | aba Prescrição | Registra peso referido 70 kg; `prescrever(p_paciente, item)` com antibiótico e volume conforme `sepse-adulto` e `adulto-ressuscitacao-volemica` (o cenário não escreve dose); frequência com horário | Prescrição ativa; item de alta vigilância vai à fila da farmácia | `prescricoes`; `prescricao_porta_ativa`; recusa se faltar peso ([M]`20261121000001`) |
| 8 | farmacêutico | `/farmacia` (fila de validação) | `validar_item` → `confere` no item de alta vigilância | Item liberado | `validacoes_prescricao`; `alta_vigilancia_da_unidade` |
| 9 | enfermeiro (no lugar do técnico) | `/checagem` | `aprazar`; `checar(p_item, 'feito', horário)` | Dose checada | `administracoes` (`situacao = 'feito'`, autor = login); item "administração de medicamento" em `conta_detalhe` |
| 10 | plantonista (PS) | aba Desfecho | `registrar_desfecho(p_episodio, 'observacao', relato, detalhes)` | Paciente em box da Observação Adulto | `internacoes` (box escolhido por `private.box_livre`); `painel_observacao` |
| 11 | enfermeiro | `/enfermagem/pronto-socorro` | `registrar_avaliacao` com sinais crus (FC 124, PA 84x50, FR 28, SatO2 92%) | Avaliação gravada; acuidade recalculada | `acuidade(p_paciente)` (NEWS2 no leito); `registrar_sae` opcional |
| 12 | gestor | `/gestao` (painel) | Abre o painel de alertas de sepse | Paciente listado com nível | `alertas_sepse(p_unidade)` |
| 13 | plantonista (PS) | `/plantao/observacao`; `AbaParecer` | `observacao_reavaliar`/`observacao_reavaliado`; `solicitar_parecer(p_paciente, 'Clínica médica', pergunta ≥ 15, 'urgencia', NULL, p_episodio, p_internacao)` | Parecer `solicitado`; documento clínico gerado | `pareceres_medicos`; `documentos_clinicos` tipo `parecer`; auditoria `solicitar_parecer` |
| 14 | plantonista (Internação) | `/pareceres` | `definir_minhas_especialidades(['Clínica médica'])`; `iniciar_analise_parecer`; `concluir_parecer(p_id, resposta)` | `em_analise → realizado`; quem pediu não responde | `pareceres_medicos.status`; `pareceres_fila` |
| 15 | plantonista (PS) | `/plantao/observacao` | `finalizar_observacao(p_internacao, 'internacao', 'A41.9', relato, detalhes com leito INT-01 de `leitos_para_ocupar`)` | Paciente internado; conta de internação aberta, ligada à conta da porta | `internacoes.internado_em`; `contas` tipo `internacao` com `conta_origem_id` (gatilho `trg_conta_da_internacao`) |
| 16 | plantonista (Internação) | `/plantao/internacao/pacientes` (caderno do leito) | `registrar_admissao`; `registrar_diagnostico`; prescrição do leito ("Vindos da porta" visível); laudo de AIH com `procCod` escolhido por `buscar_sigtap` (ex.: 0303010037) | Admissão única; AIH `solicitada` pelo gatilho | `documentos_clinicos` tipo `laudo_aih`; `aihs` (`trg_aih_do_laudo`); `aih_eventos` |
| 17 | plantonista (Internação) | caderno do leito | `registrar_reavaliacao_quadro` com piora (sinais crus); `acuidade` | Decide pedir UTI | `documentos_clinicos`; `acuidade` |
| 18 | plantonista (Internação) | `/regulacao` (NovaSolicitacao) | `regulacao_solicitar(UPA, paciente, {tipo 'leito', tipo_leito 'uti_adulto', procedimento = o do laudo, cid 'A41.9', carater 'urgencia', prioridade 'emergencia', vulnerabilidades ['idoso'], internacao_id, quadro ≥ 20, sinais_vitais, exames, medicacoes})` | Pedido nº N `enviada`; `aviso_duplicidade = false` | `regulacao_solicitacoes` (modalidade `04`); `regulacao_eventos` `enviada`; auditoria `regulacao_solicitada` |
| 19 | regulador | `/regulacao` (Fila) | `regulacao_fila`; `regulacao_assumir`; `regulacao_priorizar(p_id, 'emergencia', motivo)`; `regulacao_criterios` | `em_analise`; `prioridade_regulador` à parte da proposta | `regulacao_solicitacoes.assumida_por`; evento `priorizada` |
| 20 | regulador | `/regulacao` (MapaVagas) | `regulacao_mapa_vagas` | Só Clínica Médica (`clinico`) aparece; não há UTI na rede | `regulacao_servicos`; leitos em tempo real |
| 21 | regulador | `/regulacao` (PainelDecisao) | `regulacao_autorizar(p_id, 'externo', NULL, 'UTI Hospital Regional (fora da rede)', 'ambulancia_avancada', previsto +3 h, obs)` | `aguardando_destino` | evento `autorizada`; auditoria `regulacao_autorizada`; `notificacoes_plantonista` `reg_autorizada` na origem |
| 22 | regulador | Detalhe | `regulacao_registrar_resposta_externa(p_id, true, 'plantonista da UTI', 'telefone')` | `autorizada` | `regulacao_destino_respostas` (`destino_tipo = 'externo'`); evento `destino_aceitou`; aviso `reg_destino_aceitou` |
| 23 | plantonista (Internação) | Detalhe (origem) | `regulacao_atualizar_evolucao(p_id, texto, sinais crus)` | Evolução registrada; relógio do SLA zera | `regulacao_evolucoes` |
| 24 | NIR | `/nir` | `nir_pendencias(UPA)` | Nenhum item de regulação para este pedido (evolução em dia, sem pendência) | `nir_pendencias.resumo.regulacao = 0` para este nº |
| 25 | plantonista (Internação) | `src/components/alta/*` | `impeditivos_alta(p_internacao)` (parecer já realizado, laudo ativo, doses vencidas feitas); `dar_alta(p_internacao, 'transferencia_externa', 'A41.9', agora, justificativa, obs, detalhes)` | Alta por transferência externa; conta de internação liberada para fechamento | `internacoes.data_alta`; `contas.status` ainda `aberta` |
| 26 | plantonista (Internação) ou NIR | Detalhe | `regulacao_marcar_saida(p_id)` | `em_transito`; reserva não existe (destino externo) | evento `saiu` |
| 27 | regulador | Detalhe | `regulacao_marcar_chegada(p_id, true, 'chegou à UTI 04:10')` (destino de fora: a central marca) | `realizada` | evento `chegou`; auditoria `regulacao_chegada`; `regulacao_historico_paciente` completo |
| 28 | regulador | `/aih` | `decidir_aih(p_id, 'aprovada', número de 13 dígitos)` | AIH aprovada | `aihs.status`; `aih_eventos` |
| 29 | faturamento | `/faturamento/contas` | `conta_detalhe` das duas contas; `mudar_etapa_conta(…, 'em_conferencia')` → `'fechada'`; `contas_pendencias_resumo` antes | Itens congelados com valor SIGTAP; pendência bloqueante exige `liberar_fechamento_conta` pelo gestor | `contas.itens_congelados`; `conta_eventos` |

**Regulação:** `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` (destino externo; sem reserva de leito).

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco` → `private.conta_itens` (`valor_sa`), no passo 2 |
| Atendimento médico em unidade de pronto atendimento | 0301060096 | 1 | R$ 30,00 | R$ 30,00 | `episodios.atendimento_medico_id`, no passo 4 |
| Administração de medicamentos na atenção especializada | 0301100012 | 1 por paciente/profissional/dia | R$ 5,00 | R$ 5,00 | `administracoes` com `situacao = 'feito'`, no passo 9 |
| Antibiótico e cristaloide (dispensados) | — | conforme dispensação | sem valor | sem valor | `dispensacoes` → `private.conta_medicamentos` (quantidade, sem valor) |
| Procedimento principal da AIH (ex.: tratamento de outras doenças bacterianas) | 0303010037 | 1 | R$ 500,00 (SH + SP) | R$ 500,00 | `aihs` + laudo `documentos_clinicos.conteudo->'aih'->>'procCod'`, no passo 16; valor só em `conta_detalhe` |
| Diária de UTI adulto (UTI II) | 0802010083 | — | R$ 1.200,00 | não nasce | Destino fora da rede: nenhuma conta no sistema (MAPA 3.7, "regulação: nada") |
| Parecer de clínica médica | — | — | — | não nasce | MAPA 3.7: parecer não gera valor |
| Plantão do médico da Internação (12 h) | — | 1 | R$ 1.500,00 | R$ 1.500,00 | `remuneracoes_plantao` → `plantao_versoes_erp` quando o gestor fecha o mês; não entra na conta do paciente |

**Critérios de aceite:**
- As duas contas (`ambulatorial` e `internacao`) existem, a segunda com `conta_origem_id` apontando para a primeira, e fecham com `itens_congelados` contendo classificação, atendimento, medicação e procedimento da AIH.
- A cor registrada em `classificacoes_risco` é a que a enfermeira escolheu; nenhum campo "sugestão" existe.
- `prescrever` é recusado sem peso e aceito depois do peso referido; o item de alta vigilância só é checado depois da liberação da farmácia (ou com motivo ≥ 10 letras, marcado `sem_liberacao`).
- `alertas_sepse` lista o paciente enquanto está em observação.
- O parecer pedido pelo médico do PS é respondido pelo médico da Internação; `concluir_parecer` pelo solicitante é recusado.
- O pedido de regulação percorre os seis status na ordem acima, com um evento por transição em `regulacao_eventos` e um registro em `regulacao_destino_respostas` com `destino_tipo = 'externo'`.
- `regulacao_marcar_chegada` por `medico.internacao.f5` é recusado (destino externo: só a central marca).
- Autor de cada registro é o login que executou o passo.

**Bordas a provar:**
- `regulacao_solicitar` sem `internacao_id` válido ou com quadro de 19 letras é recusado com a mensagem de conferência do pedido.
- `regulacao_destino_aceitar` para um pedido com destino externo é recusado ("não está aguardando o aceite da unidade").
- `dar_alta` com parecer ainda `solicitado` é impedido por `impeditivos_alta`; depois de `concluir_parecer`, passa.
- `regulacao_marcar_saida` antes da resposta externa (status `aguardando_destino`) é recusado.
- Pedir um segundo leito `uti_adulto` para o mesmo paciente enquanto o primeiro está aberto devolve `aviso_duplicidade = true`.

**Lacunas tocadas:**
- Lacuna (MAPA): sem UTI na rede F5; o destino é externo e a chegada é marcada pela central. O testador confere `regulacao_destino_respostas.externo_quem/externo_meio` no lugar da reserva de leito.
- Lacuna (MAPA): não há protocolo de observação de sepse (`protocolos_observacao` só tem `DEN`); o testador confere `acuidade` e `alertas_sepse` no lugar de `observacao_iniciar_protocolo`.
- Lacuna (MAPA): sem técnico na UPA F5 (passo 3).
- Lacuna (MAPA): diária de UTI e valor do medicamento não existem no sistema.

---

### B02 — AVC: destino recusa, central nega, novo pedido devolvido e reenviado

- **Objetivo:** provar os caminhos de retorno da regulação num AVC agudo: pendência da central respondida pela origem, recusa do destino que devolve o pedido à fila, negativa da central, novo pedido (sem aviso de duplicidade), devolução para correção, reenvio mantendo a posição na fila e autorização para serviço de fora da rede, com desfecho de transferência na porta. Status: `enviada, em_analise, pendencia, aguardando_destino, negada, devolvida, autorizada, em_transito, realizada`.
- **Rede e unidades:** UPA Fase 5 24h (PS), Central de Regulação Fase 5, Hospital Fase 5 (como destino que recusa), serviço com unidade de AVC fora da rede (registrado pela central).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `regulador.f5`, `medico.hospital.f5`, `gestor.upa.f5`, `nir.f5`, `faturamento.f5`.
- **Paciente fictício:** Dalva Rocha Mendonça, 72 anos, feminino, CNS fictício válido, hipertensa. Fraqueza súbita no braço e na perna direitos e fala arrastada há 50 minutos, trazida pela filha.
- **Pré-condições:** check-in; CNES da UPA; catálogo de exames com "glicemia capilar" e "ECG"; peso referido; Clínica Médica do hospital com leitos livres (a recusa é decisão do médico de teste, não falta de leito no banco).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção | `/recepcao` | `registrar_ficha(setor PS, queixa "fraqueza súbita e fala enrolada")` | Ficha e conta abertas | `episodios`; `contas` `aberta` |
| 2 | enfermeiro | `/triagem` | `chamar_paciente`; sinais crus: FC 92, PA 178x104, FR 18, SatO2 96%, Tax 36,6 °C, Glasgow 14; glicemia capilar 112; fluxograma escolhido pela enfermeira de teste no protocolo Aparecida 2025 (não há fluxograma de déficit neurológico; ela registra em "Mal-estar geral" ou "Alterações de comportamento" com o discriminador); `classificar_risco` | A enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste) | `classificacoes_risco`; item de classificação na conta |
| 3 | plantonista | `/atendimento` | `iniciar_atendimento`; `registrar_soap(…, p_cid = 'I63.9')` com hora do início dos sintomas | Atendimento assumido | `episodios.atendimento_medico_id` |
| 4 | plantonista | `/plantonista/escores/nih-avc`, `/plantonista/escores/glasgow`, `/plantonista/emergencias/trombolise-avc-adulto` | NIHSS, Glasgow e critérios de janela conforme as ferramentas `adulto-nihss` e `adulto-trombolise-avc` (fonte: HC cap. 38; AHA/ASA 2026; INTERACT4 2024; ESO 2025) e `glasgow` (Teasdale 1974) | A UPA F5 não tem TC: a decisão de trombólise cabe ao destino; o pedido leva NIHSS e hora do ictus | Registro no SOAP; sem gravação própria da ferramenta |
| 5 | plantonista | aba Exames | `pedir_exames(ECG, glicemia capilar, 'urgente')`; `resolver_exame` | Resultados em texto | `exames_pedidos` |
| 6 | plantonista | aba Prescrição | Peso referido 62 kg; `prescrever` com item do catálogo de teste, frequência "Agora" (medidas gerais conforme `adulto-trombolise-avc`; o cenário não nomeia dose) | Prescrição ativa | `prescricoes` |
| 7 | enfermeiro | `/checagem` | `checar(item, 'feito')` | Dose feita | `administracoes` |
| 8 | plantonista | `/regulacao` (NovaSolicitacao) | **Pedido 1**: `regulacao_solicitar(UPA, paciente, {tipo 'leito', tipo_leito 'clinico', procedimento '0303040149', cid 'I63.9', carater 'urgencia', prioridade 'emergencia', vulnerabilidades ['idoso'], episodio_id, quadro ≥ 20})` | Nº N1 `enviada`; `aviso_duplicidade = false` | `regulacao_solicitacoes`; evento `enviada` |
| 9 | regulador | `/regulacao` (Fila) | `regulacao_assumir(N1)`; `regulacao_pendencia(N1, 'Informe hora exata do ictus, NIHSS e glicemia')` | `em_analise → pendencia` | evento `pendencia`; aviso `reg_pendencia` ao solicitante |
| 10 | plantonista | Detalhe (ResponderPendencia) | `regulacao_responder_pendencia(N1, 'Ictus 07:40, NIHSS 9, glicemia 112')` | Volta a `em_analise` (pedido continua com o regulador) | evento `pendencia_respondida`; `notificacoes_plantonista` tipo `reg_resposta_N1` na central |
| 11 | regulador | PainelDecisao | `regulacao_autorizar(N1, 'rede', hospital …-0003, NULL, 'ambulancia_avancada')` | `aguardando_destino` | evento `autorizada`; aviso `reg_destino` ao hospital |
| 12 | plantonista do hospital | `/regulacao` (lista do destino) | `regulacao_destino_lista`; `regulacao_destino_recusar(N1, 'perfil_incompativel', 'AVC em janela precisa de TC e trombólise; a Clínica Médica não tem')` | Volta a `em_analise` (estava assumido); `destino_tipo = 'a_definir'` | `regulacao_destino_respostas` `recusada` com `por_registro` (CRM); evento `destino_recusou`; avisos `reg_destino_recusou` à origem e ao regulador |
| 13 | regulador | PainelDecisao | `regulacao_negar(N1, 'fora_escopo', 'Leito clínico não atende AVC em janela; refazer como transferência de urgência para serviço com TC')` | `negada` | evento `negada`; auditoria `regulacao_negada`; aviso `reg_negada` |
| 14 | plantonista | NovaSolicitacao | **Pedido 2**: `regulacao_solicitar(UPA, paciente, {tipo 'transferencia', transporte 'ambulancia_avancada', procedimento '0303040300', cid 'I63.9', carater 'urgencia', prioridade 'emergencia', destino_tipo 'a_definir', quadro ≥ 20 sem a hora do ictus})` | Nº N2 `enviada`; `aviso_duplicidade = false` (N1 está `negada`) | `regulacao_solicitacoes` (`transporte` preenchido; modalidade `04`) |
| 15 | regulador | Fila | `regulacao_assumir(N2)`; `regulacao_devolver(N2, 'Faltam hora do ictus e NIHSS no quadro clínico')` | `devolvida`; `assumida_por` limpo | evento `devolvida`; aviso `reg_devolvida` |
| 16 | NIR | `/nir` | `nir_pendencias(UPA)` | Item `reg_pendencia` só aparece depois do prazo (3 h padrão); antes, nada | `private.regulacao_sla` → `pendencia.atrasada = false` |
| 17 | plantonista | Detalhe (Reenviar) | `regulacao_reenviar(N2, {quadro_clinico com ictus 07:40 e NIHSS 9, prioridade 'emergencia'})` | `enviada`; `criada_em` inalterado (posição na fila mantida); `reenviada_em` preenchido | evento `reenviada` com os campos alterados; auditoria `regulacao_reenviada` |
| 18 | regulador | Fila → PainelDecisao | `regulacao_assumir(N2)`; `regulacao_autorizar(N2, 'externo', NULL, 'Hospital com unidade de AVC (fora da rede)', 'ambulancia_avancada', previsto +1 h)` | `aguardando_destino` | evento `autorizada` |
| 19 | regulador | Detalhe | `regulacao_registrar_resposta_externa(N2, true, 'neurologista de plantão', 'telefone')` | `autorizada` | `regulacao_destino_respostas` externo |
| 20 | plantonista | aba Desfecho | `registrar_desfecho(p_episodio, 'transferencia', relato, detalhes)` | Episódio encerrado por transferência; conta liberada para fechar | `episodios.desfecho`; `conta_eventos` |
| 21 | plantonista ou NIR | Detalhe | `regulacao_marcar_saida(N2)` | `em_transito` | evento `saiu` |
| 22 | regulador | Detalhe | `regulacao_marcar_chegada(N2, true)` | `realizada` | evento `chegou`; `regulacao_historico_paciente` mostra N1 negada e N2 realizada |
| 23 | gestor (central) | `/regulacao` (Indicadores) | `regulacao_indicadores` | Conta uma negada, uma realizada, uma recusa de destino | `regulacao_indicadores` |
| 24 | faturamento | `/faturamento/contas` | Fecha a conta da porta | Itens congelados | `contas.itens_congelados` |

**Regulação:** Pedido 1: `enviada → em_analise → pendencia → em_analise → aguardando_destino → em_analise (recusa do destino) → negada`. Pedido 2: `enviada → em_analise → devolvida → enviada (reenvio) → em_analise → aguardando_destino → autorizada → em_transito → realizada`.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco`, passo 2 |
| Atendimento médico em unidade de pronto atendimento | 0301060096 | 1 | R$ 30,00 | R$ 30,00 | `episodios.atendimento_medico_id`, passo 3 |
| Administração de medicamentos na atenção especializada | 0301100012 | 1 | R$ 5,00 | R$ 5,00 | `administracoes` `feito`, passo 7 |
| Tratamento de AVC isquêmico agudo com uso de trombolítico | 0303040300 | — | R$ 800,00 | não nasce | Só referência no pedido de regulação (`regulacao_solicitacoes.procedimento`); destino fora da rede, sem conta no sistema |
| Transporte por ambulância avançada | — | — | — | não nasce | `regulacao_solicitacoes.transporte` é só registro; o sistema não precifica transporte |

**Critérios de aceite:**
- A recusa do destino devolve N1 a `em_analise` (porque estava assumido) e limpa `destino_unidade_id`; a resposta fica guardada em `regulacao_destino_respostas` com motivo `perfil_incompativel` e justificativa.
- N2 abre sem `aviso_duplicidade` porque N1 está `negada`.
- `regulacao_reenviar` só é aceito em `devolvida`; depois do reenvio, `criada_em` não muda e o pedido volta à fila na posição original.
- O histórico do paciente mostra os dois pedidos com todos os eventos, só inserção (`regulacao_eventos`).
- O desfecho `transferencia` na porta encerra o episódio sem exigir que a chegada tenha sido marcada.

**Bordas a provar:**
- `regulacao_pendencia` repetida enquanto a primeira pergunta está sem resposta é recusada ("já há uma pergunta esperando").
- `regulacao_responder_pendencia` por `enfermeiro.upa.f5` é recusado (responde o solicitante, o médico assistente ou o gestor da origem).
- `regulacao_destino_recusar` com texto de 9 letras é recusado; com 10, passa.
- `regulacao_negar` sem motivo da lista (`sem_indicacao, sem_oferta, fora_escopo, duplicidade, ja_atendido_obito, outro`) é recusado.
- Abrir N2 **antes** de negar N1 devolveria `aviso_duplicidade = true` (não bloqueia); o teste prova o valor `false` na ordem correta.
- `regulacao_solicitar` tipo `transferencia` sem `transporte` cai no CHECK e devolve a mensagem de conferência do pedido.

**Lacunas tocadas:**
- Lacuna (MAPA): o protocolo Aparecida 2025 não tem fluxograma de déficit neurológico; a enfermeira de teste escolhe o fluxograma e registra o discriminador. O testador confere `classificacoes_risco.fluxograma` e `discriminador`.
- Lacuna (MAPA): sem TC nem trombólise na UPA F5 e sem unidade de AVC na rede; o destino final é externo.
- Lacuna (MAPA): o SLA só alerta; a devolução e a pendência não cancelam nada sozinhas.

---

### B03 — SCA: transferência para o hospital da rede com leito reservado

- **Objetivo:** síndrome coronariana aguda na UPA com transferência regulada para o hospital da rede: fila, priorização, mapa de vagas, aceite do destino com reserva de leito, saída marcada pelo NIR, chegada marcada pelo hospital e abertura da ficha e internação no destino pelo fluxo normal, com laudo de AIH e conta de internação no hospital. Status: `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada`.
- **Rede e unidades:** UPA Fase 5 24h (PS), Central de Regulação Fase 5, Hospital Fase 5 (Clínica Médica).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `gestor.upa.f5` (UPA e Central), `regulador.f5`, `nir.f5`, `medico.hospital.f5`, `faturamento.f5`.
- **Paciente fictício:** Joaquim Ferraz Bittencourt, 55 anos, masculino, CPF fictício válido, tabagista. Dor torácica em aperto há 40 minutos, com sudorese.
- **Pré-condições:** check-in; CNES da UPA e do hospital; catálogo de exames com "ECG" e "troponina"; Clínica Médica com ao menos dois leitos `livre`; setor CM com `regulacao_tipo_leito = 'clinico'` (vem do seed F5); gestor da UPA ofertou o setor Internação no mapa (`regulacao_ofertar_setor(…-013, 'clinico')`) para o mapa mostrar as duas unidades.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção | `/recepcao` | `registrar_ficha(setor PS, "dor no peito")` | Ficha e conta abertas | `episodios`; `contas` |
| 2 | enfermeiro | `/triagem` | Sinais crus: FC 96, PA 150x92, FR 20, SatO2 95%, Tax 36,4 °C, dor 8/10 (`Dor.tsx`); fluxograma "Dor torácica"; `classificar_risco` | A enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste) | `classificacoes_risco` (com `p_dor`) |
| 3 | plantonista | `/atendimento` | `iniciar_atendimento`; `registrar_soap(…, p_cid = 'I21.9')` | Atendimento assumido | `episodios.atendimento_medico_id` |
| 4 | plantonista | aba Exames | `pedir_exames(ECG, troponina, 'urgente')`; `resolver_exame(ECG, resultado em texto)` | ECG com resultado | `exames_pedidos` |
| 5 | plantonista | `/plantonista/emergencias/sca-inicial-adulto`, `/plantonista/escores/heart`, `/grace`, `/killip`, `/plantonista/emergencias/fibrinoliticos-adulto` | Conduta e escores conforme `adulto-sca-inicial` (fonte: HC caps. 13–14; ACC/AHA 2025; ESC 2023), `heart` (Six 2008; SBC 2025), `grace`, `killip`, e a decisão fibrinólise × transferência conforme `adulto-fibrinoliticos` (HC caps. 14 e 32; ACC/AHA 2025) | Decisão do médico de teste: transferir | SOAP |
| 6 | plantonista | aba Prescrição | Peso referido 84 kg; `prescrever` conforme `adulto-sca-inicial` (sem dose aqui); `interacoes_justificadas` se a tela travar por interação ativa | Prescrição ativa; se houver alta vigilância, fila da farmácia | `prescricoes`; `interacoes_criticas` |
| 7 | farmacêutico | `/farmacia` | `validar_item` → `confere` | Liberado | `validacoes_prescricao` |
| 8 | enfermeiro | `/checagem` | `checar(item, 'feito')` | Dose feita | `administracoes` |
| 9 | plantonista | `/regulacao` | `regulacao_solicitar(UPA, paciente, {tipo 'transferencia', tipo_leito 'clinico', transporte 'ambulancia_avancada', procedimento '0303060190', cid 'I21.9', carater 'urgencia', prioridade 'emergencia', episodio_id, quadro ≥ 20, exames "ECG: …", telefone_contato})` | Nº N `enviada` | `regulacao_solicitacoes`; evento `enviada` |
| 10 | gestor (central) | `/regulacao` (Fila) | `regulacao_fila(central)` | Pedido no topo pela prioridade e espera; gestor da central vê, não decide | `regulacao_fila` |
| 11 | regulador | Fila | `regulacao_assumir`; `regulacao_priorizar(N, 'emergencia', motivo)` | `em_analise` | evento `priorizada` |
| 12 | regulador | MapaVagas | `regulacao_mapa_vagas` | Clínica Médica com leitos livres em tempo real; Internação da UPA ofertada como `clinico` | `regulacao_servicos`; `leitos.status` |
| 13 | regulador | PainelDecisao | `regulacao_autorizar(N, 'rede', hospital …-0003, NULL, 'ambulancia_avancada', previsto +2 h, 'leito monitorado')` | `aguardando_destino`; `destino_enviado_em` | evento `autorizada`; aviso `reg_destino` aos plantonistas e gestor do hospital |
| 14 | plantonista do hospital | `/regulacao` (lista do destino) | `regulacao_destino_lista`; `regulacao_leitos_destino(N)` | CM-01..CM-04 livres, `do_tipo = true` | `regulacao_leitos_destino` |
| 15 | plantonista do hospital | Detalhe | `regulacao_destino_aceitar(N, leito CM-01, 'aceito, leito monitorado')` | `autorizada`; CM-01 `reservado`; reserva até `max(agora + 24 h, previsto + 8 h)` | `reservas_leito` (motivo "Regulação nº N (de UPA Fase 5 24h)", `paciente_id` nulo); `leitos.status`; `eventos_leito` tipo `reserva`; avisos `reg_destino_aceitou` à origem e ao regulador |
| 16 | NIR | `/nir` | `nir_pendencias(UPA)` | Nada parado neste pedido | `nir_pendencias` |
| 17 | plantonista | aba Desfecho | `registrar_desfecho(p_episodio, 'transferencia', relato, detalhes)` | Episódio encerrado | `episodios.desfecho` |
| 18 | NIR | Detalhe | `regulacao_marcar_saida(N)` | `em_transito`; reserva estendida em 8 h | evento `saiu`; `reservas_leito.expira_em`; aviso `reg_saiu` ao hospital |
| 19 | plantonista do hospital | Detalhe | `regulacao_marcar_chegada(N, true, 'chegou 10:35')` | `realizada`; reserva estendida 8 h "pronta para ocupar" | evento `chegou`; auditoria `regulacao_chegada` |
| 20 | plantonista do hospital | `/recepcao` (sem recepção escalada) | `registrar_ficha(setor CM …-021, "transferido da UPA, IAM")` | Ficha e conta ambulatorial do hospital abertas | `episodios` (hospital); `contas` |
| 21 | plantonista do hospital | `/atendimento` → Desfecho | `iniciar_atendimento`; `registrar_soap(…, 'I21.9')`; `leitos_para_ocupar`; `registrar_desfecho(p_episodio, 'internacao', relato, {leito_id: CM-01})` | Internado no leito que estava reservado; conta de internação aberta | `internacoes.internado_em`; `contas` tipo `internacao`; `reservas_leito` encerrada ou `cancelar_reserva` (ver Bordas) |
| 22 | plantonista do hospital | caderno do leito | `registrar_admissao`; laudo de AIH com `procCod = '0303060190'` | AIH `solicitada` | `aihs`; `aih_eventos` |
| 23 | regulador | `/aih` | `conferir_aih`; `decidir_aih(…, 'aprovada', número)` | AIH aprovada | `aihs.status` |
| 24 | faturamento | `/faturamento/contas` (UPA) | Fecha a conta da porta da UPA | Itens congelados | `contas.itens_congelados` |
| 25 | gestor (central) | `/regulacao` (Indicadores e SLA) | `regulacao_indicadores`; `regulacao_sla_painel(central)` | Tempo até o aceite e até a chegada; sem atraso | `regulacao_status_tempos` |

**Regulação:** `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada`, com reserva de leito criada no aceite, estendida na saída e na chegada.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco (UPA) | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco`, passo 2 |
| Atendimento médico em unidade de pronto atendimento (UPA) | 0301060096 | 1 | R$ 30,00 | R$ 30,00 | `episodios.atendimento_medico_id`, passo 3 |
| Administração de medicamentos (UPA) | 0301100012 | 1 | R$ 5,00 | R$ 5,00 | `administracoes` `feito`, passo 8 |
| Atendimento médico no hospital (porta) | código da fonte `atendimento_medico` do hospital em `bpa_procedimentos_unidade` | 1 | R$ 30,00 | R$ 30,00 | `episodios.atendimento_medico_id` do hospital, passo 21; só se o hospital tiver o código associado (ver Lacunas) |
| Tratamento de infarto agudo do miocárdio (AIH, procedimento principal) | 0303060190 | 1 | R$ 1.000,00 (SH + SP) | R$ 1.000,00 | `aihs` + laudo, passo 22; valor em `conta_detalhe` da conta de internação do hospital |
| Material (eletrodos, cateter) | SIGTAP grupo 07 opcional | 2 | sem valor | sem valor | `conta_materiais` lançado pelo faturamento; o sistema não precifica material |
| Transporte por ambulância avançada | — | — | — | não nasce | só registro em `regulacao_solicitacoes.transporte` e `transporte_central` |

**Critérios de aceite:**
- O aceite do destino grava `reservas_leito` e muda CM-01 para `reservado`; o `expira_em` obedece `max(agora + 24 h, previsto + 8 h)`.
- `regulacao_marcar_saida` e `regulacao_marcar_chegada` estendem a reserva em 8 h cada (comparar `expira_em` antes e depois).
- A chegada regulada **não** cria internação no hospital; a internação só existe depois dos passos 20–21.
- O histórico do pedido fica visível na porta da UPA e no caderno do leito do hospital (`regulacao_historico_paciente`).
- A AIH é decidida pelo regulador com CRM; `decidir_aih` por `gestor.upa.f5` é recusado.

**Bordas a provar:**
- `regulacao_destino_aceitar(N, NULL)` num pedido de leito é recusado ("escolha o leito"); num pedido de `transferencia` passa sem leito, mas o cenário escolhe o leito para provar a reserva.
- `regulacao_destino_aceitar` com leito de outra unidade é recusado ("leito não encontrado nesta unidade").
- Ocupar CM-01 (passo 21): a reserva da regulação tem `paciente_id` nulo. Provar se `leitos_para_ocupar` oferece o leito reservado ao paciente recém-chegado; se não oferecer, o médico do hospital usa `cancelar_reserva` e ocupa, e o achado vai ao relatório da tarefa 3.
- `regulacao_marcar_saida` por `enfermeiro.upa.f5` é recusado (equipe médica, gestor ou NIR da origem).
- Segundo `regulacao_marcar_chegada(N, true)` depois de `realizada` é recusado.
- Reserva vencida: `private.expirar_reservas()` libera o leito; o teste pode provar com uma reserva de `reservar_leito(p_leito, 1 h)` paralela.

**Lacunas tocadas:**
- Lacuna (MAPA): a chegada regulada não cria a internação no destino; o testador confere que `internacoes` só nasce em `registrar_desfecho('internacao')` no hospital.
- Lacuna (MAPA): o hospital F5 não tem recepção, gestor nem faturamento; o médico do hospital abre a ficha, e a conta de internação do hospital é conferida direto em `contas` pelo SQL Editor (ninguém da F5 a fecha). O gestor da central não administra o hospital.
- Lacuna (MAPA): não há `unidade_coronariana` na rede F5; o pedido vai como `clinico`.
- Lacuna (MAPA): transporte e material não têm valor no sistema.

---

### B04 — Trauma: aceite com leito, em trânsito e "não chegou"

- **Objetivo:** politrauma na UPA com pedido de transferência aceito pelo hospital (leito reservado), saída marcada e desfecho `falta` quando o destino registra que o paciente não chegou, com liberação da reserva e aviso à origem; prova também o pedido de paciente sem CNS/CPF (`paciente_nao_identificado`). Status: `enviada → em_analise → aguardando_destino → autorizada → em_transito → falta`.
- **Rede e unidades:** UPA Fase 5 24h (PS), Central de Regulação Fase 5, Hospital Fase 5.
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `farmaceutico.f5`, `regulador.f5`, `nir.f5`, `medico.hospital.f5`, `gestor.upa.f5`, `faturamento.f5`.
- **Paciente fictício:** Rogério Lins Albuquerque, 34 anos, masculino, **sem documento** na chegada (ficha sem CNS e sem CPF; cadastro completado depois pela família). Queda de motocicleta, trazido por terceiros. Peso estimado 75 kg.
- **Pré-condições:** check-in; catálogo de exames com "hemograma", "tipagem sanguínea" e "RX de tórax"; Clínica Médica com leito livre.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção | `/recepcao` | `registrar_ficha(setor PS, "queda de moto", cadastro sem CNS e sem CPF)` | Ficha aberta (CNS/CPF são só aviso na porta) | `episodios`; `pacientes` sem `cns`/`cpf`; `contas` |
| 2 | enfermeiro | `/triagem` | Sinais crus: FC 128, PA 92x60, FR 24, SatO2 94%, Glasgow 13 (O3 V4 M6), dor 7/10; fluxograma "Politraumas"; `classificar_risco` | A enfermagem classifica; cor esperada no teste: vermelho (escolha da enfermeira de teste) | `classificacoes_risco` |
| 3 | plantonista | `/atendimento` | `iniciar_atendimento`; `registrar_soap(…, p_cid = 'S06.9')` | Atendimento assumido | `episodios.atendimento_medico_id` |
| 4 | plantonista | `/plantonista/emergencias/trauma-inicial-adulto`, `/plantonista/escores/glasgow`, `/plantonista/emergencias/triage-rts-trauma`, `/mgap-trauma`, `/nexus-coluna-cervical`, `/plantonista/escores/canadian-ct-head`, `/plantonista/emergencias/abc-score-transfusao-macica` | Avaliação inicial e escores conforme `adulto-trauma-inicial` (fonte: HC caps. 47–48; PATCH-Trauma; CRYOSTAT-2 2023), `glasgow`, `adulto-triage-rts`, `adulto-mgap`, `adulto-nexus`, `canadian-ct-head` (Stiell 2001/2005) e `adulto-abc-score` (HC) | Escores exibidos; as ferramentas de trauma do adulto aceitam o paciente (34 anos, ≥ 14) | SOAP |
| 5 | plantonista | aba Exames | `pedir_exames(hemograma, tipagem, RX tórax, 'urgente')`; `resolver_exame` | Resultados | `exames_pedidos` |
| 6 | plantonista | aba Prescrição | Peso **estimado** 75 kg; `prescrever` conforme `adulto-trauma-inicial` (sem dose aqui) | Prescrição ativa (peso estimado é aceito) | `prescricoes`; [M]`20261121000001` |
| 7 | farmacêutico / enfermeiro | `/farmacia`, `/checagem` | Validação e `checar(item, 'feito')` | Dose feita | `validacoes_prescricao`; `administracoes` |
| 8 | plantonista | `/regulacao` | `regulacao_solicitar(UPA, paciente, {tipo 'transferencia', tipo_leito 'clinico', transporte 'ambulancia_avancada', procedimento '0303040106', cid 'S06.9', carater 'urgencia', prioridade 'emergencia', episodio_id, quadro ≥ 20})` **sem** `paciente_nao_identificado` | **Recusado**: "sem CNS e sem CPF válidos" | mensagem da RPC |
| 9 | plantonista | `/regulacao` | Repete com `paciente_nao_identificado: true` | Nº N `enviada`; `paciente_nao_identificado = true` | `regulacao_solicitacoes` |
| 10 | regulador | Fila → PainelDecisao | `regulacao_assumir`; `regulacao_autorizar(N, 'rede', hospital, NULL, 'ambulancia_avancada', previsto +1 h)` | `aguardando_destino` | evento `autorizada` |
| 11 | plantonista do hospital | `/regulacao` | `regulacao_destino_aceitar(N, leito CM-02, 'aceito')` | `autorizada`; CM-02 `reservado` | `reservas_leito`; `eventos_leito` `reserva` |
| 12 | recepção | `/recepcao` (cadastro) | Completa o cadastro com o CNS trazido pela família | Paciente identificado | `pacientes.cns`; o pedido N guarda `paciente_nao_identificado = true` (histórico) |
| 13 | plantonista | aba Desfecho | `registrar_desfecho(p_episodio, 'transferencia', relato, detalhes)` | Episódio encerrado | `episodios.desfecho` |
| 14 | NIR | Detalhe | `regulacao_marcar_saida(N)` | `em_transito`; aviso `reg_saiu` ao hospital | evento `saiu` |
| 15 | NIR | `/nir` | `nir_pendencias(UPA)` | O item `reg_chegada` ("paciente a caminho sem registro de chegada") é do **destino**; o NIR da UPA não o vê | Lacuna (MAPA): sem NIR nem gestor no hospital F5 |
| 16 | plantonista do hospital | Detalhe | `regulacao_marcar_chegada(N, false, 'ambulância desviada pelo SAMU para hospital de trauma fora da rede')` | `falta`; `falta_em`; reserva liberada e CM-02 `livre` | evento `nao_chegou`; `reservas_leito` encerrada; `eventos_leito`; aviso `reg_nao_chegou` à origem |
| 17 | plantonista | `/regulacao` (Detalhe) | Tenta `regulacao_cancelar(N, 'paciente foi a outro serviço')` | **Recusado**: "não pode mais ser cancelada" (status `falta`) | mensagem da RPC |
| 18 | gestor (central) | `/regulacao` (Indicadores) | `regulacao_indicadores` | Uma `falta` contabilizada | `regulacao_indicadores` |
| 19 | faturamento | `/faturamento/contas` | `contas_pendencias_resumo`; fecha a conta da porta | Paciente sem CNS no momento da classificação é só aviso; com CNS depois, fecha | `contas.itens_congelados`; `liberacao_pendencias` |

**Regulação:** `enviada → em_analise → aguardando_destino → autorizada → em_transito → falta`.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco`, passo 2 |
| Atendimento médico em unidade de pronto atendimento | 0301060096 | 1 | R$ 30,00 | R$ 30,00 | `episodios.atendimento_medico_id`, passo 3 |
| Administração de medicamentos na atenção especializada | 0301100012 | 1 | R$ 5,00 | R$ 5,00 | `administracoes` `feito`, passo 7 |
| Procedimento da porta registrado (ex.: sutura, imobilização, se estiver na lista da unidade) | código da lista da unidade (uso `lista`) | 1 | R$ 40,00 | R$ 40,00 | `procedimentos_realizados` por `registrar_procedimento` (quem fez) ou `lancar_procedimento_conta` (faturamento) |
| Tratamento conservador de TCE grave | 0303040106 | — | R$ 700,00 | não nasce | Só referência no pedido; o paciente não chegou ao hospital da rede |
| Leito CM-02 reservado por 2 h | — | — | — | não nasce | Lacuna (MAPA): sem diária de leito nem tempo de permanência com valor |

**Critérios de aceite:**
- `regulacao_solicitar` recusa o paciente sem CNS/CPF até que `paciente_nao_identificado = true` seja marcado; o pedido guarda a marca mesmo depois de o cadastro ser completado.
- `regulacao_marcar_chegada(N, false, …)` exige observação com 10 letras ou mais, grava `falta`, libera a reserva (leito `livre`, evento em `eventos_leito`) e avisa a origem.
- Depois de `falta`, nenhuma RPC muda o status (cancelar, aceitar, marcar saída são recusados).
- Os escores de trauma do adulto funcionam para 34 anos; com data de nascimento abaixo de 14 anos devolveriam "não se aplica" (prova negativa opcional).
- Peso estimado é aceito pela prescrição.

**Bordas a provar:**
- `regulacao_marcar_chegada(N, false, 'não veio')` (8 letras) é recusado.
- `regulacao_marcar_saida` com o pedido ainda `aguardando_destino` (antes do aceite) é recusado.
- Pedido de transferência de recém-nascido exigiria `incubadora`; aqui não se aplica (adulto), mas a RPC não deve pedir.
- `registrar_desfecho('transferencia')` sem relato ainda passa (relato ≥ 15 é exigido só em `evasao`, `alta_a_pedido` e `obito`).

**Lacunas tocadas:**
- Lacuna (MAPA): sem NIR nem gestor no hospital F5; a pendência `reg_chegada` do destino não é visível por nenhuma conta da rede F5 (passo 15). O testador confere a lógica pela tabela: `private.nir_itens` só é chamada por `nir_pendencias`, que exige vínculo na unidade; registrar como "não executável nesta rede".
- Lacuna (MAPA): sem valor de leito reservado nem de transporte.
- Lacuna (MAPA): o SAMU e o hospital de fora não existem no sistema; a chegada em outro serviço é só texto em `chegada_observacao`.

---

### B05 — UBS: regulação de consulta pela conduta e teleinterconsulta

- **Objetivo:** adulto atendido na UBS com episódio neurológico transitório: escuta inicial pela enfermeira (técnico recusado), consulta com CIAP-2 e CID, ferramenta `abcd2`, regulação de consulta especializada aberta pela conduta (tipo `consulta`, com CBO), aceite do hospital sem leito, chegada direta de `autorizada` para `realizada`, e teleinterconsulta solicitada pelo médico da UBS até onde a rede F5 permite. Status: `enviada → em_analise → aguardando_destino → autorizada → realizada`.
- **Rede e unidades:** UBS Fase 5, Central de Regulação Fase 5, Hospital Fase 5 (ambulatório de destino).
- **Papéis e contas de teste:** `recepcao.ubs.f5`, `enfermeiro.ubs.f5`, `tecnico.ubs.f5`, `medico.ubs.f5`, `gestor.ubs.f5`, `regulador.f5`, `medico.hospital.f5`, `gestor.upa.f5` (como gestor da central). Telemedicina: ver Lacunas.
- **Paciente fictício:** Marlene Siqueira Pontes, 61 anos, feminino, CNS fictício válido, hipertensa em acompanhamento. Ontem teve 20 minutos de fala arrastada e dormência na mão esquerda, hoje sem queixa.
- **Pré-condições:** check-in das contas da UBS; CNES da UBS (9995011); central registrada; `terminologia_buscar('cbo', 'neurolog')` devolve 225112 (se não devolver, usar 225120 Cardiologia, confirmado no roteiro `F5b.8`); CIAP-2 carregado (`terminologia_buscar('ciap2', 'isquemia')`).

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 1 | recepção (UBS) | `/recepcao` | `registrar_ficha(setor Consultório 1, "fala enrolada ontem", cadastro com tipo_atendimento 'consulta_no_dia')` | Episódio da UBS aberto | `episodios.tipo_atendimento_aps = 'consulta_no_dia'`; **nenhuma** conta com valor (D6) |
| 2 | técnico (UBS) | `/escuta` | Tenta `registrar_escuta_aps` | **Recusado** | teste `F5.1.tecnico_nao_classifica`; o técnico só lê os painéis |
| 3 | enfermeiro (UBS) | `/escuta` (`EscutaInicial.tsx`) | Sinais crus: PA 162x98, FC 78, FR 16, SatO2 97%, Tax 36,5 °C, peso 71 kg, altura 160 cm; `registrar_escuta_aps(p_episodio, cor, 'consulta', relato, sinais)` | A enfermagem classifica; cor esperada no teste: amarelo (escolha da enfermeira de teste); saída `consulta` (fila do médico) | `escutas_aps` ou tabela equivalente de [M]`20270213000001`; autora = login |
| 4 | médico (UBS) | `/atendimento` (textos da UBS) | `iniciar_atendimento`; `registrar_soap(…, p_cid = 'G45.9')` | Consulta iniciada | `episodios.atendimento_medico_id` |
| 5 | médico (UBS) | `/plantonista/escores/abcd2` | Calcula conforme a ferramenta `abcd2` (fonte: ver ficha) com os dados fictícios; decide o ramo | O cenário segue o ramo em que o médico de teste escolhe consulta especializada regulada (se ele escolher a UPA, o fluxo é `encaminhar_upa`, fora deste cenário) | SOAP |
| 6 | médico (UBS) | aba Conduta | `registrar_conduta_aps(p_episodio, tipo, problemas ["AIT"], cids ['G45.9'], condutas ['encaminhamento_especializado'], obs, ciaps ['K89'])` | Conduta gravada; aba mantém o estado (PR #435) | `condutas_aps` (ou tabela de [M]`20270215000001`); `conduta_aps` contém `encaminhamento_especializado` |
| 7 | médico (UBS) | aba Conduta → `/regulacao` | `regulacao_solicitar(UBS, paciente, {tipo 'consulta', especialidade 'Neurologia', cbo '225112', procedimento '0301010072', cid 'G45.9', carater 'eletivo', prioridade 'prioritaria', destino_tipo 'a_definir', episodio_id, quadro ≥ 20, hipotese})` | Nº N `enviada`; modalidade `07` | `regulacao_solicitacoes` (`cbo`, `especialidade`); evento `enviada`; `regulacao_lista(UBS)` mostra N |
| 8 | médico (UBS) | `/teleinterconsulta` | `telemedicina_na_unidade(UBS)`; `solicitar_teleinterconsulta(paciente, 'Paciente com AIT provável; há indicação de antiagregação já na UBS?', 'obtido', 'rotina', p_episodio)` | Teleinterconsulta `aberta`; documento clínico "SOLICITAÇÃO DE TELEINTERCONSULTA" | `teleinterconsultas.status = 'aberta'`; `documentos_clinicos` tipo `teleinterconsulta`; auditoria `solicitar_teleinterconsulta` |
| 9 | médico (UBS) | `/teleinterconsulta` | Tenta `aceitar_teleinterconsulta` | **Recusado**: só telemedicina de plantão aceita; e quem solicitou não responde | mensagem da RPC |
| 10 | telemedicina | `/teleinterconsulta` | `aceitar_teleinterconsulta`; `responder_teleinterconsulta(p_id, parecer ≥ 20)` | Lacuna (MAPA): sem conta de telemedicina na F5; passo não executável | Conferir no lugar: `teleinterconsultas_da_unidade(UBS)` lista a aberta; `tele_pendencias` fica para quando houver conta |
| 11 | médico (UBS) | `/teleinterconsulta` | `cancelar_teleinterconsulta(p_id)` (só antes do aceite) | `cancelada` | `teleinterconsultas.status`; auditoria |
| 12 | médico (UBS) | aba Conduta | Encerra a consulta com `alta_episodio` na conduta | Episódio encerrado; retorno programado fora deste cenário | `episodios.etapa` |
| 13 | gestor (UBS) | `/regulacao` | `regulacao_lista(UBS)`; `regulacao_historico_paciente` | Pedido N visível ao gestor da origem | `regulacao_lista` |
| 14 | regulador | Fila | `regulacao_assumir`; `regulacao_criterios` | `em_analise`; a fila ordena `nao_classificada` primeiro, depois prioridade e espera | `regulacao_fila` |
| 15 | regulador | PainelDecisao | `regulacao_autorizar(N, 'rede', hospital …-0003, NULL, NULL, previsto +7 dias, 'ambulatório de neurologia')` | `aguardando_destino` | evento `autorizada` com `data_prevista` |
| 16 | plantonista do hospital | `/regulacao` | `regulacao_destino_aceitar(N, NULL, 'quarta-feira 9h, ambulatório')` | `autorizada` sem reserva (consulta não exige leito) | `regulacao_destino_respostas` `aceita`, `leito_id` nulo; `reserva_id` nulo |
| 17 | gestor (UBS) | `/regulacao` | Vê `autorizada`, destino e data prevista; informa a paciente fora do sistema | — | `regulacao_json` do pedido |
| 18 | plantonista do hospital | Detalhe | No dia: `regulacao_marcar_chegada(N, true, 'compareceu à consulta')` direto de `autorizada` (sem `marcar_saida`) | `realizada` | evento `chegou`; `regulacao_historico_paciente` |
| 19 | gestor (central) | `/regulacao` (Indicadores) | `regulacao_indicadores` | Consulta eletiva realizada | `regulacao_indicadores` |

**Regulação:** `enviada → em_analise → aguardando_destino → autorizada → realizada` (consulta: sem reserva e sem `em_transito`).

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Escuta inicial e consulta na UBS | — | 1 | R$ 0,00 | R$ 0,00 | **Nada**: a UBS não gera linha de BPA nem conta com valor (decisão D6; MAPA 3.7) |
| Consulta médica em atenção especializada (neurologia, no hospital) | 0301010072 | 1 | R$ 20,00 | não nasce | O hospital não abre ficha para a consulta regulada; só referência em `regulacao_solicitacoes.procedimento`. Nasceria em `episodios.atendimento_medico_id` se o hospital abrisse ficha ambulatorial |
| Teleinterconsulta — solicitante | 0804010056 | 1 | R$ 15,00 | não nasce | MAPA 3.7: telemedicina não gera valor; se o teste quiser ver o valor, o faturamento lança à mão por `registrar_procedimento` com o código na lista da unidade (não na UBS) |
| Teleinterconsulta — executante | 0804010064 | 1 | R$ 15,00 | não nasce | idem |

**Critérios de aceite:**
- `registrar_escuta_aps` pelo técnico é recusado; pela enfermeira grava a cor escolhida e a saída `consulta`.
- `regulacao_solicitar` tipo `consulta` sem `cbo` é recusado ("informe a especialidade pelo CBO"); com CBO válido grava `modalidade = '07'`, `carater = 'eletivo'`.
- A teleinterconsulta nasce `aberta` com documento clínico assinado pelo login do médico da UBS, não pode ser aceita por ele e pode ser cancelada antes do aceite.
- O aceite do destino para consulta não cria reserva (`reserva_id` nulo) e a chegada pode ser marcada de `autorizada` sem passar por `em_transito`.
- Nenhuma conta com valor nasce na UBS.

**Bordas a provar:**
- `regulacao_solicitar` com `carater 'eletivo'` e `prioridade 'emergencia'` é aceito (o CHECK não cruza os dois); o regulador corrige em `regulacao_priorizar` se quiser. Registrar como observação, não como falha.
- CID sem ponto (`G459`) é normalizado para `G45.9`.
- `regulacao_destino_aceitar` por `medico.ubs.f5` (origem) é recusado: responde pelo destino o plantonista ou o gestor do hospital.
- `cancelar_teleinterconsulta` depois do aceite seria recusado; não executável sem conta de telemedicina (lacuna).
- `solicitar_teleinterconsulta` com pergunta de 9 letras ou consentimento fora de `obtido, representante_legal, emergencia_sem_condicao` é recusado.

**Lacunas tocadas:**
- Lacuna (MAPA): sem conta de telemedicina na rede F5; aceitar e responder a teleinterconsulta ficam de fora. O testador confere `aberta`, o documento e o cancelamento (passos 8–11).
- Lacuna (MAPA): não há vídeo nem assinatura ICP-Brasil; tudo é escrito.
- Lacuna (MAPA): o mapa de vagas não agenda consulta e o status `agendada` não é gravado por nenhuma RPC; a data vive em `data_prevista` e na observação do aceite.
- Lacuna (MAPA): `conduta_aps` não grava "encaminhamento à UPA"; aqui o ramo escolhido é a regulação, e o envio à UPA seria `encaminhar_upa`.
- Lacuna (MAPA): nada de BPA, SISAB ou e-SUS APS para a UBS.

---

### B06 — SLA estourado (só alerta), cobrança do NIR e cancelamento pela origem

- **Objetivo:** provar que os prazos da central só avisam e nunca cancelam: pedido de leito clínico de um idoso internado na UPA estoura o prazo da fila, da pendência, da evolução (inclusive o limite "sem evolução") e do destino; os avisos chegam a quem deve (`notificacoes_plantonista`), o NIR cobra os responsáveis, o painel de SLA da origem mostra `destino_atrasado`, e o pedido só sai da fila quando a origem cancela. Status: `enviada → em_analise → pendencia → em_analise → aguardando_destino → cancelada`.
- **Rede e unidades:** UPA Fase 5 24h (PS e Internação), Central de Regulação Fase 5, Hospital Fase 5 (destino que não responde).
- **Papéis e contas de teste:** `recepcao.upa.f5`, `enfermeiro.upa.f5`, `medico.upa.f5`, `medico.internacao.f5`, `gestor.upa.f5` (gestor da UPA e da central), `regulador.f5`, `nir.f5`, `medico.hospital.f5` (não responde de propósito), `faturamento.f5`.
- **Paciente fictício:** Antônio Cardoso Peixoto, 79 anos, masculino, CNS fictício válido, insuficiência cardíaca conhecida. Falta de ar e febre há três dias.
- **Pré-condições:** check-in; **prazos curtos na central** (passo 0) para o teste caber numa sessão: `regulacao_definir_prazos(central, {fila: {emergencia: 1, urgencia: 5, prioritaria: 10, eletiva: 30}, evolucao_h: 1, pendencia_h: 1, sem_evolucao_h: 2, destino_h: 1})`; o cron `regulacao-sla-avisos` roda a cada 15 min na homologação (os painéis calculam o atraso na leitura, sem esperar o cron). Leito INT livre.

| # | Papel | Tela (rota) | Ação | Resultado esperado | Conferência (RPC, tabela ou auditoria) |
|---|---|---|---|---|---|
| 0 | gestor (central) | `/regulacao` (Criterios / prazos) | `regulacao_definir_prazos(central …-0009, dados acima)` | Prazos gravados com histórico | `regulacao_prazos`; `regulacao_prazos_historico` (antes/depois); auditoria `regulacao_prazos_ajustados`; `regulacao_prazos(central)` devolve os novos |
| 1 | recepção | `/recepcao` | `registrar_ficha(setor PS, "falta de ar e febre")` | Ficha e conta abertas | `episodios`; `contas` |
| 2 | enfermeiro | `/triagem` | Sinais crus: FC 104, PA 136x84, FR 28, SatO2 89%, Tax 38,2 °C; fluxograma "Queixas respiratórias"; `classificar_risco` | A enfermagem classifica; cor esperada no teste: laranja (escolha da enfermeira de teste) | `classificacoes_risco` |
| 3 | plantonista (PS) | `/atendimento` | `iniciar_atendimento`; `registrar_soap(…, p_cid = 'J18.9')` | Assumido | `episodios.atendimento_medico_id` |
| 4 | plantonista (PS) | `/plantonista/escores/curb-65`, `/plantonista/emergencias/pac-antibiotico-adulto`, `/plantonista/emergencias/insuficiencia-cardiaca-aguda-adulto`, `/plantonista/escores/news2` | Conforme `curb-65`, `adulto-pac-antibiotico`, `adulto-ic-aguda` (fonte: HC cap. 21; ESC 2021) e `news2` | Decisão do médico de teste: internar na UPA e pedir leito clínico | SOAP |
| 5 | plantonista (PS) | aba Prescrição → Desfecho | Peso referido 68 kg; `prescrever` conforme as ferramentas (sem dose aqui); `registrar_desfecho(p_episodio, 'internacao', relato, {leito_id: INT-01})` | Internado; conta de internação aberta | `internacoes.internado_em`; `contas` tipo `internacao` |
| 6 | plantonista (Internação) | caderno do leito | `registrar_admissao`; laudo de AIH com `procCod` escolhido por `buscar_sigtap('pneumonia')` | AIH `solicitada` | `aihs` |
| 7 | plantonista (Internação) | `/regulacao` | `regulacao_solicitar(UPA, paciente, {tipo 'leito', tipo_leito 'clinico', procedimento = o do laudo, cid 'J18.9', carater 'urgencia', prioridade 'urgencia', vulnerabilidades ['idoso'], internacao_id, quadro ≥ 20})` | Nº N `enviada` | `regulacao_solicitacoes`; evento `enviada` |
| 8 | (espera) | — | Ninguém assume por mais de 5 min (prazo da fila `urgencia`) | Status continua `enviada` | — |
| 9 | gestor (central) | `/regulacao` (SlaRegulacao) | `regulacao_sla_painel(central)` | Pedido N com fila atrasada | `private.regulacao_sla(s).fila` |
| 10 | regulador | `/notificacoes` ou sino | Depois do cron: aviso `reg_prazo_fila_N` ("passou do prazo da fila (5 min) sem decisão") | Aviso para todos os reguladores da central (ninguém assumiu) | `notificacoes_plantonista` (`tipo = 'reg_prazo_fila_N'`, `unidade_id` = central) |
| 11 | regulador | Fila | `regulacao_assumir(N)`; `regulacao_pendencia(N, 'Envie gasometria arterial e RX de tórax')` | `em_analise → pendencia` | evento `pendencia`; aviso `reg_pendencia` |
| 12 | (espera) | — | Origem não responde por mais de 1 h | Status continua `pendencia` | — |
| 13 | NIR | `/nir` | `nir_pendencias(UPA)` | Item `reg_pendencia` "pergunta da central sem resposta", responsáveis = solicitante e médico assistente, `pode_cobrar = true` | `nir_pendencias.itens`; `resumo.regulacao = 1` |
| 14 | NIR | `/nir` | `nir_cobrar(UPA, 'reg_pendencia', N)` | Aviso `reg_cobranca_N` ao médico da Internação; cobrança registrada | `notificacoes_plantonista`; `nir_cobrancas` (`destinatarios`, `por` = NIR); auditoria `nir_cobranca`; `ultima_cobranca.vezes = 1` |
| 15 | plantonista (Internação) | `/notificacoes` | Vê `reg_prazo_pendencia_N` (cron) e `reg_cobranca_N` (NIR) | Dois avisos distintos | `notificacoes_plantonista` |
| 16 | plantonista (Internação) | Detalhe | `regulacao_responder_pendencia(N, 'gasometria e RX anexados')`; `regulacao_anexar_documento` opcional | Volta a `em_analise` | evento `pendencia_respondida`; `regulacao_anexos` |
| 17 | (espera) | — | Mais de 1 h sem `regulacao_atualizar_evolucao` | Status inalterado | — |
| 18 | NIR | `/nir` | `nir_pendencias(UPA)` | Item `reg_evolucao` "evolução vencida"; após 2 h, "(risco de cancelamento)" | `private.regulacao_sla(s).evolucao.atrasada / risco_cancelamento` |
| 19 | plantonista (Internação) | `/notificacoes` | Avisos `reg_prazo_evolucao_N` e, depois de 2 h, `reg_prazo_72h_N` ("a central pode cancelar o pedido") | **Só aviso**: o status continua `em_analise`; `cancelamento_origem = 'prazo'` nunca é gravado | `regulacao_solicitacoes.status`; `notificacoes_plantonista` |
| 20 | plantonista (Internação) | Detalhe | `regulacao_atualizar_evolucao(N, 'melhora parcial, SatO2 93% em O2', sinais crus)` | Relógio da evolução zera; item `reg_evolucao` some do NIR | `regulacao_evolucoes`; aviso `reg_evolucao_N` ao regulador que assumiu |
| 21 | regulador | PainelDecisao | `regulacao_autorizar(N, 'rede', hospital …-0003, NULL, 'ambulancia_basica')` | `aguardando_destino` | evento `autorizada`; aviso `reg_destino` ao hospital |
| 22 | (espera) | — | O hospital não responde por mais de 1 h (`destino_h`) | Status continua `aguardando_destino` | — |
| 23 | gestor (UPA) | `/regulacao` (SlaRegulacao da origem) | `regulacao_sla_painel(UPA)` | `destino_atrasado = 1` | `regulacao_sla_painel.resumo` |
| 24 | plantonista do hospital | `/notificacoes` | Aviso `reg_prazo_destino_N` ("espera o aceite da unidade há mais de 1 h") para plantonistas e gestor do hospital; o regulador que assumiu recebe o seu | Dois destinatários distintos | `notificacoes_plantonista` (`unidade_id` = hospital e = central) |
| 25 | NIR | `/nir` | `nir_pendencias(UPA)` | O item `reg_destino` é do hospital; o NIR da UPA não o vê | Lacuna (MAPA): sem NIR no hospital F5 |
| 26 | plantonista (PS) | Detalhe | Tenta `regulacao_cancelar(N, 'paciente melhorou na UPA')` | **Recusado**: cancela quem solicitou ou o gestor da origem | mensagem da RPC |
| 27 | plantonista (Internação) | Detalhe | `regulacao_cancelar(N, 'Paciente melhorou; mantida a internação na UPA')` | `cancelada`; `cancelamento_origem = 'solicitante'`; sem reserva a liberar | evento `cancelada`; auditoria `regulacao_cancelada`; aviso `reg_cancelada` ao hospital (tinha destino) |
| 28 | gestor (central) | `/regulacao` (Indicadores) | `regulacao_indicadores`; `regulacao_sla_painel(central)` | Pedido fora das filas de atraso; tempos por status em `regulacao_status_tempos` | `regulacao_status_tempos` |
| 29 | gestor (central) | Criterios / prazos | `regulacao_definir_prazos(central, {})` para voltar aos padrões (12 h, 3 h, 72 h, 24 h; fila nula) | Padrões restaurados com histórico | `regulacao_prazos_historico` |
| 30 | plantonista (Internação) | alta | Dias depois: `dar_alta(p_internacao, 'alta_melhorada', 'J18.9', …)` | Alta; conta liberada | `internacoes.data_alta` |
| 31 | faturamento | `/faturamento/contas` | Fecha as duas contas; AIH decidida pelo regulador antes | Itens congelados | `contas.itens_congelados` |

**Regulação:** `enviada → em_analise → pendencia → em_analise → aguardando_destino → cancelada`. Nenhum prazo mudou o status; cada estouro gerou só aviso e item no NIR.

**Custos (EXEMPLO — valores fictícios, só para o teste; não são valores SIGTAP reais.)**

| Item | Código | Qtd | Valor unitário fictício | Total fictício | Onde nasce |
|---|---|---|---|---|---|
| Acolhimento com classificação de risco | 0301060118 | 1 | R$ 10,00 | R$ 10,00 | `classificacoes_risco`, passo 2 |
| Atendimento médico em unidade de pronto atendimento | 0301060096 | 1 | R$ 30,00 | R$ 30,00 | `episodios.atendimento_medico_id`, passo 3 |
| Administração de medicamentos na atenção especializada | 0301100012 | 1 por dia | R$ 5,00 | R$ 15,00 (3 dias) | `administracoes` `feito` no leito (1 por paciente/profissional/dia) |
| Procedimento principal da AIH (tratamento de pneumonia, código escolhido no laudo) | o do laudo | 1 | R$ 600,00 (SH + SP) | R$ 600,00 | `aihs` + laudo, passo 6; valor em `conta_detalhe` |
| Diária de leito INT por 3 dias | — | 3 | R$ 300,00 | não nasce | Lacuna (MAPA): sem diária de leito nem tempo de permanência com valor |
| Plantão do regulador (12 h, central) | — | 1 | R$ 1.200,00 | R$ 1.200,00 | `remuneracoes_plantao` da central → `plantao_versoes_erp` quando o gestor fecha o mês; não entra na conta do paciente |

**Critérios de aceite:**
- Cada estouro (fila, pendência, evolução, sem evolução, destino) aparece em `regulacao_sla_painel` na leitura e, depois do cron de 15 min, em `notificacoes_plantonista` com o tipo correto (`reg_prazo_fila_N`, `reg_prazo_pendencia_N`, `reg_prazo_evolucao_N`, `reg_prazo_72h_N`, `reg_prazo_destino_N`) e para os destinatários certos (origem: solicitante e médico assistente; central: quem assumiu ou todos os reguladores; destino: plantonistas e gestor).
- O status do pedido não muda por prazo; `cancelamento_origem` só recebe `solicitante` no passo 27.
- `nir_pendencias` lista `reg_pendencia` e `reg_evolucao` enquanto vencidos e os retira quando a origem responde ou evolui; `nir_cobrar` grava em `nir_cobrancas` e avisa só os responsáveis.
- `regulacao_definir_prazos` recusa valores fora das faixas (fila 1–43200 min; evolução 1–168 h; pendência 1–72 h; sem evolução 2–720 h e maior que a evolução; destino 1–168 h) e guarda antes/depois no histórico.
- `regulacao_cancelar` por quem não solicitou nem é gestor da origem é recusado; pelo solicitante, cancela e avisa o destino.

**Bordas a provar:**
- `regulacao_definir_prazos` com `sem_evolucao_h = 1` e `evolucao_h = 1` é recusado ("maior que o prazo da evolução").
- `regulacao_definir_prazos` por `regulador.f5` passa (regulador ou gestor da central); por `nir.f5` é recusado.
- `nir_cobrar` numa pendência que já foi respondida é recusado ("não está mais em aberto").
- `nir_pendencias` por `nir.f5` fora da janela da escala é recusado ("Fora do plantão: o NIR entra pela escala"); `gestor.upa.f5` passa sem escala.
- O aviso do cron usa `ON CONFLICT DO NOTHING` por dia: um segundo ciclo não duplica o aviso; a cobrança do NIR, ao contrário, reabre o aviso (`lida_em = NULL`).
- Cancelar depois de `em_transito` seria recusado (ver B04); aqui o cancelamento ocorre em `aguardando_destino` e é aceito.

**Lacunas tocadas:**
- Lacuna (MAPA): o SLA só alerta; `cancelamento_origem = 'prazo'` existe no CHECK sem nenhuma RPC que o grave. O testador prova o status inalterado depois de cada prazo.
- Lacuna (MAPA): sem NIR nem gestor no hospital F5; o item `reg_destino` do NIR do destino não é visível por conta nenhuma da rede F5 (passo 25); os avisos `reg_prazo_destino_N` ao hospital são conferidos na tabela.
- Lacuna (MAPA): sem conta de secretaria/regulação regional; `rede_contexto` e o painel `/rede` não são testados aqui.
- Lacuna (MAPA): sem diária de leito com valor.

---

## Cobertura dos 14 status da regulação

| Status (CHECK de `regulacao_solicitacoes`) | Onde é percorrido | Como |
|---|---|---|
| `enviada` | B01–B06 | `regulacao_solicitar`; também `regulacao_reenviar` (B02) e volta de pendência/recusa quando ninguém assumiu |
| `em_analise` | B01–B06 | `regulacao_assumir`; volta de `pendencia` respondida (B02, B06) e de recusa do destino (B02) quando assumido |
| `pendencia` | B02, B06 | `regulacao_pendencia` |
| `devolvida` | B02 | `regulacao_devolver` → `regulacao_reenviar` |
| `aguardando_destino` | B01–B06 | `regulacao_autorizar` (rede ou externo) |
| `autorizada` | B01, B02, B03, B04, B05 | `regulacao_destino_aceitar` (rede, com ou sem leito) ou `regulacao_registrar_resposta_externa` |
| `em_transito` | B01, B02, B03, B04 | `regulacao_marcar_saida` |
| `realizada` | B01, B02, B03, B05 | `regulacao_marcar_chegada(true)`; em B05 direto de `autorizada` |
| `falta` | B04 | `regulacao_marcar_chegada(false, obs ≥ 10)` com liberação da reserva |
| `negada` | B02 | `regulacao_negar` |
| `cancelada` | B06 | `regulacao_cancelar` pela origem (`cancelamento_origem = 'solicitante'`) |
| `rascunho` | — | Lacuna (MAPA): nenhuma RPC grava; o testador confere que `regulacao_solicitar` já nasce `enviada` |
| `agendada` | — | Lacuna (MAPA): nenhuma RPC grava; a data da consulta vive em `data_prevista` (B05) |
| `excluida` | — | Lacuna (MAPA): nenhuma RPC grava; o cancelamento é `cancelada` |
