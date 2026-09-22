# Chefe Coruja — Respostas ao técnico (versão verificada)

> Resposta às quinze perguntas de avaliação técnica, **conferida contra o banco de
> produção e o código-fonte** em 21–22/09/2026. Cada número abaixo foi lido do
> sistema; onde não temos, está escrito **NÃO TEMOS**, sem estimativa e sem
> intenção apresentada como entrega.
>
> Ambiente medido: Supabase `saqjrjtrkzkswsxxvdxn` (São Paulo) e VPS Hostinger
> (Salvador/BA). Documentos irmãos: `BLUEPRINT.md`, `PRODUCT.md`, `FRONTEND.md`,
> `RESPOSTAS-TECNICAS-VERIFICADAS.md`.

Legenda de estado: **IMPLEMENTADO** (existe e foi verificado) · **PARCIAL**
(existe, não cobre o caso completo) · **NÃO TEMOS** (não existe).

---

## 1. O Chefe Coruja será SaaS multi-hospital ou deployment dedicado por organização?

**SaaS multi-tenant com isolamento por organização, sobre uma instância. O
isolamento é aplicado pelo banco, não pela interface.**

### Hoje

| Verificação lida do banco | Número |
|---|---|
| Tabelas no schema `public` | **57** |
| Tabelas com RLS ativa | **57 (100%)** |
| Tabelas sem RLS | **0** |
| Policies de RLS | **146** (54 SELECT · 39 INSERT · 36 UPDATE · 17 DELETE) |
| Tabelas com `unidade_id` | **36** |
| Tabelas com `organizacao_id` | **7** |
| Funções `SECURITY DEFINER` | **85** (29 em `private`, 56 em `public`) |
| Dessas, com `search_path` fixo | **85 (100%)** |
| Helpers de autorização no banco | **10**, todos `STABLE` |
| RPCs no schema `public` | **57** |

A decisão de acesso é do Postgres: `meu_perfil_id`, `papel_na_unidade`,
`unidades_do_usuario`, `unidades_admin`, `unidades_gestor_plantonista`,
`orgs_admin`, `eh_admin_da_organizacao`, `eh_super_admin`. O frontend espelha a
mesma decisão para não exibir o que o banco negaria — não é ele que autoriza.

Um usuário pode ter papéis diferentes em unidades diferentes; o papel ativo é
sempre o da unidade selecionada (a navegação e as guardas usam
`papeisDaUnidade`, não a lista global de vínculos).

**Três tabelas** têm RLS ativa sem policy, de forma intencional e documentada
(`hermes_audit_log`, `hermes_sessions`, `cerbero_url_cache`): falha fechada para
qualquer usuário autenticado; só o `service_role` do backend as acessa.

### Fase 2
Sem mudança de modelo. O isolamento permanece por linha, com organização e
unidade em toda tabela de domínio.

### Compromisso / o que falta
- Adequar `max_connections`/pooler para múltiplos clientes (hoje **60** conexões,
  **14** em uso) antes do crescimento.
- Deployment dedicado continua como exceção contratual sobre o mesmo esquema.

---

## 2. Qual é o sistema oficial de prontuário: Chefe Coruja ou HIS/PEP existente?

**Hoje, nenhum dos dois: o prontuário legal é o papel. Na fase 2, passa a ser o
Chefe Coruja.**

### Hoje — IMPLEMENTADO como apoio
O produto gera laudo de AIH, encaminhamento, prescrição, pedido de exames e
atestado; o documento é impresso e assinado, e a via digital serve para
reimpressão no turno. O sistema **declara na interface** que é apoio e que o
prontuário legal é o físico.

### Fase 2
Prontuário oficial, quando entrarem pronto-socorro completo e checagem de
medicação pela enfermagem. Não é o HIS existente que assume esse papel: nas
unidades alvo (serviço secundário, sem tomografia e sem ultrassom) o HIS cobre
faturamento e censo, não assistência.

Pré-requisitos, com nosso estado real:

| Pré-requisito | Estado |
|---|---|
| Certificação SBIS/CFM **NGS2** | **NÃO TEMOS** |
| Assinatura digital ICP-Brasil em todo documento assistencial | **NÃO TEMOS** (spike pronto, ver §8) |
| Trilha de auditoria imutável | **PARCIAL** (trilha existe; falta imutabilidade) |
| Guarda de 20 anos (Lei 13.787/2018) | **NÃO TEMOS** política aplicada |

---

## 3. O produto será source of truth de dados clínicos?

