# Lacuna 4: registro de contenção mecânica (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 4 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `8.contencao` (paciente #12, enfermeiro).

## 1. Fontes (conferidas no texto em 10/11/2026)

- **Resolução COFEN nº 746/2024**, de 20/03/2024 (DOU de 03/04/2024).
  https://cofen.gov.br/?p=123844
  - Art. 1º: a contenção mecânica só se usa quando é o único meio disponível
    para prevenir dano imediato ou iminente. Pelo §1º, sob a supervisão
    direta do enfermeiro.
  - Art. 2º: todo paciente contido é monitorado pela equipe de enfermagem.
  - Art. 3º: o prontuário registra as razões, a duração, as avaliações, os
    eventos adversos e o monitoramento clínico.
  - Art. 4º: revoga a Resolução COFEN nº 427/2012.
  - A 746 não fixa intervalo de monitoramento, duração máxima nem regra para
    crianças.
- **Nota Técnica ANVISA GVIMS/GGTES/DIRE5 nº 07/2026** (08/10/2026),
  prevenção de óbito ou lesão grave na contenção física. É orientação de
  boa prática, não norma.
  - A contenção é medida excepcional e requer prescrição.
  - O médico prescreve com justificativa, período previsto e critérios de
    reavaliação e suspensão, e renova a prescrição a cada 24 horas.
  - A enfermagem monitora em intervalos que não passem de 1 hora:
    consciência, sinais vitais, pele e circulação.
  - Registram-se a justificativa, o tipo, a duração, os eventos adversos e o
    acompanhamento.
  - A contenção é retirada assim que os critérios acabam, e a família é
    informada.
  - Óbito ou lesão grave é evento que nunca deveria ocorrer e vai ao
    Notivisa em 72 h.
- **Resolução CFM nº 2.057/2013, Art. 16:** prescrição médica, registro,
  supervisão e comunicação à família. O texto trata dos serviços de
  assistência psiquiátrica; aplicá-lo à UPA é interpretação.
- Os textos extraídos estão guardados fora do repositório (scratchpad da
  sessão, `contencao-fontes.txt`).

## 2. Estado atual (master em 10/11/2026)

- **Intercorrência:** a de agitação (`intercorrencias`, código `agitacao`) só
  aceita inserção, sem início, fim ou revisão. Não serve como registro de
  contenção.
- **Precedente aproveitável:** o isolamento (`isolamentos_paciente`).
  - Quem marca e quando, quem retira, quando e por quê.
  - Um ativo por vez; sai sozinho na alta.
- **Prescrição:** o item é "medicamento" ou "cuidado" (texto livre). Não há
  tipo de contenção, e o cuidado não pode ser alterado, só suspenso.
- **Relógios que existem:**
  - aprazamento com tolerância de 2 h, que não serve para intervalo de 1 h;
  - hora marcada de reavaliação no PS e na observação;
  - aviso por job a cada 15 min, como no SLA da regulação.
- **Linha do tempo do prontuário:** não mostra intercorrências. Não há folha
  impressa de intercorrência nem de contenção.
- **Citação revogada:** `src/clinico/adulto/agitacao.ts:102` cita a
  Resolução COFEN 427/2012, que foi revogada.

## 3. Pontos para o RT decidir (recomendação em A)

### K1. Base normativa
- **A:** a Resolução COFEN 746/2024 é a regra. A Nota Técnica ANVISA 07/2026
  vira o padrão da unidade: monitoramento de até 1 h e renovação médica em
  24 h. A citação da 427 em `agitacao.ts` passa para a 746/2024.
- **B:** só a 746/2024, sem os intervalos da nota.

### K2. Quem inicia e quem registra
- **A:** o enfermeiro ou o médico inicia a contenção.
  - O técnico registra o monitoramento e a retirada, sob a supervisão do
    enfermeiro, mas não abre a contenção.
- **B:** só o enfermeiro inicia.

### K3. Prescrição médica
- **A:** a contenção exige prescrição médica.
  - Na urgência, a enfermagem pode iniciar antes. Nesse caso, o app avisa o
    médico de plantão na hora e mantém o alerta "contenção sem prescrição"
    até a prescrição ser feita.
- **B:** a prescrição tem de vir antes, sem exceção.

### K4. Forma da ordem médica
- **A:** um tipo novo de item na prescrição, "Contenção mecânica", com:
  - motivo, pontos, período previsto e critérios de retirada;
  - validade de 24 h e aviso de renovação.
- **B:** o "cuidado" em texto livre que já existe.

### K5. Registro
- **A:** um registro próprio de contenção, no modelo do isolamento: início,
  revisões e retirada.
  - Uma contenção ativa por paciente.
  - Ela se encerra na alta, com a retirada registrada.
- **B:** um tipo novo de intercorrência.

### K6. Reavaliação
- **A:** a enfermagem registra uma revisão a cada 1 h no máximo.
  - O atraso aparece como selo no leito e no PS da enfermagem, e como aviso
    ao enfermeiro do setor.
  - O médico renova a prescrição a cada 24 h, com aviso.
- **B:** intervalo configurável pela unidade, até 1 h.

### K7. Campos
- **A:**
  - **Início:** motivo, alternativas tentadas, tipo e pontos, hora de início
    e quem iniciou.
  - **Cada revisão:** consciência ou RASS, sinais vitais crus, pele, perfusão,
    necessidades fisiológicas e intercorrência.
  - **Retirada:** hora, motivo e quem retirou.
  - **Família:** informada (sim ou não, quem, quando).
  - **Eventos adversos:** registrados como intercorrência ligada à contenção.
- **B:** só início, retirada e texto livre.

### K8. Onde vale e onde aparece
- **A:** vale no PS (porta), na observação e na internação.
  - A contenção ativa e as revisões ficam no leito e na gaveta da
    enfermagem.
  - A Linha do tempo do prontuário passa a mostrar as contenções e também
    as intercorrências.
  - O gestor ganha um relatório: taxa de uso, tempo médio, revisões no
    prazo e eventos adversos (indicadores da nota técnica).
- **B:** só na internação.

### K9. Pediatria (até 13a 11m 29d)
- **A:** as mesmas regras, sem conteúdo clínico próprio, porque nem a 746
  nem a nota técnica trazem regra pediátrica. O registro mostra que o
  paciente é pediátrico.
- **B:** bloquear em pediatria.

### K10. Impressão
- **A:** uma folha de registro e monitoramento da contenção. A nota técnica
  cita esse formulário.
- **B:** só no prontuário.

## 4. Fora do escopo
- Contenção química: é medicação e já passa pela prescrição.
- Grades de cama.
- Notificação ao Notivisa.
- Treinamento da equipe.
