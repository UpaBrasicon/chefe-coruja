# ITU na criança: diretriz da AAP 2026 — diagnóstico

Origem: pedido do RT em 11/11/2026. É o item 10 da revisão PubMed no `BACKLOG.md` ("Pendente: limiares novos de piúria e urocultura (texto integral bloqueado; a ferramenta segue com os do livro)"). O RT entregou os dois PDFs nesse dia.

Fontes lidas, texto completo:
- Diretriz: Alverson BK, Hains DS, Downs SM, et al. Clinical Practice Guideline for the Diagnosis and Treatment of Urinary Tract Infection in Children From 8 Days to 5 Years of Age. Pediatrics. 2026;158(4):e2026078565. PMID 42803578. 78 páginas no PDF. Neste documento: "CPG".
- Relatório técnico do diagnóstico: Forster CS, Nelson C, El Feghaly R, et al. Urinary Tract Infection Diagnosis — A Companion to the AAP 2026 Clinical Practice Guideline: Technical Report. Pediatrics. 2026;158(4):e2026078566. PMID 42803592. 16 páginas. Neste documento: "RT-diag".

Os PDFs ficam com o RT; não foram copiados para o repositório.

Este documento é só diagnóstico. Nenhum código, dose, corte ou texto da tela muda aqui.

Como foi feito (11/11/2026):
- No CPG foram lidos a lista de recomendações (p. 2–4), a introdução e a Tabela 1 (p. 4–5), a avaliação e o diagnóstico (p. 11–14), o tratamento (p. 14–16) e os fluxogramas (Figuras 1 a 3, p. 27–29). Os apêndices de evidência não foram lidos linha a linha.
- O RT-diag foi lido inteiro, menos os gráficos de floresta do apêndice.
- O app foi conferido no `master` de 11/11/2026 (0bbe958f): `src/clinico/pediatria/ituPed.ts`, `src/clinico/pediatria/ituPed.test.ts` e `src/pages/plantonista/pediatria/InfeccaoUrinariaPed.tsx`.
- Os valores do livro (Pronto-Socorro do ICr-HCFMUSP, cap. 57) foram tirados do código, que cita a página. O livro não foi reaberto.
- Regras do projeto que valem aqui: pediatria até 13a 11m 29d; dose só de fonte citada e lida; nada passa do adulto para a criança.

---

## Resposta curta

- A AAP 2026 vale de 8 dias a 5 anos, em criança sem complexidade médica. A ferramenta vai até 13a 11m 29d. Fora de 8 dias a 5 anos, o livro continua sendo a referência.
- A urocultura por sonda passa a ser positiva com **≥ 10.000 UFC/mL** de um uropatógeno. A tela ainda mostra 50.000, atribuído à AAP (é o número de 2011).
- A piúria passa a ser **obrigatória** para o diagnóstico, com limiar por idade e conforme a urocultura esteja pendente ou pronta. A tela não pede piúria para ler a urocultura.
- A AAP tirou a etnia da avaliação de risco. A Tabela 2 da tela ainda conta "etnia branca" e "etnia não branca".
- A AAP não traz dose de antibiótico. As doses do livro não mudam.

---

## Como está hoje

- Fontes e aviso da AAP 2026: `ituPed.ts:10–34`. O aviso (linhas 28–34) diz, na linha 31, que os números novos não foram conferidos. A tela mostra o aviso em `InfeccaoUrinariaPed.tsx:40`.
- Tabela 2 do livro (é a da AAP 2011): fatores em `ituPed.ts:47–48` (com etnia) e contagem em `ituPed.ts:57–62`. Tela em `InfeccaoUrinariaPed.tsx:44–54`. Teste em `ituPed.test.ts:11–18`.
- Leitura da urocultura: `ituPed.ts:70–79`. Teste em `ituPed.test.ts:20–27`.
  - Saco coletor não serve para urocultura (linha 72; livro p. 594).
  - Mais de um germe: contaminação (linha 73).
  - Abaixo de 10.000 UFC/mL: contaminação, "exceto na PSP, em que outras diretrizes aceitam qualquer contagem" (linha 74).
  - Jato médio: ≥ 100.000 UFC/mL (linha 75; livro p. 595).
  - Sondagem ou PSP: ≥ 50.000 UFC/mL, escrito como "critério da AAP"; entre 10.000 e 50.000, "abaixo do critério da AAP" (linhas 76–78; livro p. 594).
  - A leitura não usa idade nem piúria.
