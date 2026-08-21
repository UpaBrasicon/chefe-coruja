# PREFLIGHT-HERMES.md — Inventário (Prompt 0)

> Gerado em: 2026-08-20 · Projeto Supabase: `saqjrjtrkzkswsxxvdxn` (Chefe-coruja)
> Modo: **somente leitura** — nenhum dado foi criado ou alterado.

---

## 1. Schema Supabase

### 1a. Tabelas do schema `public` (54 no total, expostas via PostgREST)

Inventário completo extraído da spec OpenAPI (Swagger 2.0) do PostgREST remoto.

**Identidade / acesso**
- `perfis` — id (uuid), nome_completo, cpf, crm, uf_crm, **telefone (text)**, email, ativo, foto_url, tipo_sanguineo, dados_pessoais (jsonb)
- `vinculos` — id, **perfil_id**, **unidade_id**, **papel** (enum), ativo, criado_por
- `super_admins` — perfil_id
- `acessos_plantonista` — perfil_id, unidade_id, tipo_acesso, ativo, valida_ate

**Multi-tenant**
- `organizacoes` — id, nome, cnpj, ativo
- `unidades` — id, **organizacao_id**, nome, tipo (enum), cnes, municipio, uf, ativo, latitude/longitude/raio_metros, canal_comunicacao, **whatsapp_numero**

**Escala / plantões**
- `escala_plantao` (PRINCIPAL — usada em Escala.tsx, MinhaAgenda.tsx, Vagas.tsx) — id, **unidade_id**, setor_id, **perfil_id**, **data (date)**, **turno**, rotulo, observacao, quinzenal, ativo, fracionado, plantao_origem_id
- `escala_plantoes` (SECUNDÁRIA — usada apenas em `useEscalaSetores.ts`; ⚠️ atenção para não confundir) — id, unidade_id, setor_id, perfil_id, data, turno, ativo
- `escala_fixa` — unidade_id, setor_id, perfil_id, dia_semana, turno, quinzenal, ativo
- `historico_escala` — unidade_id, plantao_id, perfil_id, acao, detalhe, dados (jsonb)
- `solicitacoes_escala` — unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, tipo_falta, anexo_url
- `candidaturas_escala` — unidade_id, setor_id, data, turno, perfil_id, status
- `trocas_plantao` — unidade_id, plantao_a_id, perfil_a_id, plantao_b_id, perfil_b_id, status
- `presenca_plantonista` — unidade_id, escala_plantao_id, perfil_id, data, turno, checkin/checkout_em, lat/lng, checkin_dentro
- `remuneracoes_plantao` — unidade_id, setor_id, turno, valor
- `notificacoes_plantonista` — perfil_id, unidade_id, data, tipo, mensagem, lida_em

**Assistencial (NÃO tocável pelo Hermes — dado clínico)**
- pacientes, internacoes, prescricoes, prescricao_itens, observacao, conceito, conceito_opcao, medicamento(s), diluicao, documentos_clinicos, assinaturas, receitas_retidas, checklist_admissao, eventos_adt, eventos_leito, log_acesso_prontuario, transferencias_paciente, sugestoes_prescricao, cuidados_plantonistas, alta_paciente, links_publicos_receita

**Comunicação / notificações**
- `notificacoes_whatsapp` — prescricao_id, destinatario_nome, **telefone (text)**, template, payload (jsonb), status, id_provedor
- `chat_mensagens`, `conversas`, `conversa_participantes`, `mensagens_chat`, `push_subscriptions`

**Administrativo / misc**
- banners, configuracoes_unidade, setores, leitos, censo_ocupacao, log_auditoria, interop_outbox, views (vw_censo_unidade, vw_indicadores_unidade)

### 1b. Identificação das tabelas-alvo do Hermes

| Papel no Hermes | Tabela | Colunas-chave |
|---|---|---|
| Usuários/médicos | `perfis` | id, nome_completo, **telefone**, email, crm, uf_crm, ativo |
| Papel do usuário | `vinculos` | perfil_id, unidade_id, **papel** (enum: `admin`, `gestor`, `plantonista`), ativo |
| Super admin | `super_admins` | perfil_id (lista separada — não é enum em vinculos) |
| Organizações | `organizacoes` | id, nome, cnpj |
| Unidades | `unidades` | id, organizacao_id, nome, tipo, cnes, uf, whatsapp_numero |
| Escala/plantões | `escala_plantao` | id, unidade_id, setor_id, perfil_id, **data**, **turno**, rotulo, observacao, quinzenal, ativo, fracionado |
| Setores | `setores` | id, unidade_id, nome, tipo, ordem, ativo, especialidade |

