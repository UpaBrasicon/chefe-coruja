# 5A, tarefa 3: agenda básica da UBS

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P1**. Começada em 02/11/2026, na ordem combinada com o RT ("Vamos seguir sua ordem"), depois da tarefa 2 concluída.

O aceite do backlog é: "UBS agenda consulta e atende paciente". As subtarefas são agenda por profissional, horários, marcação, cancelamento e faltas.

Este documento é o diagnóstico. **Decisões do RT em 02/11/2026: A em F1 a F6** ("Sim pode", à pergunta "todas na recomendação"). A implementação segue as partes 3.1 a 3.3, cada uma com o próprio PR.

## Fonte

**Ministério da Saúde, e-SUS APS, *Manual do PEC*** (sisaps.saude.gov.br/sistemas/esusaps/docs/manual/PEC, versão de 2026):

- **Configurar a agenda (cap. 3, seção 3.5.5):**
  - feita pelo gerente ou coordenador da UBS, por profissional e lotação;
  - horário de início e de fim por período e por dia da semana, ou o "horário-padrão" da instalação;
  - sábado e domingo aparecem só quando marcados.
- **Fechamento da agenda (seção 3.5.6):** período, com data inicial e final, e motivo: atestado, curso, férias, licença, reunião ou outro (este com "Especifique").
- **Intervalo entre consultas (seção 3.2.1):** definido por categoria profissional (CBO), com um padrão.
- **Agenda (cap. 5):**
  - marcar consulta, reserva ou atendimento entre profissionais (seção 5.1), só em horário futuro, com observação opcional;
  - reserva de horário para atendimento externo, atividade coletiva, reunião ou outro, só para atividade curta dentro do turno (seção 5.2);
  - as situações do agendamento são: agendado, cidadão presente na unidade, atendimento realizado, não aguardou, não compareceu e cancelado;
  - "não compareceu" só depois do horário, e só pode ser desfeito no próprio dia (seções 5.1.3 e 5.1.6);
  - o agendado chega e entra na lista de atendimentos, como "cidadão presente na unidade" (seção 5.1.2);
  - o cancelamento é só antes do horário e não pede justificativa; depois do horário, registra-se a falta (seção 5.1.5).

## 1. Diagnóstico do estado atual

**Não existe agenda de paciente.**

- **A agenda que existe é a escala.**
  - `/agenda` ("Minha agenda") é o calendário de plantões: `AgendaGrupo`, `escala_plantao` e `escala_fixa`, por turno (manhã, tarde, noite), sem horário de consulta.
  - "Falta", nesse módulo, é a falta do profissional (`solicitacoes_escala`).
- **"Consulta agendada" é só um rótulo.** É o tipo de atendimento da ficha da UBS (`episodios.tipo_atendimento_aps`), sem ligação com nenhum horário marcado.
- **O retorno é só texto.** A conduta "retorno para consulta agendada" e a saída "agendamento" da escuta (azul) não criam horário: ficam escritos na conduta ou na observação.
- **O mais parecido é `regulacao_solicitacoes`:** tem a situação agendada, realizada e falta, mas é o encaminhamento para outro serviço, não a agenda da própria UBS.
- **O acesso depende da escala.** O médico atende só de plantão no consultório, com check-in (D2 da tarefa 2). A agenda tem de conviver com essa regra.
- **O nome `/agenda` já está ocupado** pela escala. A agenda de consultas precisa de outro endereço e de outro nome no menu.

