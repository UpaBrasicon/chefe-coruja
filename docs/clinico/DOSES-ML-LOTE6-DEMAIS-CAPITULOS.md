# Dose em mL, lote 6: demais capítulos (plano)

Data: 20/11/2026. Situação: decisões L6-1 a L6-9 = A (RT, 20/11/2026, "Todas a"); em partes pequenas por capítulo (opção A do RT, 20/11/2026); partes 6a a 6d nas branches `fase-ml/lote6a-pneumonia-itu-falciforme`, `fase-ml/lote6b-renal-hemostasia-onco`, `fase-ml/lote6c-eletrolitos` e `fase-ml/lote6d-capitulos-cadastrados` (seção 7). Base: `docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md` (seção 1, arquivos de `choqueToxicoPartesMolesPed.ts` a `viasAereasSuperiores.ts`, e seção 4, lote 6), decisões ML1 a ML11 de 19/11/2026 e a CMED como fonte da concentração ao lado da bula (lote 3).

Lista da CMED: planilha PMC de 09/11/2026 (`scripts/anvisa/lista-cmed.mjs --injetaveis`). Só entram apresentações com "comercializado: Sim".

## 1. Tamanho

- 268 itens nos capítulos do lote; 92 com mL possível pelo diagnóstico (46 "sim", 27 "com alerta", 19 "aspirar e diluir"). Os outros 176 ficam sem mL (VO, pó, infusão contínua, dose só do dia, retal, inalatória, hemoderivado).
- Os itens usam o tipo `DoseLivro` (`fonteP4.ts`), que hoje não tem campo de volume. A dose pode vir por kg por **dia** (com o número de doses) ou por kg por **dose**.

## 2. Regra nova deste lote: mL só da dose por tomada (L6-1)

`calcularDoseLivro` já dá a dose por tomada quando o livro diz em quantas doses o dia se divide. Proposta: o mL sai **só da dose por tomada**. Item por dia sem o número de doses fica sem mL. O volume do dia nunca aparece, porque não é volume de uma administração (o diagnóstico já tirou 6 itens por esse motivo).

## 3. Princípios, pela CMED

### Já têm ampola cadastrada (lotes 1 a 3): só ligar as chaves

| Princípio | Itens | Observação |
|---|---|---|
| Midazolam 1 e 5 mg/mL | `comaHicPed:midazolam`, `oncologiaPed:midaz-iv`, `-im`, `-in` | nenhuma marcada |
| Fenitoína 50 mg/mL (aspirar e diluir) | `oncologiaPed:fenitoina-ataque`, `-man`, `-prof` | `-man` é por dia: mL da dose por tomada |
| Atropina 0,25 e 0,5 mg/mL | `intoxicacaoPed:atropina-cap` | nenhuma marcada |

### Uma concentração à venda

| Princípio | Itens | CMED 09/11/2026 | Como aparece |
|---|---|---|---|
| Furosemida 10 mg/mL | 11 itens (`eletrolitosPed`, `glomerulopatiasPed`, `injuriaRenalPed`, `insuficienciaCardiacaPed`, `intoxicacaoPed`, `oncologiaPed`) | Teuto, Sanofi Medley, Hypofarma, Hipolabor | volume da ampola |
| Dipirona 500 mg/mL | `falciformePed:dipirona` | Hypofarma, Teuto, Hipolabor, Farmace, Santisa | volume da ampola |
| Ácido tranexâmico 50 mg/mL | `hemostasiaTromboPed:atx-iv`, `atx-dvw` | Blau, Fresenius, Hipolabor, Zydus | resolve o conflito das listas locais (50 × 100 mg/mL): a de 100 mg/mL não está à venda |
| Desmopressina 4 µg/mL | `hemostasiaTromboPed:ddavp` | Ferring | aspirar e diluir (em SF, pelo diagnóstico) |
| Clindamicina 150 mg/mL | `choqueToxicoPartesMolesPed:clinda-iv`, `clindamicina`, `osteoarticularPed:clindamicina` | Hipolabor, Hypofarma, União Química | aspirar e diluir |
| Tobramicina 50 mg/mL | `ituPed:tobramicina` | Antibióticos do Brasil | aspirar e diluir, pela bula |
| SMX-TMP 80 + 16 mg/mL | `choqueToxicoPartesMolesPed:smxtmp`, `imunodeprimidoPed:tmp`, `oncologiaPed:tmp`, `osteoarticularPed:tmpsmx` | Brainfarma | aspirar e diluir; **a base da dose (SMX ou TMP) decide a concentração** (L6-5) |
| Enoxaparina 100 mg/mL | `oncologiaPed:enoxa-svcs` | seringas de 20, 40, 60, 80 e 100 mg (Aché, Biomm, Blau, Cristália, Sanofi, Viatris) e frasco de 100 mg/mL (Blau, Eurofarma) | volume da seringa graduada |
| Manitol 20% (0,2 g/mL) | `oncologiaPed:manitol` | 8 fabricantes; livro p. 720 e 179 | volume a infundir |
| Salbutamol injetável 0,5 mg/mL | `injuriaRenalPed:beta2` | Hipolabor | só a injetável; via e diluição pela bula |
| Glicerofosfato de sódio (fósforo orgânico, 1 mmol/mL pelo livro) | `eletrolitosPed:p-ev` | Fresenius (216 mg/mL, amp. 20 mL) | só este sal (L6-8) |

