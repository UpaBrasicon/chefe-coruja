# Trombólise no AVC: correção oficial da AHA/ASA 2026 — diagnóstico

Origem: pedido do RT em 11/11/2026. É o item 2 da revisão PubMed no `BACKLOG.md` ("Pendente: o RT trazer o PDF da correção para conferir as Tabelas 5 e 7"). O RT entregou o PDF da correção nesse dia.

Fonte lida: Prabhakaran S, et al. Correction to: 2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke. Stroke. 2026;57(8):e461–e467. PMID 42507797. doi:10.1161/STR.0000000000000530. Texto completo, as sete páginas. O PDF fica com o RT; não foi copiado para o repositório.

Este documento é só diagnóstico. Nenhum código, dose, corte ou texto da tela muda aqui.

Como foi feito (11/11/2026):
- O PDF foi lido inteiro. A correção lista 34 itens. Cada um foi conferido contra a ferramenta.
- O app foi conferido no `master` de 11/11/2026 (0bbe958f): `src/clinico/adulto/avcTrombolise.ts`, `src/clinico/adulto/avc2026.test.ts` e `src/pages/plantonista/manual/TromboliseAvcAdulto.tsx`.
- A diretriz original (e316–e436) não foi relida agora. O PDF dela não estava disponível nesta sessão. Os trechos da ferramenta vêm da leitura de 28/09/2026.
- Páginas: "e461" a "e467" são as da correção. Os números entre colchetes, como [e40], são as páginas da diretriz que a correção cita.

---

## Resposta curta

- A correção **não mexe nas Tabelas 5 e 7** da diretriz. As tabelas que ela corrige são a 3 (nome de estudo), a 6 (angioedema) e a 8 (título e duas contraindicações), além da Figura 4.
- Três pontos mudam a tela: o texto da janela estendida, a via da adrenalina no angioedema e o próprio aviso da correção.
- Nenhuma dose de trombolítico muda. A alteplase ganhou "máx. 90 mg" no texto da recomendação, e a ferramenta já mostra esse teto.

---

## Como está hoje

- Aviso da correção: `avcTrombolise.ts:29–39` (constante `CORRECAO_AHA_2026`; texto na linha 37). A tela mostra o aviso em `TromboliseAvcAdulto.tsx:92–94`. O texto pede para conferir "em especial as Tabelas 5 e 7".
- Alteplase: 0,9 mg/kg, máximo 90 mg, em `avcTrombolise.ts:73` (livro, Tabela 5, p. 526) e na linha da AHA em `avcTrombolise.ts:133`.
- Tenecteplase pela AHA: 0,25 mg/kg, máximo 25 mg, e faixas de peso da "Tabela 7, p. 43" em `avcTrombolise.ts:100–115`. Teste em `avc2026.test.ts:16–25`.
- Janela estendida pela AHA: `avcTrombolise.ts:136`. Texto: penumbra salvável em perfusão automatizada; despertar com sintomas até 9 h do meio do sono ou 4,5–9 h da última vez bem; "pode ser razoável"; "COR 2b, LOE B-R".
- Sangramento após trombólise pela AHA ("Tabela 5, p. 40"): `avcTrombolise.ts:145`.
- Monitorização após trombólise pela AHA ("Tabela 7, p. 43"): `avcTrombolise.ts:146`.
- Contraindicações absolutas (livro, Tabela 4): `avcTrombolise.ts:217–233`. A linha 219 já diz "Área extensa de hipoatenuação".
- Angioedema (livro, Tabela 7, p. 528): `avcTrombolise.ts:305–314`. A linha 310 diz adrenalina 0,1% 0,3 mL **SC** ou 0,5 mL por nebulização. A tela mostra o bloco em `TromboliseAvcAdulto.tsx:177–180`.
- Dupla antiagregação com ABCD2 ≥ 4 (livro, p. 537): `avcTrombolise.ts:321`.
- A ferramenta não mostra a Tabela 8 da AHA, a Figura 4, a disfagia nem a trombólise na criança.

---

## O que a fonte diz

Os 34 itens, agrupados pelo efeito. Página da correção entre parênteses.

