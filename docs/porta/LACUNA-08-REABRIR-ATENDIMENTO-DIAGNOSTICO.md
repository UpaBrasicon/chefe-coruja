# Lacuna 8: reabrir o atendimento depois do desfecho (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 8 (P2). O RT liberou esta
lacuna em paralelo com a lacuna 9. Origem: relatório do teste de ponta a ponta
de 11/10/2026, passo `3.reabrir_atendimento` ("Não há RPC. Depois do
desfecho, o atendimento fica bloqueado").

## 1. Fontes (conferidas em 10/11/2026)

- **Res. CFM 1.638/2002 (prontuário):** pede o registro com data, hora e
  identificação de quem fez (art. 5º, I, c). Não trata de corrigir nem de
  reabrir.
- **Res. CFM 1.821/2007 (prontuário eletrônico):** guarda permanente e
  certificação. Não trata de corrigir.
- **Código de Ética Médica, art. 87, §1º:** registro em ordem cronológica,
  com data, hora, assinatura e CRM.
- **Lei 13.787/2018, art. 4º:** o prontuário digital deve ser protegido de
  alteração não autorizada.
- **Res. COFEN 754/2024:** revogou a 429/2012. Não trata de corrigir.
- **Conclusão:** nenhuma norma define a reabertura nem um prazo para ela.
  - A regra "acrescentar sem sobrescrever, com quem, quando e por quê" vem do
    CEM e da Lei 13.787.
  - O projeto já segue essa regra desde a Fase 1: "retificação, nunca
    apagamento".

## 2. Estado atual (master em 10/11/2026)

**Na porta:**
- O desfecho registrado pela porta fecha:
  - as prescrições;
  - os pareceres;
  - o rascunho do SOAP;
  - na transferência e no óbito, os exames sem resultado;
  - por gatilho: isolamento, contenção e contrarreferência à UBS.
- O desfecho também dispara para fora do sistema:
  - a fila da RNDS;
  - o webhook `atendimento.encerrado`.
- **Na porta não há como desfazer o desfecho.** As colunas do desfecho são
  sobrescritas, e não existe histórico.

**Na observação e na internação:** já existe `cancelar_alta`.
- Quem pode usar: o autor ou o gestor.
- Prazo: até 24 h.
- Justificativa obrigatória.
- O que volta: o status, o leito e as prescrições.
- O que fica anulado: o pacote de alta, o óbito e a contrarreferência.

**Casos que travam a reabertura:**
- o paciente tem outro atendimento aberto (só um por paciente);
- a conta está fechada ou a competência do BPA está fechada;
- o RAC já está na fila da RNDS;
- a transferência já chegou ao destino;
- o óbito da porta (não há anulação para a porta).

**Achado à parte:** `cancelar_alta` confere o gestor com
`papel_na_unidade(...) = 'gestor'`. A regra do projeto é usar
`tenho_papel`.

## 3. Pontos para o RT decidir (recomendação em A)

### R1. Quem reabre
- **A:** o médico que registrou o desfecho ou o gestor da unidade, com
  segundo fator, como no `cancelar_alta`.

### R2. Prazo
- **A:** até 24 h depois do desfecho, igual à alta.
  - Depois disso, o paciente volta por uma ficha nova.
  - A mensagem de erro passa a dizer isso. Hoje ela manda "falar com o
    gestor", que também não consegue.

### R3. Motivo
- **A:** obrigatório, escolhido numa lista:
  - erro de registro;
  - paciente voltou;
  - desfecho errado;
  - outro, com texto de 10 letras ou mais.

### R4. Quais desfechos reabrem
- **A:**
  - **Reabrem:** alta, alta após medicação, alta a pedido e evasão.
  - **Transferência:** reabre só se a saída ainda não foi marcada na
    regulação.
  - **Não reabrem:**
    - óbito (a anulação do óbito na porta fica para depois);
    - "cancelado" (retirado da fila);
    - observação e internação, que já usam o `cancelar_alta`.

### R5. Reabrir o mesmo atendimento
- **A:** o atendimento volta à etapa "atendimento".
  - O desfecho anterior fica guardado numa tabela nova de eventos do
    atendimento, com quem, quando e o motivo. Nada é apagado.
  - A reabertura é recusada se o paciente já tem outro atendimento aberto.
- **B:** só corrigir o tipo do desfecho, sem reabrir.

### R6. O que volta
- **A:**
  - **Prescrições:** voltam só os itens ainda dentro da validade de 24 h. Os
    vencidos ficam fechados (lacuna 6).
  - **Não voltam:** exames e pareceres cancelados (o médico pede de novo),
    isolamento, contenção e o rascunho do SOAP.
  - A tela avisa o que não volta antes de confirmar.

### R7. Efeitos fora do atendimento
- **A:**
  - **Conta fechada, faturada ou competência do BPA fechada:** a reabertura
    é recusada até o faturamento ou o gestor reabrir a conta.
  - **RNDS:** o RAC ainda pendente é descartado. Se já foi enviado, fica
    registrado.
  - **Webhook:** evento novo `atendimento.reaberto`.
  - **Contrarreferência à UBS:** cancelada; a UBS vê como cancelada.
  - **Documentos já emitidos:** continuam valendo. A tela avisa o médico de
    que pode cancelá-los.

### R8. Registro e onde aparece
- **A:**
  - selo "reaberto" em "Finalizados" e na linha do tempo do prontuário, com
    o desfecho anterior visível;
  - auditoria só com ids e códigos.

### R9. Tela
- **A:** ação "Reabrir" na linha de "Finalizados" da porta, para o autor do
  desfecho e o gestor. Depois de reaberto, o atendimento abre de novo na
  janela.

### R10. Achado do `cancelar_alta`
- **A:** trocar `papel_na_unidade(...) = 'gestor'` por `tenho_papel`, na
  mesma migration.

## 4. Fora do escopo
- Anulação do óbito da porta.
- Reabrir depois de 24 h.
- Desfazer a chegada no destino de uma transferência.

## 5. Decisão do RT (10/11/2026)

"Sim": A em R1 a R10.
