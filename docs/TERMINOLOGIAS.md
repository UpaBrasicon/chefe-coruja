# TERMINOLOGIAS — Camada de referência pública (Fase 1)

Tabelas públicas de terminologia no schema `terminologia` (Supabase). São dados
públicos: **não** são replicados por tenant e **não** têm RLS por tenant —
leitura para qualquer usuário autenticado, escrita somente via `service_role`.

> ⚠️ **Os arquivos de dados NÃO são baixados automaticamente pelo repositório.**
> Você deve baixá-los manualmente e colocá-los em `data/terminologia/` com os
> nomes abaixo. Esta página documenta de onde baixar e com que frequência.

---

## Tabelas

| Tabela | Conteúdo | Chave |
|---|---|---|
| `terminologia.cid10` | Diagnósticos CID-10 | `codigo` |
| `terminologia.sigtap_procedimento` | Procedimentos SIGTAP (SUS) | `codigo` |
| `terminologia.cbo` | Ocupações CBO 2002 | `codigo` |
| `terminologia.medicamento_cmed` | Medicamentos — preço de fábrica (ANVISA) | `id` |
| `terminologia.loinc` | Exames laboratoriais LOINC | `codigo` |

Todas têm coluna `busca tsvector` **gerada** (to_tsvector `portuguese` + unaccent)
com índice GIN. Busca via RPC `terminologia_buscar` (ranqueada por `ts_rank`,
com prioridade para prefixo de código).

---

## Fontes e frequência de atualização