### Soluções prontas para infusão (L6-2)

| Princípio | Itens | CMED | Como aparece |
|---|---|---|---|
| Metronidazol 5 mg/mL | 3 itens | 8 fabricantes | volume da solução pronta |
| Ciprofloxacino 2 mg/mL | 4 itens | Hypofarma, Fresenius | volume da solução pronta |
| Levofloxacino 5 mg/mL | 3 itens | Eurofarma, Halex | volume da solução pronta |
| Fluconazol 2 mg/mL | `imunodeprimidoPed:fluconazol` | Cristália, Pfizer | volume da solução pronta |
| Linezolida 2 mg/mL | 4 itens | Eurofarma, Beker | volume da solução pronta |

### Mais de uma concentração à venda (nenhuma marcada)

| Princípio | Itens | CMED | Risco |
|---|---|---|---|
| Gentamicina | 3 itens | 20 mg/mL (Fresenius) e 40 mg/mL (Hipolabor, Fresenius, Hypofarma, Santisa) | 2× (L6-4) |
| Amicacina | 4 itens | 50 mg/mL (Teuto) e 250 mg/mL (Fresenius, Teuto) | 5× (L6-4) |
| Bicarbonato de sódio | `eletrolitosPed:bic`, `injuriaRenalPed:bic`, `intoxicacaoPed:bicarbonato-alcalina`, `oncologiaPed:bic3` | 8,4% (Farmace, Fresenius, Hypofarma, JP, Samtec) e 10% (Farmace). O 3% do livro (0,35 mEq/mL) não está à venda | L6-6 |
| Glicose | `eletrolitosPed:glicose-polarizante`, `injuriaRenalPed:glicose` | 5%, 10%, 25%, 50% e 75%; o livro cita 25% (p. 32) | até 15× |

### Seguem decisões de outros lotes

| Princípio | Itens | Segue |
|---|---|---|
| Dexametasona | 8 itens | L4-2 (base do sal pela bula) |
| Morfina | `falciformePed:morfina-figura`, `morfina-texto` | L5-3 |
| Octreotida | `digestivoHepaticoPed:octreotida-bolus` | L5-4 |
| Insulina | 3 itens | ML7 e L5-5 |
| Acetilcisteína | `injuriaRenalPed:nac-contraste` | lote 5 (100 mg/mL, aspirar e diluir) |
| Vitamina K | `intoxicacaoPed:vitk-sc` | L5-2; aqui a via é SC, que as ampolas IM/SC permitem |
| Cálcio (gluconato e cloreto) | 6 itens | L6-7 |
| Magnésio elementar | `injuriaRenalPed:mg` | L6-9 |
| Magnésio sal | `eletrolitosPed:mg-grave` | lote 4 (10% e 50%) |

### Sem apresentação injetável à venda: ficam sem mL

Doxiciclina IV (`doxi`), calcitonina, prednisolona injetável (`aha-prednisolona`), ticarcilina (só com clavulanato, em pó e sem venda) e pralidoxima.

