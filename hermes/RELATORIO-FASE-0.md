# RELATORIO-FASE-0.md — Fundação do projeto Hermes

> Data: 2026-08-21 · Projeto: `hermes/` (subpasta do repositório Chefe Coruja)
> Fase 0: ambiente local + Docker + webhook com validação de assinatura (SEM lógica de agente).

---

## O que foi feito

### Estrutura criada

```
hermes/
├── docker-compose.yml      # app + redis (healthcheck)
├── Dockerfile              # multi-stage (deps → build → runtime), Node 22
├── .env.example            # todas as variáveis documentadas (com nota de custo DeepSeek)
├── .gitignore              # .env, node_modules, dist
├── package.json            # Fastify, BullMQ, ioredis, pino, zod, @supabase/supabase-js
├── tsconfig.json           # NodeNext, strict
├── eslint.config.js        # flat config (eslint 9 + typescript-eslint)
└── src/
    ├── config/env.ts       # validação Zod — falha rápido se faltar variável
    ├── server.ts           # Fastify: /health, GET /webhook (handshake), POST /webhook (HMAC + fila)
    ├── queue/index.ts      # BullMQ: fila 'hermes-mensagens' + worker (Fase 0: só loga)
    ├── lib/supabase.ts     # cliente service_role (singleton)
    ├── lib/llm.ts          # stub funcional: cliente OpenAI-compatible + fallback + teste de fumaça
    └── logger.ts           # Pino estruturado (pretty em dev)
```

### Endpoints

| Endpoint | Comportamento |
|---|---|
| `GET /health` | `{ status, uptime, redis, supabase, ts }` — faz ping no Redis e `select` mínimo no Supabase |
| `GET /webhook` | Handshake da Meta (`hub.mode=subscribe` + verify_token correto → responde challenge; senão 403) |
| `POST /webhook` | Valida `X-Hub-Signature-256` (HMAC-SHA256 do **corpo bruto** com `META_APP_SECRET`); inválida → 401; válida → extrai mensagens de texto, enfileira na BullMQ, responde 200 imediato |

### Segurança já nesta fase
- **Raw body preservado** (parser `application/json` com `parseAs: buffer`) para o HMAC usar o corpo exato — Fastify parsearia antes se não configurássemos.
- **Comparação em tempo constante** (`timingSafeEqual`) na assinatura.
- **Resposta 200 rápida à Meta** sempre; processamento pesado vai para a fila.
- `SUPABASE_SERVICE_ROLE_KEY` lida apenas de `.env` (fora do git); nunca logada.

---

## Decisões tomadas

1. **Node 22 LTS no container (não 20)** — o plano pedia Node 20, mas `@supabase/supabase-js >= 2.106` exige WebSocket nativo (Node 22+); com Node 20 o container crashava em `WebSocket not found`. Node 22 é LTS atual e atende o projeto. (`engines: ">=22"` no package.json.)
2. **Nome da fila sem `:`** — BullMQ rejeita `:` no nome (`Queue name cannot contain :`) → `hermes-mensagens`.
3. **Estrutura de prompt otimizada para cache** fica para a Fase 1 (parte do `llm.ts` completo) — nesta fase o `llm.ts` já expõe o cliente com timeout 60s + 1 retry/backoff + fallback opcional Kimi.
4. **`eslint` 9 + `@eslint/js` 9** no hermes (raiz do projeto também usa 9; `@eslint/js@10` exige eslint 10 e quebrava o install).
5. **Hermes fora do lint/typecheck da raiz** — `hermes` adicionado ao `globalIgnores` do eslint raiz; tsconfig raiz já usava project references (não varre `hermes/`).

## Verificação (critérios de aceite)

