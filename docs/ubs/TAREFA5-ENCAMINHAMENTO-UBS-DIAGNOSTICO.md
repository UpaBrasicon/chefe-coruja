# 5A, tarefa 5: encaminhamento UBS → UPA/regulação

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P1**. Começada em 03/11/2026, na ordem combinada com o RT, depois das tarefas 2 a 4 concluídas.

O aceite do backlog é: "UBS encaminha e acompanha". As subtarefas são criar o documento ou a solicitação, vincular ao paciente e rastrear o status.

O retorno do paciente à UBS (contrarreferência) é a tarefa 6. Este documento é o diagnóstico. **Decisões do RT em 03/11/2026: A em H1 a H5** ("pode seguir", à pergunta "todas na recomendação").

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

## 2. Decisões do RT (H1 a H5): todas A em 03/11/2026

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

## Parte 5.1, banco (03/11/2026)

Migration `20270216000001_encaminhamento_upa.sql`; teste `supabase/tests/5a_encaminhamento_upa.sql`.

- **`encaminhamentos_upa`:**
  - origem (UBS, episódio e paciente) e destino (UPA ou hospital da mesma organização);
  - motivo e resumo da consulta, tirado no momento do envio: paciente (nome, nascimento, CNS, CPF, mãe), queixa, tipo, cor da escuta, último SOAP e sinais;
  - situação: enviado, chegou, não chegou ou cancelado;
  - RLS, com acesso só pelas RPCs.
- **`encaminhar_upa` (H1, H5):**
  - envia o médico ou o enfermeiro de plantão no consultório;
  - um envio aberto por consulta;
  - da escuta, a ficha da UBS encerra com o envio; da consulta, o médico encerra pela conduta;
  - avisa a recepção, a enfermagem, os médicos e o gestor da UPA.
- **`encaminhamento_upa_marcar_chegada`:** a UPA marca "chegou" (ligado à ficha dela) ou "não chegou" (com relato). Também corrige o "não chegou" automático. Avisa quem enviou.
- **`encaminhamento_upa_cancelar`:** quem enviou, um médico ou o gestor da UBS, com motivo.
- **Prazo de 12 h:** `private.encaminhamentos_upa_prazo()` roda pelo `pg_cron` `encaminhamento-upa-prazo` de 15 em 15 minutos, marca "não chegou" e avisa quem enviou.
- **Listas (H3):**
  - `encaminhamentos_upa_origem` (Encaminhados da UBS);
  - `encaminhamentos_upa_destino` (Vindo da UBS, só para quem é da UPA);
  - `encaminhamentos_upa_do_paciente`.
- **Sem mudança:** a regulação (H2), que a tela abre já preenchida, e as funções que já existiam.

**Homologação (03/11/2026):**
- migration aplicada duas vezes (idempotente) e versão registrada;
- `5a_encaminhamento_upa.sql` passa, com quem envia, destino, motivo, consulta e escuta, avisos, chegada, prazo, correção, cancelamento e listas;
- rollback: a tabela, as 10 funções e o job saem; o teste falha; reaplicada, o retrato fica igual (md5 das funções f7fa7356…).
