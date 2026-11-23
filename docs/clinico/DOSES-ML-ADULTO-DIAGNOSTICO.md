# Dose em mL no adulto: diagnóstico

Data: 23/11/2026. Situação: decisões MA1 a MA7 = A (RT, 23/11/2026); próximo: plano do lote A0 (cadastro único) e A1 (PCR e arritmias). Pedido do RT de 19/11/2026 ("doses em mL em todas as medicações"), com a pediatria primeiro e o adulto em lote próprio. A pediatria fechou nos lotes 0 a 8 (#1001 a #1043). Base: as regras ML1 a ML11, a decisão "CMED + bula, só à venda" e o aviso de via mista do lote 8.

## 1. Como está hoje

Levantamento das telas do adulto (`src/clinico/adulto/` e `src/pages/plantonista/manual/`). Foram contadas só as doses injetáveis (IV, IM, SC, IO). Ficaram de fora VO, inalatório e tópico, além dos textos de comparação de diretrizes.

| | Itens |
|---|---|
| Já mostram mL | cerca de 95 |
| Sem mL | cerca de 150 |

**Já mostram mL:**
- infusões contínuas da calculadora (14, preparo do Anexo 1);
- sequência rápida (8);
- sedação para procedimento (9, só a dose inicial);
- estado de mal (7);
- PCR (8, cinco delas pela escolha da ampola do lote 1);
- eletrólitos (cerca de 9);
- antídotos com volume escrito (cerca de 8);
- as infusões que reaproveitam o preparo do Anexo 1 (IC, FA, emergência hipertensiva, AVC, analgesia, insulina, milrinona do pós-PCR, midazolam da abstinência);
- os itens que já são em mL (cálcio, glicose, NaCl 3%, bicarbonato, plasma, imunoglobulinas).

**Sem mL, por tela:**

| Tela | Itens |
|---|---|
| Intoxicações e antídotos | cerca de 20 |
| PCR, bradi e taquiarritmias | 14 |
| Antibióticos (meningite, neutropenia febril, ITU e outros) | cerca de 20 |
| Anticoagulação e fibrinolíticos | cerca de 11 |
| Endócrino | cerca de 10 |
| Agitação e delirium | 9 |
| Sedação (adjuvantes e reversores) | 9 |
| Emergência hipertensiva | 9 |
| Dor e analgesia | 8 |
| Anafilaxia | 7 |
| Hemorragia digestiva | 7 |
| Fibrilação atrial (doses de ataque) | 6 |
| Reversão da anticoagulação | 6 |
| AVC | 5 |
| Abstinência | 5 |
| Cefaleia e cólica renal | cerca de 12 |

**Diferenças em relação à pediatria:**
- **Formatos de dado.** São cerca de 12 formatos diferentes. A metade é texto livre: a dose é uma frase, como em `ItemManual {dose}` (PCR e intoxicações), `ItemAnafilaxia`, `Dose {droga, texto}` (endócrino) e os esquemas de antibiótico. Na pediatria, quase tudo era `DoseLivro`, com número, unidade e via.
- **Via não escrita no item.** Lidocaína, KCl, adenosina, atropina e glucagon da PCR; os 8 da sequência rápida (que já mostram mL); metilprednisolona da anafilaxia; olanzapina ("via não informada"); magnésio da FA; metoprolol do endócrino; pré-medicação dos peçonhentos.
- **Via mista.** Diazepam/lorazepam "EV ou IM"; haloperidol e lorazepam "oral, IM, IV"; tramadol "VO, EV, IM"; vitamina K "VO ou EV"; claritromicina "VO/EV"; antibióticos "IV ou VO".
- **Pó para reconstituir.** Alteplase, ceftriaxona, ampicilina, aciclovir, omeprazol, hidrocortisona, metilprednisolona, vancomicina e outros. Pela ML3 a ML5, ficam sem mL. A tenecteplase já tem a tabela de mL da diretriz.
- **Infusão com preparo próprio.** Já tem mL/h pelo Anexo 1 ou pela fonte citada. A dose de ataque ao lado é que fica sem mL (esmolol, diltiazem, amiodarona, terceira linha do estado de mal, quetamina, omeprazol).

## 2. Decisões para o RT (A recomendada)

- **MA1. Cadastro das ampolas.** A: um cadastro só para criança e adulto, porque as ampolas à venda são as mesmas, e as bulas já lidas valem para os dois. O adulto ganha a própria lista de itens (`adulto-<tela>:<id>`). B: cadastro separado do adulto.
- **MA2. Itens em texto livre.** A: no lote de cada tela, a dose do texto vira número, unidade e via, com a mesma frase na tela. A ficha sobe de versão e você aprova. B: o texto fica e a escolha da ampola recebe o número à parte (dois lugares com o mesmo número).
- **MA3. Item sem via escrita.** A: no lote de cada tela, eu listo os itens e você confere a via na fonte, como fez com o tranexâmico e a fenitoína. Até lá, ficam sem mL. B: sem mL para sempre.
- **MA4. Via mista.** A: a mesma regra da pediatria, com o volume da forma injetável e o aviso de via mista. B: sem mL.
- **MA5. Infusões com preparo próprio.** A: o mL/h atual não muda; só a dose de ataque ou o bolo ao lado ganha a escolha da ampola. B: rever também os preparos.
- **MA6. Pó para reconstituir.** A: sem mL, como na pediatria (ML3 a ML5). B: mL depois da reconstituição da bula.
- **MA7. Ordem dos lotes.** A:
  - A0, o cadastro único e a lista do adulto;
  - A1, PCR e arritmias;
  - A2, anafilaxia, sedação, agitação, abstinência e analgesia;
  - A3, intoxicações e antídotos;
  - A4, cardiologia, anticoagulação, endócrino e AVC;
  - A5, antibióticos, só as soluções prontas, porque os pós ficam fora pela MA6;
  - A6, o resto (cefaleia, cólica e outras).

## 3. Bulas

As bulas lidas na pediatria (lotes 1 a 7) valem para as mesmas ampolas no adulto. Cada lote lista as que faltam, com o link pelo número do registro da CMED. Para as que já temos, não há download novo.

## 4. Riscos

- Converter texto em número (MA2) pode mudar o que a tela diz. Por isso cada ficha sobe de versão e passa pela sua aprovação.
- Diferença de concentração entre ampolas (ex.: morfina de 0,1 a 10 mg/mL): nenhuma vem marcada, como na pediatria.
- O adulto não tem limite de peso para dose fixa. A trava de 30 a 250 kg da intubação (H5) continua só onde a dose é por peso.