| Critério | Status |
|---|---|
| `docker compose up` sobe app + redis sem erro | ✅ (redis healthy, app up) |
| `GET /health` → ok com redis e supabase conectados | ✅ `{status:"ok", redis:"connected", supabase:"connected"}` |
| `GET /webhook` responde ao handshake (testável com curl) | ✅ 200 + challenge; token errado → 403 |
| `POST /webhook` assinatura inválida → 401 | ✅ |
| `POST /webhook` assinatura válida → loga payload e 200 | ✅ payload logado, mensagem enfileirada, worker logou `wamid.TESTE123` |
| Chamada de teste ao DeepSeek V4 Flash via `src/lib/llm.ts` stub | ⏳ **PENDENTE — aguarda LLM_API_KEY** (usuário) |
| `.env` não está no repositório; `.env.example` completo | ✅ |
| `npm run typecheck` e `npm run lint` sem erro | ✅ (0 erros) |

## Como testar manualmente (passo a passo)

### a) Rodar o cloudflared tunnel apontando para a porta 3000

```bash
# Instalar cloudflared (uma vez): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

> O cloudflared imprime uma URL pública tipo `https://XXXX-XXXX.trycloudflare.com`.
> Mantenha o processo rodando em um terminal.

### b) Configurar a URL do túnel + verify token no painel da Meta (app de teste)

1. Meta for Developers → seu app → WhatsApp → **Configuration**.
2. Em **Webhook**, clicar **Edit** e preencher:
   - **Callback URL**: `https://XXXX-XXXX.trycloudflare.com/webhook`
   - **Verify token**: a string que você definiu em `META_VERIFY_TOKEN` no `.env`
3. Clicar **Verify and save** — a Meta faz um GET no nosso `/webhook`; se o token bater, salva.
4. Em **Webhook fields**, assinar o campo **`messages`**.
5. No WhatsApp **API Setup**, anotar: Phone Number ID, Token de acesso e o número de teste.

### c) Enviar uma mensagem do WhatsApp de teste e ver o payload no log

1. No WhatsApp do seu celular, enviar mensagem para o **número de teste** da Meta.
2. A Meta entrega o webhook para a URL do túnel → nosso `POST /webhook` valida a assinatura, loga e enfileira.
3. Ver o log:
   ```bash
   docker compose logs -f app
   # esperado:
   # [webhook] payload recebido com assinatura válida
   # [webhook] mensagens enfileiradas quantidade: 1
   # [worker] mensagem recebida (processamento na Fase 1) message_id: "wamid...."
   ```

> ⚠️ O META_ACCESS_TOKEN do número de teste expira em 24h — para desenvolvimento contínuo,
> gerar um token de sistema permanente depois (não é necessário para a Fase 0).

## Pendências / débito técnico

1. **LLM_API_KEY do usuário** — falta criar a conta DeepSeek e rodar `npm run test:llm` (o stub já está pronto).
2. **Credenciais Meta reais** — `.env` local usa placeholders de teste para o compose subir; as credenciais reais (APP_SECRET, ACCESS_TOKEN, PHONE_NUMBER_ID) precisam ser preenchidas pelo usuário.
3. **Telefones E.164 nos perfis** (do PREFLIGHT-HERMES.md) — bloqueia a resolução de identidade na Fase 1.
4. **BullMQ `removeOnComplete/removeOnFail`** com `age` em segundos — ok; revisar política de retenção na Fase 1 conforme volume.
5. **Worker da Fase 0** apenas loga — o pipeline real (dedup, identidade, LLM, resposta) é a Fase 1.
6. **`env.ts` exige META_APP_SECRET/etc.** — se o usuário quiser rodar só o `/health` sem Meta, pode deixar placeholders (como no `.env` de teste atual).

## Próximo passo

**Fase 1** (assim que o usuário fornecer LLM_API_KEY e telefones): pipeline da mensagem
(webhook → fila → dedup → identidade por telefone → loop do agente com tools de leitura →
resposta via Graph API), sessões (`hermes_sessions`) e auditoria (`hermes_audit_log`) com RLS
negado a anon/authenticated.
