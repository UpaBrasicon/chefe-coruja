# U6 e U7 da trilha da UBS: plano dos PRs (17/11/2026)

O RT decidiu A no U6 e no U7, no diagnóstico `docs/ubs/PERCURSO-UBS-DIAGNOSTICO.md`:
- **U6:** consulta de enfermagem completa, contando nos painéis, e tipo de serviço na agenda.
- **U7:** sinais vitais na consulta e uma tela para o técnico; procedimentos com resultado dos testes rápidos, e o reagente sugere notificação.

Este documento só divide o trabalho em PRs e traz as decisões. Não muda código.

**Decisões do RT (17/11/2026):** P1 = A, P2 = B, P3 = B, P4 = A, P5 = A.
- O enfermeiro pede os exames do protocolo da atenção básica (P1).
- O enfermeiro prescreve pelos protocolos do município (P2). Entra o PR 3b.
- A vacina fica fora até a integração com o SI-PNI e a RNDS (P3). O PR 6 sai daqui e vai para o U15.
- O técnico registra sinais vitais, curativo, administração de medicamento e glicemia capilar (P4, sem a vacina).
- A ordem é a da tabela (P5).

## Por que importa

Nas notas metodológicas da SAPS (C1, C4, C6 e C7), a consulta do enfermeiro (CBO 2235) conta igual à do médico, e o técnico de enfermagem (CBO 3222) conta nos procedimentos. Hoje o app só deixa o médico fazer a consulta da UBS (`medico_na_porta`). Os painéis contam só a consulta do médico, e os testes rápidos do pré-natal ficam sempre vazios.

## O que existe e serve

- `procedimentos_realizados`: guarda código SIGTAP, quem fez e o CBO. Não tem resultado.
- `observacao`: guarda os sinais vitais. O hiperdia e o pré-natal já leem pressão, peso e altura daqui.
- A conduta da UBS (`registrar_conduta_aps`) segue a ficha do e-SUS APS. Quando o enfermeiro puder fechar a consulta, os gatilhos do hiperdia, do pré-natal e da puericultura passam a contar a consulta dele sem mudança.
- A grade da agenda já aceita enfermeiro, e a homologação já tem a grade da enfermeira UBS F5.

## Códigos SIGTAP (conferidos na tabela da homologação)

| Procedimento | SIGTAP |
|---|---|
| Teste rápido de sífilis, população geral / gestante / parceria | 02.14.01.007-4 / 02.14.01.025-2 / 02.14.01.026-0 |
| Teste rápido de HIV, população geral / gestante / parceria | 02.14.01.005-8 / 02.14.01.027-9 / 02.14.01.028-7 |
| Teste rápido de hepatite B (HBsAg), população geral / gestante / parceria | 02.14.01.022-8 / 02.14.01.023-6 / 02.14.01.024-4 |
| Teste rápido de hepatite C, população geral / gestante / parceria | 02.14.01.029-5 / 02.14.01.030-9 / 02.14.01.031-7 |
| Teste rápido de gravidez | 02.14.01.006-6 |
| Glicemia capilar | 02.14.01.001-5 |
| Aferição de pressão arterial | 03.01.10.003-9 |
| Inserção / retirada do implante de etonogestrel | 03.01.04.017-6 / 03.01.04.018-4 |
| Inserção / retirada do DIU | 03.01.04.014-1 / 03.01.04.015-0 |
| Coleta de citopatológico do colo do útero | 02.01.02.003-3 |
| Curativo simples / especial | 03.01.10.028-4 / 03.01.10.027-6 |
| Administração de medicamento (IM, SC, VO, tópica) | 03.01.10.020-9, 03.01.10.022-5, 03.01.10.021-7, 03.01.10.023-3 |

A vacina não é procedimento SIGTAP. Ela é registrada na ficha de vacinação do e-SUS APS, que vai ao SI-PNI e à RNDS (ligado ao U15).

## PRs, em ordem

