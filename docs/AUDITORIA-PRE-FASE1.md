# AUDITORIA PRÉ-FASE 1 — Chefe Coruja

> Gerado: 2026-08-17 · Escopo: leitura integral das 44 migrations (`supabase/migrations/`), 1 edge function, `config.toml`, `src/types/database.ts` e código-fonte de persistência do frontend.
> Método: leitura direta + verificação programática (Node) cruzando `CREATE TABLE` × `ENABLE ROW LEVEL SECURITY` e `SECURITY DEFINER` × `SET search_path`.
> **Nenhum arquivo foi alterado nesta etapa.**

---

## 1. Mapa do schema (48 tabelas + 2 views)

Legenda de módulos: **AUTH** = identidade/estrutura · **ESCALA** = escala/plantão · **PRESCR** = prescrição/medicamentos · **CLÍNICO** = dados clínicos do paciente · **ADT** = internação/alta · **FIN** = financeiro · **CHAT** · **INFRA** = configuração/auditoria/notificação.

| Tabela | RLS | Tenant | Módulo |
|---|---|---|---|
| `organizacoes` | ✅ | — (raiz do tenant) | AUTH |
| `unidades` | ✅ | `organizacao_id` | AUTH |
| `perfis` | ✅ | 1:1 `auth.users` | AUTH |
| `vinculos` | ✅ | `unidade_id` (+ papel por unidade) | AUTH |
| `setores` | ✅ | `unidade_id` | AUTH |
| `leitos` | ✅ | via `setor_id` → unidade | AUTH |
| `log_auditoria` | ✅ | `unidade_id` (nullable) | INFRA |
| `super_admins` | ✅ | — (plataforma) | AUTH |
| `banners` | ✅ | `unidade_id` | INFRA |
| `escala_plantoes` ⚠️ | ✅ | `unidade_id` | ESCALA (legada) |
| `escala_plantao` | ✅ | `unidade_id` | ESCALA (dedicada) |
| `escala_fixa` | ✅ | `unidade_id` | ESCALA |
| `solicitacoes_escala` | ✅ | `unidade_id` | ESCALA |
| `candidaturas_escala` | ✅ | `unidade_id` | ESCALA |
| `acessos_plantonista` | ✅ | `unidade_id` | ESCALA |
| `presenca_plantonista` | ✅ | `unidade_id` | ESCALA |
| `historico_escala` | ✅ | `unidade_id` | ESCALA |
| `trocas_plantao` | ✅ | `unidade_id` | ESCALA |
| `remuneracoes_plantao` | ✅ | `unidade_id` | FIN |
| `medicamentos` ⚠️ | ✅ | — (base global de referência) | PRESCR (legada) |
| `medicamento` ⚠️ | ✅ | — (base canônica de curadoria) | PRESCR |
| `medicamento_bula` | ✅ | — (global) | PRESCR |
| `diluicao` | ✅ | — (global) | PRESCR |
| `pacientes` | ✅ | `unidade_id` | CLÍNICO |
| `cuidados_plantonistas` | ✅ | `unidade_id` | CLÍNICO |
| `prescricoes` | ✅ | `unidade_id` | PRESCR |
| `prescricao_itens` | ✅ | herda via `prescricao_id` (sem `unidade_id` própria) | PRESCR |
| `assinaturas` | ✅ | herda via prescrição | PRESCR |
| `receitas_retidas` | ✅ | herda via prescrição | PRESCR |
| `notificacoes_whatsapp` | ✅ | herda via prescrição | PRESCR |
| `links_publicos_receita` | ✅ | herda via prescrição | PRESCR |
| `sugestoes_prescricao` | ✅ | `organizacao_id` + `unidade_id` | PRESCR |
| `internacoes` | ✅ | `organizacao_id` + `unidade_id` | ADT |
| `eventos_adt` | ✅ | `organizacao_id` + `unidade_id` | ADT |
| `eventos_leito` | ✅ | `unidade_id` | ADT |
| `documentos_clinicos` | ✅ | `organizacao_id` + `unidade_id` | CLÍNICO |
| `log_acesso_prontuario` | ✅ | `organizacao_id` + `unidade_id` | CLÍNICO |
| `censo_ocupacao` | ✅ | `organizacao_id` + `unidade_id` | ADT |
| `transferencias_paciente` | ✅ | `unidade_id` | ADT |
| `checklist_admissao` | ✅ | `unidade_id` | ADT |
| `alta_paciente` | ✅ | `unidade_id` | ADT |
| `notificacoes_plantonista` | ✅ | `unidade_id` | INFRA |
| `push_subscriptions` | ✅ | por usuário (`perfil_id`) | INFRA |
| `mensagens_chat` ⚠️ | ✅ | `unidade_id` | CHAT (legado) |
| `conversas` | ✅ | `unidade_id` (nullable = suporte) | CHAT |
| `conversa_participantes` | ✅ | herda via conversa | CHAT |
| `chat_mensagens` | ✅ | herda via conversa | CHAT |