**Hoje é source of truth apenas do que só existe nele. Na fase 2, também do
documento assistencial — para um subconjunto declarado.**

### Hoje — IMPLEMENTADO

| Dado | Fonte da verdade | Estado |
|---|---|---|
| Escala de plantão | Chefe Coruja (`escala_plantao`) | IMPLEMENTADO |
| Presença, check-in/check-out, horário e local | Chefe Coruja (`presenca_plantonista`, **18 colunas**, com lat/lng e flag `dentro` do raio) | IMPLEMENTADO |
| Sinais vitais e escore derivado | Chefe Coruja (`observacao` 17 colunas, `conceito` 13, `conceito_opcao` 5) | IMPLEMENTADO |
| Protocolo, diluição e padronização da unidade | Chefe Coruja (`medicamento`, `diluicao`) | IMPLEMENTADO |
| Cadastro do paciente, histórico anterior, resultado de exame | prontuário físico e sistemas da unidade | fora do produto |
| Documento emitido | papel assinado (digital = reimpressão) | fora do produto |

O escopo atual é **100% equipe médica**. Enfermagem entra na fase 2.

### Fase 2
Passa a ser source of truth do documento assistencial, com as quatro condições
da pergunta 2 cumpridas.

### Compromisso / o que falta
Exportação e devolução garantidas ao fim do contrato (ver §7).

---

## 4. Quais ferramentas realmente influenciam decisão clínica?

**48 ferramentas carregadas sob demanda — 39 clínicas e 9 na Central de Plantão
— sobre 157.306 registros de terminologia clínica embarcada.**

### Hoje — IMPLEMENTADO

**Contagem no código:** **39** ferramentas em `src/content/registry.tsx` +
**9** em `src/content/plantaoRegistry.tsx` = **48**, todas com `import()`
dinâmico.

**Base de terminologia embarcada** (contagem lida do banco):

| Base | Registros |
|---|---|
| CID-10 | **14.233** |
| SIGTAP (procedimentos) | **5.023** |
| CBO (ocupações) | **2.725** |
| CMED (medicamentos) | **26.000** |
| **LOINC em português** | **109.325** |
| **Total** | **157.306** |

**Grau de influência na condução:**
- *Mudam o ritmo de monitorização* — NEWS2 (implementação em um único componente,
  `plantonista/escores/News2.tsx`, referenciado pelo registry, para que cor e
  número não divirjam entre telas), qSOFA, SAPS 3 na internação, escores de TEV,
  NIHSS.
- *Entram na dose administrada* — infusão adulto e pediátrica, doses rápidas de
  emergência, tabela de diluição.
- *Conduzem procedimento passo a passo* — assistentes de ventilação mecânica
  (neonato ao adulto), VNI, via aérea e desmame, com progresso persistido.

**O limite é explícito na tela e no código:** o escore diz gravidade e ritmo de
monitorização; não diz enfermaria ou UTI. A ferramenta é ponte de conduta, não
conduta — apresenta cálculo, faixa e fonte, e o médico decide.

**Três regras de segurança de domínio, aplicadas em código:**
1. Pediatria é **0 mês a 14 anos** em todo filtro, faixa e seleção de modo.
2. Dose, faixa e limite **nunca** são inventados nem convertidos de adulto para
   criança: sem fonte pediátrica declarada, a ferramenta diz que não tem
   referência em vez de estimar.
3. Toda ferramenta carrega fonte e data de revisão, com tela de revisão de
   evidência, selo e lacunas.

### Compromisso / o que falta
**NÃO TEMOS** testes automatizados das calculadoras clínicas — um número errado
é evento adverso, não bug. Entra como pré-requisito de release.

---

## 5. Existe intenção comercial de classificar algum módulo como CDS/SaMD?

**Não. A classificação é evitada por desenho — é decisão de produto, não
descuido.**

### Hoje
Nenhum módulo é registrado como dispositivo médico. O desenho mantém os módulos
fora da RDC 657/2022 porque toda saída é **cálculo, escore publicado ou
referência citada**; nenhuma saída é recomendação de conduta individualizada; o
médico é sempre o intermediário, e a interface diz isso.

O módulo de internação **estratifica** risco pelo SAPS 3 — escore publicado e
validado, calculado de forma transparente e auditável. Estratificar por escore
publicado não é CDS; virar CDS seria emitir recomendação a partir dele.

Os agentes de monitoramento (§15) não mudam essa resposta: observam o sistema e
avisam o administrador — não o paciente, não o médico à beira do leito.

