# Playbook de implantação do Chefe Coruja

Fase 3, tarefa 10. Decisões do RT em 10/10/2026 (BACKLOG.md).

Este roteiro serve para pôr uma unidade nova em operação. Ele vale para:
- UPA 24h;
- pronto-socorro;
- hospital pequeno.

O ambulatório entra só como seção prevista (seção 7).

A implantação é conduzida pelo **implantador** (equipe Chefe Coruja, com
acesso de super admin) junto com o **gestor** da unidade. Cada item tem um
responsável.

O acompanhamento fica na tela **Implantação** do sistema (menu do gestor e do
super admin). Ela tem:
- todos os itens deste roteiro, com prazo contado a partir da data da virada (D0);
- o que o sistema confere sozinho, já marcado;
- o registro de quem foi treinado;
- o aceite da virada e o aceite do encerramento.

## 1. Linha do tempo

| Fase | Quando | Objetivo |
|---|---|---|
| Preparação | D-30 a D-7 | Cadastros, configuração, homologação e treinamento |
| Virada | D0 (ensaio no D-1) | Começar a usar o sistema no atendimento real, com apoio presente |
| Operação assistida | D+1 a D+14 | Corrigir cadastro, reforçar treinamento, conferir a primeira produção |
| Encerramento | D+30 | Indicadores do primeiro mês, pendências e aceite final |

A data da virada é escolhida pelo implantador e pelo gestor. Ela só muda
antes da virada, com motivo, e a mudança fica registrada.

## 2. Preparação (D-30 a D-7)

Os itens marcados como "sistema" a tela confere sozinha. Os demais o
responsável marca como feitos, com observação se precisar.

| Item | Responsável | Prazo | Conferência |
|---|---|---|---|
| P01 CNES da unidade (7 dígitos), em Unidade › Configurações | Gestor | D-30 | sistema |
| P02 Contrato e termo de tratamento de dados (LGPD): o Chefe Coruja é operador e a unidade (ou a secretaria) é controladora | Gestor | D-30 | manual |
| P03 Setores: UPA tem porta (emergência) e observação; PS tem porta; hospital tem internação | Implantador | D-25 | sistema |
| P04 Leitos por setor, conferidos com a planta e com o CNES | Implantador | D-25 | sistema |
| P05 Protocolo de classificação de risco (UPA e PS), escolhido pela enfermagem e pelo RT | Gestor | D-25 | sistema |
| P06 Usuários e vínculos: no mínimo gestor, recepção, enfermeiro e médico plantonista; no hospital, também farmacêutico | Implantador e gestor | D-21 | sistema |
| P07 Segundo fator testado com cada pessoa (código no e-mail cadastrado) | Implantador | D-21 | manual |
| P08 Escala de D0 a D+6, sem dia descoberto | Gestor | D-14 | sistema |
| P09/P10 Medicamentos e estoque inicial (obrigatório no hospital; recomendado na UPA e no PS) | Gestor | D-14 | sistema |
| P11 Interações críticas e alta vigilância revisadas pela farmácia | Gestor | D-14 | manual (recomendado) |
| P12/P13 CNS e CBO de cada profissional; no hospital, também as críticas da AIH e o órgão emissor da APAC | Gestor | D-14 | manual |
| P14 Fluxo completo testado na homologação, com dados de teste | Implantador | D-10 | manual |
| P15 Treinamento por papel (seção 5) | Implantador | D-7 | sistema |
| P16 Computadores, impressoras e internet de reserva testada | Gestor | D-7 | manual |
| P17 Plano de contingência e formulários de papel em cada setor | Gestor | D-7 | manual |

Regras que o implantador confere na preparação:
- **Cada pessoa tem o seu login.** O autor de todo registro é quem está logado. Não existe login de setor nem login compartilhado.
- **A classificação de risco é da enfermagem.** O sistema mostra a referência do protocolo e não sugere nem troca a cor.
- **Faixa pediátrica:** de 1 dia de vida a 13 anos, 11 meses e 29 dias. Na triagem pediátrica a PA não é obrigatória.
- **Menor sem responsável pode ser cadastrado.** Vale para crianças vindas de abrigo, escola ou outro local.

## 3. Virada (D0)

| Item | Responsável | Prazo |
|---|---|---|
| V01 Ensaio de queda na véspera. Simular 15 minutos sem sistema: o atendimento segue no papel, depois os registros são digitados como registro tardio. Anotar o que falhou. | Implantador | D-1 |
| V02 Implantador presente nas primeiras 24 horas, em todos os turnos | Implantador | D0 |
| V03 Canal de suporte (contato e "Chamados técnicos") mostrado em cada turno | Implantador | D0 |
| V04 Primeiro atendimento completo, da chegada ao desfecho, a partir do D0 (o sistema confere) | Implantador e gestor | D0 |

