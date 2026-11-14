# Revisão do HCFMUSP, lote 4, O2: cap. 84, emergências oncológicas (síndrome de lise tumoral)

O RT decidiu O1 a O4 = A em 14/11/2026. Ele liberou a produção do resto do lote 4 desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte

- **Diretriz:** Chan YLT, El-Sharkawi D, Shah P, et al. British Society for Haematology updated guidelines for the diagnosis and management of tumour lysis syndrome in adults and children with haematological malignancies: A focus on patient safety. Br J Haematol 2025;207(4):1248–1258 (PMID 40903841).
- **Leitura:** li o texto integral no site da revista, pelo Chrome do RT. A diretriz usa GRADE e foi feita para neoplasias hematológicas. Usei só a parte do adulto.
- **O que ficou de fora:**
  - compressão medular e síndrome da veia cava superior: não há diretriz de sociedade nova no PubMed, e esses temas ficam com o manual;
  - hipercalcemia: está na nota do cap. 68.
- **Manual:** o lado do manual vem da ficha da Central, já conferida no PDF (cap. 84, p. 1099–1105).

## O que mudou na Central

- **Ficha `adulto-lise-tumoral` 2026-11-14.1:** antes só tinha o manual.
  - Fonte `BSH_SLT_2025`.
  - `DIRETRIZ_SLT`: 11 temas.
  - `DIFERENCAS_SLT`: 5 frases.
  - A tela ganha a tabela ao lado do manual.
- **Doses:** as doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap84-lise-tumoral`:** 11 itens.
- **Migration:** `20270414000018`.

## Diferenças principais

| Tema | BSH 2025 | Manual de 2022 |
|---|---|---|
| Rasburicase na prevenção | dose fixa de 3 mg, repetida conforme exames (2C) | 0,15–0,2 mg/kg por 1–7 dias (p. 1104) |
| Alopurinol | 300 mg/dia, iniciar 12 h antes (2C) | 100 mg/m² 8/8 h ou 10 mg/kg/dia, iniciar 2–3 dias antes (p. 1103) |
| Febuxostate | 120 mg/dia | 40–120 mg/dia (p. 1104) |
| Alcalinização | não ajuda e piora os cristais | controversa, só na acidose (p. 1103) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| rasburicase na prevenção | manual: 0,15–0,2 mg/kg | BSH: 3 mg fixos podem bastar |
| alcalinizar a urina | manual: controversa | BSH: não; piora os cristais |
| alopurinol | manual | BSH: 300 mg/dia, 12 h antes |
| rasburicase na lise estabelecida | manual | BSH: 0,2 mg/kg/dia por até 7 dias; alopurinol 24 h depois |
| potássio no soro e Ringer | "não encontrei" | BSH: nunca potássio no soro; cuidado com balanceado |
| frequência de exames | "os trechos não trazem" | BSH: 2 vezes ao dia no alto risco, 6–12 h na estabelecida |

As seis respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- 2 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.241, sem falha) e typecheck limpos.
- A tela não foi vista com login.
