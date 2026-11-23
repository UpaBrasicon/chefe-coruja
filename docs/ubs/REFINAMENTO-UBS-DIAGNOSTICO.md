# Refinamento da UBS: diagnóstico (RF1 a RF8)

Pedido do RT em 23/11/2026, cumprindo o que ele anunciou em 13/11 ("depois vamos mudar algumas coisas"). A trilha "Percurso da UBS por papel" (U1 a U15) está toda na produção desde 20/11/2026. Este documento lê o código da master (d3868594) e a homologação (UBS Fase 5) e propõe A/B para cada item. Nada foi programado.

Os números RF1 a RF8 seguem a ordem da lista do RT. "R8" e "R9" já existem no percurso, por isso o prefixo RF.

## Resumo

| Item | Pedido do RT | O que o app faz hoje | Recomendação | Migration |
|---|---|---|---|---|
| RF1 | Recepção, `/recepcao/hoje`: agendados em cima; a demanda espontânea entra na frente pela classificação | A tela "Hoje" já começa pelas consultas do dia. A fila do consultório não separa agendado de espontâneo | A | Não |
| RF2 | Enfermeiro, `/escuta`: depois de classificar (qualquer cor), a agenda abre no mesmo dia como demanda espontânea | Vermelho, amarelo e verde vão à fila do médico, sem agenda. Azul encerra com orientação ou abre a agenda para marcar | A | Sim |
| RF3 | Técnico, `/sinais-vitais`: falta circunferência abdominal | Campo não existe; não há conceito no banco | A | Sim |
| RF4 | Médico, consulta: o bloco do pré-natal ocupa muito espaço; começar fechado | Bloco sempre aberto, com a linha do tempo inteira | A | Não |
| RF5 | Médico, `/agenda-consultas`: consulta de 20 a 30 minutos | Já é configurável por profissional (10, 15, 20, 30, 40 ou 60 min). Na homologação: médico 20, enfermeira 30 | A (nada a programar) | Não |
| RF6 | Enfermeiro, `/vacina`: caderneta com as atrasadas primeiro | A caderneta só lista o que foi aplicado, da mais nova para a mais velha. O app não tem o calendário nacional por idade | A | Sim |
| RF7 | Gestor, Painel do Gestor da UBS: C1 a C7 como semáforo, não como número | Mostra o número, com o conceito (Ótimo, Bom, Suficiente, Regular) em letra pequena e cinza | A | Não |
| RF8 | Texto: "Ficha vencida" vira "Não aguardou" | A recepção e a agenda já dizem "Não aguardou". "Fichas vencidas" aparece só no gestor (Indicadores da UBS, frente Espera), ao lado de outro "não aguardou" | A | Não |

## RF1. Ordem da fila na tela "Hoje" da recepção

**Hoje.** `HojeUbs` (`src/pages/recepcao/Recepcao.tsx`) mostra, nesta ordem: o resumo, as "Consultas de hoje" (a agenda do dia, `ListaDoDia`), a fila da enfermagem e a fila do consultório. A fila do consultório usa `ordemFilaUbs` (`src/domain/aps.ts`): vermelho, depois amarelo, depois todo o resto junto (verde, quem não passou pela escuta e o agendado que chegou), pela prioridade legal e pela chegada. O agendado não tem lugar próprio; a hora marcada não conta. A mesma ordem vale na fila do médico.

**A (recomendo).** A fila do consultório passa a ter três faixas, na recepção e no médico:
1. vermelho e amarelo da demanda espontânea (imediato e prioritário do CAB 28 nunca esperam atrás de agendado);
2. agendados que chegaram, pela hora marcada;
3. o resto da demanda espontânea, verde antes de quem não passou pela escuta, e dentro de cada um pela prioridade legal e pela chegada.

Cada linha ganha a marca "Agendado 09:20" ou "Demanda espontânea · verde". Só frontend: a fila e a agenda do dia já chegam à tela.

**B.** Agendados sempre primeiro, pela hora marcada; depois toda a demanda espontânea pela cor. Mais simples, mas o amarelo (prioritário) espera atrás de consulta de rotina, contra o CAB 28.

## RF2. Escuta inicial abre a agenda do dia como demanda espontânea

**Hoje.** `EscutaInicial.tsx`: vermelho, amarelo e verde gravam a escuta (`registrar_escuta_aps`, saída `consulta`) e a ficha vai à fila do médico. O azul tem duas saídas: orientação (encerra) ou agendamento (encerra e abre a agenda para marcar, U8). A demanda espontânea não aparece na agenda do médico; ela só existe na fila.

Cuidado clínico: vermelho e amarelo não podem depender de achar horário vago. Por isso as duas opções mantêm os dois direto na fila.

**A (recomendo).** Sem janela nova para a enfermeira. Toda ficha que sai da escuta para consulta (vermelho, amarelo, verde) aparece sozinha na agenda do dia do médico, numa faixa "Demanda espontânea" sem ocupar horário da grade, na ordem da fila do RF1. O azul ganha a terceira saída, "Atender hoje", que manda a ficha à fila como demanda espontânea, além de "Orientação" e "Agendar outro dia". Precisa de migration: a saída nova do azul em `registrar_escuta_aps` e a faixa na `agenda_dia`.

**B.** Verde e azul abrem a agenda no dia de hoje para a enfermeira escolher um horário vago (encaixe, tipo "consulta no dia" do e-SUS APS). Vermelho e amarelo vão direto à fila, como hoje. Ocupa a grade: se o dia estiver cheio, a enfermeira precisa de encaixe fora da grade. Precisa de migration (tipo novo no agendamento e encaixe no dia).

## RF3. Circunferência abdominal nos sinais vitais

