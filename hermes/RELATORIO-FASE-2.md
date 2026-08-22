# RELATORIO-FASE-2.md — Melhorias do HERMES v1.1 (itens da revisão)

> Data: 2026-08-22 · Deployado na VPS (179.199.128.141) · Base: Hermes v1.1
> Implementa os 5 itens recomendados da revisão "o que ficou de fora" + texto
> de conformidade. Os demais itens foram decididos como NÃO implementar (ver
> "Decisões" abaixo).

---

## O que foi implementado

### 1. Cérbero Patrulha A completa (7 verificações) — `src/jobs/cerbero.ts`
Adicionadas as verificações extras (SQL/TS puro, sem LLM):
- **A4.** Leito ocupado em setor sem médico na escala de hoje
- **A5.** Censo com contagem negativa (internados/leitos_* < 0)
- **A6.** Observação com aferição no futuro / prescrição criada no futuro
- **A7.** Prescrição sem paciente vinculado (órfã — reporta só ID, nunca nome)
- (A1–A3 já existiam: sobrepostos, usuário sem papel, CRM duplicado)

**Verificado em produção**: rodou com 4 achados reais (3 plantões sobrepostos
do plantonista de teste hoje + 1 usuário sem papel). As novas verificações
rodaram sem erro e sem falso positivo nos dados de teste.

### 2. Verificação de anexos (Patrulha B) — `src/tools/anexos.ts` (8 testes)
- **Magic bytes vs. extensão**: PDF que não começa com `%PDF`, PNG/JPG/GIF/ZIP
  reconhecidos; executável MZ (`MZ`) disfarçado de documento → malicioso
- **Dupla extensão** (`laudo.pdf.exe`) → malicioso
- **Tamanho > 25 MB** → malicioso
- Extensão declarada ≠ conteúdo → suspeito

### 3. Cérbero conversacional (super_admin) — `src/agent/tools.ts`
Tools novas (declaradas no loop do agente):
- `listar_quarentena` — lista itens em quarentena
- `get_incidentes(patrulha?, severidade?)` — incidentes do Cérbero
- `liberar_quarentena(id)` — única escrita; exige confirmação explícita do
  admin na conversa (regra no system prompt)
- **Guarda de papel**: verificação em `super_admins` (tabela real); quem não é
  super_admin recebe **resposta genérica** (sem revelar o Cérbero)

### 4. Resposta genérica para não-admin — `src/agent/system-prompt.ts`
Regra de segurança no SYSTEM: não-super_admin que perguntar sobre quarentena/
segurança/integridade recebe "Não encontrei informações sobre esse assunto..."
sem revelar ferramentas internas.

### 5. Notificação "conteúdo em análise" ao autor — `src/agent/pipeline.ts`
Quando uma URL vai para quarentena, o **autor é avisado** (via canal) que o
conteúdo não foi entregue e está em análise + auditoria `out`.

### 6. Texto de conformidade — `docs/TERMO-CONFORMIDADE-SENTINELA.md`
Cláusula pronta para o termo de uso (monitoramento informado de métricas
operacionais de escala; LGPD; nota sobre passivo de monitoramento oculto).
Requer revisão jurídica antes de publicar.

---

## Verificação

| Check | Resultado |
|---|---|
| Tests | ✅ **60/61** (1 skip correto: loop sem chave — chave real presente) |
| Typecheck / lint / build | ✅ 0 erros |
| Deploy VPS | ✅ containers recriados, `/health` ok, crons registrados |
| Patrulha A completa em produção | ✅ 4 achados reais (sobrepostos + sem papel) |
| Novas verificações sem falso positivo | ✅ (dados de teste não têm leito/censo/timestamp/prescrição órfã) |

## Decisões (itens da revisão NÃO implementados)

| Item | Decisão | Por quê |
|---|---|---|
| E-mail 🟡 na notificação | ❌ não agora | Sem sistema de e-mail no projeto; in-app + chat cobrem |
| Job `cerbero_conteudo` (re-varredura 6h) | ❌ adiado | Depende do Safe Browsing (decisão: só heurísticas) |
| Patrulha C — tool calls negadas | ❌ adiado | Baixo valor imediato vs. instrumentação; fase 2 do Cérbero |
| Roteador com intenção `seguranca` | ❌ não aplicável | Não existe classificador multi-agente; guarda de papel nas tools cobre |
| `audit_seguranca()` / e-mail imediato | ❌ não aplicável | Função inexistente no banco; e-mail depende do item acima |

