# Lacuna 3: conferência das substâncias controladas com a RDC (10/11/2026)

Conferência linha a linha da tabela `public.substancias_controladas`
(migration `supabase/migrations/20270324000001_controlados.sql`) com o texto da
RDC. Decisão do RT: C2 = A (`LACUNA-03-CONTROLADOS-DIAGNOSTICO.md`, seção 6).

## 1. Fonte lida

- **RDC ANVISA nº 1.036, de 09/07/2026**, "Atualização N. 101" do Anexo I da
  Portaria SVS/MS nº 344/1998. Publicação: "PUB D.O.U., 13/07/2026 - Seção 1"
  (linha 1839 do texto salvo).
- Texto baixado em 10/11/2026 de anvisalegis.datalegis.net (link do ato no
  diagnóstico, seção 1) e convertido para texto puro, uma linha por parágrafo:
  `rdc1036.txt` (1.841 linhas), guardado no rascunho da sessão. Os números de
  linha abaixo são desse arquivo.
- Cabeçalhos das listas no texto (linha: texto):
  - 35 a 37: LISTA - A1, entorpecentes, "(Sujeitas à Notificação de Receita "A")";
  - 145 a 147: LISTA - A2, "(Sujeitas à Notificação de Receita "A")";
  - 173 a 175: LISTA - A3, "(Sujeita à Notificação de Receita "A")";
  - 205 a 207: LISTA - B1, "(Sujeitas à Notificação de Receita "B")";
  - 324 a 326: LISTA - B2, "(Sujeitas à Notificação de Receita "B2")";
  - 345 a 347: LISTA - C1, "(Sujeitas à Receita de Controle Especial em duas vias)";
  - 580, 595 e 606: listas C2, C3 e C5. Não há lista C4 na Atualização 101.
- A cor das receitas é da Portaria 344 (texto da BVS lido em 10/11/2026):
  Notificação A amarela (Art. 40), Notificação B azul (Art. 45), Notificação
  da C3 branca (Art. 49), Notificação Especial da C2 branca (Art. 50), Receita
  de Controle Especial em 2 vias para C1 e C5 (Arts. 52 e 56).

## 2. Catálogo conferido

- `data/medicamento.csv` (200 linhas, carga de `scripts/etl/03_load_medicamento.cjs`).
- Catálogo da homologação (65 itens, 57 princípios ativos; leitura só do
  catálogo, sem dado de paciente). Tem três que o CSV não tem: fluoxetina,
  sertralina e selegilina.
- Nenhuma migration insere medicamento no catálogo; o cadastro local
  (`20270106000001_cadastro_medicamentos.sql`) passa pelo gatilho novo.
- Não li o catálogo da produção. O que lá estiver e casar com a tabela é
  marcado pela remarcação da migration; o que não casar fica sem marca.

Método: cada princípio ativo do catálogo foi comparado, palavra a palavra, com
os 476 itens das listas A1, A2, A3, B1, B2, C1, C2, C3 e C5 (nome sem acento;
palavra igual ou com os 6 primeiros caracteres iguais). Os acertos foram
conferidos à mão e os falsos (seção 4) descartados. Cada linha abaixo foi
conferida por script contra o texto: o número do item e o nome estão na linha
citada.

## 3. As 25 linhas da tabela

