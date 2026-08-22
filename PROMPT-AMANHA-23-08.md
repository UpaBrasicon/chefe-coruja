# Plano de 23/08/2026 — o que rodar amanhã

Contexto: em 22/08 foram corrigidas as **3 fragilidades críticas** da auditoria
dos agentes (ver `hermes/AUDITORIA-AGENTES-2026-08-22.md`). O código está no
working tree, **ainda sem commit**, e **ainda não foi para a VPS**.

Amanhã tem duas frentes, nesta ordem: **(1) colocar em produção o que já está
pronto** — é o que fecha o buraco de segurança de verdade — e **(2) atacar os
pontos de atenção** que ficaram em aberto.

---

## 1. Prompt para colar no Claude Code

Abra uma sessão nova na pasta do projeto e cole isto:

```
Continuando o trabalho de ontem (22/08) no projeto Chefe Coruja.

CONTEXTO
Ontem corrigimos as 3 fragilidades críticas da auditoria dos agentes. O
relatório completo está em hermes/AUDITORIA-AGENTES-2026-08-22.md e o passo a
passo de deploy em hermes/deploy/nous-skill/README-MIGRACAO-C1.md. Leia os dois
antes de começar.

Resumo do que mudou e está SEM COMMIT no working tree:
- Novo backend hermes/src/server/skill-api.ts (POST /skill/consulta): resolve a
  identidade do usuário no banco e aplica a guarda de papel em código. Antes a
  autorização era só texto no SKILL.md, decidida pelo LLM.
- Os 7 scripts de deploy/nous-skill/ foram reescritos: falam com esse endpoint
  em vez do Supabase REST direto, e validam todo argumento antes de consultar
  (deploy/nous-skill/_lib.sh). A SERVICE_ROLE_KEY sai do ambiente do Nous.
- IdentidadeHermes agora carrega superAdmin (tabela super_admins) e a lista de
  vínculos, com precedência determinística de papel.
- Testes das guardas em hermes/src/server/skill-api.test.ts (10 testes).

TAREFAS DE HOJE, nesta ordem:

1. Commitar o trabalho de ontem. Rode antes: cd hermes && npm test && npm run
   lint && npx tsc --noEmit. Faça um commit por assunto (skill-api + guardas /
   scripts + skills / docs de auditoria), na convenção do repo (feat(escopo):
   ...). NÃO commite a pasta deepseek-harness (é clone externo) — adicione ao
   .gitignore da raiz.

2. Corrigir o .gitignore do hermes: o padrão `.env.*` está ignorando também o
   deploy/.env.prod.example, que é arquivo de exemplo e deveria ser versionado.
   Adicione a exceção (!*.example) e commite o exemplo atualizado.

3. Item A1 da auditoria — deduplicação de incidentes (é o de maior impacto no
   backlog). Dois problemas distintos:
   a) jobs/argos.ts roda 2x/dia e reinsere os MESMOS achados (mesma prescrição
      órfã, mesmo leito) a cada execução, inflando cerbero_incidentes e o painel.
   b) jobs/gaviao.ts roda a cada 12h mas varre 24h de mensagens, então analisa
      e registra cada achado duas vezes.
   Proposta: chave de dedup estável (patrulha + titulo + id da evidência) com
   índice unique parcial para incidente em aberto + insert ignorando conflito;
   e alinhar a janela do Gavião ao intervalo do cron. Analise antes de aplicar e
   me diga se concorda com a abordagem — pode haver caso em que reincidência
   deva mesmo gerar novo incidente.

4. Item A2 — hoje aguia.sh/operacional.sh 'profissionais' devolve nome completo
   + CRM + UF do CRM para o chat externo (WhatsApp/Telegram). Há um TODO
   marcando isso em src/server/skill-api.ts (consultaAguia, case
   'profissionais'). Minha recomendação é devolver só nome e papel. Me mostre o
   impacto antes de mudar.

5. Item M6 — escrever testes para jobs/argos.ts, jobs/iris.ts e
   jobs/relatorio.ts, que hoje não têm nenhum (Cérbero e Gavião já têm). Os
   checks do Argos são puros, dá para testar com mock do supabase.

Trabalhe como dev backend sênior: antes de aplicar mudança estrutural, me
explique o trade-off. Não commite nada sem eu pedir, exceto o item 1.
```

---

## 2. Comandos para rodar na VPS (deploy do que foi feito ontem)

Enquanto o Claude trabalha no backlog, **este é o passo que realmente fecha a
vulnerabilidade** — até ele acontecer, produção continua com a autorização no
prompt e a `SERVICE_ROLE_KEY` no ambiente do agente.

O passo a passo completo está em `hermes/deploy/nous-skill/README-MIGRACAO-C1.md`.
Resumo:

