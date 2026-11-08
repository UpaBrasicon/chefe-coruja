# Execução dos cenários D01 a D12 na homologação

Bloco D do catálogo (`CENARIOS-D-bordas-acessos.md`): escala, janela e check-in, raio, troca de plantão, segundo fator, evasão, óbito, modo sem conexão, virada de data, pedido de prontuário, unificação de cadastro e administrador. Teste de **fluxo** com dados fictícios. Nenhuma dose foi escrita de memória (a dose das prescrições é o texto "conforme protocolo — dado fictício de teste de fluxo"), toda cor de classificação é escolha da enfermeira de teste, e nada foi corrigido no produto.

## Data, hora e ambiente

- **Quando:** de 06/11/2026 23h40 a 07/11/2026 00h41, horário de Brasília (plantão da noite). A virada de data do D09 foi **real**: ficha e classificação às 23h40 de 06/11, o resto depois da meia-noite.
- **Ambiente:** homologação, Supabase `kswurfyxxvfydpjfrivy` (conferido em `supabase/.temp/project-ref`). A produção não foi tocada.
- **Como rodou:** `41_checkin_fase5.sql`, `49d_ambiente_bloco_d.sql` e cada cenário (`80` a `91`), preparados por `scripts/e2e/homolog/preparar.mjs` e executados com `npx supabase db query --linked -f`. Cada script roda numa transação só; cada passo roda **como a conta do papel** (role `authenticated` com as claims do JWT, RLS ligado), pelas RPCs das telas. O `47_framework_ampliacao.sql` não precisou rodar de novo (as contas F5 25 a 27 já estavam em `e2e.conta`).
- **Rede própria do bloco D (`49d`):** os outros quatro blocos usavam as contas F5 ao mesmo tempo. Para não mexer na escala, no 2FA nem na coordenada delas, o bloco D criou a organização "Rede E2E Bloco D", a unidade **"UPA Bloco D"** (`fd100000-…-0001`, sem CNES e sem coordenada) e 11 contas `*.d.f5@teste.local` (ids `fd200000-…`, que o `41` não pega). O hash de senha foi copiado de `medico.upa.f5` no banco; nenhuma senha aparece nos scripts. As funções do roteiro do bloco D têm prefixo `e2e.d_` e não redefinem nenhuma função compartilhada do esquema `e2e`.
- **Onde cada cenário rodou:**
  - na **UPA Bloco D**, só com contas do bloco D: D01, D02, D03, D04, D05, D11 e a parte "Lúcia" do D06 e o D08;
  - na **rede F5**, com contas F5 e pacientes novos do bloco D: D07 (precisa da Central de Regulação), D10, a parte "Jonas" do D06 (UBS F5 → UPA F5), a parte "Helena" do D09 e o D12 (`admin.f5`).
- **Tempo simulado:** o relógio não foi mexido. Dentro da transação, "o tempo passa" movendo o `inicio` do plantão das contas do bloco D (ajuste registrado como `ajuste`; no fim o início volta ao do turno). Os prazos de 24 h (pedido de prontuário, 2FA, sincronização) foram simulados movendo a data de registros do próprio bloco.
- **Chave mestra do 2FA:** `exigir_segundo_fator` está **desligada** na homologação. D04, D05 e D08 a ligam **dentro da própria transação** (nenhuma outra sessão vê a mudança, que não é confirmada) e a desligam antes do fim; a confirmação do TOTP é simulada com a linha que `verificar_codigo_2fa` grava (`private.segundo_fator_sessao_ok`), sempre numa conta do bloco D. Conferido depois de cada script: a chave terminou `false`.

## Resumo

Contagem das rodadas válidas (a última ocorrência de cada passo; as rodadas descartadas estão explicadas em cada cenário).

| Cenário | ok | falha | lacuna | ajuste | Onde |
|---|---|---|---|---|---|
| D01 Escala, janela, tolerância e check-in atrasado | 31 | 0 | 2 | 6 | UPA Bloco D |
| D02 Fim do plantão, 20 min e liberação | 25 | 2 | 2 | 11 | UPA Bloco D |
| D03 Raio e sem localização | 22 | 0 | 1 | 9 | UPA Bloco D |
| D04 Troca de plantão | 37 | 2 | 2 | 6 | UPA Bloco D |
| D05 Segundo fator | 27 | 0 | 6 | 6 | UPA Bloco D (+ leitura do `nir.f5`) |
| D06 Evasão na porta e na observação | 52 | 1 | 3 | 0 | UBS/UPA F5 e UPA Bloco D |
| D07 Óbito, SINAN e regulação em curso | 39 | 2 | 4 | 0 | UPA F5 e Central F5 |
| D08 Sem conexão | 31 | 3 | 7 | 4 | UPA Bloco D |
| D09 Virada de data | 29 | 0 | 4 | 0 | UPA F5 e UPA Bloco D |
| D10 Pedido de prontuário encerrado | 49 | 2 | 7 | 4 | UPA F5 e UBS F5 |
| D11 Unificação de cadastro | 48 | 2 | 1 | 0 | UPA Bloco D |
| D12 Administrador | 21 | 2 | 8 | 0 | rede F5 |
| **Total** | **411** | **16** | **47** | **46** | |

Das 16 falhas:
- **6 são do script**, todas com a conferência refeita logo depois (passos `…_refeito`, `…_manha`, `D08.09.uma_linha`): D04.05, D07.12, D08.08, D08.09, D11.08 e D11.14.
- **10 apontam produto ou catálogo**: são os achados abaixo.

Nenhum achado P0. **Um P1** (acesso a prontuário encerrado pela escala, sem prazo). Dois P2. O achado já previsto no catálogo, **"o óbito não cancela a regulação em curso"**, foi confirmado (D07.14).

## Resumo por cenário

### D01 — Acesso pela escala
- Rodada única (06/11 23h55), **31 ok**.
- A recepção sem plantão (vaga aberta na faixa) é recusada ao abrir ficha: "Acesso negado: você não está de plantão nesta porta".
- A enfermeira 10 min depois do início, sem check-in, entra pela tolerância (`situacao_checkin.liberado = true`, `pendente` preenchido).
- Aos 31 min, sem check-in, fica `bloqueado` e `chamar_paciente` é recusado. O check-in atrasado reabre na hora, sem o gestor, e a presença fica com 31 min de atraso.
- O gestor escala de novo a recepção; a mesma pessoa em outro setor no mesmo turno é recusada ("Conflito").
- O faturamento, sem escala, abre a conta com o item de classificação. O gestor, sem escala, lê as presenças.
- Bordas:
  - tolerância 121 recusada, 120 aceita;
  - com tolerância 0, 1 min depois do início sem check-in, fica bloqueada;
  - com 30, libera.
- O check-in 20 min antes do início é recusado ("não há janela antes", lacuna do MAPA).

### D02 — Fim do plantão
- **Rodada válida:** a 3ª (07/11 00h04), **25 ok, 2 falhas** (achados).
- **Rodadas descartadas:**
  - a 1ª, porque o ajuste que "vence" a liberação feriu a constraint `liberacao_pos_plantao_janela`;
  - a 2ª, porque uma liberação de 10 min da rodada 1 ainda estava ativa e reabriu a porta.
  
  As duas deixaram as fichas "Teste Escrita D02 1" e "… 2" abertas na UPA Bloco D. O script agora vence as liberações ativas antes e depois.
- **Com check-in:**
  - 10 min depois do fim grava o SOAP (`tolerancia_fim_plantao` = 20 min);
  - aos 21 min `meu_plantao_agora` fica vazio e a alta é recusada;
  - o gestor libera 30 min (motivo, autor, `expira_em` e auditoria conferidos), e a alta entra;
  - vencida a liberação, a porta fecha de novo e a escrita é recusada.
- Liberar 4 min, 121 min ou com motivo curto: as três recusadas, sem linha nova.
- **Falha D02.09:** liberar 13 h depois do fim **é aceito** pela RPC (o catálogo esperava recusa). A porta não reabre, porque o limite de 12 h está em `plantoes_agora`. Achado P3-1.
- **Falha D02.B1:** depois do **check-out**, a porta segue aberta, no plantão e nos 20 min depois do fim. Achado P2-1.

### D03 — Raio e sem localização
- Rodada única (00h02), **22 ok**.
- Coordenada fictícia posta na UPA Bloco D e **retirada no fim do mesmo script**. Conferido: nenhuma unidade F5 nem do bloco D ficou com coordenada.
- Recusas e mensagens:
  - a 2 km: `CHECKIN_FORA_DO_RAIO` ("você está a 2002 m … o raio é de 500 m");
  - justificativa de 5 letras: `CHECKIN_JUSTIFICATIVA_CURTA`;
  - sem posição: `CHECKIN_SEM_LOCALIZACAO`.
- Com justificativa ≥ 10, entra:
  - fora do raio: `checkin_dentro = false`, 2002 m e a justificativa, que o gestor vê;
  - sem localização: `checkin_dentro` nulo e a justificativa.
- O raio não bloqueia a porta.
- Bordas:
  - a 489 m: dentro;
  - com o raio em 1000 m, a mensagem mostra 1000 m;
  - a telemedicina entra a 2 km, sem cerca e marcada "Telemedicina (remoto)";
  - na unidade sem coordenada, qualquer posição passa sem marca.

### D04 — Troca de plantão
- **Rodada válida:** a 2ª (00h08), **37 ok, 2 falhas**.
- **Rodada 1 descartada:** a segunda troca usou o mesmo par de plantões e bateu na unique `trocas_plantao_plantao_a_id_plantao_b_id_key` (achado P2-2), e houve uma consulta a função de conjunto mal escrita.
- O fluxo:
  - pedido de A, com aviso no sino de B;
  - o gestor tenta aprovar antes do aceite: recusado;
  - B aceita: `aceito_em` gravado, A e o gestor avisados, e a troca sai de `pedidos_para_mim`;
  - o gestor aprova: os plantões de amanhã trocam de dono, os dois são avisados e o histórico fica `troca_aprovada`;
  - na segunda troca, B recusa e A é avisado;
  - na terceira, A cancela;
  - o `UPDATE` direto em `trocas_plantao` é recusado (`permission denied`).
- **Gestor parte do pedido:**
  - sem o 2º fator: `SEGUNDO_FATOR`;
  - com o 2º fator: aprova, com `aprovou_proprio_pedido` no histórico e na auditoria.
- Bordas:
  - unidade sem exigência de aprovação: o aceite devolve `aplicada`;
  - troca que deixaria A em dois setores na mesma manhã: recusada pela escala.
- **Falha D04.05** (script): o filtro não separou o turno. A conferência refeita, `D04.05.escala_de_a_manha`, deu ok: na manhã de amanhã, A está na Internação D.
- **Falha D04.07:** depois de cancelar, A **não consegue pedir de novo a mesma troca** (unique do par). Achado P2-2.
- A porta no dia trocado (passo 10) só se confere amanhã, às 07h.

### D05 — Segundo fator
- Rodada única (00h14), **27 ok**.
- O portão (`portao_requisicao`, chamado com `request.path` simulado):
  - recusa `POST /rpc/fila_validacao` sem o código;
  - deixa passar a lista (`segundo_fator_status`, `herdar_segundo_fator`, `usar_codigo_recuperacao`, `horario_servidor`), `GET` de tabela e o papel `anon`;
  - a RPC também confere por dentro (`equipe_segundo_fator` recusa o gestor sem código).
- Com a sessão confirmada, o portão abre.
- **Herança:** a sessão nova do desbloqueio herda com o **mesmo** `verificado_em`. Login novo não herda, e a sessão de outra pessoa também não.
- Com 24 h e 1 min, o portão fecha de novo.
- A policy RESTRICTIVE `storage_segundo_fator` existe.
- **Códigos de recuperação:**
  - 10 gerados (os códigos nunca foram gravados nem mostrados);
  - um usado ("restam 9");
  - 5 erros bloqueiam por 15 min;
  - eventos gravados.
- **Zerar:**
  - o gestor vê a equipe (9 códigos, sem segredo);
  - motivo curto e zerar a si mesmo: recusados;
  - zerar a farmacêutica do bloco D apaga sessões e códigos, com evento `zerado` (autor e motivo) e a auditoria `segundo_fator_zerado`;
  - a próxima ação dela é recusada pelo portão.
- O `nir.f5` sem código é recusado pelo portão (só leitura, nada gravado na conta).

### D06 — Evasão
- Rodada 1 (00h18) e complemento (00h20): **52 ok, 1 falha**.
- **Jonas:**
  - escuta amarela na UBS F5 e envio pela enfermeira;
  - "Chegou" na UPA F5 e classificação verde;
  - evasão pelo médico sem SOAP e sem assumir (relato < 15 recusado; motivo `demora`; momento calculado `aguardando_medico`);
  - a contrarreferência chega à UBS e vai de `a_ver` a `visto`;
  - a conta tem só o acolhimento e foi fechada.
- **Lúcia (UPA Bloco D):**
  - classificação, peso referido, SOAP e ondansetrona "Agora", com a dose = texto de teste;
  - observação no box OBD- (uma conta só, a da porta);
  - checagem `feito` pelo enfermeiro da Observação D;
  - evasão da observação: `dar_alta('alta_evasao')`, com observação < 15 recusada;
  - o indicador mostra 1 evasão `observacao` na UPA Bloco D e 1 `aguardando_medico` na UPA F5 (a recepção não lê o indicador);
  - a conta não fechava porque a UPA Bloco D não tem CNES (pendência bloqueante, como deve). O gestor liberou o fechamento com motivo, e ela fechou.
- **Falha D06.B1:** o médico registrar "evasão antes da triagem" pelo desfecho é recusado ("O episódio não está em atendimento"). O caminho do produto é `retirar_da_fila('evasao')`, que deu ok, e a conta ficou sem itens. Catálogo, P3-3.

### D07 — Óbito
- Rodada única (00h24), **39 ok, 2 falhas** (uma do script, refeita).
- Benedita:
  - ficha, classificação laranja e peso estimado;
  - SOAP G03.9, exame urgente e dipirona;
  - agravo marcado pelo médico.
- **Regulação** nº 111 `em_analise` pelo regulador F5 (nenhum leito reservado).
- **SINAN:**
  - `abrir_notificacao` devolve a mesma suspeita (não duplica);
  - sem os campos 7 e 12, recusa listando "Campo 7: data dos primeiros sintomas. Campo 12: gestante…";
  - completa, fica `notificado` com o nº 2026110700 e o notificador = enfermeira.
- **Óbito:**
  - sem DO, hora +5 min e DO de 4 dígitos: as três recusadas;
  - o válido (DO "123.456.789", CID "g03.9") foi gravado com CID normalizado `G03.9`, DO só dígitos e setor do óbito tirado da ficha;
  - o exame foi cancelado com "Óbito: exame cancelado sem resultado.";
  - o sumário de óbito é documento `sumario_obito`, nº 2026/000017, autor = médico (`D07.12.documento_refeito`).
- **D07.14 (achado previsto):** depois do óbito, a regulação **continua `em_analise`**. O regulador negou com `ja_atendido_obito` (3 eventos), e ela saiu das pendências do NIR.
- A conta fechou com 3 itens congelados. O gestor lê a notificação do período. No painel do admin, os óbitos da UPA F5 saem suprimidos.
- **Falha D07.15:** antes da decisão, a regulação **não aparece** em `nir_pendencias` da origem; só surge depois do prazo. É o mesmo ponto do A01 (P3-2 de lá): catálogo, P3-4.

### D08 — Sem conexão
- **Rodada válida:** a 2ª (00h31), **31 ok, 3 falhas** (duas do script ou de repetição, uma de catálogo).
- **Rodada 1 descartada:** a evolução de enfermagem foi recusada como documento. Como cada passo é uma subtransação, a falha da conferência desfez o envio. O reenvio "de outra pessoa" acabou gravando o sinal em nome da médica, um **artefato do teste e não do produto**: a rodada 2, com envios separados, mostrou `SYNC_ID_EM_USO`.
- Na rodada 1, contingência e reentrada deram ok (`D08.08.contingencia` e `.reentrada`). Na rodada 2, a contingência bateu na da rodada 1, no mesmo período.
- O que a rodada 2 mostrou:
  - `chave_fila()` é recusada sem o 2º fator e, com ele, entrega a chave (44 caracteres em base64; o valor não foi registrado), uma linha por perfil;
  - sinal vital (enfermeiro) e folha provisória "atestado" (médica) feitos sem conexão foram `gravado` com autor e **hora do fato**, `sem_conexao = true`, e a folha ganhou número;
  - o reenvio volta `ja_recebido` com uma linha só (`D08.09.uma_linha`);
  - o mesmo id por outra pessoa: `SYNC_ID_EM_USO`.
- Recusas do servidor:
  - tipo `checagem`: `SYNC_TIPO`;
  - 2 h e 10 min sem contato: `SYNC_LIMITE`;
  - hora no futuro: `SYNC_HORA_FUTURA`;
  - enfermeira da porta sem plantão no setor do paciente: `SYNC_FORA_DO_PLANTAO`.
- **Registros de 25 h:**
  - vão para `sincronizacao_revisao` (`em_revisao`) e não entram no prontuário;
  - o enfermeiro não decide;
  - o gestor aceita o sinal (entra com a hora do fato) e descarta a folha com motivo;
  - o gestor não troca a chave da fila ("só o administrador").
- **Falha D08.03:** a evolução de enfermagem **não entra na fila** (o servidor só aceita os tipos de folha da porta: atestado, receita…). Na tela, a evolução de enfermagem também é só online (`registrar_evolucao`). Catálogo/produto, P3-5.

### D09 — Virada de data
- Fase "antes" às 23h40 de 06/11 e fase "depois" e complemento às 00h00–00h02 de 07/11: **29 ok**.
- A 1ª execução da fase "depois" teve 4 falhas, todas do script ou do fluxo:
  - função de conjunto mal escrita;
  - `painel_observacao` lido como uma linha só;
  - alta barrada pelo **exame sem resultado** (impeditivo correto, que virou o passo `D09.08.alta_com_exame_pendente`).
- **Dentro do plantão:**
  - às 00h00, o médico segue no plantão da noite que começou às 19h de 06/11, sem logout;
  - reavaliação para +25 h recusada; para +30 min, gravada em 07/11.
- **Observação:**
  - box **OA-04** em 07/11, com pendência de 6 h vencendo em 07/11;
  - o médico da observação vê Helena no painel;
  - resultado do exame (texto fictício) e alta.