## 4. Decisões para o RT (A recomendada)

- **L6-1. Dose por dia.** A: mL só da dose por tomada; item por dia sem número de doses fica sem mL. B: mostrar também o volume do dia.
- **L6-2. Soluções prontas (bolsa ou frasco).** A: mostrar o "volume da solução pronta" com rótulo próprio, diferente de "volume a aspirar da ampola". B: sem mL para soluções prontas.
- **L6-3. Bulas.** A: como nos lotes 4 e 5, o RT baixa as bulas dos itens "aspirar e diluir" (clindamicina, gentamicina, amicacina, tobramicina, SMX-TMP, desmopressina) e do salbutamol injetável; esses itens só ganham mL depois da bula. B: usar a marcação do diagnóstico ("aspirar e diluir") sem esperar a bula.
- **L6-4. Aminoglicosídeos.** A: gentamicina 20 e 40 mg/mL e amicacina 50 e 250 mg/mL, nenhuma marcada. B: só a concentração da lista local (40 e 250 mg/mL).
- **L6-5. SMX-TMP.** A: a sessão confere no livro se cada dose está em mg de TMP ou de SMX e usa a concentração do mesmo componente (16 ou 80 mg/mL); item sem a base escrita fica sem mL. B: SMX-TMP fica sem mL.
- **L6-6. Bicarbonato.** A: 8,4% (1 mEq/mL, livro) e 10% (1,19 mEq/mL pela conta do sal) sem marcação; o item de 3% fica sem mL, porque o 3% é preparo e não está à venda. B: só 8,4%.
- **L6-7. Cálcio.** A: cadastrar também a concentração do sal (gluconato 10% e cloreto 10% = 100 mg do sal/mL); cada item recebe a base que o livro escreve (sal ou elemento); item sem a base clara fica sem mL. B: cálcio sem mL neste lote.
- **L6-8. Fósforo.** A: só o glicerofosfato de sódio (fósforo orgânico, 1 mmol/mL, como o livro). O fosfato de potássio (2 mEq/mL, outro sal e com potássio) fica fora. B: os dois, sem marcação.
- **L6-9. Magnésio em mg de elemento.** A: sem mL (a ampola é do sal; ML6). B: converter pelo mEq/mL do livro (Tabela 11).

## 5. Execução (depois das decisões)

1. Branch `fase-ml/lote6-demais-capitulos`, PR próprio, depois do lote 5.
2. `DoseLivro` ganha a chave da ampola (`<arquivo>:<id>`) e a tela dos capítulos passa a usar a `EscolhaDaAmpola` com a dose por tomada.
3. Princípios novos em `ampolas.ts`, com fonte (CMED e bulas lidas) e `diluir` pela bula; rótulo próprio para solução pronta (L6-2).
4. Fichas em versão nova: `ped-ampolas` e as dos capítulos que mudam de tela; migration na homologação, com o rollback testado.
5. Testes: `problemasDasAmpolas()` vazio; mL só com dose por tomada; nenhuma marcada quando há mais de uma; base sal × elemento; SMX-TMP pela base do item.
6. Homologação → conferência do RT → aprovação das fichas na produção → produção com o ok do RT → `BACKLOG.md`.

## 6. Riscos

- Volume do dia confundido com volume de uma dose (L6-1).
- Amicacina 50 × 250 mg/mL (5×) e glicose de 5% a 75% (15×).
- SMX-TMP: usar 80 mg/mL numa dose escrita em TMP dá 5× menos volume que o certo (L6-5).
- Cálcio: sal × elemento dá cerca de 11× no gluconato (ML6, L6-7).

## 7. Andamento por partes (opção A do RT, 20/11/2026)

O gate do LG10 obriga a subir a ficha de cada capítulo cuja tela muda. Para não pedir 15 a 20 aprovações de uma vez, o lote 6 vai em partes pequenas, primeiro os capítulos mais usados na UPA.

