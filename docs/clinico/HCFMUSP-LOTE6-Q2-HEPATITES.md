# Revisão do HCFMUSP, lote 6, Q2: cap. 60 (hepatites graves)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q2, o cap. 60 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fontes

- **ACG 2023, insuficiência hepática aguda:** Shingina et al., Am J Gastroenterol 2023;118(7):1128–1153 (PMID 37377263).
  - Lida no texto integral pelo Chrome do RT (Ovid), sem CAPTCHA.
  - As 10 recomendações GRADE foram copiadas do texto, com força e qualidade da evidência.
- **ACG 2024, hepatite alcoólica:** já estava na ficha do Maddrey desde 06/11/2026. A nota reaproveita o mesmo texto.
- **Manual:** cap. 60 conferido no PDF, p. 817–819 (manejo e Tabela 5).

## O que mudou na Central

- **Ficha `adulto-encefalopatia-hepatites-graves`, versão 2026-11-14.2:**
  - nova lista `DIRETRIZ_IHA_2023`, com 10 temas e o manual ao lado;
  - na tela, um bloco novo: "ACG 2023 (insuficiência hepática aguda) — ao lado do manual";
  - as contas do manual não mudaram (acetilcisteína, plasma, King's College).
- **A versão .1** dessa ficha (ACG 2026 da encefalopatia, lote 4) ainda espera aprovação. A .2 inclui as duas diretrizes, e é ela que deve ser aprovada.
- **Nota `nota-hcfmusp-cap60-hepatites-graves`:** 11 itens, 10 da ACG 2023 e 1 da ACG 2024 (hepatite alcoólica).
- **Migration:** `20270414000039`.

## Onde a diretriz difere do manual

| Tema | ACG 2023 | Manual |
|---|---|---|
| Coagulopatia sem sangramento | não corrigir de rotina (condicional, muito baixa) | plasma só no sangramento; INR alterado sem sangramento não indica plasma (mesma direção) |
| Antibiótico profilático | não usar de rotina (condicional, baixa) | limiar baixo para suspeitar e tratar infecção |
| Hipotensão | noradrenalina primeiro (forte, moderada); depois vasopressina | reposição volêmica cuidadosa, em geral com albumina |
| Hiperamonemia | TRS contínua precoce na encefalopatia grau ≥ 2 (condicional, muito baixa) | lactulose; monitorizar a PIC |
| Acetilcisteína sem paracetamol | iniciar EV (forte, moderada) | só no paracetamol |
| Hepatite B | reativação: entecavir ou tenofovir (forte, baixa) | hepatite B aguda: sem evidência para antiviral; não fala da reativação |
| Cogumelo | silibinina EV; penicilina G se não houver | diurese forçada e carvão ativado |
| Prognóstico | King's College ou MELD > 25 | King's College |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| plasma para INR sem sangramento | manual (não) | ACG 2023 com o manual; mesma direção |
| antibiótico profilático | "os trechos não tratam" | ACG 2023: não de rotina |
| acetilcisteína sem paracetamol | "os trechos não trazem" | ACG 2023: iniciar EV |
| transplante: MELD ou King's College | só King's College | ACG 2023: encaminhar cedo; King's College ou MELD > 25 |
| vasopressor | "não encontrei" | ACG 2023: noradrenalina, depois vasopressina |
| cogumelo Amanita | só diurese e carvão (manual) | ACG 2023: silibinina, com o manual ao lado |
| hepatite alcoólica (controle) | ACG 2024 pela ficha do Maddrey | igual |

## Homologação

- A migration foi aplicada, e as fichas estão aguardando aprovação.
- A ficha foi ingerida em 50 trechos e a nota em 12. A API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.

## Produção do #718, 14/11/2026

- A migration `20270414000039` foi aplicada antes do merge. O #718 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As sete respostas saíram como na homologação.
