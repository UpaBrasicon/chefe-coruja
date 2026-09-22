# Chefe Coruja — Respostas técnicas verificadas

> Complemento ao documento de respostas às 15 perguntas. Aqui a resposta é
> **ponto a ponto com evidência**: cada número abaixo foi lido do banco de
> produção (Supabase `saqjrjtrkzkswsxxvdxn`, São Paulo) e do código-fonte em
> **21–22/09/2026**. Onde não temos, está escrito **NÃO TEMOS** — sem estimativa
> e sem intenção apresentada como entrega.

Convenção: **IMPLEMENTADO** = existe e foi verificado · **PARCIAL** = existe mas
não cobre o caso completo · **NÃO TEMOS** = não existe.

---

## 1. Isolamento multi-tenant — IMPLEMENTADO

| Verificação | Número lido do banco |
|---|---|
| Tabelas no schema `public` | **57** |
| Tabelas com RLS ativa | **57 (100%)** |
| Tabelas sem RLS | **0** |
| Policies de RLS | **146** (54 SELECT · 39 INSERT · 36 UPDATE · 17 DELETE) |
| Tabelas com `unidade_id` | **36** |
| Tabelas com `organizacao_id` | **7** |
| Funções `SECURITY DEFINER` | **85** (29 em `private` + 56 em `public`) |
| Dessas, com `search_path` fixo | **85 (100%)** |
| Helpers de autorização no banco | **10**, todos `STABLE` |
| RLS ativa sem policy (intencional, documentado) | **3** |

Os 10 helpers que decidem acesso **no banco**, não na interface:
`meu_perfil_id`, `papel_na_unidade`, `eh_super_admin`, `eh_admin_da_organizacao`,
`unidades_do_usuario`, `unidades_admin`, `unidades_gestor_plantonista`,
`orgs_admin`, `fn_censo_unidade`, `fn_indicadores_unidade`.

> **Correção importante ao documento anterior.** Não é verdade que "os portões de
> papel são de interface apenas". A autorização é aplicada pelo Postgres via RLS;
> o frontend apenas espelha a mesma decisão para não mostrar o que já seria
> negado pelo banco. Uma tentativa de ler dado de outra unidade falha no banco,
> não na tela.

**Regra de ouro de dado sensível, em código:** o `admin` enxerga agregado
(censo, indicadores) e **não** identidade de paciente — as views
`vw_censo_unidade` e `vw_indicadores_unidade` são `SECURITY DEFINER` justamente
porque o perfil admin não tem `SELECT` nas tabelas de paciente. Elas aplicam
supressão de célula pequena (contagem entre 1 e 4 retorna `NULL`) para impedir
dedução em unidade pequena. `super_admin` é exceção nominal (1 registro hoje),
com RLS própria em 3 tabelas (`cerbero_incidentes`, `cerbero_quarentena` e as de
agente) — **sem trilha de auditoria específica do super_admin hoje** (§8).

---

## 2. Sistema oficial de prontuário — HOJE NÃO É O CHEFE CORUJA

**IMPLEMENTADO como apoio; NÃO TEMOS prontuário oficial.** O documento anterior
está correto nesta parte e vale manter.

O que o produto produz hoje (laudo de AIH, encaminhamento, prescrição, pedido de
exames, atestado) é impresso e assinado; a via digital existe para reimpressão
no turno.

**Pré-requisitos declarados para virar prontuário oficial, com nosso estado:**

| Pré-requisito | Estado |
|---|---|
| Certificação SBIS/CFM NGS2 | **NÃO TEMOS** |
| Assinatura digital ICP-Brasil | **NÃO TEMOS** (spike VIDaaS/PSC feito, bloqueado por credencial de homologação) |
| Trilha de auditoria imutável | **PARCIAL** — existe a trilha; falta append-only e retenção legal |
| Guarda de 20 anos (Lei 13.787/2018) | **NÃO TEMOS** política aplicada |

---

## 3. Fonte da verdade por dado — IMPLEMENTADO no que é nosso

