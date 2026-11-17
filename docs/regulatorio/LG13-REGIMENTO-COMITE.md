# LG13: regimento do comitê clínico (rascunho, 17/11/2026)

Decisões do RT em 17/11/2026: K1 a K6 = A (`LG13-COMITE-CLINICO-DIAGNOSTICO.md`). Este regimento é rascunho técnico. Passa pelo RT e pelo consultor do LG11 antes de valer.

## 1. Para que serve

O comitê aprova as regras clínicas do módulo clínico (fichas, escores, condutas e avisos) antes de irem ao ar. Cada profissão revisa a sua parte.

## 2. Composição

| Papel | Conselho | Revisa |
|---|---|---|
| Responsável técnico médico (coordena) | CRM | todas as fichas |
| Farmacêutico revisor | CRF | ficha com dose, volume, diluição ou infusão |
| Enfermeiro revisor | COREN | fichas de enfermagem e de classificação de risco |

- A nomeação é feita no sistema (`responsaveis_tecnicos`), com o número no conselho, e cada decisão sai com o login de quem decidiu.
- Os revisores são contratados por hora, sem vínculo com cliente (K3).
- Pode haver suplente para cada papel. O suplente segue as mesmas regras.

## 3. Conflito de interesse

- Ninguém revisa uma ficha que escreveu sozinho.
- O revisor declara, ao ser nomeado, vínculo com fabricante de medicamento ou com cliente. Com vínculo, ele não revisa as fichas ligadas a esse fabricante ou cliente.

## 4. Regra de aprovação (K2)

- **Ficha com dose:** médico e farmacêutico aprovam.
- **Ficha de enfermagem ou de classificação de risco:** médico e enfermeiro aprovam.
- **Outras fichas:** médico aprova.
- A versão só fica "aprovada", e só vai ao ar pelo gate do LG10, quando todas as revisões pedidas estiverem feitas.
- Uma reprovação basta para reprovar. Quem reprova escreve a correção.
- **Enquanto não houver revisor nomeado de uma profissão**, a ficha segue só com o médico, e o sistema guarda que falta aquela revisão. Ela entra na fila retroativa assim que alguém for nomeado.

O mapa do módulo clínico (`modulo-clinico/mapa.json`) diz que revisões cada grupo pede. Mudar uma ficha de grupo passa pelo RT.

## 5. Lista de conferência

**Farmacêutico (ficha com dose):**
1. A dose, a unidade e a via batem com a fonte citada.
2. A dose máxima e a dose por peso têm teto.
3. A faixa de peso e de idade está certa.
4. Na pediatria, a fonte é pediátrica. Nada vem do adulto.
5. A diluição, a concentração e a velocidade de infusão estão certas.
6. Medicamentos de alta vigilância estão marcados.
7. Arredondamento e casas decimais não mudam a dose de forma relevante.

**Enfermeiro (enfermagem e classificação):**
1. A escala bate com a fonte (Fugulin, Dini, Braden, Morse, SAE e outras).
2. Na classificação de risco, o texto deixa claro que a cor é da enfermagem.
3. Os campos pedidos existem no registro de enfermagem.

**Médico (todas):**
1. A fonte é a citada, na edição citada.
2. Os critérios, os cortes e os próximos passos batem com a fonte.
3. O texto não promete o que a fonte não diz.

## 6. Fichas já aprovadas (K4)

- O farmacêutico revisa as fichas com dose já aprovadas, sem tirar nada do ar.
- Ordem: pediatria; depois infusões e alta vigilância; depois o resto.
- Achado que muda a dose vira versão nova corrigida, aprovada por médico e farmacêutico.
- Achado grave, que pode causar dano, tem o mesmo tratamento de um incidente: o plano do LG5 e, depois do LG11, a tecnovigilância (LG12). A unidade pode suspender a ficha (`ferramenta_unidade.oculta`) até a correção.

## 7. Aprovação em lote (K6)

O lote vale só para fichas sem dose e para as notas de referência. A ficha com dose é aprovada uma a uma, com a tela aberta.

## 8. Registro

- Cada revisão fica numa tabela só de inclusão, com quem decidiu, o conselho e o registro, a data, a decisão e a nota. Ninguém apaga nem edita.
- A Revisão Clínica mostra a cada revisor só a fila da sua profissão.
- O comitê se reúne a cada release do módulo clínico (LG11). A ata registra o que entrou e as reprovações.
