# Revisão do HCFMUSP, lote 5, P2 e P4: cap. 91, dengue

O RT decidiu P1 a P4 = A em 14/11/2026 e liberou a produção do lote 5 inteiro, desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte (P4)

- **OMS 2025:** World Health Organization. WHO guidelines for clinical management of arboviral diseases: dengue, chikungunya, Zika and yellow fever. Genebra: OMS; 2025 (PMID 40690567).
  - O PubMed não devolveu os metadados (é registro do Bookshelf).
  - O texto está aberto no NCBI Bookshelf (NBK616307). Li o resumo das recomendações (NBK616301) pelo Chrome do RT.
  - Usa GRADE.
  - As recomendações de febre amarela ficaram de fora.
- **Ferramenta da Central:** continua pelo Ministério da Saúde 2024, 6ª ed., mais novo que o manual do HC.
- **Manual do HC:** conferi o cap. 91 no PDF (p. 1233) para a coluna do manual.

## O que mudou na Central

- **Ficha `dengue-classificacao` 2026-11-14.1:**
  - a fonte `OMS_ARBOVIROSES_2025` entra depois do Ministério da Saúde 2024;
  - `DIRETRIZ_DENGUE_OMS`: 8 temas;
  - `DIFERENCAS_DENGUE_OMS`: 5 frases;
  - a tela de classificação ganha a tabela.
- **Contas:** a classificação e a hidratação não mudam.
- **Teste:** o `dengue2024.test.ts` fixava a versão .1 de 28/09; passou para 2026-11-14.1.
- **Nota `nota-hcfmusp-cap91-dengue`:** 9 itens. O primeiro diz que a ferramenta segue o Ministério da Saúde 2024.
- **Migration:** `20270414000030`.

## Diferenças principais (OMS 2025 × manual do HC)

| Tema | OMS 2025 | Manual do HC de 2022 |
|---|---|---|
| AINE | não usar, qualquer gravidade (forte) | evitar salicilatos (p. 1233) |
| Corticoide e imunoglobulina | não usar | não fala |
| Plaquetas | não transfundir profilaticamente com < 50.000/µL sem sangramento | internar com < 50.000/mm³ |
| Guia do volume | enchimento capilar e lactato (fortes) | hematócrito seriado |

## Antes e depois (14/11/2026)

Na produção, as seis respostas já seguiam o Ministério da Saúde 2024 e estavam certas. Na homologação, elas passam a citar a OMS 2025 com o grau, e o manual do HC fica ao lado. A do volume do grupo C (controle) ficou igual.

## Homologação

- Migration aplicada.
- 2 arquivos ingeridos e API reiniciada.
- `test:clinico` (1.251, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção do #706 (cap. 10), 14/11/2026

- A migration `20270414000029` foi aplicada antes do merge. O #706 foi mesclado com o CI verde.
- Os 2 arquivos foram ingeridos e a API foi reiniciada.
- As 6 respostas saíram como na homologação.
- O Vercel publicou o master.