### Compromisso
Se algum módulo passar a recomendar conduta individualizada — e há pressão nessa
direção, porque é o que o usuário pede — entra em **avaliação regulatória antes
do release**, não depois. A porta de entrada é o processo da §14.

---

## 6. Qual é o papel jurídico da empresa no tratamento dos dados?

**Operadora. O hospital ou a organização de saúde é o controlador.**

### Hoje
Há tratamento de dados pessoais sensíveis, e em volume. O sistema coleta e
armazena nome, data de nascimento, CNS, nome da mãe, endereço, número de
prontuário, CID, sinais vitais, laudo e conteúdo de documento assistencial. Na
LGPD, coletar e armazenar já é tratamento (art. 5º, II para o dado sensível).

Base legal aplicável: **art. 11, II, "f"** (tutela da saúde, por profissional de
saúde ou serviço de saúde) para o dado clínico; **art. 7º, V** (execução de
contrato) para o dado de usuário da plataforma. **Consentimento não é a base do
dado assistencial** e o produto não deve pedi-lo como se fosse.

| Item | Responsável | Estado |
|---|---|---|
| Definição de finalidade e base legal | Controlador (hospital) | contratual |
| Contrato de operador (art. 39) | ambos | **NÃO TEMOS** |
| Encarregado (DPO) nomeado e publicado | Cloudcare | **NÃO TEMOS** |
| ROPA (registro das operações de tratamento) | Cloudcare | **NÃO TEMOS** |
| RIPD (relatório de impacto) | Cloudcare | **NÃO TEMOS** |
| Cláusulas-padrão de transferência internacional (Res. CD/ANPD 19/2024) | Cloudcare | **NÃO TEMOS** |
| Lista de subprocessadores com aviso de troca | Cloudcare | **NÃO TEMOS** |
| Plano de resposta a incidente (ANPD: comunicação em 3 dias úteis) | ambos | **NÃO TEMOS** |
| Trilha de auditoria | Cloudcare | **PARCIAL** — ver §8 |

**Lacuna regulatória do escopo:** o produto atende **pediatria de 0 a 14 anos**
(§4). O **art. 14 da LGPD** exige tratamento no melhor interesse da criança com
consentimento específico de um dos pais ou responsável. **NÃO TEMOS** esse fluxo.

### Compromisso
Contrato de operador, DPO, ROPA, RIPD e cláusulas-padrão como pré-requisito de
release — antes de qualquer cliente pagante.

---

## 7. Qual política de retenção de prontuários/documentos?

**Por tipo de dado — e o documento anterior está correto. O que falta é a
automação.**

### Hoje

| Dado | Retenção definida | Automatizado? |
|---|---|---|
| Prontuário e documento assistencial (fase 2) | 20 anos a contar do último registro (Lei 13.787/2018, art. 6º) | NÃO TEMOS (fase 2) |
| Documento emitido no turno | apagar no check-out | **NÃO** — o check-out não apaga |
| Rascunho não emitido | até emitir ou fim do turno | **PARCIAL** — expira no cliente, não por job no servidor |
| Código de acesso do paciente ao resumo | 30 dias | NÃO TEMOS |
| Trilha de auditoria | 20 anos | **PARCIAL** — sem retenção aplicada |
| Log técnico sem dado clínico | 12 meses | NÃO TEMOS |
| Dado de organização após fim de contrato | exportação FHIR + expurgo em 90 dias | NÃO TEMOS (a camada FHIR existe; exportação e expurgo não) |

**Acesso, que é diferente de retenção:** o **gestor** de unidade acessa o
cadastro completo dos pacientes da unidade para recuperar dado com rapidez. O
**admin** enxerga todas as unidades da organização mas **não vê identidade de
paciente** — só indicador agregado, com supressão de célula pequena (contagem de
1 a 4 retorna `NULL`). O **plantonista** vê os pacientes do seu turno. Essa
separação é aplicada no banco (RLS), não na tela.

### Compromisso
Expiração e expurgo por job no servidor, e o código de 30 dias para o paciente
como canal de portabilidade (LGPD art. 18).

---

## 8. Assinatura digital será ICP-Brasil?

**Sim — ICP-Brasil, PAdES com carimbo de tempo. Ainda não implementada; o spike
técnico está feito.**

### Hoje — NÃO TEMOS
Dois caminhos de emissão, na ordem de preferência:
1. **VIDaaS / certificado em nuvem do CFM** — o CFM oferece certificado ao médico
   sem custo para o profissional, o que remove a principal barreira de adoção e
   o principal custo recorrente; assinatura em nuvem também elimina token físico
   no plantão.
