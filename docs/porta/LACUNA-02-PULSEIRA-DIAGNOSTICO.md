# Lacuna 2: pulseira de identificação (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 2 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `1.pulseira`.

## 1. Fonte

**Protocolo de Identificação do Paciente** (Anexo 02 da Portaria MS/GM nº
2.095/2013; Ministério da Saúde, Anvisa e Fiocruz, 2013). PDF:
https://proqualis.fiocruz.br/sites/proqualis.fiocruz.br/files/Protocolo%20de%20Identifica%C3%A7%C3%A3o%20do%20Paciente.pdf

O que o protocolo diz, resumido:

- **Identificadores (4.1):** pelo menos dois, numa pulseira branca
  padronizada, conferida antes do cuidado.
  - Adulto: em geral no punho.
  - Recém-nascido: de preferência no tornozelo.
- **Quais identificadores (5.1.1):** nome completo do paciente, nome completo
  da mãe, data de nascimento e número do prontuário.
- **Recém-nascido (5.1):** no mínimo, o nome da mãe e o número do prontuário
  do RN.
- **Desconhecido (5.1.1 e 5.1.2):**
  - o prontuário e as características físicas mais relevantes, incluindo
    sexo e raça;
  - quando chega de ambulância, também o local e o horário do resgate e o
    número do atendimento.
- **O que não usar:**
  - o leito, o quarto ou a enfermaria nunca servem de identificador (5.1.2);
  - pulseiras coloridas de alerta ou etiquetas não servem como identificador
    (Apêndice I.b).
- **Impressão (5.1.1, 5.2.10 e Apêndice V):**
  - pode ser impressa ou escrita à mão;
  - a etiqueta precisa caber na pulseira e ser durável;
  - mesma disposição e ordem em toda a unidade;
  - nascimento em DD/MM/AAAA, nome completo sem abreviatura;
  - letra comum de 12 a 14 pt no mínimo, sem itálico.
- **Reposição (5.1):** o serviço define o que fazer quando a pulseira cai,
  fica ilegível ou é removida.
- **Confirmação (4.3 e 5.2):** antes de medicamento, sangue, coleta, dieta e
  procedimento invasivo, perguntar o nome completo e o nascimento e conferir
  com a pulseira.

## 2. Estado atual (master em 10/11/2026)

- **Pulseira:** não há rota, função nem folha. Também não há biblioteca de
  código de barras ou QR no app.
- **Folhas:** toda impressão é A4 (`src/lib/folhas.ts`). O cabeçalho do
  paciente traz o leito, que o protocolo proíbe como identificador.
- **Registro da impressão:** `registrar_impressao` grava em
  `log_acesso_prontuario` e devolve um protocolo IMP-. Pela regra do
  projeto, papel sem protocolo não saiu do sistema.
- **Dados disponíveis:**
  - nome, nome social, nascimento (real ou estimado), sexo, raça/cor,
    prontuário, CNS e nome da mãe;
  - marca e sinais do não identificado (lacuna 1);
  - RN ligado à mãe;
  - estado de alergia.
- **Onde caberia o botão:**
  - recepção, logo depois da ficha, do não identificado e do RN;
  - reimpressão na triagem, no PS e na lista de internados.
  - A UBS já esconde o fluxo do não identificado.

## 3. Pontos para o RT decidir (recomendação em A)

### P1. O que vai na pulseira do adulto e da criança
- **A:** nesta ordem fixa:
  1. nome completo, sem abreviar;
  2. nome social, se houver, numa linha abaixo, sem tirar o nome civil;
  3. data de nascimento DD/MM/AAAA;
  4. prontuário;
  5. nome da mãe, quando cadastrado.
  - Sem leito, diagnóstico ou setor.
- **B:** só nome completo, nascimento e prontuário.

### P2. Pulseira do não identificado
- **A:** nome provisório ("Não identificado <prontuário>"), prontuário, sexo
  aparente, raça/cor se registrada e "idade estimada: N anos" no lugar da
  data. Não se imprime data estimada como se fosse real.
  - Os sinais, que podem ter até 500 letras, entram resumidos no espaço da
    etiqueta.
  - Depois de "Identificar paciente", o app avisa para trocar a pulseira.
- **B:** só o nome provisório e o prontuário.

### P3. Pulseira do recém-nascido
- **A:** nome da mãe ("RN de <mãe>", com a ordem dos gêmeos), prontuário do
  RN, nascimento DD/MM/AAAA e sexo, em tamanho de RN.
  - O botão aparece logo depois do cadastro do RN.
- **B:** só o mínimo do protocolo: nome da mãe e prontuário do RN.

### P4. Código de barras ou QR
- **A:** sem código por enquanto. Não há leitor no app nem processo que use
  o código; dá para entrar depois.
- **B:** código com o prontuário.

### P5. Alergia e risco
- **A:** nada na pulseira branca de identificação. A alergia continua no
  sistema e nas folhas, que já têm a faixa de alergia.
  - Pulseira de alerta colorida depende de uma regra da unidade: fica para
    depois, se a unidade adotar.
- **B:** texto "ALERGIA" na pulseira branca quando houver alergia registrada.

### P6. Formato da impressão
- **A:** etiqueta do tamanho da pulseira (cerca de 2,5 × 10 cm), com letra de
  12 pt ou mais.
  - Sai numa folha comum, para recortar e prender na pulseira branca, e
    serve em qualquer impressora.
  - Se a unidade tiver impressora térmica de pulseira, ganha um modo próprio
    depois, sem mudar o conteúdo.
- **B:** só impressora térmica de pulseira (rolo de 25 × 280 mm).

### P7. Onde fica o botão
- **A:** "Imprimir pulseira" na recepção, logo depois da ficha, do não
  identificado e do RN.
  - "Reimprimir pulseira" na triagem, no PS e na lista de internados.
  - Não aparece na UBS.
- **B:** só na recepção.

### P8. Registro e reimpressão
- **A:** toda impressão grava pelo `registrar_impressao`, com protocolo
  IMP-, quem imprimiu (o login) e quando.
  - A reimpressão pede o motivo: caiu, ilegível, paciente identificado,
    dados corrigidos ou outro.
- **B:** a impressão não deixa registro.

## 4. Fora do escopo
- **Lembrete de conferência:** conferir a pulseira antes de medicar ou
  coletar continua como prática da equipe. Um lembrete no app pode entrar
  depois, na checagem.
- **Pulseira de alerta colorida:** ver P5.

## 5. Decisão do RT (10/11/2026)

"A em todos": A em P1 a P8.
