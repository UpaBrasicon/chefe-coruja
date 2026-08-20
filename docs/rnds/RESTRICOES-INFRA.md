# RNDS — Restrições de infraestrutura (FASE 4B — CRÍTICO)

> Registrado na Fase 4A. **NÃO ignorar antes de implementar o dispatch.**

## Problema

A RNDS exige, para envio de mensagens:

1. **Declaração de faixa de IP de origem** (IP inicial e final). Faixas
   genéricas como `0.0.0.0` são **recusadas**.
2. **Autenticação 2-Way SSL (mTLS)** com o **certificado digital do
   estabelecimento** (ICP-Brasil).

## Consequência para o runtime atual

- **Supabase Edge Functions**: sem IP de saída fixo (runtime compartilhado).
- **Vercel**: sem IP de saída fixo (mesmo com `vercel.json` custom, não há
  garantia de faixa declarável).

→ **Nenhum dos dois pode ser a origem do dispatch para a RNDS.**

## Decisão para a Fase 4B

O **dispatch** precisará de um **proxy de saída próprio com IP fixo**,
capaz de:

- manter a **faixa de IP** declarada à RNDS (não genérica);
- terminar o **mTLS** com o certificado do estabelecimento;
- ler da fila `interop_outbox` (status `pendente`) e enviar os Bundles.

Opções a avaliar na 4B (não decidido nesta fase):

| Opção | Prós | Contras |
|---|---|---|
| VM dedicada (ex.: EC2/VPS) + proxy reverso (nginx/HAProxy) com mTLS | IP fixo simples; controle total | operar infra; custo fixo |
| Serviço de egress fixo (ex.: provedor com IP dedicado) | IP garantido | custo; dependência externa |
| Edge Function + NAT gateway próprio | usa o Supabase p/ orquestrar | complexidade de rede |

## O que a Fase 4A NÃO faz

- Nenhuma chamada ao barramento RNDS.
- Nenhuma credencial DATASUS / mTLS / certificado no projeto.
- Nada sai do status `pendente` (o processador local só monta e valida).

## Check-list para a 4B

- [ ] Definir provedor de egress com IP fixo e declarar a faixa à RNDS
- [ ] Provisionar certificado do estabelecimento (ICP-Brasil) no proxy
- [ ] Implementar worker de dispatch lendo `interop_outbox` (`status='pendente'`)
- [ ] Implementar retry (`tentativas`, `ultimo_erro`, `id_rnds`, `enviado_em`)
- [ ] Decidir tratamento de `erro`/`descartado` (reprocessamento manual?)