**⚠️ ACHADO CRÍTICO — FORMATO DE TELEFONE (bloqueia resolução de identidade):**
- `perfis.telefone` existe como `text`, porém está **NULL em todos os perfis atuais** e **nenhuma UI do app preenche essa coluna** (o Perfil.tsx grava apenas `foto_url`, `tipo_sanguineo`, `dados_pessoais`; o campo "Telefone de emergência" vai para `dados_pessoais.emergencia_telefone` no formato `(00) 00000-0000`).
- **Não há formato E.164 garantido em lugar nenhum.** O padrão visual usado no app é `(00) 00000-0000` (placeholder em Perfil.tsx) e o exemplo de WhatsApp em Configuracao.tsx é `5511999999999`.
- **Consequência:** a resolução de identidade "wa_id → perfil" do Hermes não funciona sem (a) popular `perfis.telefone` com E.164 nos usuários de teste e (b) uma função de normalização telefone→E.164 no código do Hermes.

### 1c. RPCs existentes (candidatas a tools do Hermes)

54 RPCs no total. Relevantes para as tools de leitura da Fase 1:

- `papel_na_unidade(unidade)` → papel do chamador
- `plantonistas_da_unidade()` → plantonistas vinculados
- `na_escala_agora(unidade)`, `setores_na_escala_agora()` → contexto de plantão atual
- `turno_atual()`, `data_atual()`, `horario_servidor()` → relógio
- `eh_super_admin()` → checagem de super
- `minhas_notificacoes()`, `marcar_notificacao_lida(id)` → avisos
- `gerar_extrato_plantonista()` → extrato
- `censo_recente()`, `ocupacao_setores()` → censo (agregado)
- `tem_acesso_atendimento(unidade)` → acesso pago
- `terminologia_buscar(...)` → busca de terminologias
- Outras: chat (enviar_mensagem, listar_conversas, contatos_chat…), escala (adicionar_plantao_escala, gerar_escala_mensal, fracionar_plantao, solicitar_troca, aprovar_troca…), ADT (abrir_internacao, dar_alta_internado, transferir_internado…)

> ⚠️ As RPCs são SECURITY DEFINER e resolvem o chamador por `auth.uid()`. Chamadas com `service_role` **não têm `auth.uid()`**, então as tools do Hermes **não podem depender dessas RPCs diretamente** — precisam consultar as tabelas com filtro explícito por `perfil_id`/`unidade_id` no código, ou RPCs novas próprias do Hermes (a decidir na Fase 1).

---

## 2. Dados de teste

### Situação atual (já existente no remoto)

| Item | Valor |
|---|---|
| Org de teste | `00000000-0000-0000-0000-000000000001` — "Rede Saúde Teste" (CNPJ 00.000.000/0001-00) |
| Unidade 1 | `00000000-0000-0000-0000-000000000101` — "UPA Centro" (upa, SP) |
| Unidade 2 | `00000000-0000-0000-0000-000000000102` — "Hospital Regional" (hospital, SP) |
| Admin | `c5ad3d56-5258-4039-9e26-3d830a828cf5` — "Admin Teste" (vinculo admin na 101 e na 102) |
| Gestor | `da6c5d33-a123-4960-a494-a00c883906a1` — "Gestor Teste" (vinculo gestor na 101) |
| Plantonista | `df02d652-070f-4e2d-be82-18e432f128f7` — "Plantonista Teste" (vinculo plantonista na 101) |
| Super | `b7c94bfd-0dd5-4d59-9a1c-86487a9e4a1d` — "Super Admin" (super_admins) |

**Plantões futuros:** existem dezenas de registros em `escala_plantao` para o plantonista de teste
(21–23/08/2026, turnos manha/tarde/noite, setores 301–306, unidade 101) — suficientes para testar
`get_meus_plantoes` e `get_plantao_do_dia`.

**❌ LACUNA BLOQUEANTE:** nenhum perfil tem `telefone` preenchido. Para o Hermes funcionar é
**obrigatório** popular `perfis.telefone` com E.164 nos usuários de teste (ex.: o número real de
WhatsApp do usuário, `+5511...`), senão "número não cadastrado" será a resposta para todos.

