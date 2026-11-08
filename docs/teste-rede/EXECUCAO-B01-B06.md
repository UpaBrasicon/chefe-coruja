# Execução dos cenários B01 a B06 na homologação

Bloco B do catálogo (`CENARIOS-B-urgencia-regulacao.md`): urgência adulta, regulação, NIR, telemedicina e transferências. Teste de **fluxo**, com dados fictícios. Nenhuma dose foi escrita de memória (a dose é sempre o texto "conforme protocolo — dado fictício de teste de fluxo"), a cor da classificação é sempre a escolha da enfermeira de teste e nada foi corrigido no produto.

## Data, hora e ambiente

- **Quando:** de 06/11/2026, 23h54, a 07/11/2026, 02h31 (horário de Brasília). B01 a B05 rodaram entre 00h02 e 00h13 de 07/11; o B06 rodou em quatro fases, porque espera o tempo passar de verdade.
- **Ambiente:** homologação, Supabase `kswurfyxxvfydpjfrivy` (conferido em `supabase/.temp/project-ref` antes de cada execução). A produção não foi tocada.
- **Como rodou:** `41_checkin_fase5.sql` (check-in do plantão da noite) e depois cada cenário preparado por `scripts/e2e/homolog/preparar.mjs` e executado com `npx supabase db query --linked -f`. Cada execução é uma transação só. Cada passo roda **como a conta do papel** (role `authenticated` com as claims do JWT, RLS ligado), pelas mesmas RPCs das telas. O `47_framework_ampliacao.sql` não precisou rodar de novo: o `e2e.conta` já tinha todas as contas usadas.
- **Apoio novo (só no esquema `e2e`, igual nos seis scripts):** `e2e.bpasso` (passo com dependência; vira lacuna "bloqueado" se faltar o id de um passo anterior; papel `banco` = conferência como postgres; modo `registrar` só anota aceito/recusado; modo `desfazer` roda a borda e desfaz), `e2e.b_confere`, `e2e.b_falhar`, `e2e.b_guardar`, `e2e.b_cns`, `e2e.b_sinais`, `e2e.b_classificar_sql`, `e2e.b_item`, `e2e.b_conta_sql`, `e2e.b_conta_resumo_sql`, `e2e.b_status_sql`, `e2e.b03_prescrever`, `e2e.b05_cid_gravado`, `e2e.b06`, `e2e.b06_lacuna`, `e2e.b06_aviso_sql` e `e2e.b_como` (leitura como um papel, sem registrar passo). Nenhuma função do 04, 42, 47 ou 50 foi alterada; nenhuma conta extra foi criada (não houve `e2e.conta_b` nem `49b`).
- **Lições do A01 aplicadas:**
  - toda conferência do que a tela não mostra roda como `banco`, e um passo "ok" que devia guardar um id e volta vazio é **falha** (o "ok falso" do RLS);
  - a ficha do hospital abre na Porta do Hospital (48), com recepção, enfermeira e médico da porta; a admissão e o laudo são do médico da Clínica Médica;
  - a observação é acompanhada por `f5_med_obs` e `f5_enf_obs` (escalados nela).
- **Tempo dentro da transação:** como cada cenário B01–B05 roda numa transação só, o relógio do banco não anda dentro dele (`now()` é o mesmo em todos os passos). Por isso os tempos de `regulacao_indicadores` saem zerados e a ordem dos eventos só aparece pela ordem de inserção. O B06 não tem esse problema: as fases rodam em horas diferentes.

### Rodadas descartadas
- **B01, rodadas 1 e 2 (23h58 de 06/11 e 00h00 de 07/11, "Severino … (teste B01)" e "… B"):** erros **do script**, não do produto.
  - Rodada 1: a conferência do passo 15 exigia internação **e** conta de internação juntas. A conta não nasceu (é o achado P1-1), e a dependência travou o resto do cenário. O script passou a separar as duas conferências.
  - Rodada 2: não havia box livre na Observação Adulto (OA-01 ocupado pelo A01, OA-02 e OA-03 em higienização, OA-04 ocupado), e o desfecho abriu a observação **sem box**, o que é o comportamento do produto. A conferência exigia box; foi corrigida para aceitar "sem box".
  - As duas foram encerradas pelo próprio produto (passos `B01.L1` a `B01.L3`: alta da internação, fim da observação e contas da porta fechadas).
- **B03 e B05:** três passos refeitos depois da execução, com o motivo na tabela (o laudo de AIH pediu o CNS no B03; dois erros de script na conferência do CID sem ponto no B05). As linhas da primeira tentativa continuam em `e2e.resultados`.

## Resumo

| Cenário | Paciente fictício | Regulação | Status percorridos | ok | falha | lacuna |
|---|---|---|---|---|---|---|
| B01 Sepse | Severino Tavares da Luz (teste B01) C | nº 97, leito UTI adulto, destino **fora da rede** | `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` | 83 | 8 | 4 |
| B02 AVC | Dalva Rocha Mendonça (teste B02) | nº 100 (leito clínico) e nº 103 (transferência) | nº 100: `enviada → em_analise → pendencia → em_analise → aguardando_destino → em_analise → negada`; nº 103: `enviada → em_analise → devolvida → enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` | 60 | 1 | 0 |
| B03 SCA | Joaquim Ferraz Bittencourt (teste B03) | nº 104, transferência para o Hospital F5, leito CM-03 reservado | `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` | 72 | 4 | 7 |
| B04 Trauma | Rogério Lins Albuquerque (teste B04) | nº 105, transferência, paciente não identificado, leito UTI-01 reservado | `enviada → em_analise → aguardando_destino → autorizada → em_transito → falta` | 41 | 0 | 0 |
| B05 UBS | Marlene Siqueira Pontes (teste B05) | nº 107, consulta de neurologia (CBO 225112) | `enviada → em_analise → aguardando_destino → autorizada → realizada` | 41 | 3 | 1 |
| B06 SLA | Antônio Cardoso Peixoto (teste B06) | nº 95, leito clínico | `enviada → em_analise → pendencia → em_analise → aguardando_destino → cancelada` | 81 | 0 | 0 |

Os números contam só a rodada válida de cada cenário (B03 e B05 incluem os passos refeitos e as linhas da primeira tentativa). Falhas que são erro do script, já refeito, estão marcadas na seção do cenário.

Os 14 status: percorridos `enviada`, `em_analise`, `pendencia`, `devolvida`, `aguardando_destino`, `autorizada`, `em_transito`, `realizada`, `falta`, `negada` e `cancelada`. `rascunho`, `agendada` e `excluida` não são gravados por nenhuma RPC (lacuna do MAPA, confirmada: todo pedido nasce `enviada`).

## Achados

Nenhum achado P0. Cada achado diz se é **produto**, **ambiente** (rede de teste F5) ou **catálogo** (especificação ou MAPA).

### P1-1 — A observação que vira internação na UPA não abre a conta de internação (produto)
- **Reproduzir (B01):** `registrar_desfecho(ep, 'observacao')`, depois `finalizar_observacao(int, 'internacao', 'A41.9', relato, {setor_id: Internação, leito_id: INT livre})`. Conferir `contas WHERE internacao_id = int`.
- **Esperado:** conta `internacao` aberta pelo gatilho `trg_conta_da_internacao`, com `conta_origem_id` = conta da porta (MAPA 3.1).
- **Obtido:** nenhuma conta de internação (`B01.15.conta_internacao`: "nenhuma conta de internação para esta internação"). A internação existe, está `internado` no INT-02 com `internado_em` preenchido. O mesmo aconteceu na rodada 1 (INT-01).
- **Causa (leitura do banco):** o gatilho da conta é `AFTER INSERT OR UPDATE OF internado_em`. Na conversão, quem preenche `internado_em` é o gatilho `BEFORE UPDATE OF status` (`private.internacao_tipo_na_conversao`). Coluna mudada por gatilho BEFORE não conta como "UPDATE OF internado_em", então o gatilho da conta não dispara. O caminho direto `registrar_desfecho('internacao')` (B06, B03 no hospital) é INSERT e abre a conta normalmente.
- **Efeito:**
  - o procedimento principal da AIH (0303010037: SH R$ 793,69 + SP R$ 72,22) foi **aprovado pelo regulador** e não entra em conta nenhuma;
  - os medicamentos lançados depois de `internado_em` ficam sem conta;
  - o faturamento não acha a conta de internação (`B01.29.conta_int`), e o fechamento dela ficou bloqueado.
- Vale para todo paciente que passa da observação à internação na UPA.

### P2-1 — `alertas_sepse` é só da pediatria: o adulto séptico não aparece para o gestor (produto e catálogo)
- **Reproduzir (B01.12):** paciente de 68 anos em observação com febre, hipotensão e confusão; `alertas_sepse(UPA)` como `gestor.upa.f5`.
- **Obtido:** "paciente fora de alertas_sepse (0 alerta(s) na unidade)". A função só olha paciente com menos de 14 anos (`data_nascimento > hoje − 14 anos`) e calcula o escore Phoenix (pediátrico).
- **Efeito:** não há alerta de sepse do adulto no painel do gestor. O catálogo e o MAPA (4.2) contam com ele. O NEWS2 do leito (`acuidade`) funciona (`B01.11.acuidade`: banda 2).

### P2-2 — O médico da porta encerra a observação, mas não pede parecer nem marca reavaliação (produto)
- A correção da decisão do RT de 06/11 (P2-3 do A01) já está na homologação: `finalizar_observacao` pelo `medico.upa.f5`, que abriu a observação, **passou** (`B01.15.finalizar`).
- O mesmo médico, no mesmo paciente:
  - `solicitar_parecer` → "Acesso negado: só o médico que está com o paciente pede parecer." (`B01.13.parecer`);
  - `observacao_reavaliar` → "Acesso negado: você não está de plantão no setor deste paciente." (`B01.13.reavaliar_ps`).
- A enfermeira da porta também não registra sinais no box (`SYNC_FORA_DO_PLANTAO`, `B01.11.sinais_enf_porta`).
- O cenário seguiu com o médico e a enfermeira escalados na observação. **Pergunta para o RT:** a regra "quem abriu a observação pode encerrá-la" vale também para o parecer e a reavaliação?

### P2-3 — A telemedicina da rede não alcança a UBS (ambiente)
- **Reproduzir (B05.10):** `aceitar_teleinterconsulta` pela `telemedicina.f5` numa teleinterconsulta aberta pela UBS.
- **Obtido:** "Acesso negado: só o médico de telemedicina de plantão nesta unidade aceita." A conta existe desde o 46, mas está escalada só no PS da UPA; `telemedicina_na_unidade(UBS)` volta vazia. Aceitar e responder (passo 10) ficaram de fora.
- **Saída:** escalar uma conta de telemedicina na UBS. A escala recusa a mesma pessoa em dois setores no mesmo horário, então seria uma conta nova. Não foi feito, porque o catálogo já trata o passo como lacuna; fica para o RT decidir.

### P3-1 — Aviso de duplicidade ignora o pedido que espera o destino (produto)
- `regulacao_solicitar` calcula `aviso_duplicidade` olhando os status `rascunho, enviada, em_analise, pendencia, devolvida, autorizada, agendada, em_transito`. **Falta `aguardando_destino`.**
- **B01:** segundo pedido de UTI adulto com o primeiro em análise: `aviso_duplicidade = true` (`B01.19.duplicidade_em_analise`, ok). Com o primeiro aguardando o destino: `false` (`B01.21.duplicidade_aguardando`, falha). As duas tentativas foram desfeitas, mas gastaram os números 98 e 99.

### P3-2 — Catálogo: a reserva não é "estendida em 8 h" (catálogo)
- `private.regulacao_estender_reserva` faz `expira_em = greatest(expira_em, agora + 8 h)`. Ela garante pelo menos 8 h a partir da saída e da chegada; não soma 8 h.
- Com a reserva inicial de 24 h, nada muda nas primeiras 16 h. No B03, `expira_em` ficou igual na saída e na chegada (`B03.18.reserva_estendida` e `B03.19.reserva_estendida`, falhas contra o texto do catálogo).

### P3-3 — Catálogo: a evolução só é atualizada com o pedido esperando decisão (catálogo)
- **B01.23:** `regulacao_atualizar_evolucao` com o pedido `autorizada` → "Só se atualiza a evolução com o pedido esperando decisão." A RPC aceita `enviada, em_analise, pendencia, devolvida, aguardando_destino`.
- **Ajustar:** o passo 23 do B01 deve vir antes do aceite externo.

### P3-4 — Catálogo: duplicidade compara procedimento ou tipo de leito (catálogo)
- **B02 (borda):** abrir N2 (transferência, 0303040300) antes de negar N1 (leito clínico, 0303040149) **não** dá aviso (`B02.14.n2_antes_de_negar`). O aviso só sai com o mesmo procedimento ou, no pedido de leito, o mesmo tipo de leito. Tentativa desfeita, número 101 gasto.

### P3-5 — Catálogo: laudo de AIH exige CNS; o paciente do B03 só tinha CPF (catálogo)
- **B03.22:** "Falta para emitir: Completar o cadastro: CNS." A regulação aceita CPF (regra MIRA), a AIH não.
- A recepção da porta do hospital não completa o cadastro de quem já está internado: "paciente fora do seu plantão" (`B03.22.cns_cadastro`, primeira tentativa). O médico da Clínica Médica completa (`salvar_cadastro_paciente`), e o laudo saiu na segunda tentativa.
- **Ajustar:** o B03 deve cadastrar CNS, ou prever esse passo.

### P3-6 — MAPA desatualizado (catálogo)
- O Hospital F5 tem **UTI Adulto com 3 leitos** (`uti_adulto`), Obstetrícia e Porta. O mapa de vagas mostra a UTI (`B01.20.mapa_vagas`, falha contra o catálogo). A UPA tem Isolamento (ISO-01/02) e Observação Pediátrica.
- `alertas_sepse` é pediátrico (P2-1). `contas_pendencias_resumo` é `private` (não é RPC de tela).
- O regulador não abre `regulacao_historico_paciente` ("O histórico de regulação é visto pelo médico e pelo gestor da unidade.", `B01.27.historico`). O médico da origem abre (`B01.27.historico_origem`).
- `registrar_avaliacao` é de escalas (Braden, Morse, NIPS, FLACC, pergunta surpresa), não de sinais vitais. Os sinais do box foram por `sincronizar_registros`.
- O B05 pede `consulta_no_dia` com escuta, e `problemas ["AIT"]`, que não está na lista da ficha. A escuta só vale para a ficha `escuta_inicial` (P3-1 do A01), e o problema usado foi `hipertensao_arterial`, com CID G45.9 e CIAP K89.
- O NIR e o gestor do hospital existem desde o 46: o **gestor do hospital vê** `reg_chegada` (`B04.15.gestor_hospital`) e `reg_destino` (`B06.25.gestor_hospital_ve`). A lacuna "nenhuma conta da F5 vê a pendência do destino" está superada.
- Interação AAS + clopidogrel + enoxaparina: nenhum alerta (`B03.06.interacoes`). É a lacuna conhecida (não há base comercial de interações), não falha.