**Views** (sem RLS próprio — leem por função `SECURITY DEFINER` com supressão LGPD < 5):
- `vw_censo_unidade` (agregados de setores/leitos — admin não lê `setores`/`leitos` direto)
- `vw_indicadores_unidade` (total pacientes, prescrições assinadas/rascunho, receitas retidas — com supressão 1–4)

**Verificação automática:** 48/48 tabelas criadas têm `ENABLE ROW LEVEL SECURITY`; 0 tabelas sem RLS.

**Infraestrutura associada (fora das tabelas):**
- **pg_cron**: job `censo-diario-madrugada` (migration 0043) roda `gerar_censo_todas_unidades()` às 06:00 UTC = 03:00 BRT — censo do dia anterior em todas as unidades ativas.
- **Realtime**: `supabase_realtime` publica `chat_mensagens` e `conversa_participantes` (migration fase4-chat) — chat em tempo real via `postgres_changes`.
- **Storage buckets**: `receitas` (privado), `atendimento` (privado), `banners` (público), `fotos` (privado) — detalhes na seção 4.4.

---

## 2. Onde ficam os dados clínicos hoje

| Dado | Local atual | Formato | Onde no código/SQL |
|---|---|---|---|
| **Sinais vitais** | ❌ **Não há tabela nem coluna** | texto livre em evolução | `documentos_clinicos.conteudo` (text) — template SOAP "Exame físico (sinais vitais e achados)"; rascunho `EvolucaoTab.tsx` |
| **Resultados de exame** | ❌ **Não há tabela** | texto livre | `exames.texto` em rascunho `cc:rascunho:*` (localStorage, TTL 12h); campo 22 da AIH; impresso em folha (`ExamesTab.tsx`/`PedidoExames.tsx`) — **nada é persistido no banco** |
| **Diagnósticos (CID)** | Parcial — **coluna fixa** + texto livre | `internacoes.cid_principal` (text); CID em atestado (`AtestadoMedico.tsx`) e AIH campos 24–26 ficam **só em rascunho localStorage** | `internacoes.cid_principal` (migration 0034) |
| **Procedimentos** | ❌ **Não há tabela** | texto livre | `documentos_clinicos` (termo de consentimento é um `tipo_documento`), rascunhos |
| **Medicamentos prescritos** | ✅ **Tabela dedicada** | `prescricao_itens` (FK `medicamento_id` → `medicamentos`; dose, posologia) + `prescricoes` (cabeçalho) | migrations 0009, 0010, 0026 |
| **Base de medicamentos/diluição (referência)** | ✅ Tabelas canônicas | `medicamento` (rxcui, ANVISA), `diluicao` (só `status='publicado'` visível), `medicamento_bula` (apoio EN) | migrations 0031–0033 |

**Achado crítico:** o fluxo de atendimento de plantão (paciente → prescrição → evolução → exames → AIH) é **rascunho em `localStorage`** (`src/pages/plantao/shared/rascunho.ts`, prefixo `cc:rascunho:`, TTL 12 h, limpo no logout). A única persistência real é via `documentos_clinicos` (ADT, quando usada) e `prescricoes`/`prescricao_itens`. O `ARQUITETURA_ADT.md` já lista como Fase 2 "persistir documentos clínicos (evolução, admissão, exames, AIH) — substituir localStorage" — **não implementado**.

