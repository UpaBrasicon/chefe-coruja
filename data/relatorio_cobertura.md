# Relatório de Cobertura e Riscos — Fase 1

> Gerado: 2026-08-17 · Fonte de identificação: RxNorm/RxNav + ANVISA Dados Abertos

## Cobertura (200 itens da padronização)

| Métrica | Valor | % |
|---|---|---|
| rxcui (RxNorm) | 200/200 | **100%** |
| registro ANVISA | 173/200 | 86,5% |
| ambos (rxcui + ANVISA) | 173 | 86,5% |
| apenas rxcui | 27 | 13,5% |
| pendente total | 0 | 0% |

## 27 itens sem registro ANVISA (todos com rxcui)

Apresentações com sufixo de via/comprimido ou grafias que o dicionário ANVISA não expõe
como princípio ativo único:

`Nitroprussiato de sodio, Fosfato de potassio, Soro fisiologico 0,9%, Soro glicofisiologico,
Ringer lactato, Heparina nao fracionada, Carvão ativado, Codeina, Ertapenem, Rocuronio,
Atracurio, Cisatracurio, Succinilcolina, Vecuronio, Carboprost, Ipratropio, Laculose,
Colistina, Tranexamico, Acido aminocaproico, Rimantadina, Morfina (dose pediátrica),
Amiodarona (comprimido), Warfarina, AAS, Levotiroxina (comprimido), Oseltamivir (comprimido)`

**Ação sugerida:** normalizar `principio_ativo` removendo sufixos de apresentação em novo
ciclo de ETL e conferir com a consulta de registros ANVISA (portal, exigindo autenticação).

## Riscos

| # | Risco | Nível | Mitigação |
|---|---|---|---|
| 1 | Dado de diluição incorreto causa erro assistencial | **Alto** | `revisor_crf` obrigatório; API filtra `status='publicado'` |
| 2 | Conteúdo licenciado (Trissel's/Lexidrug/etc.) | Alto | Proibido extrair; só bula ANVISA como fonte primária |
| 3 | Bula americana ≠ apresentação brasileira | Médio | `texto_referencia_en` apenas como apoio de curadoria |
| 4 | DrugBank CC BY-NC em produto comercial | Alto | Não usar |
| 5 | Dependência de internet em produção (UPA) | Médio | Cache local + checksum; RxNav-in-a-Box na Fase 4 |
| 6 | API ANVISA exige autenticação / muda | Médio | Fallback offline; cache com checksum |

## Próximas fases

- **Fase 2:** openFDA/DailyMed → `texto_referencia_en` (apoio de curadoria)
- **Fase 3:** `diluicao.csv` + `pendencias.csv` — somente com `fonte`; revisor farmacêutico marca `publicado`
- **Fase 4:** RxNav-in-a-Box local (interações offline)
- **Fase 5:** comparativo Memed × Mevo