2. **Certificado A1/A3 do próprio médico**, para quem já tem.

**Estado real:** o **spike contra o PSC do VIDaaS foi executado** e está
bloqueado por **credencial de homologação** — paramos e reportamos em vez de
simular resultado. O que falta é credencial e implementação, não desenho.

Todo documento assistencial pretendido para assinatura: laudo de AIH,
encaminhamento, prescrição, pedido de exame e atestado. O sistema guardará o
documento assinado, o carimbo de tempo e o resultado da validação, com
revalidação posterior.

### Compromisso
Bloqueador declarado de produção e pré-requisito da fase 2.

---

## 9. Quais HIS/LIS/RIS/PACS precisam ser suportados primeiro?

**HIS, LIS, RIS. PACS fica fora do escopo inicial — e faltam dois destinos
obrigatórios para SUS e um para convênio.**

### Hoje — o que existe
- **Camada FHIR R4** (`src/interop/fhir/`: `index`, `mappers`, `codificacao`,
  `tipos`, fixtures) com validador próprio (`npm run fhir:validar`).
- **`interop_outbox`** com `tipo_documento`, `referencia_id`, `payload`,
  `status`, `tentativas`, `ultimo_erro`, **`id_rnds`** e `enviado_em`.
- **Gatilho na alta** que enfileira o documento para envio.

### Prioridade e estado por sistema

| Sistema | Prioridade | Estado |
|---|---|---|
| HIS (cadastro, censo, admissão e alta) | 1 | **NÃO TEMOS** adaptador |
| LIS (resultado estruturado) | 2 | **NÃO TEMOS** |
| RIS (pedido e laudo de imagem em texto) | 3 | **NÃO TEMOS** |
| PACS (DICOM) | fora do escopo inicial | **NÃO TEMOS** |
| **RNDS** (obrigatório SUS) | — | **PARCIAL** — fila e campo `id_rnds` prontos; envio não |
| **SISAIH01** (laudo de AIH no faturamento) | — | **NÃO TEMOS** — SIGTAP está embarcado (5.023 procedimentos), mas emitir o laudo não é faturá-lo |
| **TISS** (padrão ANS, convênios) | — | **NÃO TEMOS** — sem ele não se fatura convênio |

Arquitetura: **um adaptador por sistema sobre um modelo interno único.** Nenhum
código de domínio conhece o HIS de origem.

### Compromisso
Adaptadores na ordem acima; RNDS e SISAIH01 obrigatórios para unidade SUS.

---

## 10. FHIR será interface canônica?

**Sim. FHIR R4 é o formato de toda troca externa, de entrada e de saída — e a
camada já existe.**

### Hoje — PARCIAL (implementado)
Recursos previstos: `Patient`, `Encounter`, `Observation`, `Condition`,
`MedicationRequest`, `ServiceRequest`, `DiagnosticReport`, `DocumentReference`,
`Practitioner`, `Organization`. Implementado: mapeadores, codificação, tipos,
fixtures e validador; outbox com gatilho na alta.

Duas decisões que acompanham:
- **Perfis da RNDS** onde existirem, em vez de perfis próprios — garante que o
  envio nacional funcione sem tradução adicional.
- O **modelo interno não é FHIR**. FHIR é a fronteira; dentro, o modelo é o de
  domínio, mais estreito e mais rápido. Traduzir na borda evita que o formato de
  intercâmbio contamine a lógica clínica.

### Compromisso
Envio real (RNDS e sistemas da unidade) é o que falta; o formato está decidido e
as peças de tradução existem.

---

## 11. Qual cloud/região/residência dos dados?

**Supabase em São Paulo (AWS sa-east-1) e VPS dos agentes em Salvador/BA — todo
dado fica em território nacional.**

### Hoje — IMPLEMENTADO e verificado

| Componente | Onde | Verificado |
|---|---|---|
| Postgres, Storage, Auth | Supabase, **São Paulo (sa-east-1)** | ✅ |
| VPS dos agentes de monitoramento | **Hostinger, Salvador/BA** | ✅ (não é "a definir") |
| CDN de fontes e bibliotecas | global | nenhum dado |
| Provider de IA | ver §13 | apenas dado de-identificado |

**Storage:** 4 buckets — **3 privados** (`atendimento`, `fotos`, `receitas`) e 1
público (`banners`, que não recebe dado de paciente).

