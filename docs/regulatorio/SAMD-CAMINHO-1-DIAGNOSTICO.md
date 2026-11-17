# SaMD, caminho 1: plataforma fora, módulo clínico dentro (diagnóstico, 16/11/2026)

**Só ideias.** Pedido do RT: "prepara o diagnóstico do caminho 1, mas não começa nada". Este documento não muda código, banco nem BACKLOG.

**Também não é parecer regulatório.** É o mapa técnico para levar a um consultor regulatório, que é quem confirma o enquadramento, a classe e o caminho na ANVISA.

## A ideia

Dividir o Chefe Coruja em duas partes com regras diferentes:

- **Plataforma (fora de SaMD):** gestão, escala, prontuário como registro e faturamento. Continua com o ritmo de hoje: PR, CI e "ok produção".
- **Módulo clínico (dentro de SaMD):** o que usa o dado de um paciente para orientar diagnóstico ou tratamento daquele paciente. Teria versão congelada, processo de qualidade e publicação só depois da aprovação.

## Critério de fronteira (para o consultor confirmar)

A RDC 657/2022 trata como dispositivo médico o software com **finalidade médica para um paciente específico**: cálculo, alerta ou recomendação a partir dos dados dele. Registrar, mostrar, organizar, faturar e gerir não entram. Referência geral, sem dado do paciente, tende a ficar fora.

## Mapa do que existe hoje

Contagem feita no código em 16/11/2026: 331 fichas registradas em `ferramenta_versoes`.

### Fora (plataforma)

| Área | Exemplos |
|---|---|
| Escala e plantão | escala, trocas, check-in, presença, remuneração |
| Prontuário como registro | evolução, prescrição como registro, documentos, anexos, retificação, guarda de 20 anos |
| Fluxo de pacientes | porta, leitos, transferência, regulação de vaga (o fluxo, não a decisão clínica) |
| Faturamento e administração | AIH e APAC como formulário, BPA, conta, estoque, farmácia logística |
| Comunicação e pessoas | chat, avisos, convites, pessoas, chamados técnicos |
| Enfermagem por carga de trabalho | Fugulin e Dini (classificam a carga, não o paciente) |
| Cálculos aritméticos de registro | balanço hídrico |

### Dentro (SaMD provável)

| Área | O que faz | Tamanho hoje |
|---|---|---|
| Escores da Central | pontuação, faixa e próximos passos a partir dos dados do paciente | 46 escores com `calcular()` em `src/clinico/escores` |
| Condutas com dose | dose ou volume pelo peso e pela idade (adulto e pediatria) | 65 fichas adulto e 57 pediátricas em `src/clinico`; 104 arquivos citam peso ou mg/kg |
| Alertas na beira do leito | alerta de sepse do adulto, interações críticas na prescrição, Phoenix e PELOD-2 | migrations `sepse_adulto_alerta`, `interacoes_criticas`, `phoenix_pelod2` |
| Acuidade automática | NEWS2 e PEWS calculados dos sinais vitais no prontuário, e o apoio do laudo de AIH | `private.calcular_acuidade`, `apoioNews2.ts` |
| Classificação de risco | busca de fluxograma, dor, gestação, subtriagem do idoso | `src/clinico/triagem` (a cor final é da enfermagem, mas o sistema sugere) |
| Sugestão de CID | código sugerido a partir do texto da avaliação | `cid_sugerir_do_texto` |
| IA clínica | respostas da Corujinha e da `clinical-search` sobre um caso | Hermes, com o modelo DeepSeek atrás de desidentificação |

### Zona cinzenta (o consultor decide)

| Área | Por quê |
|---|---|
| Fichas só de texto (protocolos sem cálculo) | referência geral; viram SaMD se o texto mudar conforme o paciente |
| Curvas de crescimento (escore Z) | cálculo padronizado da OMS, que pode orientar conduta |
| SAE (diagnósticos de enfermagem) | sugestão de diagnóstico a partir do registro |
| Pergunta surpresa (paliativo) | rastreio prognóstico |
| Diluição e preparo | referência de preparo; vira SaMD quando calcula para o paciente |

## Como a separação ficaria no produto

1. **Módulo clínico como pacote:**
   - `src/clinico`, as telas da Central e os alertas viram um pacote com número de versão próprio, por exemplo "Chefe Coruja Clínico 1.0";
   - a plataforma chama o módulo por uma interface fixa;
   - mudar o módulo é release dele, não da plataforma.
