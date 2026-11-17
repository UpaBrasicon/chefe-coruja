# Percurso da UBS por papel: diagnóstico (17/11/2026)

Pedido do RT: "percorre e propõe". O percurso foi feito na homologação, na UBS Fase 5, com as contas `*.ubs.f5@teste.local` de recepção, enfermeiro, médico e gestor. Nas telas do enfermeiro foi feito também o rastreio no código de onde vem cada dado.

Este documento não muda código. Cada grupo traz os achados, as decisões já tomadas pelo RT e as decisões A/B que faltam.

O único dado criado no percurso foi a grade da enfermeira na homologação (decisão D1): segunda a sexta, 07–11 e 13–17, de 30 em 30 minutos. Foi criada pela função do gestor (`agenda_definir_configuracao`).

## Decisões já tomadas pelo RT

| Nº | Decisão |
|---|---|
| D1 | Grade de horário para o enfermeiro: vacinação, inserção de Implanon e outras demandas de enfermagem |
| D2 | Na escuta, o enfermeiro não envia o paciente à UPA; só o médico envia |
| D3 | A chegada na UPA é registrada sozinha quando a recepção da UPA abre a ficha do paciente enviado |
| D4 | O médico recebe o paciente direto da recepção, quando não há enfermeiro, ou pelo enfermeiro depois da escuta |
| D5 | "Encaminhados" fica com o médico e o enfermeiro: o que a UBS envia e o que a urgência devolve |
| D6 | Hiperdia, pré-natal e puericultura do médico seguem as mesmas questões do enfermeiro |
| D7 | Telemedicina fica; "Pareceres" sai do menu do médico na UBS |
| D8 | "Notificação compulsória" sai do menu do médico na UBS e fica só com o enfermeiro; o CID do médico continua gerando a sugestão |
| R8 | "Encaminhados" sai do menu da recepção |
| R9 | A recepção ganha a fila da enfermagem, para ver quem espera a escuta |
| E10 | "Alta vigilância" sai do menu do enfermeiro e fica com o farmacêutico (e o gestor, no grupo Farmácia) |

## De onde vêm os dados (rastreio no código)

| Tela | Quem alimenta |
|---|---|
| Agenda de consultas | O gestor monta a grade de cada médico ou enfermeiro. Recepção, enfermeiro, técnico, médico e gestor marcam. A escala só avisa "fora da escala" |
| Encaminhados | O médico (e hoje também o enfermeiro, na escuta) envia à UPA. A recepção da UPA marca chegou ou não chegou; sem registro em 12 h, o sistema marca "não chegou". Os retornos entram sozinhos quando a UPA ou o hospital fecha o atendimento |
| Hiperdia | Entra sozinho quando o médico fecha a consulta com hipertensão ou diabetes (problema, CIAP ou CID), ou à mão pelo médico ou enfermeiro. A pressão vem da escuta; peso, altura e pés, da consulta; HbA1c, do exame; a próxima consulta, da agenda |
| Pré-natal | Entra sozinho na conduta do médico (pré-natal, CIAP W, CID O ou Z3x) ou à mão ("Incluir gestante"). Só conta a consulta do médico. Pressão da escuta; peso e altura da consulta; testes do teste rápido ou do exame |
| Puericultura | Calculada: toda criança da UBS com menos de 2 anos. Conta a consulta em que o médico marca o problema "Puericultura" |
| Notificação compulsória | Sugerida pelo CID registrado (porta, leito, SOAP, alta). O médico ou enfermeiro de plantão (ou o gestor) abre o caso e preenche a ficha do SINAN |

## Grupos de mudança e decisões

### U1. A fila não fecha o dia

Achados R1, E1, M1: pacientes "aguardando" há 330 h e "em atendimento" há 9.474 min. A busca diz que o Carlos "já está na fila médica" por uma ficha de 03/11.

- **A:** a ficha da UBS que não foi atendida vence no fim do expediente. Fecha como "não aguardou", com registro de quem fechou (o sistema) e motivo.
- **B:** as fichas de dias anteriores aparecem à parte, e o gestor fecha à mão.

### U2. Tempo de espera em um formato só

Achados R2 e M1: "15024 min" na recepção e na escuta, "330h57" no consultório.

- **A:** um formato só em todas as filas: minutos até 1 h, depois horas e minutos, depois dias e horas.
- **B:** horas e minutos sempre.

### U3. Horário de funcionamento da UBS

Achados R3, M3 e GE2:
- a escala da UBS tem manhã, tarde e noite de 12 h todos os dias (312 plantões no mês);
- a grade da médica vai até 23:40 e inclui sábado e domingo;
- "Minha agenda" mostra noturnos e extrato financeiro.

A escala da UBS foi copiada do modelo da UPA.