| Dado | Fonte da verdade hoje | Estado |
|---|---|---|
| Escala de plantão | Chefe Coruja (`escala_plantao`) | IMPLEMENTADO |
| Presença: check-in/check-out, horário e local | Chefe Coruja (`presenca_plantonista`, 18 colunas) | IMPLEMENTADO |
| Sinais vitais e escore derivado | Chefe Coruja (`observacao`, 17 colunas + `conceito`/`conceito_opcao`) | IMPLEMENTADO |
| Protocolo, diluição e padronização da unidade | Chefe Coruja (`medicamento`, `diluicao`) | IMPLEMENTADO |
| Cadastro do paciente, histórico, resultado de exame | prontuário físico e sistemas da unidade | fora do produto |
| Documento emitido | papel assinado | fora do produto |

---

## 4. Ferramentas que influenciam decisão clínica — IMPLEMENTADO

**48 ferramentas** carregadas sob demanda, contadas no código:
**39 clínicas** (`registry.tsx`) + **9 na Central de Plantão**
(`plantaoRegistry.tsx`). Todas com `import()` dinâmico.

**Base de terminologia embarcada** (contagem lida do banco):

| Base | Registros |
|---|---|
| CID-10 | **14.233** |
| SIGTAP (procedimentos) | **5.023** |
| CBO (ocupações) | **2.725** |
| CMED (medicamentos) | **26.000** |
| **LOINC em português** | **109.325** |

Cada item carrega fonte e data de revisão, e há tela de revisão de evidência,
selo e lacunas. Item sem fonte declarada aparece como lacuna — não é preenchido
por estimativa.

**Três regras de segurança de domínio, aplicadas em código:**
pediatria é 0 mês a 14 anos em todo filtro e faixa; dose e limite nunca são
convertidos de adulto para criança (sem fonte pediátrica, a ferramenta diz que
não tem referência em vez de estimar); toda saída é cálculo, faixa e fonte, com
o médico como intermediário.

---

## 5. CDS / SaMD — NÃO TEMOS intenção de classificar

O desenho evita a classificação: a saída é cálculo, escore publicado ou
referência citada; não há recomendação de conduta individualizada. O
**compromisso** que assumimos é o do documento anterior — se algum módulo passar
a recomendar conduta, entra em avaliação regulatória **antes** do release.

---

## 6. Papel jurídico — operadora, com pendências reais

| Item | Responsável | Estado |
|---|---|---|
| Definição de finalidade e base legal | Controlador (hospital) | contratual |
| Contrato de operador (art. 39) | ambos | **NÃO TEMOS** |
| Encarregado (DPO) nomeado e publicado | Cloudcare | **NÃO TEMOS** |
| ROPA (registro de operações) | Cloudcare | **NÃO TEMOS** |
| RIPD | Cloudcare | **NÃO TEMOS** |
| Cláusulas-padrão de transferência internacional (Res. CD/ANPD 19/2024) | Cloudcare | **NÃO TEMOS** |
| Lista de subprocessadores com aviso de troca | Cloudcare | **NÃO TEMOS** |
| Plano de resposta a incidente com prazo (ANPD: 3 dias úteis) | ambos | **NÃO TEMOS** |
| **Trilha de auditoria** | Cloudcare | **PARCIAL — ver §8** (ação auditada + acesso a prontuário instrumentado; falta imutabilidade e retenção) |

Base legal: art. 11, II, "f" (tutela da saúde) para o dado clínico; art. 7º, V
(execução de contrato) para o dado de usuário. Consentimento não é a base do
dado assistencial.

**Lacuna que o documento precisa cobrir:** o escopo é pediatria **0 a 14 anos**,
e o art. 14 da LGPD exige tratamento no melhor interesse da criança com
consentimento específico de um dos pais ou responsável. **NÃO TEMOS** fluxo para
isso.

---

## 7. Retenção — política definida, automação não

| Dado | Retenção definida | Está automatizado? |
|---|---|---|
| Prontuário e documento assistencial (fase 2) | 20 anos (Lei 13.787/2018) | NÃO TEMOS (fase 2) |
| Documento emitido no turno | apagar no check-out | **NÃO — o check-out não apaga** |
| Rascunho não emitido | até emitir ou fim do turno | **PARCIAL** — expira no cliente, não por job no servidor |
| Código de acesso do paciente ao resumo | 30 dias | NÃO TEMOS |
| Trilha de auditoria | 20 anos | **PARCIAL** — sem retenção aplicada |
| Log técnico sem dado clínico | 12 meses | NÃO TEMOS |
| Dado de organização após fim de contrato | exportação FHIR + expurgo em 90 dias | NÃO TEMOS (camada FHIR existe; exportação/expurgo não) |