- Leucocitúria do livro: ≥ 5/campo em urina centrifugada ou ≥ 10/mm³ em urina não centrifugada (`ituPed.ts:81–82`; livro p. 593). Tela em `InfeccaoUrinariaPed.tsx:57`.
- Antibióticos orais e parenterais do livro: `ituPed.ts:86–112` (Tabelas 3 e 4, p. 597–598).
- Quadro 3 (parenteral e internação na pielonefrite): `ituPed.ts:115–125`. A linha 116 diz "idade inferior a 2 meses (considerar menos de 3 meses)".
- Duração: `ituPed.ts:129`. Pielonefrite 7 a 14 dias, em geral 10. Cistite esporádica 5 a 7 dias. Cistite de repetição 10 dias.
- Recém-nascido: sem dose no capítulo, bloqueado (`ituPed.ts:7–8`).

---

## O que a fonte diz

**Público (CPG p. 1 e 4)**
- 8 dias a 5 anos, baixa complexidade médica. Ficam de fora bexiga neurogênica, imunodepressão, prematuridade extrema, anomalia congênita conhecida do rim e das vias urinárias, outras anomalias congênitas maiores, doença multissistêmica e doença crônica grave.

**Definição de ITU (CPG Tabela 1, p. 5; RT-diag Tabela 1, p. 2)**

Três domínios: sintomas, inflamação e urocultura (RT-diag p. 1). A tabela:

| Idade | ITU provável, urocultura pendente | Inflamação, urocultura pronta | Urocultura | Coleta |
|---|---|---|---|---|
| 0 a < 2 meses | ≥ 5 leucócitos/campo ou esterase ≥ traços | ≥ 5 leucócitos/campo ou esterase ≥ traços (qualquer coleta) | ≥ 10.000 UFC/mL de patógeno | Sonda ou punção suprapúbica |
| 2 meses a 5 anos | ≥ 10 leucócitos/campo ou esterase ≥ 2+ | ≥ 5 leucócitos/campo ou esterase ≥ 1+ (qualquer coleta) | ≥ 10.000 UFC/mL de patógeno | Sonda |
| | | | ≥ 100.000 UFC/mL | Jato médio |

- "Campo" é campo de grande aumento (hpf). A contagem é em urina **não centrifugada** (RT-diag p. 4, nota das Tabelas 2 e 3; p. 6). O CPG, na p. 13, escreve de forma ambígua ("unspun vs centrifuged").
- Os limiares da urinálise são apoio à decisão, não regra absoluta. Com probabilidade pré-teste alta (lactente com aspecto de doente), pode-se colher urocultura e tratar mesmo com urinálise duvidosa. Com probabilidade baixa, urinálise duvidosa ajuda a excluir (nota "a" da Tabela 1).
- Saco coletor não serve para diagnosticar ITU. Se a urinálise do saco passa dos limiares, isso basta para colher por sonda (RT-diag, nota "b" da Tabela 1, p. 2).
- A urocultura positiva é exigida. Urocultura negativa: não tratar ou suspender o antibiótico empírico (RT-diag p. 6).
- Mais de um germe ou germe que não é uropatógeno: em geral contaminação (CPG p. 13; RT-diag p. 7). A lista de uropatógenos está na Tabela 4 do RT-diag (p. 6).
- O corte de 50.000 UFC/mL da AAP 2011 caiu para 10.000 na sonda. O jato médio fica em 100.000 por causa da contaminação (CPG p. 13; RT-diag p. 7).
- Nitrito tem baixa sensibilidade e alta especificidade. Mostra bactéria, não inflamação; não separa bacteriúria assintomática de ITU (CPG p. 13; RT-diag p. 5).

**Raça (CPG p. 5)**
- O painel tirou a raça da estratificação de risco, por unanimidade, por ser provável confundidor.