**6a: pneumonia, ITU e crise álgica** (branch `fase-ml/lote6a-pneumonia-itu-falciforme`, empilhada sobre o lote 5):
- `LinhaDoseLivro` (`PecasP4.tsx`) aceita a chave da ampola e mostra a escolha só com a dose por tomada (L6-1);
- solução pronta (`pronta: true`) mostra "da solução pronta de … (volume a infundir)" e pede "Escolha a solução…" (L6-2); a guarda acusa solução pronta marcada para diluir;
- pneumonia (SBP 2024): levofloxacino 5 mg/mL, metronidazol 5 mg/mL e linezolida 2 mg/mL; ITU: ciprofloxacino IV 2 mg/mL; crise álgica: dipirona 500 mg/mL e morfina 1 e 10 mg/mL (lote 5);
- fichas `ped-ampolas` 2026-11-20.5, `ped-pneumonia`, `ped-infeccao-urinaria` e `ped-falciforme` 2026-11-20.1; migration `20270416000019_fichas_lote6a.sql`, aplicada na homologação em 20/11/2026 (fontes conferidas por md5; volta testada em transação desfeita);
- evidência local: 1.392 testes, 0 falhas; typecheck, eslint e padrão do frontend sem erro; CMED sem concentração nova.

**6b: injúria renal, hemostasia e emergências oncológicas** (branch `fase-ml/lote6b-renal-hemostasia-onco`, empilhada sobre a 6a):
- princípios novos, uma concentração à venda de cada (CMED 09/11/2026), nenhum marcado: furosemida 10 mg/mL (ampola de 2 mL); ácido tranexâmico 50 mg/mL (a de 100 mg/mL das listas locais não está na lista); enoxaparina 100 mg/mL em seringa preenchida (todas as seringas à venda, de 20 a 100 mg, são de 100 mg/mL), com o texto "da seringa preenchida … (volume a aplicar)"; manitol 20% = 0,2 g/mL como solução pronta (livro p. 720 e 179; oito fabricantes);
- insulina da hipercalemia (`renal:insulina`, `oncologia:insulina`) pelo preparo de 0,1 UI/mL do livro, como na solução polarizante do lote 5 (L5-5, ML7);
- já cadastrados, só ligados: midazolam (IV, IM e IN), fenitoína (ataque e manutenção, aspirar e diluir) e linezolida, metronidazol, ciprofloxacino e levofloxacino como solução pronta;
- **sem mL por não escreverem a via:** `hemostasia:atx-dvw` (ácido tranexâmico na doença de von Willebrand, 10 a 20 mg/kg) e `oncologia:fenitoina-prof` (fenitoína profilática). O ácido tranexâmico tem dose diferente IV e VO na hemofilia (10 contra 15 a 20 mg/kg); dar o volume da ampola IV a uma dose que pode ser oral seria escolher a via pelo médico. Ligam depois de o RT conferir a via na p. 682 e na p. 720;
- fichas `ped-ampolas` 2026-11-20.6 e `ped-injuria-renal`, `ped-hemostasia-trombose` e `ped-emergencias-oncologicas` 2026-11-20.1; migration `20270416000020_fichas_lote6b.sql`, aplicada na homologação em 20/11/2026 (fontes conferidas por md5; volta testada em transação desfeita, 4 linhas);
- risco para o RT olhar: a enoxaparina no lactente dá volumes abaixo de 0,1 mL (3 kg × 1 mg/kg = 0,03 mL); o aviso de seringa de 1 mL aparece (L4-5), e as seringas de 20 e 40 mg não são graduadas pela descrição da CMED;
- evidência local: 1.396 testes, 0 falhas; typecheck, eslint e padrão do frontend sem erro; guarda do LG10 liberada contra a 6a.

