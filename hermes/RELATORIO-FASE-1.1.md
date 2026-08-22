# RELATORIO-FASE-1.1.md — Sentinela de Escala + Cérbero

> Data: 2026-08-22 · Implementado e **deployado na VPS** (179.199.128.141)
> Base: Hermes v1 (Docker/Fastify/BullMQ/DeepSeek) — **arquitetura real do projeto,
> não o prompt v1.1 original** (que assumia pm2/Node 20/multi-agente inexistentes).

---

## O que foi implementado

### 1. Sentinela de Escala (Chronos) — detecção de outliers de escala
- **Migration `20260822000001_hermes_sentinela.sql`** (aplicada):
  `chronos_alertas_escala` com RLS gestor/admin da unidade (via `vinculos` —
  padrão real; não existe `usuarios_organizacoes`).
- **`src/agent/sentinela.ts`**: métricas reais sobre o schema verificado:
  - `repasses` = `solicitacoes_escala` tipo `passar_plantao` + status `aprovado`
  - `faltas` = tipo `falta`
  - `trocas_iniciadas` = `trocas_plantao` (status != 'erro')
  - `cancelamento_tardio` = repasse criado < 48h antes do plantão
  - `concentracao_destino` = % indo ao destino mais frequente
  - Detecção por **IQR (Q3 + 1.5×IQR)** e **mínimo de 8 plantões** (evita
    falso positivo) — sem LLM (requisito).
- **`src/jobs/sentinela.ts`**: job semanal (seg 06h30 BR, fora do pico DeepSeek)
  → calcula 30d/90d → insere alertas novos (sem duplicar `novo`/`visto`) →
  relatório FACTUAL (nomes + números + mediana, sem adjetivos) → notificação
  in-app (`notificacoes_plantonista`) + disponível via chat.
- **Tool `analisar_padrao_escala`** no agente com **guarda de papel no código**:
  gestor/admin veem qualquer médico; plantonista só os próprios dados.
- **Guardrails no system prompt** (fatos apenas, visível só a gestor/admin,
  linguagem neutra).

### 2. Cérbero — guardião de integridade cross-tenant
- **Migration `20260822000002_hermes_cerbero.sql`** (aplicada):
  `cerbero_incidentes`, `cerbero_url_cache`, `cerbero_quarentena` — RLS
  exclusivo **super_admin** (`private.eh_super_admin()`, tabela `super_admins`).
- **`src/tools/urlcheck.ts`**: heurísticas locais (IP literal, encurtadores,
  punycode, extensão executável, TLD risco, subdomínios excessivos,
  credenciais na URL, sem HTTPS). Safe Browsing v4 fica preparado (chave
  opcional — decisão: só heurísticas por enquanto). 12 testes.
- **`src/jobs/cerbero.ts`**:
  - **Patrulha A** (cron 1h, SQL/TS puro): plantões sobrepostos, usuário ativo
    sem papel, CRM duplicado. **Já detectou incidentes reais em produção**
    (plantão sobreposto = critico; usuário sem papel = informativo).
  - **Patrulha C** (diária 05h): prompt injection no `hermes_audit_log`
    (padrões: "ignore suas instruções", "revele system prompt", "aja como
    admin", "acesse dados de outro tenant") + volume anômalo por usuário.
- **Integração on-write (Patrulha B)** no `pipeline.ts`: URLs extraídas da
  mensagem → `verificarUrl` → `malicioso` = **quarentena** (não processa,
  incidente crítico, autor notificado em auditoria); `suspeito` = segue com
  incidente informativo + cache 24h.
- **Crons** registrados no `queue/agendador.ts` (BullMQ Repeat):
  `sentinela_escala` (seg 06h30 BR), `cerbero_dados` (1h), `cerbero_hermes`
  (05h BR) — **confirmado no log da VPS**.

## Verificação

| Check | Resultado |
|---|---|
| Migrations aplicadas no remoto | ✅ (00001 sentinela, 00002 cerbero) |
| Tests (unit + integração) | ✅ **52/53** (1 skip correto: "loop sem chave" — temos chave real; caminho feliz passou) |
| Typecheck / lint / build | ✅ 0 erros |
| Deploy VPS (docker compose up --build) | ✅ containers recriados, `/health` ok |
| Crons registrados | ✅ log: "jobs agendados: sentinela (seg 06h30), cerbero_dados (1h), cerbero_hermes (05h)" |
| Cérbero Patrulha A em produção | ✅ 2 incidentes reais detectados (plantão sobreposto critico, usuário sem papel) |
| RLS das novas tabelas | ✅ enable + policies (gestor/admin p/ sentinela; super_admin p/ cerbero) |

## Decisões de adaptação (vs. prompt original)

1. **Arquitetura**: mantida a real (Docker/BullMQ/service_role+filtro manual) —
   o prompt v1.1 assumia pm2/Node 20/`runAgentLoop`/`dispatchIris`/`usuarios_organizacoes`
   que **não existem** no projeto (verificado no banco: 56 tabelas, sem essas).
2. **Papéis**: `vinculos` (gestor/admin/plantonista) + `super_admins` em vez de
   `usuarios_organizacoes`.
3. **Notificação**: in-app (`notificacoes_plantonista`) + disponível via chat;
   o envio proativo Telegram fica para o canal Nous (documentado, sem duplicar
   mecanismo).
4. **Safe Browsing**: só heurísticas (decisão do usuário); código pronto p/ chave.
5. **Cérbero reporta IDs/números, nunca nome de paciente** (regra inviolável).

## Pendências / próximos

- **Safe Browsing v4** (chave Google) — ativar camada 2 quando quiser.
- **Envio proativo Telegram** do relatório Sentinela via gateway Nous.
- **Teste e2e no WhatsApp** (canal) — quando o número descartável estiver pronto.
- **Migração dos agentes para multi-agente** (Athena/Chronos/Cérbero como
  agentes separados) — só se o usuário quiser expandir; hoje as funcionalidades
  vivem como jobs+tools no Hermes único.

## Rollback

- **Migrations**: aditivas — `DROP TABLE` documentado nos DOWN de cada arquivo.
- **Código**: `git checkout main && docker compose -f docker-compose.prod.yml up -d --build`
  (as tabelas novas ficam inertes sem o código).
