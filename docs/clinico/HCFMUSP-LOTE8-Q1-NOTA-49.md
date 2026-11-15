# Revisão do HCFMUSP, lote 8, Q1: nota do cap. 49 (dor abdominal)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 8 inteiro. Pela Q1, o cap. 49 ganha a nota a partir do que a ficha do Alvarado já traz. Nenhuma diretriz foi lida de novo.

## Fontes, já na ficha

- **WSES 2025 de apendicite:** Podda et al., JAMA Surg 2026;161(3):283–295 (PMID 41604201), pelo resumo. Está na ficha `alvarado` desde 06/11/2026.
- **Metanálise do escore AIR:** Andersson e Stark, World J Emerg Surg 2025;20(1):12 (PMID 39923099). Também está na ficha. Não é diretriz, e a nota diz isso.
- **Manual:** cap. 49 conferido no PDF, p. 689. O capítulo descreve a dor da apendicite e não traz escore.

## O que mudou na Central

- **Nota:** `nota-hcfmusp-cap49-dor-abdominal`, com 2 itens.
- **Fichas:** nenhuma muda.
- **Migration:** `20270414000046`.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| Alvarado ou AIR | "não traz o AIR" | WSES 2025 (escore com imagem) e metanálise do AIR (0,86 × 0,79) |
| imagem na suspeita de apendicite | "os trechos não trazem regra explícita" | WSES 2025: escore com imagem reduz a apendicectomia negativa |
| dor abdominal no idoso (controle) | manual | igual |

## Homologação

- A migration foi aplicada, e a nota está aguardando aprovação.
- A nota foi ingerida em 3 trechos, e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.

## Produção do #729, 14/11/2026

- A migration `20270414000046` foi aplicada antes do merge. O #729 foi mesclado com o CI verde.
- Foram ingeridos 1 arquivo, e a API foi reiniciada. O Vercel publicou o master.
- As três respostas saíram como na homologação.