```bash
# 1) Gere o token da Skill API
openssl rand -hex 32

# 2) No .env.prod da VPS, adicione o valor gerado
#    SKILL_API_TOKEN=<valor>

# 3) Envie o código novo e suba o backend
scp -r src/ deploy/ hermes@IP_DA_VPS:/home/hermes/deploy/
ssh hermes@IP_DA_VPS
cd /home/hermes/deploy
docker compose -f docker-compose.prod.yml up -d --build

# 4) Confira que a rota está no ar (401 sem token = correto)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/skill/consulta
#    401 → ok
#    503 → o SKILL_API_TOKEN não carregou (a rota falha fechada de propósito)

# 5) No ambiente do NOUS, adicione:
#    HERMES_BACKEND_URL=http://localhost:3000
#    HERMES_SKILL_TOKEN=<mesmo valor do SKILL_API_TOKEN>

# 6) E REMOVA do ambiente do Nous:
#    SUPABASE_SERVICE_ROLE_KEY     ← este é o ganho principal
grep -rn "SERVICE_ROLE" deploy/nous-skill/   # deve retornar só comentários
```

### Pendência que só você pode ligar: `CORUJA_WA_ID`

Os scripts leem `CORUJA_WA_ID` do ambiente para dizer ao backend **quem** está
perguntando. O Nous precisa exportar essa variável no processo de cada sessão,
com o telefone (wa_id) do usuário daquela conversa.

Enquanto isso não estiver ligado, as skills abortam com
`CORUJA_WA_ID não definido` — falha fechada, de propósito: melhor não responder
do que responder para o usuário errado.

---

## 3. Checklist de validação em produção

Depois do deploy, teste com dois usuários reais (ou o de teste + um plantonista):

| Teste | Esperado |
|---|---|
| Plantonista pergunta "tem incidentes de segurança?" | Mensagem genérica ("Não encontrei informações sobre esse assunto...") — sem revelar que existe ferramenta |
| Plantonista pergunta "quem está de plantão hoje?" | "Posso mostrar apenas os seus próprios plantões." |
| Plantonista pergunta "meus plantões da semana" | Lista dele, correta |
| Gestor pergunta "tem alertas de escala?" | Alertas **da unidade dele** |
| Gestor pergunta sobre incidentes/quarentena | Mensagem genérica (não é super_admin) |
| super_admin pergunta sobre incidentes | Lista real |
| Qualquer um pede unidade de outra org | Negado + incidente registrado no Cérbero |

Depois de rodar os testes, confira o painel do Gavião: a tentativa cross-tenant
deve aparecer como incidente `[SkillAPI] Tentativa de acesso a unidade não
vinculada`.

---

## 4. Backlog restante (da auditoria)

| Item | O que é | Prioridade |
|---|---|---|
| A1 | Dedup de incidentes (Argos 2x/dia + Gavião janela 24h/cron 12h) | **alta** |
| A2 | CRM de profissional saindo para chat externo | média |
| M6 | Sem testes para argos.ts, iris.ts, relatorio.ts | média |
| M2 | Comentário do cron diz "minuto 5" mas usa `every: 3_600_000` | baixa |
| M3 | `rodarPatrulhaGaviao` relê o state.db inteiro só para logar contagem | baixa |
| M4 | Relatório semanal sem dedup por período; `detalhes` cresce sem teto | baixa |
| M5 | `dispatchIrisParaGestores` insere em loop — trocar por insert em lote | baixa |
| M7 | `deepseek-harness/` (clone externo) untracked na raiz → .gitignore | baixa |

### Fase seguinte (não é para amanhã)

Fechar o resíduo do C1: fazer o Nous emitir um **token de sessão opaco** no
início da conversa, fora do contexto do LLM, e mandá-lo no lugar do `wa_id`.
Hoje um agente com shell livre ainda pode exportar outro `wa_id` e se passar por
outra pessoa — o que mudou é que ele não tem mais a chave de banco irrestrita.
O ponto de extensão já está pronto: `resolverSujeito()` em
`hermes/src/server/skill-api.ts`. Exige mudança no harness do Nous.

---

## 5. Estado do repositório em 22/08 (fim do dia)

- Typecheck limpo, lint limpo, suíte em **63 passando / 0 falhando** (16 skip
  são testes de integração que precisam de rede).
- `sessao.integration.test.ts` crasha no teardown do libuv no Windows quando o
  Supabase está inacessível — **falha pré-existente**, confirmada rodando com as
  mudanças revertidas. Não é regressão.
- Nada commitado ainda. Arquivos novos: `hermes/src/server/skill-api.ts`,
  `hermes/src/server/skill-api.test.ts`, `hermes/deploy/nous-skill/_lib.sh`,
  `hermes/deploy/nous-skill/README-MIGRACAO-C1.md`,
  `hermes/AUDITORIA-AGENTES-2026-08-22.md`.
