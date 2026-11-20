# Dose em mL, lote 6: demais capítulos (plano)

Data: 20/11/2026. Situação: decisões L6-1 a L6-9 = A (RT, 20/11/2026, "Todas a"); implementação depois do lote 5. Base: `docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md` (seção 1, arquivos de `choqueToxicoPartesMolesPed.ts` a `viasAereasSuperiores.ts`, e seção 4, lote 6), decisões ML1 a ML11 de 19/11/2026 e a CMED como fonte da concentração ao lado da bula (lote 3).

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