### 2.1 Inventário de colunas JSONB (nenhuma delas é usada para dados clínicos)

| Coluna | Tabela | Uso |
|---|---|---|
| `payload` | `log_auditoria` | payload de auditoria (append-only) |
| `payload` | `notificacoes_whatsapp` | log de envio (template/dados) |
| `estado_antes` / `estado_depois` / `payload` | `eventos_adt` | event sourcing ADT (estados seriais + payload da transição) |
| `snapshot` | `censo_ocupacao` | snapshot do censo materializado |
| `dados` | `historico_escala` | antes/depois das alterações de escala |
| `dados_pessoais` | `perfis` | dados pessoais do plantonista (contato de emergência, RQE, alergias, preferências) |
| `subscription` | `push_subscriptions` | subscription push do navegador (VAPID) |
| `criterios` | `alta_paciente` | critérios da alta médica |

> No escopo das migrations 04–17, a única coluna JSONB é `p_payload` (parâmetro de `registrar_auditoria`). As demais acima estão nas migrations 01/09/23/25/27/28/34.

---

## 3. Edge Functions

| Função | O que faz | Autenticação | Status |
|---|---|---|---|
| `notify-email` (`supabase/functions/notify-email/index.ts`) | Envia e-mails transacionais via **Resend** em 4 cenários: troca recebida, troca aceita/recusada, conta aprovada, designado para vaga | **Secret compartilhado** (`Authorization: Bearer <WEBHOOK_SECRET>` configurado no Database Webhook) — NÃO usa anon key nem JWT de usuário; fail-closed (500 sem secret, 401 se inválido); internamente usa `SERVICE_ROLE_KEY` | ⚠️ **DESATUALIZADA** |

**Achado crítico:** `notify-email` consulta tabelas que **não existem no schema atual**: `trocas`, `profissionais`, `plantoes`, `desistencias`, `tipos_turno` (e `setores` em join). Essas pertencem ao app legado de escala (branch `legacy/escala`). No schema atual os equivalentes seriam `trocas_plantao`, `perfis`, `escala_plantao`, `solicitacoes_escala`. Se disparada hoje, quebraria (erro 500 — tabelas inexistentes). **Nenhum bloco `[functions.*]` no `config.toml`** (a função é descoberta pelo diretório).

---

## 4. Achados de segurança

### 4.1 Tabelas sem RLS
**Nenhuma.** 48/48 com RLS habilitado (verificação automática).

### 4.2 Políticas com `USING (true)` / `WITH CHECK (true)`

| Política | Tabela | Migration | Contexto |
|---|---|---|---|
| `medicamentos_select` — `USING (true)` | `medicamentos` (legada) | 0010, linha 11 | Leitura de qualquer autenticado na base de referência global — sem tenant, plausível, mas **aberta** |
| `medicamento_select` — `USING (true)` | `medicamento` (canônica) | 0031, linha 78 | Idem — base canônica de curadoria |

Nenhuma política com `WITH CHECK (true)`. As demais políticas são restritivas (delegam a `private.eh_super_admin()` / `private.papel_na_unidade()` etc.).

### 4.3 SECURITY DEFINER sem `SET search_path`

**Nenhuma das 94 funções SECURITY DEFINER está sem `search_path`** (verificação automática; a migration `20260817000001_fix_security_definer_search_path.sql` já blindou as 8 que faltavam em 2026-08-17).

⚠️ **Nota de consistência (não é vulnerabilidade):** há 2 padrões de `search_path` em uso:
- `SET search_path = ''` (SQL puro, tudo qualificado) — migrations 0001–0026;
- `SET search_path = public` (PL/pgSQL que referencia `public.*`/`private.*` **qualificados**) — migrations 0028+. O padrão documentado no fix é `public, private, pg_temp`; o uso de só `public` é seguro porque os objetos são qualificados, mas é inconsistente.

As únicas funções sem `search_path` (`private.hash_evento`, `private.internacao_ativa`) **não** são SECURITY DEFINER — sem risco do CVE.

