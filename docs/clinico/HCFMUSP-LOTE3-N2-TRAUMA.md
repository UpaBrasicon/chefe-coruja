# Revisão do HCFMUSP, lote 3, N2: cap. 47, atendimento inicial do politraumatizado (europeia 2023 e EAST 2025)

Decisão do RT de 14/11/2026 (N2 = A). O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

## Fontes

- **Diretriz europeia de sangramento no trauma, 6ª edição:** Rossaint R, Afshari A, Bouillon B, et al. Crit Care 2023;27(1):80 (PMID 36859355; PMC9977110).
  - Li o texto integral no PMC, pelo Chrome do RT.
  - São 39 recomendações, cada uma com grau: 1 = recomenda, 2 = sugere; A a C = qualidade.
- **EAST 2025 de ácido tranexâmico:** Dumas RP, Succar BE, Vella MA, et al. J Trauma Acute Care Surg 2025;99(5):785–794 (PMID 40956301).
  - O texto é pago. Pelo Chrome só abriu o resumo, então as recomendações entram pelo resumo do PubMed, marcadas "lido no resumo".
  - As três recomendações do resumo: ácido tranexâmico de rotina no pré-hospitalar e no hospital (condicional); também na hipotensão grave (condicional); nenhuma recomendação sobre bolus inicial maior.

O lado do manual foi conferido no PDF do livro (cap. 47, p. 639–649).

## O que mudou na Central

- **Ficha `adulto-trauma-inicial` 2026-11-14.1:**
  - fontes `EUROPEIA_SANGRAMENTO_TRAUMA_2023` e `EAST_TXA_2025`;
  - `DIRETRIZ_TRAUMA`: 23 temas (22 da europeia, 1 da EAST), com grau, fonte e página do manual;
  - `DIFERENCAS_TRAUMA`: 6 frases;
  - a tela do politraumatizado ganha a tabela "Europeia 2023 e EAST 2025 — ao lado do manual".
- As doses da diretriz aparecem ao lado do manual, com a fonte:
  - fibrinogênio 3–4 g;
  - vitamina K 5–10 mg;
  - CCP 25–50 UI/kg;
  - idarucizumabe 5 g.
- As doses e contas do manual não mudam. O ácido tranexâmico, a PAS/PAM alvo e o vasopressor coincidem com o manual.
- A linha do REBOA (europeia, 2C) avisa que o UK-REBOA (2023) veio depois da busca da diretriz e não mostrou benefício. A nota dos ensaios sem benefício, que já estava na ficha, continua.
- **Nota `nota-hcfmusp-cap47-trauma`:** 23 itens.
- **Migration** `20270414000009`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | Europeia 2023 | Manual de 2022 |
|---|---|---|
| Transfusão maciça | fibrinogênio ou crio com hemácias, ou plasma:hemácias ≥ 1:2 (1C); plaquetas em proporção alta (2B) | 1:1:1 (p. 647) |
| Metas laboratoriais | Hb 7–9; fibrinogênio > 1,5 g/L; plaquetas > 50.000 (> 100.000 no TCE); cálcio iônico normal | não traz |
| Fluido | SF ou balanceado; evitar Ringer lactato no TCE grave (1B); restringir coloides | alíquotas de 250–500 mL; transfusão após 1–3 L se instável (p. 646–647) |
| Gravidade | índice de choque e pressão de pulso (1C) | escore ABC > 2 (p. 647) |
| Anticoagulados | CCP + vitamina K na varfarina (1A); andexanete ou CCP no anti-Xa; idarucizumabe 5 g | não traz no cap. 47 |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| fibrinogênio e crioprecipitado | ficha de transfusão: fibrinogênio < 150–200 mg/dL; 1 unidade/10 kg | europeia: ≤ 1,5 g/L; 3–4 g ou 15–20 unidades |
| transfusão maciça | 1:1:1 (manual) | europeia: fibrinogênio/crio ou ≥ 1:2; o manual como diferença |
| varfarina no trauma | tabela geral de reversão | europeia: CCP precoce + vitamina K 5–10 mg; tabela geral ao lado |
| cálcio na transfusão maciça | "o material não traz conduta" | europeia (1C): cálcio iônico normal, cloreto de cálcio |
| Ringer lactato no TCE grave | "não encontrei" | europeia (1B): evitar |
| alvo de Hb | "não encontrei" | europeia (1C): 7–9 g/dL |

As seis respostas passam a abrir pela diretriz. Na primeira rodada da homologação, o Ringer ainda dava "não encontrei": o assunto estava dentro da linha de fluidos. Ele foi para uma linha própria e a resposta passou a abrir pela diretriz, como no caso da TSV no lote 2.

## Homologação

- Migration aplicada.
- `adulto-trauma-inicial.md` e `nota-hcfmusp-cap47-trauma.md` (24 trechos) ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.232, sem falha) e typecheck limpos na árvore da homologação.
- A tela não foi vista com login.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000009`.
2. Copiar e ingerir os 2 arquivos.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.