**Hoje.** `SinaisVitaisAps.tsx` usa `CamposVitais` com pressão, frequências, temperatura, saturação, glicemia, peso e estatura. A gravação (`registrar_sinais_aps`) só aceita conceitos que existem na tabela `conceito`; na homologação não há conceito de circunferência abdominal (só `perimetro-cefalico`). A Ficha de Atendimento Individual do SISAB tem medições próprias (`MedicoesThrift`); hoje o app preenche os campos 3 a 13 e deixa os primeiros vazios.

**A (recomendo).** Campo opcional "Circunferência abdominal (cm)" na tela do técnico e do enfermeiro (`/sinais-vitais`) e no bloco de sinais da consulta, só na UBS. Conceito novo `circunferencia-abdominal` (migration), faixa de valores aceitos e campo da FAI conferidos no IDL oficial do LEDI no PR, e o valor vai ao SISAB na FAI.

**B.** A mesma coisa, mais o campo na escuta inicial da UBS e na porta da UPA.

## RF4. Bloco do pré-natal começa fechado

**Hoje.** Na aba Conduta (`AbaConduta.tsx`), `PreNatalNaConsulta` abre sempre inteiro: cabeçalho (fase, IG, DPP, pontos), a linha do tempo, as frases "perdido" e "a fazer", os botões e o peso e altura. O hiperdia e a puericultura seguem o mesmo jeito.

**A (recomendo).** Pré-natal, hiperdia e puericultura começam fechados, cada um numa linha só: nome do programa, fase ou IG, pontos e, em vermelho, quantos itens já se perderam. Um clique abre o bloco inteiro. Só frontend.

**B.** Só o pré-natal começa fechado; hiperdia e puericultura ficam como estão.

## RF5. Duração da consulta de 20 a 30 minutos

**Hoje.** A duração já é do gestor, por profissional, dia e período, em "Configuração da agenda" (`ConfiguracaoAgenda.tsx`): 10, 15, 20, 30, 40 ou 60 minutos, com 20 como padrão. Na homologação, a grade do médico está em 20 minutos e a da enfermeira em 30.

**A (recomendo).** Nada a programar: o gestor escolhe 20 ou 30 para cada profissional. As durações curtas continuam servindo para vacina, curativo e coleta.

**B.** Limitar a escolha a 20 e 30 minutos para consulta de médico e de enfermeiro, mantendo as outras durações só para os demais serviços.

## RF6. Caderneta com as vacinas atrasadas primeiro

**Hoje.** `vacina_caderneta` devolve só os registros (aplicados e anteriores), da data mais nova para a mais velha. O app não tem o Calendário Nacional de Vacinação por idade. O que ele já calcula, com fonte nas notas metodológicas da SAPS, são as faltas dos indicadores: criança até 2 anos (pentavalente, VIP, tríplice viral, pneumocócica, C2), dTpa da gestante a partir da 20ª semana (C3), influenza da pessoa idosa nos últimos 12 meses (C6) e HPV dos 9 aos 14 anos (C7).

Regra do projeto: dose e esquema só de fonte citada.

**A (recomendo).** Um bloco "Em atraso" no topo da caderneta, com o que o app já calcula pelas notas da SAPS (C2, C3, C6, C7), cada linha com a fonte. O resto da caderneta fica como está. Migration pequena: a caderneta passa a devolver essas faltas.

**B.** Calendário Nacional completo por idade (criança, adolescente, adulto, gestante, idoso) pela instrução normativa vigente do PNI, com idade de cada dose e o que conta como atraso. Tarefa grande: tabela nova, fonte conferida item a item e aprovação clínica do RT. Pode virar trilha própria depois do A.

## RF7. Indicadores C1 a C7 em semáforo

**Hoje.** `IndicadoresAps.tsx` mostra, por indicador, o resultado do app, o número do Ministério e o conceito oficial em letra pequena. As faixas são das notas da SAPS: C2 a C7 ótimo > 75, bom > 50, suficiente > 25, regular ≤ 25; C1 ótimo acima de 50% até 70% e regular acima de 70%. A nota final segue a NT 8/2026.

**A (recomendo).** Semáforo de três cores pelo conceito oficial: verde para ótimo e bom, amarelo para suficiente, vermelho para regular. A cor e o conceito ficam grandes; o número vai para segundo plano (continua lá para conferir com o Ministério). Só frontend.

**B.** Quatro cores, uma por conceito (ótimo, bom, suficiente, regular), no lugar do semáforo de três.

## RF8. "Ficha vencida" vira "Não aguardou"

**Hoje.** A recepção e a agenda já mostram "Não aguardou" (`src/domain/agenda.ts`), e o motivo gravado na ficha começa por "Não aguardou". O termo "fichas vencidas" só aparece no gestor, em Indicadores da UBS, frente Espera, ao lado de outra linha "não aguardou". São coisas diferentes: "não aguardou" conta quem a recepção marcou como evasão; "fichas vencidas" conta as fichas que o sistema fechou no fim do expediente (U1).

**A (recomendo).** Duas linhas com o mesmo nome e o motivo ao lado: "não aguardou (saiu antes)" e "não aguardou (fim do expediente)". A nota de rodapé troca "ficha vencida" pelo mesmo texto. Só frontend.

**B.** Uma linha só, "não aguardou", somando as duas.

## Ordem sugerida

Primeiro o que é só tela, um PR cada: RF8, RF4, RF7, RF1 (RF5 não pede código se ficar A). Depois o que tem migration, cada um com homologação, CI verde e "ok produção": RF3, RF6, RF2 (o RF2 depende do RF1).

## Perguntas ao RT

1. RF1 a RF8: A ou B em cada um?
2. A trilha "Refinamento da UBS" (RF1 a RF8) entra no BACKLOG com prioridade P1 e a ordem acima?