**Quem testar, 2 a 24 meses (CPG Figura 2, p. 28)**
- Febre ≥ 39 °C, bom estado geral, sem foco. Fatores de risco: menos de 12 meses, menina, menino não circuncidado, ITU prévia, sem outra fonte de febre, febre ≥ 48 h. Ou usar o UTICalc. A figura não dá número mínimo de fatores.
- Urinálise com ≥ 5/campo ou esterase ≥ 1+: colher urocultura por sonda. Com ≥ 10/campo ou esterase ≥ 2+: antibiótico presuntivo. Urocultura ≥ 10.000 de patógeno: tratar 5 a 7 dias.
- 8 a 60 dias (Figura 1, p. 27): febre ≥ 38,0 °C; menos de 22 dias vai direto para urocultura por sonda e antibiótico, como na diretriz do lactente febril. Urocultura ≥ 10.000: tratar mais de 7 dias.
- Mais de 24 meses a 5 anos (Figura 3, p. 29): urocultura positiva com ≥ 10.000 por sonda ou ≥ 100.000 por jato médio; tratar 5 a 7 dias.

**Recomendações (KAS) que importam no pronto-socorro**
- KAS 1 (p. 2 e 11): avaliar em até 72 h do início dos sintomas. Condicional, certeza baixa.
- KAS 2 (p. 2 e 14): curso de 7 dias ou menos. Condicional, certeza baixa. Observações:
  - 2 anos ou mais, sem anomalia, cistite sem febre: 3 a 5 dias.
  - 2 a 24 meses: 5 a 7 dias.
  - 2 anos ou mais com quadro de pielonefrite (p. ex., febre ≥ 39 °C): 5 a 7 dias.
  - Mais de 7 dias pode ser dado de 8 dias a 2 meses, com anomalia urinária, com bacteremia ou sem resposta ao curso inicial.
- KAS 3A (p. 2 e 15): 8 a 28 dias, antibiótico parenteral com troca precoce para oral. Condicional, certeza muito baixa.
- KAS 3B (p. 2 e 15): mais de 28 dias e menos de 5 anos, oral em vez de parenteral ou sequencial com internação. **Forte**, certeza muito baixa. Se houver dúvida de a família conseguir o remédio oral logo, pode-se dar uma dose parenteral antes (p. 3).
- Escolha empírica (p. 16): preferir espectro estreito. Sem doença grave, cefazolina ou cefalexina se a sensibilidade local passar de 80% a 85%. Alternativas pela resistência local: ceftriaxona, cefixima, sulfametoxazol-trimetoprima ou ciprofloxacina. **Não há dose.**
- KAS 4 a 6 (p. 3 e 17–21): ultrassom de rins e bexiga na primeira ITU febril; sem uretrocistografia de rotina; sem profilaxia contínua no refluxo de baixo risco. São condutas de seguimento.

---

## Comparação

