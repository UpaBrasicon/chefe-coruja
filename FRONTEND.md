# Chefe Coruja — Mapa do Frontend

> Documento de exportação do frontend: rotas, abas, controle de acesso, componentes,
> design system e o registro do reagrupamento de navegação **já implementado**.
>
> Atualizado em **22/08/2026**, após a refatoração de agrupamento e a conversão da
> Central de Plantão para o padrão de seções.
> Estado: `tsc -b --noEmit` OK · `eslint src` 0 erros / 0 warnings · build OK.

---

## Sumário

1. [Stack e configuração](#1-stack-e-configuração)
2. [Arquitetura de navegação](#2-arquitetura-de-navegação)
3. [Modelo de acesso (papéis e portões)](#3-modelo-de-acesso-papéis-e-portões)
4. [Mapa completo de rotas](#4-mapa-completo-de-rotas)
5. [Abas da sidebar por papel](#5-abas-da-sidebar-por-papel)
6. [Abas internas (agrupadores de gestão)](#6-abas-internas-agrupadores-de-gestão)
7. [Catálogos de ferramentas (registries)](#7-catálogos-de-ferramentas-registries)
8. [Componentes, hooks e libs](#8-componentes-hooks-e-libs)
9. [Design system](#9-design-system)
10. [Landing page (projeto separado)](#10-landing-page-projeto-separado)
11. [O que foi implementado nesta refatoração](#11-o-que-foi-implementado-nesta-refatoração)
12. [Avaliação técnica atual](#12-avaliação-técnica-atual)
13. [Checklist de exportação](#13-checklist-de-exportação)

---

## 1. Stack e configuração

| Item | Valor |
|---|---|
| Framework | React **19.2** + TypeScript **5.9** |
| Build | Vite **8** (`@vitejs/plugin-react`) |
| Roteamento | `react-router-dom` **7.15** (BrowserRouter) |
| Estado servidor | `@tanstack/react-query` **5.90** (`staleTime: 30s`, `retry: 1`) |
| Backend | `@supabase/supabase-js` **2.106** (auth + PostgREST + RPC + Realtime + Storage) |
| Estilo | Tailwind CSS **4.3** (via `@tailwindcss/vite`) + shadcn (`style: base-nova`, `baseColor: neutral`) |
| UI primitives | `@base-ui/react` 1.5, `cmdk`, `lucide-react` (ícones), `framer-motion` |
| Formulários | `react-hook-form` + `@hookform/resolvers` + `zod` 3.25 |
| Gráficos | `recharts` 3.10 |
| PDF / OCR | `jspdf`, `html2canvas`, `pdfjs-dist`, `tesseract.js`, `mammoth` — todos em import dinâmico |
| Saúde/interop | `@medplum/fhirtypes` |
| Alias | `@/*` → `./src/*` (`vite.config.ts` + `jsconfig.json`) |
| Deploy | Vercel (`vercel.json`) |
| PWA | `public/manifest.webmanifest` + `public/sw.js` + Web Push |

### Scripts relevantes

```bash
npm run dev        # vite
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run typecheck  # tsc -b --noEmit
npm run preview    # vite preview
```

### Entradas

- `index.html` — título `Chefe Coruja — Gestão Hospitalar`, `theme-color #0D9488`,
  manifest PWA, e um script inline que detecta `#type=recovery` do Supabase e grava
  `sessionStorage.supabase_recovery` **antes** do bootstrap do React.
- `src/main.tsx` → `src/App.tsx` (providers + rotas).

---

## 2. Arquitetura de navegação

```
QueryClientProvider
└── AuthProvider                        (sessão Supabase + perfil)
    └── BrowserRouter
        └── ErroBoundary                (barreira global)
            └── Suspense                (chunks das telas públicas)
                ├── /login              público
                ├── /cadastro           público
                ├── /r/:tipo/:token     público (validação de receita/atestado)
                └── RequireAuth         exige perfil autenticado
                    ├── /aguardando     sem vínculo ativo
                    └── UnidadeLayout → UnidadeProvider
                        ├── /seletor    escolha de unidade (só se >1 unidade)
                        ├── AppShell    sidebar + topbar + chat drawer + banners
                        │   │           └── ErroBoundary(key=rota) + Suspense
                        │   ├── RequireRole(['admin'])                        → 3 rotas
                        │   ├── RequireRole(['gestor','admin'])               → 6 rotas
                        │   ├── RequireRole(['plantonista','gestor','admin']) → 15 rotas
                        │   └── RequireRole(['plantonista'])                  → 3 rotas
                        ├── /           RedirectHome (roteia por papel)
                        └── *           RedirectHome (catch-all)
```

### Camadas de guarda

| Guarda | Arquivo | Comportamento |
|---|---|---|
| `RequireAuth` | `src/routes/RequireAuth.tsx` | Sem perfil → `/login` (guarda `location` em `state.from`). Loading → `Spinner`. |
| `RequireRole` | `src/routes/RequireRole.tsx` | `status === 'pendente'` → `/aguardando`. Avalia `papeisDaUnidade` (papéis **na unidade ativa**). Sem o papel exigido → `ROTA_INICIAL` do papel que possui, senão `/aguardando`. |
| `RedirectHome` | `src/routes/RedirectHome.tsx` | `>1 unidade` → `/seletor`; senão a `ROTA_INICIAL` do papel de maior precedência. |
| `Redirecionar` | `src/routes/Redirecionar.tsx` | Rotas legadas → destino agrupado, **preservando a query string** e resolvendo `:params`. |
| **Portão de plantão** | `AppShell.tsx` | Se `papelAtivo === 'plantonista'` e `usePlantao().status === 'fora'` → renderiza `ForaDoExpediente` no lugar de **toda** a aplicação. |
| `ErroBoundary` | `src/components/ErroBoundary.tsx` | Global (em volta das rotas) e por rota (dentro do AppShell, com `key={pathname}`). |

`ROTA_INICIAL` vive em `src/lib/constants.ts`:
`admin → /painel` · `gestor → /unidade` · `plantonista → /plantonista`.

> ⚠️ O portão de plantão é o controle de acesso mais forte do app: o plantonista só
> entra na plataforma se estiver **na escala agora** (relógio do servidor) ou com acesso pago.

---

## 3. Modelo de acesso (papéis e portões)

### Papéis (`src/types/database.ts` / `src/lib/constants.ts`)

| Papel | Label | Descrição | Ordem de precedência |
|---|---|---|---|
| `admin` | Administrador | Todas as unidades da organização (sem identidade de paciente) | 0 (maior) |
| `gestor` | Gestor | Gestão da unidade — setores, leitos e equipe | 1 |
| `plantonista` | Plantonista | Acesso aos pacientes sob seu cuidado | 2 |

Existe ainda `super_admins` (tabela) exposto como `ehSuperAdmin` no `UnidadeContext`
— **continua sem uso em rota ou menu**.

### Contexto de unidade (`src/contexts/UnidadeContext.tsx`)

- Query `vinculos` → `id, papel, unidade_id, unidades(id, nome, tipo, organizacao_id)` filtrado por `ativo = true`.
- `unidades` = vínculos deduplicados por `unidade_id`.
- `unidadeAtiva` persistida em `localStorage['chefe-coruja:unidade-ativa']`.
- **`papeisDaUnidade: Papel[]`** — papéis do usuário **na unidade ativa**, já ordenados
  por precedência. É a fonte de verdade da navegação e das guardas.
- `papelAtivo` = `papeisDaUnidade[0]`.
- `ehAdmin / ehGestor / ehPlantonista` = derivados de `papeisDaUnidade` (**escopo de unidade**,
  não mais global).
- `status`: `carregando` | `pendente` (0 unidades) | `ok`.

> ✅ Corrigido nesta refatoração: antes as flags eram globais (qualquer vínculo), então
> um usuário plantonista na unidade A e gestor na unidade B via o menu dos dois papéis
> nas duas unidades. Agora a navegação e o `RequireRole` respeitam a unidade ativa,
> igual ao portão de plantão e ao chat.

### Matriz de acesso por rota

| Rota | admin | gestor | plantonista | público |
|---|:--:|:--:|:--:|:--:|
| `/login`, `/cadastro`, `/r/:tipo/:token` | ✔ | ✔ | ✔ | ✔ |
| `/aguardando`, `/seletor` | ✔ | ✔ | ✔ | — |
| `/painel`, `/gaviao` | ✔ | — | — | — |
| `/unidade`, `/indicadores` | ✔ ¹ | ✔ | — | — |
| `/plantonista/**`, `/agenda`, `/escala`, `/internacao`, `/observacao`, `/meu-plantao`, `/notificacoes`, `/perfil` | ✔ | ✔ | ✔ | — |
| `/plantao/**` | — | — | ✔ | — |

¹ O admin entra em `/unidade`, mas a aba **Setores e Leitos** só aparece para gestor —
o agrupamento não alargou permissão de ninguém.

### Funcionalidades condicionais (fora do roteador)

| Recurso | Condição | Onde |
|---|---|---|
| Chat drawer + badge de não lidas | `papelAtivo ∈ {plantonista, gestor}` (**admin não tem chat**) | `AppShell.tsx` |
| Sino de avisos (`SinoAvisos`) | `ehPlantonista` | topbar desktop e mobile |
| Banner de notificações de turno | `papelAtivo === 'plantonista'` | `NotificacoesTurnoBanner` |
| Web Push (`useWebPush`) | `papelAtivo === 'plantonista'` | `AppShell.tsx` |
| Botão "Trocar unidade" | `unidades.length > 1` | topbar + menu mobile |
| Badge "Admin" na sidebar | `ehAdmin` | header da sidebar |
| Botões "Abrir"/"Evolução" no painel de pacientes | `ehPlantonista` (levam a rotas exclusivas dele) | `InternacaoPainel.tsx` |

---

## 4. Mapa completo de rotas

### 4.1 Públicas

| Rota | Componente | Descrição |
|---|---|---|
| `/login` | `pages/Login.tsx` (30 L) | Wrapper de `components/ui/auth-section-2.tsx` (split screen com `ImageSlider`). |
| `/cadastro` | `pages/Cadastro.tsx` (145 L) | Criar conta → tela "Verifique seu e-mail". |
| `/r/:tipo/:token` | `pages/public/LinkReceita.tsx` (40 L) | Validação pública de documento emitido por token. |

### 4.2 Autenticadas, fora do AppShell

| Rota | Componente | Descrição |
|---|---|---|
| `/aguardando` | `pages/AguardandoLiberacao.tsx` | Usuário sem vínculo ativo; aguarda liberação do gestor. |
| `/seletor` | `pages/SeletorUnidade.tsx` | Escolha da unidade quando há mais de um vínculo. |
| `/` e `*` | `routes/RedirectHome.tsx` | Redirecionador por papel. |

### 4.3 Admin

| Rota | Componente | Conteúdo |
|---|---|---|
| `/painel` | `pages/grupos/OrganizacaoGrupo.tsx` | **Organização** — abas `Censo` (PainelAdmin) e `Pessoas`. |
| `/gaviao` | `pages/admin/GaviaoPainel.tsx` (242 L) | Relatório semanal, incidentes (Cérbero), alertas de escala (Sentinela), patrulhas. |

### 4.4 Gestor + Admin

| Rota | Componente | Conteúdo |
|---|---|---|
| `/unidade` | `pages/grupos/UnidadeGrupo.tsx` | **Unidade** — abas `Setores e Leitos` (só gestor), `Configurações`, `Imagens`. |
| `/escala` ¹ | `pages/grupos/EscalaGrupo.tsx` | **Escala** — abas `Mensal`, `Fixa`, `Histórico`. |
| `/indicadores` | `pages/Indicadores.tsx` (254 L) | Censo, taxa de ocupação, média de permanência, giro de leito, ocupação ao vivo. |

¹ `/escala` é resolvida pelo componente `PorPapel`: gestor/admin veem o `EscalaGrupo`;
plantonista é redirecionado para `/agenda?aba=escala`.

### 4.5 Plantonista + Gestor + Admin

| Rota | Componente | Conteúdo |
|---|---|---|
| `/plantonista` | `pages/plantonista/PlantonistaHome.tsx` | Central do Plantonista — banner, busca fuzzy, favoritos, recentes, grid de 7 seções. |
| `/plantonista/:section` | `pages/plantonista/SectionHome.tsx` | Lista de ferramentas da seção. |
| `/plantonista/:section/:tool` | `pages/plantonista/ToolRouter.tsx` | Resolve a ferramenta (lazy), registra "recente", botão Favoritar. |
| `/agenda` | `pages/grupos/AgendaGrupo.tsx` | **Minha Agenda** — abas `Minha escala`, `Escala da unidade`, `Todas as unidades`, `Vagas`, `Extrato`. |
| `/notificacoes` | `pages/Notificacoes.tsx` | Avisos — turno, observação vencendo, decisões do gestor, candidaturas. |
| `/perfil` | `pages/Perfil.tsx` (533 L) | Foto, dados profissionais e de segurança. |
| `/internacao` ² | `pages/InternacaoPainel.tsx` (712 L) | Painel de Internação. |
| `/observacao` ² | `pages/InternacaoPainel.tsx` (`modo="observacao"`) | Painel de Observação. |
| `/meu-plantao` ² | `pages/MeuPlantao.tsx` | Check-in / check-out com geolocalização. |

² Resolvidas por `PorPapel`: plantonista cai na aba correspondente de `/plantao`;
gestor/admin continuam na tela avulsa, como antes.

### 4.6 Plantonista exclusivo — Central de Plantão

Mesma estrutura de três níveis da Central do Plantonista: hub → seção → ferramenta.

| Rota | Componente | Conteúdo |
|---|---|---|
| `/plantao` | `pages/plantao/PlantaoHome.tsx` | Hub — banner da unidade + grid de 5 `SectionCard`. |
| `/plantao/:secao` | `pages/plantao/PlantaoSectionHome.tsx` | Grid de `ToolCard` da seção — ou a própria ferramenta, se a seção tiver só uma. |
| `/plantao/:secao/:tool` | `pages/plantao/PlantaoToolRouter.tsx` | Resolve a ferramenta e injeta `unidadeId` + `perfilId`. |

Ver §7.8 para o catálogo completo das seções.

### 4.7 Rotas legadas (redirects) — **nenhum link antigo quebrou**

Todas preservam a query string original (`Redirecionar`).

| Rota antiga | Novo destino |
|---|---|
| `/pessoas` | `/painel?aba=pessoas` |
| `/setores` | `/unidade?aba=setores` |
| `/configuracao` | `/unidade?aba=configuracoes` |
| `/banners` | `/unidade?aba=imagens` |
| `/historico-escala` | `/escala?aba=historico` |
| `/minha-agenda` | `/agenda?aba=todas-unidades` |
| `/vagas` | `/agenda?aba=vagas` |
| `/extrato` | `/agenda?aba=extrato` |
| `/prescricao-teste` | `/plantonista/farmacia/consulta-medicamentos` |
| `/referencia-diluicao` | `/plantonista/farmacia/referencia-diluicao` |
| `/escala` (plantonista) | `/agenda?aba=escala` |
| `/internacao` (plantonista) | `/plantao/internacao/pacientes` |
| `/observacao` (plantonista) | `/plantao/observacao` |
| `/meu-plantao` (plantonista) | `/plantao/check-in` |
| `/plantao/internacao?paciente=X` | `/plantao/internacao/formulario?paciente=X` (na própria seção) |
| `/mensagens` | drawer do AppShell (ou `/` para admin) |

---

## 5. Abas da sidebar por papel

Construída em `AppShell.tsx` a partir de `papeisDaUnidade`. Itens repetidos entre
papéis (ex.: `Escala` para gestor e admin) são deduplicados por rota.

### Plantonista — 4 itens

| # | Label | Rota | Ícone | O que absorve |
|---:|---|---|---|---|
| 1 | Central do Plantonista | `/plantonista` | `Stethoscope` | 39 ferramentas em 7 seções |
| 2 | Plantão | `/plantao` | `Activity` | Plantão, Meu Plantão, Internação, Observação, Evolução |
| 3 | Minha Agenda | `/agenda` | `CalendarClock` | Minha Escala, Escala Geral, Minha Agenda, Vagas, Extrato |
| 4 | Avisos | `/notificacoes` | `Bell` | — |

**Mensagens saiu da sidebar**: o ícone de chat da topbar já abre o mesmo drawer, e o
item de menu nem navegava.

### Gestor — 3 itens

| # | Label | Rota | Ícone | O que absorve |
|---:|---|---|---|---|
| 1 | Escala | `/escala` | `CalendarClock` | Escala + Histórico da Escala |
| 2 | Unidade | `/unidade` | `Building2` | Setores e Leitos + Configurações + Imagens |
| 3 | Indicadores | `/indicadores` | `LineChart` | — |

### Admin — 3 itens

| # | Label | Rota | Ícone | O que absorve |
|---:|---|---|---|---|
| 1 | Organização | `/painel` | `LayoutDashboard` | Painel + Pessoas |
| 2 | Escala | `/escala` | `CalendarClock` | — |
| 3 | Gavião | `/gaviao` | `ShieldCheck` | — |

### Sem papel

Item único: **Central Clínica** → `/plantonista`.

### Barra superior (topbar) — quando `status === 'ok'`

`Nome da unidade + papel` · `Trocar unidade` (se >1) · `SinoAvisos` (plantonista) ·
`Chat + badge de não lidas` (plantonista/gestor) · `Avatar → /perfil` · `Sair`.

No mobile vira barra fixa com hambúrguer e menu em overlay full-screen.

---

## 6. Abas internas (agrupadores de gestão)

Todas as abas agrupadas usam **`components/TabsPagina.tsx`**, com o estado na URL
(`?aba=`). Isso dá deep-link, botão voltar do navegador e link compartilhável para a
aba exata. Só a aba ativa monta — as inativas não disparam suas queries.

> **Plantão não usa abas.** Depois de virar seções (§7.8), `/plantao` segue o modelo
> hub → seção → ferramenta da Central do Plantonista, com o estado no *path* e não em
> `?aba=`.

### 6.1 `/agenda` — Minha Agenda (plantonista)

| Aba | `?aba=` | Conteúdo |
|---|---|---|
| Minha escala | `escala` (default) | `Escala embutido aba="minha"` |
| Escala da unidade | `geral` | `Escala embutido aba="geral"` |
| Todas as unidades | `todas-unidades` | `MinhaAgenda embutido` |
| Vagas | `vagas` | `Vagas embutido` |
| Extrato | `extrato` | `Extrato embutido` |

As sub-abas internas de `Escala.tsx` (`minha`/`geral`) viraram abas de primeiro nível —
não há abas dentro de abas.

### 6.2 `/escala` — Escala (gestor/admin)

| Aba | `?aba=` | Conteúdo |
|---|---|---|
| Mensal | `mensal` (default) | `Escala embutido abaGestorFixa="mensal"` |
| Fixa | `fixa` | `Escala embutido abaGestorFixa="fixa"` |
| Histórico | `historico` | `HistoricoEscala embutido` |

### 6.3 `/unidade` — Unidade (gestor/admin)

| Aba | `?aba=` | Conteúdo |
|---|---|---|
| Setores e Leitos | `setores` | `Setores embutido` — **só gestor** |
| Configurações | `configuracoes` | `Configuracao embutido` |
| Imagens | `imagens` | `Banners embutido` |

### 6.4 `/painel` — Organização (admin)

| Aba | `?aba=` | Conteúdo |
|---|---|---|
| Censo | `censo` (default) | `PainelAdmin embutido` |
| Pessoas | `pessoas` | `Pessoas embutido` |

### 6.5 Formulário de internação — abas próprias (`variant="line"`)

| Aba | Valor | Componente | LOC |
|---|---|---|---:|
| 💊 Prescrição | `prescricao` | `plantao/internacao/PrescricaoTab.tsx` | 321 |
| 📝 Evolução/Admissão | `evolucao` | `plantao/internacao/EvolucaoTab.tsx` | 230 |
| 🩸 Pedidos de Exames | `exames` | `plantao/internacao/ExamesTab.tsx` | 162 |
| 🏥 Internação | `internacao` | `plantao/internacao/InternacaoTab.tsx` | 219 |
| 📥 Exportar PDF | `exportar` | `plantao/internacao/ExportarTab.tsx` | 310 |

Rota: `/plantao/internacao/formulario`.
Suporte: `DadosPaciente.tsx` (446 L), `internacao/rascunho.ts` (autossave),
`shared/rascunho.ts`, `shared/useEscalaSetores.ts`.

### O padrão `embutido`

Toda página que virou aba ganhou uma prop opcional `embutido?: boolean`. Quando `true`,
ela esconde o próprio breadcrumb/título/descrição (que agora vêm do agrupador) e mantém
todo o resto — inclusive botões de ação. A rota avulsa continua funcionando sem a prop.

Páginas com `embutido`: `MeuPlantao` · `Vagas` · `Extrato` · `MinhaAgenda` ·
`HistoricoEscala` · `Configuracao` · `Setores` · `Banners` · `Pessoas` · `PainelAdmin` ·
`InternacaoPainel` · `EvolucaoClinica` · `PrescricaoTeste` · `ReferenciaDiluicao` ·
`Internacao` (formulário) · `Escala` (que também aceita `aba` e `abaGestorFixa` para
controle externo).

---

## 7. Catálogos de ferramentas (registries)

Fonte: `src/content/registry.tsx` — **7 seções, 39 ferramentas**.
Cada ferramenta tem `slug`, `label`, `description`, `component` e `tags[]`.
Todos os componentes são carregados **sob demanda** via `sobDemanda(() => import(...), 'Nome')`.

URL: `/plantonista/{secao}/{tool}`

### 7.1 Calculadoras (`calculadoras`, `Calculator`) — 13

`iot` · `drogas-vasoativas` · `controle-glicemico` · `sedacao-continua` ·
`bloqueio-neuromuscular` · `heparinizacao-venosa` · `hiponatremia` · `hipernatremia` ·
`hidantalizacao` · `nefropatia-contraste` · `profilaxia-tev` · `acesso-venoso` ·
`heparinizacao-ajuste`

### 7.2 Escores (`escores`, `GraduationCap`) — 6

`saps3` · `pesi` · `nih-avc` · `news` · `news2` · `timi`

### 7.3 Protocolos (`protocolos`, `ClipboardList`) — 7

`hda-lamg` · `hiperpotassemia` · `controle-glicemico` · `abstinencia` ·
`preparo-colonoscopia` · `decanulacao` · `nefropatia-contraste`

### 7.4 Farmácia (`farmacia`, `FlaskConical`) — 2 🆕

| Slug | Label | Origem |
|---|---|---|
| `consulta-medicamentos` | Consulta de Medicamentos | antiga rota `/prescricao-teste` |
| `referencia-diluicao` | Referência de Diluição | antiga rota `/referencia-diluicao` |

Eram ferramentas de consulta clínica que viviam fora do registry — a busca fuzzy não as
encontrava. Dentro dele, ganharam busca, tags, favoritos e breadcrumb sem código novo.
"Prescrição Teste" foi renomeada: o nome expunha estágio de desenvolvimento em produção.

### 7.5 Dengue (`dengue`, `Wind`) — 4

`classificacao-conduta-hidratacao` · `fluxograma-conduta` · `manual-dengue` · `video-dengue`

### 7.6 Games (`games`, `Gamepad2`) — 2

`infection-pneumonia` · `minigame-emergencia`

### 7.7 Ventilação Mecânica (`ventilacao-mecanica`, `Wind`) — 5

`predicao-falencia-vni` · `recrutabilidade-pulmonar` · `manobra-recrutamento` ·
`suporte-ventilatorio` · `mobilidade-funcional`

### 7.8 Central de Plantão — registry próprio

Fonte: `src/content/plantaoRegistry.tsx` — **5 seções, 9 ferramentas**, mesmo padrão
declarativo do registry clínico, com carregamento sob demanda.

URL: `/plantao/{secao}` e `/plantao/{secao}/{tool}`

| Seção | Slug | Ícone | Ferramentas |
|---|---|---|---:|
| Meu Plantão | `check-in` | `MapPin` | 1 |
| Atendimento Porta | `atendimento-porta` | `DoorOpen` | 4 |
| Internação | `internacao` | `Hospital` | 2 |
| Observação | `observacao` | `Eye` | 1 |
| Evolução Clínica | `evolucao` | `Activity` | 1 |

| Seção | Slug da ferramenta | Label | Componente |
|---|---|---|---|
| `check-in` | `check-in` | Check-in / Check-out | `plantao/secoes/CheckIn.tsx` → `MeuPlantao` |
| `atendimento-porta` | `receituario-medico` | Receituário Médico | `plantao/atendimento/ReceituarioMedico.tsx` (286 L) |
| `atendimento-porta` | `atestado-medico` | Atestado Médico | `plantao/atendimento/AtestadoMedico.tsx` (203 L) |
| `atendimento-porta` | `encaminhamento` | Encaminhamento | `plantao/atendimento/Encaminhamento.tsx` (207 L) |
| `atendimento-porta` | `pedido-exames` | Pedido de Exames | `plantao/atendimento/PedidoExames.tsx` (213 L) |
| `internacao` | `pacientes` | Pacientes Internados | `plantao/secoes/PacientesInternados.tsx` → `InternacaoPainel` |
| `internacao` | `formulario` | Formulário de Internação | `plantao/secoes/FormularioInternacao.tsx` → `Internacao` (5 abas) |
| `observacao` | `pacientes` | Pacientes em Observação | `plantao/secoes/PacientesObservacao.tsx` → aviso 6 h + `InternacaoPainel` |
| `evolucao` | `evolucao` | Evolução Clínica | `plantao/secoes/EvolucaoTool.tsx` → `EvolucaoClinica` |

**Regra da seção direta:** seção com uma única ferramenta *é* a ferramenta.
`/plantao/evolucao` renderiza a evolução clínica direto, sem uma página intermediária
com um card só — e o `?paciente=` da URL sobrevive. O `SectionCard` dessas seções mostra
"Abrir" no rodapé em vez de "1 ferramenta". Vale para `check-in`, `observacao` e `evolucao`.

O `PlantaoToolRouter` injeta `unidadeId` e `perfilId` em toda ferramenta — as quatro de
atendimento de porta dependem dos dois para o rascunho e para a emissão do documento.

### Descoberta e personalização

- **Busca fuzzy** (`lib/search.ts`): normaliza acentos, aceita substring e
  subsequência em ordem. Indexa `label + description + secaoLabel + tags`.
- **Favoritos**: `localStorage['chefe-coruja:favoritos']` — chaves `secao/slug`.
- **Recentes**: `localStorage['chefe-coruja:recentes']` — últimas 8 chaves.
- `CHAVES_FERRAMENTAS` (exportado do registry) alimenta a migração automática das
  entradas antigas.

> ✅ Bug corrigido: favoritos e recentes eram chaveados **só pelo slug**. Como
> `controle-glicemico` e `nefropatia-contraste` existem em `calculadoras` **e** em
> `protocolos`, favoritar um marcava os dois e o card exibido era sempre o da
> calculadora. Agora a chave é `secao/slug` (`chaveFerramenta()`), e `migrar()`
> promove as entradas antigas na primeira leitura — **sem perder os favoritos do usuário**.

---

## 8. Componentes, hooks e libs

### 8.1 Componentes de UI (`src/components/ui/`) — 16 arquivos

`auth-section-2` · `badge` · `button` · `card` · `command` · `dialog` ·
`image-slider` · `input-group` · `input` · `label` · `select` · `skeleton` ·
`spinner` · `table` · `tabs` · `textarea`

### 8.2 Componentes de infraestrutura 🆕

| Componente | Papel |
|---|---|
| `components/TabsPagina.tsx` | Página com abas cujo estado vive na URL (`?aba=`). Renderiza breadcrumb, título, ícone, ações e só monta a aba ativa, dentro de um `Suspense`. |
| `components/ErroBoundary.tsx` | Barreira de erro de render, com `ErroBoundaryDeRota` para resetar na troca de rota. |
| `routes/Redirecionar.tsx` | Redirect de rota legada preservando query string e resolvendo `:params`. |
| `content/plantaoRegistry.tsx` | Registry da Central de Plantão: 5 seções, 9 ferramentas, lazy, com a regra de seção direta. |

### 8.3 Componentes de domínio

| Componente | LOC | Onde é usado |
|---|---:|---|
| `AppShell.tsx` | 353 | layout raiz autenticado |
| `plantonista/BannerCarousel.tsx` | 170 | `PlantonistaHome`, `PlantaoHome` |
| `plantonista/WeatherCard.tsx` | 408 | apenas dentro do `BannerCarousel` |
| `plantonista/cards.tsx` | — | `SectionCard` (com `rodape` opcional) + `ToolCard` — usados pelas duas centrais |
| `plantonista/ToolLayout.tsx` | — | wrapper de 37 ferramentas |
| `plantonista/NumberField.tsx` | — | 13 ferramentas |
| `plantonista/InfusionDoses.tsx` | 106 | 3 calculadoras de infusão |
| `plantonista/CopyResult.tsx` | — | `InfusionDoses`, `IOT` |
| `plantonista/QuizGame.tsx` | 125 | 2 games |
| `plantonista/SinoAvisos.tsx` | — | topbar (plantonista) |
| `plantonista/NotificacoesTurnoBanner.tsx` | — | AppShell |
| `chat/ChatDrawer.tsx` | 136 | AppShell |
| `chat/ListaConversas.tsx` | 171 | ChatDrawer |
| `chat/Thread.tsx` | 199 | ChatDrawer |
| `observacao/PainelObservacoes.tsx` | 100 | `EvolucaoClinica` |
| `observacao/GraficoEvolucao.tsx` | 127 | `EvolucaoClinica` |
| `terminologia/BuscaTerminologia.tsx` | — | `AtestadoMedico`, `PedidoExames`, `PrescricaoTeste` |

### 8.4 Hooks (`src/hooks/`)

| Hook | Exports | Papel |
|---|---|---|
| `useChat.ts` (256 L) | `useTotalNaoLidas`, `useConversas`, `useContatosChat`, `useMensagens`, `useChatRealtimeGlobal`, `useEnviarMensagem`, `useMarcarLida`, `useAbrirConversa`, `useAbrirSuporte` | chat + realtime |
| `useDocumentos.ts` (196 L) | `useDocumentos`, `useSalvarDocumento`, `useCarimbarTempo`, `useRegistrarAcessoProntuario`, `useCriarInternacao`, `useRegistrarEventoAdt`, `useInternacaoAtiva` | prontuário/ADT |
| `useDadosUnidade.ts` (77 L) | `useCenso`, `useSetores`, `useLeitos` | dados da unidade |
| `useWebPush.ts` (50 L) | `useWebPush` | notificações do navegador |
| `useTerminologia.ts` (49 L) | `useTerminologia` (CID-10, SIGTAP, CBO, CMED, LOINC) | terminologias |
| `usePessoas.ts` (45 L) | `usePessoasAdmin` | admin |
| `usePlantao.ts` (43 L) | `usePlantao` → `status: carregando \| fora \| ok` | **portão de plantão** |
| `useNotificacoesTurno.ts` (40 L) | `useNotificacoesTurno` | banner de turno |
| `useBanners.ts` (22 L) | `useBanners` | carrossel |

### 8.5 Libs (`src/lib/`)

| Arquivo | Conteúdo |
|---|---|
| `api.ts` (290 L) | `registrarAuditoria`, vínculos, setores, leitos, banners (CRUD + upload no Storage) |
| `observacao.ts` (178 L) | `getSerieObservacao` — séries temporais de sinais vitais |
| `constants.ts` | Labels de papel/unidade/setor/leito, UFs, `ORDEM_PAPEL`, **`ROTA_INICIAL`** |
| `useFavoritos.ts` | `chaveFerramenta`, `useFavoritos`, `registrarRecente`, `useRecentes` + migração |
| `search.ts` | `normalizar` + `fuzzyMatch` |
| `utils.ts` | `cn` (clsx + tailwind-merge) |
| `supabase.ts` | cliente único |

### 8.6 Interop FHIR (`src/interop/fhir/`)

`index.ts` · `mappers.ts` · `codificacao.ts` · `tipos.ts` · `__fixtures__.ts`

### 8.7 Chaves de `localStorage` / `sessionStorage`

| Chave | Onde |
|---|---|
| `chefe-coruja:unidade-ativa` | `UnidadeContext` |
| `chefe-coruja:favoritos` | `lib/useFavoritos.ts` (chaves `secao/slug`) |
| `chefe-coruja:recentes` | `lib/useFavoritos.ts` (chaves `secao/slug`) |
| `supabase_recovery` (session) | `index.html` |
| rascunhos de internação/atendimento | `plantao/internacao/rascunho.ts`, `plantao/shared/rascunho.ts` |

---

## 9. Design system

### Paleta Chefe Coruja (`src/index.css`)

| Token | Valor | Uso |
|---|---|---|
| `--cor-primaria` | `#0D9488` (teal 600) | ações primárias, `theme-color` do PWA |
| `--cor-primaria-hover` | `#0F766E` | hover |
| `--cor-secundaria` | `#F59E0B` (amber 500) | destaques, favoritos |
| `--cor-fundo` | `#F8FAFC` | fundo |
| `--cor-superficie` | `#FFFFFF` | cards |
| `--cor-borda` | `#E2E8F0` | bordas |
| `--cor-texto` | `#1E293B` | texto |
| `--cor-texto-suave` | `#64748B` | texto secundário |
| `--cor-sucesso` | `#16A34A` | leito livre, sucesso |
| `--cor-vago` | `#DC2626` | leito ocupado, erro |

Mais o set completo shadcn em **oklch** (`--background`, `--foreground`,
`--primary: oklch(0.6 0.13 175)`, `--card`, `--popover`, `--muted`, `--accent`,
`--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar*`),
com bloco `dark` via `@custom-variant dark (&:is(.dark *))`.

> ⚠️ Dark mode continua definido nos tokens mas **nunca ativado** — não há toggle nem
> classe `.dark` no `src/`. Ficou fora desta refatoração.

### Tipografia

- Sans/heading: **Geist Variable** (`@fontsource-variable/geist`, self-hosted).
- ✅ O `@import` do Google Fonts (Inter) foi removido: a fonte não era usada por
  nenhuma regra e custava um request bloqueante no CSS.

### Raio

`--radius: 0.625rem` com escala derivada `sm/md/lg/xl/2xl/3xl/4xl` (0.6× a 2.6×).

### Padrões visuais recorrentes

- Cards de navegação: `rounded-2xl border bg-card p-5`, sombra sutil,
  `hover:-translate-y-0.5` + sombra teal.
- Breadcrumb: `text-sm text-muted-foreground` + `ChevronRight className="size-3.5"`.
- Cabeçalho de página agrupada: `TabsPagina` (ícone em `rounded-xl bg-primary/10`,
  `h1 text-2xl font-semibold tracking-tight`, descrição em `text-sm text-muted-foreground`).
- Container: `mx-auto w-full max-w-4xl` (hubs) ou `max-w-6xl` (painéis/tabelas).
- Alertas inline: `rounded-lg border border-{cor}-200 bg-{cor}-50 p-3 text-sm text-{cor}-700`.

### Assets (`public/`)

`logo.png` · `logo-login.png` · `favicon.svg` · `icons.svg` · `fundo-login.png` ·
`login-img-1..4.svg` · `manifest.webmanifest` · `sw.js` · `plantao/background.png` ·
`plantao/MODELO_EXAMES.png`

---

## 10. Landing page (projeto separado)

`landing/` é um app **Next.js 14 / React 18 / Tailwind 3** independente — não
compartilha código nem design tokens com `src/`. Não foi tocado nesta refatoração.

**Páginas:** `/` · `/funcionalidades` · `/precos` · `/contato` · `/obrigado` ·
`/privacidade` · `not-found` · `robots.ts` · `sitemap.ts` · `api/contato/route.ts`

**Componentes:** `Header` · `Hero` · `CaseStudy` · `Testimonials` · `Team` · `FAQ` ·
`Location` · `ContactForm` · `CtaButton` · `StickyCta` · `Breadcrumbs` · `Footer`

---

## 11. O que foi implementado nesta refatoração

35 arquivos alterados, 7 criados, 4 removidos.

### 11.1 Correções

| # | Correção | Onde |
|---:|---|---|
| 1 | Favoritos/recentes chaveados por `secao/slug`, com migração automática das entradas antigas | `lib/useFavoritos.ts`, `content/registry.tsx`, `PlantonistaHome`, `SectionHome`, `ToolRouter` |
| 2 | Papéis com escopo de unidade (`papeisDaUnidade`) na navegação e nas guardas | `contexts/UnidadeContext.tsx`, `routes/RequireRole.tsx`, `routes/RedirectHome.tsx`, `AppShell.tsx` |
| 3 | `Suspense` do `ToolRouter` agora tem função — os componentes são de fato lazy | `content/registry.tsx` |
| 4 | `ErroBoundary` global + por rota (`key={pathname}`) | `components/ErroBoundary.tsx`, `App.tsx`, `AppShell.tsx` |
| 5 | `@import` da fonte Inter (não usada) removido | `index.css` |
| 6 | Warning de `useMemo` resolvido (`marcados` memoizado) | `plantao/internacao/PrescricaoTab.tsx` |
| 7 | Rota morta `/mensagens` eliminada (arquivo removido; admin cai em `/`) | `App.tsx` |
| 8 | Botões "Abrir"/"Evolução" do painel de pacientes gated por `ehPlantonista` — levavam a rotas que gestor/admin não podem acessar | `InternacaoPainel.tsx` |
| 9 | `EvolucaoClinica` preserva os demais parâmetros da URL ao trocar de paciente | `plantao/EvolucaoClinica.tsx` |
| 10 | Links internos apontando para rotas legadas atualizados (`BannerCarousel`, `AtendimentoTool`, `Internacao`) | vários |
| 11 | Rota catch-all `*` → `RedirectHome` (antes, URL inválida ficava em branco) | `App.tsx` |
| 12 | `SectionCard` pluraliza corretamente (`1 ferramenta` / `4 ferramentas`) e aceita `rodape` | `plantonista/cards.tsx` |
| 13 | Itens de hub (`/plantonista`, `/plantao`) perderam `end: true` — o destaque na sidebar some ao entrar numa seção | `AppShell.tsx` |

### 11.2 Code-splitting

- 39 ferramentas clínicas + 9 de plantão carregadas por
  `sobDemanda(() => import(...), 'Nome')`.
- Todas as rotas de `App.tsx` em `React.lazy`.
- Cada aba dos agrupadores em `React.lazy`, montada só quando ativa.
- `Suspense` em quatro níveis: global (telas públicas), no AppShell (troca de rota,
  mantendo menu/chat de pé), no `TabsPagina` (troca de aba) e nos routers de seção.

| Métrica | Antes | Depois |
|---|---:|---:|
| Chunk principal | 1.805 KB | **647 KB** (−64%) |
| Chunks JS gerados | 8 | **129** |
| CSS | 103 KB | 98 KB |

O que sobrou no chunk principal é runtime obrigatório: React DOM, react-router,
react-query, supabase-js e o AppShell. `jspdf` (390 KB), `pdf` (417 KB),
`html2canvas` (195 KB) e `recharts` (dentro de `EvolucaoClinica`, 362 KB) só baixam
quando a tela que os usa é aberta.

### 11.3 Reagrupamento

| Papel | Antes | Depois | Redução |
|---|---:|---:|---:|
| Plantonista | 13 | **4** | −69% |
| Gestor | 6 | **3** | −50% |
| Admin | 5 | **3** | −40% |

Nenhuma funcionalidade removida. Gestor e admin foram agrupados em abas com estado na
URL; **Plantão foi agrupado em seções**, no mesmo modelo da Central do Plantonista.
**As 16 rotas antigas continuam válidas como redirect** (preservando query string) —
links salvos, notificações push e QR codes impressos seguem funcionando.

```
ANTES (13 · plantonista)            DEPOIS (4)
├── Central do Plantonista          ├── Central do Plantonista
├── Plantão                         │   └── 7 seções ▸ 39 ferramentas
├── Meu Plantão                     │       (+ nova seção Farmácia)
├── Minha Escala                    ├── Plantão
├── Minha Agenda                    │   ├── Check-in
├── Vagas                           │   ├── Atendimento Porta ▸ 4 documentos
├── Extrato                         │   ├── Internação
├── Mensagens ──────────────┐       │   ├── Observação
├── Prescrição Teste        │       │   └── Evolução
├── Referência Diluição     │       ├── Minha Agenda
├── Painel de Internação    │       │   ├── Minha escala
├── Observação              │       │   ├── Escala da unidade
└── Avisos                  │       │   ├── Todas as unidades
                            │       │   ├── Vagas
                            │       │   └── Extrato
                            │       └── Avisos
                            └──────────▸ drawer da topbar (já existia)
```

### 11.4 Arquivos criados

```
src/components/TabsPagina.tsx                        abas com estado na URL
src/components/ErroBoundary.tsx                      barreira de erro
src/routes/Redirecionar.tsx                          redirect de rota legada
src/content/plantaoRegistry.tsx                      5 seções · 9 ferramentas de plantão

src/pages/grupos/AgendaGrupo.tsx                     Minha Agenda (5 abas)
src/pages/grupos/EscalaGrupo.tsx                     Escala gestor/admin (3 abas)
src/pages/grupos/UnidadeGrupo.tsx                    Unidade (3 abas)
src/pages/grupos/OrganizacaoGrupo.tsx                Organização admin (2 abas)

src/pages/plantao/PlantaoHome.tsx                    hub de seções
src/pages/plantao/PlantaoSectionHome.tsx             seção (grid ou ferramenta direta)
src/pages/plantao/PlantaoToolRouter.tsx              ferramenta + injeção de props
src/pages/plantao/secoes/CheckIn.tsx
src/pages/plantao/secoes/PacientesInternados.tsx
src/pages/plantao/secoes/PacientesObservacao.tsx
src/pages/plantao/secoes/FormularioInternacao.tsx
src/pages/plantao/secoes/EvolucaoTool.tsx

src/pages/plantonista/farmacia/ConsultaMedicamentos.tsx
src/pages/plantonista/farmacia/ReferenciaDiluicaoTool.tsx
```

### 11.5 Arquivos removidos

| Arquivo | Motivo |
|---|---|
| `pages/Mensagens.tsx` | Tela morta — chat vive no drawer |
| `pages/ObservacaoPainel.tsx` | Wrapper de 14 linhas — virou seção `/plantao/observacao` |
| `pages/plantao/AtendimentoPorta.tsx` | Virou a seção `/plantao/atendimento-porta` (gerada pelo registry) |
| `pages/plantao/AtendimentoTool.tsx` | Substituído pelo `PlantaoToolRouter`, genérico para todas as seções |

### 11.6 Verificação

| Verificação | Resultado |
|---|---|
| `tsc -b --noEmit` | ✅ 0 erros |
| `eslint src` | ✅ 0 erros, 0 warnings |
| `vite build` | ✅ 129 chunks, principal 647 KB |
| Smoke test no navegador (`vite preview`) | ✅ app inicializa e renderiza, 0 erros de console; `/vagas` e `/plantao/atendimento-porta` sem sessão → `/login` |

> ⚠️ **Não testado em runtime:** os fluxos autenticados (navegação entre seções e abas,
> redirects legados com sessão, permissões por papel) exigem credenciais Supabase. A
> validação foi estática (typecheck + lint) mais o boot da aplicação. Recomenda-se um
> passe manual por papel antes do deploy — em especial `/plantao/internacao/formulario`
> com `?paciente=`, vindo do painel de internados.

---

## 12. Avaliação técnica atual

### ✅ Pontos fortes

| Área | Observação |
|---|---|
| **Type safety** | `tsc -b --noEmit` sem erros. |
| **Lint** | `eslint src` limpo. Os ~1.176 erros de `npm run lint` vêm de `deepseek-harness/`, `hermes/` e `scripts/`, fora do frontend. |
| **Code-splitting** | 119 chunks + vendor separado; nenhuma tela pesada entra no carregamento inicial. |
| **Registry declarativo** | Dois registries (39 ferramentas clínicas + 9 de plantão) no mesmo formato tipado; adicionar uma = 1 linha + 1 componente, com lazy incluso. |
| **Navegação previsível** | 4/3/3 itens por papel; as duas centrais seguem o mesmo modelo hub → seção → ferramenta, e os agrupadores de gestão usam abas com estado na URL. Breadcrumb consistente em todos. |
| **Compatibilidade** | 16 rotas legadas preservadas como redirect com query string. |
| **Resiliência** | `ErroBoundary` global e por rota — erro de tela não derruba o shell. |
| **Cache entre deploys** | Vendor separado via `manualChunks` (react, supabase, base-ui, router, query, motion, zod, cmdk, forms, lucide) — libs de terceiros mantêm hash estável e não são rebaixadas a cada deploy. |
| **Guardas coerentes** | Navegação, `RequireRole`, portão de plantão e chat usam a mesma fonte (`papeisDaUnidade`). |
| **Reuso real** | `ToolLayout` em 37 telas, `NumberField` em 13, `TabsPagina` em 4 agrupadores, `SectionCard`/`ToolCard` nas duas centrais. |

### ⚠️ Pendências

| # | Severidade | Item | Nota |
|---:|---|---|---|
| 1 | 🟠 Média | **`Escala.tsx` continua com ~2.100 linhas** e ~25 estados. Ganhou props de controle externo (`embutido`, `aba`, `abaGestorFixa`) e virou aba, mas o arquivo não foi fatiado. É o maior débito estrutural restante. | Fatiar por aba: `EscalaMensal`, `EscalaFixa`, `EscalaPlantonista`, extraindo os diálogos de ação. |
| 2 | 🟡 Baixa | **Dark mode meio implementado** — tokens definidos, sem toggle nem classe `.dark`. | Fora do escopo desta refatoração. |
| 3 | 🟡 Baixa | **`WeatherCard` (408 L)** serve só ao carrossel decorativo e continua no chunk do `BannerCarousel`. | Candidato a lazy próprio ou simplificação. |
| 4 | 🟡 Baixa | **`ehSuperAdmin` calculado e nunca consumido.** | Remover ou usar. |
| ~~5~~ | ✅ Feito | ~~Chunk principal de 648 KB~~ — vendor separado via `manualChunks`: chunk principal agora é só o nosso código (**46 KB**); react/supabase/base-ui/router/query/motion/zod/cmdk/forms/lucide em chunks próprios com hash estável. | `vite.config.ts` → `build.rollupOptions.output.manualChunks`. |
| 6 | 🟡 Baixa | **Fluxos autenticados sem teste automatizado.** Não há testes de frontend no projeto. | Um smoke E2E por papel cobriria o essencial. |

### Métricas

```
src/ ................... 163 arquivos .ts/.tsx
pages + components ..... 18.859 linhas
Rotas .................. 31 (3 públicas, 28 autenticadas, incl. 16 redirects legados)
Itens de sidebar ....... 4 plantonista / 3 gestor / 3 admin
Registries ............. 2 — clínico (7 seções · 39 ferramentas)
                             plantão (5 seções · 9 ferramentas)
Agrupadores com abas ... 4 (Agenda, Escala, Unidade, Organização)
Abas totais ............ 13 nos agrupadores + 5 no formulário de internação
Bundle principal ....... 46 KB JS (nosso código, era 647 KB incl. vendor)
Vendor chunks .......... 11 (react, supabase, base-ui, router, query, motion,
                             zod, cmdk, forms, lucide, other) — hash estável
Chunks JS .............. 119 (eram 8)
typecheck .............. OK — 0 erros
eslint src ............. OK — 0 erros, 0 warnings
```

---

## 13. Checklist de exportação

```
chefe-coruja/
├── index.html                  # entrada + PWA + hook de recovery
├── package.json                # deps do frontend
├── vite.config.ts              # build + alias @
├── tsconfig.json / .app.json / .node.json
├── jsconfig.json               # alias para editores
├── eslint.config.js
├── components.json             # config shadcn
├── vercel.json                 # SPA rewrite
├── public/                     # 12 assets + manifest + service worker
└── src/
    ├── main.tsx, App.tsx, index.css, vite-env.d.ts
    ├── routes/                 # RequireAuth, RequireRole, RedirectHome, Redirecionar
    ├── contexts/               # AuthContext, UnidadeContext
    ├── components/
    │   ├── ui/                 # 16 primitivos shadcn
    │   ├── plantonista/        # 9 componentes
    │   ├── chat/               # 3 componentes
    │   ├── observacao/         # 2 componentes
    │   ├── terminologia/       # 1 componente
    │   ├── AppShell.tsx
    │   ├── TabsPagina.tsx      # abas com estado na URL
    │   └── ErroBoundary.tsx
    ├── content/
    │   ├── registry.tsx        # 7 seções · 39 ferramentas clínicas (lazy)
    │   └── plantaoRegistry.tsx # 5 seções · 9 ferramentas de plantão (lazy)
    ├── pages/
    │   ├── grupos/             # 4 agrupadores com abas
    │   ├── plantonista/        # hub + seções + 39 ferramentas (incl. farmacia/)
    │   ├── plantao/            # hub + seções + secoes/ + atendimento/ + internacao/
    │   ├── gestor/, admin/, public/
    │   └── (telas avulsas)
    ├── hooks/                  # 9 hooks
    ├── lib/                    # 7 módulos
    ├── interop/fhir/           # 5 módulos
    └── types/database.ts       # tipos do schema Supabase

landing/                        # app Next.js separado (marketing)
```

**Variáveis de ambiente** (ver `.env.example`): as chaves `VITE_*` são as únicas
consumidas pelo frontend via `import.meta.env`.

**Fora do escopo de frontend** (não exportar): `hermes/`, `deepseek-harness/`,
`scripts/`, `spikes/`, `strix_runs/`, `supabase/`, `data/`, `dist/`.

---

*Documento atualizado após o reagrupamento e a conversão da Central de Plantão para
seções. Revalidar após qualquer nova refatoração de rotas.*