- **A:** a UBS ganha horário de funcionamento na unidade (dias e horas, por exemplo 07–19 de segunda a sexta). A escala e a grade da agenda só aceitam turnos dentro dele, e a homologação é corrigida.
- **B:** o modelo fica como está; só os dados da homologação são corrigidos.

### U4. Tela do dia da recepção

Achados R4 e R9: a tela inicial da recepção é uma busca vazia.

- **A:** a tela "Hoje" junta, num lugar só, os agendados do dia (chegou ou faltou), a demanda espontânea, a fila da enfermagem (R9) e a fila médica.
- **B:** só entra no menu da recepção o item "Fila da enfermagem" (somente leitura).

### U5. Menus por papel e itens da UPA na UBS

Já decidido: R8, R9, E10, D7, D8.

Achados de itens da UPA dentro da UBS:
- **M2:** a Central do Médico mostra "Ver pacientes internados", "Ver observação" e o check-out de plantão.
- **M4:** a consulta mostra "Iniciar contenção mecânica" e "Registrar intercorrência".
- **GE1:** o Painel do Gestor tem as abas Internações, Giro de leitos e Porta e observação.
- **GE7:** no trilho, "Porta" abre Cadastros duplicados, "Leitos" abre Regulação, e o submenu tem o rótulo "Telas de null".

Decisões:
- **A:** um PR só de menus:
  - os pedidos do RT;
  - esconder na UBS os itens de UPA e hospital listados acima;
  - nomes do trilho próprios da UBS.
- **B:** só os pedidos do RT agora; os itens de UPA ficam para depois.

### U6. Consulta de enfermagem e tipo de serviço na agenda

Achados A1, A16, G1.

A consulta com a enfermeira pode ser marcada, mas não pode ser feita:
- na chegada, a ficha vai direto para o atendimento do médico;
- todo passo exige médico (`medico_na_porta`);
- o episódio fica aberto e trava ficha nova do paciente.

Também:
- os painéis contam só a consulta do médico, então o pré-natal e a puericultura intercalados com o enfermeiro ficam fora;
- a agenda não tem tipo de serviço.

**Até isso mudar, não marcar consulta com a enfermeira na homologação.**

- **A:** consulta de enfermagem completa na UBS:
  - a ficha vai para o profissional da agenda (médico ou enfermeiro);
  - o enfermeiro registra SOAP, problema e conduta da APS;
  - a consulta dele conta no hiperdia, no pré-natal e na puericultura;
  - a agenda ganha o tipo de serviço: consulta de enfermagem, vacinação, inserção de implante, DIU, coleta de preventivo, curativo, coleta de exame, outro.
- **B:** só o tipo de serviço e um registro simples do enfermeiro, que não conta nos painéis.

### U7. Sinais vitais e procedimentos na UBS

Achados A2, A3, A4:
- a pressão só é registrada na escuta inicial, e a consulta agendada não tem campo de sinais vitais;
- o técnico não tem tela para isso;
- teste rápido, vacina, implante e DIU não têm onde ser registrados na UBS;
- o procedimento não tem resultado, então um teste rápido de sífilis positivo na gestante não sugere notificação.

- **A:**
  - bloco de sinais vitais na consulta (médico e enfermeiro) e uma tela de sinais vitais para o técnico;
  - registro de procedimento na UBS com resultado para os testes rápidos (sífilis, HIV, hepatites B e C, gravidez);
  - o teste reagente sugere a notificação.
- **B:** só o bloco de sinais vitais agora; os procedimentos ficam para depois.

### U8. Escuta inicial

Já decidido: D2 e D4.

Achados:
- **D4:** a recepção escolhe o tipo de atendimento. "Escuta inicial" vai para a fila do enfermeiro mesmo sem enfermeiro de plantão, e a ficha fica parada.
- **G2:** a escuta não tem DUM.
- **A15:** a classificação azul com "agendamento" fecha com texto e não cria o agendamento.

Decisões:
- **A:**
  - sem enfermeiro na escala agora, a ficha de "escuta inicial" vai direto ao médico;
  - a escuta ganha a DUM, quando a mulher está em idade fértil e há suspeita de gestação ou gestação;
  - "azul com agendamento" abre a agenda com o paciente já escolhido.
- **B:** a recepção é avisada de que não há enfermeiro e escolhe; a DUM e o agendamento ficam como estão.

### U9. Chegada automática na UPA

Decisão D3. Hoje são dois passos à mão: "Nova ficha" e depois "Chegou", escolhendo a ficha.

- **A:** a recepção da UPA abre a ficha de um paciente com envio "enviado" para ela nas últimas 12 h. O sistema registra "chegou", liga o envio à ficha e avisa a UBS.
- **B:** ao abrir a ficha, aparece o aviso "veio da UBS", e a recepção confirma com um clique.