| # | Ponto | Ferramenta hoje | AAP 2026 | Efeito |
|---|---|---|---|---|
| I1 | Urocultura por sonda | ≥ 50.000, "critério da AAP"; 10.000–50.000 "abaixo do critério" (`ituPed.ts:76–78`) | ≥ 10.000 de um uropatógeno (CPG p. 5 e 13; RT-diag p. 7) | **Muda a tela** |
| I2 | Punção suprapúbica | ≥ 50.000; "outras diretrizes aceitam qualquer contagem" (`ituPed.ts:74` e `:76–78`) | ≥ 10.000; na Tabela 1 a punção só aparece na linha de 0 a < 2 meses (CPG p. 5) | **Muda a tela** |
| I3 | Jato médio | ≥ 100.000 em qualquer idade (`ituPed.ts:75`) | ≥ 100.000, mas só na linha de 2 meses a 5 anos; abaixo de 2 meses, só sonda ou punção (CPG p. 5) | **Muda a tela** (só abaixo de 2 meses) |
| I4 | Piúria | Limiar do livro só como texto: ≥ 5/campo centrifugada ou ≥ 10/mm³ (`ituPed.ts:81–82`); a leitura da urocultura não pede piúria (`ituPed.ts:70–79`) | Piúria obrigatória, com limiar por idade e por urocultura pendente ou pronta; leucócitos/campo em urina não centrifugada (Tabela 1) | **Muda a tela** |
| I5 | Quem testar | Tabela 2 de 2011 com etnia e contagem de fatores (`ituPed.ts:47–62`) | Sem raça; lista de fatores sem número mínimo, ou UTICalc (CPG p. 5 e 28) | **Muda a tela** |
| I6 | Aviso da AAP | "Os números novos não foram conferidos" (`ituPed.ts:31`) | Números lidos em 11/11/2026 | **Muda a tela** |
| I7 | Duração | Pielonefrite 7–14 dias, em geral 10; cistite 5–7; repetição 10 (`ituPed.ts:129`) | 7 dias ou menos; 3–5, 5–7 ou mais de 7 conforme o grupo (KAS 2) | Diverge |
| I8 | Via | Quadro 3: menos de 2 meses (considerar 3) é critério de parenteral (`ituPed.ts:116`) | Oral a partir de 29 dias (KAS 3B, forte); parenteral com troca precoce de 8 a 28 dias (KAS 3A) | Diverge |
| I9 | Escolha empírica | Tabelas 3 e 4 do livro, sem ordem de preferência (`ituPed.ts:86–112`) | Cefazolina ou cefalexina primeiro, se a sensibilidade local permitir; sem dose (CPG p. 16) | Diverge (sem dose) |
| I10 | Saco coletor | Não serve para urocultura; só para análise (`ituPed.ts:72`) | Igual; urinálise do saco acima do limiar basta para colher por sonda (RT-diag p. 2) | Não muda o número |
| I11 | Doses | Livro e Apêndice (`ituPed.ts:86–112`) | A AAP não traz dose | Não muda |
| I12 | Imagem e profilaxia (KAS 4 a 6) | A tela não mostra | Seguimento | Não se aplica |
| I13 | Avaliar em até 72 h (KAS 1) | Já está no aviso (`ituPed.ts:32`) | Igual | Não muda |

---

## Opções

Para cada divergência:
- A: aplicar o valor da AAP 2026 na faixa de 8 dias a 5 anos, citando a página. Fora dessa faixa, o livro.
- B: manter o livro e mostrar a AAP 2026 como nota.
- C: não mudar nada.

Em todas as opções A, a criança acima de 5 anos (até 13a 11m 29d) e o recém-nascido de até 7 dias continuam com o livro. A tela precisaria saber a idade.

**I1. Sonda.** Recomendada: **A**. A tela atribui hoje à AAP um número que a AAP abandonou. O RT já decidiu, em 09/10/2026, que a AAP 2026 substitui a de 2011 que o livro cita. Na faixa de 8 dias a 5 anos, ≥ 10.000 de um uropatógeno, com piúria (I4).

**I2. Punção suprapúbica.** Recomendada: **A**. ≥ 10.000, como a sonda. A nota diz que a Tabela 1 só põe a punção na linha de menos de 2 meses e que o texto (CPG p. 13; RT-diag p. 7) fala em "sonda ou punção" sem separar idade. Sai a frase "outras diretrizes aceitam qualquer contagem".

**I3. Jato médio abaixo de 2 meses.** Recomendada: **A**. Abaixo de 2 meses a leitura avisa que a AAP só aceita sonda ou punção para a urocultura. O número de 100.000 não muda.

**I4. Piúria.** Recomendada: **A**. É o centro da definição nova. A leitura da urocultura passa a pedir a urinálise (leucócitos/campo ou esterase) e aplica a Tabela 1 pela idade. A tela avisa que a contagem da AAP é em urina não centrifugada, por campo, e não se converte para o "/campo centrifugada" nem para o "/mm³" do livro. O livro fica para fora de 8 dias a 5 anos. A nota "a" da Tabela 1 (limiar como apoio, não regra) entra junto.

**I5. Quem testar.** Recomendada: **A**. Sai a etnia. A contagem da Tabela 2 de 2011 também sai, porque os cortes dela foram feitos com a etnia dentro; tirar só a etnia deixaria um corte sem fonte. Entra a lista de fatores da Figura 2 (p. 28), sem número mínimo, com a referência ao UTICalc e a decisão com o médico. É o mesmo caminho do CKD-EPI, que ficou sem campo de raça (revisão PubMed, item 9).

**I6. Aviso.** Recomendada: **A**. O aviso passa a dizer que os números foram lidos em 11/11/2026 e o que mudou. Se o RT escolher B ou C em I1 a I5, o aviso diz isso.

