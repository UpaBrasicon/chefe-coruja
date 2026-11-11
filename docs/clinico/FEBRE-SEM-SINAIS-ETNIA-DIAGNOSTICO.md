# Febre sem sinais localizatórios: etnia na coleta de urina — diagnóstico

**Origem.** Pedido do RT de 11/11/2026: "Sim, registrar". É o item 7 de "Pedidos do RT em 11/11/2026" no `BACKLOG.md`.

**O achado.** Saiu da ITU com a AAP 2026 (#613). Na ITU, o RT decidiu tirar a etnia da avaliação de quem testar (I5 = A). A ferramenta de febre sem sinais localizatórios faz a mesma pergunta, "coletar urina?", e ainda conta a etnia.

**Escopo.** Este documento é só diagnóstico: nenhum código, corte ou texto da tela muda aqui.

**Fontes lidas:**
- o código no `master` de 11/11/2026;
- o diagnóstico da ITU, `docs/clinico/ITU-AAP-2026-DIAGNOSTICO.md`, onde estão os PDFs da AAP 2026 que o RT entregou (CPG Pediatrics 2026;158(4):e2026078565 e RT-diag e2026078566);
- o livro do ICr (cap. 45, p. 462), conferido pelo que o código cita. **O livro não foi reaberto.**

---

## Resposta curta

- A ferramenta decide se coleta urina pelos critérios do livro do ICr (cap. 45, p. 462).
  - **Menina:** coleta com 2 ou mais fatores, e "Etnia branca" é um deles.
  - **Menino acima de 6 meses:** "Raça não branca" é um dos 4 critérios. Coleta com 3 deles se for circuncidado, ou com 2 se não for.
- São os critérios da AAP de 2011, que o livro reproduz. A AAP 2026 tirou a raça da avaliação de risco, por unanimidade, por ser provável confundidor (CPG p. 5).
- A ferramenta da ITU já usa a lista nova da Figura 2 da AAP 2026 (CPG p. 28), sem raça e sem número mínimo de fatores (`FATORES_FIGURA2` em `src/clinico/pediatria/ituPed.ts:89–93`). As duas telas hoje respondem diferente à mesma pergunta.
- Nenhuma dose está em jogo.

---

## Como está hoje

- **Fatores da menina:** `src/clinico/pediatria/febreSemSinaisPed.ts:85–92` (`FATORES_MENINA`). São eles:
  - menor de 12 meses;
  - temperatura > 39 °C;
  - **etnia branca**;
  - ausência de outro foco de febre;
  - febre por mais de 48 h.
- **Critérios do menino acima de 6 meses:** `febreSemSinaisPed.ts:94–101` (`CRITERIOS_MENINO`). São eles:
  - temperatura > 39 °C;
  - febre por mais de 1 dia;
  - ausência de outro foco;
  - **raça não branca**.
- **Regra (`coletaUrina`, `febreSemSinaisPed.ts:103–116`):**
  - menina coleta com 2 ou mais fatores;
  - menino abaixo de 6 meses coleta se T > 39 °C;
  - menino acima de 6 meses coleta com 3 de 4 critérios se circuncidado, ou 2 de 4 se não;
  - aos 6 meses exatos a regra fica indefinida.
- **Tela:** `src/pages/plantonista/pediatria/FebreSemSinaisPed.tsx:39` e o bloco que lista os fatores.
- **Testes:** `src/clinico/pediatria/febreSemSinaisPed.test.ts:35–40`. Um deles conta "branca" como fator.
- **Ficha:** `ped-febre-sem-sinais`, versão 2026-10-25.1 (`febreSemSinaisPed.ts:32–37`).

---

## O que a fonte diz (AAP 2026, pelo diagnóstico da ITU)

- **Raça (CPG p. 5):** saiu da estratificação de risco.
- **Quem testar, de 2 a 24 meses (Figura 2, CPG p. 28):**
  - entra no fluxograma quem tem febre ≥ 39 °C, bom estado geral e nenhum foco;
  - fatores de risco: menos de 12 meses, menina, menino não circuncidado, ITU prévia, nenhuma outra fonte de febre, febre ≥ 48 h;
  - em vez de contar fatores, pode-se usar o UTICalc;
  - **a figura não dá número mínimo de fatores.**
- **De 8 a 60 dias (Figura 1, p. 27):** outro fluxo. A ferramenta já mostra a AAP 2021 e o PECARN nessa faixa.
- **Faixa da diretriz:** 8 dias a 5 anos, em criança sem complexidade médica.

---

## Comparação

| # | Ponto | Ferramenta hoje (livro, p. 462) | AAP 2026 | Efeito |
|---|---|---|---|---|
| F1 | Raça | "Etnia branca" na menina; "raça não branca" no menino | Fora da avaliação (CPG p. 5) | **Muda a tela** |
| F2 | Contagem | Menina ≥ 2; menino > 6 m: 3 de 4 (circuncidado) ou 2 de 4 | Sem número mínimo; pesar os fatores ou usar o UTICalc (p. 28) | **Muda a tela** |
| F3 | Fatores | Menina e menino em listas separadas; "febre > 1 dia" no menino | Uma lista só: < 12 meses, menina, menino não circuncidado, ITU prévia, sem outra fonte, febre ≥ 48 h | **Muda a tela** |
| F4 | Menino < 6 meses | Coleta se T > 39 °C | Na Figura 2, a entrada já é febre ≥ 39 °C; menino não circuncidado é fator | Diverge |
| F5 | Doses | Livro e Apêndice | A AAP não traz dose | Não muda |

---

## Opções

**A. Mesma resposta da ITU (recomendada).** De 2 a 24 meses, a pergunta "coletar urina?" passa a usar a lista da Figura 2 da AAP 2026:
- reaproveita `FIGURA2_ENTRADA`, `FATORES_FIGURA2` e `NOTA_FIGURA2` da ITU, para as duas telas dizerem o mesmo;
- não dá número mínimo: mostra os fatores marcados e a nota de que a decisão é do médico, com o UTICalc;
- sai a etnia, e com ela a contagem do livro, porque os cortes do livro foram feitos com a etnia dentro;
- o critério do livro fica visível como texto de referência, sem a etnia, com a nota de que a AAP 2026 o substituiu nessa faixa;
- abaixo de 2 meses nada muda: a ferramenta já segue a AAP 2021 e o PECARN.

É o mesmo caminho do I5 da ITU e do CKD-EPI sem campo de raça (revisão PubMed, item 9).

**B. Tirar só a etnia e manter a contagem do livro.** Não recomendada: a contagem "2 ou mais" e "3 de 4" ficaria sem fonte, porque foi calculada com a etnia como um dos fatores.

**C. Manter o livro e pôr uma nota** dizendo que a AAP 2026 tirou a raça e não dá número mínimo. A tela continua contando a etnia.

---

## Impacto se o RT escolher A

- **Código:** mudam `FATORES_MENINA`, `CRITERIOS_MENINO` e `coletaUrina` (`febreSemSinaisPed.ts:85–116`), a tela (`FebreSemSinaisPed.tsx`, linha 39 e o bloco dos fatores) e os testes de `febreSemSinaisPed.test.ts:35–40`.
- **Ficha:** versão nova, com a AAP 2026 nas fontes e uma migration de ficha, que entra aguardando aprovação.
- **O que não muda:** nenhuma dose. Nenhuma migration além da ficha.

---

## Decisão do RT

| # | Pergunta | Recomendação | Decisão do RT |
|---|---|---|---|
| F1–F4 | Coleta de urina de 2 a 24 meses na febre sem sinais | A | A (RT, 11/11/2026) |

---

## Não conferido

1. O cap. 45 do livro do ICr não foi reaberto. Os critérios vêm do código, que cita a p. 462.
2. O UTICalc não foi aberto.
3. Se o livro tira os critérios da AAP de 2011 ou de outra fonte. O formato (etnia, circuncisão, 2 ou mais na menina) é o da Tabela 2 de 2011, mas a citação do livro não foi lida.