### P3-7 — Observação sem box quando a Observação Adulto está cheia (ambiente)
- Na rodada 3 do B01 não havia box livre, e o paciente entrou em observação **sem box** (`B01.10.box_qual`). O produto aceita; o box só aparece se alguém liberar.
- Os boxes estão presos por resíduos de testes: OA-01 (A01 rodada 1), OA-02 e OA-03 em higienização (A01 rodada 3 e B01 rodada 1) e OA-04 (outra frente).

### Confirmado, sem achado
- **Classificação:**
  - o técnico é recusado (`B01.03`, pela escala: "não está de plantão nesta porta"; `B05.02`, pela regra de papel);
  - a cor gravada é a da enfermeira, com autora = login e sem campo de sugestão;
  - o discriminador livre fica marcado (B02).
- **Prescrição e farmácia:**
  - sem peso é recusada; o peso referido e o estimado são aceitos;
  - os itens de alta vigilância (noradrenalina, enoxaparina, morfina) vão à fila da farmácia e são checados depois da liberação.
- **Parecer:**
  - pedido → em análise → realizado, com os documentos de solicitação e de resposta;
  - quem pediu não conclui;
  - o parecer aberto aparece em `impeditivos_alta` e sai depois da resposta.
- **Regulação:**
  - quadro com 19 letras, `internacao_id` alheio e transferência sem transporte são recusados com a mensagem de conferência;
  - pendência repetida é recusada, e a enfermeira não responde pendência;
  - recusa do destino com 9 letras é recusada; com motivo e texto, volta à fila (`em_analise`), limpa o destino e guarda o CRM;
  - negação com motivo fora da lista é recusada;
  - reenviar só a `devolvida`, mantendo `criada_em`, com evento `reenviada` e auditoria;
  - o gestor da central vê a fila e não assume;
  - aceitar com leito de outra unidade é recusado;
  - transferência aceita sem leito passa (desfeito);
  - a reserva nasce com `max(agora + 24 h, previsto + 8 h)` e `paciente_id` nulo;
  - `leitos_para_ocupar` oferece o leito reservado, e a internação consome a reserva ("Ocupado pela internação");
  - a chegada regulada não cria internação;
  - saída só depois do aceite; a enfermeira não marca a saída;
  - segunda chegada é recusada; "não chegou" com 8 letras é recusado;
  - `falta` libera a reserva (leito livre, evento `cancelamento_reserva`) e avisa a origem; depois de `falta`, cancelar, aceitar e marcar saída são recusados;
  - consulta sem CBO é recusada; CID sem ponto vira G45.9;
  - eletivo com prioridade emergência é aceito (observação, desfeito);
  - consulta aceita sem leito e sem reserva; chegada direta de `autorizada` para `realizada`;
  - a origem não aceita pelo destino;
  - destino externo: a unidade não aceita, a origem não marca a chegada e a central marca.
- **Teleinterconsulta:**
  - pergunta de 9 letras e consentimento fora da lista são recusados;
  - nasce `aberta`, com documento clínico da médica e auditoria;
  - quem pediu não aceita;
  - cancela antes do aceite.
- **UBS:** nenhuma conta com valor e nenhuma linha de BPA.
- **Faturamento:** a AIH é do regulador; o gestor e o faturamento são recusados.

## B01 — Sepse: porta, observação, parecer, internação na UPA e UTI fora da rede

**Resumo.** Rodada 3, às 00h02 de 07/11. A porta funcionou inteira:
- ficha e conta;
- classificação laranja pela enfermeira, com o técnico recusado;
- SOAP A41.9;
- três exames com resultado;
- prescrição recusada sem peso e aceita com o peso referido;
- noradrenalina liberada pela farmácia e as três doses checadas.

A observação abriu **sem box** (P3-7). O médico da observação atendeu e marcou a reavaliação. O parecer de Clínica médica foi pedido pelo médico da observação, porque o do PS foi recusado (P2-2), e respondido pelo médico da internação.

O médico do PS encerrou a observação com internação no INT-02. A conta de internação **não nasceu** (P1-1). Admissão, diagnóstico, laudo de AIH (0303010037) e reavaliação de piora correram normalmente.

Pedido nº 97 de UTI adulto: enviado, assumido, priorizado, autorizado para "UTI Hospital Regional (fora da rede)", aceito por telefone, saída marcada e chegada marcada pela central. A alta foi por transferência externa e a AIH foi aprovada. A conta da porta fechou; a da internação não existe. O alerta de sepse do gestor não lista adulto (P2-1).

**Status da regulação (nº 97):** `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada` (eventos: enviada → assumida → prioridade_regulador → autorizada → destino_aceitou → saiu → chegou). A resposta externa foi guardada com quem e meio, sem reserva.

**Falhas da rodada:**
- produto: `B01.12.alerta_sepse` (P2-1), `B01.13.parecer` (P2-2), `B01.15.conta_internacao` e `B01.29.conta_int` (P1-1), `B01.21.duplicidade_aguardando` (P3-1);
- catálogo: `B01.20.mapa_vagas`, `B01.23.evolucao` e `B01.27.historico` (P3-3 e P3-6).

