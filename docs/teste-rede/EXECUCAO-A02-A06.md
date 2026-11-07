# Execução dos cenários A02 a A06 na homologação

Cenários A02 a A06 do catálogo (`CENARIOS-A-materno-infantil.md`). Teste de **fluxo**, com dados fictícios. Nenhuma dose foi escrita de memória: toda dose é o texto "conforme protocolo — dado fictício de teste de fluxo", e o item cita a ferramenta da Central. A cor de toda classificação é escolha da enfermeira de teste. Nada foi corrigido no produto: nenhuma migration, nenhuma função de produto alterada.

## Data, hora e ambiente

- **Quando:** 06/11/2026, 23h36, a 07/11/2026, 00h17 (horário de Brasília). As rodadas válidas rodaram depois da meia-noite, todas em 07/11.
- **Ambiente:** homologação, Supabase `kswurfyxxvfydpjfrivy` (conferido em `supabase/.temp/project-ref` antes de cada execução). A produção não foi tocada.
- **Como rodou:** `41_checkin_fase5.sql` antes de cada script; cada cenário preparado por `scripts/e2e/homolog/preparar.mjs` e executado com `npx supabase db query --linked -f`. Cada script roda numa transação só, e cada passo roda **como a conta do papel** (role `authenticated` com as claims do JWT, RLS ligado), pelas mesmas RPCs das telas.
- **Apoio comum do bloco A:** os scripts 53 a 56 trazem o mesmo bloco de apoio do 52 (`e2e.ba`, `e2e.ba_passo`, `e2e.ba_banco`, `e2e.ba_ajuste`, `e2e.ba_registra`, `e2e.ba_sinais`, `e2e.ba_sql_passado`, `e2e.conta_a`). O `e2e.passo` do 04 **não** foi tocado: o `e2e.ba_passo` é uma cópia dele que conhece as três contas do 49a. Assim os outros agentes que rodam ao mesmo tempo não são afetados.
- **"banco"** na coluna Papel é conferência feita como postgres, de algo que a tela não mostra. **"registrar"** no Esperado é passo só de registro: roda como o papel, guarda "ACEITO" ou "RECUSADO" e desfaz a ação.

### Ajuste do ambiente (`49a_ambiente_bloco_a.sql`)

A mesma lição do P1-2 do A01, aplicada antes de rodar:
- **Observação Pediátrica sem ninguém escalado.** O setor `…014` (OP-01 a OP-03) existe desde o 46, e `private.box_livre` manda a criança para ele (o setor do público do episódio vem primeiro). Sem escala nele, painel, primeiro atendimento, reavaliação, sinais do box e avaliação de enfermagem dariam "Acesso negado".
- **Internação da UPA sem enfermeiro.** O `…013` só tinha o `medico.internacao.f5`, e o Fugulin é do "enfermeiro de plantão no setor do paciente" (A04).

O que o 49a acrescenta (só aditivo, repetível, sem tocar no 46, no 47 ou no 48):
- `medico.obsped.f5` (`…0a1`, plantonista, CRM fictício 950161, CBO 225124) e `enfermeiro.obsped.f5` (`…0a2`, CBO 223505), escalados na Observação Pediátrica;
- `enfermeiro.internacao.f5` (`…0a3`, CBO 223505), escalado na Internação;
- escala de 05/11 a 13/11, três turnos; CNS fictícios com dígito verificador válido (709950000110000, …110108, …110205);
- senha: o **mesmo hash** de `medico.upa.f5`, copiado no banco. Nenhuma senha em texto.

Os ids ficam fora da numeração sequencial (`…0a1` a `…0a3`) para não colidir com outros scripts de ambiente feitos ao mesmo tempo. No framework, essas contas entram pela função `e2e.conta_a` dos scripts 52 a 56 (`f5_med_obsped`, `f5_enf_obsped`, `f5_enf_int`), sem mexer no 47.

## Resumo

| Cenário | Rodada válida | ok | falha | lacuna | ajuste | Resultado |
|---|---|---|---|---|---|---|
| A02 | B ("Marta A02 Teste B"), partes 1 e 2 | 53 | 0 | 1 | 2 | Fluxo completo. O cron real marcou `nao_chegou`; a recepção da UPA ainda achou o envio e o "Chegou" corrigiu para `chegou`. |
| A03 | B ("Théo A03 Teste B") | 69 | 0 | 2 | 1 | Fluxo completo, da puericultura à conta fechada. Inclui 4 passos que encerraram a rodada 1. |
| A04 | B ("Luan A04 Teste B" e "Bia A04 Teste B") | 61 | 3 | 2 | 0 | Corte de 14 anos provado na triagem, no Fugulin e na internação. As 3 falhas: 2 da limpeza da rodada 1 (a alta recusada por exame sem resultado, depois refeita) e 1 do catálogo (`exames_da_unidade`). |
| A05 | 1 ("Sofia A05 Teste") | 53 | 2 | 0 | 0 | Fluxo completo. 1 falha de produto (segunda dose "Agora") e 1 do script (refeita, ok). |
| A06 | 1 ("Joana A06 Teste" e "RN de Joana A06 Teste") | 64 | 6 | 0 | 0 | Fluxo completo até a internação do RN no hospital. 5 falhas do script (refeitas, ok) e 1 do catálogo (NIR não vê a pendência antes de 3 h). |

**Nenhum achado P0 nem P1.** Os achados de produto são P2 e P3 (ver "Achados").

### Rodadas descartadas

| Cenário | Rodada | Resultado | Motivo (do script ou do ambiente, não do produto) |
|---|---|---|---|
| A02 | 1 ("Marta A02 Teste") | ok 28, falha 5, lacuna 6, ajuste 2 | Rodou às 23h51 de 06/11. O próximo horário da agenda caiu em 07/11, e a chegada é "no dia da consulta". Também se descobriu que a conduta com o problema hipertensão já inclui a paciente no hiperdia, então o `programa_incluir` do script deu duplicidade. |
| A03 | 1 ("Théo A03 Teste") | ok 40, falha 9, lacuna 18, ajuste 1 | A classificação pediátrica exige a escala de dor ("Sinal vital obrigatório ausente: escala dor"), e o script não mandou. A rodada expôs o achado P2-2. O lactente ficou na triagem e foi encerrado pela rodada B (`A03.00.encerra_anterior_*`). |
| A04 | 1 ("Luan A04 Teste" e "Bia A04 Teste") | ok 36, falha 5, lacuna 17 | Nenhum leito livre na Internação da UPA: outros cenários deixaram os quatro em ocupado ou higienização (P2-4). As duas crianças ficaram no atendimento do PS e foram encerradas depois, com o resultado do exame e a alta (`A04.00.encerra_anterior_*`). |

Os resultados das rodadas descartadas continuam em `e2e.resultados` (antes de `e2e.v('a0N_inicio')`).

### Armadilhas aprendidas (para os próximos cenários)

- **A classificação exige sinais por público:** na pediatria, a escala de dor; no adulto, também a frequência respiratória.
- **Meia-noite:** a agenda da UBS e a chegada usam o dia civil de Brasília. Um script que roda perto da meia-noite marca o horário no dia seguinte, e a chegada é recusada. O A04 calcula as idades na rodada, então não há esse risco dentro de uma rodada.
- **Leitos em higienização:** depois da alta, o leito fica em `higienizacao` até a enfermagem concluir (`concluir_higienizacao`). Na rede compartilhada, isso some com os leitos livres.
- **Pasta de rascunho compartilhada:** os agentes desta rodada usam a mesma pasta de rascunho da sessão. Os arquivos de trabalho deste bloco ficaram em uma subpasta própria (`blocoA_a02a06`).
- **`String.replace` do JavaScript:** na montagem dos scripts, `$$` vira `$`. O montador usa função de substituição.

## Tabelas dos passos (rodadas válidas)

Ids `A0N.NN.*` na ordem da especificação. `A0N.B.*` são as bordas do catálogo. `A0N.00.*` são pré-condições. Os passos `*_refeito` foram rodados de novo depois de corrigido o script, sem apagar a tentativa que falhou.

### A02 — Gestante hipertensa no hiperdia e no pré-natal, envio que "não chegou"