### SQL de seed PROPOSTO (não executado — aguarda aprovação)

```sql
-- Preflight Hermes: popular telefones de teste (E.164) para resolução de identidade
-- SUBSTITUA os números abaixo pelos números reais de WhatsApp de cada pessoa.
UPDATE public.perfis SET telefone = '+5511999990001' WHERE id = 'da6c5d33-a123-4960-a494-a00c883906a1'; -- Gestor Teste
UPDATE public.perfis SET telefone = '+5511999990002' WHERE id = 'df02d652-070f-4e2d-be82-18e432f128f7'; -- Plantonista Teste
UPDATE public.perfis SET telefone = '+5511999990003' WHERE id = 'c5ad3d56-5258-4039-9e26-3d830a828cf5'; -- Admin Teste
-- (opcional) Super Admin:
-- UPDATE public.perfis SET telefone = '+5511999990000' WHERE id = 'b7c94bfd-0dd5-4d59-9a1c-86487a9e4a1d';
```

> Nota: como o wa_id da Meta vem SEM o `+` (ex.: `5511999990001`), a normalização no Hermes deve
> comparar `perfis.telefone` removendo `+`/espaços/parênteses/hífens, ou armazenar E.164 e
> normalizar o wa_id para o mesmo formato antes do lookup.

---

## 3. Ambiente local

| Ferramenta | Versão instalada | Observação |
|---|---|---|
| Node.js | **v24.13.1** | ⚠️ O plano pede Node 20 LTS; v24 é mais nova e compatível (type stripping nativo). Decidir se o Dockerfile da Fase 0 usa `node:20` ou `node:24`. |
| Docker | 29.7.2 | Docker Desktop instalado e funcional |
| Docker Compose | v5.4.0 | plugin do Docker Desktop |
| Git | 2.55.0.windows.3 | OK |

---

## 4. Conectividade LLM

**⏸️ PENDENTE — depende do usuário:** criar conta em https://platform.deepseek.com, gerar a chave
(LLM_API_KEY) e rodar o teste de fumaça do Prompt A1. O script de teste (curl) e o endpoint
(`https://api.deepseek.com/chat/completions`, modelo `deepseek-v4-flash`) estão prontos no documento
da Fase 0. Assim que a chave for fornecida (via .env local, nunca no chat/repo), este item é validado.

---

## 5. CAMPOS PARA OS PRÓXIMOS PROMPTS

| Placeholder | Valor |
|---|---|
| `<TABELA_USUARIOS>` | `perfis` |
| `<COLUNA_TELEFONE>` | `perfis.telefone` (text; **NULL hoje — precisa seed**) |
| `<COLUNA_PAPEL>` | `vinculos.papel` (enum: admin/gestor/plantonista) + `super_admins` p/ super |
| `<TABELA_ESCALA>` | `escala_plantao` |
| `<COLUNAS_ESCALA_RELEVANTES>` | id, unidade_id, setor_id, perfil_id, data, turno, rotulo, observacao, quinzenal, ativo, fracionado, plantao_origem_id |
| `<ORG_TESTE_ID>` | `00000000-0000-0000-0000-000000000001` |
| `<UNIDADE_TESTE_ID>` | `00000000-0000-0000-0000-000000000101` (UPA Centro) |
| `<USER_TESTE_GESTOR_ID>` | `da6c5d33-a123-4960-a494-a00c883906a1` |
| `<USER_TESTE_PLANTONISTA_IDS>` | `['df02d652-070f-4e2d-be82-18e432f128f7']` |
| `<USER_TESTE_ADMIN_ID>` | `c5ad3d56-5258-4039-9e26-3d830a828cf5` |

---

## Riscos / decisões abertas

1. **Telefones NULL (bloqueante)** — popular `perfis.telefone` com E.164 real antes da Fase 1.
2. **Node 20 vs 24** — decidir versão no Dockerfile da Fase 0.
3. **`escala_plantao` vs `escala_plantoes`** — a tool de escala da Fase 1 deve usar `escala_plantao`;
   `escala_plantoes` parece legado/paralela (confirmar na Fase 1 antes de criar tools).
4. **RPCs não servem com service_role** — tools do Hermes consultam tabelas diretamente com filtro
   por perfil/unidade no código (a camada de tools reimplementa o filtro de papel — regra 3).
