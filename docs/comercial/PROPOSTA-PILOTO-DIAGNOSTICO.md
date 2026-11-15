# Backlog comercial, item 5: proposta de piloto — diagnóstico

**Pedido.** Em 15/11/2026, com a matriz aprovada (item 7), o RT pediu o próximo item ("Próximo item"). O item 5 diz: "Proposta de piloto — escopo; duração; métricas; responsabilidades; preço/condição", com o critério "Documento pronto para cliente".

**Escopo.** Só diagnóstico. Preço, condições e prazos são decisões do RT. Este documento não inventa valor nenhum.

## O que já existe para apoiar a proposta

- **Playbook de implantação** (`docs/implantacao/PLAYBOOK.md`, Fase 3, tarefa 10), com a linha do tempo:
  - preparação de D-30 a D-7: cadastros, configuração, homologação e treinamento;
  - virada no D0, com ensaio no D-1;
  - operação assistida de D+1 a D+14;
  - encerramento no D+30, com aceite.
- **Treinamento por papel**, na homologação, com roteiros em `docs/implantacao/treinamento/`: recepção 1 h, enfermagem 2 h, médico 2 h, farmácia 1 h 30, mais gestor e faturamento.
- **Suporte:** canal de contato e a tela "Chamados técnicos", mostrados em cada turno na virada.
- **Segurança e continuidade:**
  - documento de segurança e LGPD;
  - plano de contingência com formulários em papel;
  - RPO e RTO: 24 h no piloto e 5 min com paciente real (PITR), recuperação em até 4 h.
  - Portão do RT: PITR ligado e restauração testada antes do primeiro paciente real.
- **Indicadores que o próprio sistema mede**, e que podem medir o piloto:
  - espera da chegada à triagem e da triagem ao médico, por cor e contra o alvo;
  - evasão com motivo;
  - permanência na observação acima de 6 horas;
  - ocupação e giro de leitos;
  - conformidade do check-in;
  - prazos da regulação;
  - indicadores C5, C4 e C3 da UBS.
- **Materiais de apoio já aprovados:** pitch deck, one-page, vídeo de venda e roteiro da demo.
- **Pendências que dependem da primeira unidade real:**
  - RNDS (unidade piloto e credencial do DATASUS);
  - importação do retorno do SIA/SIH (arquivo da secretaria).

## Decisões para o RT

**PP1. Escopo do piloto.**
- **A (recomendada):** uma UPA, com porta, observação, leitos, farmácia, gestão e faturamento SUS. É o fluxo mais pronto, e o playbook foi feito para ele.
- **B:** uma UPA, uma UBS e a regulação entre elas (rede mínima).
- **C:** a rede inteira do município.

**PP2. Duração.**
- **A (recomendada):** 90 dias. Os 30 primeiros seguem o playbook (preparação, virada e operação assistida); os 60 seguintes são de operação, com a medição.
- **B:** 60 dias.
- **C:** 180 dias.

**PP3. Métricas de sucesso.**
- **A (recomendada):** cinco métricas que o sistema mede sozinho, com linha de base nas duas primeiras semanas depois da virada e comparação no fim:
  - espera da triagem ao médico fora do alvo;
  - espera da chegada à triagem;
  - evasão;
  - permanência na observação acima de 6 horas;
  - atendimentos registrados no sistema (adesão).
  - Sem meta numérica prometida: o resultado é medido e apresentado.
- **B:** as mesmas métricas, com metas numéricas que o RT define.

**PP4. Responsabilidades e suporte.**
- **A (recomendada):**
  - **Chefe Coruja:** configuração, treinamento por papel, presença na virada, operação assistida, suporte pelo canal de chamados, backup e segurança, e o relatório de métricas no fim.
  - **Unidade:** um responsável local, a equipe na escala, computadores e internet, o protocolo de classificação da casa, os cadastros e o plano de contingência em papel.
  - O horário e o tempo de resposta do suporte são decisão do RT, sem prometer 24 horas sem decidir antes.
- **B:** outra divisão, definida pelo RT.

**PP5. Preço e condição.** Decisão do RT; nada é preenchido sem ele.
- **A:** piloto sem custo de licença, com compromisso da unidade de decidir sobre a contratação no fim.
- **B:** piloto pago com valor reduzido, abatido do contrato se a unidade contratar.
- **C:** proposta com os campos de valor em branco (`[R$ ___]`), para o RT preencher a cada cliente.
- **Recomendação:** C agora, e o RT escolhe A ou B quando tiver o primeiro cliente.

**PP6. Formato.**
- **A (recomendada):** documento editável no Claude, para o RT adaptar a cada cliente e exportar em PDF ou Word. O texto-base fica também no repositório, em `docs/comercial/proposta/`.
- **B:** PDF fixo, como a one-page.

**Decisão do RT, 15/11/2026:** PP1 a PP6 = A, e PP5 = C: campos de valor em branco ("Todas A, PP5 = C").

## Regras do conteúdo

- Nenhuma promessa de RNDS, certificação SBIS/CFM ou assinatura ICP-Brasil como pronta.
- Sem métrica inventada nem resultado garantido.
- O contrato e o termo de tratamento de dados (LGPD) ficam à parte, com o jurídico.
- Preço e condição só com os valores do RT.

## Depois

O roteiro de objeções (item 6) usa a proposta e a matriz.