### 4.4 Buckets de storage

| Bucket | Público | Políticas | Observação |
|---|---|---|---|
| `receitas` (0009) | ❌ privado | nenhuma específica (proteção por padrão) | PDFs de receitas assinadas |
| `atendimento` (0012) | ❌ privado | `atendimento_upload`/`atendimento_read` = **qualquer autenticado** | ⚠️ sem checagem de papel/escala (achado A2) |
| `banners` (0008) | ✅ **público** | upload/delete restritos a gestor da unidade / admin da org / super, validando pasta `{unidade_id}/`; leitura via URL pública (sem policy SELECT) | imagens do carrossel — público por design |
| `fotos` (0027) | ❌ privado | — | fotos de perfil do plantonista |

### 4.5 Outros achados

| # | Severidade | Achado | Local |
|---|---|---|---|
| A1 | 🔴 Alto | Edge function `notify-email` referencia tabelas inexistentes no schema atual (legado de escala) | `functions/notify-email/index.ts` |
| A2 | 🟠 Médio | Bucket `atendimento`: policy de upload aceita **qualquer autenticado** (`bucket_id = 'atendimento'`), sem checagem de escala/papel — o próprio código admite "refinar com escala na evolução" | migration 0012 |
| A3 | 🟠 Médio | Duas bases de medicamentos coexistem: `medicamentos` (plural, usada por `prescricao_itens` e `PrescricaoTeste`) × `medicamento` (singular, canônica com `diluicao`) — o motor de prescrição ainda não usa a canônica | migrations 0009 × 0031 |
| A4 | 🟠 Médio | Escala duplicada: `escala_plantoes` (legada, Fase 2) × `escala_plantao` (dedicada, Fase 3) — `ARQUITETURA_ADT.md` já marca "**Unificar** em `escala_plantao`" | migrations 0011 × 0014 |
| A5 | 🟡 Baixo | `push_subscriptions` tem RLS com **apenas policy de SELECT** — escrita 100% via RPC (fail-closed, aceitável) | migration 0025 |
| A6 | 🟡 Baixo | `medicamento_bula` sem policies UPDATE/DELETE (escrita de bula só INSERT restrito a super) | migration 0032 |
| A7 | 🟡 Baixo | `mensagens_chat` (chat legado) permite INSERT de qualquer autenticado da unidade, sem validação de escala — o chat real é `conversas`/`chat_mensagens` (fail-closed) | migration 0028 |
| A8 | 🟡 Baixo | `config.toml`: `enable_confirmations = false` (e-mail sem confirmação) e `minimum_password_length = 6` | `supabase/config.toml` |

---

## 5. Estratégia de multi-tenancy atual

**Modelo: coluna `unidade_id` por linha + RLS por papel derivado do vínculo (NÃO há schema por tenant, NÃO há claim custom no JWT).**

- **Hierarquia:** `organizacoes` → `unidades` → `setores` → `leitos`. O "tenant" operacional é a **unidade**; a organização é o tenant de agregação (admin).
- **Derivação do tenant:** a partir de `auth.uid()` → `perfis` → `vinculos` (papel **por unidade**: `admin`/`gestor`/`plantonista`), via funções `SECURITY DEFINER` no schema `private` (`meu_perfil_id`, `papel_na_unidade`, `unidades_do_usuario`, `orgs_admin`, `unidades_admin`, `setores_na_escala_agora`, `tem_acesso_atendimento`…). Todas as policies chamam essas funções — **nenhuma policy lê claim do JWT**.
- **Onde é aplicada:** nas policies de todas as 48 tabelas. `admin` só vê agregados (`vw_censo_unidade`, `vw_indicadores_unidade`) com supressão LGPD < 5; `plantonista` só vê pacientes/setores **da escala do dia/turno atual** (relógio do servidor, `America/Sao_Paulo`); `gestor` vê a unidade.
- **Sem coluna de tenant (global ou herdada):** `medicamentos`/`medicamento`/`diluicao`/`medicamento_bula` (referência global), `super_admins` (plataforma), e tabelas que herdam via FK (`prescricao_itens`, `assinaturas`, `receitas_retidas`, `notificacoes_whatsapp`, `links_publicos_receita`, `conversa_participantes`, `chat_mensagens`, `push_subscriptions`).
- **Cliente:** `src/lib/supabase.ts` usa apenas URL + anon key (sem `custom_access_token` hook no `config.toml`, sem claims). A unidade ativa do usuário fica em `localStorage` (`UnidadeContext.tsx`) apenas para UX — a segurança toda está no RLS.

