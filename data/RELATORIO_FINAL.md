# RELATÓRIO FINAL — Camada de medicamentos e diluição (Chefe Coruja)

> Gerado: 2026-08-17 · Escopo: Fases 0–5

## Resumo executivo

A camada de medicamentos e diluição foi construída como **sistema de referência
farmacêutica** com governança de segurança clínica. Nenhum valor de diluição é
apresentado ao médico sem revisão de farmacêutico (`status = 'publicado'` +
`revisor_crf`). Todo o pipeline funciona **offline** com cache local e checksum.

## Cobertura

| Fase | Entregável | Métrica |
|---|---|---|
| 0 | Padronização | **200 itens** + 51 alta vigilância ISMP |
| 1 | Chave canônica | **rxcui 200/200 (100%)** · ANVISA 173/200 (86,5%) · pendentes 0 |
| 2 | Bula de apoio | **140 bulas** openFDA (`texto_referencia_en`) |
| 3 | Diluição | **125 registros** rascunho (fonte HU-UFGD v3) · 77 no banco · 1.432 campos null documentados |
| 4 | Interações | **bloqueado** (RxNav-in-a-Box exige licença UMLS + Docker); script pronto |
| 5 | Ambulatorial | **avaliação** Memed × Mevo documentada |

## Critérios de aceite

| Critério | Status |
|---|---|
| Nenhum valor numérico de diluição sem `fonte` | ✅ `fonte='HU-UFGD_v3'` em todos |
| Nenhum registro `publicado` sem `revisor_crf` | ✅ todos `rascunho`; `publicar_diluicao` exige `revisor_crf` |
| 100% dos itens da padronização presentes | ✅ 200/200 (rascunho ou pendência) |
| Sistema funciona com internet caída | ✅ cache local + checksum (ANVISA, RxCUI, openFDA) + RxNav local detectável |
| `FONTES.md` sinaliza fontes NC | ✅ EBSERH, DrugBank, Trissel's/Lexidrug/Micromedex sinalizados |

## Risco jurídico residual

| Risco | Nível | Mitigação |
|---|---|---|
| Erro assistencial por dado de diluição | Alto | revisor_crf + status publicado + pendências documentadas |
| Conteúdo licenciado reproduzido | Alto | proibido; HU-UFGD só como rascunho citado para revisão |
| Bula americana como equivalente BR | Médio | `texto_referencia_en` isolado em tabela de apoio |
| Comercialização com dados EBSERH | Médio | dados do HU-UFGD em rascunho; curador confere contra bula ANVISA antes de publicar |
| Interações sem RxNav (Fase 4) | Médio | documentado; script pronto; contratação de fonte licenciada como alternativa |
| LGPD na prescrição ambulatorial | Médio | DPA obrigatório com parceiro (Fase 5) |

## Estrutura de arquivos

- `data/` — padronizacao.csv, medicamento.csv, diluicao.csv, pendencias.csv, texto_referencia_en.csv, relatório, FASE4/FASE5
- `data/cache/` — anvisa, guias HU-UFGD, openFDA, rxcui_cache
- `scripts/etl/` — 01..10 (download, mapeamento, load, bula, parser, curadoria, interações)
- `supabase/migrations/` — 0031 (tabelas canônicas + diluicao), 0032 (bula), 0033 (curadoria)
- `src/pages/` — PrescricaoTeste, ReferenciaDiluicao
- `FONTES.md`

## Próximos passos para produção

1. Farmacêutico revisa os 125 rascunhos contra a bula ANVISA → `publicar_diluicao`.
2. Provisionar Docker + licença UMLS → habilitar RxNav-in-a-Box (Fase 4).
3. Cotar Memed/Mevo (Fase 5).
4. Integrar a diluição publicada no fluxo de prescrição (PrescricaoTeste).
