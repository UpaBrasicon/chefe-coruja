# Execução do cenário A01 na homologação

Cenário A01 do catálogo (`CENARIOS-A-materno-infantil.md`): pré-natal na UBS → pré-eclâmpsia grave e eclâmpsia na UPA → regulação ao hospital → contrarreferência e conta. Teste de **fluxo**, com dados fictícios. Nenhuma dose foi escrita de memória e nada foi corrigido no produto durante a rodada.

## Data, hora e ambiente

- **Rodada válida (rodada 2):** 06/11/2026, das 18h19 às 18h20, horário de Brasília (21h19 UTC). Paciente fictícia **"Gestante A01 Teste B"**, CNS fictício `700900000637145` (gerado por `e2e.cns`), nascida em 10/05/1997, DUM = hoje − 230 dias (21/03/2026).
- **Ambiente:** homologação, Supabase `kswurfyxxvfydpjfrivy` (conferido em `supabase/.temp/project-ref`), rede de teste F5. A produção não foi tocada.
- **Como rodou:** `41_checkin_fase5.sql` (check-in dos plantões da tarde), `47_framework_ampliacao.sql` e `50_cenario_a01.sql`, todos preparados por `scripts/e2e/homolog/preparar.mjs` e executados com `npx supabase db query --linked -f`. O script inteiro roda numa transação só, e cada passo roda **como a conta do papel** (role `authenticated` com as claims do JWT, RLS ligado), pelas mesmas RPCs das telas.
- **Rodada 1 (descartada):** às 18h16, paciente "Gestante A01 Teste". Teve três erros **do script**, não do produto: os três agendamentos caíram no mesmo horário, `prescricao_porta_ativa` foi usada na porta e o BPA foi procurado pelo CNS. O script foi corrigido e rodou de novo. Os resultados da rodada 1 continuam em `e2e.resultados` (`em < e2e.v('a01_inicio')`), e os dados dela estão listados no fim deste relatório.
- **Correção depois da rodada 2:** o passo `A01.11.cor` rodou como a enfermeira. O RLS escondeu a linha de `classificacoes_risco`, a consulta voltou vazia e o passo deu "ok" sem conferir nada. Por isso a conferência foi refeita no banco (`A01.11.cor_banco`), e o script agora faz essa conferência como `banco`.

> **Rodada 3 (ambiente ajustado), no fim deste relatório:** com o 48, os P1-1 e P1-2 foram resolvidos pelo ambiente e o A01 foi até o fim (AIH aprovada, conta da UPA faturada).

## Resumo

| Situação | Quantidade |
|---|---|
| ok | 117 (inclui a re-conferência `A01.11.cor_banco`) |
| falha | 10 |
| lacuna | 25 (9 do MAPA, 15 bloqueadas por passo anterior e 1 "chegada regulada não interna") |
| ajuste | 4 (datas passadas das 4 consultas do pré-natal) |

O caminho UBS → UPA → regulação funcionou de ponta a ponta até a **chegada** ao hospital (`realizada`, 7 eventos, um por transição, cada um com o autor = login). Duas falhas cortaram o resto:
- **Passo 24:** ninguém da rede F5 consegue encerrar a observação, porque nenhum médico está escalado na Observação Adulto. Sem esse encerramento não há contrarreferência para a UBS, e a conta da UPA não fecha nem é faturada.
- **Passo 26:** o Hospital F5 não tem porta, e o produto não tem outro caminho para abrir paciente ou ficha. Sem a ficha não há internação no hospital nem AIH.

## Tabela dos passos (rodada 2)

