# LG11: enquadramento SaMD com consultor regulatório (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG11 (P1). Base: RDC 657/2022 (software como dispositivo médico), RDC 751/2022 (classificação e regularização de dispositivos médicos) e RDC 665/2022 (boas práticas de fabricação).

**Decisão do RT, 17/11/2026: "Todas A"** (C1–C5).

Este documento não é parecer regulatório e não muda código nem banco. Quem confirma enquadramento, classe e caminho na ANVISA é o consultor.

## O que já está escrito

O diagnóstico do caminho 1 (`docs/regulatorio/SAMD-CAMINHO-1-DIAGNOSTICO.md`, 16/11/2026) traz:
- a ideia: plataforma fora de SaMD, módulo clínico dentro;
- o mapa do que fica dentro, fora e na zona cinzenta;
- o que já conta a favor e o que falta (qualidade, risco, IEC 62304, validação, comitê, tecnovigilância, rotulagem);
- as decisões R1 a R5 e as 8 perguntas para o consultor.

Este diagnóstico não repete esse conteúdo. Ele trata do que mudou desde 16/11 e de como chegar ao consultor.

## O que mudou desde 16/11/2026

| Mudança | Efeito no LG11 |
|---|---|
| **Gate de aprovação (LG10) na produção** | O passo 3 da ordem do caminho 1 está feito: ficha nova só aparece aprovada. Hoje são 332 fichas, todas com versão aprovada, e 605 versões registradas. É o embrião do controle de configuração |
| **IA saindo do DeepSeek para o Bedrock em São Paulo (LG6)** | Muda a resposta da pergunta 7 e pesa na decisão R3. A troca espera a cota da AWS |
| **Ferramentas pelo CID (F1 a F3)** | Ao escolher o CID, a tela lista as ferramentas da doença e pode levar idade e peso do prontuário para a ferramenta. O rótulo fixo é "Atalho para ferramentas de referência. A decisão é do médico." Funcionalidade nova para o consultor olhar |
| **Aviso "pensar em sepse" no atendimento (F7)** | CID infeccioso mais NEWS2 da triagem geram o aviso "Pode ser sepse. Considere: exames. A decisão é do médico." É alerta sobre um paciente específico: SaMD provável |
| **Inventário LGPD (LG4)** | O consultor recebe o mapa dos dados junto com o mapa das funções |

## Perguntas novas para o consultor

Somam-se às 8 do caminho 1:

9. O atalho de ferramentas pelo CID, que só abre a ferramenta, entra? E quando leva idade e peso do prontuário para dentro da ferramenta?
10. O aviso de sepse no atendimento (CID e NEWS2) é Classe II pela Regra 12 da RDC 751/2022? Basta o rótulo "A decisão é do médico"?
11. Um alerta calculado por regra publicada (NEWS2, qSOFA), sem aprendizado de máquina, tem caminho mais simples que o software com IA? O relatório de IA da RDC 657 vale só para a trilha da sepse com modelo (SP4 a SP6)?
12. O texto da RDC 657 está em revisão na ANVISA. Há mudança prevista que afete o pedido?

## Leitura técnica da norma (o consultor confirma)

- **Classe:** pela Regra 12 da RDC 751/2022, software que apoia decisão diagnóstica ou terapêutica ou monitora processo fisiológico tende a ficar na Classe II. A classe pode subir conforme a gravidade do que a decisão afeta.
- **Notificação ou registro:** pela RDC 751/2022, Classes I e II vão por notificação, e Classes III e IV por registro.
- **Boas práticas:** a RDC 665/2022 vale para o fabricante em qualquer classe. O nível de exigência sobe com a classe.

## Decisões para o RT

**C1. Como achar o consultor**
- **A (recomendada):** eu monto uma lista curta de 3 a 5 consultorias com experiência pública em SaMD na ANVISA, com critérios de escolha. Fonte: só informação pública dos sites delas. Você escolhe e faz o contato; eu não contato ninguém.
- **B:** você já tem um nome, e eu só preparo o material.

**C2. Escopo do primeiro contrato**
- **A (recomendada):** só o enquadramento: fronteira do módulo, classe de cada grupo, notificação ou registro, respostas às 12 perguntas e estimativa de prazo e custo do resto. Custa menos e decide o resto.
- **B:** pacote completo de regularização desde já: sistema de qualidade, arquivo de risco, documentação IEC 62304 e pedido.

**C3. Mapa do módulo clínico**
- **A (recomendada):** um mapa gerado do código, no mesmo molde do LG4. Cada ferramenta e cada alerta fica marcado como dentro, fora ou zona cinzenta, com o motivo. Um teste do CI falha se aparecer ferramenta nova sem marcação. O consultor recebe a lista completa e atual.
- **B:** um documento escrito à mão para a reunião.

**C4. Enquanto o consultor não responde**
- **A (recomendada):** seguir com as trilhas. Toda função nova que usa dado do paciente para sugerir algo (como o F7) entra no mapa como "SaMD provável", com o rótulo "A decisão é do médico". Alerta automático novo só com o seu ok.
- **B:** congelar funções novas de decisão clínica até o enquadramento.

**C5. Rotulagem mínima já agora**
- **A (recomendada):** uma página "Sobre o módulo clínico", ligada na Central. Ela diz a finalidade, para quem é (profissional de saúde), os limites, as fontes, que o apoio não substitui o julgamento clínico e o canal para relatar erro. Antecipa a rotulagem e serve de base ao LG12 (tecnovigilância). O texto passa por você antes de ir ao ar.
- **B:** esperar o consultor.

As decisões R1 a R5 do caminho 1 continuam para depois da conversa com o consultor.

## Plano depois das decisões

1. Com C3 = A: mapa do módulo clínico gerado do código, com guarda no CI. PR próprio.
2. Com C1 = A: lista curta de consultorias e critérios de escolha em `docs/regulatorio/LG11-CONSULTORES.md`.
3. Dossiê para a primeira reunião: este diagnóstico, o caminho 1, o mapa do módulo, o inventário LGPD (LG4) e o RIPD (LG3).
4. Rascunho do e-mail de contato, para você enviar.
5. Com C5 = A: texto da página "Sobre o módulo clínico" para a sua aprovação, depois homologação, CI e "ok produção".
6. O LG11 fica "esperando o consultor" até a resposta. O próximo item da trilha (LG13) começa sem esperar.
