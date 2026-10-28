# Webhooks de saída (Fase 5C, tarefa 4)

Decisões do RT de 27/10/2026: "1a 2a 3a 4a 5a". Etapas: 4.1 banco, 4.2 motor de entrega e leitura
de prescrição e regulação na API, 4.3 tela. Este documento cresce a cada etapa.

## Como funciona

- **Destino:** o super admin cadastra um endereço https, os eventos e as unidades, ligado a uma
  chave da API v1. As unidades do destino precisam estar na chave. O segredo de assinatura
  (formato `whsec_` do Standard Webhooks) aparece uma vez só e fica guardado no Vault.
- **Evento:** quando acontece um dos fatos abaixo numa unidade com destino ligado, o banco grava o
  evento e uma entrega por destino. Sem destino ligado, nada é gravado.
- **Conteúdo:** só o tipo, os ids, a unidade e a data. Do paciente vai só o id. O receptor busca o
  detalhe pela API v1, com a chave do destino.
- **Chave revogada ou vencida:** o destino para de receber eventos novos, e as entregas pendentes
  dele são canceladas.

| Evento | Quando | Dados | Detalhe na API |
|---|---|---|---|
| `paciente.criado` | paciente cadastrado | `paciente_id` | `/pacientes/{id}` |
| `atendimento.aberto` | atendimento (episódio) aberto | `atendimento_id`, `paciente_id` | `/atendimentos/{id}` |
| `atendimento.encerrado` | atendimento encerrado (inclui a observação que teve alta) | `atendimento_id`, `paciente_id` | `/atendimentos/{id}` |
| `internacao.iniciada` | paciente passou a internado | `internacao_id`, `paciente_id`, `atendimento_id` | `/atendimentos/{id}` |
| `internacao.alta` | alta, óbito ou transferência de quem chegou a internar | `internacao_id`, `paciente_id`, `atendimento_id` | `/atendimentos/{id}` |
| `prescricao.assinada` | prescrição assinada | `prescricao_id`, `paciente_id`, `atendimento_id`, `internacao_id` | `/prescricoes/{id}` |
| `regulacao.status_alterado` | status da solicitação mudou (fora rascunho e excluída), na unidade de origem e na de destino | `solicitacao_id`, `numero`, `tipo`, `paciente_id`, `status`, `status_anterior` | `/regulacao/{id}` |

Todo evento leva também `unidade_id`.

## Entrega (4.2)

1. **Cron:** a cada minuto, o `pg_cron` (`webhooks-motor`) vê se há entrega na hora. Se houver, chama
   a Edge Function `webhooks` pelo `pg_net`, com o cabeçalho `x-motor-segredo`.
2. **Conferência:** a função confere o segredo com o do Vault (`webhook_motor_autorizado`).
3. **Lote:** a função pega até 20 entregas (`webhook_lote`). Cada uma fica reservada por 2 minutos:
   se a função cair, ela volta sozinha.
4. **Envio:** cada entrega é um POST com o corpo `{id, type, timestamp, data}`, 5 de cada vez, com 10 s
   de limite e sem seguir redirecionamento. Os cabeçalhos são `webhook-id` (o id da entrega, o mesmo
   em todas as tentativas), `webhook-timestamp` e `webhook-signature` (`v1,` + HMAC-SHA256 em base64).
5. **Resultado:** a resposta 2xx marca a entrega como entregue. Qualquer outra resposta, ou nenhuma,
   agenda a próxima tentativa: 5 s, 5 min, 30 min, 2 h, 5 h e 10 h. A tentativa que cairia depois de
   24 h do evento (ou do reenvio manual) não acontece, e a entrega fica "falhou". Na prática, a
   tentativa de 5 s sai na volta seguinte do cron (até 1 minuto).
6. **Manutenção:** a cada 15 minutos (`webhooks-manutencao`):
   - o destino sem nenhuma entrega com sucesso há 3 dias é desligado sozinho; os gestores das
     unidades recebem aviso, e o desligamento vai para a auditoria;
   - os eventos com mais de 90 dias saem.