**I7. Duração.** Recomendada: **B**. A duração é do livro, não de uma citação da AAP 2011. Entra uma nota com os cursos da KAS 2 ao lado da linha do livro. A recomendação é condicional, de certeza baixa.

**I8. Via.** Recomendada: **B**. Nota no Quadro 3: a AAP recomenda oral a partir de 29 dias quando a criança tolera e não precisa de internação por outro motivo (KAS 3B, forte), e parenteral com troca precoce de 8 a 28 dias (KAS 3A). Os outros itens do Quadro 3 (sepse, desidratação, não aceitar via oral) não conflitam com a AAP.

**I9. Escolha empírica.** Recomendada: **B**. Nota sem dose: espectro estreito, cefazolina ou cefalexina se a sensibilidade local passar de 80% a 85%. A cefixima, citada pela AAP, não está no livro e fica fora da tela, porque a AAP não dá a dose.

**I10. Saco coletor.** Recomendada: **B**. Uma frase na leitura: urinálise do saco acima do limiar basta para colher por sonda.

**I11 a I13.** Recomendada: **C**.

---

## Impacto se o RT escolher A

- `lerUrocultura` (`ituPed.ts:70–79`) passa a receber idade e urinálise. Os testes de `ituPed.test.ts:20–27` mudam (o de 60.000 por sonda continua positivo; entra um de 10.000 a 50.000).
- A Tabela 2 (`ituPed.ts:47–62`) e a tela (`InfeccaoUrinariaPed.tsx:44–54`) mudam. Os testes de `ituPed.test.ts:11–18` saem ou são reescritos.
- O teste de `ituPed.test.ts:39–43` hoje proíbe número de UFC no aviso. Esse teste precisa mudar junto.
- A ficha ganha versão nova e `revisadoEm` (`ituPed.ts:39–41`).
- Nenhuma dose muda. Nenhuma migration.

---

## Decisões do RT

| # | Divergência | Efeito na tela | Opção recomendada | Decisão do RT |
|---|---|---|---|---|
| I1 | Sonda ≥ 10.000 (8 dias a 5 anos) | Muda | A | |
| I2 | Punção suprapúbica ≥ 10.000 | Muda | A | |
| I3 | Jato médio não aceito abaixo de 2 meses | Muda | A | |
| I4 | Piúria obrigatória pela Tabela 1 | Muda | A | |
| I5 | Quem testar: sem etnia, lista da Figura 2 | Muda | A | |
| I6 | Aviso da AAP | Muda | A | |
| I7 | Duração (KAS 2) | Nota | B | |
| I8 | Via oral a partir de 29 dias (KAS 3) | Nota | B | |
| I9 | Escolha empírica, sem dose | Nota | B | |
| I10 | Saco coletor | Nota | B | |
| I11 | Doses | Não muda | C | |
| I12 | Imagem e profilaxia | Não se aplica | C | |
| I13 | Avaliar em até 72 h | Não muda | C | |

---

## Não conferido

1. Os valores do livro do ICr foram tirados do código. O capítulo 57 não foi reaberto.
2. O CPG, na p. 13, descreve a contagem de leucócitos de forma ambígua ("unspun vs centrifuged"). O RT-diag diz não centrifugada. Ficou valendo o RT-diag.
3. Na Tabela 1, a punção suprapúbica só aparece na linha de 0 a < 2 meses. O texto fala em sonda ou punção sem separar idade. Não há frase que resolva isso.
4. Na p. 6, o RT-diag escreve "younger than 6 years" no limiar com urocultura pronta. No resto dos dois documentos é 5 anos.
5. Na Figura 2, a febre aparece como "≥ 39 °C (102,2 °F)". No texto da p. 12, febre é temperatura retal acima de 100,4 °F (38 °C). Os dois valores estão no PDF; servem a coisas diferentes (critério de entrada no fluxograma e definição de febre).
6. Os apêndices de evidência do CPG (tabelas de evidência para decisão) e os gráficos de floresta do RT-diag não foram lidos linha a linha.
7. O terceiro relatório técnico (AlShenaiber et al., PMID 42803594), citado na ficha, não foi entregue nem lido.
8. O UTICalc (Shaikh 2018), citado na Figura 2, não foi aberto.
