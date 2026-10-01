# Propostas de remediação — achados estruturais do red-team (01/10/2026)

Companheiro de `red-team-2026-10-01.md`. Cobre os achados que **não** foram
corrigidos na leva de 01/10 por serem arquiteturais, grandes ou bloqueados —
com o caminho concreto, o esforço e o risco de cada um.

Corrigidos e no ar nessa data: V2, V3, V4, V6, V11 (notify-email), V15 (banco e
edge). Commitados aguardando pipeline própria: V7, V12 (landing), V11 (Hermes/VPS).

---

## V1 — Hermes autentica no Supabase com `service_role` (Alta, estrutural)

**Hoje:** `hermes/src/lib/supabase.ts:13` cria o cliente com
`SUPABASE_SERVICE_ROLE_KEY`, que **bypassa toda a RLS**. A autorização por
unidade/papel é reimplementada em código (`hermes/src/server/skill-api.ts`).
Não há backstop no banco: um bug no filtro em código = vazamento cross-tenant
silencioso, sem a rede de proteção da RLS.

**Proposta (reduzir o alcance da chave):**
1. Criar um conjunto de RPCs `SECURITY DEFINER` no schema `public`, uma por
   operação que o agente precisa (ex.: `hermes_resumo_unidade(p_unidade)`,
   `hermes_buscar_paciente(...)`), cada uma recebendo o `perfil_id` do usuário
   do WhatsApp **resolvido pelo próprio banco** a partir do vínculo — nunca
   confiando num id vindo do agente.
2. As RPCs aplicam `papel_na_unidade`/`eh_super_admin` internamente (mesmo
   padrão das ~180 RPCs clínicas), e são `GRANT` apenas a um papel dedicado
   (ex.: `hermes_worker`), não a `service_role` cru.
3. O Hermes passa a usar a chave desse papel restrito (ou um JWT de serviço
   com `role=hermes_worker`), com `GRANT EXECUTE` só nas RPCs acima. Sem acesso
   direto a tabela.

**Efeito:** o banco volta a ser o backstop; um bug no código do agente não
vaza mais dados de outro tenant porque a RPC recusa no servidor.
**Esforço:** alto (inventariar todo acesso a tabela que o Hermes faz hoje e
trocar por RPC). Já previsto em `PREFLIGHT-HERMES.md:79`.
**Risco da migração:** médio — fazer por etapas, uma tool de cada vez, com
teste de autorização por escopo no CI antes de revogar o `service_role`.

---

## V5 — Desidentificação por regex antes do LLM offshore (Média, LGPD)

**Hoje:** `hermes/src/gateway/desidentificacao.ts` tira identificadores por
regex e **falha fechada** se sobrar resíduo, mas `residuos()` (`:181-191`) só
barra sequências de 11/15 dígitos, datas completas e e-mail. Nome próprio em
minúsculas e em prosa ("a paciente ana do leito 3") passa (`:20-22`) e pode
chegar ao DeepSeek/Kimi (fora do Brasil).

**Propostas (uma ou combinação):**
1. **NER de nomes PT-BR** antes do egress: rodar um reconhecedor de entidades
   (nome de pessoa) local no VPS (modelo pequeno, ex. spaCy/stanza PT ou um
   classificador leve) e mascarar os spans de pessoa. Mantém o fail-closed.
2. **Allowlist em vez de denylist:** em vez de tentar remover PII, enviar ao
   LLM só campos estruturados conhecidos (idade, sexo, exames, CID) e **nunca**
   texto livre de prontuário. Corta a classe inteira do problema.
3. **LLM on-shore/on-prem para dado clínico:** rodar o modelo clínico em
   infraestrutura no Brasil (ou no próprio VPS) e reservar o offshore só para
   conteúdo sem PII (ex. busca em diretriz pública). Elimina a transferência
   internacional de dado de paciente.

**Recomendação:** (2) como barreira dura imediata + (1) como defesa em
profundidade; (3) como alvo de médio prazo para o motor clínico.
**Esforço:** (2) médio, (1) médio-alto, (3) alto.
**Risco residual:** aceitar e documentar que texto livre nunca é 100% limpável
por regra — por isso a allowlist é a barreira real.

---

## V8 — `notify-email` (Média) — RESOLVIDO por REMOÇÃO (01/10/2026)

A função era legado do app de escala: referenciava `trocas`, `profissionais`,
`plantoes`, `desistencias` — tabelas que **não existem** no schema atual
(`docs/AUDITORIA-PRE-FASE1.md:112`), então retornava 500 (dormente). 2 dos 4
eventos não existem mais; os que restam já são cobertos **in-app**
(`notificacoes_plantonista` + trigger `private.notificar_vaga` +
polling de `trocas_plantao` no frontend). Canal atual = in-app/push, não e-mail.

Era uma edge function com `service_role` (`chaveSecreta()`) = superfície de
ataque viva por zero benefício. **Resolução:** removida — `supabase/functions/
notify-email/` apagada do repo + função deployada deletada do projeto
(`supabase functions delete notify-email`). Fecha V8 (e o throttle fica
sem objeto). E-mail transacional, se desejado no futuro, é feature nova de
produto (eventos nas tabelas canônicas + recipient por `perfis.email` + throttle).

**Pendência do usuário:** se havia um Database Webhook no painel apontando
para `notify-email`, remover (a função não existe mais).

---

## Menores (registro)

- **V10** — `biblioteca` confia em `tenant_id` do corpo (`biblioteca/app/main.py:46`).
  **Já mitigado na prática:** o único chamador (`clinical-search`) valida o
  `unidade_id` (UUID + vínculo ativo ou super) antes de enviar `tenant_id`
  (`supabase/functions/clinical-search/index.ts:86,91-96,123`). Caller não passa
  tenant arbitrário. Fecho definitivo (chave por tenant / claim assinado na
  biblioteca) é arquitetural e roda no VPS — pendência de infra.
- **V13** — **CORRIGIDO** (01/10): ingestão do webhook descarta mensagem com
  `timestamp` > 12h (`hermes/src/server.ts`), fechando replay pós-dedup.
  Deploy no VPS pendente.
- **V14** — `xlsx@0.18.5` (CVE-2023-30533/2024-22363) só em
  `scripts/terminologia/importar-cmed.ts` (devDependency, não vai ao bundle).
  Atualizar SheetJS via cdn.sheetjs.com quando tocar o script.
- **V16** — `NEXT_PUBLIC_MAPS_KEY` exposta ao cliente: restringir por
  domínio/referrer no Google Cloud console (ação no painel, não no código).
- **V9** — oráculo de schema do PostgREST: aceito (sem dado de linha; correção
  no PostgREST gerenciado é mais arriscada que o achado).
