# FONTES — Registro de fontes de dados clínicos (Chefe Coruja)

> Última atualização: 2026-08-17
> Uso: registrar cada fonte usada nas fases 0–5, com URL, data de acesso, licença e
> restrição de uso comercial. **Fontes marcadas como NC (não comerciais) não podem ser
> usadas como fonte primária de produção.**

---

## Fase 0 — Padronização

| Fonte | URL | Acesso | Licença | Comercial? |
|---|---|---|---|---|
| RENAME — Relação Nacional de Medicamentos Essenciais (MS) | https://www.gov.br/saude/pt-br/composicao/secretaria-executiva/sef/sntcs/rename | 2026-08-17 | Dados públicos do governo (CC BY) | ✓ sim (com citação) |
| ISMP Brasil — Lista de Medicamentos de Alta Vigilância | https://www.ismp-brasil.org/site/medicamentos-de-alta-vigilancia/ | 2026-08-17 | Uso educacional; citar fonte | ✓ sim (com citação) |

**Saída:** `data/padronizacao.csv` (200 itens), `data/alta_vigilancia_ismp.csv` (50 itens).

---

## Fase 1 — Chave canônica de identificação

| Fonte | URL | Acesso | Licença | Comercial? |
|---|---|---|---|---|
| RxNorm / RxNav (NLM) — API REST | https://rxnav.nlm.nih.gov/REST | 2026-08-17 | UMLS; uso com atribuição; sem chave para REST básico (20 req/s) | ✓ sim (atribuição NLM) |
| RxNorm — releases mensais (RRF) | https://www.nlm.nih.gov/research/umls/rxnorm/index.html | não baixado nesta fase | UMLS license | ✓ sim (licença UMLS) |
| RxNav-in-a-Box (modo offline) | https://lhncbc.nlm.nih.gov/RxNav/ | pendente (Fase 4) | open source (NLM) | ✓ sim |
| ANVISA — Dados Abertos de Medicamentos | https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv | 2026-08-17 | Dados abertos do governo (sem restrição comercial declarada) | ✓ sim (atribuição ANVISA) |
| ANVISA — Portal de APIs | https://api.anvisa.gov.br/ | **não usado** | Exige cadastro/autenticação | ⚠ verificar termos |
| OBM — Ontologia Brasileira de Medicamentos | https://bvsms.saude.gov.br/bvs/saudelegis/gm/2024/prt6093_17_12_2024.html | não usado (integração futura RNDS) | pública MS | ✓ sim |
| RNDS — Guia FHIR / NamingSystem OBM | https://rnds-fhir.saude.gov.br/NamingSystem-BRObmAMPP.html | não usado | pública | ✓ sim |
| CMED / dados.gov.br (preço, tarja) | https://dados.gov.br/ | não usado | pública | ✓ sim |
| DEMAS — API Dados Abertos MS | https://apidadosabertos.saude.gov.br/ | 2026-08-17 (teste 404 no endpoint consultado) | pública | ✓ sim |

**Saída:** `data/medicamento.csv`, `data/cache/anvisa_medicamentos.csv`, `data/cache/rxcui_cache.json`, `data/relatorio_cobertura.txt`.
**Cobertura:** rxcui 200/200 (100%), ANVISA 173/200 (86,5%), ambos 173, nenhum 0.

---

## Fase 2 — Conteúdo clínico de bula (apoio à curadoria)

| Fonte | URL | Acesso | Licença | Comercial? |
|---|---|---|---|---|
| openFDA — Drug Label API | https://open.fda.gov/apis/drug/label/ | 2026-08-17 (testado, sem chave) | Dados públicos dos EUA | ✓ sim (uso como apoio; bula americana ≠ apresentação brasileira) |
| DailyMed — SPL resources/downloads | https://dailymed.nlm.nih.gov/dailymed/spl-resources.cfm | não baixado nesta fase | pública NLM | ✓ sim (apoio) |
| DrugCentral | https://drugcentral.org | não usado | open access | ✓ sim |
| DrugBank | https://go.drugbank.com/releases/latest | **não usar** | CC BY-NC (não comercial) | **✗ NÃO COMERCIAL — inviável** |
| Bula ANVISA (produto) | https://consultas.anvisa.gov.br/ | não baixado nesta fase | pública | ✓ sim (fonte primária citável) |

