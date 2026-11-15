<!-- Texto-base da proposta de piloto (backlog comercial, item 5). A versão editável fica no documento do Claude; os campos entre colchetes são preenchidos pelo RT a cada cliente. -->

# Chefe Coruja — proposta de piloto

## Apresentação

Propomos um piloto de 90 dias do Chefe Coruja em uma UPA de **[nome da unidade]**, de **[município]**, com a porta, a observação, os leitos, a farmácia, a gestão e o faturamento SUS no mesmo sistema. No fim, a unidade recebe um relatório com cinco indicadores medidos pelo próprio sistema e decide sobre a contratação.

O Chefe Coruja é o prontuário e a gestão para a rede pública de saúde: da porta à alta, da UPA à UBS. Só entra quem está na escala, toda ação tem autor, e a decisão clínica é sempre do profissional.

## Escopo

O piloto cobre uma UPA inteira, com todos os papéis da unidade usando o sistema no atendimento real.

| Área | O que entra no piloto |
| --- | --- |
| Recepção e triagem | Ficha com busca antes de cadastrar, prioridade legal automática, classificação de risco da enfermagem com o protocolo da unidade, chamada em painel |
| Atendimento | Prontuário do pronto-socorro, CID sugerido pela hipótese, NEWS2, prescrição estruturada com aviso de alergia e peso, exames, atestado, receita e desfechos |
| Medicação e farmácia | Aprazamento, checagem com nome e hora, interações críticas, alta vigilância e dispensação |
| Observação e leitos | Prazo de 6 horas, mapa de leitos com reserva, higienização e bloqueio com motivo |
| Escala e presença | Escala do mês, check-in com localização e trocas aprovadas pelo gestor |
| Gestão | Porta ao vivo, indicadores com filtros e exportação, perguntas em português |
| Faturamento SUS | Contas do atendimento, BPA, AIH e APAC, com as pendências antes do fechamento |
| Apoio clínico | Central do Plantonista com 232 ferramentas revistas e IA que responde com fonte |

A regulação com outras unidades e a UBS ficam para depois do piloto, se a rede quiser ampliar.

## Duração e etapas

O piloto dura 90 dias, contados a partir da virada. Os primeiros 30 seguem o playbook de implantação; os 60 seguintes são de operação normal, com a medição.

| Quando | Etapa | O que acontece |
| --- | --- | --- |
| D-30 a D-7 | Preparação | Cadastros da unidade, configuração, conferência no ambiente de homologação e treinamento de cada papel |
| D-1 | Ensaio | Um plantão simulado com a equipe que vai virar |
| D0 | Virada | A unidade passa a atender no sistema, com a equipe do Chefe Coruja presente em cada turno |
| D+1 a D+14 | Operação assistida | Acompanhamento próximo, ajustes e coleta da linha de base das métricas |
| D+30 | Encerramento da implantação | Aceite da implantação com o responsável local |
| D+31 a D+90 | Operação medida | Uso normal e acompanhamento das métricas |
| D+90 | Fim do piloto | Relatório com as métricas e reunião de decisão sobre a contratação |

A data da virada é combinada com a unidade. A preparação começa 30 dias antes dela, e o prazo de 90 dias passa a contar no D0.

## Métricas

O piloto é medido com dados que o próprio sistema registra no atendimento. Ninguém precisa preencher planilha à parte.

| Métrica | Como é medida |
| --- | --- |
| Espera da triagem ao médico fora do alvo | Parcela dos pacientes chamados pelo médico depois do tempo-alvo da sua cor de classificação |
| Espera da chegada à triagem | Tempo entre a abertura da ficha e o início da classificação |
| Evasão | Pacientes que saíram sem atendimento, com o motivo registrado |
| Permanência na observação acima de 6 horas | Pacientes que passaram do prazo da observação sem desfecho |
| Adesão | Parcela dos atendimentos da unidade registrados no sistema |

**Linha de base.** As duas primeiras semanas depois da virada servem de linha de base. No fim do piloto, os mesmos números são comparados com ela.

**Sem meta prometida.** Esta proposta não fixa meta numérica nem garante resultado. O que se entrega é a medição: os números do início e do fim, apresentados à unidade no relatório final.

A gestão da unidade acompanha esses indicadores no próprio sistema durante todo o piloto, sem esperar o relatório.

## Responsabilidades

**O Chefe Coruja entrega:**

- a configuração da unidade no sistema: setores, leitos, escala, protocolos e usuários;
- o treinamento por papel, no ambiente de homologação: recepção (1 h), enfermagem (2 h), médico (2 h) e farmácia (1 h 30), mais gestor e faturamento;
- presença na virada, em cada turno do D0;
- a operação assistida do D+1 ao D+14;
- suporte pelo canal de chamados técnicos do sistema;
- cópia de segurança, controle de acesso e auditoria dos dados;
- o relatório de métricas no fim do piloto.

**A unidade entrega:**

- um responsável local, que responde pela unidade durante o piloto;
- a equipe na escala dos treinamentos e da virada;
- computadores e internet nos postos de trabalho;
- o protocolo de classificação de risco adotado pela casa;
- os cadastros da unidade: profissionais, setores e leitos;
- o plano de contingência em papel, com os formulários entregues na implantação.

**Suporte.** Horário de atendimento: [a definir]. Tempo de resposta: [a definir].

## Segurança, dados e continuidade

- **Acesso:** segundo fator em todo login, perfil por papel na unidade e tela que bloqueia depois de 10 minutos parada.
- **Auditoria:** cada ação fica registrada com o autor, numa trilha de auditoria encadeada.
- **Dados:** guardados em São Paulo, com cópia diária cifrada guardada por 20 anos (Lei 13.787/2018). A IA clínica não recebe a identidade do paciente.
- **Recuperação:** antes do primeiro paciente real, a recuperação ponto a ponto é ligada e uma restauração é testada. Com ela, a perda máxima é de 5 minutos de dados, e o sistema volta em até 4 horas.
- **Contingência:** se a conexão cair, o sistema segue em modo sem conexão e a unidade tem o plano em papel, com os formulários entregues na implantação.
- **Para a TI da unidade:** um documento de segurança e LGPD acompanha esta proposta.

O contrato e o termo de tratamento de dados pessoais (LGPD) são documentos à parte, assinados antes da virada.

## Investimento

| Item | Valor |
| --- | --- |
| Implantação (preparação, treinamento, virada e operação assistida) | [R$ ___] |
| Mensalidade durante o piloto | [R$ ___] por mês |

**Condição:** [a definir].

**Validade desta proposta:** [a definir].

## Fora do escopo e próximos passos

**Fora do escopo deste piloto:**

- envio de dados à RNDS e assinatura digital ICP-Brasil, que não fazem parte do piloto e não têm data prometida;
- faturamento de convênios (TISS), laboratório e imagem (PACS);
- a UBS e a regulação entre unidades, que a rede pode acrescentar depois do piloto.

**Próximos passos:**

1. Demonstração do sistema com a equipe da unidade.
2. Ajuste desta proposta: data da virada, valores e condição.
3. Assinatura do contrato e do termo de tratamento de dados.
4. Início da preparação, 30 dias antes da virada.

Contato: [nome], [telefone], contatochefecoruja@gmail.com.
