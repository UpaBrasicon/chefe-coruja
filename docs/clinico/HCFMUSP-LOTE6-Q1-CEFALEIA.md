# Revisão do HCFMUSP, lote 6, Q1: nota do cap. 41 (cefaleia)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q1, o cap. 41 ganha a nota a partir da ficha `adulto-cefaleia`. A ficha já traz a AHS 2025, e nenhuma diretriz foi lida de novo.

## Fonte

- **AHS 2025:** Robblee et al., Headache 2026;66(1):53–76 (PMID 41321235).
  - Os níveis de recomendação para a crise de migrânea no PS já estavam na ficha desde 27/10/2026, lidos no resumo e sem dose.
- **Manual:** conferi no PDF a p. 573 do cap. 41. O capítulo não cita proclorperazina, bloqueio de nervo, valproato nem opioide.

## O que mudou na Central

- **Nota `nota-hcfmusp-cap41-cefaleia`:**
  - 5 itens, um por nível da AHS 2025;
  - cada item tem, ao lado, o que o manual diz (p. 573).
- **Coluna do manual:** escrita em `MANUAL_AHS_2025`. As linhas da diretriz vêm de `AHS_2025_NIVEIS`, da ficha.
- **Migration:** `20270414000034`.

A SNNOOP10 (2019) e o consenso da SBCe (2000) ficaram fora da nota, porque não são mais novos que o manual. Os dois continuam na ficha.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| proclorperazina na crise | "o material não traz" | AHS 2025: nível A, deve oferecer |
| opioide na crise | AHS 2025, pela ficha | AHS 2025: nível A, não deve oferecer; o manual não cita opioide |
| dexametasona | consenso da SBCe 2000 | AHS 2025: nível C, pode oferecer; manual: 10 mg EV no risco de recidiva |
| bloqueio do nervo occipital maior | AHS 2025, pela ficha | AHS 2025: nível A, com o manual ao lado |
| paracetamol EV | "o material não traz" | AHS 2025: nível C, não deveria oferecer |
| cefaleia em trovoada (controle) | manual e ficha | igual |

Na homologação, as cinco perguntas de tratamento passam a abrir pela diretriz. A pergunta de controle não mudou.

## Homologação

- A migration foi aplicada, e a nota está aguardando aprovação.
- O arquivo foi ingerido em 6 trechos, e a API foi reiniciada.
- Os testes da nota (37) passam.