Parte 1 (`52_cenario_a02.sql`) às 00h01 de 07/11. Parte 2 (`52b_cenario_a02_prazo.sql`) às 00h16, depois da volta das 00h15 do cron real `encaminhamento-upa-prazo`.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A02.00.ficha_antiga | f5_rec_ubs | Recepção cadastra a paciente e abre a consulta do hiperdia (vai para o passado) | ok | 7060a5d8-4ced-459c-8d65-7f0700a1462b | ok |
| A02.00.paciente | banco | Paciente da UBS | ok | c07ab065-1857-4a4f-a302-cda30c655cea | ok |
| A02.00.atender | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A02.00.sinais | f5_med_ubs | PA, peso e altura crus da consulta antiga | ok | 4 sinais gravados | ok |
| A02.00.soap | f5_med_ubs | SOAP com CID de hipertensão (I10) | ok | b31e8086-a207-4c23-85f7-c9eb0dfd0ecb | ok |
| A02.00.conduta | f5_med_ubs | Encerra com problema hipertensão, CID I10 e CIAP K86 | ok | (sem retorno: void) | ok |
| A02.00.hiperdia_pela_conduta | banco | A conduta com o problema hipertensão inclui a paciente no hiperdia (origem consulta) | ok | cb208140-3c28-4d86-85dd-a3cdc9c36279 | ok |
| A02.00.hiperdia_manual | f5_med_ubs | Médica tenta incluir de novo pelo painel (programa_incluir): duplicidade recusada | erro:O paciente já está no programa | recusado: O paciente já está no programa. | ok |
| A02.00.datas | — | Consulta, sinais e entrada no hiperdia levados 200 dias para trás (mais de 6 meses) | ajuste | UPDATE public.episodios SET chegada_em = chegada_em - '200 days'::interval, atendimento_iniciado_em = atendimento_iniciado_em - '200 days'::interval, classificado_em = cl | ajuste |
| A02.00.cancela_agenda_rodada_anterior | f5_rec_ubs | Recepção cancela o agendamento deixado por uma rodada anterior | ok | (sem retorno: void) | ok |
| A02.01.painel | f5_ges_ubs | Painel: Marta com consulta e PA vencidas (mais de 6 meses) | ok | ok: última consulta 2026-04-21T03:01:23.836093+00:00, última PA 2026-04-21T03:01:23.836093+00:00, programas [{"id": "cb208140-3c28-4d86-85dd-a3cdc9c36279", "origem": "con | ok |
| A02.01.do_paciente | f5_ges_ubs | hiperdia_do_paciente mostra o programa hipertensão | ok | ok: {"programas": [{"id": "cb208140-3c28-4d86-85dd-a3cdc9c36279", "origem": "consulta", "programa": "hipertensao", "entrada_em": "2026-04-21T03:01:23.836093+00:00"}], "ul | ok |
| A02.02.tecnico_le_hiperdia | f5_tec_ubs | Técnico lê o painel do hiperdia | ok | ok: Marta no painel lido pelo técnico | ok |
| A02.02.tecnico_le_pre_natal | f5_tec_ubs | Técnico lê o painel do pré-natal | ok | [{"id": "ca158046-5deb-4e5b-9f39-1028e2ba9209", "pa": 0, "dpp": "2027-03-25", "dum": "2026-06-18", "nome": "Ana F5 Gesta | ok |
| A02.02.tecnico_nao_inclui | f5_tec_ubs | Técnico tenta incluir no programa (deve ser recusado) | erro:Acesso negado: inclui o médico ou o enfermeiro | recusado: Acesso negado: inclui o médico ou o enfermeiro da UBS. | ok |
| A02.03.marcar | f5_rec_ubs | Recepção marca a consulta do hiperdia/pré-natal de hoje às 07:00 | ok | 1b04fd3d-ecaf-4f5f-9464-ad9ac7599eac | ok |
| A02.03.chegada | f5_rec_ubs | Recepção registra a chegada (episódio da consulta agendada) | ok | 4b356919-69ed-450d-9d9f-1a75a0830823 | ok |
| A02.02.tecnico_nao_avalia_pes | f5_tec_ubs | Técnico tenta registrar a avaliação dos pés (deve ser recusado) | erro:Acesso negado: registra o médico ou o enfermeiro | recusado: Acesso negado: registra o médico ou o enfermeiro de plantão no consultório. | ok |
| A02.04.atender | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A02.04.sinais | f5_med_ubs | PA, peso e altura crus no "O" | ok | 4 sinais gravados | ok |
| A02.04.soap | f5_med_ubs | SOAP: hipertensão prévia na gestação (O10.0) | ok | 88368a34-8a2d-46c8-94c2-8f5d4fa25fc8 | ok |
| A02.04.pre_natal | f5_med_ubs | Inclui no pré-natal com a DUM (hoje − 170 dias), ligado à consulta | ok | 04772042-d0ed-447f-9aa0-f729215e7714 | ok |
| A02.04.conduta | f5_med_ubs | Encerra com problemas hipertensão e pré-natal, CID O10.0, CIAP K86 e W78; avaliação dos pés em branco | ok | (sem retorno: void) | ok |
| A02.04.hiperdia_hoje | f5_med_ubs | hiperdia_do_paciente: consulta, PA e peso/altura com a data de hoje; pés sem registro | ok | ok: consulta 2026-11-07T03:01:23.836093+00:00, PA 2026-11-07T03:01:23.836093+00:00, peso/altura 2026-11-07T03:01:23.836093+00:00, pés sem registro | ok |
| A02.04.pre_natal_hoje | f5_med_ubs | pre_natal_do_paciente: a mesma consulta conta (consulta, PA e peso/altura de hoje) | ok | ok: DUM 2026-05-21, consultas 1, pa 1, peso_altura 1, datas ["2026-11-07"] | ok |
| A02.B.painel_sem_linha_dupla | f5_ges_ubs | Marta aparece uma vez só no painel do hiperdia | ok | ok: 1 linha(s) | ok |
| A02.B.pre_natal_dum_futura | f5_med_ubs | pre_natal_incluir com DUM futura (deve ser recusado) | erro:A DUM tem de ser de hoje para trás | recusado: A DUM tem de ser de hoje para trás, até 48 semanas. | ok |
| A02.B.pre_natal_duplicado | f5_med_ubs | pre_natal_incluir de novo, com a DUM certa (deve ser recusado) | erro:A paciente já está no pré-natal | recusado: A paciente já está no pré-natal. | ok |
| A02.B.definir_dum_futura | f5_enf_ubs | pre_natal_definir_dum com DUM futura (deve ser recusado) | erro:A DUM tem de ser de hoje para trás | recusado: A DUM tem de ser de hoje para trás, até 48 semanas. | ok |
| A02.B.azul_ficha | f5_rec_ubs | Ficha de escuta inicial (dúvida sobre a medicação) | ok | 6ccdb06e-7abc-4c73-8430-bc0853b114e5 | ok |
| A02.B.azul_consulta | f5_enf_ubs | Escuta azul com saída consulta (deve ser recusado) | erro:Situação não aguda (azul) | recusado: Situação não aguda (azul): orientação ou agendamento. | ok |
| A02.B.azul_orientacao | f5_enf_ubs | Escuta azul (escolha da enfermeira de teste) com saída orientação | ok | ad135344-1d9a-4830-94a6-763c19106f49 | ok |
| A02.B.azul_encerrou | banco | A escuta azul encerra o episódio, sem fila do médico | ok | ok: etapa encerrado, cor azul | ok |
| A02.05.ficha | f5_rec_ubs | Marta volta com cefaleia e PA alta: ficha escuta_inicial | ok | fe5322d5-3fe9-4d5f-b757-1b0d0e8f7f53 | ok |
| A02.06.escuta | f5_enf_ubs | Escuta com sinais crus; a enfermeira de teste classifica vermelho; saída consulta | ok | abe9e0eb-382a-48b5-bd40-23abdce4be44 | ok |
| A02.06.cor | banco | A cor gravada é a da enfermeira (vermelho, CAB 28, saída consulta) | ok | ok: cor vermelho, saída consulta, protocolo cab28 | ok |
| A02.B.envio_propria_ubs | f5_enf_ubs | Envio com a própria UBS como destino (deve ser recusado) | erro:Escolha uma UPA ou um hospital da rede | recusado: Escolha uma UPA ou um hospital da rede. | ok |
| A02.06.enviar | f5_enf_ubs | Enfermeira envia à UPA F5 pela própria escuta, com motivo | ok | ea6d0cc0-a56f-45ea-8084-60ae8ca1ca1d | ok |
| A02.06.fila_medico | banco | Depois do envio, a ficha da escuta vermelha segue na fila do médico da UBS | ok | ok: etapa atendimento, encerrado não | ok |
| A02.07.encaminhados | f5_ges_ubs | Linha "enviado" com a hora | ok | ok: situação enviado, enviado em 2026-11-07T03:01:23.836093+00:00, prazo 2026-11-07T15:01:23.836093+00:00 | ok |
| A02.07.do_paciente | f5_ges_ubs | encaminhamentos_upa_do_paciente mostra o envio | ok | ok: [{"id": "ea6d0cc0-a56f-45ea-8084-60ae8ca1ca1d", "motivo": "Gestante hipertensa com cefaleia e PA 172x114 (teste A02)", "numero": 26, "resumo": {"soap": null, "queixa" | ok |
| A02.08.antecipa_prazo | — | Envio levado 12 h 05 min para trás (enviado_em e prazo_em): o cron real encaminhamento-upa-prazo marca nao_chegou na próxima volta (*/15) | ajuste | UPDATE public.encaminhamentos_upa SET enviado_em = enviado_em - interval '12 hours 5 minutes', prazo_em = prazo_em - interval '12 hours 5 minutes' WHERE id = 'ea6d0cc0-a5 | ajuste |
| A02.08.nao_chegou | banco | O cron real marcou o envio como nao_chegou, sem ação da UBS | ok | ok: situação nao_chegou, observação "Sem registro de chegada em 12 horas.", prazo 2026-11-07 02:56:23.836093+00, última volta do cron 2026-11-07 03:15:00.22696+00 | ok |
| A02.08.aviso | banco | Aviso do nao_chegou para a UBS (notificação) | ok | ok: 1 aviso(s): Marta A02 Teste B: a UPA Fase 5 24h não registrou a chegada em 12 horas. Confira com o paciente. | ok |
| A02.09.encaminhados | f5_med_ubs | Médica da UBS vê nao_chegou no painel | ok | ok: situação nao_chegou | ok |
| A02.09.busca_ativa | f5_med_ubs | Registro de busca ativa / visita do ACS | existir | Lacuna (MAPA): ACS, busca ativa e visita domiciliar não existem; o não comparecimento fica só como nao_chegou. | lacuna |
| A02.12.cancelar_nao_chegou | f5_enf_ubs | Enfermeira (quem enviou) tenta cancelar o envio nao_chegou (deve ser recusado) | erro:Só se cancela o envio que ainda espera a chegada | recusado: Só se cancela o envio que ainda espera a chegada. | ok |
| A02.10.vindo | f5_rec_upa | A recepção da UPA ainda acha o envio nao_chegou (enviado há menos de 1 dia) | ok | ok: situação nao_chegou, nº 26 | ok |
| A02.11.chegou_sem_ficha | f5_rec_upa | Borda (PR #438): "Chegou" sem ficha aberta. A tela não deve permitir; aqui se registra o que o servidor faz (e desfaz) | registrar | ACEITO (a ação foi desfeita para não mudar o cenário) | ok |
| A02.10.ficha | f5_rec_upa | Recepção da UPA abre a ficha de Marta no Pronto Socorro (prioridade gestante) | ok | b5fcafc7-cc1e-411a-92eb-04e8484a3d9b | ok |
| A02.10.paciente | banco | Paciente da UPA | ok | 5eb23e12-32dd-4bed-85d1-d7375678a8e3 | ok |
| A02.10.chegou | f5_rec_upa | Marca "Chegou" com a ficha escolhida: o nao_chegou automático vira chegou | ok | {"id": "ea6d0cc0-a56f-45ea-8084-60ae8ca1ca1d", "motivo": "Gestante hipertensa com cefaleia e PA 172x114 (teste A02)", "numero": 26, "resumo": {"soap": null, "queixa": "Do | ok |
| A02.10.ligado | banco | O envio fica chegou, ligado à ficha da UPA | ok | ok: situação chegou, ficha b5fcafc7-cc1e-411a-92eb-04e8484a3d9b | ok |
| A02.10.ubs_ve_chegou | f5_ges_ubs | A UBS passa a ver chegou | ok | ok: situação chegou | ok |
| A02.10.conta | f5_fat | Conta ambulatorial aberta na UPA, sem itens (R$ 0,00) | ok | 6eafa339-72f3-4f24-9222-7152d1d8dd44 — itens 0, total 0 | ok |
| A02.99.ubs_sem_valor | f5_ges_ubs | A UBS não gera item com valor nem linha de BPA para Marta | ok | ok: UBS sem item com valor e sem BPA; contas da UBS de Marta: 4 | ok |

### A03 — Puericultura que vira bronquiolite na UPA, com observação pediátrica

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A03.00.ficha | f5_rec_ubs | Recepção cadastra o lactente e abre a 1ª consulta da puericultura | ok | 63fd5db2-ba76-434c-b34b-979b863aa9e3 | ok |
| A03.00.paciente | banco | Paciente da UBS | ok | 91faafa9-f02b-4a8c-8d88-a85b76979855 | ok |
| A03.00.atender | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A03.00.sinais | f5_med_ubs | Peso e comprimento crus (cm) | ok | 2 sinais gravados | ok |
| A03.00.soap | f5_med_ubs | SOAP da 1ª consulta (Z00.1) | ok | 6d2ec846-c53a-460f-a014-21892ac7843a | ok |
| A03.00.conduta | f5_med_ubs | Encerra com o problema puericultura e CID Z00.1 | ok | (sem retorno: void) | ok |
| A03.00.datas | — | 1ª consulta levada ao 20º dia de vida (episódio e sinais no passado) | ajuste | UPDATE public.episodios SET chegada_em = chegada_em - '103 days'::interval, atendimento_iniciado_em = atendimento_iniciado_em - '103 days'::interval, classificado_em = cl | ajuste |
| A03.00.encerra_anterior_classificar | f5_enf_upa | Rodada anterior: a enfermeira de teste classifica (verde) o lactente parado na triagem | ok | a57fc94f-d9ae-48c1-a505-80fbb8068380 | ok |
| A03.00.encerra_anterior_iniciar | f5_med_upa | Rodada anterior: médico assume | ok | (sem retorno: void) | ok |
| A03.00.encerra_anterior_soap | f5_med_upa | Rodada anterior: SOAP | ok | 70fc9152-c85f-46d5-bc3d-ad62ebdb0d4e | ok |
| A03.00.encerra_anterior_alta | f5_med_upa | Rodada anterior: alta | ok | (sem retorno: void) | ok |
| A03.01.painel | f5_tec_ubs | Théo no painel (menos de 2 anos), 1ª consulta até o 30º dia, peso/altura com a data | ok | ok: primeira 2026-07-27, consultas 1, peso_altura 1 | ok |
| A03.01.vacina_acs | f5_tec_ubs | Vacina, ACS e conduta na puericultura | existir | Lacuna (MAPA): puericultura sem vacina, ACS ou conduta (teto 60/100); o painel só mostra consultas e peso/altura. | lacuna |
| A03.02.ficha | f5_rec_ubs | Ficha escuta_inicial: tosse, cansaço e dificuldade para mamar há 2 dias | ok | 427b0f40-8cce-4237-a8b5-f2e7c631c179 | ok |
| A03.B.tecnico_nao_escuta | f5_tec_ubs | Técnico tenta a escuta (deve ser recusado) | erro:A escuta inicial e a classificação são do enfermeiro | recusado: A escuta inicial e a classificação são do enfermeiro. | ok |
| A03.03.escuta | f5_enf_ubs | Escuta com sinais crus (FR, SpO2, temperatura, peso, comprimento); a enfermeira de teste classifica amarelo; saída consulta | ok | c20ddf45-9d56-4538-9727-4ba80181079c | ok |
| A03.03.grupo | banco | Grupo pediátrico escolhido pela data de nascimento; cor da enfermeira | ok | ok: cor amarelo, público pediatrico, pela idade pediatrico | ok |
| A03.04.atender | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A03.04.soap | f5_med_ubs | SOAP com CID de bronquiolite (J21.9) | ok | 1ae440fa-79b5-44bc-980a-d26a9bbc6fd3 | ok |
| A03.04.enviar | f5_med_ubs | Envia à UPA F5 por esforço respiratório (critérios da ped-bronquiolite) | ok | 782fe91c-d6ad-4910-a207-4a55bc8daf8b | ok |
| A03.04.conduta | f5_med_ubs | Encerra a consulta com encaminhamento para urgência (CIAP R78) | ok | (sem retorno: void) | ok |
| A03.05.vindo | f5_rec_upa | Vê o lactente vindo da UBS com queixa, cor, SOAP e sinais | ok | ok: {"id": "782fe91c-d6ad-4910-a207-4a55bc8daf8b", "motivo": "Lactente de 4 meses com esforço respiratório e SpO2 93% (teste A03)", "numero": 28, "resumo": {"soap": {"em" | ok |
| A03.05.ficha | f5_rec_upa | Recepção abre a ficha no Pronto Socorro (criança de colo) | ok | 533cdcba-a3a6-4113-b500-46e96b4407db | ok |
| A03.05.paciente | banco | Paciente da UPA | ok | 8e656e46-07f8-4881-b14f-e6b8c90dc148 | ok |
| A03.05.chegou | f5_rec_upa | Marca "Chegou" com a ficha escolhida | ok | {"id": "782fe91c-d6ad-4910-a207-4a55bc8daf8b", "motivo": "Lactente de 4 meses com esforço respiratório e SpO2 93% (teste | ok |
| A03.05.conta | f5_fat | Conta ambulatorial aberta, sem itens | ok | e2f8833e-235d-4fb5-8be8-c7606b054749 | ok |
| A03.06.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| A03.06.fluxo_adulto_recusado | f5_enf_upa | Fluxograma adulto para o lactente (deve ser recusado) | erro:Fluxograma de outro público | recusado: Fluxograma de outro público (adulto). | ok |
| A03.06.classificar | f5_enf_upa | Fluxograma pediátrico "Alterações respiratórias", sinais crus; a enfermeira de teste classifica laranja | ok | d715a040-b305-49fb-8e3b-1f55b4040fcc | ok |
| A03.06.cor | banco | Cor da enfermeira, grupo pediátrico pela idade | ok | ok: cor laranja, público pediatrico, pela idade pediatrico, discriminador Uso da musculatura acessória (tiragem intercostal) | ok |
| A03.06.conta_acolhimento | f5_fat | Item "acolhimento com classificação" na conta | ok | ok: [{"em": "2026-11-07T03:09:38.087776+00:00", "cbo": "223505", "cid": null, "nome": "ACOLHIMENTO COM CLASSIFICAÇÃO DE RISCO", "avisos": [{"texto": "Paciente sem CNS nem | ok |
| A03.07.iniciar | f5_med_upa | Médico assume | ok | (sem retorno: void) | ok |
| A03.07.sem_peso | f5_med_upa | Prescrição antes do peso do atendimento (deve ser recusado) | erro:Falta para prescrever | recusado: Falta para prescrever: peso deste atendimento (aferido ou estimado). | ok |
| A03.07.peso_aferido | f5_med_upa | Peso aferido do lactente | ok | 1 sinais gravados | ok |
| A03.07.soap | f5_med_upa | SOAP com CID de bronquiolite (J21.9) | ok | 213ced1e-049d-434d-b7be-9b70dc9418fa | ok |
| A03.07.conta_consulta | f5_fat | Item "consulta médica" na conta | ok | ok: consulta na conta | ok |
| A03.08.hidratacao | f5_med_upa | Hidratação EV (glicose), "Contínuo", conforme a ped-bronquiolite (Australásia 2025, rec. 20); dose = texto de teste | ok | 4c02c4b0-e6ff-4484-8c35-1294ef0ee5fa | ok |
| A03.08.oxigenio | f5_med_upa | Cuidado: O₂ suplementar pelo alvo de SpO₂ da ped-bronquiolite | ok | e658d713-7d64-4bef-b987-91419db5d433 | ok |
| A03.08.peso_no_item | banco | O item leva o peso aferido do atendimento | ok | ok: peso_kg 6.1, Glicose solução injetável, bolsa 500 mL | ok |
| A03.09.entrada | f5_farm | Entrada de estoque da glicose (10 bolsas, nota fiscal de teste) | ok | {"saldo": 18} | ok |
| A03.09.fila | f5_farm | O item aparece na fila de validação | ok | ok: na fila | ok |
| A03.09.validar | f5_farm | Farmacêutico valida (confere) | ok | (sem retorno: void) | ok |
| A03.09.para_dispensar | f5_farm | O item aparece em itens_para_dispensar | ok | ok: na lista de dispensação | ok |
| A03.09.dispensar | f5_farm | Dispensa 2 bolsas para 24 h (quantidade de teste) | ok | {"id": "a4ca05fa-59f8-4ea8-8cfe-9536b05ea7b6", "saldo": 16, "estoque_negativo": false, "sem_farmaceutico": false} | ok |
| A03.09.extrato | f5_farm | O extrato mostra a entrada e a saída por prescrição | ok | ok: [{"em": "2026-11-07T03:09:38.60043+00:00", "id": "73c41bf6-8540-4445-904c-25ed5d9e726b", "por": "Farmacêutico F5", "tipo": "saida_prescricao", "motivo": null, "pacien | ok |
| A03.09.conta_medicamento | f5_fat | A dispensação entra na conta sem valor | ok | ok: [{"aviso": "Dispensado e nunca administrado.", "item_id": "4c02c4b0-e6ff-4484-8c35-1294ef0ee5fa", "liquido": 2, "fora_por": null, "devolvido": 0, "dispensado": 2, "pr | ok |
| A03.10.checar | f5_enf_upa | Enfermeira checa "feito" a hidratação | ok | ae1361c1-b0c6-4853-b813-52bfc6435adc | ok |
| A03.10.sinais | f5_enf_upa | SpO2 e FR crus | ok | 2 sinais gravados | ok |
| A03.10.conta_medicacao | f5_fat | Item "administração de medicamento" na conta | ok | ok: medicação na conta | ok |
| A03.11.observacao | f5_med_upa | Desfecho observação | ok | (sem retorno: void) | ok |
| A03.11.internacao | banco | Internação de observação aberta pelo desfecho | ok | 23e390a2-f73c-401b-a324-2420ff4ab2eb | ok |
| A03.11.box | banco | O box escolhido é da Observação Pediátrica (o catálogo previa a Observação Adulto) | ok | ok: setor Observação Pediátrica, box OP-01, pendência 6 h 1 | ok |
| A03.12.enf_ps_fora | f5_enf_upa | Enfermeiro do PS, fora da escala da Observação Pediátrica, tenta os sinais do box (deve ser recusado) | erro | recusado: SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente. | ok |
| A03.12.sinais | f5_enf_obsped | Sinais vitais seriados crus no box | ok | 4 sinais gravados | ok |
| A03.12.fugulin | f5_enf_obsped | Tenta a Fugulin na criança (deve ser recusado: instrumento do adulto) | erro:Fugulin é instrumento do adulto | recusado: Fugulin é instrumento do adulto: na criança não se usa (nada se converte do adulto). | ok |
| A03.12.dini | f5_enf_obsped | Instrumento pediátrico de classificação de enfermagem (Dini) | existir | Lacuna (MAPA): Dini não existe; a tela mostra a nota "Fugulin é instrumento do adulto… (Dini) ainda não está no produto" (conferir na tela). | lacuna |
| A03.13.painel | f5_med_obsped | Painel da observação mostra o lactente, com prazo | ok | box OP-01, setor Observação Pediátrica, prazo 2026-11-07 09:09:38.087776+00, estado nao | ok |
| A03.13.atender | f5_med_obsped | Primeiro atendimento no box | ok | (sem retorno: void) | ok |
| A03.B.reavaliar_13h | f5_med_obsped | Reavaliação marcada para daqui a 13 h (deve ser recusado) | erro:Reavaliação com mais de 12 horas | recusado: Reavaliação com mais de 12 horas: não é observação. | ok |
| A03.13.reavaliar | f5_med_obsped | Marca reavaliação para daqui a 2 h | ok | 4ada3c62-5634-4d5a-859b-22c00e63c974 | ok |
| A03.13.reavaliado | f5_med_obsped | Reavaliação feita (pendência resolvida) | ok | (sem retorno: void) | ok |
| A03.13.porta_ativa | f5_med_obsped | A prescrição da porta aparece para quem cuida da observação | ok | ok: 2 itens: Glicose solução injetável, bolsa 500 mL [Contínuo]; Oxigênio suplementar pelo alvo de SpO₂ da ferramenta ped-bronquiolite (teste de fluxo) [] | ok |
| A03.14.finalizar | f5_med_obsped | Encerra com alta, orientações e CID J21.9 | ok | (sem retorno: void) | ok |
| A03.14.encerrado | banco | Episódio encerrado e box liberado | ok | ok: episódio encerrado, internação alta_melhorada, box OP-01 higienizacao | ok |
| A03.14.contrarreferencia | f5_enf_ubs | A contrarreferência chega à UBS | ok | 9c4c4967-a01f-4439-b223-ac8e2b3284c6 | ok |
| A03.15.abrir | f5_enf_ubs | Enfermeira da UBS abre a contrarreferência | ok | {"id": "9c4c4967-a01f-4439-b223-ac8e2b3284c6", "numero": 33, "resumo": {"cid": null, "medico": null, "relato": null, "destino": null, "unidade": "UPA Fase 5 24h", "desfec | ok |
| A03.15.visto | banco | a_ver → visto, autor = login | ok | ok: situação visto, desfecho alta_melhorada | ok |
| A03.15.puericultura | f5_enf_ubs | Théo segue na puericultura sem consulta nova (o episódio da UPA não conta) | ok | ok: criança true, consultas 1, datas ["2026-07-27"] | ok |
| A03.16.detalhe | f5_fat | Três itens SIGTAP; total de referência; pendências | ok | itens 3 (0301060096 qt 1 = 11.00; 0301060118 qt 1 = nulo; 0301100012 qt 1 = 0.63); total 11.63; pendências 3 [Endereço incompleto (CEP, município IBGE, tipo de logradouro | ok |
| A03.16.conferencia | f5_fat | aberta → em_conferencia | ok | {"id": "e2f8833e-235d-4fb5-8be8-c7606b054749", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:09:38.087776+00:0 | ok |
| A03.16.fechar | f5_fat | Faturamento fecha a conta | ok | {"id": "e2f8833e-235d-4fb5-8be8-c7606b054749", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:09:38.087776+00:0 | ok |
| A03.16.bpa | f5_fat | BPA da UPA: linhas do lactente e o aviso (não crítica) por falta de CNS | ok | ok: 3 linhas: 0301060096 bpa_c qt 1 críticas [] avisos [{"texto": "Paciente sem CNS nem CPF válido: o SIA recusa procedimento que exige CPF/CNS.", "codigo": "documento"}, | ok |

### A04 — Duas crianças no mesmo plantão: 13a 11m 29d e 14a 0d

Nascimentos calculados na rodada (07/11/2026): Luan em 08/11/2012 (13a 11m 29d), Bia em 07/11/2012 (14a 0d).

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A04.00.encerra_anterior_alta | f5_med_upa | Rodada anterior: alta do paciente parado no atendimento | ok | P0001: Alta: exames pedidos sem resultado: RADIOGRAFIA DE PUNHO (AP + LATERAL + OBLIQUA). Registre o resultado ou cancele com motivo. | **falha** |
| A04.00.encerra_anterior_alta | f5_med_upa | Rodada anterior: alta do paciente parado no atendimento | ok | P0001: Alta: exames pedidos sem resultado: RADIOGRAFIA DE PUNHO (AP + LATERAL + OBLIQUA). Registre o resultado ou cancele com motivo. | **falha** |
| A04.01.ficha_luan | f5_rec_upa | Ficha de Luan (13a 11m 29d): queda de bicicleta, TCE leve e dor no punho | ok | f1b5bc40-cb06-4e36-9370-43287123495a | ok |
| A04.01.ficha_bia | f5_rec_upa | Ficha de Bia (14a 0d): a mesma queixa | ok | 1c4fd4f4-8133-4d02-9ee6-dad7e13d9e99 | ok |
| A04.01.paciente_luan | banco | Paciente Luan | ok | 4192104c-bc3b-4073-b934-b2bcbb5f1498 | ok |
| A04.01.paciente_bia | banco | Paciente Bia | ok | ed676514-afd1-4fff-873d-28388d1d7e81 | ok |
| A04.01.conta_luan | f5_fat | Conta ambulatorial de Luan aberta | ok | fde730b7-168a-4da0-84b2-20222b99d892 | ok |
| A04.01.conta_bia | f5_fat | Conta ambulatorial de Bia aberta | ok | 31c5d901-3f0d-4e5a-bb82-d4bf6ef339ca | ok |
| A04.02.chamar_luan | f5_enf_upa | Chama Luan | ok | {"aviso": false, "numero": 1} | ok |
| A04.02.luan_fluxo_adulto | f5_enf_upa | Fluxograma adulto "Politraumas" para Luan (deve ser recusado) | erro:Fluxograma de outro público | recusado: Fluxograma de outro público (adulto). | ok |
| A04.02.classificar_luan | f5_enf_upa | Fluxograma pediátrico "Trauma e quedas", sinais crus; a enfermeira de teste classifica amarelo | ok | 89a78f1c-8db8-4601-ac40-83ea6dd2946a | ok |
| A04.02.grupo_luan | banco | Luan: grupo pediátrico pela idade; cor da enfermeira | ok | ok: cor amarelo, público pediatrico, pela idade pediatrico | ok |
| A04.03.chamar_bia | f5_enf_upa | Chama Bia | ok | {"aviso": false, "numero": 1} | ok |
| A04.03.bia_fluxo_pediatrico | f5_enf_upa | Fluxograma pediátrico "Trauma e quedas" para Bia (deve ser recusado) | erro:Fluxograma de outro público | recusado: Fluxograma de outro público (pediatrico). | ok |
| A04.03.classificar_bia | f5_enf_upa | Fluxograma adulto "Politraumas", mesma queixa; a enfermeira de teste classifica amarelo | ok | 6f7fb40e-f81d-44b6-a12a-7247ed8197be | ok |
| A04.03.grupo_bia | banco | Bia: grupo adulto pela idade; cor da enfermeira | ok | ok: cor amarelo, público adulto, pela idade adulto | ok |
| A04.04.iniciar_luan | f5_med_upa | Médico assume Luan | ok | (sem retorno: void) | ok |
| A04.05.iniciar_bia | f5_med_upa | Médico assume Bia | ok | (sem retorno: void) | ok |
| A04.B.reclassificar_luan | f5_enf_upa | Enfermagem tenta reclassificar Luan depois que o médico assumiu (deve ser recusado) | erro:O atendimento médico já começou | recusado: O atendimento médico já começou: agora só o médico reclassifica. | ok |
| A04.B.sem_peso_luan | f5_med_upa | Prescrever para Luan antes do peso (deve ser recusado) | erro:Falta para prescrever | recusado: Falta para prescrever: peso deste atendimento (aferido ou estimado). | ok |
| A04.B.sem_peso_bia | f5_med_upa | Prescrever para Bia antes do peso (deve ser recusado) | erro:Falta para prescrever | recusado: Falta para prescrever: peso deste atendimento (aferido ou estimado). | ok |
| A04.04.peso_luan | f5_med_upa | Peso aferido de Luan | ok | 1 sinais gravados | ok |
| A04.05.peso_bia | f5_med_upa | Peso aferido de Bia | ok | 1 sinais gravados | ok |
| A04.04.soap_luan | f5_med_upa | SOAP de Luan com CID de TCE (S06.0) | ok | 40474c12-d38f-4934-87e3-abc3c4e1bdf1 | ok |
| A04.05.soap_bia | f5_med_upa | SOAP de Bia com CID de TCE (S06.0) | ok | a96f3f22-44e1-4260-b7dd-4ae5184b10ae | ok |
| A04.06.prescricao_luan | f5_med_upa | Analgesia de Luan conforme a ficha pediátrica ped-bolus (Morfina — IV/IM, ICr Apêndice); dose = texto de teste | ok | 40d94475-d6b4-4375-8aad-89d5205e544b | ok |
| A04.07.prescricao_bia | f5_med_upa | Analgesia de Bia conforme a ficha de adulto de dor e analgesia (degrau 1); dose = texto de teste | ok | 498b7bfa-5f3d-4132-98c0-4827ec2a14d3 | ok |
| A04.06.itens | banco | Cada item leva o peso aferido do seu atendimento e cita a ficha do seu público | ok | ok: Morfina solução injetável, ampola 1 mL peso 48 [Conforme a ferramenta pediátrica ped-bolus (ICr Apêndice), peso aferido — teste de fluxo]; Dipirona sódica solução inj | ok |
| A04.06.farmacia_luan | f5_farm | Farmacêutico valida e dispensa a morfina de Luan (alta vigilância) | ok |  {"id": "903fc390-4498-4a16-91b7-f7463df6f687", "saldo": -2, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| A04.07.farmacia_bia | f5_farm | Farmacêutico dispensa a dipirona de Bia | ok | {"id": "8668770c-1a67-4a09-8207-73258d490d20", "saldo": 6, "estoque_negativo": false, "sem_farmaceutico": false} | ok |
| A04.08.rx_luan | f5_med_upa | Radiografia do punho de Luan (SIGTAP 0204040124) | ok | 1 | ok |
| A04.08.rx_bia | f5_med_upa | Radiografia do punho de Bia (SIGTAP 0204040124) | ok | 1 | ok |
| A04.08.exame_luan | banco | Pedido de Luan | ok | 4f58ca11-c318-4157-a350-126920b2763e | ok |
| A04.08.exame_bia | banco | Pedido de Bia | ok | a4753515-e881-443e-85d4-b8b4009f5e67 | ok |
| A04.08.lista | f5_med_upa | Os dois pedidos aparecem em exames_da_unidade | ok | P0001: confere: {"exames": [], "pode_definir": false} | **falha** |
| A04.09.checar_luan | f5_enf_upa | Checa "feito" a analgesia de Luan (liberada pela farmácia) | ok | a5250983-ecdf-4b14-920d-7c22b7b048c8 | ok |
| A04.09.checar_bia | f5_enf_upa | Checa "feito" a analgesia de Bia | ok | 20581a89-d4f0-4ec4-86e1-668a1f019ef8 | ok |
| A04.09.contas_porta | f5_fat | Cada conta da porta: classificação, consulta e medicação | ok | ok: Luan 3 itens, total 11.63; Bia 3 itens, total 11.63 | ok |
| A04.10.higienizacao_INT-01 | f5_enf_int | Pré-condição: a enfermagem conclui a higienização do leito INT-01 | ok | (sem retorno: void) | ok |
| A04.10.higienizacao_INT-02 | f5_enf_int | Pré-condição: a enfermagem conclui a higienização do leito INT-02 | ok | (sem retorno: void) | ok |
| A04.10.internar_luan | f5_med_upa | Luan: desfecho internação na Internação da UPA, com leito | ok | (sem retorno: void) | ok |
| A04.10.internar_bia | f5_med_upa | Bia: desfecho internação no mesmo setor, com leito | ok | (sem retorno: void) | ok |
| A04.10.int_luan | banco | Internação de Luan | ok | 57c9d075-e2ae-4f29-bb30-6b3a6f1e3299 | ok |
| A04.10.int_bia | banco | Internação de Bia | ok | c75d7bf2-ba59-45c0-a60a-222e4e1b35b7 | ok |
| A04.10.contas_internacao | banco | Cada criança tem conta de internação ligada à conta da porta (conta_origem_id) | ok | ok: Luan A04 Teste B: I-2026.000004 internacao aberta, origem A-2026.000024; Bia A04 Teste B: I-2026.000005 internacao aberta, origem A-2026.000025 | ok |
| A04.11.admissao_luan | f5_med_int | Admissão de Luan (ficha completa) | ok | c33216f8-9911-4d0d-9bf3-29ed331fa3d4 | ok |
| A04.11.admissao_bia | f5_med_int | Admissão de Bia (ficha completa) | ok | cad3fdbc-d2e0-48a7-919f-1885e12c6f66 | ok |
| A04.12.fugulin_enf_ps | f5_enf_upa | Enfermeiro do PS (fora da Internação) tenta o Fugulin de Bia (deve ser recusado) | erro:O Fugulin é do enfermeiro de plantão | recusado: O Fugulin é do enfermeiro de plantão no setor do paciente. | ok |
| A04.12.fugulin_bia | f5_enf_int | Fugulin de Bia (12 áreas, graduação de teste) | ok | 1f6f4860-df9f-4c93-aa14-65deb74f0388 | ok |
| A04.12.fugulin_bia_banco | banco | Fugulin gravado com total e categoria, autor = login | ok | ok: total 12, Cuidados mínimos (12 a 17), dia 2026-11-07 | ok |
| A04.12.fugulin_luan | f5_enf_int | Fugulin de Luan (deve ser recusado: instrumento do adulto) | erro:Fugulin é instrumento do adulto | recusado: Fugulin é instrumento do adulto: na criança não se usa (nada se converte do adulto). | ok |
| A04.12.dini | f5_enf_int | Instrumento pediátrico de enfermagem (Dini) para Luan | existir | Lacuna (MAPA): Dini não existe; só a nota na tela (AbasRegistro.tsx). | lacuna |
| A04.13.virada | f5_med_int | No dia seguinte, Luan (14a 0d) passa a adulto na Central e na Fugulin; registros antigos não mudam | existir | Não executável na mesma rodada: exige o dia civil seguinte (2026-11-07 + 1). A internação de Luan fica aberta para essa conferência? Não: o catálogo dá alta no passo 14;  | lacuna |
| A04.14.laudo_luan | f5_med_int | Resultado da radiografia de Luan (texto fictício) | ok | (sem retorno: void) | ok |
| A04.14.laudo_bia | f5_med_int | Resultado da radiografia de Bia (texto fictício) | ok | (sem retorno: void) | ok |
| A04.14.impeditivos_luan | f5_med_int | Impeditivos da alta de Luan | ok | [] | ok |
| A04.14.alta_luan | f5_med_int | Alta melhorada de Luan (S06.0) | ok | (sem retorno: void) | ok |
| A04.14.pacote_luan | f5_med_int | Pacote de alta de Luan | ok | 2026-12-07T03:11:55.929837+00:00 | ok |
| A04.14.impeditivos_bia | f5_med_int | Impeditivos da alta de Bia | ok | [] | ok |
| A04.14.alta_bia | f5_med_int | Alta melhorada de Bia (S06.0) | ok | (sem retorno: void) | ok |
| A04.14.pacote_bia | f5_med_int | Pacote de alta de Bia | ok | 2026-12-07T03:11:55.929837+00:00 | ok |
| A04.99.custos | f5_fat | Custos que o sistema registrou (as quatro contas) | ok | Bia A04 Teste B A-2026.000025 ambulatorial aberta: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, 0301100012 qt 1 = 0.63, total 11.63 / Luan A04 Teste B A-2026.000024 a | ok |
| A04.00.encerra_anterior_exame | f5_med_upa | Rodada anterior: resultado do exame pendente (a alta da porta exige) | ok | (sem retorno: void) | ok |
| A04.00.encerra_anterior_alta | f5_med_upa | Rodada anterior: alta do paciente parado no atendimento | ok | (sem retorno: void) | ok |
| A04.00.encerra_anterior_exame | f5_med_upa | Rodada anterior: resultado do exame pendente (a alta da porta exige) | ok | (sem retorno: void) | ok |
| A04.00.encerra_anterior_alta | f5_med_upa | Rodada anterior: alta do paciente parado no atendimento | ok | (sem retorno: void) | ok |

### A05 — Anafilaxia pediátrica na porta, com liberação da farmácia

O passo `A05.12.agravo` falhou por erro do script (função de conjunto dentro de `coalesce`) e foi refeito como `A05.12.agravo_refeito`: ok, 0 sugestões.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A05.01.ficha | f5_rec_upa | Ficha de Sofia no PS: reação alérgica | ok | 37fd5cfe-1d60-4b9e-8b97-505810cbb5ba | ok |
| A05.01.paciente | banco | Paciente | ok | e829aaad-0398-46ae-aaf1-633be218b218 | ok |
| A05.01.conta | f5_fat | Conta ambulatorial aberta | ok | fdd7f601-45df-4fe4-aec7-902a30db11a6 | ok |
| A05.02.chamar | f5_enf_upa | Chama Sofia | ok | {"aviso": false, "numero": 1} | ok |
| A05.02.classificar | f5_enf_upa | Fluxograma pediátrico "Alterações dermatológicas" (escolha da enfermeira), sinais crus; a enfermeira de teste classifica vermelho | ok | 479d4c99-ce4f-4575-9e1c-76808201df89 | ok |
| A05.02.cor | banco | Cor da enfermeira; grupo pediátrico | ok | ok: cor vermelho, público pediatrico, discriminador Alteração súbita da consciência (escala de Glasgow < 8) | ok |
| A05.03.iniciar | f5_med_upa | Médico assume na hora | ok | (sem retorno: void) | ok |
| A05.03.peso | f5_med_upa | Peso aferido na porta | ok | 1 sinais gravados | ok |
| A05.03.soap | f5_med_upa | SOAP com CID de anafilaxia alimentar (T78.0) | ok | b9d6714e-3b0b-45af-89e7-8babf56ef6df | ok |
| A05.04.epinefrina | f5_med_upa | Primeira linha: epinefrina IM, "Agora" (dose única), conforme ped-anafilaxia-icr; dose = texto de teste | ok | 390adb15-cf6a-4231-8542-d7472d97cf19 | ok |
| A05.04.cristaloide | f5_med_upa | Segunda linha: cristaloide (SF) EV, "Agora", conforme ped-anafilaxia-icr; dose = texto de teste | ok | 9ee2e977-6275-45b7-9b5a-186b5067d38b | ok |
| A05.04.salbutamol | f5_med_upa | Salbutamol aerossol "Se necessário" para o broncoespasmo, conforme ped-anafilaxia-icr; dose = texto de teste | ok | 42b6fb81-bc66-40db-908c-ef894924b447 | ok |
| A05.04.alta_vigilancia | f5_farm | A epinefrina está na fila como alta vigilância, aguardando liberação | ok | ok: na fila com alta vigilância | ok |
| A05.05.motivo_9_letras | f5_enf_upa | Checar sem liberação com motivo de 9 letras (deve ser recusado) | erro:Alta vigilância sem liberação | recusado: Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois. | ok |
| A05.05.checar_sem_liberacao | f5_enf_upa | Checa "feito" a epinefrina antes da liberação, com motivo de 10+ letras | ok | 0bd7f870-af98-4219-8b5a-e56b832d81c3 | ok |
| A05.05.marcada | banco | A administração fica sem_liberacao = true, autor = login da enfermeira | ok | ok: sem_liberacao true, motivo "Anafilaxia em curso, farmácia avisada (teste A05)" | ok |
| A05.05.checar_sf | f5_enf_upa | Checa "feito" o cristaloide (não é alta vigilância) | ok | dcdabec0-568a-45ad-a44c-139c1a2b3943 | ok |
| A05.B.enf_outro_setor | f5_enf_obs | Enfermeira da Observação Adulto checa item de paciente do PS (deve ser recusado) | erro:A checagem é da enfermagem de plantão no setor do paciente | recusado: A checagem é da enfermagem de plantão no setor do paciente. | ok |
| A05.06.ve_sem_liberacao | f5_farm | O farmacêutico vê a administração sem liberação | ok | ok: na lista do farmacêutico | ok |
| A05.06.validar_adr | f5_farm | Valida a epinefrina (confere = liberação) | ok | (sem retorno: void) | ok |
| A05.06.validar_sf | f5_farm | Valida o cristaloide | ok | (sem retorno: void) | ok |
| A05.06.validar_sal | f5_farm | Valida o salbutamol | ok | (sem retorno: void) | ok |
| A05.06.dispensar_adr | f5_farm | Dispensa a epinefrina (inclusive a já administrada) | ok | {"id": "ec8e8824-4ba1-4814-9497-b06d0e8410ea", "saldo": -2, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| A05.06.dispensar_sf | f5_farm | Dispensa o cristaloide | ok | {"id": "883dc10f-f8d7-4c31-ae66-6b153df400dc", "saldo": -1, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| A05.06.dispensar_sal | f5_farm | Dispensa o salbutamol | ok | {"id": "1771484f-6b95-483d-ac67-b240792aba20", "saldo": -1, "estoque_negativo": true, "sem_farmaceutico": false} | ok |
| A05.06.extrato | f5_farm | O extrato da epinefrina mostra a saída por prescrição | ok | ok: [{"em": "2026-11-07T03:12:45.329158+00:00", "id": "0cef4719-887a-4b71-b67d-056dae21ec02", "por": "Farmacêutico F5", "tipo": "saida_prescricao", "motivo": null, "pacie | ok |
| A05.B.enf_dispensa_sem_justificativa | f5_enf_upa | Enfermagem dispensa sem farmacêutico e sem justificativa (deve ser recusado) | erro:Retirada sem farmacêutico | recusado: Retirada sem farmacêutico: escreva a justificativa (mínimo de 10 letras). | ok |
| A05.B.enf_dispensa_com_farmacia_aberta | f5_enf_upa | Enfermagem dispensa com justificativa enquanto o farmacêutico está de plantão (o catálogo diz: só com a farmácia fechada) — registro, desfeito | registrar | ACEITO (a ação foi desfeita para não mudar o cenário) | ok |
| A05.B.farm_prontuario | f5_farm | Farmacêutico pede acesso ao prontuário (deve ser recusado) | erro | recusado: Acesso negado: seu papel nesta unidade não pede acesso a prontuário. | ok |
| A05.07.lista | f5_farm | Lista de interações críticas da UPA | ok | pares 15 (ativos 0) | ok |
| A05.07.justificadas | f5_farm | Interações justificadas entre os itens prescritos (nenhuma esperada) | ok | [] | ok |
| A05.08.reavaliacao | f5_med_upa | Reavaliação: sibilos persistentes | ok | 3d43b5a5-efc5-447c-99ff-30da51a3819a | ok |
| A05.08.sinais | f5_med_upa | Sinais crus da reavaliação | ok | 5 sinais gravados | ok |
| A05.08.segunda_dose | f5_med_upa | Segunda dose de epinefrina IM "Agora", conforme a ferramenta (repetir se a resposta não for plena) | ok | P0001: Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar. | **falha** |
| A05.08.segunda_dose_alterar | f5_med_upa | Contorno (o do A01): altera o item da 1ª dose para a 2ª; vira item novo, sem a liberação anterior | ok | 2af0b3f7-0e49-434e-93cd-9e37d71d8d66 | ok |
| A05.B.alterado_perde_liberacao | f5_farm | O item novo volta à fila sem liberação | ok | ok: na fila, sem confere | ok |
| A05.08.sem_motivo_antes | f5_enf_upa | Checar a 2ª dose sem motivo antes da liberação (deve ser recusado) | erro:Alta vigilância sem liberação | recusado: Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois. | ok |
| A05.08.validar_2 | f5_farm | Farmacêutico libera a 2ª dose (confere) | ok | (sem retorno: void) | ok |
| A05.08.checar_2 | f5_enf_upa | Depois do confere, a 2ª dose checa sem motivo | ok | 21ee1139-6f87-41f3-bd6b-9b7b470520d1 | ok |
| A05.08.medicacao_na_conta | f5_fat | Conta: quantas linhas e quantidade de "administração de medicamento" no dia | ok | ok: 1 linha(s) 0301100012, quantidade 3 | ok |
| A05.09.observacao | f5_med_upa | Desfecho observação (a ferramenta recomenda observar 4 a 6 h) | ok | (sem retorno: void) | ok |
| A05.09.internacao | banco | Internação de observação | ok | 2bbdb5c1-c83b-4ff5-9c9b-90754fc38fc0 | ok |
| A05.09.box | banco | Box na Observação Pediátrica (o catálogo previa a Observação Adulto) | ok | ok: setor Observação Pediátrica, box OP-02 | ok |
| A05.10.sinais | f5_enf_obsped | Sinais seriados crus no box | ok | 5 sinais gravados | ok |
| A05.11.alta_pelo_medico_da_porta | f5_med_upa | O médico da porta, que pôs Sofia em observação e não está escalado nela, encerra com alta (T78.0) | ok | (sem retorno: void) | ok |
| A05.11.encerrado | banco | Episódio encerrado, alta registrada pelo médico da porta | ok | ok: episódio encerrado, internação alta_melhorada, alta por 08 | ok |
| A05.11.receita | f5_med_upa | Receita para o responsável (texto de teste, sem dose) | ok | 8df36e9e-84d0-4362-8f86-7cda3657386f | ok |
| A05.11.atestado | f5_med_upa | Atestado de acompanhamento para a mãe (texto de teste) | ok | 9189b1ed-d590-4212-a610-0805a70db06c | ok |
| A05.11.autor | banco | Receita e atestado com autor = login do médico | ok | ok: receita nº 2026/000014 ativo, atestado nº 2026/000015 ativo | ok |
| A05.12.agravo | f5_med_upa | O CID T78.0 não sugere agravo da LNNC | ok | 0A000: set-returning functions are not allowed in COALESCE | **falha** |
| A05.13.detalhe | f5_fat | Itens SIGTAP, medicamentos sem valor, total e pendências | ok | itens 3 (0301060096 qt 1 = 11.00; 0301060118 qt 1 = nulo; 0301100012 qt 3 = 1.89); medicamentos 4; total 12.89; pendências 4 [Endereço incompleto (CEP, município IBGE, ti | ok |
| A05.13.conferencia | f5_fat | aberta → em_conferencia | ok | {"id": "fdd7f601-45df-4fe4-aec7-902a30db11a6", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:12:45.055649+00:0 | ok |
| A05.13.fechar | f5_fat | Faturamento fecha a conta | ok | {"id": "fdd7f601-45df-4fe4-aec7-902a30db11a6", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:12:45.055649+00:0 | ok |
| A05.13.bpa | f5_fat | BPA da UPA: linhas de Sofia (classificação, consulta, medicação) | ok | ok: 3 linhas: 0301060118 qt 1 críticas []; 0301060096 qt 1 críticas []; 0301100012 qt 3 críticas [] | ok |
| A05.12.agravo_refeito | f5_med_upa | O CID T78.0 não sugere agravo da LNNC (refeito: a 1ª tentativa do script usou função de conjunto dentro de coalesce) | ok | ok: 0 sugestão(ões) | ok |

### A06 — Recém-nascido vinculado à mãe e regulação neonatal com incubadora

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A06.01.ficha_mae | f5_rec_upa | Cadastra Joana (CNS válido) e abre a ficha dela no PS (dor mamária, parto há 5 dias fora da rede) | ok | 4c1b87b2-f4d2-4604-9798-e2fd1996d210 | ok |
| A06.01.paciente_mae | banco | Cadastro da mãe | ok | ad813e93-c8c2-4072-b2db-0bb26cfc526c | ok |
| A06.02.cadastrar_rn | f5_rec_upa | Cadastra o RN pelo cadastro de Joana (hoje − 5 dias, sexo M, parto único) | ok | 111a6de7-be33-4aa3-9db8-251d57c9d7b5 | ok |
| A06.02.rn_banco | banco | RN com nome "RN de Joana…", mae_id, parentesco mãe, nome da mãe, prontuário e auditoria | ok | ok: nome RN de Joana A06 Teste, prontuário 2026.000027, nascimento 2026-11-02, auditoria 1 | ok |
| A06.03.duplicado | f5_rec_upa | Cadastra de novo o RN de Joana na mesma data, sem ordem de gemelar (deve ser recusado) | erro:Já existe recém-nascido de | recusado: Já existe recém-nascido de Joana A06 Teste nascido em 02/11/2026. Para gêmeos, informe a ordem de cada um (RN 1, RN 2). | ok |
| A06.B.gemelar_mesmo_parto | f5_rec_upa | Gemelar 1 no mesmo parto, já havendo um RN sem ordem (registro, desfeito) | registrar | RECUSADO: Já existe recém-nascido de Joana A06 Teste nascido em 02/11/2026. Para gêmeos, informe a ordem de cada um (RN 1, RN 2). | ok |
| A06.B.rn_28_dias | f5_rec_upa | "RN de" com 28 dias de vida (deve ser recusado) | erro:O cadastro "RN de" é só até 27 dias | recusado: O cadastro "RN de" é só até 27 dias de vida. Cadastre com o nome da criança. | ok |
| A06.B.rn_data_futura | f5_rec_upa | Data de nascimento futura (deve ser recusado) | erro:Informe a data de nascimento do recém-nascido | recusado: Informe a data de nascimento do recém-nascido (não pode ser futura). | ok |
| A06.B.mae_que_e_rn | f5_rec_upa | Escolher como mãe um cadastro que é RN (deve ser recusado) | erro:O cadastro escolhido como mãe é de um recém-nascido | recusado: O cadastro escolhido como mãe é de um recém-nascido. | ok |
| A06.B.fora_da_escala | f5_rec_ubs | Recepção da UBS (fora da escala da UPA) tenta cadastrar_rn (deve ser recusado) | erro:Acesso negado: cadastro de recém-nascido | recusado: Acesso negado: cadastro de recém-nascido só para quem está de plantão na unidade. | ok |
| A06.04.ficha_rn | f5_rec_upa | Abre a ficha do RN no PS: icterícia, mama pouco | ok | c2abece7-15bf-4aab-98d1-583278de5a92 | ok |
| A06.04.conta_rn | f5_fat | Conta própria do RN, aberta | ok | 09517b4b-a870-4d88-b892-f4cf8b6abb2b | ok |
| A06.04.conta_mae | f5_fat | Conta da mãe, separada | ok | be7bf71d-6bb1-407e-bc88-6dfb5fe3867c | ok |
| A06.05.chamar_rn | f5_enf_upa | Chama o RN | ok | {"aviso": false, "numero": 1} | ok |
| A06.05.classificar_rn | f5_enf_upa | Grupo pediátrico; sinais crus (temperatura, FC, FR, SpO2, glicemia); a enfermeira de teste classifica laranja | ok | 6aa630b1-85ec-4d76-9f4a-94cd5a962219 | ok |
| A06.05.cor_rn | banco | Cor da enfermeira; grupo pediátrico | ok | ok: cor laranja, público pediatrico | ok |
| A06.05.chamar_mae | f5_enf_upa | Chama Joana | ok | {"aviso": false, "numero": 1} | ok |
| A06.05.classificar_mae | f5_enf_upa | Joana: fluxograma adulto "Mal-estar geral"; a enfermeira de teste classifica verde | ok | P0001: Sinal vital obrigatório ausente: frequencia respiratoria. | **falha** |
| A06.06.iniciar_rn | f5_med_upa | Médico assume o RN | ok | (sem retorno: void) | ok |
| A06.06.peso_rn | f5_med_upa | Peso aferido do RN | ok | 1 sinais gravados | ok |
| A06.06.soap_rn | f5_med_upa | SOAP com CID de icterícia neonatal (P59.9); ferramenta ped-ictericia-neonatal na tela | ok | a5b23b19-2adf-4a92-84f1-e80070d96ef6 | ok |
| A06.07.exames | f5_med_upa | Pede bilirrubinas (SIGTAP 0202010201) e tipagem conforme a ferramenta | ok | 2 | ok |
| A06.07.exame_bili | banco | Pedido da bilirrubina | ok | b161ae99-1f3f-4106-b25f-d88575a09750 | ok |
| A06.07.resultado | f5_med_upa | Resultado da bilirrubina registrado (texto fictício) | ok | (sem retorno: void) | ok |
| A06.08.cuidado | f5_med_upa | Cuidado conforme ped-ictericia-neonatal; fototerapia não existe na UPA F5 (motivo da transferência) | ok | c21ad505-0007-4421-b624-f4fb0dd3d8bc | ok |
| A06.09.sem_incubadora | f5_med_upa | Transferência do neonato sem responder a incubadora (deve ser recusado) | erro:Recém-nascido: informe se a transferência precisa de incubadora | recusado: Recém-nascido: informe se a transferência precisa de incubadora. | ok |
| A06.10.solicitar | f5_med_upa | Repete com incubadora = sim | ok | 869d9ef3-15a3-4cee-9e7f-98a171eefa2a | ok |
| A06.10.enviada | banco | enviada; o RN conta como identificado pelo documento da mãe; incubadora gravada | ok | ok: nº 109, status enviada, não identificado false, incubadora true, tipo de leito pediatrico | ok |
| A06.10.vinculos | f5_med_upa | regulacao_vinculos_paciente traz a mãe e o documento dela | ok | ok: tem documento true, mãe Joana A06 Teste | ok |
| A06.11.fila | f5_regulador | O pedido está na fila da central | ok | ok: na fila | ok |
| A06.11.assumir | f5_regulador | Regulador assume | ok | {"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cbo": null, "cid": "P59.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| A06.11.pendencia | f5_regulador | Abre pendência pedindo o resultado da bilirrubina | ok | {"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cbo": null, "cid": "P59.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| A06.11.prazo | banco | Status pendencia e o evento gravado | ok | ok: status pendencia, pendência em 2026-11-07 03:13:28.176649+00 | ok |
| A06.12.nir_ve | f5_nir | NIR da UPA vê a pendência da regulação | ok | P0001: confere: não achada | **falha** |
| A06.12.documento | f5_med_upa | Médico registra a evolução com o resultado (para anexar) | ok | 2192e668-cae5-4274-9cb2-f0a9163305f7 | ok |
| A06.12.anexar | f5_nir | NIR anexa o documento do prontuário à solicitação | ok | e0307619-01ab-4b29-9a1d-a945de59b4b5 | ok |
| A06.12.responder | f5_nir | NIR responde a pendência | ok | (sem retorno: void) | ok |
| A06.12.volta_fila | banco | Volta à análise (em_analise), com a resposta e o anexo | ok | ok: status em_analise, anexos 1, criada em 2026-11-07 03:13:28.176649+00 | ok |
| A06.13.autorizar | f5_regulador | Autoriza com destino Hospital F5 | ok | {"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cbo": null, "cid": "P59.9", "sla": {"fila": {"atrasado": false, "corrend | ok |
| A06.14.leitos | f5_med_hosp | Leitos livres do destino: nenhum do tipo pediátrico; o CM aparece como "outro tipo" | ok | ok: CM-04 Clínica Médica do_tipo false; UTI-01 UTI Adulto do_tipo false; UTI-02 UTI Adulto do_tipo false; UTI-03 UTI Adulto do_tipo false; OB-01 Obstetrícia do_tipo false | ok |
| A06.14.aceitar | f5_med_hosp | Médico do hospital aceita e reserva o leito CM (CM-04) | ok | {"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cbo": null, "cid": "P59.9", "sla": null, "tipo": "transferencia", "exame | ok |
| A06.14.reserva | banco | autorizada e reserva de leito | ok | ok: status autorizada, leito CM-04, reserva até 2026-11-08 03:13:28.176649+00 | ok |
| A06.15.historico | f5_ges_upa | Histórico do RN na regulação, eventos com autor | ok | ok: [{"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cid": "P59.9", "tipo": "transferencia", "numero": 109, "origem": "UPA Fase 5 24h", "status": "autorizada", "carater": | ok |
| A06.15.sla | f5_ges_upa | Painel de SLA da origem | ok | {"agora": "2026-11-07T03:13:28.176649+00:00", "dados": [{"id": "e810f4bb-1eea-4d59-a506-84c60f4ad337", "cbo": null, "cid": "J18.9", "sla": {"fila": {"atrasado": true, "co | ok |
| A06.16.desfecho_rn | f5_med_upa | Desfecho transferência do RN, com relato | ok | (sem retorno: void) | ok |
| A06.16.sem_contrarreferencia | banco | Episódio do RN encerrado, sem contrarreferência (não veio de UBS) | ok | 42703: column c.paciente_id does not exist | **falha** |
| A06.17.saida | f5_nir | NIR marca a saída (a mãe acompanha) | ok | {"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cbo": null, "cid": "P59.9", "sla": null, "tipo": "transferencia", "exame | ok |
| A06.18.chegada | f5_med_hosp | Médico do hospital marca a chegada (realizada) | ok | {"id": "869d9ef3-15a3-4cee-9e7f-98a171eefa2a", "cbo": null, "cid": "P59.9", "sla": null, "tipo": "transferencia", "exame | ok |
| A06.18.sem_internacao | banco | A chegada regulada não cria internação no hospital | ok | ok: nenhuma internação no hospital | ok |
| A06.18.ficha_hosp | f5_rec_hosp | Recepção do hospital abre a ficha do RN (cadastro novo na unidade, com o nome da mãe) | ok | b096772b-9e25-407c-8808-0d84316869a0 | ok |
| A06.18.paciente_hosp | banco | Cadastro do RN no hospital: nome da mãe, sem mae_id (o vínculo é por unidade) | ok | 032ee320-51fd-490e-a9f5-dcbb9a5ed6f4 | ok |
| A06.18.vinculo_mae_hosp | banco | mae_id no cadastro do hospital (o catálogo prevê vazio, pois Joana não é cadastrada lá) | ok | ok: mae_id vazio, nome_mae Joana A06 Teste | ok |
| A06.18.classificar_hosp | f5_enf_hosp | Enfermeira do hospital classifica o RN; a enfermeira de teste escolhe laranja | ok | b2196dc6-bc7d-449a-b004-c26fac81ab52 | ok |
| A06.18.iniciar_hosp | f5_med_porta_hosp | Médico da porta assume | ok | (sem retorno: void) | ok |
| A06.18.soap_hosp | f5_med_porta_hosp | SOAP de chegada (P59.9) | ok | 01664ada-7960-4b4f-a8aa-99bd9299026d | ok |
| A06.18.leitos_para_ocupar | f5_med_porta_hosp | leitos_para_ocupar oferece o leito reservado pela regulação | ok | ok: CM-01 (reservado), CM-04 (reservado) | ok |
| A06.18.internar | f5_med_porta_hosp | Interna o RN no leito CM reservado | ok | (sem retorno: void) | ok |
| A06.18.internacao | banco | Internação no hospital e a reserva consumida | ok | ok: internação 67188bee-4062-460d-8bf5-0b54fbc6e400, leito CM-04 ocupado, reserva ocupada | ok |
| A06.18.conta_internacao | f5_fat | Conta de internação do RN aberta no hospital (sem AIH: R$ 0,00) | ok | a9470d57-ed07-4f26-b754-4ecdd210bb23 internacao — total 0 | ok |
| A06.19.iniciar_mae | f5_med_upa | Médico assume Joana | ok | P0001: O paciente não está aguardando atendimento médico. | **falha** |
| A06.19.soap_mae | f5_med_upa | SOAP de Joana (O91.2) | ok | P0001: Abra o atendimento antes de registrar. | **falha** |
| A06.19.alta_mae | f5_med_upa | Alta de Joana com orientações | ok | P0001: O episódio não está em atendimento. | **falha** |
| A06.19.contas | f5_fat | Contas de Joana e do RN independentes, cada uma com a sua classificação e consulta | ok | Joana: sem itens, total 0 / RN: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, total 11.00 | ok |
| A06.99.eventos_regulacao | banco | Um evento por transição em regulacao_eventos, autor = login | ok | ok: enviada por 08 → assumida por 12 → pendencia por 12 → anexo_incluido por 13 → pendencia_respondida por 13 → autorizada por 12 → destino_aceitou por 11 → saiu por 13 → | ok |
| A06.05.classificar_mae_refeito | f5_enf_upa | Joana (refeito com FR e SpO2): "Mal-estar geral"; a enfermeira de teste classifica verde | ok | 1e211102-6daa-4c59-85d2-418f75f666f3 | ok |
| A06.19.iniciar_mae_refeito | f5_med_upa | Médico assume Joana (refeito) | ok | (sem retorno: void) | ok |
| A06.19.soap_mae_refeito | f5_med_upa | SOAP de Joana (O91.2) (refeito) | ok | 3e18079c-b2bc-45a3-9fe9-3829b867f428 | ok |
| A06.19.alta_mae_refeito | f5_med_upa | Alta de Joana com orientações (refeito) | ok | (sem retorno: void) | ok |
| A06.19.contas_refeito | f5_fat | Contas de Joana e do RN independentes (refeito depois da alta de Joana) | ok | Joana: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, total 11.00 / RN: 0301060096 qt 1 = 11.00, 0301060118 qt 1 = nulo, total 11.00 | ok |
| A06.16.sem_contrarreferencia_refeito | banco | Episódio do RN encerrado, sem contrarreferência (não veio de UBS) (refeito) | ok | ok: etapa encerrado, desfecho transferencia | ok |

Passos refeitos depois da rodada (o script já foi corrigido):

| Passo | Papel | O que faz | Obtido | Situação |
|---|---|---|---|---|
| A06.05.classificar_mae_refeito | f5_enf_upa | Joana, fluxograma adulto "Mal-estar geral"; a enfermeira de teste classifica verde (agora com FR e SpO2) | 1e211102-6daa-4c59-85d2-418f75f666f3 | ok |
| A06.19.iniciar_mae_refeito | f5_med_upa | Médico assume Joana | (sem retorno: void) | ok |
| A06.19.soap_mae_refeito | f5_med_upa | SOAP de Joana (O91.2) | 3e18079c-b2bc-45a3-9fe9-3829b867f428 | ok |
| A06.19.alta_mae_refeito | f5_med_upa | Alta de Joana com orientações | (sem retorno: void) | ok |
| A06.19.contas_refeito | f5_fat | Contas de Joana e do RN independentes | Joana: 0301060096 R$ 11,00 + 0301060118 nulo = R$ 11,00; RN: o mesmo, R$ 11,00 | ok |
| A06.16.sem_contrarreferencia_refeito | banco | RN encerrado, sem contrarreferência (não veio de UBS) | etapa encerrado, desfecho transferencia | ok |

## Achados

Cada achado diz se é **produto**, **ambiente** (rede de teste F5), **dados** (tabelas carregadas) ou **catálogo** (especificação ou MAPA). **Nenhum P0 e nenhum P1.**

### P2-1 — A segunda dose "Agora" do mesmo medicamento pela mesma via é recusada (produto)
- **Reproduzir:** A05, passo 8. Com a epinefrina IM "Agora" já checada, prescrever de novo epinefrina IM "Agora".
- **Esperado (catálogo):** a segunda dose prescrita conforme a ferramenta ("repetir a cada 5 a 15 min se a resposta não for plena", `ped-anafilaxia-icr`).
- **Obtido:** `P0001: Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.` (`A05.08.segunda_dose`).
- **Contorno que funcionou:** `alterar_item_prescricao` sobre o item da 1ª dose (`A05.08.segunda_dose_alterar`). Vira item novo, perde a liberação (`A05.B.alterado_perde_liberacao` ok), a checagem sem motivo é recusada até o confere (`A05.08.sem_motivo_antes` ok) e passa depois dele (`A05.08.checar_2` ok).
- **Relação:** é o mesmo bloqueio do P2-1 do A01 (ataque e manutenção do magnésio). Aqui pesa mais, porque a repetição da epinefrina é a conduta da ferramenta numa emergência pediátrica. Pergunta para o RT: a regra de "um item por medicamento e via" deve aceitar uma nova dose "Agora" depois que a anterior foi feita?

### P2-2 — Prescrição, dispensação e checagem aceitas com o paciente ainda na triagem (produto; pergunta ao RT)
- **Reproduzir:** A03, rodada 1. A classificação do lactente foi recusada (faltou a escala de dor), então o episódio ficou em `triagem`, sem classificação e sem `iniciar_atendimento`. Em seguida:
  - o médico do PS prescreveu (`prescrever`: ok, item com o peso);
  - o farmacêutico validou e dispensou;
  - a enfermagem checou "feito";
  - a conta ganhou o item "administração de medicamento" antes do acolhimento e da consulta.
- **Esperado:** prescrever só depois de o médico assumir o atendimento. O `registrar_soap` e o `registrar_desfecho` já exigem isso ("Abra o atendimento antes de registrar"; "O episódio não está em atendimento").
- **Obtido:** `prescrever` só confere "médico de plantão no setor do paciente" (`paciente_em_cuidado_no_plantao` + papel `plantonista`). Na mesma rodada, `A03.07.iniciar` foi recusado e `A03.08.hidratacao`, `A03.09.*` e `A03.10.checar` passaram.
- **Evidência:** `e2e.resultados`, passos `A03.*` da rodada 1. Conta `A-2026.000018` da UPA, que ficou em conferência com 1 item 0301100012 (R$ 0,63) e sem acolhimento nem consulta.
- **Pergunta:** pode haver ordem antes do atendimento (urgência, ordem verbal)? Se não, falta a trava de "atendimento iniciado" no `prescrever`.

### P2-3 — A enfermagem dispensa com justificativa mesmo com o farmacêutico de plantão (produto)
- **Reproduzir:** A05. Com o `farmaceutico.f5` escalado e de plantão, o `enfermeiro.upa.f5` roda `dispensar_item(item, 1, 'Farmácia fechada no teste A05 (justificativa)')`.
- **Esperado (catálogo, borda):** a dispensação pela enfermagem só com a farmácia fechada, marcada `sem_farmaceutico` e com justificativa.
- **Obtido:** **ACEITO** (`A05.B.enf_dispensa_com_farmacia_aberta`, registro desfeito). O código só confere papel de enfermagem, `pode_atuar_no_paciente` e justificativa de 10 letras ou mais. Não confere se há farmacêutico de plantão, apesar de o comentário dizer "farmácia fechada". Sem justificativa, a dispensação é recusada (`A05.B.enf_dispensa_sem_justificativa` ok).

### P2-4 — Leitos em higienização somem com a capacidade da rede de teste (ambiente; pergunta operacional)
- **Reproduzir:** A04, rodada 1. Os quatro leitos da Internação da UPA estavam assim: INT-03 ocupado (cenário B06), INT-01, INT-02 e INT-04 em `higienizacao`, deixados por outros cenários depois da alta.
- **Obtido:** a seleção de leito voltou vazia, e as duas internações ficaram bloqueadas (rodada 1 descartada).
- **Saída usada:** na rodada B, o `enfermeiro.internacao.f5` concluiu a higienização de INT-01 e INT-02 pela RPC do produto (`concluir_higienizacao`, passos `A04.10.higienizacao_INT-01/02`). Os mesmos dois leitos voltaram a `higienizacao` depois da alta de Luan e Bia.
- **Recomendação para a rede de teste:** cada cenário conclui a higienização do leito que libera, ou uma rotina de ambiente faz isso entre os cenários.

### P3-1 — "Chegou" sem ficha é aceito pelo servidor (produto)
- **Reproduzir:** A02, parte 2. Com o envio `nao_chegou`, `encaminhamento_upa_marcar_chegada(envio, true, NULL)` como `recepcao.upa.f5`.
- **Obtido:** **ACEITO** (`A02.11.chegou_sem_ficha`, registro desfeito). A trava do PR #438 é só da tela. Pelo servidor, o envio fica `chegou` sem ficha ligada, e a lacuna do MAPA ("Chegou sem ficha não liga depois") se confirma.

### P3-2 — A ficha da escuta vermelha enviada pela enfermeira fica aberta na fila do médico da UBS (produto)
- **Reproduzir:** A02, passo 6. Escuta vermelha com saída `consulta` e, logo depois, `encaminhar_upa` pela enfermeira.
- **Obtido:** o envio é feito, mas o episódio da UBS segue em `atendimento` (`A02.06.fila_medico`). Só o envio a partir da `triagem` encerra a ficha; a escuta não azul já a pôs em `atendimento`. Se a médica não abrir e encerrar pela conduta, a ficha fica para sempre na fila. É o que aconteceu com as duas Martas.
- **Pergunta:** o envio pela própria escuta deveria encerrar a ficha, como o envio da triagem já faz?

### P3-3 — Contrarreferência sem o CID de alta e sem o médico no resumo (produto)
- **Reproduzir:** A03, passo 14. `finalizar_observacao(…, 'alta_medica', 'J21.9', …)` pela médica da observação. Depois a contrarreferência nº 33, aberta pela UBS.
- **Obtido:** no resumo da contrarreferência, `"cid": null, "medico": null, "relato": null`. Só o bloco `registro` (o último SOAP) traz `J21.9`. Na rodada 3 do A01 o resumo também veio com `cid` e `medico` nulos.
- **Esperado:** o CID de alta e o médico que deu a alta no resumo que a UBS lê.

### P3-4 — Descrição errada do J21.9 na tabela CID carregada (dados)
- No `terminologia.cid10` da homologação, `J21.9` está como "Bronquite aguda não especificada". Na CID-10, J21.9 é a **bronquiolite** aguda não especificada; bronquite aguda é o J20. A tela de CID e o BPA mostram esse texto. Pede conferência da carga da tabela.

### P3-5 — Contas vazias da UBS e valor nulo do acolhimento continuam (produto/dados; A01 P3-4 e P3-5)
- Cada ficha da UBS abre uma conta `aberta` e sem itens:
  - Marta B: 4 contas;
  - Théo B: 2 contas;
  - Marta A e Théo A: 3 e 2 contas.
- O acolhimento com classificação (`0301060118`) segue com `valor_total` nulo em todas as contas da UPA.

### Achados de catálogo (ajustar a especificação)
- **C-1 (A02, pré-condição):** a conduta da UBS com o problema `hipertensao_arterial` já inclui a paciente no hiperdia (origem `consulta`). O `programa_incluir` manual depois dela é duplicidade recusada (`A02.00.hiperdia_pela_conduta` e `A02.00.hiperdia_manual`).
- **C-2 (A03 e A05):** a "Observação Adulto, por falta de setor pediátrico" está superada. Desde o 46 há Observação Pediátrica, e o box escolhido foi OP-01 (A03) e OP-02 (A05). Corrigir o MAPA 5.1 e os passos 11 (A03) e 9 (A05).
- **C-3 (A04, passo 8):** `exames_da_unidade` é a lista de exames que a unidade oferece (`{"exames": [], "pode_definir": false}`), não a lista de pedidos (`A04.08.lista`). Os pedidos foram conferidos em `exames_pedidos`.
- **C-4 (A06, passo 12):** o NIR da origem só vê `reg_pendencia` em `nir_pendencias` **depois do prazo** da pendência (3 h), como no P3-2 do A01 com `reg_destino` (`A06.12.nir_ve`). Ainda assim, o NIR anexou o documento e respondeu, e a solicitação voltou a `em_analise`.
- **C-5 (A06, critério):** "com `p_gemelar` 1 e 2 passa" só vale se o primeiro RN do parto também tiver ordem. Com um "RN de Joana" sem ordem já cadastrado, o gemelar 1 da mesma data é recusado (`A06.B.gemelar_mesmo_parto`).
- **C-6 (A04, passo 6; conteúdo clínico, para o RT):** a `ped-bolus` só traz analgesia no grupo "Intubação, sedação e analgesia" (morfina e cetamina; ICr Apêndice). Para o TCE leve com dor no punho de Luan, o único analgésico da ficha pediátrica foi a morfina (alta vigilância). Não há analgésico simples na ficha pediátrica, enquanto a de adulto tem o degrau 1 (dipirona, usada em Bia).
- **C-7 (A03, passo 9):** a `ped-bronquiolite` diz que não há medicamento de rotina na bronquiolite. Para exercitar farmácia e checagem, o item dispensado foi a hidratação EV que a ferramenta cita (Australásia 2025, rec. 20), com o O₂ como item de cuidado.
- **C-8 (A05, critério):** a medicação gera **uma** linha no dia, com quantidade igual ao número de administrações: aqui qt 3, com duas doses de epinefrina e o cristaloide (`A05.08.medicacao_na_conta`). É o mesmo do P3-6 do A01.

### Confirmado, sem achado
- O corte de 14 anos governa a triagem: fluxograma de outro público recusado nos dois sentidos, e `publico_pela_idade` pediátrico para Luan e adulto para Bia, no mesmo plantão.
- O corte governa também o Fugulin: grava para Bia e recusa Luan e o lactente com "instrumento do adulto".
- **Decisão do RT de 06/11/2026 já está na homologação:** o médico da porta que pôs Sofia em observação encerrou a observação sem estar escalado nela (`A05.11.alta_pelo_medico_da_porta`, alta por `…08`).
- Neonato e incubadora:
  - transferência de neonato sem incubadora é recusada; com ela, passa;
  - o RN conta como identificado pelo CNS da mãe (`paciente_nao_identificado = false`);
  - os vínculos trazem a mãe.
- No hospital:
  - a chegada regulada não cria internação;
  - a ficha da porta cria um cadastro novo do RN, com `nome_mae` e sem `mae_id`;
  - `leitos_para_ocupar` oferece o leito reservado, e a reserva vira "ocupada" na internação.
- Na UBS:
  - a puericultura não conta o episódio da UPA (consultas = 1 antes e depois);
  - a UBS não gera valor nem BPA.
- O cron real `encaminhamento-upa-prazo` marcou `nao_chegou` na volta seguinte ao ajuste do prazo e mandou o aviso para a UBS.
- Na regulação do A06, os 9 eventos tiveram cada um o autor do próprio login.

## Custos que o sistema registrou

Os valores vêm do SIGTAP carregado (competência 202609). Nenhum valor foi digitado; os valores fictícios do catálogo não foram gravados. Medicamentos, material, exames, transporte e permanência entram **sem valor** (lacuna do MAPA).

| Cenário | Conta | Status | Itens com valor | Total de referência |
|---|---|---|---|---|
| A02 | UPA `A-2026.000029` (Marta B) | aberta (Marta na triagem) | nenhum item | R$ 0,00 |
| A02 | UBS (4 contas de Marta B) | abertas | nenhum (a UBS não gera conta com valor nem BPA) | R$ 0,00 |
| A03 | UPA `A-2026.000020` (Théo B) | **fechada** | consulta 0301060096 R$ 11,00; acolhimento 0301060118 nulo; medicação 0301100012 qt 1 R$ 0,63. Glicose: 2 bolsas dispensadas, sem valor | **R$ 11,63** |
| A04 | UPA `A-2026.000024` (Luan B) | aberta | consulta R$ 11,00; acolhimento nulo; medicação qt 1 R$ 0,63 | **R$ 11,63** |
| A04 | UPA `A-2026.000025` (Bia B) | aberta | o mesmo | **R$ 11,63** |
| A04 | UPA `I-2026.000004` e `I-2026.000005` (internações, `conta_origem_id` = a conta da porta de cada um) | abertas | nenhum (sem AIH; radiografias sem valor) | R$ 0,00 |
| A05 | UPA `A-2026.000026` (Sofia) | **fechada** | consulta R$ 11,00; acolhimento nulo; medicação qt 3 = R$ 1,89. Medicamentos: 4 dispensações sem valor | **R$ 12,89** |
| A06 | UPA `A-2026.000027` (Joana) | aberta | consulta R$ 11,00; acolhimento nulo | **R$ 11,00** |
| A06 | UPA `A-2026.000028` (RN) | aberta | consulta R$ 11,00; acolhimento nulo | **R$ 11,00** |
| A06 | Hospital `A-2026.000003` (porta) e `I-2026.000003` (internação do RN no CM-04) | abertas | nenhum (sem SIGTAP associado no hospital, P3-7 do A01; sem AIH) | R$ 0,00 |

- **BPA da UPA (competência 202611):**
  - Théo B: 3 linhas `bpa_c`, consolidadas por falta de CNS, com o aviso "Paciente sem CNS nem CPF válido" e sem crítica;
  - Sofia: 3 linhas sem crítica, com medicação qt 3.
- **Estoque da UPA (o saldo pode ficar negativo, como previsto):**
  - glicose: 20 bolsas de entrada (rodadas 1 e B), 4 dispensadas;
  - morfina: −2;
  - adrenalina: −2;
  - cloreto de sódio 500 mL: −1;
  - salbutamol: −1.

## O que só se confere na tela (fica para o Chrome)
- **UBS:**
  - `/hiperdia` com as pendências de consulta e PA de mais de 6 meses (regra em `src/domain/hiperdia.ts`) e a tela só de leitura do técnico;
  - `HiperdiaNaConsulta.tsx` com a avaliação dos pés "não se aplica";
  - `/puericultura` com o teto 60/100;
  - a escolha do grupo pediátrico na escuta (`EscutaInicial.tsx`);
  - `/encaminhados` com `nao_chegou` e a contrarreferência.
- **UPA, recepção:**
  - `VindoDaUbs.tsx` não permite "Chegou" sem ficha (o servidor aceita, P3-1);
  - `FormRn` (`CadastroRn.tsx`).
- **Triagem:**
  - o app oferece o grupo pediátrico ou adulto pela data de nascimento;
  - nenhum texto de "sugerido" na cor;
  - o discriminador. O script usa o primeiro discriminador da cor no fluxograma (`e2e.disc`), sem valor clínico. Na tela, a enfermeira escolhe.
- **Central de fichas:**
  - `ped-bronquiolite` e `ped-sinais-vitais-icr` abertas para o lactente;
  - `ped-pecarn-maior2-icr` e `ped-glasgow-icr` para Luan, com os escores de trauma do adulto em "não se aplica" (< 14 anos);
  - `canadian-ct-head`, `glasgow` e `adulto-triage-rts` para Bia, com as `ped-*` bloqueadas;
  - `ped-anafilaxia-icr` e `ped-ictericia-neonatal` (idade em horas);
  - o bloqueio de ficha `adulto-*` para o paciente pediátrico.
- **Enfermagem:**
  - a nota "Fugulin é instrumento do adulto… (Dini) ainda não está no produto" em `AbasRegistro.tsx`;
  - o `CartaoFugulin` de Bia;
  - o NEWS2, que não se aplica a Luan.
- **A04, passo 13 (virada do dia):** não executável na mesma rodada. Exige 08/11, com Luan já com 14a 0d, e o catálogo dá alta aos dois no passo 14. A conferência da Central e do Fugulin no dia seguinte fica para a tela ou para uma rodada própria.
- **Documentos:** receita e atestado de Sofia, assinados pelo login (sem ICP-Brasil); o pacote de alta `/alta/:token` de Luan e Bia; os sinais vitais crus na impressão.
- **Regulação:** a solicitação do RN mostrando o documento da mãe; o anexo de arquivo pelo Storage (aqui foi anexado um documento do prontuário).

## O que ficou gravado na homologação

Esperado pelas rodadas, com dados fictícios e nomes de teste:
- **Ambiente (permanente, pelo 49a):** 3 contas novas (`…0a1`, `…0a2`, `…0a3`) com vínculos, CNS, CBO e escala até 13/11.
- **A02:**
  - Marta A02 Teste (rodada 1) e Marta A02 Teste B na UBS, cada uma no hiperdia e no pré-natal;
  - a consulta antiga de cada uma levada 200 dias para trás (ajuste `A02.00.datas`);
  - o envio nº 25 (rodada 1, `nao_chegou`) e o nº 26 (rodada B, `chegou`, ligado à ficha da UPA);
  - os prazos dos envios 25 e 26 foram antecipados 12 h 05 min por `UPDATE` (ajuste `A02.08.antecipa_prazo`).
- **A03:**
  - Théo A03 Teste (rodada 1) e Théo A03 Teste B na UBS e na UPA;
  - a 1ª consulta de cada um levada ao 20º dia de vida;
  - os envios nº 27 e nº 28 (`chegou`);
  - a contrarreferência nº 33 (`visto`);
  - a conta de Théo B fechada.
- **A04:** Luan e Bia (rodadas 1 e B), todos com alta. Os da rodada B passaram pela internação, com Fugulin de Bia, laudos fictícios das radiografias e pacote de alta.
- **A05:** Sofia com alta, receita nº 2026/000014, atestado nº 2026/000015 e a conta fechada.
- **A06:**
  - Joana com alta;
  - o "RN de Joana A06 Teste" na UPA (encerrado por transferência);
  - a regulação nº 109 `realizada`, com incubadora, pendência respondida, anexo e 9 eventos.

**De forma inesperada, ou que precisa de atenção:**
- **Episódios abertos:**
  - **Marta A02 Teste B segue na triagem da UPA:** o catálogo termina na chegada e no "Chegou";
  - **as duas Martas seguem com a ficha da escuta vermelha aberta na fila da médica da UBS** (P3-2).
- **Hospital:** o **RN de Joana A06 Teste está internado no leito CM-04** (ativo), com as contas da porta e da internação abertas.
- **Leitos:**
  - INT-01, INT-02 e INT-04 em higienização. INT-01 e INT-02 foram liberados por este bloco (`concluir_higienizacao`, eram de outros cenários) e voltaram a higienização depois da alta de Luan e Bia;
  - OP-01 e OP-02 em higienização (A03 e A05).
- **Contas e estoque:**
  - a conta UPA `A-2026.000018` (Théo da rodada 1) ficou **em conferência**, com só o item de medicação (P2-2);
  - **estoque da UPA negativo** (morfina, adrenalina, cloreto de sódio 500 mL e salbutamol, ver Custos), e 20 bolsas de glicose de entrada.
- **Agenda da médica da UBS:** um agendamento cancelado (Marta A, para 07h00) e um realizado (Marta B, para 07h00) em 07/11.
- **Funções do esquema `e2e`:**
  - criadas: `ba`, `ba_passo`, `ba_banco`, `ba_ajuste`, `ba_registra`, `ba_sinais`, `ba_sql_passado` e `conta_a`;
  - recriadas com o mesmo corpo do 50: `confere`, `falhar`, `guardar` e `cns`;
  - `e2e.passo` e `e2e.conta` não foram tocadas.

## Arquivos
- `scripts/e2e/49a_ambiente_bloco_a.sql`: ajuste do ambiente para o bloco A (Observação Pediátrica e enfermagem da Internação).
- `scripts/e2e/52_cenario_a02.sql`: A02, parte 1 (até o envio e a antecipação do prazo).
- `scripts/e2e/52b_cenario_a02_prazo.sql`: A02, parte 2 (depois do cron).
- `scripts/e2e/53_cenario_a03.sql`, `54_cenario_a04.sql`, `55_cenario_a05.sql` e `56_cenario_a06.sql`: os demais cenários. São repetíveis: cada rodada cria pacientes novos ("… B", "… C") e encerra o que a rodada anterior deixou parado (A03, A04).
- `docs/teste-rede/EXECUCAO-A02-A06.md`: este relatório.