2. **Release do módulo com cadência:** em vez de 30 lotes por dia, um release a cada 1 a 3 meses, com a lista de mudanças, a avaliação de risco de cada uma e os testes.
3. **Aprovação antes de publicar:**
   - a ficha nova só aparece para o usuário depois de aprovada;
   - até lá, a tela mostra a versão anterior;
   - hoje é o contrário: publica e depois aprova.
4. **Ligado por contrato:** o módulo clínico seria uma opção do contrato. A rede que não contratar usa só a plataforma, que fica fora de SaMD.
5. **Modo referência:** uma versão do módulo sem dado do paciente (tabelas e textos), para quem não contratar, ou enquanto o registro não sai.

## O que já existe e conta a favor

- **Fonte citada em cada ficha:** livro, diretriz ou artigo, com página; nos últimos lotes, lida no texto integral. É a base da rastreabilidade que a ANVISA pede.
- **Versões registradas:** `ferramenta_versoes`, com status de aprovação. É o embrião do controle de configuração.
- **Testes automáticos por ficha** (`*.test.ts`) e CI obrigatório no `master`. Viram parte da verificação.
- **Trilha de auditoria, guarda de 20 anos e trilha de segurança S0–S12 fechada.** Contam para cibersegurança e integridade.
- **Regras clínicas escritas:** dose só de fonte citada, nada passa do adulto para a criança, pediatria até 13a 11m 29d, a cor da classificação é da enfermagem.

## O que falta (o trabalho de verdade)

| Item | O que é |
|---|---|
| Sistema de qualidade | processo escrito no espírito da ISO 13485 e Boas Práticas de Fabricação (RDC 665/2022) |
| Gestão de risco | arquivo de risco por grupo de ferramentas (ISO 14971): o que pode dar errado, a gravidade e o controle |
| Ciclo de vida do software | IEC 62304: requisitos, arquitetura, verificação e controle de mudança documentados |
| Validação clínica | evidência de que o cálculo e a orientação estão certos, além de bater com a fonte |
| Comitê clínico | médico, farmacêutico e enfermeiro aprovando antes do release; hoje é um aprovador só |
| Tecnovigilância | canal para registrar e notificar evento adverso e falha, e recolher versão com defeito |
| Rotulagem | instruções de uso, indicação, contraindicação e limites do módulo |
| IA clínica | provedor e região compatíveis com dado de saúde, ou a IA fora do módulo |

## Decisões para o RT (para depois da conversa com o consultor)

- **R1. Fronteira**
  - **A:** só o que usa dado do paciente fica dentro (escores, doses calculadas e alertas); a referência sem dado fica fora.
  - **B:** a Central inteira dentro.
- **R2. Classificação de risco**
  - **A:** fora do módulo, como apoio de protocolo da enfermagem (a cor é sempre da enfermagem).
  - **B:** dentro. Pode puxar a classe para cima.
- **R3. IA clínica**
  - **A:** fora do módulo, sem respostas sobre um paciente: só busca na biblioteca.
  - **B:** dentro, com provedor e região trocados.
- **R4. Cadência do módulo**
  - **A:** trimestral.
  - **B:** mensal.
- **R5. Até o registro sair**
  - **A:** o modo referência para quem não for piloto.
  - **B:** manter como está, com o risco.

## Perguntas para o consultor

1. Os escores e as doses por peso ficam em que classe pela RDC 751/2022? Notificação ou registro?
2. A ficha de referência, sem dado do paciente, fica mesmo fora?
3. A classificação de risco com fluxograma, em que a enfermagem decide a cor, entra? Em que classe?
4. A sugestão de CID entra?
5. Dá para registrar o módulo separado da plataforma, no mesmo produto?
6. Que mudança no módulo exige nova petição, e qual só registro interno?
7. O que muda com a IA no módulo (provedor fora do Brasil, dado pseudonimizado)?
8. Prazo e custo realistas do primeiro ciclo, com a empresa do tamanho que é hoje.

## Ordem sugerida (quando o RT quiser começar)

1. Conversa com o consultor, levando este documento.
2. Decidir R1 a R5.
3. Gate técnico de aprovação antes de publicar. Vale para tudo, independentemente do registro.
4. Separar o pacote do módulo e o modo referência.
5. Sistema de qualidade, arquivo de risco e documentação, com o consultor.
6. Pedido na ANVISA.

O passo 3 é o único que recomendo fazer mesmo sem SaMD: ele resolve o problema de "publica antes de aprovar".