- **Datas:** chegada e classificação em **06/11 23h40**; encerramento em **07/11 00h02**.
- **Check-in à 00h00 (conta do bloco D):** a presença fica com a data do turno = **06/11**, sem duplicar.
- **Funções de data por parâmetro:**
  - `data_do_turno`: 00h45 e 06h59 caem no dia anterior; 03h de 01/01/2027 cai em 31/12; a madrugada de 01/03/2028 cai em 29/02; 01/12 05h30 UTC cai em 30/11;
  - `competencia_de`: 30/11 23h50 → 202611; 01/12 00h05 → 202612; 01/12 02h50 UTC → 202611 (Brasília, não UTC); 01/01 → 202701;
  - noite de 31/12: começa 19h e dura 720 min;
  - sem horário de verão.
- Fechar a competência do mês seguinte: recusado. Fim de mês e fim de ano na tela: lacuna (data real).
- No fim, o OA-04 foi devolvido a `livre` (`concluir_higienizacao`, passo `D09.99.higienizacao`).

### D10 — Pedido de prontuário encerrado
- Rodada 1 (00h34) e complemento (00h36): **49 ok, 2 falhas** (P1).
- Rosa teve 2 atendimentos na UPA F5 e 1 na UBS F5, levados **3 dias para trás** no complemento (pré-condição do catálogo).
- **Pedido da médica da Internação:**
  - a busca exige nome + nascimento (com só o nome, recusa; a primeira tentativa usou só o nome);
  - pedido pendente; repetir é recusado;
  - abrir antes da decisão é recusado;
  - motivo de 8 letras é recusado.
- **Aprovação:**
  - o gestor vê e aprova: `valido_ate` = decidido + 24 h (07/11 00h34 → 08/11 00h34);
  - a médica abre, e `log_acesso_prontuario` registra;
  - vencido, abrir é recusado e `meus_pedidos_acesso.vigente = false`.
- O gestor não pede. O gestor não decide o próprio pedido (pedido gravado no banco em nome de `gestor.d.f5`, depois cancelado). O gestor lê direto, com log. O farmacêutico não pede.
- **Histórico encerrado:**
  - quem cuida agora vê o resumo dos 2 encerrados da UPA, sem o da UBS;
  - abre o detalhe com motivo por 12 h, gravado em `acessos_historico`;
  - motivo de 6 letras é recusado;
  - quem não cuida é recusado.
- Novo pedido cancelado pela própria médica.
- **Falhas D10.08 e D10.11:**
  - o técnico da UBS **não consegue pedir** ("Você já tem acesso a este paciente pela escala");
  - o farmacêutico **abre** o prontuário de Rosa;
  - os dois, com todos os atendimentos encerrados há 3 dias.
  
  Achado P1-1.

### D11 — Unificação
- Rodada única (00h38), **48 ok, 2 falhas** (do script, refeitas).
- O 2º cadastro com mesmo nome e nascimento é avisado (`FICHA_DUPLICATA_PROVAVEL`) e só abre como "outra pessoa".
- **Pedido e recusas de segurança:**
  - o par aparece nos candidatos e a recepção pede;
  - a recepção não decide;
  - recusas: "O cadastro absorvido tem alergia ativa que não está no principal (Dipirona)" e "Os dois cadastros têm atendimento aberto".
- **Depois da aprovação:**
  - a busca só oferece A;
  - o histórico de A traz os encerrados de A e B, e `cadastros_do_paciente` lista os dois;
  - a trava de alergia barra dipirona em A ("ALERGIA: … Dipirona");
  - o pedido de acesso a B (médica da Observação D) vale para A e B;
  - desfazer separa de novo (B ativo, família só A).
- Pedido cancelado pela recepção. O gestor pede, mas não aprova o próprio ("Quem pediu não aprova o próprio pedido").

### D12 — Administrador
- Rodada única (00h40), **21 ok, 2 falhas** (catálogo).
- **Painel do admin:**
  - `painel_organizacao(30)` só com contagens, sem coluna de paciente;
  - nenhuma contagem de 1 a 4: óbitos e evasões da UPA F5 suprimidos (`suprimir`: 0 → 0, 1 a 4 → nulo, 5 → 5);
  - profissionais em expediente sem supressão (UPA F5 = 13);
  - `p_dias` 0 = 1 e 400 = 365.
- **O admin não abre:** prontuário, ficha, classificação e a porta (`porta_agora`).
- **Unidade:** o admin criou "UBS Teste Admin D12" e a **desativou** no mesmo script (`unidade_criada` e `unidade_editada` na auditoria).
- **Recusas com contas do bloco D:** trocar a chave da fila e zerar o 2FA de quem não está nas unidades dele.
- O gestor vê a porta com nomes.
- **Papéis de rede** (secretaria, regulação regional, faturamento da rede) leem contexto, faturamento e mapa de vagas sem nomes de paciente.
- **Falhas:**
  - `api_criar_chave` é "só a administração da plataforma" (super admin);
  - o admin **não lê** `escala_mes_gestor`.
  
  O catálogo e o MAPA dizem o contrário: P3-6 e P3-7.

## Achados

Cada achado diz se é **produto**, **ambiente** ou **catálogo** (especificação ou MAPA).

### P1-1 — Acesso a prontuário encerrado "pela escala", sem prazo e para todo papel (produto)
- **Reproduzir (D10):**
  1. Paciente com todos os atendimentos encerrados há 3 dias, último setor = Pronto Socorro da UPA F5.
  2. Como `farmaceutico.f5` (escalado no PS da F5), `abrir_prontuario(paciente)` **passa** e grava leitura em `log_acesso_prontuario`.
  3. Como `tecnico.ubs.f5`, `pedir_acesso_prontuario(cadastro da UBS)` é recusado com "Você já tem acesso a este paciente pela escala".
- **Esperado (catálogo e MAPA 2.8):**
  - encerrado se lê com pedido aprovado (24 h), pelo gestor ou por quem cuida agora;
  - o farmacêutico não lê nem pede (migration `20270105000001`).
- **Causa:** `private.pode_atuar_no_paciente` → `paciente_no_meu_plantao` → `paciente_em_cuidado_no_plantao` aceita `pacientes.setor_id IN setores_na_escala_agora()`. O `setor_id` do cadastro **continua** no último setor depois do encerramento. Quem está escalado naquele setor "pode atuar" em todo paciente que já passou por ali, sem limite de tempo e sem olhar o papel. A janela de 24 h do mesmo `paciente_no_meu_plantao` fica sem efeito.
- **Evidência:** `D10.11.causa` = `pode_atuar_no_paciente = true; setor do cadastro = Pronto Socorro; episódios abertos = 0; último encerramento = 04/11 00:34`. `D10.08.causa` = `pode_atuar_no_paciente = true; episódios abertos = 0`.
- **Efeito:** o pedido de prontuário só vale para quem é de **outro** setor. Na UBS (um consultório só), todo escalado lê todo cadastro. A mesma função alimenta RLS de leitura (por exemplo `observacao_select`). É acesso a dado clínico mais largo que o desenhado. Fica registrado em `log_acesso_prontuario`, mas sem motivo nem aprovação.

### P2-1 — O check-out não fecha a porta (produto)
- **Reproduzir (D02.B1, UPA Bloco D):**
  1. Plantonista com check-in faz `registrar_checkout` 30 min antes do fim.
  2. 5 min depois do fim, `meu_plantao_agora` ainda mostra o plantão.
  3. Ainda dentro do horário, a porta segue aberta.
- **Esperado (catálogo):** o check-out fecha antes dos 20 min de tolerância.
- **Causa:** `private.plantoes_agora` e `private.checkin_do_plantao` olham só `checkin_em`, nunca `checkout_em`.
- **Evidência:**
  - `D02.B1.checkout_fecha`: "meu_plantao_agora: noite Pronto Socorro D";
  - `D02.B1.checkout_em_curso`: "porta ABERTA depois do check-out".

### P2-2 — Uma troca cancelada ou recusada não pode ser pedida de novo (produto)
- **Reproduzir (D04.07):**
  1. A pede a troca (plantão X ↔ Y).
  2. A cancela.
  3. A pede de novo X ↔ Y.
- **Obtido:** `23505: duplicate key value violates unique constraint "trocas_plantao_plantao_a_id_plantao_b_id_key"`, sem mensagem amigável. A unique é do par, em qualquer status.
- **Efeito:** depois de uma recusa ou de um cancelamento, aquela troca nunca mais pode ser pedida (nem o par invertido, se já tiver sido usado).

### P3 — catálogo, MAPA e pontos menores
- **P3-1 (catálogo, D02.09):** `liberar_pos_plantao` não confere as 12 h; grava a liberação mesmo 13 h depois do fim. A porta não reabre, porque o limite está em `plantoes_agora`. O gestor recebe "ok" de uma liberação que não tem efeito.
- **P3-2 (catálogo/código, D02.03):** a divergência "15 vs 20 min" do MAPA está superada no código (`regras.ts` usa a tolerância do servidor, 20 min). Só o comentário de `usePlantao.ts` (l. 40) ainda diz 15 min.
- **P3-3 (catálogo, D06.B1):** a evasão antes da triagem não passa por `registrar_desfecho` (exige o episódio em atendimento). O caminho é `retirar_da_fila(…, 'evasao', justificativa ≥ 15)`, por quem está escalado na porta. A conta fica sem itens.
- **P3-4 (catálogo, D07.15):** a regulação da origem não aparece em `nir_pendencias` antes do prazo. É o mesmo ponto do P3-2 do A01.
- **P3-5 (catálogo/produto, D08.03):** a evolução de enfermagem não entra na fila sem conexão. `sincronizar_registros` aceita como `documento` só os tipos de folha (`gravar_documento_episodio`: atestado, receita, encaminhamento, pedido de exames, boletim, sumários, evolução médica…). Na tela, `AbasRegistro` grava a evolução de enfermagem online (`registrar_evolucao`). Os sinais vitais entram na fila.
- **P3-6 (catálogo, D12.06):** `api_criar_chave` é só do super admin ("Só a administração da plataforma cria chave de integração"). O admin da organização não cria.
- **P3-7 (catálogo, D12.07):** o admin não lê `escala_mes_gestor` ("escala do gestor da unidade").
- **P3-8 (catálogo, D10.01):** `buscar_paciente_para_pedido` exige documento exato ou nome com nascimento; só "Rosa" é recusado.
- **P3-9 (produto, D11.11):** no histórico encerrado, o episódio fechado por `retirar_da_fila` aparece com "medico: Recepção Bloco D" (quem retirou da fila).
- **P3-10 (produto/dados, D06/D07):** como no A01 (P3-5 de lá), o acolhimento com classificação (`0301060118`) sai com valor nulo, e não R$ 0,00.
- **P3-11 (catálogo, D09):** o catálogo pede que a pendência de reavaliação e o desfecho atravessem a noite com horários fixos (00h10, 06h50). A rodada real fez tudo entre 23h40 e 00h02; os prazos ficaram conferidos pelas datas (D+1), não pelas horas do catálogo.

## Custos que o sistema registrou (evasão e óbito)

Nada foi digitado: tudo vem do SIGTAP carregado (competência 202609). Os valores fictícios do catálogo (R$ 6, 11, 2) não foram gravados.

| Conta | Paciente | SIGTAP | Item | Qtd | Unitário | Total |
|---|---|---|---|---|---|---|
| A-2026.000030 (UPA F5), **fechada** | Jonas (evasão na porta) | 0301060118 | Acolhimento com classificação de risco | 1 | nulo | nulo |
| | | — | Consulta médica: **não nasceu** (o médico não assumiu) | — | — | — |
| | | | **Total de referência** | | | **R$ 0,00** (item nulo) |
| A-2026.000007 (UPA Bloco D), **fechada** com liberação do gestor (sem CNES) | Lúcia (evasão da observação) | 0301060096 | Atendimento médico em UPA | 1 | R$ 11,00 | R$ 11,00 |
| | | 0301060118 | Acolhimento com classificação de risco | 1 | nulo | nulo |
| | | 0301100012 | Administração de medicamentos | 1 | R$ 0,63 | R$ 0,63 |
| | | — | Ondansetrona injetável (dispensado 0, administrado 1): **sem valor** | | | — |
| | | — | Conta de observação separada: **não existe** (uma conta só, a da porta) | | | |
| | | | **Total de referência** | | | **R$ 11,63** |
| A-2026.000031 (UPA F5), **fechada** | Benedita (óbito) | 0301060096 | Atendimento médico em UPA | 1 | R$ 11,00 | R$ 11,00 |
| | | 0301060118 | Acolhimento com classificação de risco | 1 | nulo | nulo |
| | | 0301100012 | Administração de medicamentos | 1 | R$ 0,63 | R$ 0,63 |
| | | — | Dipirona injetável: **sem valor**; exame (líquor) **cancelado pelo óbito**, sem valor; regulação, notificação e sumário de óbito: nada | | | — |
| | | | **Total de referência** | | | **R$ 11,63** |

## O que só se confere na tela (fica para o Chrome)
- **D01:**
  - a casca "fora da escala";
  - o aviso de check-in pendente do `GateCheckIn`;
  - a marca de atraso em `PresencasDoDia` (a RPC devolve `checkin_em`, sem o início do plantão).
- **D02:** a casca relendo `situacao_checkin` a cada 60 s; o cron `checkout-automatico` (conferir de manhã `presenca_plantonista.checkout_automatico`).
- **D03:** a posição simulada no DevTools; a diferença visual "fora do raio" × "sem localização"; o formulário de coordenada em `Configuracao.tsx`.
- **D04:** a porta pela escala nova no dia trocado (08/11, a partir das 07h); a passagem de plantão (não exercitada).
- **D05:**
  - digitar o TOTP e o código por e-mail;
  - o dispositivo confiável (29/31 dias);
  - o download recusado no Storage;
  - o cadastro novo do autenticador depois do zerar;
  - o NIR confirmando o código.
- **D06:** as chamadas sem resposta no painel (`/recepcao/fila-medica`); `cancelar_alta` da evasão.
- **D07:** os campos da `FichaSinan`; o sumário de óbito impresso; o óbito com a notificação ainda `a_registrar` e o óbito de internado (não exercitados).
- **D08:**
  - fila IndexedDB cifrada;
  - recarga sem rede;
  - outra aba sem a chave;
  - relógio do aparelho;
  - mensagens de recusa de prescrição, checagem e desfecho sem rede;
  - fim do plantão + 20 min no aparelho;
  - a troca da chave pelo admin.
- **D09:** fim de mês e fim de ano (só na data real); avisos às 00h05 de 1º/01; validade da APAC que cruza o ano.
- **D10:** a tela só de leitura do prontuário; a rota `/prontuarios` fora do menu do farmacêutico; o pedido pela telemedicina.
- **D11:** as bordas de acento, CPF igual, dois absorvidos e SINAN com dados do principal (não exercitadas).
- **D12:**
  - `RequireRole` das rotas clínicas;
  - o segredo da chave aparecendo uma vez (e a criação pelo super admin);
  - publicar escala (não tentado: mexeria na escala F5);
  - `rede_baixar_arquivo`.

## O que ficou gravado na homologação

Esperado, com dados fictícios e nomes de teste.

**Ambiente do bloco D (`49d`):**
- organização "Rede E2E Bloco D";
- "UPA Bloco D", com 3 setores, 6 leitos e 2 salas;
- 11 contas `*.d.f5@teste.local`, com vínculos.
- Depois, no D04, `gestor.d.f5` ganhou também o papel plantonista na UPA Bloco D (para a troca do próprio gestor).

**Escala:**
- plantões das contas do bloco D:
  - noite de 06/11;
  - manhã, tarde e noite de 08/11 e 09/11 (trocas do D04);
  - manhã e tarde de 10/11;
  - noite de 05/11 do enfermeiro da Observação D (retroativo, D08).
- presenças, liberações pós-plantão (todas vencidas no fim) e trocas;
- 1 vaga aberta de recepção.

**2FA (só contas do bloco D):** sessões simuladas em `segundo_fator_sessao_ok`, eventos e auditoria do zerar da `farmaceutico.d.f5`, chave da fila do `enfermeiro.obs.d.f5`.

**Pacientes e atendimentos:**
- **UPA Bloco D:**
  - Ana (D01), classificada e ainda aberta, sem médico;
  - Carlos, Carlos B e Carlos C (D02);
  - "Teste Escrita D02 1" e "2", **fichas abertas** (rodadas descartadas do D02);
  - Lúcia e "Teste Evasão Antes Triagem D06" (D06);
  - Pedro e Pedro B (D08), com alta;
  - Maria A e B (D11).
- **UPA F5 e UBS F5:**
  - Helena (D09), Jonas (D06), Benedita (D07) e Rosa (D10), todos encerrados;
  - os atendimentos de Rosa foram levados 3 dias para trás.

**Contas fechadas:** A-2026.000030, A-2026.000031 e A-2026.000007. As demais contas do bloco D seguem abertas.

**Na rede F5:**
- **Regulação:** nº 111, negada (`ja_atendido_obito`), com avisos à central e à origem.
- **SINAN:** agravo de Benedita `notificado`, nº 2026110700.
- **Pedidos de prontuário:** aprovado e vencido (médica da Internação) e cancelado (o 2º).
- **Unidade:** "UBS Teste Admin D12 (desativada)" na organização F5, **inativa**.
- **Indicador de evasão da UPA F5:** passa a contar Jonas.

**Esquema `e2e`:**
- funções `e2e.d_*`, `e2e.d01_*` … `e2e.d10_*`, `e2e.d_portao`;
- variáveis `d0N_*` em `e2e.vars`;
- os resultados em `e2e.resultados` (passos `D01.*` a `D12.*`).

**De forma inesperada, ou que pode ter afetado os outros blocos:**
- **Box OA-04 da UPA F5 (D09):** Helena ocupou o **OA-04** das 00h00m37s às 00h02. Às 00h00m59s, o paciente do bloco B "Severino Tavares da Luz (teste B01) B" foi para a observação **sem box**: OA-01 estava com a gestante do A01, OA-02 e OA-03 em higienização ou ocupados, e OA-04 com Helena. O D09 não pediu box específico; `registrar_desfecho('observacao')` pega o primeiro livre. Depois da alta de Helena, o OA-04 ficou em higienização e foi **devolvido a `livre`** pelo próprio bloco D (`D09.99.higienizacao`, `concluir_higienizacao` pela `enfermeiro.observacao.f5`). OA-02 e OA-03 seguem em higienização, de outros blocos.
- **Contas F5:** nenhuma escala, presença manual, 2FA ou coordenada de conta F5 foi alterada. O `41_checkin_fase5.sql` foi rodado como pedido (ele faz check-in das contas F5 do turno em curso, `ON CONFLICT DO NOTHING`). Na `nir.f5` houve só uma leitura recusada pelo portão simulado.
- **Chave `exigir_segundo_fator`:** ligada só dentro das transações dos D04, D05 e D08; terminou `false` (conferido três vezes).

Nada foi corrigido no produto: nenhuma migration, nenhuma função de produto alterada.