**6c: eletrólitos** (branch `fase-ml/lote6c-eletrolitos`, empilhada sobre a 6b):
- bicarbonato 8,4% (1 mEq/mL, livro p. 32) e 10% (1,19 mEq/mL pela conta do sal; Farmace), nenhum marcado; o 3% da oncologia fica sem mL (L6-6);
- cálcio em mg do sal (L6-7): um princípio por sal (`gluconato-de-calcio` e `cloreto-de-calcio`, 100 mg do sal/mL), para a dose de cloreto nunca ganhar o volume do gluconato. A base é o sal quando o livro dá, para a mesma dose, o volume da solução a 10% (p. 549: 20 mg/kg = 0,2 mL/kg; p. 583: 50 a 100 mg/kg = 0,5 a 1 mL/kg). **Nenhum dos dois aparece à venda na CMED de 09/11/2026** (a ampola de cloreto 10% da Vasconcelos está sem venda; gluconato injetável não está na lista); a concentração vem do livro (Tabela 11);
- ligados: `eletrolitos:bic`, `insulina` (preparo de 0,1 UI/mL), `furosemida-k`, `furosemida-ca`, `cloreto-ca-mg`, `gluconato-ca-mg`; `renal:bic`, `cacl`, `gluconato`, `gluconato-assint`; `oncologia:gluconato`;
- **magnésio grave dos eletrólitos:** o volume fixo do sulfato 10% sai da tela e do "Copiar" e entra a escolha de 10% e 50% no sal (lote 4, L4-3), como na asma e na torsades;
- ficam com o mL do livro, como estavam: KCl 19,1% (2,5 mEq/mL) e fósforo orgânico (1 mmol/mL; a CMED tem o glicerofosfato de sódio 216 mg/mL da Fresenius e da Vasconcelos, de uso hospitalar), e os itens de cálcio já escritos em mL;
- **glicose sem mL:** 5%, 10%, 25%, 50% e 75% à venda (até 15×) e nenhuma decisão própria do RT; o livro cita 25% (p. 32). Pergunta ao RT: só a 25% do livro, ou todas sem marcação;
- fichas `ped-ampolas` 2026-11-20.7 e `ped-eletrolitos` 2026-11-20.1; migration `20270416000021_fichas_lote6c.sql`, aplicada na homologação em 20/11/2026 (md5 conferido; volta testada em transação desfeita, 2 linhas). As telas da injúria renal e da oncologia mudam só pela ficha `ped-ampolas` (as chaves já estavam na tela desde a 6b);
- evidência local: 1.399 testes, 0 falhas; typecheck, eslint e padrão sem erro; guarda do LG10 liberada contra a 6b.

**6d: capítulos com princípio já cadastrado** (branch `fase-ml/lote6d-capitulos-cadastrados`, empilhada sobre a 6c; sem princípio novo):
- síndrome nefrótica e SHU (`glomerulo:furo-albumina`, `furo-hiper`, `furo-shu`) e diurese forçada (`intoxicacao:furosemida-iv`): furosemida 10 mg/mL;
- bicarbonato da diurese alcalina (`intoxicacao:bicarbonato-alcalina`, 8,4% e 10%, nenhum marcado): infusão de 3 a 4 h (p. 205), então o mL é o volume a aspirar e o aviso de diluir vem do próprio item (`diluir` em `ItemComAmpola`, novo; a guarda acusa item para diluir com solução pronta ou seringa preenchida);
- atropina do capítulo de intoxicações (`intoxicacao:atropina-cap`, 0,25 e 0,5 mg/mL); midazolam do coma (`coma:midazolam`, 1 e 5 mg/mL); bolus de octreotida (`hda:octreotida-bolus`, 50, 100 e 500 µg/mL, L5-4); linezolida e metronidazol IV do choque tóxico e da pele (`pele:`, solução pronta);
- **sem mL nesta parte:** furosemida da GNPE (por dia, VO); furosemida VO da diurese forçada; pralidoxima (sem injetável à venda); lista oral da insuficiência cardíaca (a furosemida está numa tabela de medicações orais); imunodeprimido e osteoarticular (os itens não escrevem a via); clindamicina, SMX-TMP e vitamina K (bula);
- fichas `ped-ampolas` 2026-11-20.8 e `ped-glomerulopatias-shu`, `ped-intoxicacoes`, `ped-coma-hic`, `ped-hda-hepatica` e `ped-choque-toxico-partes-moles` 2026-11-20.1; migration `20270416000022_fichas_lote6d.sql`, aplicada na homologação em 20/11/2026 (md5 conferido; volta testada em transação desfeita, 6 linhas);
- evidência local: 1.401 testes, 0 falhas; typecheck, eslint e padrão sem erro; guarda do LG10 liberada contra a 6c.

Ficam para as próximas partes: aminoglicosídeos, clindamicina, SMX-TMP, desmopressina e salbutamol (bula, L6-3), dexametasona (L4-2), glicose (decisão do RT) e os demais capítulos.