A conferência da assinatura do lado do receptor está na página da API (`docs/api/index.html`,
seção Webhooks).

## Leitura de prescrição e regulação (4.2)

Decisão do RT: "inclua na 4.2 as rotas de leitura de prescrição e regulação na API v1".
- `GET /prescricoes/{id}` (recurso novo `prescricoes`): a prescrição assinada, com o médico e os
  itens vigentes. Da versão alterada fica só a nova.
- `GET /regulacao/{id}` (recurso novo `regulacao`): a solicitação, para a chave da unidade de origem
  ou da de destino.
- As duas rotas trazem só campos estruturados. Observação, quadro clínico, sinais vitais e hipótese
  não saem. O rascunho dá 404.

## O que cobre

- Cadastro, troca de segredo, desligar (gestor, com motivo), religar (super admin) e reenvio manual.
  Todas as funções exigem o segundo fator, e as que mudam algo vão para a auditoria.
- Desligar o destino cancela as entregas pendentes dele.
- O endereço só aceita https com nome público, sem IP, localhost ou rede interna. O banco confere no
  cadastro, e o motor confere de novo antes de cada envio.
- As tabelas ficam fechadas para o REST; o acesso é só pelas funções.
- O envio é assinado e repetido até 24 h, com desligamento automático e aviso.

## Tela (4.3)

Administração › Integrações (`/integracoes`), aba "Webhooks" (opção A do RT, lista com gaveta):
- **Super admin:** cadastra o destino (o segredo aparece uma vez, com "Copiar"), troca o segredo,
  desliga e religa.
- **Gestor:** vê os destinos das unidades dele e as entregas, desliga com motivo e reenvia.
- **Situação do destino:** ligado, falhando (desde quando), chave vencida (a chave da API venceu ou
  foi revogada) ou desligado (à mão ou sozinho, com o motivo).
- **Entregas:** as 200 mais recentes do destino, com a resposta do receptor e a próxima tentativa.

## O que não cobre

- **IP fixo de saída:** a Edge Function não tem IP fixo. O receptor confere a assinatura, não o IP.
- **Endereço que resolve para rede interna:** o motor recusa IP e nomes internos no texto do
  endereço, mas não resolve o DNS antes de chamar. Só o super admin cadastra destino.
- **Ordem:** a ordem de chegada não é garantida. Use o `timestamp` do evento.
- **Troca de segredo:** a troca vale na hora, sem período com os dois segredos.

## Configuração por ambiente

Sem esta configuração, o cron não chama nada, e as entregas ficam pendentes.

1. **Edge Function:** publicar a `webhooks` sem a verificação de JWT:
   `npx supabase functions deploy webhooks --no-verify-jwt --project-ref <ref>`.
2. **Vault do banco:** pelo SQL, como postgres:

   ```sql
   SELECT vault.create_secret('https://<ref>.supabase.co/functions/v1/webhooks', 'webhooks_motor_url', 'Endereço do motor de webhooks');
   SELECT vault.create_secret('<64 caracteres aleatórios>', 'webhooks_motor_segredo', 'Segredo do motor de webhooks');
   ```

   O mesmo segredo serve para o cron (no cabeçalho) e para a função (na conferência). Por isso não há
   segredo de função para manter igual.

## Chaves envolvidas (só nomes)

- **Chave da API do destino:** criada em Administração › Integrações. O destino só recebe eventos das
  unidades dela. As rotas novas pedem os recursos "Prescrições" e "Regulação".
- **Segredo do destino:** no Vault, com o nome `webhook_destino_<id>`. Só o banco e o motor (com a
  service role) leem.
- **`webhooks_motor_url` e `webhooks_motor_segredo`:** no Vault, um par por ambiente.
- **`SUPABASE_SERVICE_ROLE_KEY`** (ou a chave secreta nova): a Edge Function `webhooks` usa para
  chamar o lote e o resultado. Só a service role executa essas funções.

## Banco

