# Revisão do HCFMUSP, lote 3, N2: cap. 81, neutropenia febril (ABHH 2024 e MASCC 2026)

Decisão do RT de 14/11/2026 (N2 = A). Produção liberada pelo RT para os capítulos restantes do N2 nesta data, depois da homologação e do CI verde.

## Fontes

- **Consenso da ABHH 2024:** Nucci M, Arrais-Rodrigues C, Bergamasco MD, et al. Management of febrile neutropenia: consensus of the Brazilian Association of Hematology, Blood Transfusion and Cell Therapy - ABHH. Hematol Transfus Cell Ther 2024;46(Suppl 6):S346–S361 (PMID 39694764; PMC11726106).
  - Li o texto integral no PMC, pelo Chrome do RT.
  - É um consenso Delphi feito para **pacientes hematológicos**, sem graduação.
- **Consenso MASCC 2026:** Cooksley T, et al. Support Care Cancer 2026;34(8) (PMID 42525130). Os pontos entram pelo resumo do PubMed.

O lado do manual foi conferido no PDF do livro (cap. 81, p. 1062–1072).

## O que mudou na Central

- **Ficha `adulto-neutropenia-febril` 2026-11-14.1:** antes só tinha o manual.
  - Fontes `ABHH_NF_2024` e `MASCC_2026`.
  - `DIRETRIZ_NF`: 13 temas (11 da ABHH, 2 do MASCC).
  - `DIFERENCAS_NF`: 7 frases.
  - A tela ganha a tabela "ABHH 2024 e MASCC 2026 — ao lado do manual".
- **População em cada item.** Na primeira rodada da homologação, as respostas tratavam a ABHH como regra geral. Agora cada item da ABHH começa por "Em pacientes hematológicos", e o grau diz "consenso Delphi em pacientes hematológicos". A primeira diferença também avisa que o manual trata da neutropenia febril em geral.
- As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap81-neutropenia`:** 13 itens.
- **Migration** `20270414000011`.

## Diferenças principais

| Tema | ABHH 2024 (hematológicos) | Manual de 2022 |
|---|---|---|
| Febre | axilar > 38 °C | ≥ 37,8 °C sustentada por 1 h (p. 1062) |
| Empírico | cefepima ou piperacilina-tazobactam; carbapenêmico só com choque ou piora e ESBL | inclui meropenem entre as opções (p. 1069) |
| Vancomicina | não por mucosite, pneumonia, colonização por MRSA ou febre persistente | associar com mucosite e profilaxia com quinolona, entre outras (p. 1070) |
| Antifúngico | contra o empírico só pela febre de 4–7 dias; estratégia preemptiva | empírico na febre persistente de 4–7 dias (p. 1071–1072) |
| Suspensão | parar com a recuperação sem infecção documentada, mesmo febril, ou após 4 dias com sinais vitais normais | afebril ≥ 48 h e neutrófilos > 500 em ascensão (p. 1072) |
| Exames | sem radiografia de tórax nem urocultura de rotina | urina 1 e urocultura (p. 1065) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| carbapenêmico inicial | sim, meropenem ou imipenem (manual) | ABHH: não de rotina; cefepima ou piperacilina-tazobactam |
| vancomicina com mucosite | sim (manual) | ABHH: não por mucosite |
| antifúngico após 5 dias de febre | sim (manual) | ABHH: não só pela febre; estratégia preemptiva |
| quando parar | 48 h afebril e neutrófilos > 500 (manual) | ABHH: com a recuperação, mesmo febril, ou após 4 dias |
| quimioterapia com inibidor de checkpoint | MASCC (nota antiga) | MASCC 2026 (igual) |
| radiografia e urocultura | "não trata de urocultura" | ABHH: não de rotina |

As seis respostas abrem pela diretriz.

**Para o RT:** a ABHH foi feita para pacientes hematológicos. Na UPA, a neutropenia febril também chega com tumor sólido. As respostas agora dizem a população, mas a ABHH passa a abrir a resposta mesmo assim. Se o RT preferir que o manual abra fora da hematologia, isso é uma decisão dele.

## Homologação

- Migration aplicada.
- `adulto-neutropenia-febril.md` e `nota-hcfmusp-cap81-neutropenia.md` ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.234, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção (14/11/2026, com o "ok produção" do RT para os capítulos restantes)

- A migration `20270414000011` foi aplicada antes do merge. O #678 foi mesclado com o CI verde.
- O corpus foi gerado do master e os 2 arquivos foram ingeridos. A API foi reiniciada.
- Refiz as perguntas na produção. As seis abrem pela diretriz, e as da ABHH dizem "pacientes hematológicos".

## Decisão do RT sobre a população da ABHH (14/11/2026)

O RT decidiu: "dê a orientação e o plantonista segue com a que achar melhor e com mais evidências".

- A ABHH não fica restrita à hematologia.
- A resposta mostra a ABHH, com "em pacientes hematológicos", e o manual como diferença, cada um com a fonte.
- O plantonista escolhe. Nada muda no código.