## Pendências / próximos

- **Safe Browsing v4** (chave Google) — ativar camada 2 quando quiser
- **WhatsApp** (número descartável) para a Corujinha atender por lá
- **Envio proativo Telegram** do relatório Sentinela via gateway Nous
- **E-mail** (SendGrid/Resend) quando a plataforma tiver

## Rollback

- Código: `git checkout main && docker compose -f docker-compose.prod.yml up -d --build`
- Não há migrations novas nesta fase (só código + docs).

---

# ATUALIZAÇÃO 22/08 — Corujinha multi-agente + Gavião Sentinela

## O que foi feito hoje

### 1. Reestruturação: Nous = cérebro · Gavião = Sentinela
- **Corujinha (Nous)** virou o cérebro conversacional com **6 skills**:
  `chefe-coruja` (operacional + escala), `chefe-coruja-seguranca`,
  `chefe-coruja-sentinela`, `chefe-coruja-athena` (Águia),
  `chefe-coruja-asclepio` (Garça), `chefe-coruja-hefesto` (Pica-pau).
- **Gavião (backend)** passou a ser **apenas Sentinela/fiscal**: tools de
  escala DESATIVADAS (executarTool só com Cérbero); mantém patrulhas
  (dados/URL/anexos/injection), fiscal do Nous (12h), relatório semanal, aba
  no admin, e os novos módulos Argos/Íris.

### 2. Agentes com nomes de aves (novos)
| Agente | Ave | Local | Função |
|---|---|---|---|
| Athena | Águia | skill Nous | visão geral da operação |
| Asclépio | Garça | skill Nous | indicadores clínicos AGREGADOS (nunca identificável — LGPD) |
| Hefesto | Pica-pau | skill Nous (super_admin) | health do backend |
| Argos | Falcão | backend job | auditoria clínica estrutural (só IDs) |
| Íris | Andorinha | backend | central de notificações (`dispatchIris`) |

### 3. Relatório semanal in-app
- Tabela `gaviao_relatorios_semanais` + job (seg 08h15 BR) + RPC
  `gaviao_painel_admin` v2 + card na aba Gavião. Validado: 3 incidentes gravados.

### 4. Otimização da Corujinha
- Cache de respostas das skills (TTL 60–300s em `/tmp/gaviao-cache`):
  79ms → 13ms na 2ª chamada.

### 5. Fiscal do Nous
- `gaviao_patrulha` agora 2x/dia (08h/20h BR = 11h/23h UTC) — fora do pico
  DeepSeek (12h).

## Verificação
- 68/69 testes (1 skip correto); typecheck/lint/build limpos; build frontend ok.
- Deploy VPS: 6 skills no Nous, crons confirmados (`argos 06h/18h BR`,
  `gaviao_patrulha 08h/20h BR`, `relatorio seg 08h15 BR`), health ok.
- LGPD respeitada: dado clínico identificável só na plataforma; chat externo
  recebe apenas agregados (regra do usuário).

## Pendências / próximos (PLANO DE AMANHÃ — otimizações por agente)
- **Safe Browsing v4** (chave Google) — camada 2 do Cérbero
- **WhatsApp** (número descartável) para a Corujinha
- **E-mail** (SendGrid/Resend) quando a plataforma tiver
- **Otimização individual de cada agente** (Águia/Garça/Pica-pau/Falcão/
  Andorinha): afinar prompts, cache, alcance das skills, métricas do Argos,
  canais da Íris.
- **Reconhecer Ricardo como super_admin** no SOUL.md (para a Corujinha mostrar
  incidentes reais na conversa).

## Rollback
- Código: `git checkout <commit-anterior> && docker compose -f docker-compose.prod.yml up -d --build`
- Migrations desta fase (00003–00005) são aditivas — tabelas novas ficam inertes
  sem o código.