---

## Fase 3 — Tabela de diluição (validação; NÃO cópia direta)

| Fonte | URL | Acesso | Licença | Comercial? |
|---|---|---|---|---|
| Guia de diluição HU-UFGD (EBSERH) | https://www.gov.br/ebserh/.../GuiaparadiluiodemedicamentosinjetveisHU_UFGD1.edio.pdf | não baixado | Reprodução autorizada **com citação e sem fins lucrativos** | **⚠ NC — usar como referência de validação, não cópia** |
| Guia HU-UFGD v.3 (Res. 179/2025) | https://www.gov.br/hubrasil/.../Anexo_Resoluo_179_...pdf | não baixado | idem | **⚠ NC** |
| Tabelas de diluição HU-USP | https://sites.usp.br/hu/tabelas-de-diluicao-de-medicamentos-injetaveis/ | não baixado | pública USP | ⚠ validar |
| Stabilis (Infostab) | https://www.stabilis.org/ | **consulta manual** | associação — não automatizar | ⚠ |
| King Guide (Y-site) | https://kingguide.com/online.html | não usado | licenciada | ✓ sim (licença) |
| Trissel's / Lexidrug | https://www.wolterskluwer.com/en/solutions/uptodate/enterprise/lexidrug-trissels-iv-compatibility | **NÃO extrair** | licenciada | — |
| Micromedex / UpToDate | (repositórios licenciados) | **NÃO extrair** | licenciada | — |

**Regra de ouro:** nenhum valor de diluição entra sem `fonte` + `data_revisao` + `revisor_crf`.
Registros sem revisor permanecem `status = 'rascunho'` e **não são servidos pela API**.

---

## Fase 4 — Interações medicamentosas (offline)

| Fonte | URL | Acesso | Licença | Comercial? |
|---|---|---|---|---|
| RxNav-in-a-Box | https://lhncbc.nlm.nih.gov/RxNav/ | **BLOQUEADO** — exige licença UMLS (download 0 bytes) + Docker Desktop + 12GB RAM + 100GB disco | open source NLM | ✓ sim |
| RxNorm API pública — interação | https://rxnav.nlm.nih.gov/REST/interaction/... | **DESCONTINUADA** (404 em 2026-08-17) | — | — |

**Descoberta:** a API pública de interação do RxNorm foi descontinuada; interações
oficiais só via RxNav-in-a-Box local. Ver `data/FASE4_RXNAV.md`. Script pronto
(`10_interacoes_rxnav.cjs`) com detecção de RxNav local + cache. Release a
documentar: `20260803`.

---

## Fase 5 — Camada ambulatorial / assinatura (avaliação comercial)

| Fonte | URL | Modelo | Custo |
|---|---|---|---|
| Memed (parceiro software) | https://memed.com.br/parceiro-software/ | contrato de parceria | por prescrição / mensal |
| Mevo / ex-Nexodata | https://medicos.nexodata.com.br/ | contrato de parceria | por prescrição / mensal |

Entrega um **comparativo** — não uma implementação.

---

## Fontes NC (não comerciais) — sinalização explícita

As seguintes fontes **não podem** ser usadas como fonte primária em produto comercial:

1. **HU-UFGD / EBSERH** — autorizada reprodução com citação **sem fins lucrativos**.
   Uso permitido: **validação** e comparação de estrutura. Fonte primária citável: bula ANVISA.
2. **DrugBank** — CC BY-NC. **Não usar** em produção comercial.
3. **Trissel's / Lexidrug / Micromedex / UpToDate / Stabilis automatizado** — licenciadas; **não extrair conteúdo**.

## Riscos jurídicos identificados

1. Erro assistencial por dado de diluição incorreto → mitigado por `revisor_crf` obrigatório + `status` publicado.
2. Reprodução de conteúdo licenciado → proibida (regra acima).
3. Bula americana (FDA) ≠ apresentação brasileira → `texto_referencia_en` isolado como apoio.
4. DrugBank em produto comercial → inviável (CC BY-NC).
5. LGPD/RNDS ao interoperar prescrições → chave OBM/rxcui sem transportar dado de paciente.
6. API ANVISA exige autenticação e pode mudar → fallback offline com cache + checksum.