**Aceite da virada.** Com todos os obrigatórios da preparação e da virada
cumpridos, o implantador e o gestor registram, cada um, o aceite na tela, com
as pendências combinadas. Com os dois aceites, a unidade passa a "em
operação". O sistema não bloqueia nada antes disso: o aceite é o registro de
que a unidade foi entregue.

## 4. Operação assistida (D+1 a D+14) e encerramento (D+30)

| Item | Responsável | Prazo |
|---|---|---|
| O01 Ronda diária com o gestor: dúvidas e erros do dia. O que não se resolve vira chamado técnico. | Implantador | D+1 a D+14 |
| O02 Erros de tela da unidade revisados (em "Erros e alertas"); corrigir o que for de cadastro ou de treinamento | Implantador | D+3 |
| O03 Fila sem conexão vazia e registros tardios com justificativa | Implantador | D+7 |
| O04 Treinamento de reforço para quem entrou depois e para quem mais errou | Gestor | D+14 (recomendado) |
| O05/O06 Primeira competência de produção (BPA; no hospital, também AIH) revisada com quem fatura | Gestor | D+14 |
| E01 Indicadores do primeiro mês apresentados ao gestor: tempo até a classificação e até o médico, evasão, ocupação, permanência e erros de tela | Implantador | D+30 |
| E02 Pendências com responsável e prazo, no aceite ou em chamado técnico | Implantador e gestor | D+30 |

**Aceite do encerramento.** Com todos os obrigatórios cumpridos, o
implantador e o gestor registram o aceite final. Com os dois aceites, a
implantação fecha e a tela fica só para consulta.

## 5. Treinamento

O treinamento é feito na **homologação**
(`https://homolog.chefecoruja.com.br`), com dados de teste e nunca com
paciente real. Cada papel tem um roteiro curto em `treinamento/`:

| Papel | Roteiro | Tempo estimado |
|---|---|---|
| Recepção | [recepcao.md](treinamento/recepcao.md) | 1 hora |
| Enfermeiro e técnico de enfermagem | [enfermagem.md](treinamento/enfermagem.md) | 2 horas |
| Médico plantonista | [medico.md](treinamento/medico.md) | 2 horas |
| Farmacêutico | [farmacia.md](treinamento/farmacia.md) | 1 hora e 30 minutos |
| Faturamento e médico regulador | [faturamento.md](treinamento/faturamento.md) | 1 hora e 30 minutos |
| Gestor | [gestor.md](treinamento/gestor.md) | 2 horas |

Cada roteiro termina com uma **checagem**: a pessoa faz sozinha o fluxo do seu
papel. Depois disso, o implantador ou o gestor registra o treinamento na tela,
com a data. O registro não libera nem bloqueia acesso. Ele mostra quem falta
treinar.

Todos os papéis aprendem duas coisas:
- **o plano de contingência:** o que fazer quando o sistema cai, como usar os formulários de papel e quem digita depois;
- **o canal de suporte.**

## 6. O que fazer quando algo dá errado na virada

- **Sistema fora do ar ou internet caída:**
  - seguir o plano de contingência, no papel;
  - na volta, digitar como registro tardio, com justificativa;
  - avisar o implantador.
- **Pessoa sem acesso** (senha, segundo fator, vínculo): o implantador resolve
  na hora. Enquanto isso, a pessoa registra no papel. Nunca usar o login de
  outra pessoa.
- **Cadastro errado** (setor, leito, escala): o gestor ou o implantador
  corrige. Quando a correção é de dado clínico, vale a retificação, que deixa
  rastro.
- **Erro de tela:**
  - o sistema registra o erro sozinho;
  - o implantador revisa os erros todos os dias da operação assistida;
  - o que não for de cadastro ou de treinamento vira chamado técnico.

## 7. Ambulatório e policlínica (a construir)

O módulo ambulatorial ainda não existe; a UBS é a Fase 5A do BACKLOG. Esta
seção registra o que o roteiro vai precisar quando ele existir:
- agenda por profissional e especialidade, com encaixe e faltas;
- consulta com retorno e com encaminhamento;
- pedidos de exame e resultados;
- produção no BPA, consolidado e individualizado;
- treinamento de recepção para agenda e de profissionais para consulta.

Até lá, a tela Implantação não abre implantação de ambulatório.
