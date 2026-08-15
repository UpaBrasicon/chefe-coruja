# Chefe Coruja — Plataforma de Gestão Hospitalar (Fase 1)

Plataforma multi-tenant de gestão para hospitais, UPAs e clínicas.
**Fase 1** entrega a fundação: organizações, unidades, perfis/vínculos por papel,
setores e leitos — com RLS no banco e auditoria. A aba do **plantonista** é uma
**Central Clínica** com ferramentas de apoio à decisão (inspirada no
[hosppital.com](https://hosppital.com/)): calculadoras, escores, protocolos,
dengue, games e ventilação mecânica.

> O módulo de escala do projeto anterior (`chefe-coruja`) foi preservado na
> branch `legacy/escala`. A Fase 2+ importará o banco antigo.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | React 19 + Vite + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI) |
| Backend/DB | Supabase (Postgres + Auth + RLS) |
| Estado servidor | TanStack Query |
| Forms | react-hook-form + zod |

## Modelo de acesso

Três papéis atribuídos **por unidade** (a mesma pessoa pode ser gestor na unidade A
e plantonista na unidade B), mais o `super_admin` (dono da plataforma):

| Papel | Escopo | Vê identidade de paciente? |
|---|---|---|
| `admin` | Todas as unidades da organização | Nunca — só agregados via view |
| `gestor` | Uma unidade | Sim |
| `plantonista` | Uma unidade | Só pacientes sob seu cuidado (Fase 2) |

**Regra inviolável:** o admin não lê `leitos`/`setores` diretamente (RLS nega
`SELECT`); ele recebe apenas agregados de `vw_censo_unidade`, com supressão de
contagens < 5 (anti-dedução LGPD).

## Setup local

### Pré-requisitos
- Node.js 20.19+ (testado com 24)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase --version`)
- Um projeto Supabase novo (a Fase 1 **não** roda no banco do app de escala)

### Passo a passo

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do novo projeto

# 3. Aplicar migrations + seed
supabase link --project-ref <SEU_REF>
supabase db push

# 4. (Re)gerar tipos do Supabase (opcional — já há uma versão em src/types/database.ts)
npx supabase gen types typescript --project-id <SEU_REF> > src/types/database.ts

# 5. Rodar
npm run dev
```

### Confirmação de e-mail (obrigatória)
No painel do Supabase: **Authentication → Providers → Email → “Confirm email”**.

### Usuários de teste
1. Crie as contas pelo app (Cadastro) ou pelo dashboard em
   **Authentication → Users → Add user** — **nunca insira direto em `auth.users`**
   via SQL: o GoTrue exige uma linha correspondente em `auth.identities`, sem a
   qual o login falha com "Database error querying schema".
2. Vincule papéis via SQL (no dashboard do Supabase → SQL Editor), trocando os e-mails:

```sql
-- Dono da plataforma
INSERT INTO public.super_admins (perfil_id)
SELECT id FROM public.perfis WHERE email = 'voce@exemplo.com';

-- Admin / gestor / plantonista na UPA do seed (id fixo do seed)
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
SELECT p.id, '00000000-0000-0000-0000-000000000101', 'admin',
       (SELECT id FROM public.perfis WHERE email = 'voce@exemplo.com')
FROM public.perfis p WHERE p.email = 'admin@teste.com';

INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
SELECT p.id, '00000000-0000-0000-0000-000000000101', 'gestor',
       (SELECT id FROM public.perfis WHERE email = 'voce@exemplo.com')
FROM public.perfis p WHERE p.email = 'gestor@teste.com';

INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
SELECT p.id, '00000000-0000-0000-0000-000000000101', 'plantonista',
       (SELECT id FROM public.perfis WHERE email = 'voce@exemplo.com')
FROM public.perfis p WHERE p.email = 'plantonista@teste.com';
```

O seed cria: 1 organização, 2 unidades (UPA Centro + Hospital Regional), 4 setores
e 30 leitos.

> **Ambiente já provisionado (projeto `saqjrjtrkzkswsxxvdxn`)**: os usuários
> `super@teste.com`, `admin@teste.com`, `gestor@teste.com` e
> `plantonista@teste.com` (senha `Teste@1234`) já existem com vínculos e podem
> ser usados para testar o app. A conta `super@teste.com` é o dono da plataforma.
> (Criados via API de admin do GoTrue, com `auth.identities` corretas.)

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b --noEmit` |

## Estrutura

```
supabase/migrations/   → schema, funções, RLS, view, seed (SQL versionado)
src/
  types/database.ts    → tipos gerados do Supabase
  lib/                 → cliente, api, constantes
  contexts/            → AuthContext e UnidadeContext
  hooks/               → queries TanStack Query
  routes/              → RequireAuth, RequireRole, RedirectHome
  pages/               → telas da Fase 1
  content/registry.tsx → catálogo da Central Clínica do plantonista
  pages/plantonista/   → calculadoras, escores, protocolos, dengue, games, ventilação
  components/ui/       → shadcn/ui (Base UI)
```

## Central Clínica do plantonista

Conteúdo adaptado do site de referência (removendo Nutrição, Enfermagem e
Cirurgia; renomeando **Fisioterapia → Ventilação Mecânica**):

| Seção | Ferramentas |
|---|---|
| Calculadoras (13) | IOT, drogas vasoativas, sedação, bloqueio neuromuscular, controle glicêmico, heparinização (+ajuste TTPa), hipo/hipernatremia, hidantalização, nefropatia por contraste, profilaxia TEV, acesso venoso |
| Escores (6) | SAPS 3, PESI, NIH AVC, NEWS, NEWS 2, TIMI |
| Protocolos (7) | HDA/LAMG, hiperpotassemia, glicêmico, abstinência, colonoscopia, decanulação, nefropatia |
| Dengue (4) | Classificação/conduta/hidratação (MS), fluxograma, manual, vídeo |
| Games (2) | Infection — Pneumonia, Minigame de Emergência |
| Ventilação Mecânica (5) | HACOR, R/I ratio, manobra de recrutamento, suporte ventilatório, mobilidade funcional |

## Critérios de aceite (Fase 1)

- [x] `plantonista` chamando `setores` de outra unidade recebe **zero linhas** (bloqueio no banco).
- [x] `admin` com `select * from leitos` retorna **vazio**; só a `vw_censo_unidade` entrega agregados.
- [ ] Criar 12 leitos em um setor leva menos de 3 cliques (diálogo com prefixo + quantidade).
- [x] Revogar um vínculo derruba o acesso na sessão seguinte e fica no `log_auditoria`.

> Nota de segurança: a policy de `SELECT` de `leitos`/`setores` usa
> `unidades_gestor_plantonista()` — unidades onde o usuário é gestor ou
> plantonista. Isso impede o `admin` de ler dados diretos (migration
> `20260815000007_fase1_fix_admin_leitos.sql`).

## Auditoria de RLS (checklist de segurança)

```sql
-- todas as tabelas do schema public devem aparecer SEM rowsecurity=false
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- nenhuma policy pode ter expressão `true`
select tablename, policyname
from pg_policies
where schemaname = 'public' and with_check = 'true';
```
