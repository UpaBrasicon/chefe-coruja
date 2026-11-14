# Revisão do HCFMUSP, lote 5, P1: notas dos cap. 27, 79, 82 e 102

O RT decidiu P1 a P4 = A em 14/11/2026. P1: estes quatro capítulos já têm na ficha da Central uma diretriz recente, conferida antes. As notas reaproveitam esses itens; nenhuma ficha muda.

## Notas

| Nota | Ficha da Central | Fontes | Itens |
|---|---|---|---|
| `nota-hcfmusp-cap27-irpa` | `adulto-oxigenacao-irpa` | ATS 2026 de suporte respiratório não invasivo (PMID 42371750) e SOHO, NEJM 2026 | 5 |
| `nota-hcfmusp-cap79-hemostasia` | `adulto-reversao-anticoagulacao` | consenso brasileiro SBTH 2026, ANNEXA-I 2024, AAO-HNS 2020 e ESO/EANS 2025 (as três linhas de reversão) | 7 |
| `nota-hcfmusp-cap82-transfusao` | `adulto-transfusao-hemocomponentes` | AABB 2023, AABB 2025 (IAM), AABB/ICTMG 2025 (plaquetas), TRAIN, HEMOTION e SAHaRA | 8 |
| `nota-hcfmusp-cap102-hipotermia` | `adulto-hipotermia` | ERC 2025 (`DIRETRIZ_HIPOTERMIA_2025`) | 9 |

- **Cap. 27:** a pré-oxigenação com alto fluxo ou VNI entrou pelo resumo da ATS 2026, conferido no PubMed em 14/11/2026.
- **Cap. 79:** a ESO 2025 já tem nota no cap. 39. Aqui entram só as linhas da varfarina, da dabigatrana e do antiagregante.
- **Cap. 82:** as linhas da AABB 2025 vêm dos resumos, como já está na ficha.
- **Doses:** nenhuma dose muda.
- **Migration:** `20270414000026`.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| IRpA hipoxêmica: alto fluxo ou VNI | alto fluxo primeiro (ficha) | ATS 2026: alto fluxo forte, VNI ou CPAP condicional |
| pré-oxigenação | DAS 2025 | ATS 2026 (forte): alto fluxo ou VNI |
| sangramento com apixabana | diretriz europeia 2023 (outra nota) | SBTH 2026: andexanete ou complexo protrombínico, com cautela no andexanete |
| carvão ativado no anticoagulado | diretriz brasileira de FA 2025 | SBTH 2026: até 4 h; manual < 2 h |
| hemoglobina no IAM | AABB 2025 | AABB 2025, com o manual ao lado |
| plaquetas na dengue | AABB/ICTMG 2025 | igual, com a fonte |
| adrenalina na hipotermia em PCR | "não encontrei" | ERC 2025: 1 mg só a partir de 30 °C |
| PA na hemorragia intracerebral (controle) | ESO 2025 | igual |

Duas respostas mudaram de verdade: a da hipotermia, que antes dava "não encontrei", e a da apixabana, que passou a citar o consenso brasileiro. As outras já vinham pela diretriz e agora trazem a fonte e o manual ao lado.

## Homologação

- Migration aplicada.
- 4 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.247, sem falha) e typecheck limpos.
- Não há tela nova.