As 4 lacunas são os passos da conta de internação, bloqueados pelo P1-1.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| B01.01.ficha | f5_rec_upa | Recepção abre a ficha no PS (febre, confusão e dor ao urinar) | ok | 82e75baf-c591-49d8-9ef6-64d3ed7718e4 | ok |
| B01.01.paciente | banco | Paciente da ficha | ok | 56d29046-ac21-4a87-844b-18cb98a6407d | ok |
| B01.01.conta | f5_fat | Conta ambulatorial aberta pelo gatilho (o faturamento vê) | ok | 165c20a6-a454-4c2c-b3da-f5a2d38aa7ae | ok |
| B01.02.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| B01.03.tecnico_nao_classifica | f5_tec_upa | Técnico de enfermagem tenta classificar (deve ser recusado) | erro | recusado: Acesso negado: você não está de plantão nesta porta. | ok |
| B01.02.classificar | f5_enf_upa | Classifica laranja (escolha da enfermeira de teste), sinais crus, Glasgow 14, fluxograma "Mal-estar geral" | ok | 32726ea8-ef6f-4263-98c4-a241cdec6dc9 | ok |
| B01.02.cor_banco | banco | Cor gravada = a da enfermeira, autora = login, sem campo de sugestão | ok | ok: cor laranja, fluxograma Mal-estar geral, discriminador Alteração súbita da consciência (livre false), autor 07 | ok |
| B01.04.iniciar | f5_med_upa | Médico assume o atendimento | ok | (sem retorno: void) | ok |
| B01.04.soap | f5_med_upa | SOAP com CID A41.9 (decisão pelas fichas sepse-adulto, news2 e adulto-ressuscitacao-volemica, na tela) | ok | cce98050-ea7c-49bd-8bc1-2ad4eb8c8d25 | ok |
| B01.06.exames | f5_med_upa | Pede lactato, hemograma e hemocultura (urgente) pelo SIGTAP | ok | 3 | ok |
| B01.06.resultados | f5_med_upa | Registra os resultados em texto | ok | ok,ok,ok | ok |
| B01.07.sem_peso | f5_med_upa | Prescrever sem peso do atendimento (deve ser recusado) | erro:Falta para prescrever | recusado: Falta para prescrever: peso deste atendimento (aferido ou estimado). | ok |
| B01.07.peso | f5_med_upa | Peso referido 70 kg | ok | 1 sinais gravados | ok |
| B01.07.antibiotico | f5_med_upa | Ceftriaxona "Agora" (dose: texto de teste, conforme sepse-adulto) | ok | df4ff9b3-55c4-496f-8f36-d6ac2f4816f4 | ok |
| B01.07.volume | f5_med_upa | Ringer com lactato "Agora" (volume: texto de teste, conforme adulto-ressuscitacao-volemica) | ok | c07842fe-60f8-4a1d-a45b-b1674743e2fe | ok |
| B01.07.vasopressor | f5_med_upa | Noradrenalina (alta vigilância) "Agora" (texto de teste, conforme sepse-adulto) | ok | 9584f017-858f-4f32-85eb-8a142b0bbb4c | ok |
| B01.08.fila | f5_farm | A noradrenalina aparece na fila como alta vigilância | ok | ok: na fila com alta vigilância | ok |
| B01.08.validar | f5_farm | Farmacêutico valida e libera (confere) | ok | (sem retorno: void) | ok |
| B01.08.dispensar_antibiotico | f5_farm | Dispensa 1 unidade de consumo (antibiotico, sem valor) | ok | {"id": "05a0ecfa-e31b-4e28-a84d-168676ec4101", "saldo": -3, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| B01.08.dispensar_volume | f5_farm | Dispensa 1 unidade de consumo (volume, sem valor) | ok | {"id": "40196909-1af9-4fd6-b543-fed3d789b69f", "saldo": -3, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| B01.08.dispensar_vasopressor | f5_farm | Dispensa 1 unidade de consumo (vasopressor, sem valor) | ok | {"id": "1ba1dcd5-bd55-4a15-be11-7fad5250f04a", "saldo": -3, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| B01.09.checar_antibiotico | f5_enf_upa | Enfermeira (no lugar do técnico, que não está no PS) apraza e checa "feito": antibiotico | ok | 7852e77d-9356-4b14-8307-5037fcdedd4d | ok |
| B01.09.checar_volume | f5_enf_upa | Enfermeira (no lugar do técnico, que não está no PS) apraza e checa "feito": volume | ok | 629539cd-0241-4598-b9ed-07ca6ac70ba8 | ok |
| B01.09.checar_vasopressor | f5_enf_upa | Enfermeira (no lugar do técnico, que não está no PS) apraza e checa "feito": vasopressor | ok | 44f63c28-6d49-4dfa-bfe7-40edd5751f5a | ok |
| B01.09.autor | banco | Administrações com autor = login da enfermeira; a de alta vigilância com liberação | ok | ok: 3 administrações, sem_liberacao false | ok |
| B01.10.observacao | f5_med_upa | Desfecho observação (box livre da Observação Adulto) | ok | (sem retorno: void) | ok |
| B01.10.box | banco | Internação de observação aberta (box livre, ou sem box se não houver; nunca OA-01/OA-02) | ok | 4e29f042-996b-4677-bf11-6d3aee046221 | ok |
| B01.10.box_qual | banco | Box escolhido por private.box_livre | ok | sem box (nenhum box livre) (Observação Adulto) | ok |
| B01.11.sinais_enf_porta | f5_enf_upa | Catálogo: a enfermeira da porta registra sinais no box (registro do resultado) | registrar | RECUSADO: SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente. | ok |
| B01.11.sinais | f5_enf_obs | Enfermeira escalada na observação registra sinais crus (FC 124, PA 84x50, FR 28, SatO2 92%) | ok | 5 sinais gravados | ok |
| B01.11.acuidade | f5_enf_obs | Acuidade recalculada (NEWS2 no leito) | ok | {"azul": [], "banda": 2, "fonte": "NEWS2: Royal College of Physicians, 2017 (escala 1). Referência geral, conferir contra o protocolo institucional.", "itens": [{"valor"… | ok |
| B01.12.alerta_sepse | f5_ges_upa | Gestor vê o paciente em alertas_sepse | ok | paciente fora de alertas_sepse (0 alerta(s) na unidade) | **falha** |
| B01.13.reavaliar_ps | f5_med_upa | Catálogo: o médico do PS marca a reavaliação no box (registro; desfeito) | registrar | RECUSADO: Acesso negado: você não está de plantão no setor deste paciente. | ok |
| B01.13.atender | f5_med_obs | Médico escalado na observação registra o atendimento no box | ok | (sem retorno: void) | ok |
| B01.13.reavaliar | f5_med_obs | Marca reavaliação em 1 h | ok | 51283573-2fdf-4148-86c0-8f79cbb9f3a2 | ok |
| B01.13.reavaliado | f5_med_obs | Registra a reavaliação feita | ok | (sem retorno: void) | ok |
| B01.13.parecer | f5_med_upa | Médico do PS pede parecer de Clínica médica (urgência) | ok | Acesso negado: só o médico que está com o paciente pede parecer. | **falha** |
| B01.13.parecer_obs | f5_med_obs | O pedido do PS foi recusado: o médico da observação pede o parecer | ok | 8070e4b0-d40a-472e-9a61-cc5216d46002 | ok |
| B01.13.documento | banco | Parecer solicitado com documento clínico de solicitação e autor = login | ok | ok: status solicitado, solicitante 25, documento parecer | ok |
| B01.14.especialidade | f5_med_int | Médico da internação declara a especialidade Clínica médica | ok | (sem retorno: void) | ok |
| B01.14.fila | f5_med_int | O parecer aparece na fila de quem responde | ok | ok: na fila, posso_analisar | ok |
| B01.14.impede_alta | f5_med_obs | Com o parecer aberto, impeditivos_alta lista o parecer | ok | ok: [{"id": "8070e4b0-d40a-472e-9a61-cc5216d46002", "tipo": "parecer", "descricao": "Parecer sem resposta: Clínica médica (solicitado)"}] | ok |
| B01.14.iniciar | f5_med_int | Inicia a análise | ok | (sem retorno: void) | ok |
| B01.14.solicitante_nao_responde | f5_med_upa | Quem pediu tenta concluir (deve ser recusado) | erro | recusado: Só quem iniciou a análise conclui, e só enquanto está em análise. | ok |
| B01.14.concluir | f5_med_int | Conclui o parecer | ok | 1e3b8430-14cb-4e6c-8315-2f8079b5b5f4 | ok |
| B01.14.realizado | banco | solicitado → em_analise → realizado, com documento de resposta | ok | ok: status realizado | ok |
| B01.14.alta_liberada | f5_med_obs | Depois do parecer, o parecer sai dos impeditivos | ok | ok: [] | ok |
| B01.15.finalizar | f5_med_upa | Médico do PS (que abriu a observação) encerra: internação no leito INT, CID A41.9 | ok | (sem retorno: void) | ok |
| B01.15.internacao | banco | Internado no leito INT (a mesma internação, convertida da observação) | ok | 4e29f042-996b-4677-bf11-6d3aee046221 | ok |
| B01.15.conta_internacao | banco | Conta de internação aberta (gatilho trg_conta_da_internacao), com conta_origem_id = conta da porta | ok | nenhuma conta de internação para esta internação | **falha** |
| B01.15.internacao_registro | banco | Como ficou: internações do paciente e contas | ok | urgencia/internado INT-02 internado_em 2026-11-07 03:02:16.826131+00 / contas: ambulatorial A-2026.000016 origem - | ok |
| B01.16.admissao | f5_med_int | Registra a admissão (ficha completa) | ok | 63f472a0-a056-4bc1-914a-f661e53df1e9 | ok |
| B01.16.diagnostico | f5_med_int | Diagnóstico primário A41.9 confirmado | ok | 0a8fff4d-1656-43ac-87cc-aed7e6d5e75e | ok |
| B01.16.vindos_da_porta | f5_med_int | A prescrição da porta aparece em "Vindos da porta" | ok | ok: 3 itens: Ceftriaxona pó para solução injetável; Ringer com lactato solução injetável, bolsa 500 mL; Noradrenalina solução injetável, ampola 4 mL | ok |
| B01.16.buscar_sigtap | f5_med_int | buscar_sigtap oferece 0303010037 (outras doenças bacterianas) | ok | ok: achou 0303010037 | ok |
| B01.16.laudo_aih | f5_med_int | Laudo de AIH com 0303010037 | ok | 0095c4b9-51c4-46be-8105-13b3bfca9aab | ok |
| B01.16.aih | banco | AIH solicitada pelo gatilho do laudo | ok | 4b4450bf-ad85-4a05-aa22-199c1fc82dbb | ok |
| B01.17.reavaliacao | f5_med_int | Reavaliação do quadro com piora (sinais crus) | ok | 48dfd3d6-0232-42cd-b717-04dc57d23e06 | ok |
| B01.17.acuidade | f5_med_int | Acuidade do leito | ok | {"azul": [], "banda": 2, "fonte": "NEWS2: Royal College of Physicians, 2017 (escala 1). Referência geral, conferir contra o protocolo institucional.", "itens": [{"valor"… | ok |
| B01.18.quadro_curto | f5_med_int | Quadro com 19 letras (deve ser recusado) | erro:Confira o pedido | recusado: Confira o pedido: tipo e o campo do tipo (especialidade, tipo de leito, transporte), isolamento, internação psiquiátrica, destino, caráter, prioridade e quadro… | ok |
| B01.18.internacao_invalida | f5_med_int | internacao_id que não é do paciente (deve ser recusado) | erro:A internação informada | recusado: A internação informada não está aberta para este paciente. | ok |
| B01.18.solicitar | f5_med_int | Pede leito de UTI adulto: emergência, idoso, SIGTAP do laudo, CID A41.9 | ok | 83f63700-fb27-430c-acb4-86bd8053ae7a | ok |
| B01.18.enviada | banco | enviada, modalidade 04, sem aviso de duplicidade, evento e auditoria | ok | ok: nº 97, enviada, modalidade 04 | ok |
| B01.19.fila | f5_regulador | O pedido está na fila da central | ok | ok: na fila | ok |
| B01.19.assumir | f5_regulador | Regulador assume | ok | {"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cbo": null, "cid": "A41.9", "sla": {"fila": {"atrasado": false, "correndo": true, "prazo_min": 1, "cen | ok |
| B01.19.priorizar | f5_regulador | Prioriza como emergência | ok | {"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cbo": null, "cid": "A41.9", "sla": {"fila": {"atrasado": false, "correndo": true, "prazo_min": 1, "cen | ok |
| B01.19.criterios | f5_regulador | Critérios da central | ok | {} | ok |
| B01.19.duplicidade_em_analise | f5_med_int | Segundo pedido de UTI com o primeiro em análise: aviso_duplicidade = true (desfeito) | ok | ok: {"id": "78e313f2-651e-41a0-acfc-c7b5b8c3f32f", "numero": 98, "aviso_duplicidade": true} | ok |
| B01.20.mapa_vagas | f5_regulador | Catálogo: o mapa mostra só leito clínico (sem UTI na rede) | ok | confere: {"agora": "2026-11-07T03:02:16.826131+00:00", "totais": [{"livre": 2, "total": 4, "tipo_leito": "clinico", "higienizacao": 0}, {"livre": 3, "total": 3, "tipo_le… | **falha** |
| B01.21.autorizar | f5_regulador | Autoriza para UTI fora da rede, ambulância avançada, previsto +3 h | ok | {"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cbo": null, "cid": "A41.9", "sla": {"fila": {"atrasado": false, "correndo": false, "prazo_min": 1, "ce | ok |
| B01.21.aviso_origem | banco | Aviso reg_autorizada_N na origem (solicitante) | ok | ok: aviso reg_autorizada_97 | ok |
| B01.21.hospital_nao_aceita_externo | f5_med_hosp | Aceite pela unidade num destino externo (deve ser recusado) | erro:Este pedido não está aguardando o … | recusado: Este pedido não está aguardando o aceite da unidade. | ok |
| B01.21.saida_antes | f5_med_int | Marcar a saída antes da resposta externa (deve ser recusado) | erro:Só sai o paciente | recusado: Só sai o paciente com o pedido aceito pelo destino. | ok |
| B01.21.duplicidade_aguardando | f5_med_int | Segundo pedido de UTI com o primeiro aguardando o destino: aviso_duplicidade = true (desfeito) | ok | confere: {"id": "40d01078-1020-411c-bf4d-26c76ad108a8", "numero": 99, "aviso_duplicidade": false} | **falha** |
| B01.22.resposta_externa | f5_regulador | Registra o aceite do serviço de fora (plantonista da UTI, telefone) | ok | {"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cbo": null, "cid": "A41.9", "sla": null, "tipo": "leito", "exames": "Lactato, hemograma e hemocultura | ok |
| B01.22.resposta_banco | banco | autorizada; resposta externa guardada com quem e meio | ok | ok: status autorizada, resposta aceita (UTI Hospital Regional (fora da rede)) | ok |
| B01.23.evolucao | f5_med_int | Catálogo: a origem atualiza a evolução com o pedido já autorizado | ok | Só se atualiza a evolução com o pedido esperando decisão. | **falha** |
| B01.24.nir | f5_nir | NIR: nenhum item de regulação deste pedido | ok | ok: nada parado neste pedido | ok |
| B01.25.impeditivos | f5_med_int | impeditivos_alta antes da alta | ok | [] | ok |
| B01.25.alta | f5_med_int | Alta por transferência externa (UTI fora da rede), CID A41.9 | ok | (sem retorno: void) | ok |
| B01.26.saida | f5_med_int | Marca a saída (em trânsito) | ok | {"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cbo": null, "cid": "A41.9", "sla": null, "tipo": "leito", "exames": "Lactato, hemograma e hemocultura | ok |
| B01.27.origem_nao_marca_chegada | f5_med_int | Origem tenta marcar a chegada de destino externo (deve ser recusado) | erro:Marca a chegada | recusado: Marca a chegada a unidade destino (ou a central, se o destino é de fora da rede). | ok |
| B01.27.chegada | f5_regulador | A central marca a chegada (destino de fora) | ok | {"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cbo": null, "cid": "A41.9", "sla": null, "tipo": "leito", "exames": "Lactato, hemograma e hemocultura | ok |
| B01.27.historico | f5_regulador | Histórico do paciente com o pedido realizado | ok | O histórico de regulação é visto pelo médico e pelo gestor da unidade. | **falha** |
| B01.28.aih | f5_regulador | Regulador aprova a AIH | ok | (sem retorno: void) | ok |
| B01.29.conta_int | f5_fat | Conta da internação | ok | conta não achada | **falha** |
| B01.29.porta_conferencia | f5_fat | Conta porta: aberta → em_conferencia | ok | {"id": "165c20a6-a454-4c2c-b3da-f5a2d38aa7ae", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:02:16.826131+00:00", "cbo": "225125", "cid": "A | ok |
| B01.29.internacao_conferencia | f5_fat | Conta internacao: aberta → em_conferencia | existir | bloqueado por passo anterior (sem b01_conta_int) | **lacuna** |
| B01.29.porta_custos | f5_fat | Custos e pré-auditoria da conta porta | ok | status em_conferencia; total 12.89; itens: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, 0301100012 qt 3 = 1.89; medicamentos 0; pendências 2; bloqueantes sem liberaç… | ok |
| B01.29.internacao_custos | f5_fat | Custos e pré-auditoria da conta internacao | existir | bloqueado por passo anterior (sem b01_conta_int) | **lacuna** |
| B01.29.porta_fechar | f5_fat | Conta porta: em_conferencia → fechada | ok | {"id": "165c20a6-a454-4c2c-b3da-f5a2d38aa7ae", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:02:16.826131+00:00", "cbo": "225125", "cid": "A | ok |
| B01.29.internacao_fechar | f5_fat | Conta internacao: em_conferencia → fechada | existir | bloqueado por passo anterior (sem b01_conta_int) | **lacuna** |
| B01.29.congelados | banco | Itens congelados: classificação, consulta e medicação na porta; AIH na internação | existir | bloqueado por passo anterior (sem b01_conta_int_fechada) | **lacuna** |
| B01.99.eventos | banco | Um evento por transição em regulacao_eventos, autor = login | ok | ok: chegou por 12 → assumida por 12 → saiu por 15 → prioridade_regulador por 12 → enviada por 15 → destino_aceitou por 12 → autorizada por 12 | ok |
| B01.27.historico_origem | f5_med_int | O médico da origem vê o histórico do paciente com o pedido realizado | ok | ok: [{"id": "83f63700-fb27-430c-acb4-86bd8053ae7a", "cid": "A41.9", "tipo": "leito", "numero": 97, "origem": "UPA Fase 5 24h", "status": "realizada", "carater": "urgenci… | ok |
| B01.L3.fecha_conta_rodada1 | f5_fat | Limpeza: fecha a conta da porta da rodada 1 descartada (episódio já encerrado) | ok | {"id": "1c3a84a1-3b63-4974-b65d-15b22c185882", "tipo": "ambulatorial", "itens": | ok |
| B01.L3.fecha_conta_rodada2 | f5_fat | Limpeza: fecha a conta da porta da rodada 2 descartada (episódio já encerrado) | ok | {"id": "e65a77a4-704c-4de6-8f93-4cffd550e947", "tipo": "ambulatorial", "itens": | ok |

## B02 — AVC: pendência, recusa do destino, negativa, devolução e reenvio

**Resumo.** Às 00h06. Porta completa:
- classificação vermelha com o discriminador escrito pela enfermeira em "Mal-estar geral";
- SOAP I63.9 com a hora do ictus;
- ECG e glicemia capilar, esta por nome livre, porque o grupo 02.14 do SIGTAP não é aceito no pedido de exame;
- soro checado.

**Pedido 1 (nº 100):**
- pendência; a enfermeira foi recusada ao responder; o médico respondeu e o aviso chegou à central;
- autorizado para o Hospital F5; o hospital recusou (perfil incompatível, com CRM) e o pedido voltou a `em_analise` sem destino;
- motivo inválido foi recusado, e o pedido foi negado por fora do escopo.

**Pedido 2 (nº 103):**
- abriu sem aviso de duplicidade;
- foi devolvido; o NIR não viu pendência dentro do prazo;
- foi reenviado com ictus e NIHSS, mantendo `criada_em`;
- autorizado para serviço de fora, aceito por telefone;
- a porta registrou o desfecho `transferencia` antes da chegada, o NIR marcou a saída e a central, a chegada.

O histórico do paciente mostra os dois pedidos. A conta da porta fechou.

**Status:**
- nº 100: `enviada → em_analise → pendencia → em_analise → aguardando_destino → em_analise → negada`;
- nº 103: `enviada → em_analise → devolvida → enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada`.

**Falha:** só a borda do catálogo da duplicidade (P3-4).

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| B02.01.ficha | f5_rec_upa | Recepção abre a ficha no PS (fraqueza súbita e fala enrolada) | ok | 3dbac49c-1c5d-495b-b07b-56f4392b538b | ok |
| B02.01.paciente | banco | Paciente da ficha | ok | 8e181fa6-3f7f-496a-8565-87c3e03763cd | ok |
| B02.01.conta | f5_fat | Conta ambulatorial aberta | ok | 0fbdc463-2fae-4d54-8d65-8d3702a8a64e | ok |
| B02.02.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| B02.02.classificar | f5_enf_upa | Classifica vermelho (escolha da enfermeira de teste): "Mal-estar geral" com discriminador escrito por ela (não há fluxograma de déficit neurológico) | ok | 2081546e-3979-4c8b-8a0b-ab9d1b79b293 | ok |
| B02.02.cor_banco | banco | Cor, fluxograma e discriminador livre gravados como a enfermeira escolheu | ok | ok: cor vermelho, Mal-estar geral, discriminador "Déficit neurológico focal súbito há menos de 1 h (texto da enfermeira de teste)" (livre) | ok |
| B02.03.iniciar | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| B02.03.soap | f5_med_upa | SOAP com CID I63.9 e hora do início dos sintomas (decisão pelas fichas adulto-nihss, glasgow e adulto-trombolise-avc, na tela) | ok | ed184f26-2be2-468b-81a2-0cece20a795f | ok |
| B02.05.exames | f5_med_upa | Pede ECG (SIGTAP) e glicemia capilar (nome livre: o grupo 02.14 não é aceito) | ok | 2 | ok |
| B02.05.resultados | f5_med_upa | Resultados em texto | ok | ok,ok | ok |
| B02.06.peso | f5_med_upa | Peso referido 62 kg | ok | 1 sinais gravados | ok |
| B02.06.prescrever | f5_med_upa | Cloreto de sódio 0,9% bolsa "Agora" (medidas gerais; texto de teste, conforme adulto-trombolise-avc) | ok | 5bead661-908b-4eb8-aa91-beeff7ccf3cb | ok |
| B02.07.checar | f5_enf_upa | Enfermeira apraza e checa "feito" | ok | 265c4aa9-37b5-4026-8c1a-33c8519b474b | ok |
| B02.08.pedido1 | f5_med_upa | Pedido 1: leito clínico, emergência, idoso, 0303040149, I63.9 | ok | 3aa77b1d-70a8-4b7a-b4bc-3fd92daa80e6 | ok |
| B02.08.n1_enviada | banco | N1 enviada, sem aviso de duplicidade | ok | ok: nº 100 enviada, destino a_definir, assumida_por nulo | ok |
| B02.09.assumir | f5_regulador | Regulador assume N1 | ok | {"id": "3aa77b1d-70a8-4b7a-b4bc-3fd92daa80e6", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.09.pendencia | f5_regulador | Pendência: hora exata do ictus, NIHSS e glicemia | ok | {"id": "3aa77b1d-70a8-4b7a-b4bc-3fd92daa80e6", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.09.pendencia_repetida | f5_regulador | Segunda pergunta com a primeira sem resposta (deve ser recusado) | erro:Já há uma pergunta | recusado: Já há uma pergunta esperando resposta da origem. | ok |
| B02.09.aviso | banco | Aviso reg_pendencia_N1 ao médico solicitante | ok | ok: aviso reg_pendencia_100 | ok |
| B02.10.enfermeira_nao_responde | f5_enf_upa | Enfermeira tenta responder a pendência (deve ser recusado) | erro | recusado: Responde o solicitante, o médico assistente, o gestor ou o NIR da origem. | ok |
| B02.10.responder | f5_med_upa | Médico responde: ictus 07:40, NIHSS 9, glicemia 112 | ok | (sem retorno: void) | ok |
| B02.10.em_analise | banco | Volta a em_analise (continua com o regulador) | ok | ok: nº 100 em_analise, destino a_definir, assumida_por 12 | ok |
| B02.10.aviso_central | banco | Aviso reg_resposta_N1 ao regulador, na central | ok | ok: aviso reg_resposta_100 | ok |
| B02.11.autorizar | f5_regulador | Autoriza N1 para o Hospital F5 (ambulância avançada) | ok | {"id": "3aa77b1d-70a8-4b7a-b4bc-3fd92daa80e6", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.11.aviso_destino | banco | Aviso reg_destino_N1 ao hospital | ok | ok: aviso reg_destino_100 | ok |
| B02.14.n2_antes_de_negar | f5_med_upa | Borda do catálogo: abrir N2 (transferência, outro procedimento) antes de negar N1 daria aviso_duplicidade = true (desfeito) | ok | confere: {"id": "6e44ab9b-bc20-4ad3-b495-843b9e2c6ece", "numero": 101, "aviso_duplicidade": false} | **falha** |
| B02.12.lista_destino | f5_med_hosp | N1 aparece na lista do destino | ok | ok: na lista do destino | ok |
| B02.12.recusa_curta | f5_med_hosp | Recusa com texto de 9 letras (deve ser recusado) | erro | recusado: Escreva a justificativa (mínimo de 10 letras). | ok |
| B02.12.recusar | f5_med_hosp | Hospital recusa: perfil incompatível (sem TC nem trombólise) | ok | {"id": "3aa77b1d-70a8-4b7a-b4bc-3fd92daa80e6", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.12.volta | banco | N1 volta a em_analise (estava assumido), destino a_definir, resposta guardada com CRM | ok | ok: status em_analise, destino_tipo a_definir, resposta recusada (perfil_incompativel, registro CRM 950011/SP) | ok |
| B02.12.avisos | banco | Avisos reg_destino_recusou_N1 à origem e ao regulador | ok | ok: 2 aviso(s) em 2 unidade(s) | ok |
| B02.13.motivo_invalido | f5_regulador | Negar com motivo fora da lista (deve ser recusado) | erro | recusado: Escolha o motivo da negação. | ok |
| B02.13.negar | f5_regulador | Central nega N1: fora do escopo (refazer como transferência de urgência) | ok | {"id": "3aa77b1d-70a8-4b7a-b4bc-3fd92daa80e6", "cbo": null, "cid": "I63.9", "sla": null, "tipo": "leito", "exames": null | ok |
| B02.13.negada | banco | negada, auditoria regulacao_negada e aviso reg_negada_N1 | ok | ok: status negada | ok |
| B02.14.sem_transporte | f5_med_upa | Transferência sem transporte (deve ser recusado) | erro:Confira o pedido | recusado: Confira o pedido: tipo e o campo do tipo (especialidade, tipo de leito, transporte), isolamento, internação psiquiátrica, destino, caráter, prioridade e quadro… | ok |
| B02.14.pedido2 | f5_med_upa | Pedido 2: transferência de urgência, ambulância avançada, 0303040300, sem a hora do ictus no quadro | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "numero": 103, "aviso_duplicidade": false} | ok |
| B02.14.sem_duplicidade | banco | N2 sem aviso de duplicidade (N1 negada); modalidade 04; transporte preenchido | ok | ok: nº 103, aviso false | ok |
| B02.15.assumir | f5_regulador | Regulador assume N2 | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.15.devolver | f5_regulador | Devolve: faltam hora do ictus e NIHSS no quadro clínico | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.15.devolvida | banco | devolvida, assumida_por limpo, aviso reg_devolvida_N2 | ok | ok: status devolvida, assumida_por nulo | ok |
| B02.16.nir | f5_nir | NIR: devolução ainda no prazo não aparece como reg_pendencia | ok | ok: sem reg_pendencia | ok |
| B02.17.reenviar_negada | f5_med_upa | Reenviar N1 negada (deve ser recusado: só devolvida) | erro:Só se reenvia | recusado: Só se reenvia pedido devolvido pela central. | ok |
| B02.17.reenviar | f5_med_upa | Reenvia N2 com ictus 07:40 e NIHSS 9 | ok | (sem retorno: void) | ok |
| B02.17.posicao | banco | enviada; criada_em inalterado (posição na fila); reenviada_em preenchido; evento reenviada com os campos | ok | ok: status enviada, campos ["prioridade", "quadro_clinico"] | ok |
| B02.17.auditoria | banco | Auditoria regulacao_reenviada | ok | ok: auditoria regulacao_reenviada | ok |
| B02.18.assumir | f5_regulador | Regulador assume N2 de novo | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.18.autorizar | f5_regulador | Autoriza para hospital com unidade de AVC (fora da rede), previsto +1 h | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B02.19.resposta_externa | f5_regulador | Aceite do serviço de fora (neurologista de plantão, telefone) | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B02.19.autorizada | banco | autorizada (destino externo) | ok | ok: nº 103 autorizada, destino externo / Hospital com unidade de AVC (fora da rede), assumida_por 12 | ok |
| B02.20.desfecho | f5_med_upa | Desfecho transferência na porta (sem esperar a chegada) | ok | (sem retorno: void) | ok |
| B02.20.encerrado | banco | Episódio encerrado por transferência | ok | ok: etapa encerrado, desfecho transferencia | ok |
| B02.21.saida | f5_nir | NIR marca a saída (em trânsito) | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B02.22.chegada | f5_regulador | A central marca a chegada (realizada) | ok | {"id": "f9cf7585-1847-4f93-a1fc-05d06759b710", "cbo": null, "cid": "I63.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B02.22.historico | f5_med_upa | Histórico do paciente: N1 negada e N2 realizada | ok | ok: N1 e N2 no histórico | ok |
| B02.23.indicadores | f5_ges_upa | Indicadores da central | ok | {"agora": "2026-11-07T03:06:02.960224+00:00", "total": 7, "escopo": "rede", "prazos": {"fila": {"n": 6, "no_prazo": 6}, "destino": {"n": 5, "no_prazo": 5}, "valores": {"… | ok |
| B02.24.conferencia | f5_fat | aberta → em_conferencia | ok | {"id": "0fbdc463-2fae-4d54-8d65-8d3702a8a64e", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:06:02.960224+00:0 | ok |
| B02.24.custos | f5_fat | Custos e pré-auditoria | ok | status em_conferencia; total 11.63; itens: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, 0301100012 qt 1 = 0.63; medicamentos 1; pendências 3; bloqueantes sem liberaç… | ok |
| B02.24.fechar | f5_fat | em_conferencia → fechada | ok | {"id": "0fbdc463-2fae-4d54-8d65-8d3702a8a64e", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:06:02.960224+00:0 | ok |
| B02.24.congelados | banco | Itens congelados | ok | ok: 0301060096=11.00, 0301060118=nulo, 0301100012=0.63 | ok |
| B02.99.eventos_pedido1 | banco | Eventos do pedido1 (só inserção), autor = login | ok | ok: enviada por 08 → assumida por 12 → pendencia por 12 → pendencia_respondida por 08 → autorizada por 12 → destino_recusou por 11 → negada por 12 | ok |
| B02.99.eventos_pedido2 | banco | Eventos do pedido2 (só inserção), autor = login | ok | ok: enviada por 08 → assumida por 12 → devolvida por 12 → reenviada por 08 → assumida por 12 → autorizada por 12 → destino_aceitou por 12 → saiu por 13 → chegou por 12 | ok |

## B03 — SCA: transferência para o Hospital F5 com leito reservado

**Resumo.** Às 00h08. Na UPA:
- o gestor ofertou a Internação no mapa;
- ficha com CPF, classificação vermelha em "Dor torácica", SOAP I21.9, ECG e troponina;
- AAS, clopidogrel e enoxaparina checados, a enoxaparina depois da liberação da farmácia.

**Regulação (nº 104):**
- o gestor da central viu a fila e não assumiu;
- o regulador priorizou e autorizou para o Hospital F5;
- os avisos chegaram a dois médicos e ao gestor do hospital;
- o médico do hospital aceitou e reservou o **CM-03** (CM-01 e CM-02 não foram usados). As bordas de leito de outra unidade e de aceite sem leito foram provadas;
- o NIR marcou a saída e o hospital marcou a chegada. A reserva não foi estendida (P3-2).

**No hospital:**
- recepção, enfermeira e médico da porta abriram a ficha, classificaram e internaram no CM-03 reservado; a reserva virou "ocupada";
- o médico da Clínica Médica admitiu;
- o laudo de AIH pediu o CNS (P3-5). Depois do CNS, a AIH 0303060190 foi aprovada pelo regulador, e o gestor da UPA foi recusado ao tentar decidir.

A conta da UPA fechou. A conta de internação do hospital tem a AIH (R$ 588,12). A da porta do hospital tem os dois itens "fora", sem SIGTAP (P3-7 do A01).

**Status (nº 104):** `enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada`.

**Falhas:**
- `B03.18` e `B03.19.reserva_estendida` (P3-2);
- `B03.22.laudo_aih` e a primeira tentativa de `B03.22.cns_cadastro` (P3-5), refeitos.

As lacunas são os três passos bloqueados até o CNS (duas vezes, na execução e na primeira continuação) e a reserva vencida, não executada sem mexer no relógio.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| B03.00.ofertar | f5_ges_upa | Gestor da UPA oferta o setor Internação como leito clínico | ok | (sem retorno: void) | ok |
| B03.01.ficha | f5_rec_upa | Recepção abre a ficha no PS (dor no peito), cadastro com CPF | ok | 360bbc74-3bf9-40ea-9865-baa9b9752abc | ok |
| B03.01.paciente | banco | Paciente da ficha | ok | 0a73dbde-df25-4bd0-abf0-8950eab971a8 | ok |
| B03.01.conta | f5_fat | Conta ambulatorial aberta | ok | 68670784-dad9-41ed-99b8-61f8d51c2339 | ok |
| B03.02.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| B03.02.classificar | f5_enf_upa | Classifica vermelho (escolha da enfermeira de teste), fluxograma "Dor torácica", dor 8/10 | ok | aa730cbf-ac1b-4548-bfb2-e593c7497f0a | ok |
| B03.03.iniciar | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| B03.03.soap | f5_med_upa | SOAP com CID I21.9 (decisão pelas fichas adulto-sca-inicial, heart, grace, killip e adulto-fibrinoliticos, na tela) | ok | 875ea499-fcf4-41e5-bbb7-eb2a6fde40c1 | ok |
| B03.04.exames | f5_med_upa | Pede ECG e troponina (urgente) | ok | 2 | ok |
| B03.04.resultados | f5_med_upa | Resultados em texto (ECG com supra de ST — dado fictício) | ok | ok,ok | ok |
| B03.06.peso | f5_med_upa | Peso referido 84 kg | ok | 1 sinais gravados | ok |
| B03.06.aas | f5_med_upa | AAS "Agora" (texto de teste, conforme adulto-sca-inicial) | ok | 819efa6a-5aef-43c7-becd-113ee715e47a | ok |
| B03.06.clopidogrel | f5_med_upa | Clopidogrel "Agora" (texto de teste) | ok | ca9f9edb-136c-4ca5-a166-8c7dfadd8b3f | ok |
| B03.06.enoxaparina | f5_med_upa | Enoxaparina (alta vigilância) "Agora" (texto de teste) | ok | f1de9abf-7f9e-42a9-8712-f41cc71f8457 | ok |
| B03.06.interacoes | banco | Interações registradas com justificativa (alertas_interacao) | ok | 0 alerta(s): nenhum | ok |
| B03.07.validar | f5_farm | Farmacêutico valida a enoxaparina (alta vigilância) | ok | ok: na fila com alta vigilância / | ok |
| B03.08.checar_aas | f5_enf_upa | Enfermeira apraza e checa "feito": aas | ok | 1f91f867-09ec-472b-bd72-8b50e113f017 | ok |
| B03.08.checar_clopidogrel | f5_enf_upa | Enfermeira apraza e checa "feito": clopidogrel | ok | b928189d-4615-4707-9863-12c2359d584e | ok |
| B03.08.checar_enoxaparina | f5_enf_upa | Enfermeira apraza e checa "feito": enoxaparina | ok | 08877510-5b15-4c66-9c9d-aaa4842e0ad1 | ok |
| B03.09.solicitar | f5_med_upa | Transferência: leito clínico, ambulância avançada, 0303060190, I21.9, emergência | ok | 41905f21-578d-477a-acc7-e989e3796f84 | ok |
| B03.09.enviada | banco | enviada | ok | ok: nº 104 enviada, destino a_definir, assumida_por nulo | ok |
| B03.10.fila_gestor | f5_ges_upa | Gestor da central vê o pedido na fila (não decide) | ok | ok: na fila | ok |
| B03.10.gestor_nao_decide | f5_ges_upa | Gestor da central tenta assumir (deve ser recusado) | erro | recusado: Assume o pedido o médico regulador da central. | ok |
| B03.11.assumir | f5_regulador | Regulador assume | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B03.11.priorizar | f5_regulador | Prioriza como emergência | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B03.12.mapa | f5_regulador | Mapa de vagas: Clínica Médica do hospital e Internação da UPA ofertada | ok | ok: {"agora": "2026-11-07T03:08:22.796845+00:00", "totais": [{"livre": 2, "total": 8, "tipo_leito": "clinico", "higienizacao": 3}, {"livre": 3, "total": 3, "tipo_leito":… | ok |
| B03.13.autorizar | f5_regulador | Autoriza para o Hospital F5, ambulância avançada, previsto +2 h, leito monitorado | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B03.13.aviso_destino | banco | Aviso reg_destino_N aos plantonistas e ao gestor do hospital | ok | ok: 3 aviso(s): 11,23,27 | ok |
| B03.14.lista | f5_med_hosp | Pedido na lista do destino | ok | ok: na lista | ok |
| B03.14.leitos | f5_med_hosp | regulacao_leitos_destino oferece o leito escolhido | ok | ok: [{"id": "2ef215f4-ef5c-47d5-8eee-d2add008c90c", "leito": "CM-03", "setor": "Clínica Médica", "do_tipo": true, "tipo_regulacao": "clinico"}, {"id": "bf8f0867-0c70-4ed… | ok |
| B03.15.leito_de_outra_unidade | f5_med_hosp | Aceitar com leito de outra unidade (INT da UPA) (deve ser recusado) | erro:Leito não encontrado nesta unidade | recusado: Leito não encontrado nesta unidade. | ok |
| B03.15.sem_leito_transferencia | f5_med_hosp | Transferência aceita sem leito passa (desfeito: o cenário escolhe o leito) | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla | ok |
| B03.15.aceitar | f5_med_hosp | Hospital aceita e reserva o leito (leito monitorado) | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B03.15.reserva | banco | autorizada; leito reservado; reserva até max(agora + 24 h, previsto + 8 h), paciente nulo; evento de leito | ok | ok: status autorizada, leito CM-03 reservado, reserva até 2026-11-08 03:08:22.796845+00 (Regulação nº 104 (de UPA Fase 5 24h)) | ok |
| B03.15.avisos | banco | Avisos reg_destino_aceitou_N à origem e ao regulador | ok | ok: 2 aviso(s) | ok |
| B03.16.nir | f5_nir | NIR: nada parado neste pedido | ok | ok: nada parado | ok |
| B03.17.desfecho | f5_med_upa | Desfecho transferência (Hospital F5) | ok | (sem retorno: void) | ok |
| B03.18.enfermeira_nao_marca | f5_enf_upa | Enfermeira tenta marcar a saída (deve ser recusado) | erro:Marca a saída | recusado: Marca a saída a equipe médica, o gestor ou o NIR da origem. | ok |
| B03.18.saida | f5_nir | NIR marca a saída (em trânsito) | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B03.18.reserva_estendida | banco | Na saída a reserva é estendida (compara expira_em com o do aceite) | ok | confere: antes 2026-11-08 03:08:22.796845+00, depois 2026-11-08 03:08:22.796845+00 | **falha** |
| B03.18.aviso_saiu | banco | Aviso reg_saiu_N ao hospital | ok | ok: aviso reg_saiu_104 | ok |
| B03.19.chegada | f5_med_hosp | Hospital marca a chegada (realizada) | ok | {"id": "41905f21-578d-477a-acc7-e989e3796f84", "cbo": null, "cid": "I21.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B03.19.reserva_estendida | banco | Na chegada a reserva é estendida de novo ("pronta para ocupar") | ok | confere: antes 2026-11-08 03:08:22.796845+00, depois 2026-11-08 03:08:22.796845+00, situação ativa | **falha** |
| B03.19.segunda_chegada | f5_med_hosp | Segunda chegada depois de realizada (deve ser recusado) | erro:Este pedido não está esperando | recusado: Este pedido não está esperando a chegada do paciente. | ok |
| B03.19.sem_internacao | banco | A chegada regulada não cria internação no hospital | ok | ok: nenhuma internação no hospital | ok |
| B03.20.ficha | f5_rec_hosp | Recepção do hospital abre a ficha na porta (transferido da UPA, IAM) | ok | ba803b40-cbee-4244-b51d-bdaadb8e3822 | ok |
| B03.20.paciente | banco | Paciente do hospital | ok | 5d41292a-9171-4f2f-90dd-380d48c40522 | ok |
| B03.20.chamar | f5_enf_hosp | Enfermeira do hospital chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| B03.20.classificar | f5_enf_hosp | Classifica vermelho (escolha da enfermeira de teste), "Dor torácica" | ok | 5b68ba3a-1d9d-42d6-ad8a-07e5b1064dbb | ok |
| B03.21.iniciar | f5_med_porta_hosp | Médico da porta assume | ok | (sem retorno: void) | ok |
| B03.21.soap | f5_med_porta_hosp | SOAP de chegada (I21.9) | ok | 7263dcd7-ac81-4cb5-aea0-9a9a12a5817c | ok |
| B03.21.leitos | f5_med_porta_hosp | leitos_para_ocupar oferece o leito reservado pela regulação | ok | ok: CM-01 (reservado), CM-03 (reservado), CM-04 | ok |
| B03.21.internar | f5_med_porta_hosp | Interna no leito reservado | ok | (sem retorno: void) | ok |
| B03.21.internacao | banco | Internação no hospital | ok | 5a6d2da5-ca1d-4a87-9175-1d0dfad64d26 | ok |
| B03.21.reserva_ocupada | banco | Leito ocupado; a reserva da regulação vira "ocupada" e liga à internação; conta de internação do hospital aberta | ok | ok: leito CM-03 ocupado; reserva ocupada (Ocupado pela internação) | ok |
| B03.22.admissao | f5_med_hosp | Médico da Clínica Médica registra a admissão | ok | ec7924c7-463f-4917-a342-9011aafaaf80 | ok |
| B03.22.laudo_aih | f5_med_hosp | Laudo de AIH com 0303060190 | ok | Falta para emitir: Completar o cadastro: CNS. | **falha** |
| B03.22.aih | banco | AIH solicitada pelo gatilho do laudo | existir | bloqueado por passo anterior (sem b03_laudo) | **lacuna** |
| B03.23.gestor_nao_decide | f5_ges_upa | Gestor da UPA tenta decidir a AIH (deve ser recusado) | existir | bloqueado por passo anterior (sem b03_aih) | **lacuna** |
| B03.23.decidir | f5_regulador | Regulador aprova a AIH | existir | bloqueado por passo anterior (sem b03_aih) | **lacuna** |
| B03.24.conferencia | f5_fat | Conta da UPA: aberta → em_conferencia | ok | {"id": "68670784-dad9-41ed-99b8-61f8d51c2339", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:08:22.796845+00:0 | ok |
| B03.24.custos | f5_fat | Custos e pré-auditoria da conta da UPA | ok | status em_conferencia; total 12.89; itens: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, 0301100012 qt 3 = 1.89; medicamentos 3; pendências 5; bloqueantes sem liberaç… | ok |
| B03.24.fechar | f5_fat | Conta da UPA: em_conferencia → fechada | ok | {"id": "68670784-dad9-41ed-99b8-61f8d51c2339", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:08:22.796845+00:0 | ok |
| B03.24.conta_int_hospital | f5_fat | Conta de internação do hospital (AIH 0303060190) | ok | daa956fc-623e-4579-9c97-8281daba26a1 | ok |
| B03.24.custos_int_hospital | f5_fat | Custos da internação no hospital | ok | status aberta; total 0; itens: nenhum; medicamentos 0; pendências 1; bloqueantes sem liberação 1 | ok |
| B03.24.conta_porta_hospital | f5_fat | Conta da porta do hospital | ok | 2bf24aa2-38ed-4beb-b9fe-d6886231a44a | ok |
| B03.24.custos_porta_hospital | f5_fat | Custos da porta do hospital | ok | status aberta; total 0; itens: ? qt 1 = nulo, ? qt 1 = nulo; medicamentos 0; pendências 4; bloqueantes sem liberação 2 | ok |
| B03.25.indicadores | f5_ges_upa | Indicadores da central | ok | {"agora": "2026-11-07T03:08:22.796845+00:00", "total": 8, "escopo": "rede", "prazos": {"fila": {"n": 7, "no_prazo": 7}, "destino": {"n": 6, "no_prazo": 6}, "valores": {"… | ok |
| B03.25.sla | f5_ges_upa | Painel de SLA da central: o pedido realizado não está nele | ok | ok: fora do painel | ok |
| B03.25.tempos | banco | Tempos por status (regulacao_status_tempos) | ok | ok: enviada → em_analise → aguardando_destino → autorizada → em_transito → realizada | ok |
| B03.99.reserva_vencida | banco | Reserva vencida liberada por private.expirar_reservas | existir | Não executado: exigiria esperar o vencimento (1 h no mínimo) ou mexer no relógio; o cron expirar-reservas-leito roda a cada 5 min na homologação. | **lacuna** |
| B03.99.eventos | banco | Um evento por transição, autor = login | ok | ok: enviada por 08 → assumida por 12 → prioridade_regulador por 12 → autorizada por 12 → destino_aceitou por 11 → saiu por 13 → chegou por 11 | ok |
| B03.22.cns_cadastro | f5_rec_hosp | O laudo pediu o CNS: a recepção do hospital completa o cadastro com o CNS | ok | Acesso negado: paciente fora do seu plantão. | **falha** |
| B03.22.aih | banco | AIH solicitada pelo gatilho do laudo | existir | bloqueado por passo anterior (sem b03_laudo) | **lacuna** |
| B03.23.gestor_nao_decide | f5_ges_upa | Gestor da UPA tenta decidir a AIH (deve ser recusado) | existir | bloqueado por passo anterior (sem b03_aih) | **lacuna** |
| B03.23.decidir | f5_regulador | Regulador aprova a AIH | existir | bloqueado por passo anterior (sem b03_aih) | **lacuna** |
| B03.24.custos_int_hospital_aih | f5_fat | Custos da internação no hospital depois da AIH | ok | status aberta; total 0; itens: nenhum; medicamentos 0; pendências 1; bloqueantes sem liberação 1 | ok |
| B03.22.cns_cadastro | f5_med_hosp | O laudo pediu o CNS: o médico da Clínica Médica completa o cadastro com o CNS (a recepção da porta já não alcança o internado) | ok | {"setor_id": "f5300000-0000-4000-8000-000000000021", "prontuario": "2026.000002", "paciente_id": "5d41292a-9171-4f2f-90d | ok |
| B03.22.laudo_aih_com_cns | f5_med_hosp | Laudo de AIH com 0303060190, depois do CNS | ok | d6599253-c79d-4774-adc3-1c7a28e3f01b | ok |
| B03.22.aih | banco | AIH solicitada pelo gatilho do laudo | ok | 60669fb9-158b-4b97-a836-f7c294c12915 | ok |
| B03.23.gestor_nao_decide | f5_ges_upa | Gestor da UPA tenta decidir a AIH (deve ser recusado) | erro | recusado: A decisão da AIH é do médico regulador da unidade. | ok |
| B03.23.decidir | f5_regulador | Regulador aprova a AIH | ok | (sem retorno: void) | ok |
| B03.24.custos_int_hospital_aih | f5_fat | Custos da internação no hospital depois da AIH | ok | status aberta; total 588.12; itens: 0303060190 qt 1 = 588.12; medicamentos 0; pendências 1; bloqueantes sem liberação 0 | ok |

## B04 — Trauma sem documento, aceite com leito e "não chegou"

**Resumo.** Às 00h11.
- **Porta:** ficha sem CNS e sem CPF; classificação vermelha em "Politraumas", Glasgow 13; SOAP S06.9; três exames; peso **estimado** aceito; ringer e morfina, esta liberada pela farmácia.
- **Pedido:** recusado sem documento; aceito com `paciente_nao_identificado = true` (nº 105). A saída antes do aceite foi recusada.
- **Aceite:** o hospital aceitou e reservou o **UTI-01**. A recepção completou o CNS, e o pedido manteve a marca de não identificado. O desfecho `transferencia` sem relato passou.
- **Saída e "não chegou":** o NIR marcou a saída. O NIR da UPA não vê `reg_chegada`; o **gestor do hospital vê**. O hospital recusou o "não chegou" com 8 letras e registrou a falta. A reserva foi cancelada, o UTI-01 voltou a livre, com os eventos `reserva` e `cancelamento_reserva`, e a origem foi avisada.
- **Depois da falta:** cancelar, aceitar e marcar saída foram recusados. Os indicadores contam `faltas: 1`. A conta da porta fechou.

**Status (nº 105):** `enviada → em_analise → aguardando_destino → autorizada → em_transito → falta`.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| B04.01.ficha | f5_rec_upa | Recepção abre a ficha no PS sem CNS e sem CPF (queda de moto) | ok | 1a5ff29f-0f62-4cd5-a547-f322abae838d | ok |
| B04.01.paciente | banco | Paciente sem CNS e sem CPF | ok | ab9ec851-7b71-46dc-af94-b730e2e02bd7 | ok |
| B04.01.conta | f5_fat | Conta ambulatorial aberta | ok | fa2570c6-c54a-45fc-9639-44ef599b0a36 | ok |
| B04.02.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| B04.02.classificar | f5_enf_upa | Classifica vermelho (escolha da enfermeira de teste), "Politraumas", Glasgow 13, dor 7/10 | ok | 4ae789a9-d5f1-45b1-a8b5-51880a321249 | ok |
| B04.03.iniciar | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| B04.03.soap | f5_med_upa | SOAP com CID S06.9 (decisão pelas fichas de trauma do adulto, na tela) | ok | 123e8dc4-ed38-4bf9-b166-5151efc84422 | ok |
| B04.05.exames | f5_med_upa | Pede hemograma, RX de tórax (SIGTAP) e tipagem sanguínea (nome livre) | ok | 3 | ok |
| B04.05.resultados | f5_med_upa | Resultados em texto | ok | ok,ok,ok | ok |
| B04.06.peso | f5_med_upa | Peso ESTIMADO 75 kg | ok | 1 sinais gravados | ok |
| B04.06.volume | f5_med_upa | Ringer com lactato "Agora" (texto de teste, conforme adulto-trauma-inicial); peso estimado aceito | ok | 8e43817c-13cb-468d-bfc9-5d23c23ddfb4 | ok |
| B04.06.analgesia | f5_med_upa | Morfina (alta vigilância) "Agora" (texto de teste, conforme adulto-trauma-inicial) | ok | 9b3d4baf-8c93-4d77-ad29-ab260fc77c90 | ok |
| B04.07.validar | f5_farm | Farmacêutico valida a morfina (alta vigilância) | ok | (sem retorno: void) | ok |
| B04.07.checar_volume | f5_enf_upa | Enfermeira apraza e checa "feito": volume | ok | 06df6e00-b144-4823-9100-4e2f018a0aea | ok |
| B04.07.checar_analgesia | f5_enf_upa | Enfermeira apraza e checa "feito": analgesia | ok | 5b3e2c63-4c0a-4ae4-8f7e-9b132f5d3cf5 | ok |
| B04.08.sem_documento | f5_med_upa | Pedido sem CNS/CPF e sem a marca de não identificado (deve ser recusado) | erro:O paciente está sem CNS e sem CPF | recusado: O paciente está sem CNS e sem CPF válidos. Complete o cadastro ou marque como paciente não identificado. | ok |
| B04.09.solicitar | f5_med_upa | Repete com paciente_nao_identificado = true | ok | a7d7dab3-741b-466f-9642-018c3b445ca6 | ok |
| B04.09.marca | banco | enviada com paciente_nao_identificado = true | ok | ok: nº 105, enviada, não identificado true | ok |
| B04.10.assumir | f5_regulador | Regulador assume | ok | {"id": "a7d7dab3-741b-466f-9642-018c3b445ca6", "cbo": null, "cid": "S06.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B04.10.autorizar | f5_regulador | Autoriza para o Hospital F5, ambulância avançada, previsto +1 h | ok | {"id": "a7d7dab3-741b-466f-9642-018c3b445ca6", "cbo": null, "cid": "S06.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| B04.10.saida_antes_do_aceite | f5_nir | Marcar a saída antes do aceite do destino (deve ser recusado) | erro:Só sai o paciente | recusado: Só sai o paciente com o pedido aceito pelo destino. | ok |
| B04.11.aceitar | f5_med_hosp | Hospital aceita e reserva um leito da UTI | ok | {"id": "a7d7dab3-741b-466f-9642-018c3b445ca6", "cbo": null, "cid": "S06.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B04.11.reserva | banco | autorizada; leito reservado; evento de reserva | ok | ok: status autorizada, leito UTI-01 reservado, reserva até 2026-11-08 03:11:05.302573+00 | ok |
| B04.12.cns | f5_rec_upa | Recepção completa o cadastro com o CNS trazido pela família | ok | {"setor_id": "f5300000-0000-4000-8000-000000000011", "prontuario": "2026.000022", "paciente_id": "ab9ec851-7b71-46dc-af9 | ok |
| B04.12.marca_mantida | banco | Paciente com CNS; o pedido guarda paciente_nao_identificado = true (histórico) | ok | ok: CNS 700900000448075, pedido não identificado true | ok |
| B04.13.desfecho | f5_med_upa | Desfecho transferência SEM relato (o relato só é exigido em evasão, alta a pedido e óbito) | ok | (sem retorno: void) | ok |
| B04.14.saida | f5_nir | NIR marca a saída (em trânsito) | ok | {"id": "a7d7dab3-741b-466f-9642-018c3b445ca6", "cbo": null, "cid": "S06.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B04.14.aviso_saiu | banco | Aviso reg_saiu_N ao hospital | ok | ok: aviso reg_saiu_105 | ok |
| B04.15.nir_upa | f5_nir | O item reg_chegada é do destino: o NIR da UPA não o vê | ok | ok: sem reg_chegada na UPA | ok |
| B04.15.gestor_hospital | f5_ges_hosp | O gestor do hospital vê reg_chegada ("paciente a caminho sem registro de chegada") | ok | ok: Regulação nº 105: paciente a caminho sem registro de chegada | ok |
| B04.16.obs_curta | f5_med_hosp | "Não chegou" com observação de 8 letras (deve ser recusado) | erro:Escreva o que aconteceu | recusado: Escreva o que aconteceu (mínimo de 10 letras). | ok |
| B04.16.nao_chegou | f5_med_hosp | Hospital registra que o paciente não chegou (desviado pelo SAMU) | ok | {"id": "a7d7dab3-741b-466f-9642-018c3b445ca6", "cbo": null, "cid": "S06.9", "sla": null, "tipo": "transferencia", "exame | ok |
| B04.16.falta | banco | falta; falta_em; reserva liberada e leito livre; evento de leito; aviso reg_nao_chegou_N à origem | ok | ok: status falta, reserva cancelada (Regulação nº 105: paciente não chegou), leito UTI-01 livre, eventos do leito: reserva livre→reservado, cancelamento_reserva reservad… | ok |
| B04.17.cancelar | f5_med_upa | Origem tenta cancelar depois da falta (deve ser recusado) | erro:Esta solicitação não pode mais ser… | recusado: Esta solicitação não pode mais ser cancelada. | ok |
| B04.17.aceitar | f5_med_hosp | Destino tenta aceitar depois da falta (deve ser recusado) | erro | recusado: Este pedido não está aguardando o aceite da unidade. | ok |
| B04.17.saida | f5_nir | NIR tenta marcar a saída depois da falta (deve ser recusado) | erro | recusado: Só sai o paciente com o pedido aceito pelo destino. | ok |
| B04.18.indicadores | f5_ges_upa | Indicadores da central (falta contabilizada) | ok | {"agora": "2026-11-07T03:11:05.302573+00:00", "total": 9, "escopo": "rede", "prazos": {"fila": {"n": 8, "no_prazo": 8}, "destino": {"n": 7, "no_prazo": 7}, "valores": {"… | ok |
| B04.19.conferencia | f5_fat | aberta → em_conferencia | ok | {"id": "fa2570c6-c54a-45fc-9639-44ef599b0a36", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:11:05.302573+00:0 | ok |
| B04.19.custos | f5_fat | Custos e pré-auditoria (CNS já completado) | ok | status em_conferencia; total 12.26; itens: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, 0301100012 qt 2 = 1.26; medicamentos 2; pendências 4; bloqueantes sem liberaç… | ok |
| B04.19.fechar | f5_fat | em_conferencia → fechada | ok | {"id": "fa2570c6-c54a-45fc-9639-44ef599b0a36", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:11:05.302573+00:0 | ok |
| B04.99.eventos | banco | Um evento por transição, autor = login | ok | ok: enviada por 08 → assumida por 12 → autorizada por 12 → destino_aceitou por 11 → saiu por 13 → nao_chegou por 11 | ok |

## B05 — UBS: escuta, consulta regulada e teleinterconsulta

**Resumo.** Às 00h12, na UBS.
- **Escuta:** a ficha foi de escuta inicial. O técnico foi recusado. A enfermeira classificou amarelo com saída consulta, gravado em `classificacoes_risco` com autora = login.
- **Consulta:** a médica abriu e registrou o SOAP G45.9.
- **Regulação:** sem CBO foi recusada; CID sem ponto foi normalizado; eletivo + emergência foi aceito (desfeito). O pedido nº 107 de Neurologia (CBO 225112, 0301010072) saiu com modalidade 07.
- **Teleinterconsulta:**
  - bordas de pergunta curta e de consentimento recusadas;
  - a primeira nasceu `aberta`, com documento e auditoria; a médica não aceita;
  - a telemedicina da rede também não aceita (P2-3), e a primeira ficou **aberta**;
  - a segunda foi cancelada antes do aceite.
- **Conduta:** encerrou a consulta com encaminhamento especializado. Nenhum valor e nenhum BPA na UBS.
- **Central e destino:** o regulador autorizou para o hospital com data prevista de +7 dias. A médica da UBS não aceita pelo destino. O hospital aceitou **sem leito e sem reserva** e marcou a chegada direto de `autorizada`. O gestor da UBS acompanhou na lista.

**Status (nº 107):** `enviada → em_analise → aguardando_destino → autorizada → realizada`.

**Falhas:** `B05.07.cid_sem_ponto` duas vezes (erros do script: leitura direta da tabela, que o RLS nega, e leitura no mesmo comando do insert; refeito, ok) e `B05.10.tele_aceita` (P2-3). A lacuna é a resposta da telemedicina, bloqueada.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| B05.01.ficha | f5_rec_ubs | Recepção abre a ficha de escuta inicial no Consultório 1 | ok | c8d5aa4e-ed85-498b-919e-5d5208549db2 | ok |
| B05.01.paciente | banco | Paciente e tipo de atendimento da UBS | ok | e1987a8a-2a20-45a1-b0f6-d94d62e10d69 | ok |
| B05.02.tecnico | f5_tec_ubs | Técnico de enfermagem tenta a escuta (deve ser recusado) | erro:A escuta inicial e a classificação… | recusado: A escuta inicial e a classificação são do enfermeiro. | ok |
| B05.03.escuta | f5_enf_ubs | Enfermeira classifica amarelo (escolha da enfermeira de teste), sinais crus, saída consulta | ok | 66969a95-9be7-4d7f-8e79-789cea9f3c4d | ok |
| B05.03.escuta_banco | banco | Cor da enfermeira, saída consulta, autora = login | ok | ok: cor amarelo, saída consulta, autora 02 | ok |
| B05.04.iniciar | f5_med_ubs | Médica abre a consulta | ok | (sem retorno: void) | ok |
| B05.04.soap | f5_med_ubs | SOAP com CID G45.9 (ramo da ficha abcd2 escolhido pela médica de teste: consulta especializada regulada) | ok | 36c84765-4336-4d7e-b0ac-bc12a204bb95 | ok |
| B05.07.sem_cbo | f5_med_ubs | Consulta sem CBO (deve ser recusado) | erro:Na consulta, informe a especialida… | recusado: Na consulta, informe a especialidade pelo CBO. | ok |
| B05.07.cid_sem_ponto | f5_med_ubs | CID sem ponto (G459) é normalizado para G45.9 (desfeito) | ok | permission denied for table regulacao_solicitacoes | **falha** |
| B05.07.eletivo_emergencia | f5_med_ubs | Observação: caráter eletivo com prioridade emergência (o CHECK não cruza os dois; desfeito) | registrar | ACEITO (desfeito): {"id": "5a50793d-fd26-4748-b572-14597ba9f363", "numero": 106, "aviso_duplicidade": false} | ok |
| B05.07.solicitar | f5_med_ubs | Pede consulta de Neurologia (CBO 225112), 0301010072, G45.9, eletivo, prioritária | ok | 6373fb63-e222-477b-81b4-755a6b1d20ba | ok |
| B05.07.enviada | banco | enviada, modalidade 07, CBO e especialidade gravados | ok | ok: nº 107, modalidade 07, CBO 225112 (Neurologia) | ok |
| B05.07.lista | f5_med_ubs | regulacao_lista(UBS) mostra o pedido | ok | ok: na lista da UBS | ok |
| B05.08.tele_na_unidade | f5_med_ubs | Quem está de telemedicina para a UBS | ok | ninguém de telemedicina para a UBS | ok |
| B05.08.pergunta_curta | f5_med_ubs | Pergunta de 9 letras (deve ser recusado) | erro:Escreva a pergunta | recusado: Escreva a pergunta ao teleconsultor (pelo menos 10 caracteres). | ok |
| B05.08.sem_consentimento | f5_med_ubs | Consentimento fora da lista (deve ser recusado) | erro:Registre o consentimento | recusado: Registre o consentimento do paciente para a teleinterconsulta. | ok |
| B05.08.solicitar | f5_med_ubs | Solicita teleinterconsulta (consentimento obtido, rotina) | ok | fe83f399-e4aa-450a-94d6-232b4f5e347f | ok |
| B05.08.aberta | banco | aberta, com documento clínico assinado pelo login da médica e auditoria | ok | ok: status aberta, documento teleinterconsulta nº 2026/000001, auditoria 1 | ok |
| B05.09.medica_nao_aceita | f5_med_ubs | A médica que pediu tenta aceitar (deve ser recusado) | erro | recusado: Acesso negado: só o médico de telemedicina de plantão nesta unidade aceita. | ok |
| B05.10.tele_lista | f5_med_ubs | teleinterconsultas_da_unidade(UBS) lista a aberta | ok | ok: na lista, aberta | ok |
| B05.10.tele_aceita | f5_tele | A conta de telemedicina (escalada na UPA) tenta aceitar a teleinterconsulta da UBS | ok | Acesso negado: só o médico de telemedicina de plantão nesta unidade aceita. | **falha** |
| B05.10.tele_responde | f5_tele | Telemedicina responde (parecer ≥ 20 letras) | existir | bloqueado por passo anterior (sem b05_tele_aceita) | **lacuna** |
| B05.11.solicitar_outra | f5_med_ubs | Segunda teleinterconsulta, para provar o cancelamento antes do aceite | ok | 13580e75-edbf-4d8b-956e-9d348068911d | ok |
| B05.11.cancelar | f5_med_ubs | A médica cancela antes do aceite | ok | (sem retorno: void) | ok |
| B05.11.cancelada | banco | Teleinterconsulta cancelada | ok | ok: status cancelada | ok |
| B05.11.cancelar_depois_do_aceite | f5_med_ubs | Cancelar a primeira (já aceita ou respondida, se a telemedicina aceitou) (registro) | registrar | ACEITO (desfeito): | ok |
| B05.12.conduta | f5_med_ubs | Conduta: hipertensão, G45.9, CIAP K89, encaminhamento especializado; encerra a consulta | ok | (sem retorno: void) | ok |
| B05.12.encerrado | banco | Episódio da UBS encerrado; conduta com encaminhamento especializado | ok | ok: etapa encerrado | ok |
| B05.12.ubs_sem_valor | f5_ges_ubs | Nenhuma conta com valor na UBS para a paciente | ok | ok: UBS sem item com valor | ok |
| B05.12.ubs_sem_bpa | f5_ges_ubs | A UBS não gera linha de BPA | ok | ok: UBS sem linha | ok |
| B05.13.gestor_lista | f5_ges_ubs | Gestor da UBS vê o pedido | ok | ok: na lista | ok |
| B05.13.historico | f5_ges_ubs | Histórico da paciente | ok | [{"id": "6373fb63-e222-477b-81b4-755a6b1d20ba", "cid": "G45.9", "tipo": "consulta", "numero": 107, "origem": "UBS Fase 5", "status": "enviada", "carat | ok |
| B05.14.fila | f5_regulador | Pedido na fila da central | ok | ok: na fila | ok |
| B05.14.assumir | f5_regulador | Regulador assume | ok | {"id": "6373fb63-e222-477b-81b4-755a6b1d20ba", "cbo": "225112", "cid": "G45.9", "sla": {"fila": {"atrasado": false, "cor | ok |
| B05.15.autorizar | f5_regulador | Autoriza para o Hospital F5, sem transporte, previsto +7 dias (ambulatório de neurologia) | ok | {"id": "6373fb63-e222-477b-81b4-755a6b1d20ba", "cbo": "225112", "cid": "G45.9", "sla": {"fila": {"atrasado": false, "cor | ok |
| B05.15.ubs_nao_aceita | f5_med_ubs | A médica da origem tenta aceitar pelo destino (deve ser recusado) | erro:Responde pelo destino | recusado: Responde pelo destino o médico plantonista ou o gestor da unidade. | ok |
| B05.16.aceitar | f5_med_hosp | Hospital aceita sem leito: quarta-feira 9h, ambulatório | ok | {"id": "6373fb63-e222-477b-81b4-755a6b1d20ba", "cbo": "225112", "cid": "G45.9", "sla": null, "tipo": "consulta", "exames | ok |
| B05.16.sem_reserva | banco | autorizada sem reserva; resposta aceita com leito nulo; data prevista gravada | ok | ok: status autorizada, data prevista 2026-11-14 03:12:42.688943+00, observação do aceite quarta-feira 9h, ambulatório (teste B05) | ok |
| B05.17.gestor_ve | f5_ges_ubs | Gestor da UBS vê autorizada, destino e data prevista | ok | ok: status autorizada, destino ?, data 2026-11-14T03:12:42.688943+00:00 | ok |
| B05.18.chegada | f5_med_hosp | No dia: compareceu à consulta (direto de autorizada, sem saída) | ok | {"id": "6373fb63-e222-477b-81b4-755a6b1d20ba", "cbo": "225112", "cid": "G45.9", "sla": null, "tipo": "consulta", "exames | ok |
| B05.18.realizada | banco | realizada | ok | ok: nº 107 realizada, destino rede, assumida_por 12 | ok |
| B05.19.indicadores | f5_ges_upa | Indicadores da central | ok | {"agora": "2026-11-07T03:12:42.688943+00:00", "total": 10, "escopo": "rede", "prazos": {"fila": {"n": 9, "no_prazo": 9}, "destino": {"n": 8, "no_prazo": 8}, "valores": {… | ok |
| B05.99.eventos | banco | Um evento por transição, autor = login | ok | ok: enviada por 04 → assumida por 12 → autorizada por 12 → destino_aceitou por 11 → chegou por 11 | ok |
| B05.07.cid_sem_ponto | f5_med_ubs | CID sem ponto (G459) é normalizado para G45.9 (desfeito) | ok | Solicitação não encontrada. | **falha** |
| B05.07.cid_sem_ponto | f5_med_ubs | CID sem ponto (G459) é normalizado para G45.9 (desfeito) | ok | ok: gravado G45.9 | ok |

## B06 — SLA estourado (só alerta), cobrança do NIR e cancelamento pela origem

**Resumo.** Quatro fases, sem mexer no relógio. Os prazos curtos vieram da RPC do produto (`regulacao_definir_prazos`). Entre as fases o status só mudou pela mão das pessoas.

- **Fase 1 (06/11, 23h54):**
  - bordas de prazos: o NIR é recusado; "sem evolução" igual à evolução é recusado; fila de 0 min é recusada; o regulador também ajusta (desfeito);
  - o gestor da central gravou fila 1/5/10/30 min, evolução 1 h, pendência 1 h, sem evolução 2 h e destino 1 h, com histórico e auditoria;
  - porta: ficha, classificação laranja em "Queixas respiratórias", SOAP J18.9, peso referido, ceftriaxona e furosemida checadas e internação na UPA no INT-03, com a conta de internação aberta;
  - na internação: admissão, diagnóstico e laudo de AIH 0303140151;
  - pedido nº 95 de leito clínico (urgência, idoso), `enviada`.
- **Fase 2 (00h01 de 07/11, 7 min depois):**
  - o status continuava `enviada`;
  - o painel de SLA da central marcou a fila atrasada (458 s contra 5 min);
  - o cron gerou `reg_prazo_fila_95` para o regulador;
  - o regulador assumiu e abriu a pendência (gasometria e RX), e a segunda pergunta foi recusada;
  - o NIR ainda não via a pendência.
- **Fase 3 (01h16, pendência parada há 75 min):**
  - o status continuava `pendencia`;
  - o NIR viu `reg_pendencia` ("pergunta da central sem resposta", `pode_cobrar`) e cobrou: `nir_cobrancas`, auditoria e aviso `reg_cobranca_95` ao médico da internação;
  - o mesmo médico tinha os avisos do cron `reg_prazo_pendencia_95` e `reg_prazo_evolucao_95` (três avisos distintos);
  - a origem respondeu e anexou o laudo, e o pedido voltou a `em_analise`;
  - cobrar de novo foi recusado ("não está mais em aberto");
  - o NIR passou a mostrar `reg_evolucao` ("evolução vencida");
  - o regulador autorizou para o Hospital F5, que não respondeu de propósito.
- **Fase 4 (02h31; 157 min sem evolução, 74 min sem resposta do destino):**
  - status `aguardando_destino`, `cancelamento_origem` nulo; o prazo **só avisou**;
  - o NIR mostrou "(risco de cancelamento)", e o cron gerou `reg_prazo_72h_95` ("a central pode cancelar");
  - painel de SLA da UPA: `destino_atrasado = 1`, `evolucao_atrasada = 1`, `risco_cancelamento = 1`;
  - `reg_prazo_destino_95` chegou ao médico e ao gestor do hospital (unidade = hospital) e ao regulador (unidade = central);
  - o NIR da UPA não vê `reg_destino`, mas o **gestor do hospital vê**;
  - a evolução zerou o relógio (o `reg_evolucao` saiu do NIR, e o regulador recebeu `reg_evolucao_95`);
  - o médico do PS foi recusado ao cancelar; o solicitante cancelou (`cancelada`, origem `solicitante`, aviso `reg_cancelada_95` ao hospital);
  - o pedido saiu do painel; cada aviso do cron saiu uma vez só;
  - os prazos voltaram ao padrão, com histórico;
  - alta melhorada, AIH aprovada e as **duas contas fechadas**.

**Status (nº 95):** `enviada (8 min) → em_analise → pendencia (75 min) → em_analise → aguardando_destino (74 min) → cancelada`. Nenhum prazo mudou o status; `cancelamento_origem = 'prazo'` nunca foi gravado (lacuna do MAPA, confirmada).

**Ordem ajustada:** a autorização (passo 21) veio antes da evolução (passo 20). Assim o "sem evolução" de 2 h e o destino atrasado de 1 h venceram na mesma fase. O fechamento das contas da fase 4 ganhou a liberação do gestor como reserva, que não foi preciso. O ajuste foi feito entre as fases 2 e 3 e não mexe nas fases 1 a 3.

**Não executado:** o NIR fora da escala sendo recusado. Exigiria mexer no relógio ou na escala.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| B06.00.nir_nao_define | f5_nir | NIR tenta ajustar os prazos da central (deve ser recusado) | erro | recusado: Os prazos são ajustados pelo regulador ou pelo gestor da central. | ok |
| B06.00.sem_evolucao_igual | f5_ges_upa | Sem evolução 1 h com evolução 1 h (deve ser recusado) | erro:Sem evolução | recusado: Sem evolução: até 720 horas e maior que o prazo da evolução. | ok |
| B06.00.fila_fora_da_faixa | f5_ges_upa | Prazo da fila de 0 min (deve ser recusado) | erro:Prazo da fila | recusado: Prazo da fila: de 1 minuto a 30 dias. | ok |
| B06.00.regulador_define | f5_regulador | O regulador também ajusta os prazos (passa; desfeito) | ok | {"fila": {"eletiva": null, "urgencia": null, "emergencia": null, "prioritaria": null}, "ajustado": true, "destino_h": 24, "central_id": "f5100000-0000-4000-8000-00000000… | ok |
| B06.00.prazos | f5_ges_upa | Gestor da central grava prazos curtos: fila 1/5/10/30 min, evolução 1 h, pendência 1 h, sem evolução 2 h, destino 1 h | ok | {"fila": {"eletiva": 30, "urgencia": 5, "emergencia": 1, "prioritaria": 10}, "ajustado": true, "destino_h": 1, "central_id": "f5100000-0000-4000-8000-000000000009", "evo… | ok |
| B06.00.historico | banco | Histórico com antes/depois e auditoria regulacao_prazos_ajustados | ok | ok: antes {"fila": {"eletiva": null, "urgencia": null, "emergencia": null, "prioritaria": null}, "ajustado": false, "destino_h": 24, "central_id": "f5100000-0000-4000-80… | ok |
| B06.00.prazos_lidos | f5_regulador | regulacao_prazos(central) devolve os novos | ok | ok: {"fila": {"eletiva": 30, "urgencia": 5, "emergencia": 1, "prioritaria": 10}, "ajustado": true, "destino_h": 1, "central_id": "f5100000-0000-4000-8000-000000000009", … | ok |
| B06.01.ficha | f5_rec_upa | Recepção abre a ficha no Pronto Socorro (falta de ar e febre) | ok | 8c0a3d3e-6877-4984-8ae6-ded68a1548b4 | ok |
| B06.01.paciente | banco | Paciente da ficha | ok | 13946f3d-ce7d-4b4c-9eea-4521f6ecd259 | ok |
| B06.02.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| B06.02.classificar | f5_enf_upa | Classifica laranja (escolha da enfermeira de teste), sinais crus, fluxograma "Queixas respiratórias" | ok | 4eb0fdb7-7ca7-44d4-891a-8d3825515332 | ok |
| B06.03.iniciar | f5_med_upa | Médico assume o atendimento | ok | (sem retorno: void) | ok |
| B06.03.soap | f5_med_upa | SOAP com CID J18.9; conduta conforme curb-65, adulto-pac-antibiotico, adulto-ic-aguda e news2 (na tela) | ok | e655f869-4377-4fe2-b3b8-9eec10a5f74a | ok |
| B06.05.peso | f5_med_upa | Peso referido 68 kg | ok | 1 sinais gravados | ok |
| B06.05.antibiotico | f5_med_upa | Ceftriaxona "Agora" (dose: texto de teste, conforme adulto-pac-antibiotico) | ok | 19339d2f-44ca-4440-b975-3673fc8e395f | ok |
| B06.05.diuretico | f5_med_upa | Furosemida "Agora" (dose: texto de teste, conforme adulto-ic-aguda) | ok | aafe504e-e2f0-4476-bf8f-0200240849a6 | ok |
| B06.05.checar_antibiotico | f5_enf_upa | Enfermeira apraza e checa "feito" a ceftriaxona | ok | f3fb6e22-d781-4a27-9286-7aba2e38f9c2 | ok |
| B06.05.checar_diuretico | f5_enf_upa | Enfermeira apraza e checa "feito" a furosemida | ok | 8365027b-e920-4a88-9a2d-97ca65c19c1c | ok |
| B06.05.internar | f5_med_upa | Desfecho internação no leito INT livre da UPA | ok | (sem retorno: void) | ok |
| B06.05.internacao | banco | Internação aberta pelo desfecho, conta de internação ligada à conta da porta | ok | 82503ae7-e55e-4daf-ac12-096993eb8e0e | ok |
| B06.06.admissao | f5_med_int | Médico da internação registra a admissão | ok | c95643c4-6a82-4b43-8ddb-8641841b55b5 | ok |
| B06.06.diagnostico | f5_med_int | Diagnóstico primário J18.9 confirmado | ok | b8583d93-1a2d-4c5b-b38d-38e1b2bad0ef | ok |
| B06.06.buscar_sigtap | f5_med_int | buscar_sigtap(pneumonia) oferece 0303140151 | ok | ok: achou 0303140151 | ok |
| B06.06.laudo_aih | f5_med_int | Laudo de AIH com o procedimento 0303140151 | ok | 7b45ac42-3925-4a8a-bd07-059b9a77aba9 | ok |
| B06.06.aih | banco | AIH solicitada pelo gatilho do laudo | ok | de336087-b6fa-423b-a3aa-545e1689af9d | ok |
| B06.07.solicitar | f5_med_int | Pede leito clínico: urgência, idoso, SIGTAP do laudo, CID J18.9 | ok | e810f4bb-1eea-4d59-a506-84c60f4ad337 | ok |
| B06.07.enviada | banco | enviada, com o relógio da fila em 0 e nada atrasado | ok | ok: nº 95, status enviada, sla {"atrasado": false, "correndo": true, "prazo_min": 5, "central_seg": 0} | ok |
| B06.08.continua_enviada | banco | Ninguém assumiu por mais de 5 min: status continua enviada | ok | ok: status enviada depois de 8 min | ok |
| B06.09.sla_central | f5_ges_upa | Painel de SLA da central: pedido com fila atrasada | ok | ok: sla {"fila": {"atrasado": true, "correndo": true, "prazo_min": 5, "central_seg": 458}, "destino": null, "evolucao": {"prazo_h": 1, "atrasada": false, "limite_h": 2, … | ok |
| B06.10.aviso_fila | banco | Cron: aviso reg_prazo_fila_N para o regulador da central (ninguém assumiu) | ok | ok: reg_prazo_fila_95 para 12: 1 aviso(s) — Regulação nº 95: passou do prazo da fila (5 min) sem decisão. | ok |
| B06.11.assumir | f5_regulador | Regulador assume | ok | {"id": "e810f4bb-1eea-4d59-a506-84c60f4ad337", "cbo": null, "cid": "J18.9", "sla": {"fila": {"atrasado": true, "correndo": true, "prazo_min": 5, "central_seg": 458}, "de… | ok |
| B06.11.pendencia | f5_regulador | Pendência: gasometria arterial e RX de tórax | ok | {"id": "e810f4bb-1eea-4d59-a506-84c60f4ad337", "cbo": null, "cid": "J18.9", "sla": {"fila": {"atrasado": true, "correndo": false, "prazo_min": 5, "central_seg": 458}, "d… | ok |
| B06.11.pendencia_repetida | f5_regulador | Segunda pergunta com a primeira sem resposta (deve ser recusado) | erro:Já há uma pergunta | recusado: Já há uma pergunta esperando resposta da origem. | ok |
| B06.11.nir_antes_do_prazo | f5_nir | Antes de 1 h, o NIR não vê reg_pendencia deste pedido | ok | ok: sem reg_pendencia | ok |
| B06.12.continua_pendencia | banco | Origem não respondeu por mais de 1 h: status continua pendencia | ok | ok: status pendencia, pendência há 75 min | ok |
| B06.13.nir_ve | f5_nir | NIR vê reg_pendencia ("pergunta da central sem resposta") com os responsáveis | ok | ok: {"tipo": "reg_pendencia", "desde": "2026-11-07T03:01:45.401205+00:00", "grupo": "regulacao", "ref_id": "e810f4bb-1eea-4d59-a506-84c60f4ad337", "titulo": "Regulação n… | ok |
| B06.13.nir_resumo | f5_nir | Resumo do NIR: regulação ≥ 1 | ok | ok: {"aih": 2, "apac": 0, "regulacao": 2} | ok |
| B06.14.cobrar | f5_nir | NIR cobra a pendência (aviso aos responsáveis) | ok | 1 | ok |
| B06.14.cobranca | banco | nir_cobrancas com destinatários e autor = NIR; auditoria nir_cobranca | ok | ok: destinatários {f5200000-0000-4000-8000-000000000015}, por 13 | ok |
| B06.15.aviso_cobranca | banco | Aviso reg_cobranca_N ao médico da internação | ok | ok: reg_cobranca_95 para 15: 1 aviso(s) — NIR: Regulação nº 95: pergunta da central sem resposta — Antônio Cardoso Peixoto (teste B06). Parado desde 07/11 00:01. | ok |
| B06.15.aviso_pendencia | banco | Cron: aviso reg_prazo_pendencia_N ao médico da internação | ok | ok: reg_prazo_pendencia_95 para 15: 1 aviso(s) — Regulação nº 95: a pergunta da central espera resposta há mais de 1 h. | ok |
| B06.15.aviso_evolucao | banco | Cron: aviso reg_prazo_evolucao_N (1 h sem evolução) ao médico da internação | ok | ok: reg_prazo_evolucao_95 para 15: 1 aviso(s) — Regulação nº 95: a evolução do paciente passou de 1 h. Atualize no pedido. | ok |
| B06.16.responder | f5_med_int | Origem responde: gasometria e RX anexados | ok | (sem retorno: void) | ok |
| B06.16.anexar | f5_med_int | Anexa o laudo de AIH ao pedido (documento do prontuário) | ok | 806d998e-865e-48d4-95c6-5cb3d04c4cac | ok |
| B06.16.em_analise | banco | Volta a em_analise (estava assumido), evento pendencia_respondida | ok | ok: status em_analise | ok |
| B06.16.cobrar_respondida | f5_nir | Cobrar a pendência já respondida (deve ser recusado) | erro:Esta pendência não está mais em ab… | recusado: Esta pendência não está mais em aberto. | ok |
| B06.18.nir_evolucao | f5_nir | NIR: reg_pendencia saiu; reg_evolucao ("evolução vencida") aparece | ok | ok: reg_evolucao: Regulação nº 95: evolução vencida | ok |
| B06.21.autorizar | f5_regulador | Autoriza para o Hospital F5 (ambulância básica); o hospital não vai responder | ok | {"id": "e810f4bb-1eea-4d59-a506-84c60f4ad337", "cbo": null, "cid": "J18.9", "sla": {"fila": {"atrasado": true, "correndo": false, "prazo_min": 5, "central_seg": 458}, "d… | ok |
| B06.17.continua | banco | Mais de 2 h sem evolução e 1 h sem resposta do destino: status continua aguardando_destino, sem cancelamento por prazo | ok | ok: status aguardando_destino, cancelamento_origem nulo, sem evolução há 157 min | ok |
| B06.18.risco | f5_nir | NIR: reg_evolucao "(risco de cancelamento)" | ok | ok: Regulação nº 95: evolução vencida (risco de cancelamento) | ok |
| B06.19.aviso_72h | banco | Cron: aviso reg_prazo_72h_N ("a central pode cancelar") ao médico da internação; só aviso | ok | ok: reg_prazo_72h_95 para 15: 1 aviso(s) — Regulação nº 95: 2 h sem evolução; a central pode cancelar o pedido. Atualize a evolução. | ok |
| B06.23.sla_origem | f5_ges_upa | Painel de SLA da UPA: destino_atrasado ≥ 1 e este pedido atrasado no destino | ok | ok: {"abertos": 1, "fila_atrasada": 0, "fila_sem_prazo": 0, "destino_atrasado": 1, "evolucao_atrasada": 1, "pendencia_atrasada": 0, "risco_cancelamento": 1} | ok |
| B06.24.aviso_destino_hospital | banco | Cron: aviso reg_prazo_destino_N ao médico do hospital (unidade = hospital) | ok | ok: reg_prazo_destino_95 para 11: 1 aviso(s) — Regulação nº 95: o pedido espera o aceite da unidade há mais de 1 h. | ok |
| B06.24.aviso_destino_gestor_hospital | banco | Cron: aviso reg_prazo_destino_N ao gestor do hospital | ok | ok: reg_prazo_destino_95 para 23: 1 aviso(s) — Regulação nº 95: o pedido espera o aceite da unidade há mais de 1 h. | ok |
| B06.24.aviso_destino_regulador | banco | Cron: aviso reg_prazo_destino_N ao regulador que assumiu (unidade = central) | ok | ok: reg_prazo_destino_95 para 12: 1 aviso(s) — Regulação nº 95: o destino não respondeu em 1 h. | ok |
| B06.25.nir_upa_sem_destino | f5_nir | O item reg_destino é do hospital: o NIR da UPA não o vê | ok | ok: sem reg_destino na UPA | ok |
| B06.25.gestor_hospital_ve | f5_ges_hosp | O gestor do hospital (o NIR do gestor vale sem escala) vê reg_destino | ok | ok: {"tipo": "reg_destino", "desde": "2026-11-07T04:16:36.913631+00:00", "grupo": "regulacao", "ref_id": "e810f4bb-1eea-4d59-a506-84c60f4ad337", "titulo": "Regulação nº … | ok |
| B06.20.evolucao | f5_med_int | Origem atualiza a evolução (sinais crus) | ok | 37b29779-5cfa-47e2-94e2-ec50e0e967e7 | ok |
| B06.20.nir_sem_evolucao | f5_nir | Depois da evolução, reg_evolucao sai do NIR | ok | ok: sem reg_evolucao | ok |
| B06.20.aviso_regulador | banco | Aviso reg_evolucao_N ao regulador que assumiu | ok | ok: reg_evolucao_95 para 12: 1 aviso(s) — Regulação nº 95: a origem atualizou a evolução do paciente. | ok |
| B06.26.ps_nao_cancela | f5_med_upa | Médico do PS (não solicitou) tenta cancelar (deve ser recusado) | erro:Cancela quem solicitou | recusado: Cancela quem solicitou ou o gestor da unidade de origem. | ok |
| B06.27.cancelar | f5_med_int | Solicitante cancela: paciente melhorou, mantida a internação na UPA | ok | (sem retorno: void) | ok |
| B06.27.cancelada | banco | cancelada, cancelamento_origem = solicitante, evento e auditoria; aviso reg_cancelada ao hospital | ok | ok: status cancelada, origem solicitante | ok |
| B06.28.sla_central | f5_ges_upa | Cancelado sai dos painéis de SLA da central | ok | ok: fora do painel | ok |
| B06.28.indicadores | f5_ges_upa | Indicadores da central | ok | {"agora": "2026-11-07T05:31:05.518864+00:00", "total": 12, "escopo": "rede", "prazos": {"fila": {"n": 12, "no_prazo": 11}, "destino": {"n": 9, "no_prazo": 9}, "valores":… | ok |
| B06.28.tempos | banco | Tempo em cada status (regulacao_status_tempos) | ok | ok: enviada 8 min → em_analise 0 min → pendencia 75 min → em_analise 0 min → aguardando_destino 74 min → cancelada 0 min | ok |
| B06.99.eventos | banco | Um evento por transição, autor = login | ok | ok: enviada por 15 → pendencia por 12 → assumida por 12 → autorizada por 12 → pendencia_respondida por 15 → anexo_incluido por 15 → cancelada por 15 → evolucao_atualizad… | ok |
| B06.99.sem_duplicar | banco | O cron não duplica aviso no mesmo dia (um por pessoa, unidade e tipo) | ok | ok: reg_prazo_72h_95 x1, reg_prazo_destino_95 x1, reg_prazo_destino_95 x1, reg_prazo_destino_95 x1, reg_prazo_destino_95 x1, reg_prazo_evolucao_95 x1, reg_prazo_fila_95 … | ok |
| B06.29.prazos_padrao | f5_ges_upa | Gestor volta aos padrões (12 h, 3 h, 72 h, 24 h; fila nula) | ok | {"fila": {"eletiva": null, "urgencia": null, "emergencia": null, "prioritaria": null}, "ajustado": true, "destino_h": 24, "central_id": "f5100000-0000-4000-8000-00000000… | ok |
| B06.29.historico | banco | Histórico guarda a volta | ok | ok: {"fila": {"eletiva": 30, "urgencia": 5, "emergencia": 1, "prioritaria": 10}, "ajustado": true, "destino_h": 1, "central_id": "f5100000-0000-4000-8000-000000000009", … | ok |
| B06.30.alta | f5_med_int | Alta melhorada da internação na UPA | ok | (sem retorno: void) | ok |
| B06.31.aih | f5_regulador | Regulador aprova a AIH | ok | (sem retorno: void) | ok |
| B06.31.conta_porta | f5_fat | Conta da porta (ambulatorial) do paciente | ok | b4e84a34-b0bd-46cc-a8fb-adac765a202a | ok |
| B06.31.conta_int | f5_fat | Conta da internação do paciente | ok | 2863ea22-fce1-4db5-acd4-cb41738ea8a3 | ok |
| B06.31.porta_conferencia | f5_fat | Conta porta: aberta → em_conferencia | ok | {"id": "b4e84a34-b0bd-46cc-a8fb-adac765a202a", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T02:54:07.08284+00:00", "cbo": "225125", "cid": "J1 | ok |
| B06.31.internacao_conferencia | f5_fat | Conta internacao: aberta → em_conferencia | ok | {"id": "2863ea22-fce1-4db5-acd4-cb41738ea8a3", "tipo": "internacao", "itens": [{"em": "2026-11-07T02:54:07.08284+00:00", "aih": {"numero": "3526100000 | ok |
| B06.31.porta_custos | f5_fat | Custos e pré-auditoria da conta porta | ok | status em_conferencia; total 12.26; itens: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, 0301100012 qt 2 = 1.26; medicamentos 0; pendências 2; bloqueantes sem liberaç… | ok |
| B06.31.internacao_custos | f5_fat | Custos e pré-auditoria da conta internacao | ok | status em_conferencia; total 582.42; itens: 0303140151 qt 1 = 582.42; medicamentos 2; pendências 3; bloqueantes sem liberação 0 | ok |
| B06.31.porta_fechar | f5_fat | Conta porta: em_conferencia → fechada | ok | {"id": "b4e84a34-b0bd-46cc-a8fb-adac765a202a", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T02:54:07.08284+00:00", "cbo": "225125", "cid": "J1 | ok |
| B06.31.internacao_fechar | f5_fat | Conta internacao: em_conferencia → fechada | ok | {"id": "2863ea22-fce1-4db5-acd4-cb41738ea8a3", "tipo": "internacao", "itens": [{"em": "2026-11-07T02:54:07.08284+00:00", "aih": {"numero": "3526100000 | ok |
| B06.31.congelados | banco | Itens congelados nas duas contas (AIH na internação) | ok | ok: ambulatorial A-2026.000011 fechada: 0301060096=11.00, 0301060118=nulo, 0301100012=1.26 / internacao I-2026.000003 fechada: 0303140151=582.42 | ok |

## Custos que o sistema registrou

Nenhum valor foi digitado. Tudo vem do SIGTAP carregado (competência 202609). Os valores fictícios do catálogo não foram gravados. Medicamento, material, transporte, diária, regulação, telemedicina e parecer não têm valor no sistema (MAPA 3.7).

| Cenário | Conta | Status | Itens com valor (SIGTAP) | Total de referência |
|---|---|---|---|---|
| B01 | UPA, ambulatorial `A-2026.000016` | **fechada** | consulta 0301060096 R$ 11,00; acolhimento 0301060118 nulo; medicação 0301100012 3 × R$ 0,63 | **R$ 12,89** |
| B01 | UPA, internação | **não existe** (P1-1) | AIH 0303010037 aprovada (SH R$ 793,69 + SP R$ 72,22 = R$ 865,91 no SIGTAP), sem conta | — |
| B02 | UPA, ambulatorial `A-2026.000017` | **fechada** | consulta R$ 11,00; acolhimento nulo; medicação 1 × R$ 0,63 | **R$ 11,63** |
| B03 | UPA, ambulatorial `A-2026.000019` | **fechada** | consulta R$ 11,00; acolhimento nulo; medicação 3 × R$ 0,63 | **R$ 12,89** |
| B03 | Hospital, internação `I-2026.000002` | aberta (internado no CM-03) | AIH 0303060190: SH R$ 471,40 + SP R$ 116,72 | **R$ 588,12** |
| B03 | Hospital, porta `A-2026.000002` | aberta | classificação e consulta "fora", sem SIGTAP associado no hospital | R$ 0,00 |
| B04 | UPA, ambulatorial `A-2026.000023` | **fechada** | consulta R$ 11,00; acolhimento nulo; medicação 2 × R$ 0,63 | **R$ 12,26** |
| B05 | UBS | — | nenhuma conta com valor, nenhuma linha de BPA (decisão D6) | R$ 0,00 |
| B06 | UPA, ambulatorial `A-2026.000011` | **fechada** | consulta R$ 11,00; acolhimento nulo; medicação 2 × R$ 0,63 | **R$ 12,26** |
| B06 | UPA, internação `I-2026.000003` | **fechada** | AIH 0303140151: SH R$ 504,07 + SP R$ 78,35 | **R$ 582,42** |

- **Medicamentos (sem valor):** entram na conta como dispensado e administrado. No B01, os três foram dispensados e administrados na porta. Como a dispensação e a internação têm o mesmo horário (transação única), eles foram contados como "depois da internação" e caíram na conta de internação, que não existe: a conta da porta da rodada 3 sai sem medicamentos. Na rodada 2, que não virou internação, os três aparecem na conta da porta. No B02, B03, B04 e B06 não houve dispensação, e o pré-auditor avisa "administrado sem nada dispensado".
- **Acolhimento com classificação:** sai sempre com valor nulo, porque o SIGTAP 0301060118 não tem `valor_sa` (P3-5 do A01).
- **Plantão do médico e do regulador (R$ 1.500 e R$ 1.200 no catálogo):** não fazem parte da conta do paciente. Nascem em `remuneracoes_plantao` → `plantao_versoes_erp` quando o gestor fecha o mês; não foi feito.

## O que só se confere na tela
- **Fichas da Central:** `sepse-adulto`, `news2` e `adulto-ressuscitacao-volemica` (B01); `adulto-nihss`, `glasgow` e `adulto-trombolise-avc` (B02); `adulto-sca-inicial`, `heart`, `grace`, `killip` e `adulto-fibrinoliticos` (B03); `adulto-trauma-inicial`, `adulto-triage-rts`, `adulto-mgap`, `adulto-nexus`, `canadian-ct-head` e `adulto-abc-score`, inclusive "não se aplica" abaixo de 14 anos (B04); `abcd2` (B05); `curb-65`, `adulto-pac-antibiotico` e `adulto-ic-aguda` (B06). A decisão do médico de teste foi escrita no SOAP; nenhuma dose foi tirada delas.
- **Triagem:** nenhum texto de "sugerido" na cor; o discriminador livre (B02); a escala de dor (`Dor.tsx`).
- **Prescrição:** a recusa sem peso, o chip de peso estimado ou referido e a trava de interação com justificativa (não disparou: não há base de interações).
- **Observação:** o paciente "sem box" no painel (B01), o selo de parecer aberto e a reavaliação marcada.
- **Regulação:**
  - Fila, PainelDecisao, ResponderPendencia, Reenviar e MapaVagas, este com a UTI do hospital e a Internação da UPA ofertada;
  - DestinoRegulacao, com a recusa e o aceite com leito;
  - SlaRegulacao (B06) e Indicadores;
  - anexo de arquivo: `regulacao_registrar_anexo` exige o arquivo no Storage e não se reproduz por SQL (o B06 anexou um documento do prontuário).
- **Avisos:** o sino com `reg_pendencia`, `reg_destino_recusou`, `reg_negada`, `reg_devolvida`, `reg_nao_chegou` e, no B06, os `reg_prazo_*` e `reg_cobranca`.
- **Teleinterconsulta:** o documento "SOLICITAÇÃO DE TELEINTERCONSULTA" impresso.
- **Impressão:** sinais vitais crus nas fichas.

## O que ficou gravado na homologação

**Esperado pela rodada (dados fictícios, nomes de teste):**
- **Pacientes:**
  - "Severino Tavares da Luz (teste B01)", "… B" e "… C" (UPA);
  - "Dalva Rocha Mendonça (teste B02)" (UPA);
  - "Joaquim Ferraz Bittencourt (teste B03)" (UPA e hospital);
  - "Rogério Lins Albuquerque (teste B04)" (UPA);
  - "Marlene Siqueira Pontes (teste B05)" (UBS);
  - "Antônio Cardoso Peixoto (teste B06)" (UPA).
- **Regulações:** nº 95 e 97 (leito), 100 (leito, negada), 103, 104 e 105 (transferências) e 107 (consulta), com eventos, respostas de destino, evoluções, anexos e avisos.
- **Clínico:** classificações, SOAPs, exames, prescrições, validações, dispensações (B01) e administrações; pareceres (B01); laudos de AIH e AIHs aprovadas (B01, B03, B06); duas teleinterconsultas (B05).
- **Contas:** as da porta da UPA fechadas (B01 rodadas 1 a 3, B02, B03, B04); no hospital, a da porta e a da internação do B03 abertas.
- **Configuração:**
  - a Internação da UPA ofertada no mapa como leito clínico (`regulacao_ofertar_setor`, B03);
  - `medico.internacao.f5` com a especialidade "Clínica médica" declarada (B01);
  - os prazos da Central F5 mudados e devolvidos ao padrão, com histórico (B06).

**De forma inesperada, ou que precisa de atenção:**
- **Internação do B01 sem conta (P1-1):** "Severino … C" teve alta (transferência externa) e o leito INT-02 foi para higienização. A internação e a AIH aprovada ficaram **sem conta**. O mesmo vale para a rodada 1 (INT-01, encerrada na limpeza).
- **Boxes da observação:** OA-03 ficou em **higienização** depois da rodada 1 do B01. A rodada 3 ficou em observação sem box até virar internação.
- **Leitos do hospital:** **CM-03 ocupado** pela internação ativa do "Joaquim … (teste B03)". O UTI-01 voltou a livre.
- **Teleinterconsulta do B05 aberta para sempre:** ninguém de telemedicina está de plantão na UBS (P2-3).
- **Números de regulação gastos sem pedido:** 98, 99, 101 e 106 (bordas desfeitas; a sequência não volta).
- **Estoque da UPA F5:** ceftriaxona, ringer com lactato e noradrenalina com saldo **−3** (uma dispensação por rodada do B01, com estoque zerado; o saldo negativo é o desenho, como no A01).
- **Prazos curtos na Central F5** de 06/11 23h54 a 07/11 02h31: valeram para **todos** os pedidos abertos da central nesse intervalo, inclusive os de outras frentes, que podem ter recebido avisos `reg_prazo_*` e itens no NIR. Nenhum status mudou por prazo. Os padrões voltaram na fase 4 (12 h, 3 h, 72 h, 24 h; fila sem prazo), com o antes e o depois em `regulacao_prazos_historico`.
- **B06:** internação do "Antônio … (teste B06)" encerrada (alta melhorada), INT-03 liberado para higienização, as duas contas fechadas, regulação nº 95 `cancelada`, uma cobrança em `nir_cobrancas` e os avisos `reg_prazo_*`, `reg_cobranca_95`, `reg_evolucao_95` e `reg_cancelada_95`.

Nada foi corrigido no produto: nenhuma migration, nenhuma função de produto alterada. As funções criadas são só do esquema `e2e`, listadas em "Data, hora e ambiente".

## Arquivos
- `scripts/e2e/60_cenario_b01.sql` … `65_cenario_b06.sql`: um por cenário, repetíveis (cada rodada cria paciente novo). O 65 roda quatro vezes, em fases (cabeçalho).
- `docs/teste-rede/EXECUCAO-B01-B06.md`: este relatório.
