# Migração das skills para a Skill API (correções C1/C2/C3)

> Data: 22/08/2026 · Base: auditoria `hermes/AUDITORIA-AGENTES-2026-08-22.md`

## O que mudou e por quê

Antes, cada skill era um script que falava direto com o Supabase REST usando a
`SERVICE_ROLE_KEY` (que bypassa RLS). Toda a autorização — "exclusivo
super_admin", "somente gestor/admin", "só a sua unidade" — era texto no
`SKILL.md`, lido pelo LLM. Quem decidia se o dado podia sair era o modelo.

Três consequências práticas, todas fechadas agora:

1. **Um erro do modelo ou um prompt injection entregava dado restrito.**
   Agora a decisão está em `src/server/skill-api.ts`, no backend: identidade
   resolvida no banco, papel conferido em código, unidade vinda do vínculo.
2. **Argumentos entravam crus na query string do PostgREST.** Um valor como
   `x&unidade_id=neq.x` quebrava o isolamento de tenant. Agora todo argumento
   passa por validador em `_lib.sh` antes de virar consulta.
3. **`escala.sh meus_plantoes <perfil_id>` aceitava qualquer perfil** — bastava
   o agente passar outro id para ler a escala de qualquer médico. O perfil
   agora vem sempre da sessão; o argumento deixou de existir.

## Passo a passo na VPS

### 1. Backend (container hermes)

Gere o token e coloque no `.env.prod`:

```bash
openssl rand -hex 32
# SKILL_API_TOKEN=<valor gerado>
```

Suba o backend atualizado:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Confira que a rota está no ar (deve responder 401 sem token — isso é o certo):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/skill/consulta
# 401
```

Se responder **503**, o `SKILL_API_TOKEN` não foi carregado — a rota falha
fechada de propósito.

### 2. Ambiente do Nous (onde as skills rodam)

Adicione:

```bash
HERMES_BACKEND_URL=http://localhost:3000
HERMES_SKILL_TOKEN=<mesmo valor do SKILL_API_TOKEN>
```

E **remova a `SUPABASE_SERVICE_ROLE_KEY` do ambiente do Nous.** Este é o ganho
principal: mesmo que o agente seja induzido a rodar comandos arbitrários, ele
não tem mais uma chave que lê o banco inteiro. Nenhum script da pasta usa mais
essa variável — se algo quebrar por falta dela, é script antigo esquecido.

Verifique:

```bash
grep -rn "SERVICE_ROLE" deploy/nous-skill/   # não deve retornar nada
```

### 3. `CORUJA_WA_ID` — a peça que falta

Os scripts leem `CORUJA_WA_ID` do ambiente para dizer ao backend **quem** está
perguntando. O Nous precisa exportar essa variável no processo de cada sessão,
com o telefone (wa_id) do usuário daquela conversa.

Enquanto isso não estiver ligado, as skills abortam com
`CORUJA_WA_ID não definido (sessão sem usuário identificado)` — falha fechada,
de propósito: melhor a skill não responder do que responder para o usuário
errado.

## Resíduo conhecido (fecha o C1 por completo)

O `wa_id` chega do processo do Nous. Enquanto o Nous rodar com shell livre, um
agente comprometido pode exportar outro `wa_id` e se passar por outro usuário.
O que já melhorou: a chave de banco irrestrita saiu do alcance dele, e toda
decisão de acesso virou código auditável com teste.

**Fechamento definitivo**: o Nous passar um *token de sessão opaco*, emitido
pelo backend no início da conversa e não exposto ao contexto do LLM, em vez do
`wa_id`. O ponto de extensão já existe: `resolverSujeito()` em
`src/server/skill-api.ts`. Isso exige mudança no harness do Nous — é a próxima
fase, não dá para fazer só do lado das skills.

## Mudanças de assinatura (os SKILL.md já refletem)

| Antes | Agora |
|---|---|
| `escala.sh meus_plantoes <perfil_id> [periodo]` | `escala.sh meus_plantoes [periodo]` |
| `escala.sh plantao_do_dia <data> <unidade_id>` | `escala.sh plantao_do_dia [data]` |
| `escala.sh alertas_escala ...` | removido → `sentinela.sh alertas` |
| `operacional.sh alertas_escala ...` | removido → `sentinela.sh alertas` |
| `operacional.sh unidades [org]` | removido (não era usado e vazava outras orgs) |
| `operacional.sh <cmd> <unidade_id>` | `operacional.sh <cmd> [unidade_id]` |
| `sentinela.sh alertas [status] [unidade_id]` | `sentinela.sh alertas [status]` |
| `picapau.sh rls` | `picapau.sh integridade` |

## Testes

```bash
npm test                                   # suíte completa
node --import tsx --test src/server/skill-api.test.ts   # só as guardas
```

As guardas de papel têm teste dedicado (`src/server/skill-api.test.ts`):
quem afrouxar uma delas quebra o build.