| Migration | O que faz |
|---|---|
| `20270201000001_webhooks.sql` | `webhook_destinos`, `webhook_eventos`, `webhook_entregas`, gatilhos nas cinco tabelas de origem e as funções de administração |
| `20270201000002_webhooks_motor.sql` | `pg_net`, `webhook_lote`, `webhook_resultado`, `webhook_motor_autorizado`, a agenda das tentativas, o desligamento automático, a limpeza e os dois cron |
| `20270201000003_api_prescricao_regulacao.sql` | recursos `prescricoes` e `regulacao` na chave, `api_v1_leitura` |

Testes:
- `supabase/tests/fase5c_webhooks.sql` e `fase5c_webhooks_motor.sql`. Eles não dependem da semente
  local e rodam também na homologação.
- A assinatura e o endereço estão em `supabase/functions/webhooks/assinatura.test.ts`, com o vetor
  oficial do Standard Webhooks. As rotas novas estão em `supabase/functions/api/contrato.test.ts`.
  Os dois rodam no CI.

## Receptor de teste (só homologação)

`scripts/webhooks/receptor-teste.ts` faz o papel do sistema do cliente:
- confere a assinatura e o horário;
- responde 204, ou 401 quando a assinatura não confere;
- com `?status=503`, força a falha;
- registra cada chamada no log da função, sem guardar o corpo.

Ele fica fora de `supabase/functions`, porque o deploy de produção publica a pasta inteira. O jeito
de publicar está no cabeçalho do arquivo. O segredo do destino de teste vai na própria URL do destino
(`?segredo=`), e só vale para destino temporário.

## Evidência (homologação, 27/10/2026)

- **4.1:** a migration, o teste e o rollback rodaram juntos numa transação desfeita, e tudo passou.
  Depois a migration foi aplicada pelo SQL, com a versão registrada.
- **4.2, banco:** as duas migrations, o teste `fase5c_webhooks_motor.sql` e os rollbacks também
  rodaram numa transação desfeita, e tudo passou. Depois foram aplicadas pelo SQL, com as versões
  `20270201000002` e `20270201000003` registradas, e os dois cron ficaram agendados.
- **4.2, funções:** a `webhooks`, a `api` e o receptor de teste foram publicados na homologação, e o
  par do motor foi guardado no Vault.
- **Ponta a ponta:** com uma chave e dois destinos temporários, e dois eventos de teste disparados
  sem criar dado clínico:

  | Caso | Resultado |
  |---|---|
  | Destino A, segredo certo | `paciente.criado` e `prescricao.assinada` entregues (204); o receptor conferiu a assinatura nos dois |
  | Destino B, segredo que o receptor não reconhece | 401 na 1ª tentativa, 2ª tentativa no minuto seguinte com o mesmo `webhook-id`, 3ª agendada para 5 min |
  | `POST /webhooks` sem segredo ou com segredo errado | 401 |
  | `GET /prescricoes/{id}` e `/regulacao/{id}` inexistentes | 404 |
  | `GET /prescricoes/abc` | 404 |
  | sem chave | 401 |
  | `/unidades` (rota antiga) | 200 |

  Depois do teste, os destinos, as entregas e os eventos temporários foram apagados, e a chave foi
  revogada. O par do motor ficou no Vault da homologação.

## Como reverter

1. **Cron:** tirar os dois cron (rollback da `20270201000002`). Nada mais sai.
2. **Edge Functions:** apagar a `webhooks` e publicar a `api` do commit anterior. A `api` antiga não
   tem as rotas novas, e elas passam a dar 404.
3. **Banco**, na ordem inversa, com o rollback escrito no cabeçalho de cada migration:
   - a `20270201000003` tira a leitura e volta a lista de recursos (`NOT VALID`; revogue as chaves
     com os recursos novos);
   - a `20270201000002` tira o motor;
   - a `20270201000001`: primeiro os gatilhos, depois os segredos do Vault e as três tabelas, e por
     fim as funções.

O fluxo clínico não depende de nada disso.
