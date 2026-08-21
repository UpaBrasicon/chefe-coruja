# RELATORIO-FASE-1.md — Núcleo do agente Hermes

> Status: **implementado e parcialmente verificado** — aguarda credenciais reais do
> usuário (LLM_API_KEY, Meta) e telefones E.164 para o teste ponta-a-ponta no WhatsApp.
> Data: 2026-08-21

---

## O que foi feito

### 1. Pipeline da mensagem (webhook → fila → worker)
- `src/server.ts` enfileira mensagens de texto **e** não-texto (tipo `text|outro`).
- `src/queue/index.ts`: worker executa `processarMensagem` com conexão Redis própria.
- `src/agent/pipeline.ts`:
  - **Dedup** por `message_id` (Redis SET NX, TTL 24h) — Meta reenvia; duplicatas ignoradas.
  - **Rate limit** por usuário: 20 msgs / 10 min (Redis INCR + EXPIRE).
  - **Não-texto** (áudio/imagem/sticker) → resposta fixa, sem passar pelo LLM.
  - **Número não cadastrado** → mensagem fixa "Procure o gestor da sua unidade", sem LLM.
  - Auditoria `in`/`out` em `hermes_audit_log`.
  - Sessão: janela 20 msgs / 2h (reuso ou criação).

### 2. Camada LLM (`src/lib/llm.ts`)
- Cliente OpenAI-compatible (`/chat/completions`), modelo default `deepseek-v4-flash`.
- **Tool/function calling** no formato OpenAI (confirmado na doc do DeepSeek):
  `tools`, `tool_choice`, `tool_calls` na resposta, role `tool` no histórico.
- Timeout 60s, 1 retry com backoff, fallback opcional Kimi K2.6.
- Modo thinking **não** ativado (reservado para jobs semanais da Fase 4).

### 3. Loop do agente (`src/agent/loop.ts`)
- LLM → tool_call → executa tool → anexa resultado → repete (máx. 5 iterações).
- Ferramentas declaradas (schema OpenAI): `get_meus_plantoes`, `get_plantao_do_dia`.
- Falha de LLM (primário + fallback) → mensagem de instabilidade (nunca silêncio).

### 4. Tools de leitura (`src/agent/tools.ts`)
- `get_meus_plantoes(periodo)` — filtra SEMPRE pelo `perfil_id` resolvido da identidade.
- `get_plantao_do_dia(data)` — apenas gestor/admin; plantonista recebe "sem permissão"
  (filtro de papel NO CÓDIGO, regra 3 — não confia no LLM).
- Toda execução grava em `hermes_audit_log` (direction='tool').
- Tabela usada: `escala_plantao` (principal; `escala_plantoes` é paralela/legado).

### 5. Persistência (migrations aplicadas no Supabase remoto)
- `20260821000001_hermes_persistencia.sql`:
  - `hermes_sessions` (user_id FK perfis, phone, messages jsonb, timestamps).
  - `hermes_audit_log` (user_id nullable, phone, direction CHECK in/out/tool, tool_name,
    tool_args, tool_result_summary, created_at).
  - **RLS ativo e ZERO policies** em ambas — negado a anon/authenticated; só service_role.

### 6. Resolução de identidade (`src/agent/identidade.ts`)
- Busca direta por E.164 (caso comum, barato) + fallback tolerante a formatos.
- Carrega vínculo ativo (papel + unidade) do perfil.
- `src/lib/telefone.ts`: normalização E.164 BR (8 testes).

### 7. Envio (`src/lib/whatsapp.ts`)
- Graph API `POST /{PHONE_NUMBER_ID}/messages`, timeout 15s, erro logado sem crash.

---

## Verificação (evidências)

### Testes automatizados — 14/14 passando
| Suíte | Cobertura |
|---|---|
| `telefone.test.ts` | normalização E.164 BR (8 testes) |
| `tools.integration.test.ts` | identidade (não cadastrado → null), filtro de papel no código, `get_meus_plantoes` filtra por perfil (vs Supabase real) |
| `pipeline.integration.test.ts` | dedup (2ª chamada = duplicata), rate limit (20 ok / 21ª bloqueada) (vs Redis real via docker) |

### Integração ponta-a-ponta local (compose + webhook real)
Disparado `POST /webhook` com assinatura HMAC válida, mensagem de número não cadastrado:
1. `[webhook] payload recebido com assinatura válida` ✅
2. `[webhook] mensagens enfileiradas quantidade: 1` ✅
3. `[worker] processando mensagem` ✅
4. `[pipeline] número não cadastrado` ✅
5. `[whatsapp] falha ao enviar` (401 — token Meta é placeholder de teste, esperado) ✅
6. Reenvio do MESMO `message_id` → `[pipeline] mensagem duplicada ignorada` ✅ (dedup)
7. Auditoria no Supabase: `in` ("msg recebida: oi") + `out` ("Número não cadastrado...") ✅

### Qualidade
- `npm run typecheck`: 0 erros · `npm run lint`: 0 erros · `npm run build`: OK.
- `docker compose up`: app + redis healthy, `/health` = ok.
- **Regressão pós-refatoração (buildApp + guard de entrypoint)**: revalidado em
  container real — handshake 200, POST válido 200, pipeline "não cadastrado",
  dedup "duplicada ignorada"; o guard NÃO impediu o boot (entrypoint roda `main()`).

---

## Pendências (bloqueiam o teste ponta-a-ponta real no WhatsApp)

