# 5A, tarefa 6: retorno pós-UPA/hospital (contrarreferência)

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P2**. Começada em 03/11/2026, a pedido do RT ("Sim, diagnóstico 6"), depois da tarefa 5 concluída.

O aceite do backlog é: "UBS recebe retorno do paciente". As subtarefas são criar o fluxo de contrarreferência, alertar a UBS e exibir o histórico.

Este documento é o diagnóstico. **Decisões do RT em 03/11/2026: A em I1 a I5** ("Sim, todas A").

## 1. Diagnóstico do estado atual

**Fim do atendimento na UPA (`registrar_desfecho`):**
- Os desfechos são alta, alta após medicação, alta a pedido, transferência, evasão, óbito, observação e internação.
- Observação e internação não encerram o cuidado: o paciente continua na unidade.
- O médico registra o CID de alta (obrigatório, exceto na evasão) e o relato (obrigatório na evasão, na alta a pedido e no óbito).
- Os detalhes vão para `episodios.desfecho_detalhes` (jsonb).

**Alta da internação (`dar_alta`):**
- Os tipos são alta melhorada, alta a pedido, evasão, transferência externa e óbito.
- Tem CID de alta, observações e detalhes (`internacoes.alta_detalhes`, jsonb).
- O pacote de alta (`pacotes_alta`) leva ao paciente as orientações, o retorno (onde, quando, exame de controle, o que levar), os sinais de alerta e os documentos: receita, atestado, encaminhamento, pedido de exames e sumário de alta.
- O pacote é do paciente (link com código). A UBS não o recebe.

**O que a UBS sabe hoje:**
- **Paciente que ela mandou à UPA (tarefa 5):** sabe se chegou ou não (`encaminhamentos_upa`). Não sabe o que aconteceu depois: desfecho, CID, receita ou retorno pedido.
- **Paciente que ela mandou pela regulação:** sabe que a solicitação foi "realizada" ou "falta". Não recebe nada do atendimento.
- **Paciente que foi à UPA por conta própria:** não sabe de nada.
- **Contrarreferência hoje:** é só o canhoto da folha SMS003a ("preenchimento pela unidade de destino"), em papel, se o paciente trouxer de volta.

**Cadastro do paciente entre unidades:**
- O cadastro é por unidade (`pacientes.unidade_id`). A UBS e a UPA têm cada uma a sua linha.
- A ligação entre cadastros já existe na regulação (`private.regulacao_mesmo_paciente`): mesma organização e mesmo CNS válido, mesmo CPF válido ou cadastro unificado.
- Não há "UBS de referência" (adscrição) no cadastro.
- O prontuário de uma unidade não mostra o atendimento de outra. A única leitura entre unidades é o histórico de regulação (médico e gestor, com registro de acesso ao abrir) e o resumo do envio à UPA (tarefa 5).

**RNDS:** o sumário de alta e o RAC iriam à RNDS (`interop_outbox`), e a UBS leria por lá. Isso espera a credencial; esta tarefa não depende dela.

## 2. Decisões do RT (I1 a I5): todas A em 03/11/2026

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| I1 | De quais pacientes a UBS recebe o retorno | **A)** dos que ela enviou (UPA da tarefa 5 e regulação) **e** dos que têm cadastro nela (mesmo CNS ou CPF na organização), mesmo quando foram à UPA por conta própria. **B)** só dos que ela enviou | A: a UBS cuida do paciente depois; o hipertenso que descompensou e foi direto à UPA é o caso mais comum |
| I2 | O que vai no retorno | **A)** resumo automático tirado no fim do atendimento: unidade, datas, desfecho, CID de alta, avaliação e plano do último SOAP, receita, orientações e retorno do pacote de alta (se houver), e a orientação à UBS (I3). Só leitura, com registro de acesso ao abrir. **B)** só o aviso (unidade, data, desfecho e CID); o resto pelo pedido de acesso ao prontuário | A |
| I3 | Quem escreve na UPA e no hospital | **A)** sai sozinho no desfecho ou na alta. O médico ganha um campo opcional "Orientação à UBS" (ex.: "reavaliar PA em 7 dias"), que não trava a alta. **B)** formulário de contrarreferência obrigatório antes da alta | A: a alta não pode atrasar por um papel a mais |
| I4 | Onde a UBS vê e quem é avisado | **A)** a tela Encaminhados ganha "Retornos" (a ver / vistos), e a janela da consulta mostra os retornos do paciente. O médico, o enfermeiro e o gestor da UBS são avisados. Quem abre marca "visto" e pode "Agendar retorno" pela agenda da tarefa 3. A recepção vê só que o paciente voltou, sem o resumo clínico. **B)** só a lista, sem aviso | A |
| I5 | Que fins de atendimento geram retorno | **A)** todos os que encerram o cuidado: alta (todas), transferência, evasão e óbito. Evasão e alta a pedido pedem busca ativa; o óbito atualiza a UBS. Observação e internação não geram; a internação gera na alta dela. **B)** só alta | A |

**Fora desta tarefa:**
- o envio à RNDS (espera a credencial);
- a adscrição (equipe e território), que é cadastro da atenção básica e não existe no app;
- os programas (hiperdia, pré-natal, puericultura), que são a tarefa 7.

## 3. Proposta técnica (com as recomendações)

Três partes, cada uma com o próprio PR:

| Parte | Entrega |
|---|---|
| 6.1 banco | Tabela `contrarreferencias`: origem (UPA ou hospital, episódio ou internação), UBS de destino, paciente na UBS, resumo, orientação, ligação com o envio à UPA ou a regulação, situação "a ver" ou "visto". Gatilho no fim do atendimento (desfecho que encerra e `dar_alta`), sem mudar `registrar_desfecho` nem `dar_alta`: a orientação à UBS vai nos detalhes, que já são jsonb. RPCs de listar (UBS, paciente), abrir com registro de acesso e marcar visto. Aviso à UBS. |
| 6.2 telas | Campo "Orientação à UBS" no desfecho da UPA e na alta. "Retornos" na tela Encaminhados, com o resumo, "visto" e "Agendar retorno". Retornos do paciente na janela da consulta da UBS. Notificação. |
| 6.3 fecho | Teste de ponta a ponta na homologação (UBS envia, UPA atende e dá alta, UBS recebe e agenda) e registro no BACKLOG. |

**Riscos:**
- **Dado clínico entre unidades.** O resumo sai da UPA para a UBS sem o paciente estar na UBS. Fica restrito ao médico, ao enfermeiro e ao gestor da UBS, só leitura, com registro de acesso, como o histórico de regulação.
- **Paciente com cadastro em mais de uma UBS:** todas recebem. É raro e não esconde nada de quem cuida.
- **Ligação pelo CNS ou CPF:** só com dígito válido, a mesma regra da regulação. Sem CNS nem CPF, só o paciente enviado pela UBS gera retorno.
- **Produção:** nenhuma UBS em uso e a UPA Centro sem equipe. O gatilho não acha UBS e não gera nada, então nada muda para quem usa hoje.