## 2. Decisões do RT (F1 a F6): todas A em 02/11/2026

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| F1 | De onde vêm os horários | **A)** uma configuração própria por profissional na unidade, como no PEC: dias, períodos e horário de início e de fim, mais a duração da consulta. O atendimento continua exigindo a escala, e a tela avisa quando um horário da agenda cai fora dela. **B)** os horários saem da escala fixa: cada turno vira horários de consulta pela duração, sem configuração própria | A: a agenda do PEC é por profissional; a escala diz quem está de plantão, não quantas consultas cabem |
| F2 | Quem configura e quem marca | **A)** o gestor configura a agenda, a duração e o fechamento (o "coordenador" do PEC); a recepção, a enfermagem e o próprio profissional marcam e cancelam. **B)** só a recepção marca | A |
| F3 | A chegada do paciente | **A)** na recepção, "chegou" no agendamento abre a ficha da UBS já ligada a ele: com o tipo do agendamento, na fila do consultório, e o agendamento passa a "presente". Ao encerrar a consulta, passa a "realizado"; se o paciente sair antes, a "não aguardou". **B)** a agenda fica à parte, e a ficha é aberta como hoje, sem ligação | A: é o que fecha o aceite ("agenda consulta e atende paciente") |
| F4 | Falta e cancelamento | **A)** como no PEC: cancelar só antes do horário, sem justificativa; "não compareceu" só depois do horário, desfeito só no mesmo dia; tudo na auditoria. **B)** cancelamento e falta com motivo obrigatório | A: segue a fonte; o motivo fica opcional |
| F5 | Reserva e fechamento | **A)** os dois, como no PEC: a reserva de um horário (atendimento externo, atividade coletiva, reunião, outro) e o fechamento de um período (atestado, curso, férias, licença, reunião, outro), sem marcar por cima. **B)** só o fechamento | A |
| F6 | Marcar a partir da consulta | **A)** a conduta "retorno para consulta agendada" e a saída "agendamento" da escuta ganham um atalho para marcar direto na agenda; a conduta continua valendo sem a marcação. **B)** marca-se só pela tela da agenda | A |

**Fora desta tarefa:**
- a agenda online do cidadão (seção 3.5.7 do PEC), que depende do e-Gestor APS;
- o atendimento entre profissionais com videochamada;
- o envio ao SISAB.

## 3. Proposta técnica (com as recomendações)

Em partes, cada uma com o próprio PR:

| Parte | Entrega |
|---|---|
| 3.1 banco | `agenda_configuracoes`, `agenda_fechamentos`, `agendamentos` (consulta ou reserva, situação, ligação com o episódio); RPCs de configurar, marcar, cancelar, chegar, falta e não aguardou; ligação na conduta e na evasão; testes |
| 3.2 telas | "Agenda de consultas" (dia e semana por profissional; marcar, cancelar, chegou e falta) e a configuração do gestor; opções do Refero para o RT escolher antes |
| 3.3 atalhos | marcar a partir da conduta e da escuta (F6) |

**Banco (expand):**
- só tabelas novas, com RLS por papel na unidade, sem mexer na escala nem no episódio além de uma coluna anulável `episodios.agendamento_id`;
- um mesmo profissional não fica com dois agendamentos no mesmo horário, e não se marca dentro de um fechamento;
- o rollback é derrubar as tabelas novas, que só a agenda usa.

**Riscos:**
- **A UBS precisa de escala montada** para atender (D2 da tarefa 2). Se a agenda não bater com a escala, o profissional tem paciente marcado e não consegue abrir a consulta; daí o aviso da F1.
- **Fuso e horário de verão:** os horários ficam em `timestamptz`, mostrados em America/Sao_Paulo, como o resto do app.
- **Produção:** a UPA Centro não tem equipe, e nenhuma UBS está em uso, então nada muda para quem usa hoje.

## Parte 3.1, banco (02/11/2026)

Migration `20270214000001_agenda_ubs.sql`; teste `supabase/tests/5a_agenda.sql`.

- **Tabelas:** `agenda_configuracoes`, `agenda_fechamentos` e `agendamentos`.
  - Têm RLS, sem acesso direto: a leitura e a escrita são só pelas RPCs.
  - `episodios.agendamento_id`, anulável e único.
- **RPCs** (só na UBS, com segundo fator e auditoria):
  - `agenda_definir_configuracao` e `agenda_fechar`/`agenda_reabrir`: só o gestor (F2);
  - `agenda_marcar` (com a origem opcional para o atalho, F6) e `agenda_reservar`: recepção, enfermagem, médico e gestor (F2).
    - O horário tem de estar na grade e ser futuro.
    - Não pode estar dentro de um fechamento nem cair por cima de outro agendamento: uma trava por profissional impede duas marcações juntas.
    - Um paciente tem uma consulta por dia com o mesmo profissional.
  - `agenda_cancelar`: só antes do horário, sem justificativa obrigatória (F4);
  - `agenda_registrar_falta`: só depois do horário; `agenda_desfazer_falta`: só no mesmo dia (F4);
  - `agenda_registrar_chegada`: no dia da consulta, abre a ficha da UBS pelo `registrar_ficha`, com o tipo do agendamento e ligada a ele (F3);
  - `agenda_dia` e `agenda_configuracao`, para as telas. Cada horário mostra se cabe na escala do profissional (F1).
