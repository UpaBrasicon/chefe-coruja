# Limpeza do percurso da UBS: diagnóstico (LP1 a LP3)

Pedido do RT em 23/11/2026 ("Limpeza do percurso"), depois de fechar o refinamento da UBS (RF1 a RF8). São as três sobras do percurso de 17/11/2026 (`docs/ubs/PERCURSO-UBS-DIAGNOSTICO.md`): o M6 e o M7 do U14, que ficaram "para depois" no #853, e a ficha "em atendimento" de dias anteriores, que o U1 não fecha. Lido na master (d26156cc), na homologação (UBS Fase 5) e na produção. Nada foi programado.

## Resumo

| Item | O que o app faz hoje | Recomendação | Migration |
|---|---|---|---|
| LP1 | A conduta diz "Agendamento para Nasf"; no LEDI 8.7.0 o código 14 é "Agendamento para eMulti" | A: trocar só o texto | Não |
| LP2 | Abrir a consulta já inicia o atendimento, e o cabeçalho mostra "Em atendimento há 0 min" | A: "Atendimento iniciado às HH:MM" | Não |
| LP3 | A ficha que o médico abriu e não encerrou fica "em atendimento" para sempre, e o paciente não consegue ficha nova | A: aviso no topo da fila e o gestor encerra com motivo | Sim |

## LP1. Nasf vira eMulti

**Hoje.** A conduta da consulta da UBS tem a opção "Agendamento para Nasf" (`src/domain/aps.ts`, valor `agendamento_nasf`), que vai ao SISAB como código 14 da FAI (`src/interop/ledi/fichas.ts`).

**Fonte.** No LEDI 8.7.0, tabela "CondutaEncaminhamento" do dicionário de dados (https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/referencias/dicionario.html, alterado em 10/09/2026), o código 14 é "Agendamento para eMulti". O NASF foi substituído pelas Equipes Multiprofissionais (eMulti), e a FAI tem também o campo "emultis" (ações da eMulti), que o app não usa.

**A (recomendo).** Trocar só o texto: "Agendamento para eMulti". O valor interno `agendamento_nasf` e o código 14 continuam iguais, então nada muda no banco nem no envio ao SISAB.

**B.** Trocar também o valor interno para `agendamento_emulti`. Pede migration expand/contract (aceitar os dois, migrar os registros, depois tirar o antigo) só para mudar um nome que ninguém vê.

## LP2. "Em atendimento há 0 min"

**Hoje.** Abrir a janela da consulta (`JanelaAtendimento.tsx`) chama `iniciar_atendimento`: marca o médico e a hora, e abre o prontuário. Logo em seguida o cabeçalho mostra "Em atendimento há 0 min", que parece erro. O comportamento é o combinado no percurso (M7: abrir a janela inicia o atendimento); o estranho é só o texto.

**A (recomendo).** Trocar o texto para "Atendimento iniciado às 14:05" e, a partir de 1 minuto, "iniciado às 14:05 · há 3 min". Só tela; vale na UBS e na UPA, que usam a mesma janela.

**B.** Mudar o comportamento: abrir a janela não inicia nada, e um botão "Iniciar atendimento" marca o médico e a hora. Mexe na fila da UPA e da UBS e em quem "pega" o paciente; precisaria de estudo próprio.

## LP3. Ficha "em atendimento" de dias anteriores

**Hoje.** O U1 fecha no fim do expediente só a ficha que ninguém atendeu ("não aguardou"). A ficha que o médico abriu (o atendimento começou) e não encerrou pela conduta fica na etapa "atendimento" sem prazo:
- aparece na fila do consultório como "em atendimento há N dias";
- o paciente não consegue ficha nova, porque o banco só deixa um episódio aberto por paciente (`episodios_um_aberto_por_paciente`);
- não vai ao SISAB, porque a FAI sai da conduta.

Na homologação há 6 fichas assim na UBS Fase 5, a mais antiga de 03/11/2026. Na produção, nenhuma (não há UBS lá).

Regra clínica que vale aqui: autor = login. Encerrar uma consulta é registro de alguém; nada deve sair como se o médico tivesse concluído.

**A (recomendo).** Ninguém fecha sozinho:
1. no dia seguinte, a ficha aparece no topo da fila do médico que a abriu, como "Atendimento de 21/11 não encerrado", com "Retomar" para registrar a conduta;
2. o gestor da UBS vê a lista no Painel do Gestor e pode encerrar com motivo obrigatório ("atendimento não concluído"), registrado com o login dele e auditado; esse encerramento não gera FAI;
3. a recepção, ao tentar abrir ficha nova para o paciente, vê de quando é o atendimento aberto e com quem, e sabe que é o gestor quem libera.
Precisa de migration (RPC de encerramento pelo gestor e a lista).

**B.** O job noturno do U1 (`ubs-ficha-vence`) também encerra, no fim do expediente, a ficha em atendimento do dia, como "atendimento não concluído (encerrado pelo sistema)", guardando o que foi escrito, sem conduta e sem FAI, e avisa o médico. Libera o paciente sem depender de ninguém, mas o encerramento não tem autor humano.

**Dado de teste.** As 6 fichas presas na homologação podem ser encerradas logo depois da decisão, pelo caminho escolhido (A: pelo gestor de teste; B: pelo job).

## Ordem sugerida

LP1 e LP2 juntos num PR só de tela (textos). Depois LP3, com migration, homologação, CI verde e "ok produção".

## Decisões do RT

23/11/2026, nas palavras dele: "Sim, todas A". LP1, LP2 e LP3 = A. Entram no BACKLOG na trilha "Refinamento da UBS", P1, na ordem acima.