## Tabela dos passos (rodadas válidas)

Última ocorrência de cada passo:
- **D02:** só a rodada 3;
- **D04:** só a rodada 2;
- **D08:** só a rodada 2;
- **D06, D07, D09, D10 e D11:** a rodada e o complemento (os passos refeitos substituem os da primeira tentativa, que estão em `e2e.resultados`).

"banco" é conferência como postgres, de algo que a tela não mostra.

#### Passos do D01

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D01.00.tolerancia | d_ges | Gestor deixa a tolerância do check-in no padrão (30 min) | ok | {"alvos_grade": {"exame": null, "medicacao": null, "permanencia": null}, "alvos_medico": {"azul": 240, "verde": 120, "amarelo": 60, "laranja": 10, "vermelho": 0}, "ocupa… | ok |
| D01.00.bpa_classificacao | d_fat | Faturamento associa o SIGTAP 0301060118 ao uso classificacao na UPA Bloco D | ok | 9a15cdc6-750e-4118-bc8b-1260b4969c75 | ok |
| D01.01.enf_escala | d_ges | Gestor escala d_enf (enfermeiro) no turno em curso, noite de 2026-11-06 | ok | 41ca2deb-531e-4428-868e-69f1f74b8ef6 | ok |
| D01.01.enf_inicio_10 |  | Início do plantão (d01_pl_enf) levado para agora − 10 min (simula o tempo passado) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => 10) WHERE id = '41ca2deb-531e-4428-868e-69f1f74b8ef6' AND perfil_id::text LIKE 'fd200000%' | ajuste |
| D01.01.vaga_recepcao | d_ges | Gestor abre vaga de recepção no turno em curso: a recepção fica sem plantão agora | ok | 03fb42bb-04ca-4a30-9350-b73d90b47a76 | ok |
| D01.02.rec_situacao | d_rec | Recepção sem plantão agora: fora da janela, não liberada | ok | ok: {"liberado": false, "pendente": null, "servidor": "2026-11-07T02:55:24.13242+00:00", "bloqueado": false, "na_janela": false, "tolerancia_min": 30} | ok |
| D01.02.rec_ficha_recusada | d_rec | Recepção fora da escala tenta abrir a ficha (deve ser recusado) | erro:Acesso negado: você não está de plantão | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| D01.03.enf_tolerancia | d_enf | Enfermeira 10 min depois do início, sem check-in: liberada pela tolerância e avisada do check-in pendente | ok | ok: {"liberado": true, "pendente": {"fim": "2026-11-07T14:45:24.13242+00:00", "prazo": "2026-11-07T03:15:24.13242+00:00", "turno": "noite", "inicio": "2026-11-07T02:45:2… | ok |
| D01.03.enf_sem_presenca | banco | Nenhuma presença da enfermeira no plantão | ok | ok: sem linha em presenca_plantonista | ok |
| D01.04.rec_escala | d_ges | Gestor escala d_rec (recepcao) no turno em curso, noite de 2026-11-06 | ok | 3d67c285-8a2c-4a36-8de1-3d7b908d0840 | ok |
| D01.04.rec_inicio_1 |  | Início do plantão (d01_pl_rec) levado para agora − 1 min (simula o tempo passado) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => 1) WHERE id = '3d67c285-8a2c-4a36-8de1-3d7b908d0840' AND perfil_id::text LIKE 'fd200000%' | ajuste |
| D01.04.sobreposicao | d_ges | Escalar a mesma recepção em outro setor no mesmo turno (deve ser recusado) | erro:Conflito | recusado: Conflito: este profissional já está escalado em outro setor nesta data/turno. | ok |
| D01.05.rec_checkin | d_rec | Recepção faz o check-in (unidade sem coordenada: sem posição) | ok | 514b2e28-54b5-42e9-a951-7628f19a980b | ok |
| D01.05.ficha | d_rec | A mesma recepção, agora escalada, abre a ficha de Ana no Pronto Socorro D | ok | 9fa076d0-1e80-42d9-9974-0ff519ae1cd9 | ok |
| D01.05.conta | banco | Conta ambulatorial aberta pelo gatilho, sem itens; autor da ficha = login da recepção | ok | 1e368d9a-5d3d-457f-a3c1-d9f5a95ffa19 | ok |
| D01.06.enf_inicio_31 |  | Início do plantão (d01_pl_enf) levado para agora − 31 min (simula o tempo passado) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => 31) WHERE id = '41ca2deb-531e-4428-868e-69f1f74b8ef6' AND perfil_id::text LIKE 'fd200000%' | ajuste |
| D01.06.enf_bloqueada | d_enf | 31 min depois do início, sem check-in: na janela, mas bloqueada | ok | ok: {"liberado": false, "pendente": {"fim": "2026-11-07T14:24:24.13242+00:00", "prazo": "2026-11-07T02:54:24.13242+00:00", "turno": "noite", "inicio": "2026-11-07T02:24:… | ok |
| D01.06.chamar_recusado | d_enf | Enfermeira sem check-in depois da tolerância tenta chamar Ana (deve ser recusado) | erro:Acesso negado: você não está de plantão | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| D01.07.checkin_atrasado | d_enf | Enfermeira faz o check-in atrasado: entra na hora, sem liberação do gestor | ok | fc2c2375-2778-419d-8116-9181d101f243 | ok |
| D01.07.atraso | banco | checkin_em fica 31 min depois do início do plantão | ok | ok: atraso 00:31:00 | ok |
| D01.08.chamar | d_enf | Enfermeira chama Ana para a Triagem D | ok | {"aviso": false, "numero": 1} | ok |
| D01.08.classificar | d_enf | Classifica: fluxograma "Dor de cabeça" (adulto), sinais crus; cor verde = escolha da enfermeira de teste | ok | 8fa65005-9616-4107-99a1-ab9d394161ce | ok |
| D01.08.cor | banco | A cor gravada é a da enfermeira e o autor é o login dela | ok | ok: cor verde, autor fd200000-0000-4000-8000-000000000004 | ok |
| D01.09.faturamento | d_fat | Faturamento, sem escala nem check-in, abre a conta de Ana: aberta com o item da classificação | ok | ok: [{"em": "2026-11-07T02:55:24.13242+00:00", "cbo": "223505", "cid": null, "nome": "ACOLHIMENTO COM CLASSIFICAÇÃO DE RISCO", "avisos": [{"texto": "Endereço incompleto … | ok |
| D01.10.presencas | d_ges | Gestor (sem escala) lê as presenças: recepção com check-in 1 min depois do início; enfermeira 31 min depois | ok | ok: Enfermeira Bloco D 23:55; Recepção Bloco D 23:55; Plantonista A Bloco D sem check-in; Plantonista B Bloco D sem check-in | ok |
| D01.10.atraso_na_tela | d_ges | PresencasDoDia marca o check-in atrasado | existir | Só na tela: presencas_do_dia_gestor devolve checkin_em, sem o início do plantão nem a marca de atraso; a marca, se houver, é calculada na tela. | lacuna |
| D01.11.escala_seguinte | d_ges | Gestor escala a plantonista B no turno SEGUINTE (Internação D) | ok | acd08c7a-e86f-4f62-bad9-daa8b2057b8b | ok |
| D01.11.inicio_em_20 |  | Plantão seguinte da plantonista B começa daqui a 20 min (simulado) | ajuste | UPDATE public.escala_plantao SET inicio = now() + interval '20 minutes' WHERE id = 'acd08c7a-e86f-4f62-bad9-daa8b2057b8b' | ajuste |
| D01.11.checkin_antes | d_plant_b | Check-in 20 min antes do início do plantão (deve ser recusado: não há janela antes do início) | erro:Você não está em escala | recusado: Você não está em escala ou não tem acesso de atendimento nesta unidade agora. | ok |
| D01.11.janela_antes | d_plant_b | Janela de check-in antes do início do plantão | existir | Lacuna (MAPA): não existe; a recusa acima é o comportamento atual. | lacuna |
| D01.B1.tolerancia_121 | d_ges | Tolerância de 121 min (deve ser recusada) | erro:Tolerância do check-in entre 0 e 120 | recusado: Tolerância do check-in entre 0 e 120 minutos. | ok |
| D01.B2.tolerancia_120 | d_ges | Tolerância de 120 min (limite superior aceito) | ok | {"alvos_grade": {"exame": null, "medicacao": null, "permanencia": null}, "alvos_medico": {"azul": 240, "verde": 120, "amarelo": 60, "laranja": 10, "vermelho": 0}, "ocupa… | ok |
| D01.B3.farm_escala | d_ges | Gestor escala d_farm (farmaceutico) no turno em curso, noite de 2026-11-06 | ok | 02da8b9b-a44a-4190-aba7-a5f42fa0d787 | ok |
| D01.B3.farm_inicio_1 |  | Início do plantão (d01_pl_farm) levado para agora − 1 min (simula o tempo passado) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => 1) WHERE id = '02da8b9b-a44a-4190-aba7-a5f42fa0d787' AND perfil_id::text LIKE 'fd200000%' | ajuste |
| D01.B3.tolerancia_0 | d_ges | Tolerância 0 | ok | {"alvos_grade": {"exame": null, "medicacao": null, "permanencia": null}, "alvos_medico": {"azul": 240, "verde": 120, "amarelo": 60, "laranja": 10, "vermelho": 0}, "ocupa… | ok |
| D01.B3.zero_exige_checkin | d_farm | Com tolerância 0, 1 min depois do início e sem check-in: bloqueada | ok | ok: {"liberado": false, "pendente": {"fim": "2026-11-07T14:54:24.13242+00:00", "prazo": "2026-11-07T02:54:24.13242+00:00", "turno": "noite", "inicio": "2026-11-07T02:54:… | ok |
| D01.B3.volta_30 | d_ges | Tolerância volta ao padrão (30) | ok | {"alvos_grade": {"exame": null, "medicacao": null, "permanencia": null}, "alvos_medico": {"azul": 240, "verde": 120, "amarelo": 60, "laranja": 10, "vermelho": 0}, "ocupa… | ok |
| D01.B3.trinta_libera | d_farm | Com tolerância 30, a mesma farmacêutica sem check-in entra | ok | ok: {"liberado": true, "pendente": {"fim": "2026-11-07T14:54:24.13242+00:00", "prazo": "2026-11-07T03:24:24.13242+00:00", "turno": "noite", "inicio": "2026-11-07T02:54:2… | ok |
| D01.99.inicio_volta |  | O início dos plantões do bloco D volta ao do turno (escala_janela recalcula) | ajuste | UPDATE public.escala_plantao SET turno = turno WHERE id IN ('41ca2deb-531e-4428-868e-69f1f74b8ef6', '3d67c285-8a2c-4a36-8de1-3d7b908d0840', 'acd08c7a-e86f-4f62-bad9-daa8… | ajuste |

#### Passos do D02

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D02.00.vence_liberacoes |  | Vence as liberações ainda ativas da plantonista B na UPA Bloco D (rodadas anteriores ou deste script) | ajuste | UPDATE public.liberacao_pos_plantao SET concedido_em = now() - interval '6 minutes', expira_em = now() - interval '1 minute' WHERE perfil_id = 'fd200000-0000-4000-8000-0… | ajuste |
| D02.00.em_curso |  | Plantão da plantonista B em curso (termina daqui a 60 min) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + -60) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd… | ajuste |
| D02.00.plant_b_checkin | d_plant_b | Plantonista B faz o check-in do plantão em curso | ok | 155a4c47-74a2-4768-b37e-e9dfc260044b | ok |
| D02.00.ficha | d_rec | Recepção abre a ficha de Carlos no Pronto Socorro D | ok | be11534a-00c9-4edc-82f5-f3037f694f1d | ok |
| D02.00.chamar | d_enf | Enfermeira chama Carlos | ok | {"aviso": false, "numero": 1} | ok |
| D02.00.classificar | d_enf | Classifica: "Dor de cabeça" (adulto), sinais crus; cor amarelo = escolha da enfermeira de teste | ok | 372dae87-27d9-4bb5-ba0e-44a987f511d6 | ok |
| D02.01.iniciar | d_plant_b | Plantonista B assume Carlos antes do fim do turno | ok | (sem retorno: void) | ok |
| D02.01.rascunho | d_plant_b | Salva um rascunho do SOAP | ok | 2026-11-07 03:04:01.188237+00 | ok |
| D02.02.fim_10 |  | Plantão da plantonista B terminou há 10 min (simulado pelo início) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + 10) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd2… | ajuste |
| D02.02.tolerancia_servidor | banco | private.tolerancia_fim_plantao() = 20 min | ok | ok: 00:20:00 | ok |
| D02.02.soap | d_plant_b | 10 min depois do fim, com check-in: grava o SOAP (CID R51) | ok | abba368a-f390-4f26-a07d-271f320877b3 | ok |
| D02.03.casca_15_20 | d_plant_b | Casca × servidor: 15 vs 20 min depois do fim | existir | Só na tela. No código, src/lib/offline/regras.ts usa a tolerância do servidor (20 min); só o comentário de src/hooks/usePlantao.ts (l. 40) ainda diz 15 min. A casca relê… | lacuna |
| D02.04.fim_21 |  | Plantão da plantonista B terminou há 21 min (simulado pelo início) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + 21) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd2… | ajuste |
| D02.04.porta_fechada | d_plant_b | 21 min depois do fim: nenhum plantão agora para a plantonista B | ok | ok: meu_plantao_agora vazio | ok |
| D02.04.desfecho_recusado | d_plant_b | Tenta registrar a alta depois do 20º minuto (deve ser recusado) | erro | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| D02.05.liberar | d_ges | Gestor libera 30 min: "terminar desfecho de paciente em curso" | ok | 067af0cf-b1af-400c-b5fd-2e62abaae44f | ok |
| D02.05.liberacao | banco | Liberação com motivo, autor = gestor e expira_em = concedido + 30 min; auditoria | ok | ok: expira 00:34, motivo terminar desfecho de paciente em curso | ok |
| D02.06.alta | d_plant_b | Dentro da liberação: registra a alta (CID do SOAP) | ok | (sem retorno: void) | ok |
| D02.06.encerrado | banco | Episódio com desfecho alta, encerrado na data de Brasília, autor = plantonista B | ok | ok: desfecho alta em 07/11 00:04 | ok |
| D02.07.lib_vence |  | A liberação do cenário vence (concedida há 31 min, expira_em = agora − 1 min) | ajuste | UPDATE public.liberacao_pos_plantao SET concedido_em = now() - interval '31 minutes', expira_em = now() - interval '1 minute' WHERE id = '067af0cf-b1af-400c-b5fd-2e62aba… | ajuste |
| D02.07.fecha_de_novo | d_plant_b | Liberação vencida: a porta fecha de novo e a escrita é recusada | ok | ok: meu_plantao_agora vazio | ok |
| D02.07.ficha_recusada | d_plant_b | Qualquer escrita de porta (abrir ficha) é recusada | erro:Acesso negado: você não está de plantão | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| D02.08.quatro_min | d_ges | Liberar 4 min (deve ser recusado) | erro:A liberação vale de 5 a 120 minutos | recusado: A liberação vale de 5 a 120 minutos. | ok |
| D02.08.cento_vinte_um | d_ges | Liberar 121 min (deve ser recusado) | erro:A liberação vale de 5 a 120 minutos | recusado: A liberação vale de 5 a 120 minutos. | ok |
| D02.08.motivo_curto | d_ges | Liberar com motivo de 5 letras (deve ser recusado) | erro:Informe o motivo da liberação | recusado: Informe o motivo da liberação (pelo menos 10 letras). | ok |
| D02.08.nenhuma_linha | banco | Nenhuma liberação nova gravada pelas três recusas | ok | ok: 1 liberação(ões) da plantonista B nesta rodada | ok |
| D02.09.fim_13h |  | Plantão da plantonista B terminou há 780 min (simulado pelo início) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + 780) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd… | ajuste |
| D02.09.liberar_13h | d_ges | Liberar 13 h depois do fim do plantão (o catálogo espera recusa: fora do prazo de 12 h) | erro | PASSOU sem erro (deveria ser recusado): 552b952d-5e43-4777-aba4-69aba026744d | **falha** |
| D02.09.nao_reabre | d_plant_b | Com a liberação gravada, o plantão de 13 h atrás NÃO reabre (o limite de 12 h está em plantoes_agora) | ok | ok: meu_plantao_agora vazio | ok |
| D02.B1.fim_em_30 |  | Plantão da plantonista B em curso (termina daqui a 30 min) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + -30) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd… | ajuste |
| D02.B1.checkout | d_plant_b | Check-out manual 30 min antes do fim | ok | (sem retorno: void) | ok |
| D02.B1.fim_5 |  | Plantão da plantonista B terminou há 5 min (simulado pelo início) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + 5) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd20… | ajuste |
| D02.B1.checkout_fecha | d_plant_b | Depois do check-out, 5 min após o fim (o catálogo espera: o check-out fecha antes dos 20 min) | ok | P0001: confere: meu_plantao_agora: noite Pronto Socorro D | **falha** |
| D02.B1.em_curso_depois_checkout |  | Plantão da plantonista B em curso (termina daqui a 30 min) | ajuste | UPDATE public.escala_plantao SET inicio = now() - make_interval(mins => duracao_min + -30) WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' AND perfil_id::text LIKE 'fd… | ajuste |
| D02.B1.checkout_em_curso | d_plant_b | Depois do check-out, ainda dentro do horário do plantão: a porta segue aberta? | ok | porta ABERTA depois do check-out (o check-in continua valendo) | ok |
| D02.B2.duas_liberacoes | d_ges | Duas liberações seguidas (30 e 10 min): a segunda vale pelo próprio prazo | ok | 8b508dc5-2052-4f0c-a5c6-5c1c2d30ab05 | ok |
| D02.B2.prazo_proprio | banco | expira_em da segunda = concedido + 10 min (não soma à primeira) | ok | ok: expira 00:14 | ok |
| D02.B3.cron_checkout | d_plant_b | Cron checkout-automatico grava checkout_em sem o médico | existir | Não exercitado: depende do cron agendado no horário real; conferir na manhã seguinte em presenca_plantonista.checkout_automatico. | lacuna |
| D02.99.vence_liberacoes |  | Vence as liberações ainda ativas da plantonista B na UPA Bloco D (rodadas anteriores ou deste script) | ajuste | UPDATE public.liberacao_pos_plantao SET concedido_em = now() - interval '6 minutes', expira_em = now() - interval '1 minute' WHERE perfil_id = 'fd200000-0000-4000-8000-0… | ajuste |
| D02.99.inicio_volta |  | O início do plantão da plantonista B volta ao do turno | ajuste | UPDATE public.escala_plantao SET turno = turno WHERE id = 'eb96b907-8726-453e-97a8-2f2414050b4e' | ajuste |

#### Passos do D03

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D03.00.escala_c | d_ges | Gestor escala d_plant_c (plantonista) no turno em curso | ok | 2e18632f-f73d-451a-8677-ad9efe40810d | ok |
| D03.00.escala_tele | d_ges | Gestor escala d_tele (telemedicina) no turno em curso | ok | b2efd5ff-5d50-41e4-a923-728251adf012 | ok |
| D03.00.limpa_c |  | Apaga a presença de d_plant_c no turno (conta do bloco D), para a próxima tentativa começar sem check-in | ajuste | DELETE FROM public.presenca_plantonista WHERE perfil_id = 'fd200000-0000-4000-8000-000000000008' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND data = '2026… | ajuste |
| D03.00.limpa_tele |  | Apaga a presença de d_tele no turno (conta do bloco D), para a próxima tentativa começar sem check-in | ajuste | DELETE FROM public.presenca_plantonista WHERE perfil_id = 'fd200000-0000-4000-8000-000000000009' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND data = '2026… | ajuste |
| D03.00.coordenada |  | Coordenada FICTÍCIA na UPA Bloco D (−23,5; −46,6), raio padrão 500 m — retirada no fim deste script | ajuste | UPDATE public.unidades SET latitude = -23.5000, longitude = -46.6000, raio_metros = 500 WHERE id = 'fd100000-0000-4000-8000-000000000001' | ajuste |
| D03.01.fora_do_raio | d_plant_c | Check-in a ~2 km da unidade, sem justificativa (deve ser recusado) | erro:CHECKIN_FORA_DO_RAIO | recusado: CHECKIN_FORA_DO_RAIO: você está a 2002 m da unidade; o raio é de 500 m. | ok |
| D03.02.justificativa_curta | d_plant_c | 2ª tentativa, mesma posição, justificativa de 5 letras (deve ser recusado) | erro:CHECKIN_JUSTIFICATIVA_CURTA | recusado: CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres. | ok |
| D03.02.sem_linha | banco | As duas recusas não gravaram presença | ok | ok: sem linha | ok |
| D03.03.com_justificativa | d_plant_c | 2ª tentativa com "GPS do celular marcou a rua errada": aceito, marcado fora do raio | ok | 3751e0a3-a819-46d2-ad54-58c91c964614 | ok |
| D03.03.marca | banco | Presença com checkin_dentro = false, distância e justificativa; autor = login | ok | ok: dentro false, 2002 m, "GPS do celular marcou a rua errada" | ok |
| D03.04.gestor_ve | d_ges | Gestor vê o check-in fora do raio com a justificativa | ok | ok: Plantonista C Bloco D: dentro false, 2002 m, GPS do celular marcou a rua errada | ok |
| D03.07.raio_nao_bloqueia | d_plant_c | Depois do check-in fora do raio a porta abre: só a falta de check-in bloqueia | ok | ok: {"liberado": true, "pendente": null, "servidor": "2026-11-07T03:02:24.779894+00:00", "bloqueado": false, "na_janela": true, "tolerancia_min": 30} | ok |
| D03.05.limpa |  | Apaga a presença de d_plant_c no turno (conta do bloco D), para a próxima tentativa começar sem check-in | ajuste | DELETE FROM public.presenca_plantonista WHERE perfil_id = 'fd200000-0000-4000-8000-000000000008' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND data = '2026… | ajuste |
| D03.05.sem_localizacao | d_plant_c | Navegador sem localização e sem justificativa (deve ser recusado) | erro:CHECKIN_SEM_LOCALIZACAO | recusado: CHECKIN_SEM_LOCALIZACAO: não foi possível obter a sua localização. | ok |
| D03.05.sem_localizacao_curta | d_plant_c | Sem localização, justificativa de 6 letras (deve ser recusado) | erro:CHECKIN_JUSTIFICATIVA_CURTA | recusado: CHECKIN_JUSTIFICATIVA_CURTA: descreva o problema com o GPS em pelo menos 10 caracteres. | ok |
| D03.06.sem_localizacao_ok | d_plant_c | Com "navegador sem permissão de localização": aceito, marcado sem localização | ok | ebc1e304-167c-4a19-a148-4b62f3ba6a8c | ok |
| D03.06.marca | banco | Presença sem posição: checkin_dentro e distância nulos, justificativa gravada | ok | ok: dentro nulo, justificativa "navegador sem permissão de localização" | ok |
| D03.06.marca_sem_localizacao | d_ges | Marca "sem localização" distinta de "fora do raio" para o gestor | existir | Só na tela: no banco o check-in sem posição fica com checkin_dentro nulo + justificativa; o de fora do raio, com checkin_dentro = false + distância. A tela é que diferen… | lacuna |
| D03.B1.limpa |  | Apaga a presença de d_plant_c no turno (conta do bloco D), para a próxima tentativa começar sem check-in | ajuste | DELETE FROM public.presenca_plantonista WHERE perfil_id = 'fd200000-0000-4000-8000-000000000008' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND data = '2026… | ajuste |
| D03.B1.dentro_490 | d_plant_c | Posição a ~490 m (dentro do raio de 500 m), sem justificativa: aceito, dentro | ok | 90587251-9a77-42cc-887f-db7e6b3a256f | ok |
| D03.B1.marca | banco | checkin_dentro = true, distância até 500 m | ok | ok: dentro, 489 m | ok |
| D03.B2.limpa |  | Apaga a presença de d_plant_c no turno (conta do bloco D), para a próxima tentativa começar sem check-in | ajuste | DELETE FROM public.presenca_plantonista WHERE perfil_id = 'fd200000-0000-4000-8000-000000000008' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND data = '2026… | ajuste |
| D03.B2.raio_1000 |  | Raio da UPA Bloco D alterado para 1000 m | ajuste | UPDATE public.unidades SET raio_metros = 1000 WHERE id = 'fd100000-0000-4000-8000-000000000001' | ajuste |
| D03.B2.mensagem_raio_novo | d_plant_c | A ~2 km com raio de 1000 m: a mensagem mostra o raio novo | erro:CHECKIN_FORA_DO_RAIO | recusado: CHECKIN_FORA_DO_RAIO: você está a 2002 m da unidade; o raio é de 1000 m. | ok |
| D03.B2.mensagem | banco | Texto da recusa traz "o raio é de 1000 m" | ok | ok: recusado: CHECKIN_FORA_DO_RAIO: você está a 2002 m da unidade; o raio é de 1000 m. | ok |
| D03.B3.telemedicina | d_tele | Telemedicina a ~2 km, sem justificativa: aceita, remota, sem cerca geográfica | ok | 6e1e122d-43d9-4ed6-8817-1059a5bcec27 | ok |
| D03.B3.remoto | banco | Presença da telemedicina sem posição gravada e marcada "Telemedicina (remoto)" | ok | ok: Telemedicina (remoto) | ok |
| D03.99.retira_coordenada |  | Coordenada retirada da UPA Bloco D; raio de volta a 500 m | ajuste | UPDATE public.unidades SET latitude = NULL, longitude = NULL, raio_metros = 500 WHERE id = 'fd100000-0000-4000-8000-000000000001' | ajuste |
| D03.B4.limpa |  | Apaga a presença de d_plant_c no turno (conta do bloco D), para a próxima tentativa começar sem check-in | ajuste | DELETE FROM public.presenca_plantonista WHERE perfil_id = 'fd200000-0000-4000-8000-000000000008' AND unidade_id = 'fd100000-0000-4000-8000-000000000001' AND data = '2026… | ajuste |
| D03.B4.sem_coordenada | d_plant_c | Unidade SEM coordenada (como as da F5): posição a ~2 km passa sem marca de raio | ok | 5a488b19-e491-43d3-933b-0eb415ef8383 | ok |
| D03.B4.marca | banco | checkin_dentro e distância nulos (raio não conferido) | ok | ok: dentro nulo | ok |
| D03.99.sem_coordenada_f5 | banco | Nenhuma unidade F5 nem a do bloco D ficou com coordenada | ok | ok: 0 unidade(s) com coordenada | ok |

#### Passos do D04

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D04.00.escala_a | d_ges | Gestor escala a plantonista A na manhã de amanhã, Pronto Socorro D | ok | 1b3695f2-5b89-4d3f-bdfc-58c4335120e6 | ok |
| D04.00.escala_b | d_ges | Gestor escala a plantonista B na manhã de amanhã, Internação D | ok | 1745b465-c9e5-40ee-91ab-9d8d5f5b4ded | ok |
| D04.00.exige_aprovacao | banco | escala_passagem_exige_aprovacao da UPA Bloco D no padrão (sem linha = exige) | ok | ok: exige aprovação | ok |
| D04.01.solicitar | d_plant_a | A pede a troca: "compromisso pessoal" | ok | afd8093f-30d6-4cd0-9124-1f59cae3133f | ok |
| D04.01.pendente | banco | Troca pendente, sem aceite | ok | ok: status pendente | ok |
| D04.01.aviso_b | banco | B recebe o aviso no sino | ok | ok: 1 aviso(s) "troca_pedida_afd8093f-30d6-4cd0-9124-1f59cae3133f" no sino | ok |
| D04.03.escala_a_noite | d_ges | Gestor escala A na noite de amanhã, PS D | ok | 1cf7bdbf-775a-4200-9fb7-c2da0ab82371 | ok |
| D04.03.escala_b_noite | d_ges | Gestor escala B na noite de amanhã, Internação D | ok | 50f1767f-63e0-4fc0-9f4f-6f171dbb7be9 | ok |
| D04.03.segunda_troca | d_plant_a | A abre uma segunda troca, com os plantões da noite (para os passos 3 e 6) | ok | d2dd4e0b-5a34-4e4e-891e-199652c12897 | ok |
| D04.03.aprovar_antes | d_ges | Gestor tenta aprovar antes do aceite do colega (deve ser recusado) | erro:O colega ainda não aceitou | recusado: O colega ainda não aceitou a troca. Espere o aceite ou recuse o pedido. | ok |
| D04.02.aceitar | d_plant_b | B aceita a troca: vai ao gestor | ok | aceita | ok |
| D04.02.aceito_em | banco | aceito_em gravado; A e o gestor avisados | ok | ok: aceita em 07/11 00:08; A e gestor avisados | ok |
| D04.02.sai_da_lista | d_plant_b | pedidos_para_mim de B não traz mais a troca aceita | ok | ok: fora da lista de B | ok |
| D04.04.aprovar | d_ges | Gestor aprova a troca aceita | ok | (sem retorno: void) | ok |
| D04.04.escala_trocada | banco | Amanhã: A na Internação D e B no PS D; troca aprovada; os dois avisados; histórico | ok | ok: plantão do PS D agora de B, da Internação D agora de A; aprovado; 2 avisos; histórico troca_aprovada | ok |
| D04.05.escala_de_a | d_plant_a | A lê a própria escala de amanhã: Internação D | ok | P0001: confere: amanhã: Pronto Socorro D (noite), Internação D (manha) | **falha** |
| D04.06.recusar | d_plant_b | B recusa a segunda troca com motivo | ok | (sem retorno: void) | ok |
| D04.06.recusada | banco | Troca recusada e A avisado | ok | ok: status recusado | ok |
| D04.07.terceira_troca | d_plant_a | A (agora na Internação D) pede outra troca com B | ok | c319d8ce-f537-4a10-b889-c39b32b9e897 | ok |
| D04.07.cancelar | d_plant_a | A cancela a troca ainda sem decisão | ok | (sem retorno: void) | ok |
| D04.07.cancelada | banco | Troca cancelada | ok | ok: status cancelada | ok |
| D04.07.pedir_de_novo | d_plant_a | Depois de cancelar, A pede de novo a MESMA troca (mesmo par de plantões) | ok | 23505: duplicate key value violates unique constraint "trocas_plantao_plantao_a_id_plantao_b_id_key" | **falha** |
| D04.08.update_direto | d_plant_b | B tenta UPDATE direto em trocas_plantao (deve ser recusado) | erro | recusado: permission denied for table trocas_plantao | ok |
| D04.09.vinculo_plantonista |  | Gestor do bloco D ganha também o papel plantonista na UPA Bloco D (conta do bloco D) | ajuste | INSERT INTO public.vinculos (perfil_id, unidade_id, papel) SELECT 'fd200000-0000-4000-8000-000000000005', 'fd100000-0000-4000-8000-000000000001', 'plantonista' WHERE NOT… | ajuste |
| D04.09.escala_gestor | d_ges | Gestor se escala na tarde de amanhã, PS D (como plantonista) | ok | 73518f1c-982a-4591-8f7a-1cd75651ba14 | ok |
| D04.09.escala_a_tarde | d_ges | Gestor escala A na tarde de amanhã, Internação D | ok | 40aa8e68-e845-408c-a428-67dd3d9e96ec | ok |
| D04.09.solicitar | d_ges | Gestor pede troca do próprio plantão com A | ok | c2424af8-9628-44ed-a882-f6ae325dc093 | ok |
| D04.09.a_aceita | d_plant_a | A aceita a troca do gestor | ok | aceita | ok |
| D04.09.liga_2fa |  | Liga exigir_segundo_fator SÓ dentro desta transação (homologação tem a chave desligada; volta a false no fim do script) | ajuste | UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator' | ajuste |
| D04.09.sem_2fa | d_ges | Gestor aprova a própria troca sem 2º fator válido (deve ser recusado) | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do autenticador para continuar. | ok |
| D04.09.simula_codigo |  | Simula o código TOTP confirmado pelo gestor do bloco D (linha em segundo_fator_sessao_ok da sessão de teste) | ajuste | INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES ('1dfeb876-7b7e-4393-b468-53a113d0b383', 'fd200000-0000-4000-8000-000000000005', … | ajuste |
| D04.09.com_2fa | d_ges | Com o 2º fator válido, o gestor aprova a própria troca | ok | (sem retorno: void) | ok |
| D04.09.registro_proprio | banco | Histórico da escala e auditoria com aprovou_proprio_pedido | ok | ok: histórico e auditoria aprovou_proprio_pedido | ok |
| D04.09.desliga_2fa |  | exigir_segundo_fator volta a false (estado da homologação) | ajuste | UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator' | ajuste |
| D04.10.porta_no_dia | d_plant_a | No dia trocado, A entra pela Internação D (setores_na_escala_agora segue a escala nova) | existir | Só no dia (amanhã, 07h): a porta é a escala_plantao do momento (plantoes_na_janela por perfil_id), e o passo D04.04/05 mostra o plantão já com A na Internação D. Mover o… | lacuna |
| D04.B1.escala_a | d_ges | A na manhã de depois de amanhã, PS D | ok | 5182824d-a235-42fa-8d0c-c4b87f5ec16e | ok |
| D04.B1.escala_b | d_ges | B na manhã de depois de amanhã, Internação D | ok | 7d54ef71-5a84-48e8-a046-c44728b4df64 | ok |
| D04.B1.sem_aprovacao |  | UPA Bloco D passa a não exigir aprovação do gestor na troca | ajuste | INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor) VALUES ('fd100000-0000-4000-8000-000000000001', 'escala_passagem_exige_aprovacao', 'false') ON CONFLI… | ajuste |
| D04.B1.solicitar | d_plant_a | A pede a troca (PS D ↔ Internação D, depois de amanhã) | ok | 01b3b63f-a3cb-4eb7-8a78-758c0ed65538 | ok |
| D04.B1.aceite_aplica | d_plant_b | Sem exigência de aprovação, o aceite do colega já aplica a troca | ok | ok: aceitar_troca devolveu "aplicada" | ok |
| D04.B1.volta_padrao |  | UPA Bloco D volta ao padrão (exige aprovação) | ajuste | DELETE FROM public.configuracoes_unidade WHERE unidade_id = 'fd100000-0000-4000-8000-000000000001' AND chave = 'escala_passagem_exige_aprovacao' | ajuste |
| D04.B2.escala_a_tarde | d_ges | A na tarde de depois de amanhã, PS D | ok | e52e672a-2824-4840-9435-572c67b554ff | ok |
| D04.B2.solicitar | d_plant_a | A pede trocar a sua tarde pela manhã de B (A já está na manhã) | ok | 7d5968ce-2b58-441b-86bf-17cac9f2681c | ok |
| D04.B2.aceitar | d_plant_b | B aceita | ok | aceita | ok |
| D04.B2.sobreposicao | d_ges | Gestor aprova a troca que deixaria A em dois setores na mesma manhã (deve ser recusado pela escala) | erro | recusado: Escala sobreposta: Plantonista A Bloco D já está escalado(a) no setor Internação D (UPA Bloco D) de 07:00 de 10/11 a 13:00 de 10/11. | ok |
| D04.B3.passagem | d_plant_a | Passagem de plantão (passar_plantao → aceitar_passagem/recusar_passagem/cancelar_pedido_escala) | existir | Não exercitada nesta rodada: o desenho é o mesmo da troca; fica para a tela ou para uma rodada própria. | lacuna |
| D04.05.escala_de_a_manha | d_plant_a | Conferência refeita (o passo D04.05 da rodada 2 não filtrou o turno): A lê a manhã de amanhã: Internação D | ok | ok: manhã: Internação D (manha) | ok |

#### Passos do D05

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D05.00.liga_2fa |  | Liga exigir_segundo_fator SÓ dentro desta transação (volta a false no fim do script) | ajuste | UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator' | ajuste |
| D05.00.limpa |  | Começa sem sessão confirmada, sem códigos e sem bloqueio na farmacêutica do bloco D (rodada repetível) | ajuste | DELETE FROM private.segundo_fator_sessao_ok WHERE user_id = 'fd200000-0000-4000-8000-000000000007'; DELETE FROM private.segundo_fator_recuperacao WHERE user_id = 'fd2000… | ajuste |
| D05.01.status | d_farm | segundo_fator_status responde: exigido e não válido | ok | ok: exigido true, válido false | ok |
| D05.01.portao_rpc | d_farm | Sem o código, o portão recusa POST /rpc/fila_validacao | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do segundo fator para continuar. | ok |
| D05.01.portao_lista | d_farm | As RPCs da lista do portão passam: segundo_fator_status, herdar_segundo_fator, usar_codigo_recuperacao, horario_servidor | ok | liberado: POST /rpc/segundo_fator_status; liberado: POST /rpc/herdar_segundo_fator; liberado: POST /rpc/usar_codigo_recuperacao; liberado: POST /rpc/horario_servidor | ok |
| D05.01.rpc_interna | d_ges | A RPC também confere por dentro: o gestor sem código não lista a equipe | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do autenticador para continuar. | ok |
| D05.B1.get_tabela | d_farm | Borda: GET em tabela sem o código passa pelo portão (a RLS decide) | ok | liberado: GET /pacientes | ok |
| D05.B4.anon | banco | Borda: papel anon (painel da TV) fica fora do portão | ok | {"role":"anon"} → liberado: POST /rpc/painel_chamadas | ok |
| D05.02.totp_na_tela | d_farm | Digitar o código TOTP no portão | existir | Só na tela: o código vem do autenticador cadastrado (verificar_codigo_2fa/auth.mfa). Aqui a confirmação é simulada pela linha que a RPC grava. | lacuna |
| D05.02.simula_codigo |  | Simula o TOTP confirmado na sessão 1 da farmacêutica do bloco D (segundo_fator_sessao_ok, verificado agora) | ajuste | INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES ('f1c59890-c921-40df-b4ed-6b1a3e3819e0', 'fd200000-0000-4000-8000-000000000007', … | ajuste |
| D05.02.portao_abre | d_farm | Com a sessão confirmada, o portão deixa passar POST /rpc/fila_validacao | ok | liberado: POST /rpc/fila_validacao | ok |
| D05.03.herdar | d_farm | Sessão nova depois do desbloqueio herda a confirmação da sessão 1 | ok | ok: herdou | ok |
| D05.03.mesmo_prazo | banco | A sessão nova tem o MESMO verificado_em da original (o prazo de 24 h não estica) | ok | ok: original 00:14:07, herdada 00:14:07 | ok |
| D05.04.login_novo | d_farm | Login novo, sem sessão anterior no navegador: não herda (pede código) | ok | ok: não herdou | ok |
| D05.04.portao_fecha | d_farm | Nessa sessão o portão continua fechado | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do segundo fator para continuar. | ok |
| D05.B3.sessao_gestor |  | Sessão confirmada do gestor do bloco D (simulada), para a borda de herança de outra pessoa e o passo 11 | ajuste | INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES ('2f1117be-1e71-4a81-8460-73118ad16ef9', 'fd200000-0000-4000-8000-000000000005', … | ajuste |
| D05.B3.herdar_de_outra_pessoa | d_farm | Borda: herdar a sessão de OUTRA pessoa (o gestor) devolve false | ok | ok: não herdou | ok |
| D05.05.vence |  | Sessão 1 confirmada há 24 h e 1 min (simulado) | ajuste | UPDATE private.segundo_fator_sessao_ok SET verificado_em = now() - interval '24 hours 1 minute' WHERE session_id = 'f1c59890-c921-40df-b4ed-6b1a3e3819e0' | ajuste |
| D05.05.vencido | d_farm | Com a confirmação vencida, o portão recusa de novo (na tela, o erro reabre o portão) | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do segundo fator para continuar. | ok |
| D05.05.nao_herda_vencido | banco | Sessão vencida também não é herdada (herdar exige verificado_em nas últimas 24 h) | ok | regra no corpo de herdar_segundo_fator: verificado_em > now() - 24 h | ok |
| D05.06.policy_storage | banco | storage.objects tem a policy RESTRICTIVE storage_segundo_fator (todas as operações) | ok | ok: storage_segundo_fator RESTRICTIVE ALL | ok |
| D05.06.download_na_tela | d_farm | Baixar um arquivo de bucket autenticado com o 2º fator vencido | existir | Só na tela (Storage API): a policy existe; o download recusado e o painel público da TV lendo por URL pública ficam para o Chrome. | lacuna |
| D05.07.gerar | d_farm | Gera os 10 códigos de recuperação (sessão herdada e válida) | ok | 10 códigos gerados (não registrados aqui) | ok |
| D05.08.usar | d_farm | Usa um código de recuperação no lugar do TOTP: entra e restam 9 | ok | {"ok": true, "codigos_restantes": 9} | ok |
| D05.09.bloqueio | d_farm | Errar o código 5 vezes bloqueia por 15 min | ok | {"ok": false, "motivo": "bloqueado", "bloqueado_ate": "2026-11-07T03:29:07.95414+00:00"} | ok |
| D05.09.eventos | banco | Eventos codigos_gerados, codigo_recuperacao_usado e codigo_recuperacao_bloqueado gravados; bloqueado_ate no futuro | ok | ok: codigo_recuperacao_bloqueado, codigo_recuperacao_errado, codigo_recuperacao_usado, codigos_gerados | ok |
| D05.10.equipe | d_ges | Gestor (com 2º fator) lista a equipe: códigos restantes e último zerar, sem segredo | ok | ok: Farmacêutica Bloco D: códigos 9, autenticador false, zerado em nunca | ok |
| D05.11.motivo_curto | d_ges | Zerar com motivo curto (deve ser recusado) | erro:Escreva o motivo | recusado: Escreva o motivo (mínimo 10 caracteres). | ok |
| D05.11.o_proprio | d_ges | Gestor tenta zerar o próprio 2º fator (deve ser recusado) | erro:Não é possível zerar o próprio | recusado: Não é possível zerar o próprio segundo fator. | ok |
| D05.11.zerar | d_ges | Gestor zera o 2º fator da farmacêutica do bloco D: "perdeu o celular com o autenticador" | ok | (sem retorno: void) | ok |
| D05.11.registro | banco | Tudo da pessoa apagado; evento zerado com autor = gestor e motivo; auditoria segundo_fator_zerado | ok | ok: sessões e códigos apagados; evento e auditoria com autor e motivo | ok |
| D05.12.portao_reabre | d_farm | Próxima ação da farmacêutica depois do zerar: o portão recusa (a sessão herdada foi apagada) | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do segundo fator para continuar. | ok |
| D05.12.cadastro_novo | d_farm | O portão pede cadastro novo do TOTP | existir | Só na tela (auth.mfa_factors apagado pelo zerar; o fluxo de cadastro é do Supabase Auth). | lacuna |
| D05.13.nir | f5_nir | NIR F5 sem o código: o portão recusa POST /rpc/nir_pendencias (nada gravado na conta) | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do segundo fator para continuar. | ok |
| D05.13.nir_confirma | f5_nir | NIR confirma o código e abre nir_pendencias | existir | Não exercitado de propósito: simular a confirmação gravaria estado de 2FA numa conta F5 usada pelos outros blocos. A abertura depois da confirmação está provada com a co… | lacuna |
| D05.B2.dispositivo_confiavel | d_farm | Dispositivo confiável marcado há 29 dias entra; há 31 pede | existir | Só na tela: verificar_dispositivo_2fa usa o token do aparelho guardado no navegador. | lacuna |
| D05.B5.codigo_email | d_farm | Código do 2º fator por e-mail | existir | Só na tela (envio de e-mail). | lacuna |
| D05.99.desliga_2fa |  | exigir_segundo_fator volta a false (estado da homologação) | ajuste | UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator' | ajuste |
| D05.99.chave_desligada | banco | A chave termina desligada | ok | ok: exigir_segundo_fator = false | ok |

#### Passos do D06

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D06.00.escala_d_med_obs | d_ges | Gestor escala d_med_obs no turno em curso | ok | 7e142641-bdff-4548-a5ac-fcdd69186424 | ok |
| D06.00.checkin_d_med_obs | d_med_obs | Check-in de d_med_obs | ok | 12e471e1-8884-4391-a921-ca42ab75e954 | ok |
| D06.00.escala_d_enf_obs | d_ges | Gestor escala d_enf_obs no turno em curso | ok | c8b23637-2027-4088-bcdc-b954ff3353ce | ok |
| D06.00.checkin_d_enf_obs | d_enf_obs | Check-in de d_enf_obs | ok | 3e1d41fe-c781-4a76-bc2c-b6b0dd9b3657 | ok |
| D06.00.bpa_atendimento_medico | d_fat | Faturamento associa o SIGTAP 0301060096 ao uso atendimento_medico na UPA Bloco D | ok | 9dde24f8-baf3-4547-aaa0-1ecafdb261a8 | ok |
| D06.00.bpa_medicacao | d_fat | Faturamento associa o SIGTAP 0301100012 ao uso medicacao na UPA Bloco D | ok | 42764b62-abee-4b1f-aa13-6d24c62cb585 | ok |
| D06.01.ficha_ubs | f5_rec_ubs | Recepção da UBS abre a ficha de escuta inicial de Jonas | ok | af6ff5f6-1967-4023-8d02-c2e0df2f73e9 | ok |
| D06.01.escuta | f5_enf_ubs | Escuta inicial com sinais crus; cor amarelo = escolha da enfermeira de teste; saída consulta | ok | d09d00a2-d365-4bcb-b31f-e9ef87a0abd6 | ok |
| D06.01.enviar | f5_enf_ubs | Enfermeira da UBS envia Jonas à UPA F5 com motivo | ok | f4dfdc1e-7eb2-425d-b5ce-65ffe9830b5f | ok |
| D06.02.ficha_upa | f5_rec_upa | Recepção da UPA F5 abre a ficha de Jonas no Pronto Socorro | ok | 502ec3e8-8b87-4139-b4b6-da3dc03bc334 | ok |
| D06.02.chegou | f5_rec_upa | Marca "Chegou" com a ficha escolhida | ok | {"id": "f4dfdc1e-7eb2-425d-b5ce-65ffe9830b5f", "motivo": "Dor abdominal persistente, avaliação na UPA (teste D06)", "numero": 29, "resumo": {"soap": null, "queixa": "Dor… | ok |
| D06.02.conta | banco | Conta ambulatorial aberta, sem itens | ok | 990ff3cb-1c7b-4dd1-98d0-26b4834910c6 | ok |
| D06.03.chamar | f5_enf_upa | Enfermeira chama Jonas para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| D06.03.classificar | f5_enf_upa | Classifica: "Dor abdominal" (adulto), sinais crus; cor verde = escolha da enfermeira de teste | ok | 5edba992-2147-4628-9447-6003b192e68e | ok |
| D06.04.chamadas_sem_resposta | f5_rec_upa | Fila médica mostra as chamadas do painel sem resposta | existir | Só na tela (/recepcao/fila-medica e painel de chamada): as três chamadas sem resposta são o motivo descrito no desfecho. | lacuna |
| D06.06.relato_curto | f5_med_upa | Evasão com relato de 10 letras (deve ser recusada) | erro:Descreva o ocorrido | recusado: Descreva o ocorrido (mínimo de 15 letras). | ok |
| D06.05.evasao_porta | f5_med_upa | Sem SOAP e sem assumir: evasão com relato ≥ 15 e motivo "demora" (o momento sai do estado do episódio: aguardando médico) | ok | (sem retorno: void) | ok |
| D06.05.encerrado | banco | Episódio encerrado com desfecho evasão, autor = login do médico, sem atendimento médico | ok | ok: desfecho evasao, motivo demora | ok |
| D06.07.contrarreferencia | f5_enf_ubs | A contrarreferência de Jonas chega à UBS como a_ver | ok | ce95b7d4-e47e-4748-b84a-08f41fa00542 | ok |
| D06.07.abrir | f5_enf_ubs | Enfermeira da UBS abre o retorno (desfecho evasão) | ok | {"id": "ce95b7d4-e47e-4748-b84a-08f41fa00542", "numero": 34, "resumo": {"cid": null, "medico": "Médico UPA F5", "relato": "Paciente não respondeu a três chamadas do pain… | ok |
| D06.07.visto | banco | a_ver → visto, com o desfecho evasão | ok | ok: situação visto, desfecho evasao | ok |
| D06.08.ficha | d_rec | Recepção abre a ficha de Lúcia no Pronto Socorro D | ok | 1a06ca9c-b82b-4ad4-a453-027b04cf636a | ok |
| D06.08.paciente | banco | Paciente e conta de Lúcia | ok | 3aa70c29-bb5f-44ad-bc03-172be1066a59 | ok |
| D06.08.conta | banco | Conta ambulatorial aberta | ok | 7302ac36-383c-4898-a971-4f73648cfc2e | ok |
| D06.09.chamar | d_enf | Enfermeira chama Lúcia | ok | {"aviso": false, "numero": 1} | ok |
| D06.09.classificar | d_enf | Classifica: "Desmaio, vertigem" (adulto), sinais crus; cor amarelo = escolha da enfermeira de teste | ok | 6484f786-68e1-42bd-bd15-e30d3194797d | ok |
| D06.10.iniciar | d_plant_a | Plantonista A assume Lúcia | ok | (sem retorno: void) | ok |
| D06.10.peso | d_plant_a | Peso referido pela paciente, antes de prescrever (valor cru) | ok | 1 sinais gravados | ok |
| D06.10.soap | d_plant_a | SOAP com CID R42 (tontura) | ok | f0f50c6e-3ee7-41d8-956a-13e7f01b6580 | ok |
| D06.10.prescrever | d_plant_a | Prescreve ondansetrona injetável do catálogo, "Agora"; dose = texto de teste (a dose real é a da tela, de fonte citada) | ok | 3d69b0e8-af0b-42a9-8e9f-7b8a9ebf5d42 | ok |
| D06.10.observacao | d_plant_a | Desfecho observação: box livre da Observação D | ok | (sem retorno: void) | ok |
| D06.10.internacao | banco | Internação de observação no box OBD-, sem conta própria (uma conta só, a da porta) | ok | 1e92fa65-0d8e-4faa-966c-121a0e127387 | ok |
| D06.11.aprazar | d_enf_obs | Enfermeiro da Observação D apraza a dose para agora | ok | (sem retorno: void) | ok |
| D06.11.checar | d_enf_obs | Checa a dose "feito" | ok | a2c05149-5448-49f0-88b7-a3f233ff80dc | ok |
| D06.12.observacao_curta | d_med_obs | Evasão da observação com observação de 8 letras (deve ser recusada) | erro:Descreva o ocorrido | recusado: Descreva o ocorrido (mínimo de 15 letras). | ok |
| D06.12.evasao_observacao | d_med_obs | Lúcia saiu do box sem avisar: dar_alta alta_evasao, CID R42, observação ≥ 15 | ok | (sem retorno: void) | ok |
| D06.12.encerrada | banco | Internação encerrada com alta_evasao; episódio encerrado; box liberado | ok | ok: internação alta_evasao, episódio encerrado 07/11 00:18, sem leito atual (box liberado) | ok |
| D06.13.indicador_upa_f5 | f5_ges_upa | Indicador de evasão da UPA F5: Jonas, momento aguardando_medico, motivo demora | ok | ok: por_momento {"observacao": 0, "antes_triagem": 0, "aguardando_medico": 1, "durante_atendimento": 0} | ok |
| D06.13.indicador_bloco_d | d_ges | Indicador de evasão da UPA Bloco D: Lúcia, momento observacao, motivo outro | ok | ok: por_momento {"observacao": 1, "antes_triagem": 0, "aguardando_medico": 0, "durante_atendimento": 0} | ok |
| D06.13.recepcao_sem_indicador | d_rec | Recepção não lê o indicador (deve ser recusado) | erro | recusado: Acesso negado: indicador do gestor da unidade. | ok |
| D06.14.itens_jonas | f5_fat | Conta de Jonas: só a classificação; consulta não nasce (médico não assumiu) | ok | ok: total 0; itens 1 | ok |
| D06.14.itens_lucia | d_fat | Conta de Lúcia: classificação, consulta e administração; medicamento sem valor | ok | ok: total 11.63; itens 3; medicamentos 1 | ok |
| D06.14.conferencia_j | f5_fat | Conta de Jonas: aberta → em_conferencia | ok | {"id": "990ff3cb-1c7b-4dd1-98d0-26b4834910c6", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:18:31.723085+00:00", "cbo": "223505", "cid": null, "nome": "ACOLHI… | ok |
| D06.14.fechar_j | f5_fat | Conta de Jonas: em_conferencia → fechada (a evasão libera o fechamento) | ok | {"id": "990ff3cb-1c7b-4dd1-98d0-26b4834910c6", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:18:31.723085+00:00", "cbo": "223505", "cid": null, "nome": "ACOLHI… | ok |
| D06.14.conferencia_l | d_fat | Conta de Lúcia: aberta → em_conferencia | ok | {"id": "7302ac36-383c-4898-a971-4f73648cfc2e", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:18:31.723085+00:00", "cbo": "225125", "cid": null, "nome": "ATENDI… | ok |
| D06.14.fechar_l | d_fat | Conta de Lúcia: em_conferencia → fechada | ok | {"id": "7302ac36-383c-4898-a971-4f73648cfc2e", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:18:31.723085+00:00", "cbo": "225125", "cid": null, "nome": "ATENDI… | ok |
| D06.14.congelados | banco | Contas fechadas com itens congelados; total de referência de cada uma | ok | Jonas Teste Evasão: fechada, 1 itens congelados, total nulo; Lúcia Teste Observação: fechada, 3 itens congelados, total 11.63 | ok |
| D06.B1.ficha | d_rec | Borda: paciente que sai antes da triagem (ficha aberta) | ok | d64fb716-7ce8-47d9-a9e4-3ba9a90d0da0 | ok |
| D06.B1.evasao_antes_triagem | d_plant_a | Borda: evasão antes da triagem (momento antes_triagem) | ok | P0001: O episódio não está em atendimento. | **falha** |
| D06.B2.rascunho_descartado | d_plant_a | Evasão durante o atendimento com rascunho de SOAP: o rascunho é descartado | existir | Coberto pelo código: registrar_desfecho apaga atendimento_rascunhos do episódio (DELETE no fim da RPC); não exercitado nesta rodada. | lacuna |
| D06.B4.cancelar_alta | d_med_obs | Alta desfeita (cancelar_alta) da evasão cancela a contrarreferência | existir | Não exercitado nesta rodada (coorte F5 #9 cobre). | lacuna |
| D06.14.fechar_sem_cnes | d_fat | Fechar a conta de Lúcia: a UPA Bloco D não tem CNES (pendência bloqueante; deve ser recusado) | erro:A conta tem 1 pendência(s) bloqueante(s) | recusado: A conta tem 1 pendência(s) bloqueante(s): CNES da unidade ausente ou fora do formato (7 dígitos). Corrija na origem ou peça ao gestor a liberação do fechamento. | ok |
| D06.14.liberar_l | d_ges | Gestor libera o fechamento com motivo (unidade de teste sem CNES) | ok | {"id": "7302ac36-383c-4898-a971-4f73648cfc2e", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:18:31.723085+00:00", "cbo": "225125", "cid": null, "nome": "ATENDI… | ok |
| D06.B1.retirar_da_fila | d_rec | Borda: o caminho do produto é retirar da fila com motivo evasão (justificativa ≥ 15) | ok | (sem retorno: void) | ok |
| D06.B1.conta_sem_itens | d_fat | Episódio encerrado como evasão, conta sem itens | ok | (sem retorno: void) | ok |
| D06.B1.conta_sem_itens_banco | d_fat | Conferência refeita (a anterior voltou vazia pelo RLS do episódio): conta do episódio retirado da fila, sem itens | ok | ok: conta aberta com 0 itens | ok |

#### Passos do D07

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D07.01.ficha | f5_rec_upa | Recepção abre a ficha de Benedita no Pronto Socorro | ok | 285df1d2-0650-458c-9804-5d30b677f98b | ok |
| D07.01.paciente | banco | Paciente da ficha | ok | f58af1df-20a3-412d-9046-6e101c4638c2 | ok |
| D07.01.conta | banco | Conta ambulatorial aberta | ok | e10be066-8d61-45aa-b493-f035b3bfb505 | ok |
| D07.02.chamar | f5_enf_upa | Enfermeira chama Benedita | ok | {"aviso": false, "numero": 1} | ok |
| D07.02.classificar | f5_enf_upa | Classifica: "Mal-estar geral" (adulto), sinais crus; cor laranja = escolha da enfermeira de teste | ok | 257394c0-2b93-424b-8a24-7c599380bbdb | ok |
| D07.03.iniciar | f5_med_upa | Médico assume Benedita | ok | (sem retorno: void) | ok |
| D07.03.peso | f5_med_upa | Peso estimado antes de prescrever (paciente rebaixada; valor cru) | ok | 1 sinais gravados | ok |
| D07.03.soap | f5_med_upa | SOAP com CID de meningite (G03.9) | ok | 089da33e-8e67-496e-99ca-7bbbc1b59371 | ok |
| D07.03.exame | f5_med_upa | Pede exame urgente (nome livre: a UPA F5 não tem lista de exames) | ok | 1 | ok |
| D07.03.prescrever | f5_med_upa | Prescreve dipirona injetável do catálogo, "Agora"; dose = texto de teste (a dose real é a da tela, de fonte citada) | ok | 48c08e4a-5692-41b9-9493-328f6561eea9 | ok |
| D07.04.agravo | f5_med_upa | Marca a suspeita de meningite (CID G03.9, que bate com o item 17b da LNNC) | ok | 7feb221d-5e6b-4f94-bf09-414cfc46bc8e | ok |
| D07.05.regulacao | f5_med_upa | Solicita transferência: emergência, SIGTAP 0303010037, CID G03.9, transporte avançado | ok | 23cf02d9-263e-496d-913d-854486b22261 | ok |
| D07.06.assumir | f5_regulador | Regulador assume: em análise | ok | {"id": "23cf02d9-263e-496d-913d-854486b22261", "cbo": null, "cid": "G03.9", "sla": {"fila": {"atrasado": false, "correndo": true, "prazo_min": 1, "central_seg": 0}, "des… | ok |
| D07.07.aprazar | f5_enf_upa | Enfermeira apraza a dose para agora | ok | (sem retorno: void) | ok |
| D07.07.checar | f5_enf_upa | Checa a dose "feito" | ok | 82a9890a-123e-40b9-bf64-a29af2fd1097 | ok |
| D07.08.abrir | f5_enf_upa | Enfermeira abre a notificação do agravo (devolve a suspeita já marcada) | ok | 7feb221d-5e6b-4f94-bf09-414cfc46bc8e | ok |
| D07.08.mesma_suspeita | banco | A notificação aberta é a mesma suspeita marcada pelo médico (não duplica) | ok | ok: agravo 7feb221d-5e6b-4f94-bf09-414cfc46bc8e | ok |
| D07.08.salvar_sem_7 | f5_enf_upa | Salva a ficha com o campo 7 (data dos sintomas) vazio | ok | {"Campo 7: data dos primeiros sintomas.","Campo 12: gestante (obrigatório para o sexo feminino)."} | ok |
| D07.08.registrar_sem_7 | f5_enf_upa | Tenta registrar sem os campos 7 e 12 (deve listar as faltas pelo número do campo) | erro:Falta para registrar: Campo 7 | recusado: Falta para registrar: Campo 7: data dos primeiros sintomas. Campo 12: gestante (obrigatório para o sexo feminino). | ok |
| D07.09.registrar | f5_enf_upa | Preenche 7 (sintomas há 6 h, não futura), 8, 9, 11 e 12 (gestante: 6 = não se aplica) e registra com o nº do SINAN | ok | (sem retorno: void) | ok |
| D07.09.notificado | banco | Situação notificado; notificador = login da enfermeira; nº do SINAN gravado | ok | ok: situação notificado, nº 2026110700 | ok |
| D07.15.nir_antes | f5_nir | Antes da decisão: a regulação de Benedita aparece nas pendências do NIR da UPA? | ok | P0001: não aparece (a pendência de regulação só surge depois do prazo) | **falha** |
| D07.10.sem_do | f5_med_upa | Óbito sem o número da DO (deve ser recusado) | erro:Informe o número da Declaração de Óbito | recusado: Informe o número da Declaração de Óbito. | ok |
| D07.13.hora_futura | f5_med_upa | Óbito com hora no futuro (+5 min) (deve ser recusado) | erro:Hora do óbito no futuro | recusado: Hora do óbito no futuro. | ok |
| D07.13.do_4_digitos | f5_med_upa | Óbito com DO de 4 dígitos (deve ser recusado) | erro:Óbito: o número da Declaração de Óbito … | recusado: Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos. | ok |
| D07.11.obito | f5_med_upa | Óbito: relato ≥ 15, hora −10 min, CID G03.9, DO 123456789, sem setor (vem da ficha) | ok | (sem retorno: void) | ok |
| D07.11.registro | banco | Episódio encerrado; CID normalizado, DO só dígitos, setor do óbito da ficha; exame cancelado com o motivo; prescrição encerrada | ok | ok: cid G03.9, DO 123456789, setor Pronto Socorro, exames: cancelado (Óbito: exame cancelado sem resultado.) | ok |
| D07.12.sumario | f5_med_upa | Emite o sumário de óbito (documento clínico) | ok | {"id": "5ad92237-5ff5-4548-92ad-082561763df3", "numero": "2026/000017", "versao": 1, "episodio_id": "285df1d2-0650-458c-9804-5d30b677f98b"} | ok |
| D07.12.documento | banco | documentos_clinicos tipo sumario_obito, autor = login do médico | ok | 22P02: invalid input syntax for type uuid: "{"id": "5ad92237-5ff5-4548-92ad-082561763df3", "numero": "2026/000017", "versao": 1, "episodio_id": "285df1d2-0650-458c-9804-… | **falha** |
| D07.14.regulacao_segue | banco | Depois do óbito, a regulação continua em análise (nada a cancela) | ok | ok: status em_analise depois do óbito | ok |
| D07.14.obito_cancela_regulacao | f5_regulador | O óbito encerra a regulação em curso | existir | Lacuna (MAPA) confirmada: registrar_desfecho(obito) cancela exames e pareceres, mas não toca regulacao_solicitacoes; o regulador nega à mão (ja_atendido_obito) ou a orig… | lacuna |
| D07.14.negar | f5_regulador | Regulador nega com motivo ja_atendido_obito | ok | {"id": "23cf02d9-263e-496d-913d-854486b22261", "cbo": null, "cid": "G03.9", "sla": null, "tipo": "transferencia", "exames": null, "numero": 111, "origem": {"id": "f51000… | ok |
| D07.14.negada | banco | Regulação negada, com evento | ok | ok: status negada, 3 eventos | ok |
| D07.15.nir_depois | f5_nir | Depois da negação, a regulação da falecida não está nas pendências do NIR | ok | ok: fora das pendências | ok |
| D07.16.itens | f5_fat | Itens da conta: classificação, consulta e administração; exame e medicamento sem valor | ok | ok: total 11.63; itens 3; medicamentos 1 | ok |
| D07.16.conferencia | f5_fat | aberta → em_conferencia | ok | {"id": "e10be066-8d61-45aa-b493-f035b3bfb505", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:24:18.326976+00:0 | ok |
| D07.16.fechar | f5_fat | em_conferencia → fechada (o óbito libera o fechamento) | ok | {"id": "e10be066-8d61-45aa-b493-f035b3bfb505", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:24:18.326976+00:0 | ok |
| D07.16.congelado | banco | Itens congelados e total | ok | ok: fechada, 3 itens, total 11.63 | ok |
| D07.17.notificacoes | f5_ges_upa | Gestor lê a notificação do período: notificado com o nº do SINAN | ok | ok: (agravo:7feb221d-5e6b-4f94-bf09-414cfc46bc8e,"2026-11-07 03:24:18.326976+00",f58af1df-20a3-412d-9046-6e101c4638c2,"Benedita Teste Óbito","Pronto Socorro · atendiment… | ok |
| D07.17.panorama | f5_ges_upa | Gestor lê o panorama do dia (óbitos) | ok | {"n": {"leitos": 17, "altas_7d": 5, "altas_mes": 5, "evasoes_7d": 2, "internados": 2, "porta_agora": 2, "sem_checkin": 0, "admissoes_7d": 7, "desfechos_7d": 29, "checkin… | ok |
| D07.17.painel_admin | f5_admin | Admin: óbitos da UPA F5 no período, agregados e suprimidos de 1 a 4 | ok | (f5100000-0000-4000-8000-000000000002,"UPA Fase 5 24h",17,,,,,26,23,,,13,) | ok |
| D07.B1.obito_notificacao_aberta | f5_med_upa | Óbito com a notificação ainda a_registrar (passos 9 e 11 invertidos) | existir | Não exercitado nesta rodada (exige outro episódio). Pelo código, o agravo suspeito sem notificação é o único que continua impedindo a alta da internação (dar_alta); na p… | lacuna |
| D07.B2.obito_internado | f5_med_upa | Óbito de internado: dar_alta(obito) encerra o que está aberto | existir | Não exercitado nesta rodada (sem internação de teste livre). | lacuna |
| D07.L1.sinan | f5_enf_upa | Envio ao SINAN e mapeamento CID → agravo conferido pela vigilância | existir | Lacuna (MAPA): o nº do SINAN é digitado; lnnc_cids traz "a conferir pela vigilância". | lacuna |
| D07.12.documento_refeito | banco | Conferência refeita (o passo D07.12.documento leu o retorno jsonb como uuid): sumário de óbito ativo, autor = login do médico | ok | ok: tipo sumario_obito, nº 2026/000017, estado ativo, autor f5200000-0000-4000-8000-000000000008 | ok |

#### Passos do D08

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D08.00.ficha | d_rec | Recepção abre a ficha de Pedro | ok | e1c17938-713e-453e-90aa-279105844e9b | ok |
| D08.00.paciente | banco | Paciente da ficha | ok | ff3bbe52-bade-4027-b32e-b0006f0f89e8 | ok |
| D08.00.chamar | d_enf | Enfermeira chama Pedro | ok | {"aviso": false, "numero": 1} | ok |
| D08.00.classificar | d_enf | Classifica: "Diarreia e vômitos" (adulto), sinais crus; cor verde = escolha da enfermeira de teste | ok | d9681db0-3ea3-445b-ae0c-262eab54081c | ok |
| D08.00.iniciar | d_plant_a | Plantonista A assume | ok | (sem retorno: void) | ok |
| D08.00.soap | d_plant_a | SOAP com CID E86 (desidratação) | ok | 7972c09f-4bb1-49aa-8fb4-f69bc93392ed | ok |
| D08.00.observacao | d_plant_a | Desfecho observação (box da Observação D) | ok | (sem retorno: void) | ok |
| D08.00.internacao | banco | Internação de observação | ok | 5fc20344-f504-4a36-b8f8-9f2170b323e7 | ok |
| D08.00.chegou_antes |  | Pedro chegou 3 h antes e está em observação há 2 h (datas do episódio e da internação levadas ao passado; paciente do bloco D) | ajuste | UPDATE public.episodios SET chegada_em = now() - interval '3 hours', classificado_em = now() - interval '170 minutes', atendimento_iniciado_em = now() - interval '150 mi… | ajuste |
| D08.01.liga_2fa |  | Liga exigir_segundo_fator SÓ dentro desta transação (volta a false no fim) | ajuste | UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator' | ajuste |
| D08.01.sem_2fa | d_enf_obs | Sem o 2º fator, chave_fila() recusa | erro:SEGUNDO_FATOR | recusado: SEGUNDO_FATOR: confirme o código do autenticador para continuar. | ok |
| D08.01.simula_codigo |  | Simula o código confirmado na sessão de teste do enfermeiro da Observação D | ajuste | INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em) VALUES ('a71294be-0f01-42e0-9b6b-44c28c5076ce', 'fd200000-0000-4000-8000-000000000011', … | ajuste |
| D08.01.com_2fa | d_enf_obs | Depois do 2º fator, chave_fila() entrega a chave (o valor não é registrado aqui) | ok | chave entregue (44 caracteres em base64) | ok |
| D08.01.uma_por_perfil | banco | private.chave_fila: uma linha por perfil; a mesma chave nas chamadas seguintes | ok | ok: 1 linha(s) do enfermeiro | ok |
| D08.01.desliga_2fa |  | exigir_segundo_fator volta a false (estado da homologação) | ajuste | UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator' | ajuste |
| D08.02.painel | d_enf_obs | Com rede, o enfermeiro da Observação D vê Pedro no painel | ok | ok: no painel | ok |
| D08.03.fila_cifrada | d_enf_obs | Fila IndexedDB cifrada (AES-GCM) com "na fila" e hora do aparelho corrigida | existir | Só na tela (DevTools → Offline): fila.ts, relogio.ts. | lacuna |
| D08.03.evolucao_enfermagem | d_enf_obs | Evolução de enfermagem como documento da fila (o catálogo espera aceitar; o servidor só aceita os tipos de folha da porta) | ok | P0001: Tipo de documento desconhecido. | **falha** |
| D08.09.sincronizar_sinal | d_enf_obs | Volta da rede: o enfermeiro envia a FC registrada há 10 min, sem conexão desde 20 min atrás | ok | ok: gravado | ok |
| D08.09.sincronizar_folha | d_med_obs | Volta da rede: a médica envia a folha provisória (atestado) emitida há 8 min sem conexão | ok | ok: gravado | ok |
| D08.09.hora_do_fato | banco | Gravados com o autor de cada um e a hora do fato (não a da chegada); marcados sem conexão; a folha ganha número | ok | ok: FC aferida às 00:21; folha atestado nº 2026/000001 emitida 00:23 | ok |
| D08.09.idempotente | d_enf_obs | Reenvio do mesmo sinal não duplica (ja_recebido) | ok | P0001: confere: ja_recebido | **falha** |
| D08.09.idempotente_folha | d_med_obs | Reenvio da mesma folha não duplica (ja_recebido) | ok | ok: ja_recebido | ok |
| D08.09.id_de_outro | d_med_obs | O mesmo id do sinal enviado por OUTRA pessoa é recusado (SYNC_ID_EM_USO) | erro:SYNC_ID_EM_USO | recusado: SYNC_ID_EM_USO: identificador já usado por outro registro. | ok |
| D08.04.tipo_prescricao | d_enf_obs | Item de prescrição/checagem na fila é recusado (SYNC_TIPO): só observação e documento | erro:SYNC_TIPO | recusado: SYNC_TIPO: tipo de registro não aceito (checagem). | ok |
| D08.04.mensagem_tela | d_enf_obs | Checar dose, prescrever ou dar desfecho sem rede: a tela recusa com mensagem | existir | Lacuna (MAPA): sem conexão só para observação e documento; o servidor recusa outros tipos (D08.04.tipo_prescricao); a mensagem é da tela. | lacuna |
| D08.07.limite_2h | d_enf_obs | Registro feito 2 h e 10 min depois do último contato: recusado (SYNC_LIMITE) | erro:SYNC_LIMITE | recusado: SYNC_LIMITE: registro feito depois de 2 h sem conexão. | ok |
| D08.B1.hora_futura | d_enf_obs | Borda: relógio do aparelho adiantado (hora no futuro) é recusado (SYNC_HORA_FUTURA) | erro:SYNC_HORA_FUTURA | recusado: SYNC_HORA_FUTURA: hora do registro no futuro. | ok |
| D08.05.recarga | d_enf_obs | Recarregar sem rede mantém a fila e o que a enfermagem leu | existir | Só na tela (ligarConsultasSemConexao, fila.ts). | lacuna |
| D08.06.outra_aba | d_enf_obs | Outra aba sem a chave em memória não lê a fila | existir | Só na tela: a chave fica só na memória da aba (o banco entrega por chave_fila, D08.01). | lacuna |
| D08.12.fim_plantao | d_enf_obs | Depois do fim do plantão + 20 min a fila fecha | existir | Regra de tela (regras.ts, tolerância do servidor = 20 min). No banco, o equivalente é SYNC_FORA_DO_PLANTAO (D08.12.fora_do_plantao). | lacuna |
| D08.12.fora_do_plantao | d_enf | Enfermeira da PORTA (sem plantão na Observação D) envia sinal de Pedro: SYNC_FORA_DO_PLANTAO | erro:SYNC_FORA_DO_PLANTAO | recusado: SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente. | ok |
| D08.08.contingencia | d_enf_obs | Contingência em papel de 50 a 30 min atrás, registrada na volta da rede | ok | P0001: Já existe contingência registrada neste período. | **falha** |
| D08.08.reentrada | d_enf_obs | Marca a reentrada do que veio do papel no atendimento de Pedro | ok | bloqueado pelo passo D08.08.contingencia (sem d08_cont) | lacuna |
| D08.08.sobreposta | d_enf_obs | Segunda contingência no mesmo período (deve ser recusada) | erro:Já existe contingência | recusado: Já existe contingência registrada neste período. | ok |
| D08.10.mais_24h | d_enf_obs | Dois registros feitos há 25 h (sem conexão há 25 h 30) chegam agora: vão à revisão, não ao prontuário | ok | ok: em_revisao; em_revisao | ok |
| D08.10.fora_do_prontuario | banco | Os itens de 25 h estão em sincronizacao_revisao e não em observacao/documentos_clinicos | ok | ok: 2 em revisão, nada no prontuário | ok |
| D08.11.enfermeiro_nao_decide | d_enf_obs | O enfermeiro não decide a revisão (deve ser recusado) | erro:Acesso negado | recusado: Acesso negado: só o gestor da unidade decide a revisão. | ok |
| D08.11.aceitar | d_ges | Gestor aceita o sinal vital: "conferido com o papel da contingência" | ok | (sem retorno: void) | ok |
| D08.11.recusar | d_ges | Gestor recusa a evolução com motivo | ok | (sem retorno: void) | ok |
| D08.11.resultado | banco | Aceito entra no prontuário com a hora do fato; recusado fica fora com motivo; decisões com autor | ok | ok: observacao: aceito (conferido com o papel da contingência); documento: descartado (registro duplicado do papel) | ok |
| D08.13.gestor_nao_troca | d_ges | Gestor tenta trocar a chave da fila do enfermeiro (deve ser recusado: só o administrador) | erro:Acesso negado: só o administrador | recusado: Acesso negado: só o administrador troca a chave da fila. | ok |
| D08.13.admin_troca | f5_admin | Administrador troca a chave da fila (aparelho perdido) | existir | A UPA Bloco D não tem administrador; o admin.f5 só administra a Secretaria F5. A recusa para quem não é admin está acima; o aceite fica no D12 (só se houver conta do blo… | lacuna |
| D08.99.alta | d_med_obs | Fim do cenário: alta médica de Pedro (libera o box do bloco D) | ok | (sem retorno: void) | ok |
| D08.09.uma_linha | banco | Conferência refeita no banco (no passo D08.09.idempotente a contagem rodou como o enfermeiro e o RLS escondeu a linha): uma linha só do sinal depois do reenvio | ok | ok: 1 linha(s), autor fd200000-0000-4000-8000-000000000011 | ok |

#### Passos do D09

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D09.01.ficha | f5_rec_upa | Recepção abre a ficha de Helena antes da meia-noite (dia D), Pronto Socorro, queixa "falta de ar há 3 h" | ok | 523d09b7-99cf-4a8c-8a1d-4c9da01d7f6e | ok |
| D09.01.chegada_dia_d | f5_rec_upa | chegada_em na data de Brasília do dia D | ok | ok: chegada 06/11 23:40 | ok |
| D09.02.chamar | f5_enf_upa | Enfermeira chama Helena para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| D09.02.classificar | f5_enf_upa | Classifica antes da meia-noite: fluxograma "Queixas respiratórias" (adulto), sinais crus; cor amarelo = escolha da enfermeira de teste | ok | 820a0dd6-dc6a-4f4b-a178-c5416b0b0456 | ok |
| D09.03.plantao_segue | f5_med_upa | Depois da meia-noite o plantão da noite (início no dia D) segue aberto para o médico: turno_atual e meu_plantao_agora | ok | ok: turno noite; plantão noite Pronto Socorro de 06/11 19:00 a 07/11 07:00 | ok |
| D09.03.iniciar | f5_med_upa | Médico assume Helena depois da meia-noite (dia D+1) | ok | (sem retorno: void) | ok |
| D09.03.soap | f5_med_upa | SOAP com CID R06.0 (dispneia) | ok | d1817228-d40f-4bdb-8c94-507fb36a2e10 | ok |
| D09.04.exame | f5_med_upa | Pede um exame urgente (nome livre: a UPA F5 não tem lista de exames) | ok | 1 | ok |
| D09.04.reavaliar_25h | f5_med_upa | Reavaliação para daqui a 25 h (deve ser recusada: até 24 h) | erro:Hora da reavaliação fora do plantão | recusado: Hora da reavaliação fora do plantão (entre agora e as próximas 24 horas). | ok |
| D09.04.reavaliar | f5_med_upa | Reavaliação para daqui a 30 min (dia D+1) | ok | (sem retorno: void) | ok |
| D09.04.reavaliar_em | banco | reavaliar_em gravado na data D+1 de Brasília | ok | ok: reavaliar em 07/11 00:30 | ok |
| D09.05.observacao | f5_med_upa | Desfecho observação em D+1 (box livre da Observação Adulto) | ok | (sem retorno: void) | ok |
| D09.05.box | banco | Internação de observação aberta em D+1 e pendência de 6 h vencendo em D+1 | ok | f5a9b8f3-2d7c-41cf-84a3-b172005be205 | ok |
| D09.05.leito | banco | Box ocupado (nenhum dos leitos reservados a outros blocos) | ok | ok: box OA-04 (ocupado) | ok |
| D09.05.painel | f5_med_obs | O médico da observação vê Helena com o prazo de 6 h em D+1 | ok | ok: (f5a9b8f3-2d7c-41cf-84a3-b172005be205,e6c6fa9f-9c93-4bb9-bc1c-d9b3ee79f6de,523d09b7-99cf-4a8c-8a1d-4c9da01d7f6e,"Helena Teste Meia-Noite",2000-01-01,F,f5300000-0000-… | ok |
| D09.08.finalizar | f5_med_obs | Médico da observação encerra com alta médica, CID R06.0 e relato (D+1) | ok | (sem retorno: void) | ok |
| D09.08.encerrado_d1 | banco | Desfecho e encerramento na data D+1 de Brasília; chegada e classificação ficam no dia D | ok | ok: chegada 06/11 23:40; classificação 06/11 23:40; encerrado 07/11 00:02 | ok |
| D09.06.escala_noite | d_ges | Gestor do bloco D escala a plantonista A na noite do dia D (19h–07h) na UPA Bloco D | ok | 408e1dca-6fda-4f95-a35a-4722344260bb | ok |
| D09.06.checkin_madrugada | d_plant_a | Plantonista A faz o check-in depois da meia-noite (atrasado, no plantão da noite de D) | ok | 1298b2cc-d11c-49dc-857d-51ec84985f48 | ok |
| D09.06.data_do_turno | banco | A presença fica com a data do turno = dia D (a noite começou ontem), sem duplicar | ok | ok: presença data 2026-11-06, turno noite, check-in 07/11 00:00 | ok |
| D09.07.presencas | d_ges | Gestor lê as presenças: a noite de D aparece uma vez, com o check-in da madrugada | ok | (fd200000-0000-4000-8000-000000000004,"Enfermeira Bloco D",enfermeiro,t,"2026-11-07 02:55:24.13242+00",,,,,,,f,) | ok |
| D09.F1.data_do_turno | banco | private.data_do_turno: 00h45 e 06h59 caem no dia anterior; 07h00 e 23h59 no próprio dia; 03h de 1º/01 cai em 31/12; madrugada de 1º/03/2028 cai em 29/02 | ok | ok: D-1 antes das 7h (Brasília, não UTC): 07/11 00h45 → 2026-11-06; 01/01/2027 03h → 2026-12-31; 01/12 05h30 UTC (02h30 BRT) → 2026-11-30 | ok |
| D09.F2.competencia | banco | private.competencia_de: 30/11 23h50 → 202611; 01/12 00h05 → 202612; 01/12 02h50 UTC (= 30/11 23h50 de Brasília) → 202611; 31/12 23h59 → 202612; 01/01 00h01 → 2… | ok | ok: competências pela data de Brasília: 202611, 202612, 202611, 202701 | ok |
| D09.F3.inicio_turno | banco | private.inicio_do_turno: a noite de 31/12 começa 31/12 19h e dura 12 h (atravessa o ano); a madrugada de 01/01 (grade de 6 h) começa em 01/01 01h | ok | ok: noite 31/12 → 31/12/2026 19:00 por 720 min; madrugada 01/01 → 01/01/2027 01:00 | ok |
| D09.F4.sem_horario_verao | banco | America/Sao_Paulo sem horário de verão: -03 em janeiro e em novembro | ok | ok: UTC-3 nos dois meses | ok |
| D09.11.fechar_futura | d_fat | Fechar a competência do mês seguinte enquanto ela não começou (deve ser recusado) — na UPA Bloco D, para não tocar a UPA F5 | erro | recusado: O processamento não pode ser antes da competência de realização. | ok |
| D09.10.bpa_dois_meses | f5_fat | BPA de dois meses com a classificação em D (último dia do mês) e a consulta em D+1 | existir | Fim de mês só na data real (MAPA): esta rodada caiu em 06→07/11, mesmo mês. A regra foi conferida por parâmetro em D09.F2 (competencia_de com instantes de 30/11 e 01/12,… | lacuna |
| D09.13.avisos_ano_novo | f5_ges_upa | Avisos e indicadores às 00h05 de 1º de janeiro | existir | Fim de ano só na data real (MAPA). Avisos na data de Brasília ficam com os testes de banco VD (docs/virada-de-data/); na tela, só no dia. | lacuna |
| D09.14.apac_erp_ano | f5_fat | Validade da APAC que cruza o ano e plantões da noite de 31/12 no ERP | existir | Fim de ano só na data real. A data do turno da noite de 31/12 (dezembro) foi conferida em D09.F1 e D09.F3; a validade da APAC fica com os testes VD7. | lacuna |
| D09.12.pedido_23h55 | f5_ges_upa | Pedido de prontuário aprovado às 23h55 cruza a meia-noite | existir | Coberto no D10: valido_ate = decidido_em + 24 h, conferido por intervalo (a aprovação desta rodada não caiu às 23h55). | lacuna |
| D09.08.alta_com_exame_pendente | f5_med_obs | Alta com o exame ainda sem resultado (deve ser recusada: impeditivo) | erro:Existe(m) pendência(s) em aberto | recusado: Existe(m) pendência(s) em aberto: Exame sem resultado: Gasometria arterial (teste D09) | ok |
| D09.08.resultado | f5_med_obs | Registra o resultado (texto fictício de teste) do exame pedido na porta | ok | {"id": "d23e05d4-2dae-4e69-b953-93b85198a2da", "tipo": null, "exame": "Gasometria arterial (teste D09)", "origem": "manual", "critico": false, "versoes": [{"id": "2cbdbb… | ok |
| D09.99.higienizacao | f5_enf_obs | Fim do D09: enfermeira da observação conclui a higienização do OA-04 (o box que Helena usou volta a livre) | ok | (sem retorno: void) | ok |

#### Passos do D10

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D10.00.ficha_1 | f5_rec_upa | Ficha 1 de Rosa na UPA F5 (Dor no peito ao esforço) | ok | e876158b-d06d-48e6-9bf9-33e0499da563 | ok |
| D10.00.chamar_1 | f5_enf_upa | Chama Rosa | ok | {"aviso": false, "numero": 1} | ok |
| D10.00.classificar_1 | f5_enf_upa | Classifica (cor amarelo = escolha da enfermeira de teste), sinais crus | ok | 8a365449-289c-44ca-9584-416acca54bc6 | ok |
| D10.00.iniciar_1 | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| D10.00.soap_1 | f5_med_upa | SOAP com CID R07.4 | ok | 17900468-2e80-4c4f-aaa0-b578faf62447 | ok |
| D10.00.alta_1 | f5_med_upa | Alta do 1º atendimento | ok | (sem retorno: void) | ok |
| D10.00.ficha_2 | f5_rec_upa | Ficha 2 de Rosa na UPA F5 (Tontura ao levantar) | ok | 149e57d6-8210-42d8-9ddf-ecb7bf5e1e03 | ok |
| D10.00.chamar_2 | f5_enf_upa | Chama Rosa | ok | {"aviso": false, "numero": 1} | ok |
| D10.00.classificar_2 | f5_enf_upa | Classifica (cor verde = escolha da enfermeira de teste), sinais crus | ok | 06b71dfb-0636-421d-bf94-824caa8ff89a | ok |
| D10.00.iniciar_2 | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| D10.00.soap_2 | f5_med_upa | SOAP com CID R42 | ok | ed495242-ce50-4c03-9a2e-f28f7d0ae5f4 | ok |
| D10.00.alta_2 | f5_med_upa | Alta do 2º atendimento | ok | (sem retorno: void) | ok |
| D10.00.ficha_ubs | f5_rec_ubs | Ficha de escuta inicial de Rosa na UBS F5 | ok | c367f48e-b0ad-4a4d-9b00-c135c2ea6696 | ok |
| D10.00.escuta_ubs | f5_enf_ubs | Escuta azul (escolha da enfermeira de teste) com orientação: encerra na UBS | ok | 8b47b37d-8a85-45ae-a16d-710fb1b55321 | ok |
| D10.00.pac_ubs | banco | Cadastro de Rosa na UBS (outro registro de paciente) | ok | a9fc1734-3c8e-471f-9f07-cddb57882020 | ok |
| D10.01.buscar | f5_med_int | Médica da Internação busca Rosa (nome + nascimento) para pedir acesso | ok | ok: achada | ok |
| D10.01.pedir | f5_med_int | Pede acesso: "revisar internação anterior para parecer" | ok | a437cd78-aaff-4bfc-943e-f72cdd9c24e1 | ok |
| D10.01.pendente | banco | Pedido pendente, sem validade | ok | ok: status pendente | ok |
| D10.02.repetir | f5_med_int | Repete o pedido (deve ser recusado: já há um pendente) | erro:Já existe um pedido seu aguardando | recusado: Já existe um pedido seu aguardando o gestor para este paciente. | ok |
| D10.03.abrir_antes | f5_med_int | Tenta abrir antes da decisão (deve ser recusado) | erro | recusado: Acesso negado: paciente fora dos setores do seu plantão. | ok |
| D10.04.motivo_curto | f5_med_int | Motivo de 8 letras em outra paciente encerrada (deve ser recusado) | erro:Escreva o motivo do pedido | recusado: Escreva o motivo do pedido (pelo menos 10 caracteres). | ok |
| D10.05.lista_gestor | f5_ges_upa | O pedido aparece para o gestor da UPA | ok | ok: na lista | ok |
| D10.05.aprovar | f5_ges_upa | Gestor aprova | ok | aprovado | ok |
| D10.05.validade | banco | aprovado, valido_ate = decidido_em + 24 h, decidido_por = gestor (cruza a meia-noite sem encurtar) | ok | ok: válido até 08/11 00:34 (decidido 07/11 00:34) | ok |
| D10.06.abrir | f5_med_int | Abre e lê o prontuário encerrado (só leitura) | ok | (sem retorno: void) | ok |
| D10.06.log | banco | log_acesso_prontuario registra quem e quando | ok | ok: 1 acesso(s) da médica da Internação | ok |
| D10.06.so_leitura | f5_med_int | Nenhuma ação de escrita na tela do prontuário encerrado | existir | Só na tela (ProntuarioLeitura.tsx). | lacuna |
| D10.07.vence |  | O pedido aprovado vence (valido_ate = agora − 1 min; pedido do bloco D) | ajuste | UPDATE public.pedidos_acesso_prontuario SET valido_ate = now() - interval '1 minute' WHERE id = 'a437cd78-aaff-4bfc-943e-f72cdd9c24e1' | ajuste |
| D10.07.abrir_vencido | f5_med_int | Com o pedido vencido, abrir é recusado | erro | recusado: Acesso negado: paciente fora dos setores do seu plantão. | ok |
| D10.07.meus_pedidos | f5_med_int | meus_pedidos_acesso mostra o pedido como não vigente | ok | ok: vigente = false | ok |
| D10.08.pedir_tecnico | f5_tec_ubs | Técnico da UBS pede acesso ao cadastro de Rosa na UBS | ok | P0001: Você já tem acesso a este paciente pela escala. | **falha** |
| D10.08.recusar_sem_motivo | f5_ges_ubs | Gestor da UBS recusa sem motivo (deve ser recusado) | erro:Para recusar, escreva o motivo | bloqueado pelo passo D10.08.pedir_tecnico (sem d10_pedido_tec) | lacuna |
| D10.08.recusar | f5_ges_ubs | Gestor da UBS recusa: "sem vínculo com o cuidado" | ok | bloqueado pelo passo D10.08.pedir_tecnico (sem d10_pedido_tec) | lacuna |
| D10.08.tecnico_ve | f5_tec_ubs | O técnico vê a recusa e o motivo em meus_pedidos_acesso | ok | bloqueado pelo passo D10.08.pedir_tecnico (sem d10_pedido_tec) | lacuna |
| D10.09.gestor_nao_pede | f5_ges_upa | Gestor tenta pedir acesso (deve ser recusado) | erro:Acesso negado: seu papel | recusado: Acesso negado: seu papel nesta unidade não pede acesso a prontuário. | ok |
| D10.09.pedido_do_gestor |  | Pedido gravado no banco em nome do gestor do bloco D (a RPC não deixa o gestor pedir), para conferir a regra "ninguém decide o próprio" | ajuste | INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo) VALUES ('fd000000-0000-4000-8000-000000000001', 'fd… | ajuste |
| D10.09.decidir_proprio | d_ges | Gestor tenta decidir o próprio pedido (deve ser recusado) | erro:Ninguém decide o próprio pedido | recusado: Ninguém decide o próprio pedido. | ok |
| D10.09.cancela_pedido_do_gestor |  | O pedido de teste do gestor é cancelado (não fica pendente) | ajuste | UPDATE public.pedidos_acesso_prontuario SET status = 'cancelado' WHERE id = '142682b8-8875-45dc-acc3-3787fb09f3b0' | ajuste |
| D10.10.gestor_le | f5_ges_upa | Gestor abre o prontuário de Rosa sem pedido | ok | (sem retorno: void) | ok |
| D10.10.log_gestor | banco | log_acesso_prontuario registra o gestor | ok | ok: 1 acesso(s) do gestor | ok |
| D10.11.farm_pede | f5_farm | Farmacêutico tenta pedir (deve ser recusado) | erro:Acesso negado: seu papel | recusado: Acesso negado: seu papel nesta unidade não pede acesso a prontuário. | ok |
| D10.11.farm_abre | f5_farm | Farmacêutico tenta abrir (deve ser recusado) | erro | PASSOU sem erro (deveria ser recusado): | **falha** |
| D10.11.rota | f5_farm | A rota /prontuarios não aparece no menu do farmacêutico (RequireRole) | existir | Só na tela. | lacuna |
| D10.00.ficha_3 | f5_rec_upa | Ficha 3 de Rosa na UPA F5 (Dor no peito há 1 h) | ok | 0037d457-41ed-4115-afcc-75f76b9bc4b7 | ok |
| D10.00.chamar_3 | f5_enf_upa | Chama Rosa | ok | {"aviso": false, "numero": 1} | ok |
| D10.00.classificar_3 | f5_enf_upa | Classifica (cor laranja = escolha da enfermeira de teste), sinais crus | ok | 0f0e57aa-3327-46ef-8a24-cffe88fd031f | ok |
| D10.00.iniciar_3 | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| D10.00.soap_3 | f5_med_upa | SOAP com CID R07.4 | ok | 62cedfec-79fc-4315-8133-d639968ca83f | ok |
| D10.13.historico | f5_med_upa | Quem cuida agora vê o resumo dos encerrados desta unidade sem pedido (sem o episódio da UBS) | ok | ok: {"atendimentos": [{"id": "e876158b-d06d-48e6-9bf9-33e0499da563", "cid": "R07.4", "cor": "amarelo", "setor": "Pronto Socorro", "medico": "Médico UPA F5", "cadastro": … | ok |
| D10.14.abrir_historico | f5_med_upa | Abre o detalhe com motivo "comparar ECG com o episódio anterior" (12 h) | ok | 2026-11-07 15:34:37.140713+00 | ok |
| D10.14.registro | banco | private.acessos_historico com quem, motivo e validade de 12 h | ok | ok: 1 acesso(s) com motivo | ok |
| D10.15.motivo_curto | f5_med_upa | Motivo de 6 letras (deve ser recusado) | erro:Escreva o motivo | recusado: Escreva o motivo para abrir o histórico (mínimo de 10 letras). | ok |
| D10.16.nao_cuida | f5_med_int | Quem não cuida de Rosa agora não lê o histórico (deve ser recusado) | erro | recusado: Acesso negado: o histórico aparece para quem cuida do paciente agora. | ok |
| D10.17.pedir_de_novo | f5_med_int | Novo pedido da médica da Internação (o anterior venceu) | ok | 4ed24a55-b356-4413-8b64-b58ec179e5be | ok |
| D10.17.cancelar | f5_med_int | Cancela o próprio pedido pendente | ok | (sem retorno: void) | ok |
| D10.17.cancelado | banco | status cancelado | ok | ok: status cancelado | ok |
| D10.99.alta_3 | f5_med_upa | Fim do cenário: alta do 3º atendimento | ok | (sem retorno: void) | ok |
| D10.L1.prazo_gestor | f5_ges_upa | Prazo para o gestor decidir e expiração do pedido pendente | existir | Lacuna (MAPA): não existe; um pendente fica pendente até alguém agir. | lacuna |
| D10.L2.telemedicina | f5_tele | Pedido feito pela telemedicina | existir | Não exercitado nesta rodada (a conta telemedicina.f5 existe desde o 46). | lacuna |
| D10.00.datas_anteriores |  | Atendimentos encerrados de Rosa (1, 2, 3 e UBS) levados 3 dias para trás (paciente do bloco D) | ajuste | UPDATE public.episodios SET chegada_em = chegada_em - interval '3 days', classificado_em = classificado_em - interval '3 days', atendimento_iniciado_em = atendimento_ini… | ajuste |
| D10.11.causa | f5_farm | Evidência do achado: com todos os atendimentos de Rosa encerrados há 3 dias, o farmacêutico escalado no Pronto Socorro "pode atuar" nela, porque pacientes.seto… | ok | pode_atuar_no_paciente = true; paciente_em_cuidado_no_plantao = true; setor do cadastro = Pronto Socorro; episódios abertos = 0; último encerramento = 04/11 00:34 | ok |
| D10.08.causa | f5_tec_ubs | Evidência do achado na UBS: o técnico escalado no único consultório "pode atuar" no cadastro de Rosa encerrado há 3 dias | ok | pode_atuar_no_paciente = true; episódios abertos = 0 | ok |

#### Passos do D11

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D11.00.ficha_a1 | d_rec | Ficha de Maria (a1): Dor de garganta | ok | 2b64d357-f117-4a5f-98b4-ae598cced722 | ok |
| D11.00.chamar_a1 | d_enf | Chama Maria | ok | {"aviso": false, "numero": 1} | ok |
| D11.00.classificar_a1 | d_enf | Classifica (verde = escolha da enfermeira de teste), sinais crus | ok | 4d1c4ed0-7047-47b7-ab44-ad27abfe992e | ok |
| D11.00.iniciar_a1 | d_plant_a | Plantonista A assume | ok | (sem retorno: void) | ok |
| D11.00.soap_a1 | d_plant_a | SOAP com CID J02.9 | ok | 380b6817-f309-4560-b257-1cc1b827bcbe | ok |
| D11.00.alta_a1 | d_plant_a | Alta do atendimento a1 | ok | (sem retorno: void) | ok |
| D11.00.ficha_b_recusada | d_rec | Nova ficha com o mesmo nome e nascimento: a recepção é avisada da duplicidade provável | erro:FICHA_DUPLICATA_PROVAVEL | recusado: FICHA_DUPLICATA_PROVAVEL:78726e89-4498-4ba0-b4cf-d1a44d669acb Já existe cadastro com o mesmo nome e nascimento. | ok |
| D11.00.ficha_b1 | d_rec | Ficha de Maria (b1): Dor nas costas | ok | 4544c0e9-cea7-4c74-9c3e-1751ba642496 | ok |
| D11.00.chamar_b1 | d_enf | Chama Maria | ok | {"aviso": false, "numero": 1} | ok |
| D11.00.classificar_b1 | d_enf | Classifica (verde = escolha da enfermeira de teste), sinais crus | ok | 3c6b37e4-b131-4e69-bab9-dd732a3f8e30 | ok |
| D11.00.iniciar_b1 | d_plant_a | Plantonista A assume | ok | (sem retorno: void) | ok |
| D11.00.soap_b1 | d_plant_a | SOAP com CID M54.5 | ok | fea1f693-c27d-4734-9d22-6dbe03692515 | ok |
| D11.00.alergia_b | d_plant_a | Alergia a dipirona registrada no cadastro B | ok | 12fd40d9-c483-41e7-889a-243ac4bc67b0 | ok |
| D11.00.alta_b1 | d_plant_a | Alta do atendimento b1 | ok | (sem retorno: void) | ok |
| D11.01.candidatos | d_rec | O par A/B aparece entre os candidatos (nome + nascimento) | ok | ok: par listado | ok |
| D11.02.pedir | d_rec | Recepção pede a unificação: principal A, absorvido B | ok | 7f4b484a-5653-4bd6-9a1c-80d310c86caf | ok |
| D11.03.recepcao_decide | d_rec | Recepção tenta decidir o próprio pedido (deve ser recusado) | erro | recusado: Acesso negado: só o gestor da unidade decide a unificação. | ok |
| D11.04.alergia_so_em_b | d_ges | Gestor aprova com a alergia ativa só em B (deve ser recusado) | erro | recusado: O cadastro absorvido tem alergia ativa que não está no principal (Dipirona). Registre no cadastro principal e depois unifique. | ok |
| D11.05.alergia_a | d_plant_a | A mesma alergia registrada no cadastro A | ok | ed65c859-f2e9-428d-aa08-2c49b154de37 | ok |
| D11.06.ficha_a | d_rec | Ficha aberta em A | ok | e2a81afe-74fa-46ec-a7aa-7b24ddb58763 | ok |
| D11.06.ficha_b | d_rec | Ficha aberta em B | ok | 169b4314-5688-40ed-a63c-9fdcdd3cae4c | ok |
| D11.06.aberto_nos_dois | d_ges | Gestor aprova com atendimento aberto nos dois (deve ser recusado) | erro | recusado: Os dois cadastros têm atendimento aberto. Encerre o duplicado (Ficha duplicada) e depois unifique. | ok |
| D11.07.encerra_a | d_rec | Encerra a ficha de A (retirada da fila: evasão, justificativa ≥ 15) | ok | (sem retorno: void) | ok |
| D11.07.encerra_b | d_rec | Encerra a ficha de B (ficha duplicada) | ok | (sem retorno: void) | ok |
| D11.08.aprovar | d_ges | Gestor aprova a unificação | ok | aprovado | ok |
| D11.08.vinculo | banco | B inativo apontando para A; família {A, B}; CNS de A mantido; nenhum registro clínico mudou de paciente; auditoria | ok | 42883: operator does not exist: uuid @> uuid[] | **falha** |
| D11.09.busca | d_rec | Busca por "Maria Teste Duplicada": só A é oferecido para ficha nova | ok | ok: 1 cadastro(s) na busca | ok |
| D11.10.atendimento_a | banco | Novo atendimento de Maria (A): dor lombar | ok | segue | ok |
| D11.00.ficha_a3 | d_rec | Ficha de Maria (a3): Dor lombar há 2 dias | ok | 939b9dd7-c38a-4c05-bd25-58c9904fe4e8 | ok |
| D11.00.chamar_a3 | d_enf | Chama Maria | ok | {"aviso": false, "numero": 1} | ok |
| D11.00.classificar_a3 | d_enf | Classifica (verde = escolha da enfermeira de teste), sinais crus | ok | d95eae10-8eee-4a8a-9e7b-0e79b4e425e0 | ok |
| D11.00.iniciar_a3 | d_plant_a | Plantonista A assume | ok | (sem retorno: void) | ok |
| D11.00.soap_a3 | d_plant_a | SOAP com CID M54.5 | ok | 2e2ee53c-b588-468a-940f-505516652654 | ok |
| D11.11.historico_familia | d_plant_a | O histórico de A traz os encerrados de A e de B | ok | ok: {"atendimentos": [{"id": "169b4314-5688-40ed-a63c-9fdcdd3cae4c", "cid": null, "cor": null, "setor": "Pronto Socorro D", "medico": "Recepção Bloco D", "cadastro": "20… | ok |
| D11.11.cadastros | d_plant_a | cadastros_do_paciente(A) lista A e B | ok | ok: 2 cadastros | ok |
| D11.12.peso | d_plant_a | Peso referido (valor cru) antes de prescrever | ok | 1 sinais gravados | ok |
| D11.12.trava_alergia | d_plant_a | Prescrever dipirona em A: a trava de alergia barra (dose = texto de teste) | erro:ALERGIA | recusado: ALERGIA: o paciente tem alergia registrada a "Dipirona". Este item não foi prescrito. | ok |
| D11.13.pedir_b | d_med_obs | Médica da Observação D (fora do Pronto Socorro) pede acesso ao cadastro B | ok | 23679d42-6282-4d72-b92c-fa0f34b4f67c | ok |
| D11.13.aprovar | d_ges | Gestor aprova o pedido | ok | aprovado | ok |
| D11.13.abre_a_e_b | d_med_obs | O acesso vale para A e para B (a família) | ok | ; | ok |
| D11.14.desfazer | d_ges | Gestor desfaz: "cadastros de pessoas diferentes, erro da recepção" | ok | (sem retorno: void) | ok |
| D11.14.separados | banco | B volta a ativo, sem unificado_em; a família volta a ser só A | ok | 42883: operator does not exist: uuid @> uuid[] | **falha** |
| D11.15.pedir_de_novo | d_rec | Recepção pede de novo | ok | a282e35f-6a7f-4207-a68f-d4d99e649f79 | ok |
| D11.15.cancelar | d_rec | Recepção cancela o próprio pedido pendente | ok | (sem retorno: void) | ok |
| D11.16.gestor_pede | d_ges | Gestor pede a unificação | ok | b0f9062a-9bc0-49bb-99eb-cafe5fdb867c | ok |
| D11.16.aprova_proprio | d_ges | Gestor tenta aprovar o próprio pedido (deve ser recusado) | erro | recusado: Quem pediu não aprova o próprio pedido. | ok |
| D11.16.cancelar | d_ges | Gestor cancela o próprio pedido (não fica pendente) | ok | (sem retorno: void) | ok |
| D11.99.alta_a3 | d_plant_a | Alta do atendimento a3 | ok | (sem retorno: void) | ok |
| D11.B1.bordas | d_rec | Bordas: mãe + nascimento com e sem acento; CPF igual com nomes diferentes; dois absorvidos; SINAN com dados do principal | existir | Não exercitadas nesta rodada. | lacuna |
| D11.08.vinculo_auditoria | banco | Conferência refeita (D11.08.vinculo leu familia_paciente como array): a aprovação ficou na auditoria e no pedido, com autor = gestor; nenhum episódio mudou de … | ok | ok: pedido desfeito; ações na auditoria: aprovar_unificacao, desfazer_unificacao, pedir_unificacao | ok |
| D11.14.separados_refeito | banco | Conferência refeita: depois de desfazer, B ativo, sem unificado_em, e a família de A sem B | ok | ok: B ativo true, família de A: 1 | ok |

#### Passos do D12

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| D12.01.painel | f5_admin | painel_organizacao(30): uma linha por unidade, só contagens (nenhuma coluna de paciente) | ok | ok: 5 unidade(s): Central de Regulação Fase 5 [leitos 0, porta 0, chegadas 0, óbitos 0, evasões 0, expediente 1]; Hospital Fase 5 [leitos 12, porta 0, chegadas sup, óbit… | ok |
| D12.01.sem_paciente | banco | O retorno de painel_organizacao não tem coluna de nome, CNS ou CPF | ok | ok: TABLE(unidade_id uuid, unidade_nome text, leitos bigint, leitos_ocupados bigint, taxa_ocupacao numeric, porta_agora bigint, internados_agora bigint, chegadas_periodo… | ok |
| D12.02.supressao | f5_admin | Contagens de paciente de 1 a 4 saem nulas (suprimidas); zero fica zero | ok | ok: nenhuma contagem de 1 a 4; óbitos UPA F5 = suprimido; evasões UPA F5 = suprimido | ok |
| D12.02.suprimir | banco | private.suprimir: 0 → 0, 1 a 4 → nulo, 5 → 5 | ok | ok: ok | ok |
| D12.03.expediente | f5_admin | profissionais_em_expediente sai sem supressão (é profissional, não paciente) | ok | Central de Regulação Fase 5: 1; Hospital Fase 5: 4; Secretaria de Saúde F5: 3; UBS Fase 5: 4; UPA Fase 5 24h: 13 | ok |
| D12.04.prontuario | f5_admin | Admin tenta abrir o prontuário de uma paciente do bloco D (deve ser recusado) | erro | recusado: Acesso negado: paciente fora dos setores do seu plantão. | ok |
| D12.04.ficha | f5_admin | Admin tenta abrir ficha na UPA F5 (deve ser recusado) | erro | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| D12.04.classificar | f5_admin | Admin tenta classificar (deve ser recusado) | erro | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| D12.04.porta | f5_admin | Admin tenta ler a porta da UPA F5 com nomes (deve ser recusado) | erro | recusado: Acesso negado: só o gestor da unidade vê a porta. | ok |
| D12.04.rotas | f5_admin | RequireRole não abre /atendimento, /triagem, /recepcao, /prontuarios para o admin | existir | Só na tela. | lacuna |
| D12.05.criar_unidade | f5_admin | Admin cria a unidade fictícia "UBS Teste Admin D12" na organização F5 | ok | 0bf09e03-b2a3-4e58-9698-79a4b30f02b5 | ok |
| D12.05.editar_unidade | f5_admin | Admin edita a unidade e a DESATIVA (para não ficar na rede dos outros blocos) | ok | (sem retorno: void) | ok |
| D12.05.auditoria | banco | Unidade criada inativa na organização F5; criação e edição na auditoria com autor = admin | ok | ok: UBS Teste Admin D12 (desativada), ativo false, auditoria: unidade_criada, unidade_editada | ok |
| D12.B2.unidade_vazia | f5_admin | Borda: unidade recém-criada sem leitos aparece com zeros (não nula)? | ok | não aparece (inativa) | ok |
| D12.06.criar_chave | f5_admin | Admin cria chave da API com recurso financeiro (o segredo não é registrado aqui) | ok | 42501: Só a administração da plataforma cria chave de integração. | **falha** |
| D12.06.revogar_chave | f5_admin | Admin revoga a chave | ok | bloqueado pelo passo D12.06.criar_chave (sem d12_chave) | lacuna |
| D12.06.auditoria | banco | Criação e revogação da chave na auditoria | ok | bloqueado pelo passo D12.06.criar_chave (sem d12_chave) | lacuna |
| D12.06.segredo_uma_vez | f5_admin | O segredo da chave aparece uma vez só | existir | Só na tela (Integracoes.tsx). | lacuna |
| D12.07.escala | f5_admin | Admin lê a escala de novembro da UPA F5 | ok | P0001: Acesso negado: escala do gestor da unidade. | **falha** |
| D12.07.publicar | f5_admin | publicar_escala recusa como admin | existir | Não exercitado de propósito: se o admin pudesse publicar, mexeria na escala F5 usada pelos outros blocos. | lacuna |
| D12.08.chave_fila_fora | f5_admin | Admin tenta trocar a chave da fila de quem NÃO está nas suas unidades (enfermeiro do bloco D): recusa | erro:Acesso negado: só o administrador | recusado: Acesso negado: só o administrador troca a chave da fila. | ok |
| D12.08.chave_fila_aceita | f5_admin | Admin troca a chave da fila de alguém da sua unidade | existir | Não exercitado: as pessoas da Secretaria F5 são contas usadas pelos outros blocos. Pelo código, vale para admin de unidade onde a pessoa tem vínculo ativo, ou super admi… | lacuna |
| D12.09.zerar_fora | f5_admin | Admin tenta zerar o 2FA de quem NÃO está nas suas unidades (farmacêutica do bloco D): recusa | erro:Só o gestor da unidade da pessoa | recusado: Só o gestor da unidade da pessoa ou o super admin pode zerar o segundo fator. | ok |
| D12.09.zerar_aceita | f5_admin | Admin zera o 2FA de alguém da sua unidade | existir | Não exercitado (contas F5 dos outros blocos). Pelo código, zerar_segundo_fator aceita gestor OU admin da unidade da pessoa. | lacuna |
| D12.10.gestor_porta | f5_ges_upa | O gestor vê a porta com pacientes nomeados (o admin não, D12.04.porta) | ok | ok: {"hoje": {"evasoes": 1, "chegadas": 18, "alta_a_pedido": 0}, "etapas": {"triagem": {"n": 1, "espera_max_min": 25}, "altas_hoje": {"n": 12}, "observacao": {"n": | ok |
| D12.11.rede_contexto | f5_secretaria | Secretaria lê o contexto da rede, sem nomes dos pacientes de teste | ok | ok: {"papeis": ["secretaria"], "unidades": [{"id": "f5100000-0000-4000-8000-000000000003", "cnes": "9995036", "nome": "Hospital Fase 5"}, {"id": "f5100000-0000-4000-8000… | ok |
| D12.11.rede_faturamento | f5_fat_rede | Faturamento da rede lê a competência 202611, sem nomes de paciente | ok | ok: [{"aih": {"aprovada": 2}, "bpa": null, "apac": null, "unidade": {"id": "f5100000-0000-4000-8000-000000000003", "cnes": "9995036", "nome": "Hospital Fase 5"}, "apacs_… | ok |
| D12.11.mapa_vagas | f5_reg_regional | Regulação regional lê o mapa de vagas, sem nomes de paciente | ok | ok: {"agora": "2026-11-07T03:40:37.896283+00:00", "totais": [{"livre": 0, "total": 8, "tipo_leito": "clinico", "higienizacao": 3}, {"livre": 3, "total": 3, "tipo_leito":… | ok |
| D12.11.arquivo | f5_fat_rede | rede_baixar_arquivo de BPA fechado | existir | Não exercitado nesta rodada (depende de competência fechada; Storage). | lacuna |
| D12.12.limites | f5_admin | p_dias = 0 vale como 1 e p_dias = 400 vale como 365 | ok | ok: chegadas: 0 dias = 37, 1 dia = 37, 400 dias = 68, 365 dias = 68 | ok |
| D12.B1.so_unidades_do_admin | f5_admin | Borda: o admin comum só vê as unidades da sua organização (nenhuma do bloco D) | ok | ok: sem unidades de outra organização | ok |