| # | Pendência | Depende de |
|---|---|---|
| 1 | **LLM_API_KEY** (DeepSeek) — roda `npm run test:llm` e valida o loop do agente | Usuário (conta platform.deepseek.com) |
| 2 | **Credenciais Meta** (APP_SECRET, ACCESS_TOKEN, PHONE_NUMBER_ID) — envio real | Usuário (painel Meta) |
| 3 | **Telefones E.164** nos perfis de teste (`perfis.telefone` está NULL) — seed proposto no PREFLIGHT | Usuário (números reais) |
| 4 | Testar no WhatsApp real: "quais meus plantões da semana?" → resposta com escala REAL | 1+2+3 |

## Como testar ponta-a-ponta no WhatsApp (assim que tiver as credenciais)

1. **Seed dos telefones** (uma vez): rodar o SQL do PREFLIGHT-HERMES.md com os números
   reais de WhatsApp do Gestor Teste e do Plantonista Teste (E.164).
2. **Chave DeepSeek**: preencher `LLM_API_KEY` no `.env` e rodar `npm run test:llm`
   (esperado: `[llm] primario/deepseek-v4-flash (Xms): hermes online`).
3. **Credenciais Meta**: preencher `META_APP_SECRET`, `META_ACCESS_TOKEN`,
   `META_PHONE_NUMBER_ID` no `.env`.
4. **Subir**: `docker compose up --build -d` → `GET /health` deve dar `ok`.
5. **Túnel**: `cloudflared tunnel --url http://localhost:3000` → colar a URL
   `https://XXXX.trycloudflare.com/webhook` + verify token no painel Meta (campo
   `messages` assinado).
6. **Enviar do celular** para o número de teste da Meta:
   - "quais meus plantões da semana?" → resposta com a escala REAL (tool
     `get_meus_plantoes`, filtrada pelo telefone).
   - "quem está de plantão hoje?" (gestor) → escala da unidade.
   - Pergunta clínica sobre paciente → recusa e orienta usar a plataforma.
7. **Verificar logs**: `docker compose logs -f app` (pipeline, tools executadas,
   auditoria) e no Supabase: `hermes_audit_log` (in/out/tool).

## Critérios de aceite da Fase 1 — status (atualizado 21/08)

| Critério | Status |
|---|---|
| Número não cadastrado recebe mensagem fixa e nada vai ao LLM | ✅ (teste de integração: auditoria in/out no Supabase) |
| Plantonista pergunta "quais meus plantões da semana?" → plantões REAIS | ⏳ aguarda LLM_API_KEY + telefones |
| Plantonista pergunta escala de outro médico → Hermes nega | ✅ (filtro no código, testado) |
| Gestor pergunta "quem está de plantão hoje?" → escala da unidade | ⏳ aguarda credenciais (tool pronta) |
| Pergunta clínica sobre paciente → recusa e orienta usar a plataforma | ✅ (regra no system prompt) |
| Mensagem duplicada (mesmo message_id) processada 1x | ✅ (dedup: teste Redis + fluxo real e2e) |
| `hermes_audit_log` registra toda mensagem e tool | ✅ (in/out/tool confirmados no Supabase) |
| Sessão expira após 2h e contexto zera | ✅ (teste integração: updated_at envelhecido → vazia) |
| Sessão não duplica em mensagens paralelas | ✅ (UNIQUE + upsert idempotente, testado) |
| Chave LLM inválida → mensagem de instabilidade, erro logado | ✅ (loop.integration: 401 real do DeepSeek → instabilidade) |
| Mensagem não-texto → resposta fixa sem LLM | ✅ (teste integração: auditoria in/out) |
| Rate limit 20/10min | ✅ (teste Redis: 20 ok, 21ª bloqueada) |
| Envio WhatsApp falha sem crash | ✅ (whatsapp.integration: 401 → {ok:false} sem lançar) |
| Webhook handshake + assinatura HMAC | ✅ (server.test: 200/403/401) |
| Tempo mediano de resposta < 8s (non-thinking) | ⏳ aguarda chave LLM |
| typecheck/lint/build | ✅ (0 erros; 33/33 testes) |

## Checklist de fechamento (PARTE F — rodado em 21/08)

1. **`npm run typecheck`**: 0 erros ✅ · **`npm run lint`**: 0 erros ✅
2. **Testes**: 33/33 passando (unit + integração vs Supabase real e Redis real) ✅
3. **Segredos**: scan do repo — nenhum secret commitado; `hermes/.env` existe
   fisicamente (lugar correto da service key) mas **não rastreado pelo git**
   (gitignore + .dockerignore confirmados) ✅
4. **RLS das tabelas `hermes_*`**: `hermes_sessions` e `hermes_audit_log` com
   `ENABLE ROW LEVEL SECURITY` e **zero policies** (dump do remoto) — negado a
   anon/authenticated, só service_role ✅
5. **Migrations**: `20260821000001` e `20260821000002` local == remoto ✅

## Débito técnico (Fase 1)

- **Teste e2e real do caminho feliz** (LLM + tools com escala real) — bloqueado
  por `LLM_API_KEY`, creds Meta e telefones E.164 (pendências do usuário).
- **`console.log` no `llm.ts`** (bloco de execução direta do teste de fumaça) —
  aceitável, só roda via `npm run test:llm`; considerar mover para logger.
- **Tempo do `/health` com Redis down** ~7s (reconexão + timeout) — responde
  corretamente (degraded), mas poderia ser mais rápido com tuning fino.
- **Sessões antigas nunca são purgadas** (só reutilizadas/sobrescritas por
  upsert) — janela de dados cresce; considerar job de limpeza (Fase 4).

## FORA DE ESCOPO (fases futuras)
- Tools de escrita (confirmar plantão, troca) — Fase 2
- Pesquisa clínica PubMed — Fase 3
- Resumos semanais do gestor — Fase 4
- Deploy em VPS — após validação local completa