| Fonte | Onde baixar | Atualização | Arquivo esperado |
|---|---|---|---|
| **CID-10** | DATASUS — [CID-10 tabelas](https://www.datasus.gov.br/cid10/V2008/WebHelp/fichas_principais.htm) (download "Tabela de CID-10" CSV — **zip com 6 arquivos**) | Rara | `data/terminologia/cid10/` (4 arquivos usados, ver abaixo) |
| **SIGTAP** | **Automático** — mirror no GitHub: [RenatoKR/SIGTAP](https://github.com/RenatoKR/SIGTAP) (sincronizado diariamente 5h BRT do FTP oficial do DATASUS; mantém 6 meses) | Mensal (competência) | `data/terminologia/sigtap/` (via `npm run baixar:sigtap`) |
| **CBO** | Ministério do Trabalho — [CBO 2002 (download)](https://cbo.mte.gov.br/) (zip "ESTRUTURA CBO"; extrair em `data/terminologia/cbo/`) | Rara | `data/terminologia/cbo/CBO2002 - Ocupacao.csv` |
| **CMED** | ANVISA — [Preços de medicamentos](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos) — baixar o XLSX **"PMC - xls"** (arquivo `xls_conformidade_site_*.xlsx`) e salvar como `data/terminologia/cmed.xlsx` | Mensal | `data/terminologia/cmed.xlsx` |
| **LOINC** | [loinc.org/downloads](https://loinc.org/downloads/) (zip `Loinc_2.82` → extrair `LoincTable/Loinc.csv` **e** `AccessoryFiles/LinguisticVariants/ptBR11LinguisticVariant.csv` para `data/terminologia/loinc/`) | Semestral | `data/terminologia/loinc/Loinc.csv` + `ptBR11LinguisticVariant.csv` |

### SIGTAP — atualização automática (recomendado)

O repositório [RenatoKR/SIGTAP](https://github.com/RenatoKR/SIGTAP) é um **mirror
automático** da Tabela Unificada do DATASUS (GitHub Actions diário às 5h BRT,
últimos 6 meses, dados de domínio público, GPL-3.0). Use:

```bash
npm run baixar:sigtap    # busca o zip mais recente via API do GitHub e extrai
npm run import:sigtap    # importa tb_procedimento.txt (posicional) p/ o banco
```

O download extrai para `data/terminologia/sigtap/`:
- `tb_procedimento.txt` — ~5 mil procedimentos (posicional fixed-width)
- `tb_procedimento_layout.txt` — descrição das colunas (lida pelo importador)

O importador parseia o layout dinamicamente, converte Windows-1252→UTF-8,
normaliza `9999` (idade sem limite) e `0` (sem valor) para `NULL`, e faz
upsert idempotente por `codigo`. Para atualização mensal, basta rodar os dois
comandos (ou agendar em CI).

### CID-10 — arquivos do DATASUS (zip `CID10CSV.zip`)

Extraia o zip em `data/terminologia/cid10/`. O importador usa **4 dos 6 arquivos**
(os 2 do CID-O/oncologia são ignorados):

```
data/terminologia/cid10/
├── CID-10-SUBCATEGORIAS.CSV   ← principal (12.451 códigos A00.0)
├── CID-10-CATEGORIAS.CSV      ← categorias A00 (2.045)
├── CID-10-GRUPOS.CSV          ← faixas de grupos (275)
├── CID-10-CAPITULOS.CSV       ← faixas de capítulos (22)
├── CID-O-CATEGORIAS.CSV       ← ignorado (oncologia)
└── CID-O-GRUPOS.CSV           ← ignorado (oncologia)
```

O script monta **~14,2 mil linhas** (categorias + subcategorias), resolve
`capitulo`/`grupo` por faixa e formata o código com ponto (`A000` → `A00.0`).
Os arquivos do DATASUS vêm em **Windows-1252** — o parser detecta e converte
automaticamente.

### Formato esperado dos CSVs (colunas; ordem irrelevante, nomes normalizados)

```
sigtap.csv:       codigo;nome;complexidade;sexo;idade_min;idade_max;
                  valor_sa;valor_sh;valor_sp;competencia
cbo.csv:          codigo;titulo
loinc.csv:        LOINC_NUM;COMPONENT;PROPERTY;EXAMPLE_UNITS;
                  LONG_COMMON_NAME;SHORTNAME;CLASS
```

> O CID-10 não usa um CSV único (veja o bloco "CID-10 — arquivos do DATASUS").
> O SIGTAP também não: usa os arquivos posicionais de `data/terminologia/sigtap/`
> (veja o bloco "SIGTAP — atualização automática").
> O CMED não usa CSV: lê o XLSX oficial da ANVISA (veja o bloco abaixo).
> O LOINC usa o `Loinc.csv` oficial (UTF-8, aspas, ~109 mil linhas) + a
> **variante pt-BR** (`ptBR11LinguisticVariant.csv`, ~58 mil termos) — extraídos
> em `data/terminologia/loinc/`. A busca aceita termos em **pt e en**
> ("glicose" e "glucose" acham o mesmo exame) e exibe o nome em pt-BR quando
> disponível (colunas `componente_pt`/`nome_curto_pt`, migrations 00005/00006).

O parser aceita `;` ou `,` (auto-detectado), aspas, CRLF/LF, BOM, e converte
Windows-1252 (DATASUS) automaticamente. Os scripts toleram variações de
cabeçalho (ex.: `co_procedimento`, `no_procedimento`, `loinc_num`,
`long_common_name`), removendo acentos/maiúsculas. Os mapeadores aceitam
também os cabeçalhos originais de cada fonte (tabela abaixo).

### CMED — XLSX oficial da ANVISA

Na página [Preços de medicamentos](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos),
baixe o arquivo **"PMC - xls"** (`xls_conformidade_site_YYYYMMDD_*.xlsx`) e salve
como `data/terminologia/cmed.xlsx`. O importador lê o XLSX diretamente:

- Cabeçalho na **linha 42** da planilha (bloco de notas acima é pulado); dados
  da linha 43 em diante — **~26 mil apresentações**.
- Colunas mapeadas: `SUBSTÂNCIA`, `PRODUTO`, `APRESENTAÇÃO`, `LABORATÓRIO`,
  `REGISTRO`, `CLASSE TERAPÊUTICA`, `PF Sem Impostos`, `TARJA`.
- Chave primária: hash SHA-1 de `REGISTRO+PRODUTO+APRESENTAÇÃO` (o arquivo não
  tem id único). Upsert idempotente por `id`.
- Se a ANVISA mudar o layout, o importador falha com mensagem clara apontando
  a coluna ausente (ajuste `LINHA_CABECALHO`/mapeamento no script).

```bash
npm run import:cmed            # lê data/terminologia/cmed.xlsx
node scripts/terminologia/importar-cmed.ts <outro.xlsx>   # arquivo alternativo
```

> O CID-10 não usa um CSV único (veja o bloco "CID-10 — arquivos do DATASUS").
> O SIGTAP também não: usa os arquivos posicionais de `data/terminologia/sigtap/`
> (veja o bloco "SIGTAP — atualização automática").
> O CMED não usa CSV: lê o XLSX oficial da ANVISA (veja o bloco "CMED — XLSX
> oficial da ANVISA").

O parser aceita `;` ou `,` (auto-detectado), aspas, CRLF/LF, BOM, e converte
Windows-1252 (DATASUS) automaticamente. Os scripts toleram variações de
cabeçalho (ex.: `co_procedimento`, `no_procedimento`, `loinc_num`,
`long_common_name`), removendo acentos/maiúsculas. Os mapeadores aceitam
também os cabeçalhos originais de cada fonte (tabela abaixo).

### Cabeçalhos reais aceitos por fonte (além do formato canônico)

| Fonte | Cabeçalhos originais aceitos |
|---|---|
| **SIGTAP** | `CO_PROCEDIMENTO`, `NO_PROCEDIMENTO`, `CO_COMPLEXIDADE`, `SEXO_PROCEDIMENTO`, `IDADE_MIN_PROCEDIMENTO`, `IDADE_MAX_PROCEDIMENTO`, `VL_SA`, `VL_SH`, `VL_SP`, `CO_COMPETENCIA` |
| **CBO** | `CO_OCUPACAO`, `NO_OCUPACAO`, `CODIGO_OCUPACAO`, `TITULO_OCUPACAO` |
| **CMED** | `SUBSTÂNCIA`, `PRODUTO`, `APRESENTAÇÃO`, `LABORATÓRIO`, `REGISTRO`, `CLASSE TERAPÊUTICA`, `TARJA`, `PF SEM IMPOSTOS`, `COMPETÊNCIA` |
| **LOINC** | `LOINC_NUM`, `COMPONENT`, `PROPERTY`, `EXAMPLE_UCUM_UNITS`, `LONG_COMMON_NAME`, `SHORTNAME`, `CLASS` |

---

## Importação (local/CI — requer `service_role`)

```bash
# 1. Variáveis (NUNCA no cliente):
#    SUPABASE_URL=https://SEU-PROJETO.supabase.co
#    SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY

# 2. Rodar (um por fonte):
node scripts/terminologia/importar-cid10.ts
node scripts/terminologia/importar-sigtap.ts
node scripts/terminologia/importar-cbo.ts
node scripts/terminologia/importar-cmed.ts
node scripts/terminologia/importar-loinc.ts
```

Cada script:
- lê o CSV de `data/terminologia/`;
- faz **upsert em lote** (500 por vez, `ON CONFLICT` na chave) — **idempotente**;
- reporta `inseridos / atualizados / ignorados`.

> Segurança: a `service_role` key **nunca** vai para o cliente (`VITE_*`).
> Os scripts rodam só em ambiente local/CI.

---

## Busca

**RPC única** `terminologia_buscar(p_tabela, p_termo, p_limite)` (wrapper
público de `terminologia.buscar`):

```ts
const { data } = await supabase.rpc('terminologia_buscar', {
  p_tabela: 'cid10',
  p_termo: 'pneumo',
  p_limite: 10,
})
// data: [{ tabela, codigo, descricao, extra, rank }]
```

- Ranqueamento: `ts_rank` (FTS português + unaccent) com **prioridade para
  prefixo de código** (ex.: "A00" acha `A00.x` antes de texto).
- Sem acento: "cefaleia" encontra "Cefaléia".
- `p_limite` entre 1 e 50 (default 10); tabela fora da whitelist → erro.

No React:

```tsx
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'

<BuscaTerminologia
  tipo="cid10"
  onSelecionar={(r) => console.log(r.codigo, r.descricao)}
/>
```

Ou o hook `useTerminologia(tipo, termo)` (debounce 300 ms).

---

## Testes

```bash
node --test "scripts/terminologia/tests/*.test.ts"
```

- Unitários (sempre rodam): parser CSV, idempotência da importação (cliente
  fake), normalização de acento / montagem do tsquery.
- Integração (condicional — define `SUPABASE_TEST_URL` + `SUPABASE_SERVICE_ROLE_KEY`):
  busca real por acento ("cefaleia" → "Cefaléia") e por código parcial no banco.

---

## Reversão

A migration `20260817000003_terminologia.sql` tem bloco `DOWN` comentado no
final (DROP das funções, tabelas e schema). Aplicar manualmente se precisar
reverter. A extensão `unaccent` é compartilhada — só removê-la se nada mais a
usar.