---

## 8. Auditoria e rastreabilidade — PARCIAL (o item mais importante desta lista)

**O que JÁ EXISTE e foi verificado:**

| Item | Estado |
|---|---|
| Tabela `log_auditoria` (`ator_id`, `acao`, `entidade`, `entidade_id`, `unidade_id`, `payload`, `created_at`) | **existe e tem 18 registros** |
| Função `registrarAuditoria()` chamada pelo app | **13 pontos** (vínculos, setores, leitos, banners, pacientes, etc.) |
| Tabela `log_acesso_prontuario` com `paciente_id`, `internacao_id`, `acessado_por`, `papel`, `tipo_acesso`, `documento_id`, **`ip`**, **`user_agent`**, `created_at` | **tabela existe; RPC `registrar_acesso_prontuario` existe; hook `useRegistrarAcessoProntuario` está ligado ao formulário de internação (`plantao/Internacao.tsx:73`). 0 registros porque o fluxo não foi executado no ambiente** |

**O que NÃO TEMOS:** imutabilidade. A trilha hoje é uma tabela comum, protegida
por RLS (que impede leitura indevida, não adulteração). Não há *append-only*
por trigger, encadeamento de hash, nem retenção WORM. **Se o técnico perguntar
"como garanto que o log não foi alterado?", a resposta honesta hoje é: por RLS,
que protege leitura — não alteração.** É a lacuna que precisa ser resolvida
antes da fase 2.

---

## 9. Assinatura digital — NÃO TEMOS, com spike pronto

- Padrão definido: **ICP-Brasil, PAdES com carimbo de tempo**.
- Caminho preferido: **VIDaaS / certificado em nuvem do CFM** (sem custo para o
  médico, sem token físico no plantão).
- **Spike técnico feito** contra o PSC do VIDaaS; bloqueado por **credencial de
  homologação** — parei e reportei em vez de simular.

---

## 10. Interoperabilidade — PARCIAL, decisões tomadas

| Sistema | Prioridade | Estado |
|---|---|---|
| FHIR R4 como interface canônica | — | **PARCIAL (implementado)** — camada em `src/interop/fhir/`: `index`, `mappers`, `codificacao`, `tipos`, fixtures + validador `npm run fhir:validar` |
| `interop_outbox` (fila de envio) | — | **existe** com `tipo_documento`, `referencia_id`, `payload`, `status`, `tentativas`, `ultimo_erro`, **`id_rnds`**, `enviado_em` |
| Gatilho na alta | — | **existe** (migration `interop_gatilho`) |
| HIS | 1 | **NÃO TEMOS** adaptador |
| LIS | 2 | **NÃO TEMOS** |
| RIS | 3 | **NÃO TEMOS** |
| PACS / DICOM | fora do escopo inicial | NÃO TEMOS |
| RNDS | obrigatório SUS | **PARCIAL** — outbox e campo `id_rnds` prontos; envio não |
| SISAIH01 | obrigatório SUS | **NÃO TEMOS** |
| **TISS (ANS, convênios)** | — | **NÃO TEMOS e não está no documento** — sem ele não se fatura convênio |

---

## 11. Cloud e residência dos dados — IMPLEMENTADO

| Componente | Onde | Verificado |
|---|---|---|
| Postgres, Storage, Auth | Supabase, **São Paulo (sa-east-1)** | ✅ |
| VPS dos agentes | **Hostinger, Salvador/BA** | ✅ (não é "a definir" como no doc anterior) |
| CDN de fontes/bibliotecas | global | sem dado |
| Provider de IA | ver §13 | apenas de-identificado |

**Risco que precisa ser resolvido:** a conta Supabase tem **4 projetos** e um
deles está em **East US (North Virginia)** — fora do território nacional. Se
nunca recebeu dado de paciente, apagar ou documentar; se recebeu, é contradição
com esta seção.

**Storage:** 4 buckets, sendo **3 privados** (`atendimento`, `fotos`,
`receitas`) e 1 público (`banners`).

---

## 12. IA e dado identificável — regra definida, porteiro não implementado

**Regra (correta e mantida):** nenhum identificador direto sai do perímetro;
pseudonimização antes da saída; sem retenção e sem treino pelo provider.

