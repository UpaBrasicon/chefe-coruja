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
