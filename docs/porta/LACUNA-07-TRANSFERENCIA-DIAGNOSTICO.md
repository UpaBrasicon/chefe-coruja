# Lacuna 7: documento e checklist de transferência (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 7 (P2), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `7.resumo_transferencia` (paciente #7, transferência externa).

## 1. Fontes (conferidas em 10/11/2026)

- **Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1**
  (https://bvsms.saude.gov.br/bvs/saudelegis/gm/2002/prt2048_05_11_2002.html):
  - (a) solicitar a vaga à Central e fazer contato prévio com o serviço que
    vai receber;
  - (b) estabilizar o paciente antes de removê-lo;
  - (d) a decisão de transferir é do médico;
  - (f) um documento de transferência acompanha o paciente e vai para o
    prontuário da unidade que recebe. Leva o diagnóstico de entrada, os
    exames e as condutas, com nome, CRM e assinatura do médico;
  - (g) autorização escrita do paciente ou do responsável, salvo quando não
    for possível;
  - (h) o médico que solicita responde pelo paciente até ele ser recebido;
  - (l) onde há Central de Regulação, nenhuma transferência sem contato com
    ela;
  - 3.3 (e): as intercorrências do transporte são registradas no documento.
- **Res. CFM nº 1.672/2003, Art. 1º:**
  - estabilização prévia;
  - contato e concordância do médico que recebe;
  - relatório completo, legível e assinado, com CRM, também assinado por
    quem recebe;
  - consentimento escrito;
  - neonato em ambulância com incubadora.
- **Res. CFM nº 2.079/2014 (UPA):**
  - passagem de plantão de médico para médico;
  - registro completo;
  - diálogo com o regulador;
  - transferência do paciente instável depois de estabilizado.
- **Res. CFM nº 2.110/2014 (SAMU), Art. 18:** o paciente transferido vai com
  relatório completo do quadro clínico.
- **Res. COFEN nº 588/2018:** trata só do transporte dentro do serviço (entre
  setores).
- Os textos extraídos estão no scratchpad da sessão
  (`transferencia-fontes.txt`).

## 2. Estado atual (master em 10/11/2026)

- **A transferência externa existe nas três telas** (porta, observação e
  internação). Hoje ela pede só o destino.
  - A regulação guarda quadro clínico, CID, sinais vitais, exames,
    medicações, transporte e o aceite do destino. Ela não tem folha impressa.
- **Documento:** não há documento de transferência. O mais próximo é o
  encaminhamento (modelo SMS003a), que já preenche sozinho os vitais da
  triagem e o número e o destino da regulação.
- **Modelo de resumo automático:** a contrarreferência à UBS. Ela tira uma
  "fotografia" na saída: unidade, datas, desfecho, CID, relato e documentos.
- **Checklist:** não há checklist de transferência. Na transferência, quase
  nenhum impeditivo de alta vale; só o agravo sem notificação ainda impede.
- **Não modelados:** acompanhante e pertences.

## 3. Pontos para o RT decidir (recomendação em A)

### T1. Documento
- **A:** um tipo novo, "Documento de transferência", com o nome que a
  Portaria 2.048 usa.
- **B:** ampliar o encaminhamento.

### T2. Conteúdo
- **A:** o mínimo das normas (diagnóstico, exames, condutas, médico com CRM),
  mais:
  - alergias;
  - últimos vitais crus;
  - prescrição vigente com a validade;
  - exames com resultado;
  - dispositivos, isolamento, contenção ativa e controlados em uso;
  - dados da regulação: número, destino, aceite e transporte.
  - A folha tem espaço para as intercorrências do transporte e para a
    assinatura do médico que recebe.
- **B:** só o mínimo das normas.

### T3. Preenchimento
- **A:** o app preenche tudo sozinho, como uma fotografia do momento, no
  modelo da contrarreferência.
  - O médico escreve o resumo clínico, as condutas e o motivo da
    transferência.
  - O resto fica só para leitura.
- **B:** tudo editável.

### T4. Checklist
- **A:**
  - contato prévio e aceite do destino (nome de quem aceitou);
  - número da regulação, ou o motivo de não haver;
  - autorização escrita do paciente ou do responsável, ou a exceção
    justificada;
  - paciente estabilizado (declaração do médico);
  - tipo de transporte e quem acompanha (médico, enfermagem);
  - isolamento informado ao destino;
  - incubadora, no neonato.
  - Cada item fica marcado ou com o motivo de não se aplicar.
- **B:** sem checklist; só o documento.

### T5. O que trava a transferência
- **A:** só trava a falta do documento de transferência emitido, que as
  normas exigem. Os itens do checklist ficam registrados, mas não travam,
  para não segurar a vaga zero nem a emergência.
- **B:** todos os itens travam.

### T6. Quem emite e quem assina
- **A:**
  - O médico transferente emite e assina, com o login e o CRM do cadastro.
  - O enfermeiro marca os itens de enfermagem: isolamento, incubadora e
    acompanhante da equipe.
  - O NIR vê o documento.
  - A folha leva o campo de assinatura do médico que recebe.

### T7. Escopo
- **A:** só a transferência externa (porta, observação, internação). A
  transferência entre setores (COFEN 588) fica para depois.

### T8. Impressão
- **A:** folha A4 em duas vias, uma para o destino e outra para o prontuário,
  com os espaços de intercorrências e da assinatura de quem recebe.

### T9. Onde aparece
- **A:**
  - na aba de desfecho ou alta, nas três telas;
  - na Regulação e no NIR;
  - na chegada regulada dentro da rede: o destino vê o documento, como já
    vê as alergias.

## 4. Fora do escopo
- O transporte em si: viatura e equipe.
- Termo de consentimento próprio. O tipo `termo_consentimento` já existe e
  pode ser usado.
- Envio à RNDS.
- Acompanhante e pertences.

## 5. Decisão do RT (10/11/2026)

"Sim": A em T1 a T9.
