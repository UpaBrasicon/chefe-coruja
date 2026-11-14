# Revisão do HCFMUSP, lote 3, N2: cap. 65, hipoglicemia (ADA 2026 e Endocrine 2023)

Decisão do RT de 14/11/2026 (N2 = A). O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

O RT liberou a produção de todos os capítulos restantes do N2 nesta data ("ok em produção em tudo que produzir"). Cada um passa antes pela homologação e pelo CI verde.

## Fontes

- **ADA 2026, seção 6:** American Diabetes Association Professional Practice Committee. 6. Glycemic Goals, Hypoglycemia, and Hyperglycemic Crises: Standards of Care in Diabetes—2026. Diabetes Care 2026;49(Suppl 1):S132–S149 (PMID 41358894; PMC12690178).
  - Li o texto integral no PMC, pelo Chrome do RT: recomendações 6.10 a 6.20, Tabela 6.4 e o texto sobre tratamento e glucagon.
  - A seção é quase toda de cuidado ambulatorial. Ela não dá dose de glicose EV.
- **Endocrine Society 2023:** McCall AL, Lieb DC, Gianchandani R, et al. Management of Individuals With Diabetes at High Risk for Hypoglycemia. J Clin Endocrinol Metab 2023;108(3):529–562 (PMID 36477488).
  - Trata da prevenção, quase toda fora do hospital. Entrou pelo resumo do PubMed, com dois itens: glucagon sem reconstituição e programas de manejo glicêmico na internação.

O lado do manual foi conferido no PDF do livro (cap. 65, p. 877–881).

## O que mudou na Central

- **Ficha `adulto-hipoglicemia` 2026-11-14.1:** antes só tinha o manual.
  - Fontes `ADA_HIPOGLICEMIA_2026` e `ENDOCRINE_HIPOGLICEMIA_2023`.
  - `DIRETRIZ_HIPOGLICEMIA`: 9 temas.
  - `DIFERENCAS_HIPOGLICEMIA`: 4 frases.
  - A tela ganha a tabela "ADA 2026 e Endocrine 2023 — ao lado do manual".
- As doses do manual não mudam: glicose 50% 60–100 mL, glucagon 1–2 mg IM e tiamina 100 mg.
- **Nota `nota-hcfmusp-cap65-hipoglicemia`:** 9 itens.
- **Migration** `20270414000010`.
- O gerador do corpus põe o módulo `glicemia.ts` também nas fichas de CAD/EHH. Por isso os arquivos delas foram reingeridos, sem versão nova.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Limiar | níveis 1 (< 70), 2 (< 54) e 3 (evento grave) (ADA) | < 70 com DM; < 45 ou < 50 sem DM (p. 877, 881) |
| Consciente | glicose oral 15 g, repetir em 15 min (ADA, B) | só glicose 50% EV e glucagon IM (p. 880) |
| Glucagon | preparações sem reconstituição, como a nasal 3 mg (ADA B; Endocrine, forte) | 1–2 mg IM (p. 880) |
| Depois do episódio | reavaliar e reduzir as medicações após nível 2 ou 3 (ADA, B) | observar 12–24 h no diabético de alto risco (p. 880) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| glicose oral no consciente | "não encontrei" | ADA: 15 g e repetir em 15 min |
| níveis 1, 2 e 3 | "não encontrei" | ADA: Tabela 6.4 |
| glucagon nasal | "o material não traz" | ADA e Endocrine: nasal 3 mg, sem reconstituição |
| acarbose | "não encontrei" | ADA: só glicose pura |
| medicação depois do episódio grave | "não trata" | ADA: reavaliar e reduzir |
| dose de glicose 50% | manual: 60–100 mL | igual, pelo manual (a ADA não dá dose EV) |

Cinco de seis respostas passam a abrir pela diretriz. A da glicose 50% continua pelo manual, como esperado.

## Homologação

- Migration aplicada.
- `adulto-hipoglicemia.md`, `adulto-cad-ehh-avaliacao.md`, `adulto-cad-ehh-tratamento.md` e `nota-hcfmusp-cap65-hipoglicemia.md` ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.233, sem falha) e typecheck limpos.
- A tela não foi vista com login.