### ⚠️ Risco a resolver antes de apresentar
A conta Supabase tem **4 projetos**, e um deles está em **East US (North
Virginia)** — fora do território nacional. Se nunca recebeu dado de paciente,
apagar ou documentar; se recebeu, é contradição com esta seção.

### Compromisso
Nenhum dado pessoal ou clínico identificável sai do território nacional. Onde
isso não puder ser garantido — hoje, o provider de IA — o dado não sai
identificável (§12).

---

## 12. IA poderá receber dados identificáveis?

**Não. Nenhum dado identificável de paciente sai do perímetro — a regra é de
perímetro, não de categoria. O porteiro que garante isso ainda não está
implementado.**

### Hoje — regra definida, porteiro NÃO TEMOS
A distinção "identificável × sensível" não ajuda aqui: o dado clínico é sensível
por definição e é justamente ele que a IA processa. A regra é:

1. **Nenhum identificador direto** — nome, CNS, prontuário, nome da mãe, data de
   nascimento exata, endereço, telefone, CPF — chega ao provider.
2. **Pseudonimização antes da saída**: o paciente vira identificador opaco válido
   só na sessão; idade em faixa; data em deslocamento relativo quando a exata não
   for clinicamente necessária.
3. **O caso mais sensível é a transcrição de laudo de exame**, porque o arquivo
   traz cabeçalho com nome e prontuário: o pipeline remove a região de cabeçalho
   e redige identificadores antes de qualquer envio. Extração e rasterização já
   são **locais e sem custo**.
4. **Sem retenção pelo provider e sem uso para treino**, por contrato.

**O JEV é esse porteiro e NÃO TEMOS implementado.** Ele é o gateway único de
toda chamada de IA: de-identifica na saída, valida a resposta na entrada, reduz
o volume e registra a operação. Está declarado como **pré-requisito de release**:
sem ele, o recurso de IA não sobe em produção.

Toda saída de IA é **rascunho conferível**, nunca documento final: a transcrição
entra como texto editável e o médico confere antes de emitir.

### Compromisso
JEV antes de qualquer IA em produção.

---

## 13. Qual provider/model será utilizado?

**DeepSeek no início, por custo e latência, com a camada agnóstica de provider.
A consequência — transferência internacional — está assumida e só é compatível
com o JEV ativo (§12).**

### Hoje
- Provider: **DeepSeek V4 Flash**, endpoint compatível com OpenAI.
- Camada **agnóstica**: o JEV isola a escolha; trocar de modelo não toca o código
  de domínio.
- Uso atual no produto: resumo de laudo de exame para uma linha de anotação de
  plantão e resumo de internação. **Extração de texto, rasterização e redução de
  imagem são locais**; o modelo só é acionado quando o extrator local falha.
- Também rodam agentes próprios no servidor (fiscalização e base de conhecimento
  clínico), com prompt versionado e custo controlado por janela de horário.

Critérios de troca, em ordem:
1. Provider com **região no Brasil**, quando o custo permitir — elimina a
   transferência internacional e simplifica a conformidade.
2. **Modelo aberto hospedado na própria infraestrutura**, quando o volume
   justificar — elimina o terceiro.

### Compromisso
Em produção, a chamada é **server-side**, com fila, retentativa, registro de
auditoria (quem transcreveu, de qual arquivo, quando, com qual versão de modelo)
e guarda do arquivo original. E **sem JEV, não sobe**.

---

## 14. Qual é o processo de aprovação e atualização de regras clínicas?

**Duas camadas com donos diferentes, versionamento com data de vigência e
registro da versão vigente em cada uso. O desenho existe; o versionamento
aplicado a todos os itens ainda NÃO TEMOS.**

### Hoje
**Camada base — conteúdo de fábrica.** As **48 ferramentas**; a tabela de
diluição canônica (`medicamento` + `diluicao`); e a terminologia embarcada
(**26.000 medicamentos CMED**, **109.325 termos LOINC em português**, 14.233
CID-10, 5.023 procedimentos SIGTAP, 2.725 ocupações CBO). Cada item carrega fonte
e data de revisão, com tela de revisão de evidência, selo e lacunas. Item sem
fonte declarada aparece como lacuna — **não é preenchido por estimativa**.

**Camada da unidade — conteúdo local.** O gestor cria protocolo de tratamento,
altera diluição padrão e ajusta a padronização da unidade. A alteração vale só
para aquela unidade e **nunca sobrescreve a camada base**: sobrepõe, mantendo a
origem visível.