| # | Princípio ativo no catálogo | Onde | Nome na RDC | Lista | Item | Linha da RDC (nº em rdc1036.txt: texto) | Receita para casa | Adendo que muda a receita (linha: texto) |
|---|---|---|---|---|---|---|---|---|
| 1 | Morfina; Morfina (dose pediátrica) | CSV e homolog | Morfina | A1 | 65 | 102: `65. Morfina` | Notificação A |  |
| 2 | Fentanila | CSV e homolog | Fentanila | A1 | 42 | 79: `42. Fentanila` | Notificação A |  |
| 3 | Codeína | CSV | Codeína | A2 | 2 | 149: `2. Codeína` | Notificação A (a ampola de 30 mg/mL tem 3%, acima dos 2,5% do adendo 2; ajuste da revisão de 10/11/2026) | 165: "2) preparações à base de acetildiidrocodeína, codeína, diidrocodeína, etilmorfina, folcodina, nicodicodina, norcodeína, inclusive as misturadas a um ou mais com…" |
| 4 | Tramadol | CSV e homolog | Tramadol | A2 | 13 | 160: `13. Tramadol` | Controle Especial (adendo 3 da A2) | 166: "3) preparações à base de tramadol, inclusive as misturadas a um ou mais componentes, em que a quantidade não exceda 100 miligramas de tramadol por unidade posol…" |
| 5 | Cetamina | CSV e homolog | Cetamina | B1 | 17 | 224: `17. Cetamina` | só no estabelecimento (adendo 14 da B1) | 321: "14) A dispensação e o uso dos medicamentos contendo as substâncias cetamina e escetamina só serão permitidos em estabelecimentos de saúde." |
| 6 | Clonazepam; Clonazepam (comprimido) | CSV | Clonazepam | B1 | 21 | 228: `21. Clonazepam` | Notificação B |  |
| 7 | Diazepam; Diazepam (comprimido) | CSV e homolog | Diazepam | B1 | 31 | 238: `31. Diazepam` | Notificação B |  |
| 8 | Fenobarbital | CSV e homolog | Fenobarbital | B1 | 41 | 248: `41. Fenobarbital` | Controle Especial (adendo 2 da B1) | 307: "2) os medicamentos que contenham fenobarbital, metilfenobarbital (prominal), barbital e barbexaclona, ficam sujeitos a prescrição da Receita de Controle Especia…" |
| 9 | Lorazepam | CSV | Lorazepam | B1 | 57 | 264: `57. Lorazepam` | Notificação B |  |
| 10 | Midazolam | CSV e homolog | Midazolam | B1 | 64 | 271: `64. Midazolam` | Notificação B |  |
| 11 | (nenhum hoje; cobre o nome "ácido valproico") | - | Ácido valpróico | C1 | 2 | 349: `2.Ácido valpróico` | Controle Especial |  |
| 12 | Amantadina | CSV | Amantadina | C1 | 4 | 351: `4.Amantadina` | Controle Especial |  |
| 13 | Carbamazepina | CSV | Carbamazepina | C1 | 27 | 374: `27.Carbamazepina` | Controle Especial |  |
| 14 | Etomidato | CSV | Etomidato | C1 | 67 | 414: `67.Etomidato` | Controle Especial |  |
| 15 | Fenitoína; Fenitoína (comprimido) | CSV | Fenitoina | C1 | 75 | 422: `75.Fenitoina` | Controle Especial |  |
| 16 | Flumazenil | CSV | Flumazenil | C1 | 77 | 424: `77.Flumazenil` | Controle Especial |  |
| 17 | Fluoxetina | homolog | Fluoxetina | C1 | 78 | 425: `78.Fluoxetina` | Controle Especial |  |
| 18 | Haloperidol; Haloperidol (comprimido) | CSV e homolog | Haloperidol | C1 | 83 | 430: `83.Haloperidol` | Controle Especial |  |
| 19 | Levetiracetam; Levetiracetam (comprimido) | CSV | Levetiracetam | C1 | 99 | 446: `99.Levetiracetam` | Controle Especial |  |
| 20 | Misoprostol | CSV | Misoprostol | C1 | 127 | 474: `127.Misoprostol` | só no estabelecimento (adendo 4 da C1) | 568: "4) só será permitida a compra e uso do medicamento contendo a substância misoprostol em estabelecimentos hospitalares devidamente cadastrados junto a Autoridade…" |
| 21 | Naloxona | CSV | Naloxona | C1 | 131 | 478: `131.Naloxona` | Controle Especial |  |
| 22 | Propofol | CSV e homolog | Propofol | C1 | 164 | 511: `164.Propofol` | Controle Especial |  |
| 23 | Selegilina | homolog | Selegilina | C1 | 180 | 527: `180.Selegilina` | Controle Especial |  |
| 24 | Sertralina | homolog | Sertralina | C1 | 181 | 528: `181.Sertralina` | Controle Especial |  |
| 25 | Valproato de sódio; Valproato de sódio (comprimido) | CSV | Valproato sódico | C1 | 205 | 552: `205.Valproato sódico` | Controle Especial |  |