- **Gatilho `trg_agendamento_segue_episodio`:** quando o episódio encerra, o agendamento muda conforme o caso:
  - consulta concluída: "realizado";
  - evasão: "não aguardou";
  - ficha retirada por engano ou duplicada: volta a "agendado", e a chegada pode ser refeita.
- **Sem mudança:** `registrar_ficha`, `registrar_conduta_aps`, `registrar_desfecho` e `retirar_da_fila`. O md5 de `registrar_ficha` é o mesmo de antes (7a2c173d…).

**Homologação (02/11/2026):**
- migration aplicada duas vezes (idempotente) e versão registrada;
- `5a_agenda.sql` passa: 10 blocos, com a chegada, a conduta, a evasão, a ficha por engano e a falta no próprio dia;
- `5a_atendimento_ubs`, `5a_consultorio_fila`, `5a_consulta_ubs_ponta_a_ponta` e `5a_escuta_inicial` seguem passando com ela;
- rollback: as tabelas, a coluna, o gatilho e as 18 funções saem; o teste falha; reaplicada, o retrato fica igual ao de depois (md5 das funções e1a71b87…).

**Produção (02/11/2026, ok do RT):** migration `20270214000001` aplicada por `producao:push`. Versão registrada; retrato igual ao da homologação: 3 tabelas, 18 funções com md5 e1a71b87…, coluna, gatilho, `registrar_ficha` sem mudança e sem acesso direto do `authenticated`.

**Tela: o RT escolheu a opção B** (lista do dia e marcação por horários livres; ref. Cal.com, escolha de horário), entre A (dia em colunas por profissional, ref. GlossGenius) e C (semana de um profissional com painel, ref. Mangomint). Vem na parte 3.2.

## Parte 3.2, telas (02/11/2026)

Sem migration. Opção B do RT.

- **Menu:** "Agenda de consultas" (`/agenda-consultas`) só na UBS, para a recepção, a enfermagem (enfermeiro e técnico), o médico e o gestor (F2). O `/agenda` continua sendo a escala de plantões.
- **Dia** (`AgendaConsultas.tsx`):
  - lista do dia em ordem de horário, com filtros (todos, agendados, presentes, faltas);
  - em cada linha, a situação e as ações que valem naquela hora:
    - "Chegou", no dia: escolhe o consultório e o motivo e abre a ficha ligada ao agendamento;
    - "Falta", depois do horário;
    - "Desfazer falta", só no dia;
    - "Cancelar", antes do horário, com motivo opcional;
  - aviso quando o horário marcado está fora da escala do profissional (F1);
  - aviso quando a agenda do profissional está fechada no dia.
- **Painel de marcar:**
  - consulta (paciente, profissional, calendário com os dias da grade, horários livres, consulta agendada ou cuidado continuado, observação) ou reserva (motivo);
  - horário fora da escala aparece marcado com o aviso.
- **Configuração** (aba só do gestor, `ConfiguracaoAgenda.tsx`):
  - grade por profissional (dia × manhã/tarde/noite, início, fim e duração), com "copiar a segunda para terça a sexta";
  - fechamentos, com reabrir.
- As regras da tela estão em `src/domain/agenda.ts` e repetem as do servidor.

**Conferência (02/11/2026):**
- `src/lib/agendaUbs.test.ts`:
  - motivos iguais aos do banco;
  - ações por situação e horário;
  - lista e horários livres;
  - menu só na UBS;
- `src/lib` (254), testes clínicos (1105), tipos, lint e padrão do frontend passando.
- Página de teste com dados fictícios:
  - lista do dia com as ações certas;
  - marcação enviando `agenda_marcar` com 09:00 de Brasília = 12:00 UTC;
  - ocupado fora dos livres e fora da escala com "*" e o aviso;
  - gestor salvando a grade (`agenda_definir_configuracao`) e fechando (`agenda_fechar`);
  - sem rolagem lateral no celular.
- Falta a agenda com login na homologação, que fica atrás do login da Vercel.

**Limite:** marca-se só paciente já cadastrado. O cadastro novo continua na "Nova ficha" da recepção.
