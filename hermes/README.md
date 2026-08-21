# HERMES — agente de WhatsApp do Chefe Coruja

Assistente de IA (via WhatsApp) para gestão hospitalar multi-tenant. Orquestra escala,
plantões e comunicação da equipe — **nunca** lê/manipula dado clínico de paciente.

- **LLM:** DeepSeek V4 Flash (`deepseek-v4-flash`, endpoint OpenAI-compatible); fallback Kimi K2.6 (opcional)
- **Stack:** Node 22 · TypeScript · Fastify · BullMQ · Redis · Docker · Supabase (fonte da verdade)
- **Fases:** 0 (fundação ✅) · 1 (núcleo do agente — implementada, aguarda credenciais reais para teste e2e) · 2+ (escrita, PubMed, resumos, VPS — futuras)

---

## Arquitetura

```
WhatsApp ──▶ Meta Cloud API ──▶ POST /webhook (HMAC-SHA256)
                                     │  (X-Hub-Signature-256, raw body)
                                     ▼
                                BullMQ (fila hermes-mensagens)
                                     │
                                     ▼
        Worker: dedup (Redis 24h) → rate limit (20/10min) → identidade (telefone E.164)
                                     │
                       ┌─────────────┴──────────────┐
                       │  não cadastrado / não-texto │  (resposta fixa, SEM LLM)
                       └─────────────┬──────────────┘
                                     ▼
                        Loop do agente (LLM + tools)
                        get_meus_plantoes · get_plantao_do_dia
                                     │
                                     ▼
              Resposta ──▶ WhatsApp ──▶ usuário   +   hermes_audit_log (tudo)
              Sessão: hermes_sessions (janela 20 msgs / 2h)
```

### Componentes (`src/`)
| Módulo | Papel |
|---|---|
| `config/env.ts` | Validação Zod das variáveis; falha rápido |
| `server.ts` | Fastify: `/health`, `GET/POST /webhook` (HMAC via raw body, `timingSafeEqual`) |
| `queue/index.ts` | BullMQ fila + worker; conexões Redis com listener de erro |
| `agent/pipeline.ts` | Dedup, rate limit, não-texto, não-cadastrado, sessão, auditoria, resposta |
| `agent/loop.ts` | Loop LLM → tools (máx 5 iterações); falha → "instabilidade" (nunca silêncio) |
| `agent/identidade.ts` | wa_id (E.164) → perfil + vínculo (papel/unidade) — filtro NO CÓDIGO |
| `agent/tools.ts` | `get_meus_plantoes` (sempre filtra pelo perfil) · `get_plantao_do_dia` (gestor/admin) |
| `agent/sessao.ts` | `hermes_sessions`: upsert atômico (UNIQUE user_id+phone), janela 20/2h |
| `agent/system-prompt.ts` | Prompt cache-friendly (estável primeiro, variável por último) |
| `lib/llm.ts` | Cliente OpenAI-compatible (timeout 60s, retry, fallback) |
| `lib/supabase.ts` | Cliente service_role (singleton) |
| `lib/telefone.ts` | Normalização E.164 BR |
| `lib/whatsapp.ts` | Envio via Graph API (timeout 15s, erro sem crash) |

---

## Regras invioláveis (do projeto)

1. **NUNCA** inventar nomes de tabela/coluna — consultar o schema real antes.
2. `SUPABASE_SERVICE_ROLE_KEY` vive **apenas** no `.env` (e `.dockerignore` impede que vá para a imagem).
3. Chamadas com service_role **bypassam RLS** → a camada de tools reimplementa o filtro de papel/unidade no código.
4. **Nenhum dado clínico** trafega pelo WhatsApp/LLM — paciente → notificação + link para a plataforma.
5. LLM padrão: **DeepSeek V4 Flash** (non-thinking no chat de rotina; thinking só em jobs semanais).
6. Tabelas `hermes_*` com **RLS ativo e zero policies** (só service_role acessa).

---

## Setup local

```bash
cd hermes
npm install
cp .env.example .env        # preencher (ver abaixo)
docker compose up --build -d
curl http://localhost:3000/health   # {"status":"ok", ...}
```

### Variáveis essenciais do `.env`
| Var | Uso |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | acesso ao Supabase (fonte da verdade) |
| `META_VERIFY_TOKEN` / `META_APP_SECRET` | handshake e validação HMAC do webhook |
| `META_ACCESS_TOKEN` / `META_PHONE_NUMBER_ID` | envio de mensagens |
| `LLM_API_KEY` | chave do DeepSeek (`LLM_MODEL=deepseek-v4-flash`) |
| `REDIS_URL` | dentro do compose: `redis://redis:6379` |

### Pré-requisito para o fluxo completo
Os perfis de teste precisam de `perfis.telefone` em **E.164** (está NULL hoje — bloqueio do PREFLIGHT):
```bash
npm run seed:telefones -- <perfil_id> +5511999990001 [<perfil_id> <telefone> ...]
```

---

## Comandos

| Script | O que faz |
|---|---|
| `npm run dev` | tsx watch (dev local) |
| `npm run build` / `start` | compila e roda produção |
| `npm run typecheck` / `lint` | checagens estáticas |
| `npm test` | 33 testes (unit + integração: Supabase real + Redis real) |
| `npm run test:llm` | teste de fumaça do DeepSeek (espera "hermes online") |
| `npm run seed:telefones` | popula telefones E.164 nos perfis de teste |
| `docker compose up --build -d` | sobe app + redis |

---

## Teste ponta-a-ponta (quando tiver credenciais)

1. Seed dos telefones (acima) · 2. `npm run test:llm` · 3. creds Meta no `.env`
4. `docker compose up --build -d` · 5. `cloudflared tunnel --url http://localhost:3000`
6. Configurar a URL do túnel + verify token no painel Meta (campo `messages`)
7. Enviar do celular: "quais meus plantões da semana?" → resposta com a escala real.

Detalhes: `RELATORIO-FASE-1.md`.

---

## Segurança

- `.dockerignore` impede `.env` (com secrets) na imagem — verificado (imagem final só `dist`/`node_modules`/`package*`).
- `/health` degrada rápido com Redis fora do ar e recupera sozinho (verificado).
- Envio WhatsApp com token inválido retorna erro sem crash (verificado).
- Auditoria completa: `hermes_audit_log` (in/out/tool) — confirmado no Supabase.
- Revisão de segurança: sem dados clínicos em logs, sem SQL dinâmico, sem secrets hardcoded.

## Relatórios

- `PREFLIGHT-HERMES.md` — inventário do ambiente (tabelas, RPCs, bloqueios)
- `RELATORIO-FASE-0.md` — fundação (Fastify/BullMQ/Redis/Docker, webhook HMAC)
- `RELATORIO-FASE-1.md` — núcleo do agente (pipeline, LLM+tools, sessões, auditoria)