Notas:
- Item 11 (ácido valpróico, C1 item 2): o catálogo tem "valproato de sódio",
  que a RDC lista à parte (C1 item 205). A linha do ácido valpróico entra para
  o nome da base escrito à mão na receita; os dois itens são da C1.
- Itens 1, 6, 7, 15, 18, 19 e 25 cobrem mais de um item do catálogo (ampola e
  comprimido).

## 4. Como o nome casa (sais, ésteres, isômeros)

- O adendo 1 de cada lista põe sob controle "os sais, éteres, ésteres e
  isômeros das substâncias enumeradas acima" (A1: linhas 132 a 135, com a
  exceção do dextrometorfano e do dextrorfano; nas outras listas, o adendo 1
  de cada uma). Por isso a marca casa pelo **nome do princípio ativo como
  palavra inteira** dentro do nome do item, sem acento: "cloridrato de
  tramadol", "decanoato de haloperidol" e "citrato de fentanila" casam com
  tramadol, haloperidol e fentanila.
- O texto comparado é o nome do item e o nome normalizado do catálogo, pela
  mesma normalização do banco (`private.norm_medicamento`). A coluna `grafias`
  guarda outra grafia do mesmo nome: "fentanil" (fentanila) e "valproato de
  sodio" (valproato sódico).
- Palavra inteira evita o falso positivo de prefixo: "divalproato de sódio"
  (C1 item 55, fora do catálogo) não casa com "valproato de sódio";
  "hidromorfona" não casa com "morfina".
- Nome com duas substâncias: vale a lista mais restrita (A antes de B antes
  de C) e, nela, o menor item.
- Falsos acertos do método da seção 2, descartados: acetilcisteína e ácido
  acetilsalicílico (acetilmetadol, acetildiidrocodeína); clonazepam e
  clonazolam (B1 item 22, outra substância; o clonazepam é o item 21);
  hidroclorotiazida e hidrocortisona (hidrocodona, hidroclorbezetilamina);
  hidroxicloroquina e hidroxiureia (hidroxipetidina, GHB, hidroxidiona);
  metilprednisolona (metilpentinol); metoprolol (metopromazina).

## 5. Itens do catálogo que ficaram de fora, com motivo

- **Prometazina:** não é controlada. Adendo 10 da C1, linha 574: "excetua-se
  das disposições legais deste Regulamento Técnico a substância prometazina."
- **Hidroxicloroquina e ivermectina:** não estão em nenhuma lista da
  Atualização 101 (busca no texto inteiro sem resultado).
- **Zidovudina:** não há lista C4 (antirretrovirais) na Atualização 101.
- **Escopolamina, ondansetrona, metoclopramida, bromoprida, dimenidrinato,
  lidocaína, oseltamivir, baloxavir, carboprost, rimantadina:** nenhum
  resultado no texto da RDC.

## 6. Adendos que mudam a receita para casa

A coluna `receita` segue a lista (Portaria 344), menos onde o adendo da lista
diz outra coisa (linhas na tabela da seção 3):

- **Codeína (A2, adendo 2) e tramadol (A2, adendo 3):** preparação com até
  100 mg por unidade posológica (codeína: e até 2,5% nas formas indivisíveis)
  vai na Receita de Controle Especial em 2 vias. Acima disso, Notificação A.
  Tramadol: a tabela marca "Receita de Controle Especial" (a ampola do catálogo
  tem 100 mg). Codeína: a tabela marca Notificação A, porque a ampola do
  catálogo (30 mg/mL = 3%) passa dos 2,5% do adendo 2 e o app não confere a
  apresentação (ajuste da revisão de 10/11/2026).
- **Fenobarbital (B1, adendo 2):** Receita de Controle Especial em 2 vias.
- **Cetamina (B1, adendo 14) e misoprostol (C1, adendo 4):** uso só no
  estabelecimento de saúde. Não saem na receita para casa.