Ids `A01.NN.*` na ordem da especificação. A única exceção é o passo 16, que roda **depois** do 17: o único item de alta vigilância ainda sem liberação da farmácia é o item que o médico altera no passo 17. "banco" é conferência feita como postgres, de algo que a tela não mostra.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A01.00.agenda | f5_ges_ubs | Gestor da UBS configura a agenda da médica (manhã, tarde e noite, 20 min), para haver horário ainda hoje | ok | (sem retorno: void) | ok |
| A01.00.bpa_classificacao | f5_fat | Faturamento associa o SIGTAP 0301060118 ao uso classificacao na UPA | ok | 8ddfb82c-b833-48dd-97fc-1b0c0f628a27 | ok |
| A01.00.bpa_atendimento_medico | f5_fat | Faturamento associa o SIGTAP 0301060096 ao uso atendimento_medico na UPA | ok | 277393e2-c30d-41cb-9fc4-9b09f5e8861a | ok |
| A01.00.bpa_medicacao | f5_fat | Faturamento associa o SIGTAP 0301100012 ao uso medicacao na UPA | ok | 9f1d767a-3cb9-4235-b038-dfc28d51ebf6 | ok |
| A01.00.alta_vigilancia | f5_farm | Farmacêutico confere que o sulfato de magnésio é alta vigilância na UPA | ok | ok: [{"id": "0b13f981-90da-4237-93d7-d118d2055cfa", "exige": true, "regra": "Sulfato de magnésio injetável", "ajuste": null, "cadastro": true, "apresentacao": "solução in… | ok |
| A01.01.ficha | f5_rec_ubs | Recepção cadastra a gestante e abre a ficha consulta_programada (1ª consulta do pré-natal) | ok | c30e77bd-21c8-4122-b222-5c774af64b12 | ok |
| A01.01.paciente | f5_rec_ubs | Paciente da ficha | ok | 0dd82b62-15db-4d90-a599-b783b555dfec | ok |
| A01.01.tipo_aps | f5_rec_ubs | Episódio aberto na UBS como consulta_programada | ok | ok: tipo consulta_programada, etapa atendimento | ok |
| A01.01.ubs_sem_valor | f5_ges_ubs | A conta da UBS (se houver) não ganha item com valor | ok | ok: UBS sem item com valor | ok |
| A01.02.tecnico_nao_escuta | f5_tec_ubs | Técnico tenta fazer a escuta (deve ser recusado) | erro:A escuta inicial e a classificação são do enfermeiro | recusado: A escuta inicial e a classificação são do enfermeiro. | ok |
| A01.02.escuta | f5_enf_ubs | Enfermeira faz a escuta com sinais crus e saída consulta (cor verde: escolha da enfermeira de teste, o cenário não indica) | ok | Este paciente não está aguardando a escuta inicial. | **falha** |
| A01.03.atender | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A01.03.sinais | f5_med_ubs | Sinais crus da consulta: PA, peso e altura em cm | ok | 4 sinais gravados | ok |
| A01.03.soap | f5_med_ubs | SOAP da 1ª consulta com CID de gestação (Z34.9) | ok | f83ec158-ebb8-4e4f-86fb-ce3fdabffceb | ok |
| A01.03.pre_natal | f5_med_ubs | Inclui no pré-natal com a DUM, ligado à consulta | ok | 8730dab1-9d2f-4650-b506-773374402b87 | ok |
| A01.03.conduta | f5_med_ubs | Encerra com problema pré-natal, CID Z34.9 e CIAP W78 | ok | (sem retorno: void) | ok |
| A01.03.datas | — | Consulta 1 levada à IG de 10 semanas (DUM + 70 d): datas do episódio e dos sinais no passado | ajuste | datas do episódio e dos sinais deslocadas (UPDATE como postgres) | ajuste |
| A01.03.primeira | f5_enf_ubs | pre_natal_do_paciente mostra a 1ª consulta até 12 semanas | ok | ok: primeira 2026-05-30, DUM 2026-03-21 | ok |
| A01.04.marcar_ig16 | f5_rec_ubs | Recepção marca a consulta do pré-natal (IG 16 s) para 19:00 | ok | 9071cdf7-738d-4ccd-8d82-114f11d0cd74 | ok |
| A01.04.chegada_ig16 | f5_rec_ubs | Recepção registra a chegada (abre episódio consulta_agendada/programada) | ok | de7878e5-7be4-4faf-97cc-fc79eda34b28 | ok |
| A01.05.atender_ig16 | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A01.05.sinais_ig16 | f5_med_ubs | PA, peso e altura crus | ok | 4 sinais gravados | ok |
| A01.05.soap_ig16 | f5_med_ubs | SOAP com a PA no Objetivo | ok | 86257ced-1d57-4178-a116-7c47fa7c159d | ok |
| A01.05.conduta_ig16 | f5_med_ubs | Encerra a consulta do pré-natal | ok | (sem retorno: void) | ok |
| A01.04.realizado_ig16 | f5_rec_ubs | O agendamento passa a realizado | ok | ok: situação realizado | ok |
| A01.05.datas_ig16 | — | Consulta levada à IG de 16 semanas (DUM + 112 d) | ajuste | datas do episódio e dos sinais deslocadas (UPDATE como postgres) | ajuste |
| A01.04.marcar_ig22 | f5_rec_ubs | Recepção marca a consulta do pré-natal (IG 22 s) para 19:40 | ok | 28258031-9455-49b8-a69d-4b36218d8b78 | ok |
| A01.04.chegada_ig22 | f5_rec_ubs | Recepção registra a chegada (abre episódio consulta_agendada/programada) | ok | a54a69ee-ed84-43a2-a44a-c0014eecf642 | ok |
| A01.05.atender_ig22 | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A01.05.sinais_ig22 | f5_med_ubs | PA, peso e altura crus | ok | 4 sinais gravados | ok |
| A01.05.soap_ig22 | f5_med_ubs | SOAP com a PA no Objetivo | ok | fabdf73e-727d-4725-a599-013b39ea73cb | ok |
| A01.05.conduta_ig22 | f5_med_ubs | Encerra a consulta do pré-natal | ok | (sem retorno: void) | ok |
| A01.04.realizado_ig22 | f5_rec_ubs | O agendamento passa a realizado | ok | ok: situação realizado | ok |
| A01.05.datas_ig22 | — | Consulta levada à IG de 22 semanas (DUM + 154 d) | ajuste | datas do episódio e dos sinais deslocadas (UPDATE como postgres) | ajuste |
| A01.04.marcar_ig28 | f5_rec_ubs | Recepção marca a consulta do pré-natal (IG 28 s) para 20:20 | ok | 1dd60679-a4a8-41b0-bf3c-b5b178340d32 | ok |
| A01.04.chegada_ig28 | f5_rec_ubs | Recepção registra a chegada (abre episódio consulta_agendada/programada) | ok | a5c3ae02-6627-46a4-ab11-55f29f9c9c9d | ok |
| A01.05.atender_ig28 | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A01.05.sinais_ig28 | f5_med_ubs | PA, peso e altura crus | ok | 4 sinais gravados | ok |
| A01.05.soap_ig28 | f5_med_ubs | SOAP com a PA no Objetivo | ok | 0904912d-ce3f-4536-b604-8dcfd12dd951 | ok |
| A01.05.conduta_ig28 | f5_med_ubs | Encerra a consulta do pré-natal | ok | (sem retorno: void) | ok |
| A01.04.realizado_ig28 | f5_rec_ubs | O agendamento passa a realizado | ok | ok: situação realizado | ok |
| A01.05.datas_ig28 | — | Consulta levada à IG de 28 semanas (DUM + 196 d) | ajuste | datas do episódio e dos sinais deslocadas (UPDATE como postgres) | ajuste |
| A01.05.painel_paciente | f5_med_ubs | Painel da gestante: consultas, PA e peso/altura com as datas | ok | ok: consultas 4, pa 4, peso_altura 4, datas ["2026-05-30", "2026-07-11", "2026-08-22", "2026-10-03"] | ok |
| A01.06.painel | f5_ges_ubs | Gestor vê a gestante no painel do pré-natal da unidade | ok | {"id": "8730dab1-9d2f-4650-b506-773374402b87", "pa": 4, "dpp": "2026-12-26", "dum": "2026-03-21", "nome": "Ges… | ok |
| A01.06.recepcao_sem_painel | f5_rec_ubs | Recepção não vê o painel do pré-natal (deve ser recusado) | erro | recusado: O pré-natal é visto pelo médico, pela enfermagem e pelo gestor da UBS. | ok |
| A01.07.ficha | f5_rec_ubs | Recepção abre a ficha de escuta inicial de hoje | ok | 5c8021de-e06b-492c-8760-db299dc36898 | ok |
| A01.07.escuta | f5_enf_ubs | Escuta com PA elevada, cefaleia e edema (crus); a enfermeira de teste classifica vermelho; saída consulta | ok | e7fe9027-c0c0-4d81-835e-dc014210a9e3 | ok |
| A01.08.atender | f5_med_ubs | Médica abre o atendimento | ok | (sem retorno: void) | ok |
| A01.08.soap | f5_med_ubs | SOAP com hipótese de pré-eclâmpsia grave (O14.1) | ok | 8f4b41b8-fd04-4f1a-9635-215dd4a3854f | ok |
| A01.08.enviar | f5_med_ubs | Envia à UPA F5 com motivo | ok | fdcb8100-0a6e-4776-b8dc-0f415253b597 | ok |
| A01.08.conduta | f5_med_ubs | Encerra a consulta da UBS com encaminhamento para urgência (CIAP W81) | ok | (sem retorno: void) | ok |
| A01.09.encaminhados | f5_ges_ubs | Linha "enviado" com hora | ok | ok: situação enviado, enviado em 2026-11-06T21:19:23.610775+00:00 | ok |
| A01.10.vindo | f5_rec_upa | Vê a gestante vinda da UBS com queixa, cor da escuta, SOAP e sinais | ok | ok: {"id": "fdcb8100-0a6e-4776-b8dc-0f415253b597", "motivo": "Suspeita de pré-eclâmpsia grave: PA 168x112, cefaleia e edema (teste A01)", "numero": 22, "resumo": {"soap":… | ok |
| A01.10.ficha | f5_rec_upa | Recepção da UPA abre a ficha no Pronto Socorro (prioridade gestante) | ok | fe219f30-a646-4a8f-b00d-7e09cb7bb1d4 | ok |
| A01.10.paciente | f5_rec_upa | Paciente da UPA | ok | 9c56e76c-9999-4352-9278-cfd8f94c7fae | ok |
| A01.10.chegou | f5_rec_upa | Marca "Chegou" com a ficha escolhida | ok | {"id": "fdcb8100-0a6e-4776-b8dc-0f415253b597", "motivo": "Suspeita de pré-eclâmpsia grave: PA 168x112, cefalei… | ok |
| A01.10.conta | f5_fat | Conta ambulatorial aberta, sem itens | ok | ba82a5e6-3dc3-46fe-a1e3-8d94252e7aba | ok |
| A01.11.chamar | f5_enf_upa | Enfermeira chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| A01.11.fluxograma_gestante | f5_enf_upa | Fluxograma "Gestante" na triagem | existir | Lacuna (MAPA): o protocolo Aparecida 2025 não tem fluxograma obstétrico; a enfermeira usa "Dor de cabeça" (adulto) e escreve o discriminador (livre), porque os vermelhos do fluxograma são só "Convulsão ativa" e "Sinais de choque". | lacuna |
| A01.11.classificar | f5_enf_upa | Classifica vermelho (escolha da enfermeira de teste), sinais crus, fluxograma adulto e bloco de gestação G2P1A0 com DUM | ok | cffa7f5f-b33d-4bf6-adaa-5af20c69157b | ok |
| A01.11.cor | f5_enf_upa | A cor gravada é a da enfermeira e o bloco de gestação calcula a IG | ok | (vazio: o RLS escondeu a linha; ver A01.11.cor_banco) | ok |
| A01.11.conta_acolhimento | f5_fat | Item "acolhimento com classificação" nasce na conta | ok | ok: [{"em": "2026-11-06T21:19:23.610775+00:00", "cbo": "223505", "cid": null, "nome": "ACOLHIMENTO COM CLASSIFICAÇÃO DE RISCO", "avisos": [{"texto": "Endereço incompleto … | ok |
| A01.12.iniciar | f5_med_upa | Médico assume o atendimento | ok | (sem retorno: void) | ok |
| A01.12.enf_nao_reclassifica | f5_enf_upa | Enfermeira tenta reclassificar depois que o médico assumiu (deve ser recusado) | erro:O atendimento médico já começou | recusado: O atendimento médico já começou: agora só o médico reclassifica. | ok |
| A01.12.sem_peso | f5_med_upa | Prescrição sem peso do atendimento é recusada pelo servidor | erro:Falta para prescrever | recusado: Falta para prescrever: peso deste atendimento (aferido ou estimado). | ok |
| A01.12.peso_referido | f5_med_upa | Médico registra o peso referido pela paciente | ok | 1 sinais gravados | ok |
| A01.12.soap | f5_med_upa | SOAP com CID de pré-eclâmpsia grave (O14.1) | ok | 6dea62f5-c0a3-4267-b566-0e92ff3f736b | ok |
| A01.12.ficha_obstetrica | f5_med_upa | Ficha própria de pré-eclâmpsia, eclâmpsia ou sulfato de magnésio na Central | existir | Lacuna (MAPA): só o bloco dentro de adulto-emergencia-hipertensiva (/plantonista/emergencias/emergencia-hipertensiva-adulto); conferência na tela. | lacuna |
| A01.12.meows | f5_med_upa | Escore obstétrico (MEOWS) | existir | Lacuna (MAPA): não existe; news2 diz que não se aplica à gestante (conferir a mensagem na tela). | lacuna |
| A01.12.conta_consulta | f5_fat | Item "consulta médica" nasce na conta | ok | ok: [{"em": "2026-11-06T21:19:23.610775+00:00", "cbo": "225125", "cid": null, "nome": "ATENDIMENTO MEDICO EM UNIDADE DE PRONTO ATENDIMENTO", "avisos": [{"texto": "Endereç… | ok |
| A01.13.magnesio_ataque | f5_med_upa | Sulfato de magnésio, ataque, "Agora"; dose = texto de teste (conforme adulto-emergencia-hipertensiva) | ok | 56803c08-c12c-43e6-a43b-adfa4894caed | ok |
| A01.13.magnesio_manutencao | f5_med_upa | Sulfato de magnésio, manutenção, "Contínuo", junto com o ataque (mesma via) | ok | Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar. | **falha** |
| A01.13.hidralazina | f5_med_upa | Hidralazina "Se necessário"; dose = texto de teste (conforme adulto-emergencia-hipertensiva) | ok | 60a55fb1-7caf-4ab1-aef1-b69d78303cfc | ok |
| A01.13.itens_ativos | banco | Itens ativos na prescrição da porta, com o peso referido do atendimento | ok | ok: 2 itens: Sulfato de magnésio solução injetável, ampola 10 mL [Agora, conforme protocolo — dado fictício de teste de fluxo]; Hidralazina solução injetável, ampola 1 mL… | ok |
| A01.14.fila | f5_farm | O magnésio aparece na fila como alta vigilância | ok | ok: na fila com alta vigilância | ok |
| A01.14.enf_nao_valida | f5_enf_upa | Enfermeira tenta validar (deve ser recusado) | erro:A validação é do farmacêutico | recusado: A validação é do farmacêutico da unidade. | ok |
| A01.14.validar_mg | f5_farm | Farmacêutico valida e libera o magnésio (confere) | ok | (sem retorno: void) | ok |
| A01.14.validar_hid | f5_farm | Farmacêutico valida a hidralazina (confere) | ok | (sem retorno: void) | ok |
| A01.14.dispensar_mg | f5_farm | Dispensa o magnésio (1 unidade de consumo, sem valor) | ok | {"id": "e510db3c-daf4-41d7-9f7d-874b74d988e5", "saldo": -2, "estoque_negativo": true, "sem_farmaceutico": fals… | ok |
| A01.14.dispensar_hid | f5_farm | Dispensa a hidralazina (1 unidade de consumo, sem valor) | ok | {"id": "673c047c-0dc3-4c70-828d-faa63d189aa9", "saldo": -2, "estoque_negativo": true, "sem_farmaceutico": fals… | ok |
| A01.14.validacao | banco | validacoes_prescricao registra confere para o magnésio | ok | ok: validação gravada | ok |
| A01.14.conta_medicamentos | f5_fat | Medicamentos dispensados entram na conta da porta sem valor | ok | ok: [{"aviso": "Dispensado e nunca administrado.", "item_id": "60a55fb1-7caf-4ab1-aef1-b69d78303cfc", "liquido": 1, "fora_por": null, "devolvido": 0, "dispensado": 1, "pr… | ok |
| A01.15.aprazar | f5_enf_upa | Enfermeira apraza a dose de ataque para agora | ok | (sem retorno: void) | ok |
| A01.15.checar_ataque | f5_enf_upa | Checa "feito" a dose de ataque (liberada pela farmácia) | ok | 164ae08b-d00d-4ec6-94b3-ef5145fed5e0 | ok |
| A01.15.checar_manutencao | f5_enf_upa | Checa "feito" a 1ª dose de manutenção | existir | bloqueado pelo passo A01.13.magnesio_manutencao (sem a01_item_mg_manut) | lacuna |
| A01.15.sinais | f5_enf_upa | Sinais crus de monitoramento (PA, FR, diurese) | ok | 4 sinais gravados | ok |
| A01.15.dupla_checagem | f5_enf_upa | Dupla checagem com tela | existir | Lacuna (MAPA 2.7): conferir_alta_vigilancia existe no banco, sem tela; substituída pela liberação da farmácia. | lacuna |
| A01.15.autor | banco | A administração tem autor = login da enfermeira | ok | ok: autor f5200000-0000-4000-8000-000000000007, sem_liberacao false | ok |
| A01.15.conta_medicacao | f5_fat | Item "administração de medicamento" nasce na conta | ok | ok: [{"em": "2026-11-06T21:19:23.610775+00:00", "cbo": "225125", "cid": null, "nome": "ATENDIMENTO MEDICO EM UNIDADE DE PRONTO ATENDIMENTO", "avisos": [{"texto": "Endereç… | ok |
| A01.17.reavaliacao | f5_med_upa | Reavaliação: crise convulsiva (eclâmpsia), sinais crus | ok | 9af65d30-92e6-4f14-991f-cc92a69ebbb4 | ok |
| A01.17.sinais | f5_med_upa | Sinais crus da reavaliação | ok | 4 sinais gravados | ok |
| A01.17.soap | f5_med_upa | SOAP atualizado para eclâmpsia (O15.0) | ok | 095817ad-3271-4fe1-aa11-a17a1316b006 | ok |
| A01.17.alterar | f5_med_upa | Ajusta o magnésio para manutenção contínua (texto de teste, conforme TOXICIDADE_MAGNESIO da ficha); vira item novo para a farmácia | ok | 4e3f04da-dffd-48f2-91bc-07bff8f6c136 | ok |
| A01.17.autor | banco | O item novo tem autor = login do médico | ok | ok: autor f5200000-0000-4000-8000-000000000008 | ok |
| A01.16.sem_motivo | f5_enf_upa | Checar o item novo sem liberação e sem motivo (deve ser recusado) | erro:Alta vigilância sem liberação | recusado: Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois. | ok |
| A01.16.com_motivo | f5_enf_upa | Checar com motivo de 10+ letras: passa marcado sem liberação | ok | d59a9a13-7e1d-49b6-95b6-b4a4128522a7 | ok |
| A01.16.marcado | banco | A administração fica sem_liberacao = true | ok | ok: sem_liberacao true | ok |
| A01.16.farmaceutico_ve | f5_farm | O farmacêutico vê a administração sem liberação | ok | ok: na lista do farmacêutico | ok |
| A01.18.observacao | f5_med_upa | Desfecho observação (box livre da Observação Adulto) | ok | (sem retorno: void) | ok |
| A01.18.internacao | f5_med_upa | Internação de observação aberta pelo desfecho | ok | 7a657fb9-b49d-451d-8c2b-d1f268eef52d | ok |
| A01.18.pendencia_6h | banco | Box da Observação Adulto e pendência de 6 h | ok | ok: setor Observação Adulto, box OA-02 | ok |
| A01.18.painel | f5_med_upa | Painel da observação mostra a gestante com prazo | ok | confere: no painel | **falha** |
| A01.19.sinais | f5_enf_upa | Sinais vitais seriados crus no box | ok | SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente.; SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no set… | **falha** |
| A01.19.sae | f5_enf_upa | SAE da gestante em observação | ok | Acesso negado: você não está de plantão no setor deste paciente. | **falha** |
| A01.19.balanco | f5_enf_upa | Balanço: diurese (valor cru) | ok | Acesso negado: você não está de plantão no setor deste paciente. | **falha** |
| A01.19.balanco_tecnico | f5_tec_upa | Técnico escalado na Observação Adulto lança a diurese (conferência de escala) | ok | 3a79a6b9-750f-48d4-8929-c03926e0bcc0 | ok |
| A01.20.sem_transporte | f5_med_upa | Transferência sem transporte (deve ser recusada) | erro | recusado: Confira o pedido: tipo e o campo do tipo (especialidade, tipo de leito, transporte), isolamento, internação psiquiátrica, destino, caráter, prioridade e quadro clínico (mínimo de 20 letras). | ok |
| A01.20.quadro_curto | f5_med_upa | Quadro clínico com menos de 20 letras (deve ser recusado) | erro | recusado: Confira o pedido: tipo e o campo do tipo (especialidade, tipo de leito, transporte), isolamento, internação psiquiátrica, destino, caráter, prioridade e quadro clínico (mínimo de 20 letras). | ok |
| A01.20.solicitar | f5_med_upa | Solicita transferência: emergência, gestante, SIGTAP 0303100028, CID O15.0, transporte avançado | ok | a0a97e60-1757-457d-9e78-a4b078d546c0 | ok |
| A01.20.enviada | banco | Solicitação enviada para a Central F5, com o evento | ok | ok: status enviada, nº 94 | ok |
| A01.21.fila | f5_regulador | O pedido está na fila da central | ok | ok: na fila | ok |
| A01.21.assumir | f5_regulador | Regulador assume | ok | {"id": "a0a97e60-1757-457d-9e78-a4b078d546c0", "cbo": null, "cid": "O15.0", "sla": {"fila": {"atrasado": false… | ok |
| A01.21.priorizar | f5_regulador | Prioriza como emergência | ok | {"id": "a0a97e60-1757-457d-9e78-a4b078d546c0", "cbo": null, "cid": "O15.0", "sla": {"fila": {"atrasado": false… | ok |
| A01.21.autorizar | f5_regulador | Autoriza com destino Hospital F5 | ok | {"id": "a0a97e60-1757-457d-9e78-a4b078d546c0", "cbo": null, "cid": "O15.0", "sla": {"fila": {"atrasado": false… | ok |
| A01.21.prioridades | banco | aguardando_destino; prioridade do regulador separada da proposta | ok | ok: status aguardando_destino, proposta emergencia, regulador emergencia | ok |
| A01.22.pendencia | f5_nir | NIR da UPA vê a pendência reg_destino enquanto o hospital não responde | ok | confere: {"agora": "2026-11-06T21:19:23.610775+00:00", "itens": [{"tipo": "aih_sem_aih", "desde": "2026-11-03T19:17:28.852351+00:00", "grupo": "aih", "ref_id": "1e6bb6f1-… | **falha** |
| A01.22.cobrar | f5_nir | NIR cobra a pendência reg_destino | ok | Esta pendência não está mais em aberto. | **falha** |
| A01.22.nir_nao_aceita | f5_nir | NIR tenta aceitar pelo destino (deve ser recusado) | erro | recusado: Responde pelo destino o médico plantonista ou o gestor da unidade. | ok |
| A01.23.lista | f5_med_hosp | O pedido aparece na lista do destino | ok | ok: na lista do destino | ok |
| A01.23.leitos | f5_med_hosp | Leitos livres do destino incluem a Clínica Médica | ok | ok: [{"id": "93e7a446-e858-40bb-853e-b873abfae5a6", "leito": "CM-02", "setor": "Clínica Médica", "do_tipo": true, "tipo_regulacao": "clinico"}, {"id": "2ef215f4-ef5c-47d5… | ok |
| A01.23.aceitar | f5_med_hosp | Aceita e reserva o leito CM | ok | {"id": "a0a97e60-1757-457d-9e78-a4b078d546c0", "cbo": null, "cid": "O15.0", "sla": null, "tipo": "transferenci… | ok |
| A01.23.reserva | banco | autorizada; reserva até max(agora + 24 h, previsto + 8 h) | ok | ok: status autorizada, reserva até 2026-11-07 21:19:23.610775+00 | ok |
| A01.24.finalizar | f5_med_upa | Encerra a observação: transferência, CID O15.0 e relato | ok | Acesso negado: você não está de plantão no setor deste paciente. | **falha** |
| A01.24.contrarreferencia | f5_med_ubs | A contrarreferência chega à UBS | existir | bloqueado pelo passo A01.24.finalizar (sem a01_finalizada) | lacuna |
| A01.25.saida | f5_nir | NIR marca a saída (em trânsito) | ok | {"id": "a0a97e60-1757-457d-9e78-a4b078d546c0", "cbo": null, "cid": "O15.0", "sla": null, "tipo": "transferenci… | ok |
| A01.26.chegada | f5_med_hosp | Médico do hospital marca a chegada (realizada) | ok | {"id": "a0a97e60-1757-457d-9e78-a4b078d546c0", "cbo": null, "cid": "O15.0", "sla": null, "tipo": "transferenci… | ok |
| A01.26.sem_internacao | banco | A chegada regulada não cria internação no destino | ok | ok: nenhuma internação no hospital | ok |
| A01.26.chegada_cria_internacao | f5_med_hosp | Chegada regulada vira internação no destino | existir | Lacuna (MAPA): o destino abre a ficha e interna pelo fluxo normal. | lacuna |
| A01.26.ficha | f5_med_hosp | Médico do hospital abre a ficha da gestante no hospital | ok | A ficha abre numa porta (setor de emergência). | **falha** |
| A01.26.paciente | f5_med_hosp | Paciente do hospital | existir | bloqueado pelo passo A01.26.ficha (sem a01_eph) | lacuna |
| A01.26.iniciar | f5_med_hosp | Assume o atendimento | existir | bloqueado pelo passo A01.26.ficha (sem a01_eph) | lacuna |
| A01.26.soap | f5_med_hosp | SOAP de admissão (O15.0) | existir | bloqueado pelo passo A01.26.ficha (sem a01_eph) | lacuna |
| A01.26.internar | f5_med_hosp | Interna no leito CM reservado | existir | bloqueado pelo passo A01.26.ficha (sem a01_eph) | lacuna |
| A01.26.internacao | f5_med_hosp | Internação no hospital | existir | bloqueado pelo passo A01.26.ficha (sem a01_eph) | lacuna |
| A01.27.admissao | f5_med_hosp | Registra a admissão | existir | bloqueado pelo passo A01.26.internacao (sem a01_inth) | lacuna |
| A01.27.diagnostico | f5_med_hosp | Registra o diagnóstico principal | existir | bloqueado pelo passo A01.26.internacao (sem a01_inth) | lacuna |
| A01.27.laudo_aih | f5_med_hosp | Emite o laudo de AIH com o procedimento principal 0303100028 | existir | bloqueado pelo passo A01.26.internacao (sem a01_inth) | lacuna |
| A01.27.aih | banco | AIH solicitada pelo gatilho do laudo | existir | bloqueado pelo passo A01.27.laudo_aih (sem a01_laudo) | lacuna |
| A01.28.decidir | f5_regulador | Regulador aprova a AIH | existir | bloqueado pelo passo A01.27.aih (sem a01_aih) | lacuna |
| A01.29.abrir | f5_enf_ubs | Enfermeira da UBS abre a contrarreferência | existir | bloqueado pelo passo A01.24.contrarreferencia (sem a01_ret) | lacuna |
| A01.29.visto | f5_enf_ubs | a_ver → visto | existir | bloqueado pelo passo A01.24.contrarreferencia (sem a01_ret) | lacuna |
| A01.29.pre_natal_segue | f5_med_ubs | O pré-natal continua até o desfecho da gestação | ok | ok: gestação ativa | ok |
| A01.30.conferencia | f5_fat | aberta → em_conferencia | ok | {"id": "ba82a5e6-3dc3-46fe-a1e3-8d94252e7aba", "tipo": "ambulatorial", "itens": [{"em": "2026-11-06T21:19:23.6… | ok |
| A01.30.material | f5_fat | Lança material (2 unidades, sem valor) | ok | {"id": "ba82a5e6-3dc3-46fe-a1e3-8d94252e7aba", "tipo": "ambulatorial", "itens": [{"em": "2026-11-06T21:19:23.6… | ok |
| A01.30.detalhe | f5_fat | Pré-auditoria e total de referência calculado | ok | total 12.26; itens 3; pendências 5; bloqueantes sem liberação 0 | ok |
| A01.30.valor_medicamento | f5_fat | Valor de medicamento, material e transporte na conta; diária de leito | existir | Lacuna (MAPA): só o SIGTAP tem valor; medicamento e material entram sem valor. | lacuna |
| A01.31.fechar_antes_do_desfecho | f5_fat | Fechar a conta antes do desfecho (deve ser recusado) | erro:O atendimento ainda não terminou | recusado: O atendimento ainda não terminou: a conta fecha depois do desfecho. | ok |
| A01.31.fechar_antes_liberar | f5_fat | Faturamento tenta fechar a conta (sem liberação do gestor) | existir | bloqueado pelo passo A01.24.finalizar (sem a01_finalizada) | lacuna |
| A01.31.liberar | f5_ges_upa | Gestor libera o fechamento | existir | bloqueado pelo passo A01.24.finalizar (sem a01_finalizada) | lacuna |
| A01.31.fechar | f5_fat | Faturamento fecha a conta | existir | bloqueado pelo passo A01.24.finalizar (sem a01_finalizada) | lacuna |
| A01.31.faturar | f5_fat | fechada → faturada | existir | bloqueado pelo passo A01.31.fechar (sem a01_fechada) | lacuna |
| A01.31.congelado | banco | Itens congelados e versão para o ERP | existir | bloqueado pelo passo A01.31.faturar (sem a01_faturada) | lacuna |
| A01.32.bpa_upa | f5_fat | Três linhas BPA-I da gestante: classificação, consulta e medicação | ok | ok: classificacao 0301060118 bpa_i qt 1 críticas []; atendimento 0301060096 bpa_i qt 1 críticas []; medicacao 0301100012 bpa_i qt 2 críticas [] | ok |
| A01.32.bpa_ubs | f5_ges_ubs | A UBS não gera linha de BPA para a gestante | ok | ok: UBS sem linha | ok |
| A01.99.eventos_regulacao | banco | Um evento por transição em regulacao_eventos, autor = login | ok | ok: enviada por 08 → assumida por 12 → prioridade_regulador por 12 → autorizada por 12 → destino_aceitou por 11 → saiu por 13 → chegou por 11 | ok |
| A01.11.cor_banco | banco | Conferência refeita no banco depois da rodada (o passo A01.11.cor rodou como a enfermeira e o RLS escondeu a linha): cor e IG do bloco de gestação | ok | ok: cor vermelho, IG 32s6d, discriminador livre true | ok |

## Achados

Nenhum achado P0. Os P1 bloqueiam o cenário. Cada achado diz se é **produto**, **ambiente** (rede de teste F5) ou **catálogo** (especificação ou MAPA).

### P1-1 — Hospital sem porta não tem como receber o paciente regulado (produto + ambiente)
- **Reproduzir:** regulação de transferência UPA → Hospital F5 até `realizada` (passos 20 a 26). Depois, como `medico.hospital.f5`, rodar `registrar_ficha('f5300000-…-021' (Clínica Médica), 'Gestante transferida…', NULL, cadastro, '{gestante}')`.
- **Esperado:** abrir a ficha, assumir e internar no leito CM reservado (passo 26 do catálogo).
- **Obtido:** `P0001: A ficha abre numa porta (setor de emergência).` O Hospital F5 só tem Clínica Médica, UTI Adulto e Obstetrícia. No produto, `registrar_ficha` é a **única** RPC que cria paciente: `abrir_internacao` exige paciente que já exista na unidade. Uma unidade sem porta não tem caminho de admissão direta, nem para o paciente regulado. Isso soma com a lacuna já conhecida, a de que a chegada regulada não cria internação (`A01.26.sem_internacao` confirmou: nenhuma internação no hospital).
- **Efeito:** os passos 26 (ficha → internação), 27 (admissão, diagnóstico, laudo de AIH) e 28 (decisão da AIH) ficaram bloqueados.
- **Saída:** pôr uma porta (setor `emergencia`) no Hospital F5 resolve o ambiente. A admissão direta da chegada regulada é decisão de produto, a registrar no backlog.

### P1-2 — Ninguém da escala F5 alcança a paciente na Observação Adulto (ambiente; pergunta de produto)
- **Reproduzir:** desfecho `observacao` pelo `medico.upa.f5` (box OA-02). Depois, como o mesmo médico, `finalizar_observacao(int, 'transferencia', 'O15.0', …, '{"destino":"Hospital Fase 5"}')`.
- **Esperado:** encerrar a observação com transferência e gerar a contrarreferência para a UBS.
- **Obtido:** `P0001: Acesso negado: você não está de plantão no setor deste paciente.` O mesmo bloqueio aparece em:
  - `painel_observacao`: a lista vem vazia para o médico do PS;
  - `registrar_sae` e `lancar_balanco` pelo `enfermeiro.upa.f5`;
  - os sinais do box (`SYNC_FORA_DO_PLANTAO`).
  
  Na escala F5, a Observação Adulto só tem o `tecnico.upa.f5`, e com ele o balanço passa (`A01.19.balanco_tecnico` ok).
- **Efeito:** a contrarreferência (passos 24 e 29) e o fechamento e faturamento da conta (passo 31) ficaram bloqueados.
- **Saída:** escalar médico e enfermeiro na Observação Adulto (setor `…-012`) resolve o ambiente. A pergunta para o RT: o médico da porta que pôs a paciente em observação deve poder encerrá-la sem estar escalado no setor?

### P2-1 — Ataque e manutenção do mesmo medicamento pela mesma via não convivem na porta (produto)
- **Reproduzir:** com o ataque do sulfato de magnésio já prescrito ("Agora", EV), prescrever a manutenção ("Contínuo", EV).
- **Obtido:** `P0001: Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.`
- **Contorno que funcionou:** checar o ataque e depois **alterar** o item para manutenção (`alterar_item_prescricao`, passo 17). O item novo volta para a farmácia sem liberação, como deve.
- **Pergunta para o RT:** a regra de "um item por medicamento e via" deve aceitar ataque + manutenção ao mesmo tempo?

### P2-2 — A regulação anda até "realizada" com a paciente ainda internada na origem (produto)
- **Reproduzir:** com a observação da UPA ainda aberta (passo 24 recusado), o NIR roda `regulacao_marcar_saida` (`em_transito`) e o hospital roda `regulacao_marcar_chegada(true)` (`realizada`).
- **Obtido:** a regulação nº 94 está `realizada`, mas a paciente segue com episódio aberto e internação de observação ativa na UPA, ocupando o box OA-02. O leito CM-02 do hospital continua reservado. Nem `regulacao_marcar_saida` nem `regulacao_marcar_chegada` conferem se a origem encerrou o atendimento.
- **Evidência:** consulta em `regulacao_solicitacoes` (nº 94 e nº 91: `realizada`) e em `pacientes`/`episodios`/`internacoes` da UPA (1 episódio aberto e 1 internação ativa por paciente).

### P3-1 — Catálogo: a consulta programada não passa pela escuta (catálogo)
- **Reproduzir:** passo 2 do catálogo. Ficha `consulta_programada` e depois `registrar_escuta_aps`.
- **Obtido:** `Este paciente não está aguardando a escuta inicial.` É o desenho: na UBS, `registrar_ficha` põe a consulta programada direto em `atendimento`, e só a ficha `escuta_inicial` passa pela escuta. Os sinais da 1ª consulta foram registrados pela médica (`A01.03.sinais`). A técnica de enfermagem é recusada antes, pela regra de papel (`A01.02.tecnico_nao_escuta` ok).
- **Ajustar no catálogo:** passo 1 com `escuta_inicial`, ou tirar o passo 2.

### P3-2 — Catálogo: o NIR da origem não vê `reg_destino` (catálogo)
- **Reproduzir:** passo 22. `nir_pendencias(UPA)` e `nir_cobrar(UPA, 'reg_destino', reg)`.
- **Obtido:** a pendência não aparece, e a cobrança dá `Esta pendência não está mais em aberto.`. Em `private.nir_itens`, `reg_destino` é da **unidade de destino** e só aparece depois do prazo do destino (24 h). O NIR também não aceita pelo destino (`A01.22.nir_nao_aceita` ok).
- **Ajustar no catálogo:** quem vê é o NIR do destino, depois do prazo, ou o teste simula o prazo vencido.

### P3-3 — Agenda: horário "realizado" é remarcado, e a mesma paciente volta no mesmo dia (produto)
- **Na rodada 1:** três consultas da mesma paciente, com a mesma médica, no mesmo horário (18h20), foram aceitas. As travas `agenda_exigir_livre` e "já tem consulta nesse dia" só olham `agendado`/`presente`.
- **Na tela:** `agenda_dia` mostra um agendamento por horário, e os outros somem.

### P3-4 — Contas abertas vazias na UBS (produto)
- Cada ficha da UBS abre uma conta (`trg_conta_do_episodio`) que fica `aberta` e sem itens, mesmo com o episódio encerrado. São 5 contas por gestante (`A-2026.000011` a `…015` na rodada 1 e `…016` a `…020` na rodada 2).
- A UBS não gera valor nem BPA (`A01.01.ubs_sem_valor` e `A01.32.bpa_ubs` ok), mas essas contas vão se acumular na lista do faturamento.

### P3-5 — Valor nulo no acolhimento com classificação (produto/dados)
- No SIGTAP carregado, `0301060118` tem `valor_sa` nulo, e o item da conta sai com `valor_unitario` e `valor_total` nulos em vez de R$ 0,00.

### P3-6 — MAPA desatualizado em alguns pontos (catálogo)
- Existe a conduta `encaminhamento_urgencia` em `lista_aps('conduta')`, e ela foi usada no passo 8. A lacuna "`conduta_aps` não grava encaminhamento à UPA" está superada.
- Desde o `46`, o Hospital F5 tem recepção, gestor, enfermeira, faturamento, Obstetrícia e UTI. Seguem como lacuna no MAPA 5.1.
- `prescricao_porta_ativa`, citada no passo 13, só lista paciente que já está em observação ou internação ("Vindos da porta"). Na porta, a conferência é pela tabela.
- Medicação: a conta e o BPA geram **uma linha por paciente, profissional e dia, com quantidade = número de administrações** (aqui, qt 2). Não é "1 por dia".

### Observações sem achado
- A farmácia dispensou com estoque zerado e o saldo foi a −2 (rodadas 1 e 2). É o desenho ("saldo pode ficar negativo").
- A pré-auditoria avisou "Administrado sem nada dispensado" para o item alterado e "Dispensado e nunca administrado" para a hidralazina "Se necessário". Os dois avisos estão coerentes.

## Custos que o sistema registrou (conta da UPA)

Conta ambulatorial `ba82a5e6-3dc3-46fe-a1e3-8d94252e7aba`, nº `A-2026.000007`, status **`em_conferencia`**. Não fechou, por causa do P1-2. Nenhum valor foi digitado: tudo vem do SIGTAP carregado (competência 202609). Os valores fictícios do catálogo (R$ 10, 20 e 5) não foram gravados.

| Item | SIGTAP | Qtd | Valor unitário | Total | Profissional |
|---|---|---|---|---|---|
| Atendimento médico em unidade de pronto atendimento | 0301060096 | 1 | R$ 11,00 | R$ 11,00 | Médico UPA F5 (CBO 225125) |
| Acolhimento com classificação de risco | 0301060118 | 1 | nulo | nulo | Enfermeiro UPA F5 (CBO 223505) |
| Administração de medicamentos | 0301100012 | 2 | R$ 0,63 | R$ 1,26 | Enfermeiro UPA F5 (CBO 223505) |
| **Total de referência (`conta_detalhe.total_referencia`)** | | | | **R$ 12,26** | |

- **Medicamentos (sem valor):**
  - sulfato de magnésio (ataque): dispensado 1, administrado 1;
  - sulfato de magnésio (manutenção, item alterado): dispensado 0, administrado 1, com aviso;
  - hidralazina: dispensado 1, administrado 0, com aviso.
- **Material (sem valor):** "Gaze estéril teste F5", 2 pacotes, sem SIGTAP (aviso).
- **Pré-auditoria:** 5 pendências, nenhuma bloqueante (endereço, nacionalidade, os dois avisos de medicamento e o material sem SIGTAP).
- **BPA da UPA (competência 202611):** 3 linhas BPA-I da gestante, sem crítica: classificação qt 1, consulta qt 1, medicação qt 2. A UBS não gera linha.
- **Internação no hospital (AIH 0303100028 = SH R$ 97,01 + SP R$ 26,98 no SIGTAP):** não nasceu, porque a internação ficou bloqueada (P1-1).
- **Regulação, transporte e UBS:** nenhum valor, como previsto.

## O que só se confere na tela (fica para o Chrome)
- **UBS:**
  - painel do pré-natal (`/pre-natal`) com os itens e as datas (30/05, 11/07, 22/08, 03/10 e 06/11) e nenhum valor de conduta;
  - fila da escuta e o "Enviar à UPA" (`EnviarUpa.tsx`);
  - "Encaminhados" com a linha "enviado".
- **UPA, recepção:** "Chegou" sem ficha. A tela não deve permitir (PR #438). O servidor aceita `p_episodio` nulo, por isso não foi testado aqui, para não estragar o envio.
- **UPA, triagem:**
  - o bloco de gestação (`Gestacao.tsx`) com a IG calculada;
  - nenhum texto de "sugerido" na cor;
  - o discriminador livre, porque o fluxograma não tem discriminador obstétrico.
- **Central de fichas:**
  - `/plantonista/emergencias/emergencia-hipertensiva-adulto`, com o alvo `eclampsia`, os blocos de sulfato de magnésio e hidralazina e as fontes visíveis;
  - a ficha `glasgow`;
  - a mensagem do `news2` para a gestante.
- **Prescrição:**
  - a recusa sem peso na tela;
  - o peso "referido" escolhido no chip;
  - a frequência "Agora/Contínuo/Se necessário".
- **Regulação:** anexo de arquivo (`regulacao_registrar_anexo` exige o arquivo já enviado ao Storage, bucket `regulacao`; não se reproduz por SQL).
- **Faturamento:** sem rota para `/aih`.
- **Impressão:** sinais vitais crus na ficha impressa.

## O que ficou gravado na homologação

Esperado pela rodada, com dados fictícios e nomes de teste:
- **Pacientes:** "Gestante A01 Teste" (rodada 1) e "Gestante A01 Teste B" (rodada 2), cada uma na UBS e na UPA F5.
- **Na UBS:** 5 episódios encerrados por gestante, o pré-natal ativo e o envio à UPA (`chegou`).
- **Na UPA:**
  - episódio em observação;
  - prescrições, validações, dispensações e administrações;
  - a conta em conferência, com 2 pacotes de gaze lançados.
- **Regulação:** nº 91 e nº 94 com eventos e avisos (notificações) para origem, central e destino.
- **Precondições aplicadas:**
  - agenda da `medico.ubs.f5` reconfigurada pelo gestor (manhã 07–12, **tarde 13–19 e noite 19–23h40**, todos os dias);
  - SIGTAP associado aos usos `classificacao`, `atendimento_medico` e `medicacao` na UPA F5. Associado duas vezes: a rodada 1 ficou com `vigente_ate` e a rodada 2 está vigente.
- **Datas do pré-natal:** as 4 consultas de cada gestante e os sinais delas foram levados ao passado por `UPDATE` (ajustes `A01.03.datas` e `A01.05.datas_ig*`).

**De forma inesperada, ou que precisa de atenção:**
- **Box da Observação Adulto:** **OA-01 e OA-02 ocupados** pelas duas gestantes, porque a observação não pôde ser encerrada (P1-2). Episódio e internação seguem abertos na UPA.
- **Leitos do hospital:** **CM-01 e CM-02 reservados**, até 07/11 por volta de 18h16 e 18h19, e as regulações nº 91 e nº 94 estão `realizada` sem internação no hospital (P2-2).
- **Estoque da UPA F5:** **sulfato de magnésio e hidralazina com saldo −2**.
- **Agenda da UBS:** três agendamentos `realizado` no mesmo horário (18h20) da rodada 1 (P3-3).
- **Contas vazias:** 10 contas `aberta` na UBS (P3-4) e 2 contas da UPA em `em_conferencia` que não fecham.

Nada foi corrigido no produto: nenhuma migration, nenhuma função de produto alterada. As funções criadas ou recriadas são só do esquema `e2e`:
- `a01`, `a01_banco`, `a01_sinais`, `a01_ajuste` e `a01_sql_passado`;
- `confere`, `falhar`, `guardar`, `conferir` e `cns`, com o mesmo corpo de antes;
- `conta`, ampliada pelo `47`.

## Rodada 3 (ambiente ajustado)

- **Quando:** 06/11/2026, às 21h24 (horário de Brasília), no plantão da noite. O RT autorizou ajustar o **ambiente**. O produto não foi corrigido: nenhuma migration, nenhuma função de produto alterada, nenhuma dose.
- **Ambiente:** homologação `kswurfyxxvfydpjfrivy`.
- **Ordem:** `48_rede_fase5_ajuste_a01.sql`, depois `47_framework_ampliacao.sql` (com as contas novas) e `41_checkin_fase5.sql`. Por fim, `51_cenario_a01_final.sql`, que continua da "Gestante A01 Teste B" da rodada 2 pelos ids em `e2e.vars`. Os ids `A01R.*` não sobrescrevem os da rodada 2.

### O ajuste do ambiente (`48`)
- **Para o P1-2:**
  - `medico.observacao.f5` (…025, plantonista, CRM fictício 950025, CBO 225125);
  - `enfermeiro.observacao.f5` (…026, enfermeiro, CBO 223505);
  - os dois na UPA, escalados na Observação Adulto (…012), de 05/11 a 13/11, nos três turnos.
- **Para o P1-1:**
  - setor **"Porta do Hospital"** (…024, `emergencia`) com os leitos EST-01 e EST-02 (estabilização);
  - a escala da `recepcao.hospital.f5` (…022) e a da `enfermeiro.hospital.f5` (…024) passaram do setor 21 para a porta, de 06/11 em diante. A enfermeira teve de ir junto: a ficha da porta entra em `triagem`, e `iniciar_atendimento` só aceita o episódio já classificado.
  - O hospital já tinha protocolo de classificação (o mesmo da UPA, definido pelo 40).
- **Além do pedido:** `medico.porta.hospital.f5` (…027, plantonista, CRM 950027, CBO 225125), escalado na porta.
  - **Por quê:** a escala recusa a mesma pessoa em dois setores no mesmo horário (`trg_escala_sem_sobreposicao`). O `medico.hospital.f5` precisa seguir na Clínica Médica para admitir e laudar a AIH. Sem um médico na porta, ninguém assumiria a ficha aberta lá.
  - Está no cabeçalho do 48 e no `e2e.conta` como `f5_med_porta_hosp`. As outras duas entraram como `f5_med_obs` e `f5_enf_obs`.
- **Comum às três contas novas:** o hash de senha é o mesmo de `medico.upa.f5`, copiado no banco. Os CNS fictícios têm dígito verificador válido: 709950000000272, …280 e …299.
- **Internação na Clínica Médica, não na Obstetrícia:** a reserva da regulação é do leito **CM-02**, e o único médico do hospital fora da porta está escalado na Clínica Médica. Na Obstetrícia ninguém poderia admitir nem laudar.

### Resultado

| Situação | Quantidade |
|---|---|
| ok | 42 (inclui a pergunta de produto, registrada, e 2 passos refeitos) |
| falha | 2 (as duas da primeira tentativa, depois resolvidas; ver abaixo) |
| lacuna | 1 (a liberação do gestor não foi preciso) |

As duas falhas:
- **`A01R.27.admissao`:** erro **do script**. Mandou a ficha de admissão vazia, e o servidor cobra Subjetivo, Objetivo, Hipótese e Plano. O 51 foi corrigido, e o passo foi refeito na mesma noite como `A01R.27.admissao_ficha_completa` (ok).
- **`A01R.28.conferir`:** o regulador recebe "Acesso negado" em `conferir_aih`. A RPC é a conferência do laudo pelo médico que atua com a paciente (`pode_atuar_no_paciente`). Pelo médico da internação passou (`A01R.28.conferir_medico`). Achado de catálogo (P3-9).

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| A01R.24.porta_finaliza | f5_med_upa | Pergunta de produto (P1-2): o médico da porta, que pôs a paciente em observação e não está escalado nela, tenta encerrar a observação | registrar (decisão do RT) | RECUSADO: Acesso negado: você não está de plantão no setor deste paciente. | ok |
| A01R.18.painel | f5_med_obs | Médico da observação vê a gestante no painel, com prazo | ok | ok: box OA-02, prazo 2026-11-07 03:19:23.610775+00, estado nao | ok |
| A01R.18.atender | f5_med_obs | Médico da observação registra o primeiro atendimento no box | ok | (sem retorno: void) | ok |
| A01R.19.sinais | f5_enf_obs | Enfermeira da observação registra sinais seriados crus no box | ok | 3 sinais gravados | ok |
| A01R.19.sae | f5_enf_obs | SAE da gestante em observação | ok | a9872e0b-0961-4df6-83b9-8396b789019f | ok |
| A01R.19.balanco | f5_enf_obs | Balanço: diurese (valor cru) | ok | 92f06543-b498-4658-b626-7f4793014c01 | ok |
| A01R.19.porta_ativa | f5_med_obs | A prescrição da porta aparece para quem cuida da observação | ok | ok: 2 itens: Sulfato de magnésio solução injetável, ampola 10 mL [Contínuo, validação nenhuma]; Hidralazina solução injetável, ampola 1 mL [Se necessário, validação confe… | ok |
| A01R.24.finalizar | f5_med_obs | Médico da observação encerra: transferência, CID O15.0 e relato | ok | (sem retorno: void) | ok |
| A01R.24.encerrado | banco | Episódio da UPA encerrado, internação de observação com alta e box liberado | ok | ok: episódio encerrado, internação transferencia_externa, box OA-02 higienizacao | ok |
| A01R.24.contrarreferencia | f5_med_ubs | A contrarreferência chega à UBS como a_ver | ok | 782d5ac2-dfab-4f23-ab89-15d3fceffe8c | ok |
| A01R.24.a_ver | banco | Contrarreferência a_ver, ligada ao envio e à UBS | ok | ok: situação a_ver, desfecho transferencia_externa, envio fdcb8100-0a6e-4776-b8dc-0f415253b597 | ok |
| A01R.29.recepcao_sem_resumo | f5_rec_ubs | Recepção não abre o resumo (deve ser recusado) | erro | recusado: O resumo do retorno é visto pelo médico, pelo enfermeiro e pelo gestor da UBS. | ok |
| A01R.29.abrir | f5_enf_ubs | Enfermeira da UBS abre a contrarreferência | ok | {"id": "782d5ac2-dfab-4f23-ab89-15d3fceffe8c", "numero": 21, "resumo": {"cid": null, "medico": null, "relato":… | ok |
| A01R.29.visto | banco | a_ver → visto, com autor = login | ok | ok: situação visto, visto por 02 | ok |
| A01R.29.pre_natal_segue | f5_med_ubs | O pré-natal continua até o desfecho da gestação | ok | ok: gestação ativa | ok |
| A01R.26.ficha | f5_rec_hosp | Recepção do hospital abre a ficha da gestante regulada na porta | ok | 38852839-dc3e-41bc-820a-ebb4fa4ee6c2 | ok |
| A01R.26.paciente | banco | Paciente do hospital | ok | 3440468e-af0c-49fa-8146-3f3816d8354e | ok |
| A01R.26.classificar | f5_enf_hosp | Enfermeira do hospital classifica vermelho (escolha da enfermeira de teste), sinais crus, bloco de gestação | ok | 5e2e1da9-1196-44ae-98ec-547d79a6327f | ok |
| A01R.26.iniciar | f5_med_porta_hosp | Médico da porta assume | ok | (sem retorno: void) | ok |
| A01R.26.soap | f5_med_porta_hosp | SOAP de chegada (O15.0) | ok | 6d66bbf7-003f-4ce6-b521-a8ea65f98ffa | ok |
| A01R.26.leitos | f5_med_porta_hosp | leitos_para_ocupar oferece o leito CM reservado pela regulação | ok | ok: CM-01 (reservado), CM-02 (reservado), CM-03, CM-04 | ok |
| A01R.26.internar | f5_med_porta_hosp | Interna no leito CM reservado pela regulação | ok | (sem retorno: void) | ok |
| A01R.26.internacao | banco | Internação no hospital | ok | 97f4501b-a300-43f5-90bd-f55b7ba056c5 | ok |
| A01R.26.leito_e_reserva | banco | Leito ocupado e o que acontece com a reserva da regulação | ok | ok: leito CM-02 ocupado; reserva ocupada (Ocupado pela internação); internação da reserva 97f4501b-a300-43f5-90bd-f55b7ba056c5 | ok |
| A01R.27.admissao | f5_med_hosp | Médico da Clínica Médica registra a admissão | ok | Falta para registrar a admissão: Subjetivo, Objetivo, Hipótese diagnóstica, Avaliação inicial e plano de tratamento. | **falha** |
| A01R.27.diagnostico | f5_med_hosp | Diagnóstico primário confirmado O15.0 | ok | 14f2169a-aaff-4b6a-bcbd-7b0c0ab18874 | ok |
| A01R.27.laudo_aih | f5_med_hosp | Emite o laudo de AIH com o procedimento principal 0303100028 | ok | ef6f69b7-5d1c-4062-980b-8ec14b3a99df | ok |
| A01R.27.aih | banco | AIH solicitada pelo gatilho do laudo | ok | 96642d0b-ad55-47df-808c-9736837bc6a1 | ok |
| A01R.28.conferir | f5_regulador | Regulador confere o procedimento com o CID (sigtap_procedimento_cid) | ok | Acesso negado. | **falha** |
| A01R.28.fat_nao_decide | f5_fat | Faturamento tenta decidir a AIH (deve ser recusado) | erro | recusado: A decisão da AIH é do médico regulador da unidade. | ok |
| A01R.28.decidir | f5_regulador | Regulador aprova a AIH | ok | (sem retorno: void) | ok |
| A01R.28.aprovada | banco | AIH aprovada com número e competência, evento gravado | ok | ok: status aprovada, número 3526100094001, competência 202611, eventos 2 | ok |
| A01R.27.conta_internacao | f5_fat | Conta de internação aberta no hospital | ok | 9a332607-3eb9-42f8-8290-9675ee41bc67 | ok |
| A01R.27.conta_aih | f5_fat | O procedimento principal da AIH (SH + SP) entra na conta da internação | ok | ok: total 123.99; [{"em": "2026-11-07T00:24:28.156547+00:00", "aih": {"numero": "3526100094001", "status": "aprovada", "competencia": "202611"}, "cbo": null, "nome": "TRA… | ok |
| A01R.26.conta_porta_hospital | f5_fat | Conta da porta do hospital (classificação e consulta) | ok | e2f1b4cc-21da-41c6-ac67-4041748a68d6 — total 0 | ok |
| A01R.30.detalhe | f5_fat | Pré-auditoria da conta da UPA depois do desfecho | ok | status em_conferencia; total 12.26; itens 3; pendências 5; bloqueantes sem liberação 0 | ok |
| A01R.31.fechar | f5_fat | Faturamento fecha a conta da UPA | ok | {"id": "ba82a5e6-3dc3-46fe-a1e3-8d94252e7aba", "tipo": "ambulatorial", "itens": [{"em": "2026-11-06T21:19:23.6… | ok |
| A01R.31.liberar | f5_ges_upa | Gestor libera o fechamento | existir | não precisou: a conta fechou sem pendência bloqueante | lacuna |
| A01R.31.total_congelado | banco | O total congelado no fechamento é o calculado antes | ok | ok: congelados 3, total 12.26 | ok |
| A01R.31.faturar | f5_fat | fechada → faturada | ok | {"id": "ba82a5e6-3dc3-46fe-a1e3-8d94252e7aba", "tipo": "ambulatorial", "itens": [{"em": "2026-11-06T21:19:23.6… | ok |
| A01R.31.erp | banco | Versão da conta para o ERP | ok | ok: versão 1, total 12.26, vigente, conciliação pendente | ok |
| A01R.31.fat_nao_reabre | f5_fat | Faturamento não reabre conta faturada (deve ser recusado) | erro:Reabrir conta fechada é do gestor | recusado: Reabrir conta fechada é do gestor da unidade. | ok |
| A01R.32.bpa_upa | f5_fat | Três linhas BPA-I da gestante na UPA, sem crítica | ok | ok: classificacao 0301060118 qt 1 críticas []; atendimento 0301060096 qt 1 críticas []; medicacao 0301100012 qt 2 críticas [] | ok |
| A01R.27.admissao_ficha_completa | f5_med_hosp | Admissão de novo, com a ficha completa (a 1ª tentativa do script mandou a ficha vazia; o 51 já foi corrigido) | ok | 516c93bc-e11c-4c28-85fc-57b49744b909 | ok |
| A01R.28.conferir_medico | f5_med_hosp | O médico da internação confere o procedimento com o CID | ok | {"nota": "Críticas da AIH: as bloqueantes impedem emitir o laudo; os avisos vão para o regulador. O gestor def… | ok |

### Situação dos P1
- **P1-1 (hospital sem porta): resolvido pelo ambiente.** A recepção abriu a ficha na porta nova e a enfermeira classificou. O médico da porta assumiu e internou no **leito reservado CM-02**. A reserva da regulação passou a "ocupada", ligada à internação. Isso também prova o item 8 do README: `leitos_para_ocupar` oferece o leito reservado.

  Fica o achado de produto: unidade sem porta não tem caminho de admissão direta, e a chegada regulada não cria a internação (lacuna do MAPA). É decisão do RT, para o backlog.
- **P1-2 (ninguém da escala na Observação): resolvido pelo ambiente.**
  - O médico da observação viu o painel, atendeu e **encerrou com transferência**.
  - A enfermeira registrou os sinais, a SAE e o balanço.
  - O box OA-02 foi para higienização.
  - A **contrarreferência** chegou à UBS (`a_ver`), a enfermeira da UBS abriu e ela virou `visto`. A recepção continua sem ver o resumo.
- **Pergunta de produto registrada (`A01R.24.porta_finaliza`):** o `medico.upa.f5`, que pôs a paciente em observação e não está escalado nela, tentou encerrar a observação. Foi **RECUSADO** ("Acesso negado: você não está de plantão no setor deste paciente."). **Decisão do RT em 06/11/2026: "Sim, deve poder".** Com isso, o comportamento atual vira achado de produto (P2-3): o médico que pôs o paciente em observação deve poder encerrá-la, mesmo sem estar escalado no setor da observação. A correção entra na tarefa 3 da frente, numa branch própria, na ordem que o RT decidir.

### Achados novos
- **P3-7 — Hospital F5 sem SIGTAP associado (ambiente).** A conta da porta do hospital (`A-2026.000001`, hospital) tem os itens de classificação e de consulta "fora" do BPA, sem valor. Há 2 pendências **bloqueantes** ("A unidade não associou o código SIGTAP desta fonte"). Se for fechar essa conta, é preciso `associar_procedimento_bpa` no hospital, como foi feito na UPA.
- **P3-8 — Crítica da AIH pela tabela SIGTAP (dados).** A conferência da AIH aponta a crítica do campo 28: a tabela SIGTAP carregada é da competência 09/2026, e a AIH é de 11/2026. Não bloqueou a aprovação.
- **P3-9 — Catálogo, passo 28.** `conferir_aih` não é do regulador: é do médico que emite o laudo. O regulador vê as críticas na AIH e decide (`decidir_aih` ok; o faturamento é recusado: "A decisão da AIH é do médico regulador da unidade").
- **Confirmado, sem achado:**
  - a reserva da regulação é consumida pela internação no leito reservado;
  - `prescricao_porta_ativa` lista os itens "Vindos da porta" para quem cuida da observação;
  - a conta da UPA fechou **sem pendência bloqueante**, então a liberação do gestor não foi preciso;
  - o total congelado é igual ao calculado (R$ 12,26);
  - o faturamento não reabre conta faturada.
- **Continuam valendo:** o P2-2 (a regulação chegou a `realizada` antes de a origem encerrar a observação; aqui a ordem foi a da rodada 2) e os P3 anteriores.

### Custos finais que o sistema registrou
Os valores vêm do SIGTAP carregado (competência 202609). Nenhum valor foi digitado.

| Conta | Status | Itens com valor | Total de referência |
|---|---|---|---|
| UPA, ambulatorial `A-2026.000007` | **faturada**. ERP: versão 1, total R$ 12,26, conciliação pendente | consulta 0301060096: R$ 11,00; acolhimento 0301060118: nulo; medicação 0301100012: 2 × R$ 0,63 = R$ 1,26. Medicamentos e gaze sem valor | **R$ 12,26** (congelado igual ao calculado) |
| Hospital, internação `I-2026.000001` | aberta (internação ativa no CM-02) | procedimento principal da AIH 0303100028, Tratamento de eclâmpsia: SH R$ 97,01 + SP R$ 26,98 | **R$ 123,99** |
| Hospital, porta `A-2026.000001` | aberta | classificação e consulta "fora", sem SIGTAP associado (P3-7) | R$ 0,00 |

- **AIH:** nº `3526100094001`, competência 202611, **aprovada** pelo regulador, 2 eventos (`aih_eventos`). A AIH não guarda valor: o valor está na conta da internação.
- **BPA da UPA (202611):** as mesmas 3 linhas BPA-I da gestante, sem crítica.

### O que ficou gravado na rodada 3
- **Ambiente (permanente, pelo 48):**
  - 3 contas novas (…025, …026 e …027), com vínculos, CNS, CBO e escala até 13/11;
  - o setor "Porta do Hospital" com 2 leitos;
  - a escala da recepção e da enfermeira do hospital na porta, de 06/11 em diante. As linhas de antes das 21h de 06/11 também foram movidas, porque o filtro é por data.
- **Cenário:**
  - na UPA: observação da "Gestante A01 Teste B" encerrada (transferência externa), OA-02 em **higienização**, conta da UPA **faturada**, com uma versão para o ERP;
  - na UBS: contrarreferência `visto`;
  - no hospital: paciente "Gestante A01 Teste B", episódio da porta em `internacao`, **internação ativa no CM-02** (ocupado), admissão, diagnóstico primário O15.0, laudo de AIH, **AIH aprovada** e duas contas abertas.
- **Continua da rodada 1, sem mexer:**
  - a "Gestante A01 Teste" segue em observação no **OA-01**;
  - o **CM-01** segue reservado pela regulação nº 91, que expira em 07/11;
  - o estoque de magnésio e hidralazina da UPA em −2.

## Arquivos
- `scripts/e2e/47_framework_ampliacao.sql`: `e2e.conta` com os papéis do 42, as contas 16 a 24 e as 25 a 27 do 48 (`f5_med_obs`, `f5_enf_obs`, `f5_med_porta_hosp`) (`f5_tec_upa`, `f5_tele`, `f5_admin`, `f5_secretaria`, `f5_reg_regional`, `f5_fat_rede`, `f5_rec_hosp`, `f5_ges_hosp`, `f5_enf_hosp`).
- `scripts/e2e/48_rede_fase5_ajuste_a01.sql`: ajuste do ambiente para os P1-1 e P1-2 (contas de observação e da porta do hospital, setor Porta do Hospital, escala movida).
- `scripts/e2e/50_cenario_a01.sql`: os passos do A01. Repetível: cada rodada cria uma gestante nova ("… B", "… C").
- `scripts/e2e/51_cenario_a01_final.sql`: rodada 3, fim do A01 sobre a gestante da última rodada do 50 (ids `A01R.*`). Não se repete sobre a mesma paciente.