---

## 6. Pendências de decisão (não assumidas)

1. **Lista das "6 fases planejadas"** — não encontrei no repositório um documento que enumere as 6 fases. Os planejamentos existentes são: **Fases 0–5 da camada de medicamentos** (`data/RELATORIO_FINAL.md`), **Fases 1–3 do ADT** (`docs/ARQUITETURA_ADT.md`), **Fase 1 da plataforma** (`README.md`), **Fase 4 do chat** (`docs/ARQUITETURA_CHAT.md`). A análise de dependências abaixo assume a interpretação mais provável (Fases 0–5 de medicamentos), mas **preciso da lista exata das suas 6 fases** para apontar com precisão.
2. `USING (true)` em `medicamentos`/`medicamento` — confirmar se leitura irrestrita (para autenticados) é intencional ou precisa de restrição.
3. `escala_plantoes` × `escala_plantao` — confirmar o plano de unificação (tabela e prazos).
4. `medicamentos` (plural) × `medicamento` (singular) — qual é a base oficial para o motor de prescrição?
5. Edge function `notify-email` — decidir: reescrever para o schema atual, apontar para as tabelas legadas importadas, ou remover.

---

## 7. Dependências não atendidas — Fases 0–5 (camada de medicamentos)

> Análise sob a interpretação das Fases 0–5 do `data/RELATORIO_FINAL.md`. Ajusto assim que você me passar a lista oficial das 6 fases.

| Fase | Entregável | Estado atual | Dependência não atendida |
|---|---|---|---|
| 0 | Padronização (200 itens) | ✅ Concluído (`data/padronizacao.csv`) | — |
| 1 | Chave canônica (RxNorm/ANVISA) | ✅ 100% rxcui / 86,5% ANVISA na tabela `medicamento` | **Não integrada ao motor de prescrição** — `prescricao_itens` aponta para `medicamentos` (legada), não para `medicamento` (canônica) |
| 2 | Bula de apoio (openFDA) | ✅ 140 bulas em `medicamento_bula` (`texto_referencia_en`) | Nenhuma tela de curadoria para visualizar o texto EN junto da bula ANVISA |
| 3 | Diluição | ⚠️ 125 rascunhos, 77 no banco, **0 publicados** (exige `revisor_crf`) | **Curador farmacêutico humano** (nenhum `publicado`); `PrescricaoTeste`/`ReferenciaDiluicao` só mostram `diluicao_publicada` |
| 4 | Interações (RxNav) | ❌ **Bloqueada** | RxNav-in-a-Box exige **licença UMLS + Docker** (documentado em `data/FASE4_RXNAV.md`) |
| 5 | Ambulatorial / assinatura | ⚠️ Avaliação Memed × Mevo feita | Assinatura ICP-Brasil é Fase 2 do ADT e **não implementada**; `assinaturas`/`receitas_retidas` existem mas sem fluxo real de assinatura/validação; DPA com parceiro (LGPD) pendente |

**Dependências transversais que afetam qualquer fase clínica futura:**
- **Persistência clínica real**: evolução/exames/AIH só em `localStorage` (TTL 12 h) — nenhuma fase que precise de histórico clínico persistido está atendida (Fase 2 do ADT pendente).
- **Sinais vitais / resultados de exame / procedimentos não têm tabela** — qualquer fase que os exija parte do zero.
- **Unificação da escala** (`escala_plantoes` × `escala_plantao`) pendente — afeta acesso por escala em qualquer módulo clínico.
- **Edge function `notify-email` quebrada** contra o schema atual — afeta notificações transacionais (troca, aprovação, vaga).