| PR | O que entra | Banco | Tela |
|---|---|---|---|
| 1. Tipo de serviço na agenda | Cada consulta marcada ganha o serviço: consulta médica, consulta de enfermagem, coleta de preventivo, inserção de implante, inserção de DIU, curativo, teste rápido, vacinação, outro. A grade do enfermeiro só oferece serviços de enfermagem; a do médico, consulta médica, implante e DIU | coluna `servico` em `agendamentos` (expand) | agenda: escolher o serviço; o dia mostra o serviço |
| 2. A ficha vai para o profissional | A ficha da UBS passa a ter destino: médico ou enfermagem. A chegada do agendado leva o destino da agenda; na demanda do dia, a recepção ou a escuta escolhem. O enfermeiro ganha a fila "Consultório de enfermagem" | coluna `destino` em `episodios`; `fila_da_porta` filtra pelo destino | recepção (destino); menu do enfermeiro (fila) |
| 3. Consulta de enfermagem | O enfermeiro de plantão inicia a consulta, registra o SOAP e fecha pela conduta da UBS (mesma ficha do e-SUS APS). Prescrição e pedido de exame seguem como hoje (decisões P1 e P2) | trava `profissional_na_porta` (médico ou, com destino enfermagem, enfermeiro) em iniciar, SOAP e conduta | janela da consulta sem as abas que não cabem ao enfermeiro |
| 3b. Prescrição pelo protocolo do município (P2 = B) | O gestor cadastra o protocolo de enfermagem do município: documento de origem (número, data e órgão) e os medicamentos permitidos, com apresentação e posologia do protocolo. O enfermeiro só prescreve itens do protocolo vigente; fora dele, o sistema recusa | tabela `protocolos_enfermagem` e itens; trava na prescrição | cadastro do protocolo (gestor); prescrição do enfermeiro limitada ao protocolo |
| 4. Sinais vitais | Bloco de sinais vitais na consulta (médico e enfermeiro). Tela "Sinais vitais" para o técnico e o enfermeiro, com os pacientes do dia | `registrar_sinais_aps` (escala de plantão; grava em `observacao`) | bloco na consulta; tela nova no menu do técnico |
| 5. Procedimentos com resultado | Registro dos procedimentos da tabela acima, com resultado nos testes rápidos (reagente, não reagente, inválido). Teste reagente de sífilis, HIV ou hepatites sugere a notificação (sífilis em gestante quando for o teste de gestante) | coluna `resultado` em `procedimentos_realizados` (expand); `registrar_procedimento_aps`; a notificação passa a ler o reagente | aba "Procedimentos" na consulta da UBS; atalho na tela do técnico |
| ~~6. Vacinação~~ | Saiu pelo P3 = B: vai com a integração do SI-PNI e da RNDS (U15) | | |

Cada PR passa por homologação, CI verde e "ok produção". Os PRs 4 e 5 não dependem do 2 nem do 3, e podem sair antes se o RT preferir.

## Decisões para o RT

**P1. Pedido de exame na consulta de enfermagem**
- **A:** o enfermeiro pede só os exames do protocolo da atenção básica: pré-natal, rastreio do colo do útero e de mama, e os do hiperdia. A lista é fixa e citada dos Cadernos de Atenção Básica. A base legal é a Resolução COFEN 195/1997, que trata da solicitação de exames de rotina e complementares pelo enfermeiro.
- **B:** só o médico pede exame nesta trilha.

**P2. Prescrição na consulta de enfermagem**
- **A:** nesta trilha não há prescrição pelo enfermeiro, só o registro.
- **B:** prescrição pelos protocolos do município (Lei 7.498/1986, art. 11, II, c). Exige o protocolo escrito de cada cliente.

**P3. Vacina**
- **A:** registro simples (imunobiológico, dose, lote, data e quem aplicou), que conta nos painéis: dTpa da gestante, vacinas da criança, influenza do idoso, HPV.
- **B:** fica fora até a integração com o SI-PNI e a RNDS (U15).

**P4. Técnico de enfermagem**
- **A:** registra sinais vitais e os procedimentos do técnico: curativo, administração de medicamento, glicemia capilar e vacina, se o P3 for A. Testes rápidos ficam com o enfermeiro.
- **B:** registra só sinais vitais.

**P5. Ordem**
- **A:** 1, 2, 3, 4, 5, 6, como na tabela.
- **B:** 4 e 5 primeiro (sinais vitais e testes rápidos, que já enchem o pré-natal e o hiperdia), depois 1, 2, 3 e 6.

Até o PR 3 sair, segue valendo: não marcar consulta com o enfermeiro na homologação.