**Estado real:** o **JEV** — o gateway único de de-identificação, validação de
resposta e registro — **NÃO TEMOS implementado**. É pré-requisito declarado:
sem ele, recurso de IA não sobe em produção. Hoje a IA é usada em resumo de
laudo e resumo de internação, em ambiente de desenvolvimento.

---

## 13. Provider de IA — decisão tomada, com consequência declarada

DeepSeek no início, por custo e latência, com camada **agnóstica de provider**.
Consequência assumida no documento: transferência internacional, compatível
apenas porque o tráfego é de-identificado pelo JEV — que ainda não existe
(§12). Extração de texto, rasterização e redução de imagem são **locais**; o
modelo só é acionado quando o extrator local falha.

---

## 14. Processo de aprovação de regra clínica — definido, responsável não nomeado

**Duas camadas** (base de fábrica e conteúdo da unidade), **versionamento com
data de vigência** e registro da versão vigente no momento de cada uso. O
versionamento está desenhado; **NÃO TEMOS** a implementação de "qual versão
estava vigente quando" aplicada a todos os itens.

**NÃO TEMOS** responsável técnico médico (CRM) e farmacêutico (CRF) nomeados
para a camada base.

---

## 15. Autoridade clínica — definida por escopo

- **Conteúdo da unidade:** o gestor da unidade aprova protocolo e diluição
  locais; sobrepõe a camada base sem sobrescrevê-la, mantendo a origem visível.
- **Conteúdo de fábrica:** responsável técnico médico + farmacêutico —
  **NÃO TEMOS** nomeados (ver §14).
- **Fiscalização automatizada:** os agentes **existem e rodam**: Gavião (fiscal
  do agente conversacional), Cérbero (integridade), Argos (auditoria de dados
  clínicos), Sentinela (outliers de escala), Íris (notificações). Eles **avisam
  o administrador; não publicam, alteram nem aprovam nada**.

> **Correção de nomenclatura:** o agente fiscal é o **Gavião**, código próprio.
> "Hermes" é o produto de terceiro (Nous Research) que hospeda o agente
> conversacional "Corujinha" — ao técnico, chamar o fiscal de Hermes faz parecer
> dependência de terceiro onde há ativo proprietário.

---

## 16. Telemedicina — decisão correta, módulo não implementado

Desenho para **teleinterconsulta/teleconsultoria** (médico remoto apoia o
preposto presencial; a responsabilidade da conduta é do assistente), pela Res.
CFM 2.314/2022. **NÃO TEMOS** o módulo, o cadastro do serviço no CRM nem o
registro bilateral em prontuário.

---

## 17. Segurança da plataforma — o que existe e o que falta

| Controle | Estado |
|---|---|
| Autorização no banco (RLS) | **IMPLEMENTADO** — 57/57 tabelas |
| `search_path` fixo em função `SECURITY DEFINER` | **IMPLEMENTADO** — 85/85 |
| Validação de token e guarda de papel no backend dos agentes | **IMPLEMENTADO** (rota `/skill/consulta` falha fechada; 401/403 testados) |
| Autenticação de usuário | Supabase Auth (GoTrue) — IMPLEMENTADO |
| **MFA para admin/gestor** | **NÃO TEMOS** |
| Política de senha, bloqueio por tentativa, expiração de sessão declarada | **NÃO TEMOS** |
| Gestão e rotação de segredos | **PARCIAL** — chaves em `.env` fora do git e `service_role` fora do ambiente do agente; sem política de rotação |
| Varredura de segurança do app | **feita** (Strix): 2 achados HIGH (bucket cross-tenant e XSS em 8 funções de impressão) **corrigidos e verificados** |
| Pentest | **NÃO TEMOS** |
| Rate limiting / WAF / DDoS | **NÃO TEMOS** |
| Observabilidade (logs, métricas, alertas, tracing) | **PARCIAL** — `/health` com estado de Redis e Supabase + agente fiscal; sem métrica, alerta ou tracing formal |
| **Dado de paciente no cliente** | **PROBLEMA CONHECIDO**: rascunhos de atendimento/internação em `localStorage` sem criptografia (`plantao/shared/rascunho.ts`, `internacao/rascunho.ts`). Aceitável em protótipo; **inaceitável em produção** |
| Termo de uso / aceite com limitação de responsabilidade | **NÃO TEMOS** tela de termos |
| Seguro RC profissional / cyber | **NÃO TEMOS** |