**Com efeito clínico possível**
- Item 2 (e461): a tabela "What Is New" ganhou a legenda do asterisco. Diz que as recomendações marcadas têm generalização limitada em alguns grupos: mais de 80 anos, insuficiência renal, hipertensão refratária (PAS ≥ 185 ou PAD ≥ 110 mmHg), doença que confunde o exame neurológico e expectativa de vida abaixo de 3 meses. A correção não diz quais recomendações têm o asterisco.
- Item 10 (e462): Tabela 6 [e40], angioedema, nona linha. A adrenalina 0,1% (1 mg/mL) 0,3 mL passa de "subcutaneously" para **"intramuscularly"**. A nebulização segue escrita como "0.5 mg/dL", nas duas versões.
- Item 11 (e462–e463): texto de apoio da recomendação 14 da seção 4.6.1 [e41], criança. Antes: alteplase "0.9 mL/kg". Depois: "0.9 mg/dL". O texto novo também diz que a recomendação vale a partir de 28 dias e que os dados são mais robustos a partir de 2 anos. Entre 28 dias e 2 anos pede avaliação individual com especialista.
- Item 12 (e463): recomendação 1 da seção 4.6.2 [e42]. A alteplase 0,9 mg/kg ganha "(max 90 mg)" no texto.
- Item 13 (e463): recomendação 2 da seção 4.6.3 [e44], janela estendida. Entra "não elegível para trombectomia". A força muda de "may be reasonable" para **"can be beneficial"**. O resto do texto (perfusão automatizada, 9 h do meio do sono, 4,5–9 h) fica igual. A correção não diz se a classe (COR) mudou.
- Item 16 (e463): Tabela 8 [e49] muda de título, para algo como "outras situações na decisão da trombólise".
- Item 17 (e463): Tabela 8 [e50], contraindicações relativas. O trauma maior fora do SNC passa de "between 14 days and 3 months" para "within 14 days and 3 months". A coluna ao lado passa a dizer "within 14 days".
- Item 18 (e463): Tabela 8 [e52], contraindicação absoluta. A hipodensidade na imagem passa a ser "extensive regions of clear hypodensity".
- Item 21 (e464): Figura 4 [e63]. "ABCD ≥ 4" vira "ABCD2 ≥ 4".

**Texto de apoio e referências, sem mudar recomendação**
- Itens 5, 7 e 8 (e461–e462): imagem na janela estendida. Entram estudos (AURORA, CLEAR, três meta-análises) que comparam TC sem contraste com perfusão. Sem diferença de independência funcional; sinal de mortalidade a favor da perfusão, só em dados observacionais.
- Itens 19 e 20 (e463–e464): o mesmo tema na seção 4.7.2 (trombectomia), com seis referências novas.
- Item 9 (e462): seção 4.3 (PA), "TRUTH RCT" vira "TRUTH study". Nenhum alvo de PA muda.

**Fora do que a ferramenta cobre**
- Itens 22 a 27 (e464–e465): disfagia. A estimulação elétrica faríngea cai da classe 2a para 2b na recomendação 5. A recomendação 6 e o texto de apoio mudam.

**Editoriais**
- Itens 1, 3, 4, 6, 14, 15 e 28 a 34 (e461–e466): sumário, lacunas de pesquisa, unidades móveis de AVC, "TRACE 3" para "TRACE-III", equipe da AHA, declarações de conflito e renumeração de referências.

---

## Comparação

| # | Item da correção | Pág. | Ferramenta hoje | Efeito |
|---|---|---|---|---|
| D1 | Janela estendida: "não elegível para trombectomia" e "can be beneficial" (item 13) | e463 | `avcTrombolise.ts:136`: sem a condição da trombectomia; "pode ser razoável"; COR 2b | **Muda a tela** |
| D2 | Angioedema: adrenalina IM, não SC (item 10) | e462 | `avcTrombolise.ts:310`: 0,3 mL SC (livro, p. 528) | **Muda a tela** |
| D3 | Aviso da correção | — | `avcTrombolise.ts:37`: "confira... em especial as Tabelas 5 e 7" | **Muda a tela** |
| D4 | Alteplase "máx. 90 mg" (item 12) | e463 | `avcTrombolise.ts:73` e `:133` já têm 90 mg | Não muda |
| D5 | Hipodensidade "extensa" como absoluta (item 18) | e463 | `avcTrombolise.ts:219` já diz "Área extensa" (livro) | Não muda |
| D6 | "ABCD2 ≥ 4" na Figura 4 (item 21) | e464 | `avcTrombolise.ts:321` já diz ABCD2 ≥ 4 (livro) | Não muda |
| D7 | Tabela 8: título e trauma fora do SNC (itens 16 e 17) | e463 | A tela não mostra a Tabela 8 da AHA | Não se aplica |
| D8 | Legenda do asterisco (item 2) | e461 | A tela não mostra a tabela "What Is New" | Não se aplica |
| D9 | Alteplase na criança (item 11) | e462–e463 | Não há trombólise pediátrica no app | Não se aplica |
| D10 | Imagem na janela estendida e na trombectomia (itens 5, 7, 8, 19, 20) | e461–e464 | `avcTrombolise.ts:142–143` não falam da modalidade de imagem | Não muda |
| D11 | "TRUTH study" na PA (item 9) | e462 | Alvos de PA em `avcTrombolise.ts:137–140` | Não muda |
| D12 | Disfagia (itens 22 a 27) | e464–e465 | Não há ferramenta de disfagia no AVC | Não se aplica |
| — | Tabelas 5 e 7 | — | `avcTrombolise.ts:100–115`, `:145` e `:146` | Não muda: a correção não toca nelas |

---

## Opções

Para cada mudança:
- A: aplicar o texto corrigido, citando a correção.
- B: manter como está e mostrar a correção como nota.
- C: não mudar nada.

