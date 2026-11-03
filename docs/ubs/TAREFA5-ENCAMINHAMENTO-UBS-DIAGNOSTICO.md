# 5A, tarefa 5: encaminhamento UBS → UPA/regulação

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P1**. Começada em 03/11/2026, na ordem combinada com o RT, depois das tarefas 2 a 4 concluídas.

O aceite do backlog é: "UBS encaminha e acompanha". As subtarefas são criar o documento ou a solicitação, vincular ao paciente e rastrear o status.

O retorno do paciente à UBS (contrarreferência) é a tarefa 6. Este documento é o diagnóstico. As decisões H1 a H5 são do RT; a implementação só começa depois delas.

## 1. Diagnóstico do estado atual

**Regulação (Fase 4), já pronta e aceita pela UBS:**
- `regulacao_solicitar` pede um vínculo de médico, gestor ou NIR na unidade.
  - Não confere o tipo da unidade nem o setor, então a UBS já pode solicitar.
  - Precisa de CNES, de uma central de regulação na organização e de CNS ou CPF do paciente.
  - A ligação com o episódio é opcional e aceita o episódio da UBS.
- **Tipos:** consulta (especialidade e CBO), exame, leito e transferência.
  - Os campos do MIRA são obrigatórios: SIGTAP, CID, caráter, prioridade e quadro clínico.
  - A solicitação vai sempre à central, que autoriza e escolhe o destino.
  - O destino aceita ou recusa, e registra a chegada ou a falta.
- **Acompanhamento pela origem:**
  - `regulacao_lista`, o painel de prazos e o detalhe com o histórico (`regulacao_eventos`);
  - avisos `reg_*` ao solicitante e ao médico assistente;
  - `HistoricoRegulacao` do paciente, que aparece no prontuário e no leito, mas não na janela da consulta.
- **Tela:** só `/regulacao`, pelo menu, que a UBS já vê. O formulário procura o paciente sozinho e não aceita vir preenchido da consulta.

**Encaminhamento SMS003a:**
- É um documento (`documentos_clinicos`), ligado ao paciente e ao episódio, impresso.
- O destino é texto livre e o número da regulação é digitado à mão.
- Ninguém acompanha o desfecho: a contrarreferência é só o canhoto da folha.
- Na consulta da UBS, a aba Encaminhar tem "Dentro da unidade" (encaminhamento interno) e "Para outra unidade" (SMS003a).

**Conduta da UBS:**
- "Encaminhamento para urgência", "para internação" e "para serviço especializado" são só caixas de marcar da ficha do e-SUS APS.
- Marcar uma delas mostra a dica de ir à aba Encaminhar. Nada é criado nem acompanhado.

**UBS → UPA:**
- Não existe. A UPA da rede não sabe que o paciente vem: não há aviso de chegada, pré-ficha nem registro de que ele chegou ou não.

## 2. Decisões do RT (H1 a H5)

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| H1 | Paciente encaminhado à UPA (urgência) | **A)** "Enviar à UPA" da rede: a UBS escolhe a UPA e manda um aviso com o resumo da consulta (queixa, SOAP, sinais, motivo). Ele aparece na recepção da UPA como "vindo da UBS". Quando a UPA abre a ficha do paciente, o aviso fica "chegou"; sem ficha em 12 horas, fica "não chegou", e a UBS vê. **B)** só o documento impresso, como hoje | A: é o "encaminha e acompanha" da UBS para a UPA, sem passar pela central (urgência não espera regulação) |
| H2 | Consulta especializada, exame e internação | **A)** pela regulação da rede que já existe, aberta da consulta da UBS com o paciente, o episódio, o CID e o quadro já preenchidos, como no atalho da agenda. A conduta "serviço especializado" ou "internação" mostra o botão. **B)** a UBS usa a tela `/regulacao` como hoje, sem atalho | A |
| H3 | Onde a UBS acompanha | **A)** uma tela "Encaminhados" da unidade, com os avisos à UPA e as solicitações de regulação, a situação de cada um e o filtro por pendentes; mais o histórico do paciente na janela da consulta. Os avisos de mudança continuam os da regulação, e há um aviso novo quando o paciente não chega à UPA. **B)** só a tela `/regulacao` e o prontuário | A |
| H4 | O documento SMS003a | **A)** continua como a folha impressa que vai com o paciente. Quando há solicitação de regulação, o número e o destino entram sozinhos. **B)** a solicitação substitui a folha | A: a folha ainda é o que o paciente leva |
| H5 | Quem envia | **A)** o médico da consulta (e o enfermeiro, na escuta inicial, para a urgência). **B)** só o médico | A: o CAB 28 manda o vermelho para o serviço de urgência quando a UBS não resolve |

**Fora desta tarefa:**
- o retorno do paciente à UBS (contrarreferência e alerta), que é a tarefa 6;
- o transporte (SAMU), que segue na regulação;
- o envio à RNDS, que espera a credencial.

## 3. Proposta técnica (com as recomendações)

Três partes, cada uma com o próprio PR:

| Parte | Entrega |
|---|---|
| 5.1 banco | `encaminhamentos_urgencia` (origem UBS, episódio, paciente, UPA de destino, resumo, situação enviado/chegou/não chegou/cancelado); RPCs de enviar, cancelar e listar (origem e destino); ligação com a ficha da UPA (chegou); prazo de 12 h por `pg_cron` com aviso; a regulação ganha o preenchimento a partir do episódio (sem mudar a tabela) |
| 5.2 telas | "Enviar à UPA" e "Solicitar regulação" na Conduta e na escuta, já preenchidos; "Vindo da UBS" na recepção da UPA; tela "Encaminhados" da UBS; histórico na janela |
| 5.3 SMS003a | número e destino da regulação preenchidos na folha |

**Riscos:**
- **Dado clínico entre unidades.** O resumo só é visto pela UPA de destino e pela UBS de origem, com auditoria, como a regulação já faz.
- **A UPA precisa estar na mesma organização.** Fora da rede, fica o documento impresso (H4).
- **Produção:** nenhuma UBS em uso e a UPA Centro sem equipe, então nada muda para quem usa hoje.