**Versionamento.** Toda regra clínica é versionada, com data de vigência, e o
sistema deve registrar **qual versão estava vigente no momento de cada uso** —
se uma diluição muda em março, uma prescrição de janeiro continua mostrando a
regra de janeiro. Sem isso não se reconstrói uma decisão clínica depois, que é
exatamente o que se pede em auditoria e em processo. **Estado: desenhado;
aplicado a todos os itens, NÃO TEMOS.**

**Atualização da camada base:** revisão programada por seção, mais revisão
extraordinária quando muda diretriz relevante. A competência do SIGTAP tem
rotina mensal própria.

### Compromisso
Implementar o versionamento com vigência e o registro por uso; nomear os
responsáveis técnicos (pergunta 15).

---

## 15. Quem possui autoridade clínica para aprovar uma regra antes do release?

**Duas autoridades, em escopos distintos. A da unidade existe no produto; a da
camada base ainda precisa ser nomeada.**

### Hoje

**Conteúdo da unidade: o gestor da unidade.** Aprova protocolo local, diluição
padrão local e ajuste de padronização. É a autoridade clínica daquela unidade e
responde por ela. **IMPLEMENTADO** (papel `gestor` no banco, com RLS própria).

**Conteúdo de fábrica: responsável técnico da plataforma** — um médico com CRM e
um farmacêutico com CRF, nomeados, respondendo pela camada base. O gestor de uma
unidade não pode responder pelas 48 ferramentas que vieram prontas: ele não as
escreveu. **NÃO TEMOS** os dois nomeados; é pré-requisito de release.

**Fiscalização automatizada — IMPLEMENTADO e rodando em produção:** agentes
próprios (o **Gavião**, com Cérbero, Argos, Sentinela e Íris) varrem a plataforma
em busca de conteúdo ou orientação fora do padrão, erro interno e desvio de
indicador das unidades, e avisam o administrador. Isso é **vigilância, não
aprovação**: o agente levanta a bandeira, a pessoa decide. **Nenhum agente
publica, altera ou aprova regra clínica.**

> Correção de nomenclatura: o fiscal é o **Gavião**, código próprio. "Hermes" é o
> produto de terceiro (Nous Research) que hospeda o agente conversacional. Ao
> técnico, chamar o fiscal de Hermes faz parecer dependência de terceiro onde há
> ativo proprietário.

### Compromisso
Nomear responsável técnico médico (CRM) e farmacêutico (CRF) para a camada base,
com aprovação nominal e registrada antes de cada release.

---

## Anexo — Resumo dos pré-requisitos de release

Em ordem de bloqueio, com o estado verificado:

| # | Pré-requisito | Estado |
|---|---|---|
| 1 | **MFA** para perfis administrativos | NÃO TEMOS |
| 2 | **Auditoria imutável** (append-only + retenção) | PARCIAL (trilha existe) |
| 3 | **Assinatura ICP-Brasil** em documento assistencial | NÃO TEMOS (spike pronto) |
| 4 | **JEV** (de-identificação) antes de IA em produção | NÃO TEMOS |
| 5 | **Contrato de operador, DPO, ROPA, RIPD, cláusulas-padrão, subprocessadores** | NÃO TEMOS |
| 6 | **Versionamento com vigência** de toda regra clínica | PARCIAL (desenhado) |
| 7 | **Responsável técnico** médico e farmacêutico nomeados | NÃO TEMOS |
| 8 | **Tirar dado de paciente do `localStorage`** | NÃO TEMOS |
| 9 | **RPO/RTO** com números, PITR confirmado, restauração testada, staging | NÃO TEMOS |
| 10 | **SLA, suporte, plantão** e pooler dimensionado | NÃO TEMOS |
| 11 | **Testes das calculadoras clínicas** | NÃO TEMOS |
| 12 | **eMAG** (hospital público) · **TISS** (convênio) | NÃO TEMOS |
| 13 | **Termo de uso** com limitação de responsabilidade e apólice RC/cyber | NÃO TEMOS |
| 14 | **SBIS/CFM NGS2** para a fase 2 | NÃO TEMOS |

**Já implementado e verificável hoje** (§1, §3, §4, §10, §11, §15):
isolamento multi-tenant no banco (57 tabelas com RLS, 146 policies, 85 funções
com `search_path` fixo), presença com geolocalização, 157 mil registros de
terminologia clínica, 48 ferramentas, camada FHIR com outbox, dados em território
nacional e agentes de fiscalização rodando.
