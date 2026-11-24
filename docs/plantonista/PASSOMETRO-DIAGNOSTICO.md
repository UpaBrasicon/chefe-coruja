# Passômetro do médico e divisão do descanso: diagnóstico (PS1 a PS5)

Pedido 8 da lista "Pedidos do RT em 17/11/2026" do BACKLOG. Saiu do item 6 (tela do celular, CM4 = A): "Meu plantão: passômetro do médico e dividir descanso". O RT escolheu começar por ele em 23/11/2026. Diagnóstico lido na master (8f191fd8). Nada foi programado.

## 1. O que já existe

- **Passagem de plantão do médico, paciente a paciente** (`passagens_plantao`, Fase 3.5). Quem passa escreve um resumo de pelo menos 15 letras e escolhe um colega escalado no setor, agora ou nas próximas 12 horas. O colega aceita, ou recusa com motivo. Passagem que aguarda aceite trava o check-out. Aparece no leito, no box da observação e na lista de "Meu plantão" (`/plantao`, `PassagensDoPlantao.tsx`).
- **Passagem da enfermagem, do setor, leito a leito** (`passagens_enfermagem`). Leva um texto por paciente, a observação geral do setor e o retrato das pendências do turno (aprazamentos atrasados). Outra pessoa da enfermagem dá ciência. Não se apaga (guarda de 20 anos).
- **Escala e presença** (`escala_plantao` por setor, data e turno; `presenca_plantonista` com check-in e check-out). Hoje o banco já sabe quem está de plantão com quem.
- **Aba "Meu plantão" no celular** (`InicioCelular.tsx`, CM4 = A). Mostra o cartão do turno, o próximo plantão, os favoritos e os mais usados.
- **Não existe:**
  - a lista de trabalho do médico durante o plantão (os pacientes dele, com o que falta fazer em cada um);
  - uma folha do setor que reúna essa lista;
  - qualquer registro de descanso: quem descansa, quando e quem cobre.

## 2. O que o pedido quer dizer

- **Passômetro:** na prática do plantão, é a folha que o médico leva durante o turno, com leito, nome, diagnóstico e as pendências de cada paciente ("checar potássio às 18h", "ver tomografia", "família vem às 20h"). No fim do turno, ela vira a passagem. Hoje isso fica em papel ou no bloco de notas do celular, fora do prontuário.
- **Dividir descanso:** em plantão de 12 ou 24 horas com mais de um médico, a equipe combina quem descansa em cada janela da madrugada, deixando sempre alguém acordado. Hoje isso é combinado de boca ou no grupo de mensagens.

## 3. Referências reais (Refero)

- **Lista de trabalho com marcação e hora:**
  - Amie (refero.design/screens/0f72c930-2314-4734-9ad1-a1dafc7ddbb5): seções, caixa de marcar e o horário à direita.
  - Structured (refero.design/screens/c02ea4ca-f552-4c74-b7e6-51d2f7d55031): cartões empilhados com ícone e duração.
- **Histórico de quem mudou o quê:** Todoist (refero.design/screens/a9725c6e-636c-4087-b4e1-cd83eeaf207a).
- **Quem está em cada janela de tempo:**
  - Wrike, carga da equipe (refero.design/pages/3003f1bf-b086-416f-994c-5260412f3377): uma linha por pessoa e o tempo na horizontal, com a marca de "agora".
  - Fresha, escolha de horário (refero.design/screens/0855839d-35ab-4f61-8fc8-49fbab90ef0e): janelas empilhadas para escolher a sua.

## 4. Decisões

### PS1. Passômetro: de onde vêm os pacientes

**A (recomendo).** O app monta a lista sozinho com os pacientes que o médico cuida no plantão: a observação e a internação dos setores da escala dele, a mesma regra de acesso de hoje (`cuido_da_internacao`). Cada linha traz leito, nome, idade, dias no leito e diagnóstico, tirados do prontuário. Ninguém digita nome de paciente fora do sistema.

**B.** Lista livre, digitada pelo médico e guardada no aparelho, como no app de referência. É mais rápida de fazer, mas põe nome e diagnóstico de paciente no celular, fora do prontuário, da auditoria e da LGPD do sistema. Não recomendo.

### PS2. Pendências de cada paciente

**A (recomendo).** Cada paciente ganha uma lista curta de pendências, cada uma com texto, hora opcional ("às 18h") e caixa de feito. Ficam no banco, ligadas à internação, com autor = login e hora. Quem marca feito também fica registrado. As pendências abertas seguem com o paciente: o médico seguinte as vê e o resumo da passagem já começa com elas. Entram na guarda de 20 anos como a passagem, porque fazem parte do cuidado.

**B.** Pendências só do autor, visíveis a ele, que somem no check-out. Menos registro, mas o que não foi feito não chega ao colega.

### PS3. Folha do setor

**A (recomendo).** Botão "Imprimir passômetro" com a lista do setor numa folha A4 (leito, paciente, diagnóstico, pendências abertas, espaço para anotar à mão), para quando o celular ou o computador não estiver à mão. Abrir e imprimir fica no registro de acesso ao prontuário, como no pacote de alta.

**B.** Só na tela, sem impressão.

### PS4. Dividir descanso

**A (recomendo).** No "Meu plantão", os médicos do mesmo turno e da mesma unidade veem a madrugada em janelas, com início, fim e tamanho das janelas definidos pelo gestor da unidade. Cada médico marca a sua. O app mostra quem está descansando agora e quem está acordado. Também não deixa marcar uma janela que derrube o mínimo de médicos acordados, também definido pela unidade (padrão: 1). Não há dado de paciente aqui.

**B.** O app divide sozinho: pega os médicos com check-in no turno e reparte a janela da unidade em partes iguais, na ordem do check-in. Cada um pode trocar com um colega.

**C.** Não fazer: a divisão segue fora do sistema.

### PS5. Quem mais vê o descanso

**A (recomendo).** A enfermagem do setor e o gestor veem, só para leitura, quem está descansando agora e quem está acordado. É para chamar a pessoa certa numa intercorrência.

**B.** Só os médicos do turno.

## 5. O que entra se for tudo A

- **Banco:** duas tabelas novas, `pendencias_paciente` (internação, texto, hora, feito, autor, quem fez e quando) e `descanso_plantao` (plantão da escala, início, fim). Também entram as janelas e o mínimo acordado na configuração da unidade. As RPCs usam a mesma regra de acesso da passagem e o segundo fator. Migration expand, com volta escrita e testada na homologação, e operação nova no inventário LG4.
- **Telas:**
  - passômetro no "Meu plantão" (no computador e na aba do celular), com a pendência também no leito e no box da observação;
  - resumo da passagem que já começa com as pendências abertas;
  - folha A4;
  - faixa do descanso no "Meu plantão" e, só de leitura, na enfermagem e no gestor.
- **Ordem:** banco das pendências → passômetro e pendências → folha A4 → descanso. Cada parte vai em PR próprio, passa pela homologação e só vai à produção com o seu ok.

## 6. Perguntas ao RT

1. PS1 a PS5: A ou B em cada um? (No PS4 há também a C.)
2. Se PS4 = A ou B: qual é a janela de descanso padrão da madrugada (ex.: 00h às 06h) e o tamanho de cada janela (ex.: 2 horas)? Cada unidade pode mudar depois.