### U10. CID em um lugar só

Achados A6, M5, G3, A7:
- a aba Atendimento tem um CID-10 separado do problema avaliado na aba Conduta;
- o I10 ou o CID O digitado só no SOAP não põe o paciente no hiperdia nem no pré-natal;
- o CID da conduta da UBS, a lista de problemas (dengue, tuberculose, hanseníase, IST) e a CIAP não entram nas sugestões da notificação.

- **A:**
  - na UBS, o CID do SOAP vira o primeiro problema da conduta, num campo só;
  - a notificação passa a ler o CID da conduta, os problemas e a CIAP.
- **B:** os campos ficam separados, e os painéis e a notificação passam a ler os dois.

### U11. Parto, puerpério e recém-nascido

Achados A8, A9, A10, E4:
- o parto nunca é registrado sozinho, e a consulta de puerpério se perde;
- parto ou aborto no hospital não fecha a gestação da UBS;
- o recém-nascido fica cadastrado no hospital e não aparece na puericultura da UBS;
- a criança sem data de nascimento não entra;
- a gestante com bebê de 3 meses e 21 semanas de gestação foi aceita sem aviso.

- **A:**
  - o parto ou aborto registrado no hospital ou na UPA fecha a gestação na UBS de origem;
  - o recém-nascido entra na puericultura da UBS da mãe;
  - a data de nascimento passa a ser obrigatória;
  - a DUM é conferida contra parto recente da mesma mulher.
- **B:** só o aviso da DUM e a data de nascimento obrigatória; o resto fica à mão.

### U12. Dados de fora da UBS

Achados A5, A11, A12, A13:
- o exame feito fora, que chega em papel, não entra sem pedido feito no app;
- a HbA1c só conta pela integração com o laboratório;
- pressão, exame e CID da UPA não chegam ao painel da UBS, porque o cadastro é por unidade;
- a unificação de cadastros não junta o clínico;
- o hipertenso com CID I10 na UPA não chega como sugestão ao hiperdia da UBS.

- **A:**
  - resultado de exame externo sem pedido, com campos estruturados para HbA1c, sífilis, HIV e hepatites;
  - sugestão de inclusão no hiperdia a partir do retorno da UPA.
- **B:** só o resultado de exame externo; o cadastro por unidade fica para uma decisão de arquitetura à parte.

### U13. Produção e indicadores da UBS

Achados GE5 e GE6:
- os indicadores são de hospital e UPA;
- o faturamento mostra contas de porta e internação, BPA e glosas;
- a produção da UBS vai ao SISAB pelo e-SUS APS, e o app não exporta para lá.

- **A:** entra no BACKLOG como trilha própria: painel de indicadores da APS (boas práticas C1 a C7, faltas na agenda, produção por profissional) e exportação para o e-SUS APS e SISAB.
- **B:** só o painel de indicadores da APS; a exportação fica para quando houver cliente UBS.

### U14. Textos

- **E6:** "Farmácia fechada" na retirada sem farmacêutico. Na UBS, mudar para "fora do horário da farmácia".
- **M6:** "Agendamento para Nasf" na conduta. Conferir no e-SUS APS atual se virou eMulti e trocar.
- **M7:** "Em atendimento há 0 min" aparece só por abrir a ficha.
- **E7:** a lista de alta vigilância é a do catálogo global. Some do enfermeiro com E10; fica para o farmacêutico ajustar a da unidade.

Sem A/B: são correções de texto que entram junto com o U5.

## O que funciona

- Linha do tempo dos encaminhados.
- Cadastros duplicados.
- Painéis de hiperdia, pré-natal e puericultura (régua C2, C3 e C5).
- Checagem.
- Telemedicina com consentimento.
- Prazos da regulação.
- Auditoria de check-in.
- Configuração da agenda.

## Pendências fora do código

- O catálogo CID → agravo da notificação segue "70 de 70 sem conferência": a vigilância precisa conferir.
- Não há consultas marcadas na homologação; a agenda só foi avaliada vazia.

## Ordem sugerida

1. **U5 e U14:** menus e textos. Pequeno, já decidido em boa parte.
2. **U1 e U2:** fila e formato do tempo.
3. **U8 e U9:** escuta e chegada na UPA.
4. **U3:** horário de funcionamento.
5. **U10:** CID em um lugar só.
6. **U6 e U7:** consulta de enfermagem, tipo de serviço, sinais vitais e procedimentos. É o maior; sai em vários PRs.
7. **U4:** tela do dia da recepção.
8. **U11 e U12:** parto, recém-nascido e dados de fora.
9. **U13:** trilha no BACKLOG.
