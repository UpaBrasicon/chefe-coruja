# Redesenho do "Prontuário completo": diagnóstico

Este é o achado guardado de 08/10/2026, encontrado no teste da tarefa 8 da Fase 1. O RT o abriu em 06/11/2026 como item 6 da frente "Achados guardados".

## Onde a tela aparece
A página é `src/pages/prontuario/ProntuarioLeitura.tsx`, na rota `/prontuarios/:pacienteId`. Ela é aberta de vários lugares:
- botão "Prontuário completo" da janela de atendimento da porta;
- "Ler prontuário" nos pedidos de acesso e na telemedicina;
- mapa de leitos do gestor;
- notificação compulsória e ficha do SINAN;
- link do histórico encerrado.

Abrir a página grava o acesso (`abrir_prontuario`). Ela é só de leitura, e os cadastros unificados aparecem juntos (`cadastros_do_paciente`).

## O que a tela mostra hoje e o que está ruim
| Bloco | Hoje | Problema |
|---|---|---|
| Atendimentos | Lista de episódios: data, etapa, desfecho e a primeira classificação encontrada | Não mostra a unidade, o setor, o médico nem o CID. A reclassificação some. Nada do que foi feito no atendimento aparece junto dele |
| Regulações | Cartão `HistoricoRegulacao` | Fica solto entre atendimentos e documentos |
| Documentos | Todos os documentos do paciente, do mais novo ao mais antigo, com o texto inteiro aberto | Não estão agrupados por atendimento, embora tenham `episodio_id`. Com muitos documentos, a página vira um rolo |
| Sinais vitais | As 60 medidas mais recentes, uma linha por medida | Uma aferição completa ocupa 6 ou 7 linhas. Não há agrupamento por atendimento nem por horário. Medidas mais antigas não aparecem |
| Prescrições | As 20 mais recentes, com os itens | Sem atendimento, sem internação e sem autor |
| Fora da tela | — | A internação (setor, leito, entrada e alta), os exames e resultados e o registro do atendimento (SOAP) não aparecem. Todos têm `episodio_id` no banco |

**No banco** (homologação, 06/11/2026), tudo o que a tela precisa já traz o episódio:
- `episodio_id` aparece em `documentos_clinicos`, `prescricoes`, `observacao`, `classificacoes_risco`, `atendimento_registros`, `exames_pedidos` e `internacoes`;
- `documentos_clinicos`, `prescricoes`, `observacao` e `exames_pedidos` também trazem `internacao_id`.

**Consequência:** dá para montar a linha do tempo por atendimento sem mudar tabela nenhuma.

## Ligação com o item 7
O item 7 (08/10/2026) diz que o histórico encerrado fica poluído com muitos atendimentos. Hoje são até 200, um por linha. O agrupamento que este item define (por atendimento, com os mais recentes primeiro e "ver mais") serve também para o item 7.

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| P1 | Organização | **Linha do tempo por atendimento.** O mais recente fica no topo. Cada atendimento é um bloco que abre e fecha e reúne tudo dele: classificação e reclassificação, registro do atendimento, documentos, prescrições, sinais vitais, exames, internação e desfecho. No topo, fixo: identificação, alergias e regulações | Manter os blocos por tipo, com um filtro por atendimento |
| P2 | Conteúdo | Incluir o que falta: unidade, setor, médico e CID do atendimento, a internação (setor, leito, entrada e alta), os exames com resultados e o registro do atendimento. Cada leitura nova tem de respeitar o pedido de acesso, e o teste confere isso | Só reorganizar o que a tela já mostra |
| P3 | Sinais vitais | Tabela por aferição: uma linha por horário e colunas PA, FC, FR, temperatura, SpO2, glicemia e dor. Os valores saem crus, sem marca de alterado (regra clínica) | Lista atual, uma linha por medida |
| P4 | Quanto carregar | Os 5 atendimentos mais recentes vêm de início, com o primeiro aberto. "Ver mais atendimentos" busca os seguintes. Documentos longos aparecem recolhidos, com "ler tudo" | Tudo de uma vez |
| P5 | Item 7 | Fica separado: entra depois, reaproveitando o agrupamento deste item | Juntar os itens 6 e 7 numa entrega só |
| P6 | Visual | Antes do código, buscar no Refero telas reais de prontuário e de linha do tempo clínica e trazer 2 ou 3 direções em maquete, como na trilha de revisão visual | Seguir o padrão atual de cartões, só reorganizado |
| P7 | Impressão (`ImpressaoProntuario.tsx`) | Não muda nesta tarefa | Acompanhar a nova ordem |

## Plano com A em tudo
1. **Direções visuais (P6):** busca no Refero e 2 ou 3 maquetes com a referência citada. O RT escolhe antes de qualquer código.
2. **Testes antes:**
   - Unidade: função pura que agrupa os registros por atendimento e por aferição, com casos de reclassificação, documento sem episódio e cadastro unificado.
   - Banco: com pedido de acesso vigente, a leitura dos dados novos (internação, exames e registro do atendimento) funciona. Sem pedido, falha. E abrir continua gravando o acesso.
3. **Banco:** se alguma leitura nova não aceitar o pedido de acesso, uma RPC só de leitura (`prontuario_leitura(p_paciente, p_antes)`) devolve os atendimentos já agrupados e paginados. A migration é só aditiva.
4. **Tela:** `ProntuarioLeitura.tsx` refeita na direção escolhida, e as rotas e links continuam iguais.
5. **Homologação:** conferência no Chrome como médico (pela porta) e como gestor (pelo mapa de leitos), com um paciente de teste que tenha mais de um atendimento.

## Riscos
- **Vazar dado por uma leitura nova:** quem lê pelo pedido de acesso só pode ver o que o pedido cobre. O teste de banco do passo 2 é obrigatório.
- **Tela lenta com muitos atendimentos:** a P4 limita a carga inicial.