---

## 18. Capacidade, continuidade e operação — números reais

| Item | Estado |
|---|---|
| `max_connections` do Postgres | **60** · em uso no momento da leitura: **14** |
| Estratégia de pooler declarada para múltiplos clientes | **NÃO TEMOS** — é o próximo limite a resolver antes do 5º cliente |
| Capacidade esperada (pacientes, hospitais, RPS) | **NÃO TEMOS** dimensionamento |
| RPO / RTO | **NÃO TEMOS números.** O backup é gerenciado pelo Supabase e **não verificamos** se o PITR está ativo nem em que retenção; **não há registro de teste de restauração** |
| Ambientes dev / staging / produção | **NÃO TEMOS staging** — hoje: banco de desenvolvimento + produção no mesmo projeto |
| CI/CD, rollback, feature flag | **NÃO TEMOS** |
| Migração de schema com zero downtime | **PARCIAL** — migrations versionadas (**5 aplicadas neste ciclo**, todas validadas em transação com ROLLBACK antes de aplicar); sem janela formal |
| Testes automatizados | **24 arquivos de teste** no backend dos agentes (84 testes verdes). **0 teste no frontend** |
| Testes das calculadoras clínicas | **NÃO TEMOS** |
| SLA contratual, suporte e plantão | **NÃO TEMOS** |
| Custo marginal por organização | **NÃO TEMOS** modelagem |

---

## 19. O que já existe e fortalece a apresentação

Ordem de maturidade, tudo verificado:

1. **Isolamento multi-tenant real** — 57 tabelas com RLS, 146 policies, 10
   helpers de autorização, 85 funções com `search_path` fixo.
2. **Trilha dupla de auditoria desenhada e ligada** — `log_auditoria` (ações,
   18 registros) e `log_acesso_prontuario` (acesso a prontuário, com IP e
   user-agent, alimentada pelo RPC `registrar_acesso_prontuario` chamado no
   formulário de internação; 0 registros por o fluxo não ter sido executado no
   ambiente). Falta a **imutabilidade**, não a instrumentação.
3. **Presença com geolocalização** — `presenca_plantonista` com horário, lat/lng
   e flag `dentro` do raio; `unidades` com `latitude`, `longitude` e
   `raio_metros` (padrão 500 m).
4. **Terminologia clínica embarcada** — 157 mil registros (CID-10, SIGTAP, CBO,
   CMED, LOINC pt-BR).
5. **Camada FHIR R4 + outbox** com campo `id_rnds` e gatilho na alta.
6. **48 ferramentas clínicas** com carregamento sob demanda e revisão de
   evidência; chunk inicial de 46 KB após separação de vendor.
7. **Agentes de fiscalização rodando em produção** (Gavião, Cérbero, Argos,
   Sentinela, Íris) + **base de conhecimento clínico governada** (LLM Wiki, com
   barreira de dado sensível e lint semanal).
8. **Postura de segurança verificada** — 2 achados HIGH corrigidos e revalidados.

---

## 20. O que NÃO TEMOS — lista para o técnico sem rodeio

Pré-requisitos de release, em ordem de bloqueio:

1. **MFA** para perfis administrativos.
2. **Auditoria imutável** (append-only + retenção) e instrumentação do acesso
   a prontuário.
3. **Assinatura ICP-Brasil** (spike pronto; falta credencial).
4. **JEV** (de-identificação) antes de qualquer IA em produção.
5. **Contrato de operador, DPO, ROPA, RIPD, cláusulas-padrão** e lista de
   subprocessadores.
6. **Versionamento com vigência** de toda regra clínica, implementado.
7. **Responsável técnico médico e farmacêutico** nomeados.
8. **Tirar dado de paciente do `localStorage`**.
9. **RPO/RTO com números**, PITR confirmado, restauração testada e staging.
10. **SLA, suporte e plantão** definidos; **pooler** dimensionado para
    múltiplos clientes.
11. **eMAG** se houver venda a hospital público; **TISS** se houver convênio.
12. **Certificação SBIS/CFM NGS2** para a fase 2.
13. **Termo de uso** com limitação de responsabilidade e apólice de RC/cyber.