**D1. Janela estendida.** Recomendada: **A**. A correção é da própria recomendação, não de texto de apoio. A linha 136 passa a dizer "sem indicação de trombectomia" e "pode ser benéfica". A classe fica como está até alguém ler a página corrigida, com a observação de que a correção não informou a classe. Na convenção da AHA, "can be beneficial" é termo da classe 2a e "may be reasonable" é da 2b. Essa convenção é da AHA em geral, não está no PDF da correção. Por isso a classe não é trocada de memória.

**D2. Angioedema.** Recomendada: **A**. A linha de adrenalina passa a mostrar 0,3 mL IM, citando a Tabela 6 corrigida da AHA. O "SC" do livro (p. 528) fica como errata, do mesmo jeito que a tela já trata a tenecteplase 0,4 mg/kg do livro. A nebulização segue com o texto do livro (0,5 mL, 0,5 mg), porque a correção escreve "0.5 mg/dL" e essa unidade não fecha.

**D3. Aviso.** Recomendada: **A**. O aviso deixa de pedir para conferir as Tabelas 5 e 7. Passa a dizer que a correção foi lida em 11/11/2026 e o que mudou na tela (D1 e D2). Se o RT escolher C em D1 e D2, o aviso diz isso.

**D4 a D6.** Recomendada: **C**. A ferramenta já está igual ao texto corrigido.

**D7.** Recomendada: **C**. A tela usa a Tabela 4 do livro para as contraindicações. A Tabela 8 da AHA não entra. A redação nova do trauma ("within 14 days and 3 months") é ambígua, o que pesa contra trazê-la.

**D8.** Recomendada: **C**. Não dá para pôr a nota sem saber quais recomendações têm o asterisco. Uma nota B só depois de ler a tabela "What Is New" corrigida.

**D9.** Recomendada: **C**. O app não tem trombólise na criança. A regra do projeto proíbe levar dose do adulto para a criança. O texto corrigido traz "0.9 mg/dL", unidade que não é de dose; não serve como fonte de dose.

**D10 e D11.** Recomendada: **C**. Mudou só o texto de apoio. Nenhuma recomendação nem número muda.

**D12.** Recomendada: **C**. Fora do escopo da ferramenta.

---

## Impacto se o RT escolher A

- D1: muda o texto da linha 136. O teste `avc2026.test.ts` não confere essa linha; vale acrescentar um teste para "trombectomia" e "benéfica".
- D2: muda a linha 310 e a errata da linha 312. A página não precisa mudar.
- D3: muda a linha 37 e o comentário das linhas 29–35.
- A ficha ganha versão nova e `revisadoEm` (linhas 61 e 68), com a correção nas fontes.
- Nenhuma dose calculada muda. Nenhuma migration.

---

## Decisões do RT

| # | Mudança | Efeito na tela | Opção recomendada | Decisão do RT |
|---|---|---|---|---|
| D1 | Janela estendida: "não elegível para trombectomia" e "pode ser benéfica" | Muda | A (classe mantida até conferir) | A (RT, 11/11/2026) |
| D2 | Angioedema: adrenalina 0,3 mL IM | Muda | A (SC do livro como errata) | A (RT, 11/11/2026) |
| D3 | Aviso da correção | Muda | A | A (RT, 11/11/2026) |
| D4 | Alteplase máx. 90 mg | Não muda | C | C (RT, 11/11/2026) |
| D5 | Hipodensidade extensa | Não muda | C | C (RT, 11/11/2026) |
| D6 | ABCD2 ≥ 4 | Não muda | C | C (RT, 11/11/2026) |
| D7 | Tabela 8 (título e trauma) | Não se aplica | C | C (RT, 11/11/2026) |
| D8 | Legenda do asterisco | Não se aplica | C | C (RT, 11/11/2026) |
| D9 | Alteplase na criança | Não se aplica | C | C (RT, 11/11/2026) |
| D10 | Imagem na janela estendida | Não muda | C | C (RT, 11/11/2026) |
| D11 | TRUTH na PA | Não muda | C | C (RT, 11/11/2026) |
| D12 | Disfagia | Não se aplica | C | C (RT, 11/11/2026) |

---

## Não conferido

1. A classe (COR) da recomendação de janela estendida depois da correção. O PDF da correção não a informa.
2. Quais recomendações da tabela "What Is New" têm o asterisco.
3. A diretriz original não foi relida nesta sessão. A ferramenta cita "Tabela 7, p. 43" para duas coisas: as faixas de peso da tenecteplase (`avcTrombolise.ts:106–107`) e a monitorização (`avcTrombolise.ts:146`). Pode ser a mesma tabela; não foi conferido.
4. A unidade certa da nebulização de adrenalina na Tabela 6 ("0.5 mg/dL" nas duas versões).
5. A versão online corrigida da diretriz, que a correção diz já estar atualizada. Não foi aberta.
