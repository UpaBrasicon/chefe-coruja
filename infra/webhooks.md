# Webhooks de saída (Fase 5C, tarefa 4)

Decisões do RT de 27/10/2026: "1a 2a 3a 4a 5a". Etapas: 4.1 banco (este estado), 4.2 motor de
entrega, 4.3 tela. Este documento cresce a cada etapa.

## Como funciona

- **Destino:** o super admin cadastra um endereço https, os eventos e as unidades, ligado a uma
  chave da API v1. As unidades do destino precisam estar na chave. O segredo de assinatura
  (formato `whsec_` do Standard Webhooks) aparece uma vez só e fica guardado no Vault.
- **Evento:** quando acontece um dos fatos abaixo numa unidade com destino ligado, o banco grava o
  evento e uma entrega por destino. Sem destino ligado, nada é gravado.
- **Conteúdo:** só o tipo, os ids, a unidade e a data. Do paciente vai só o id. O receptor busca o
  detalhe pela API v1, com a chave do destino.
- **Chave revogada ou vencida:** o destino para de receber eventos novos.

| Evento | Quando | Dados |
|---|---|---|
| `paciente.criado` | paciente cadastrado | `paciente_id` |
| `atendimento.aberto` | atendimento (episódio) aberto | `atendimento_id`, `paciente_id` |
| `atendimento.encerrado` | atendimento encerrado (inclui a observação que teve alta) | `atendimento_id`, `paciente_id` |
| `internacao.iniciada` | paciente passou a internado | `internacao_id`, `paciente_id`, `atendimento_id` |
| `internacao.alta` | alta, óbito ou transferência de quem chegou a internar | `internacao_id`, `paciente_id`, `atendimento_id` |
| `prescricao.assinada` | prescrição assinada | `prescricao_id`, `paciente_id`, `atendimento_id`, `internacao_id` |
| `regulacao.status_alterado` | status da solicitação mudou (fora rascunho e excluída), na unidade de origem e na de destino | `solicitacao_id`, `numero`, `tipo`, `paciente_id`, `status`, `status_anterior` |

Todo evento leva também `unidade_id`.

## O que cobre (4.1)

- Cadastro, troca de segredo, desligar (gestor, com motivo), religar (super admin) e reenvio
  manual. Todas as funções exigem o segundo fator, e as que mudam algo vão para a auditoria.
- Desligar o destino cancela as entregas pendentes dele.
- O endereço só aceita https com nome público: sem IP, localhost ou rede interna.
- As tabelas ficam fechadas para o REST; o acesso é só pelas funções.

## O que não cobre (ainda)

- **Envio:** nada sai do banco até a 4.2. As entregas ficam pendentes.
- **Tela:** vem na 4.3. Até lá, as funções podem ser chamadas pelo SQL na homologação.
- **Leitura de prescrição e regulação pela API v1:** a API ainda não tem rota para elas. O receptor
  recebe os ids e o status, mas não consegue buscar o detalhe.

## Chaves envolvidas (só nomes)

- **Chave da API do destino:** criada em Administração › Integrações. O destino só recebe eventos das
  unidades dela.
- **Segredo do destino:** no Vault, com o nome `webhook_destino_<id>`. Só o banco e, na 4.2, o motor
  (com a service role) leem.

## Banco

| Migration | O que faz |
|---|---|
| `20270201000001_webhooks.sql` | `webhook_destinos`, `webhook_eventos`, `webhook_entregas`, gatilhos nas cinco tabelas de origem e as funções de administração |

Teste: `supabase/tests/fase5c_webhooks.sql`. Ele não depende da semente local e roda também na
homologação.

## Evidência (homologação, 27/10/2026)

- A migration, o teste e o rollback rodaram juntos numa transação desfeita, e tudo passou.
- Depois a migration foi aplicada pelo SQL, com a versão registrada em `schema_migrations`. O
  `db push` recusaria, porque a homologação tem migrations de outras sessões que esta branch não tem.
- O teste rodou de novo sobre o banco já com a migration, e passou.

## Como reverter

Rollback no cabeçalho da migration:
1. tirar os gatilhos;
2. apagar os segredos do Vault e as três tabelas;
3. tirar as funções.

O fluxo clínico não depende de nada disso.
