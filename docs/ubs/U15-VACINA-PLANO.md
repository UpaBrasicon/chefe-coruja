# U15: vacina na UBS (plano, 19/11/2026)

Decisão V3 = A do diagnóstico do U15 (`docs/ubs/U15-DIAGNOSTICO.md`): a vacina entra no app. O registro vai à Ficha de Vacinação do SISAB e ao RIA da RNDS, e conta nos painéis. Este documento é só plano, sem código. As decisões VC1 a VC7 têm opções A e B.

## O que a vacina precisa ter

**Ficha de Vacinação do LEDI APS 8.7.0** (tipo 14; IDL oficial `ficha_vacinacao.thrift`, laboratoriobridge/esusaps-integracao, commit 9316f280f526). Para cada vacina:
- imunobiológico (código do e-SUS), estratégia, dose, lote, fabricante (código RNDS) e grupo de atendimento;
- via e local de aplicação;
- pesquisa clínica (sim ou não).

O registro tem de seguir a tabela do LEDI que liga o imunobiológico à estratégia e à dose. Quem registra é um profissional da Tabela 12 de CBOs. O atendimento leva também:
- a condição maternal: nenhuma, gestante ou puérpera, obrigatória no sexo feminino;
- o viajante;
- o comunicante de hanseníase, só na BCG.

**Registro anterior (caderneta).** A ficha aceita a vacina aplicada antes, com a data e sem lote nem fabricante (`stRegistroAnterior`).

**CPF.** A Ficha de Vacinação exige o CPF. Sem ele, vai o CNS com uma justificativa da lista do LEDI: recém-nascido, indígena sem CPF, pessoa em situação de rua, estrangeiro e outras. A mesma regra vale para a Ficha de Atendimento Individual e a de Procedimentos (U15, PR 3). Hoje o paciente só com CNS vai sem justificativa e pode ser recusado pelo PEC.

**RNDS.** O RIA de rotina (Registro de Imunobiológico Administrado). As notas da SAPS aceitam o registro da vacina pela Ficha de Vacinação (MIV) ou pelo RIA da RNDS.

## Vacinas que contam nos indicadores (notas SAPS, junho de 2026)

| Indicador | Vacina | Códigos de imunobiológico da nota |
|---|---|---|
| C2 Criança | Esquema primário com todas as doses: pentavalente (3), VIP (3), SCR e pneumocócica (2) | 09, 17, 29, 39, 42, 43, 46, 47, 58 (componentes da penta); 22, 29, 43, 58 (VIP); 24, 56 (SCR/SCRV); 26, 59, 106, 107 (pneumo) |
| C3 Gestação | dTpa adulto, 1 dose em cada gestação, a partir da 20ª semana | 57 |
| C6 Pessoa idosa | Influenza, 1 dose nos últimos 12 meses | 33, 77 |
| C7 Mulher | HPV, pelo menos 1 dose de 9 a 14 anos (sexo feminino) | HPV (código da tabela do LEDI) |

Hoje esses itens contam zero no app (U13, G1 = A: "fora do app").

## Decisões para o RT

**Decidido pelo RT em 19/11/2026: VC1 a VC7 = A.** O plano em PRs abaixo vale como está.

**VC1. Quais vacinas o app registra**
- **A:** todas as da tabela de imunobiológicos do LEDI 8.7.0, com a regra de imunobiológico, estratégia e dose do LEDI. A sala de vacina usa só o app.
- **B:** só as que contam nos indicadores (C2, C3, C6 e C7). O resto continua no PEC do município.

**VC2. Quem registra**
- **A:** técnico de enfermagem e enfermeiro (sala de vacina), pelos CBOs da Tabela 12.
- **B:** também o médico.

**VC3. Lote e fabricante**
- **A:** cadastro de lotes da UBS (imunobiológico, lote, fabricante RNDS e validade), escolhido na aplicação. O lote vencido não aparece. Sem controle de estoque.
- **B:** digitados a cada aplicação.

**VC4. Caderneta antiga**
- **A:** transcrever a vacina aplicada antes, com a data (registro anterior). Conta nos painéis e vai ao SISAB como registro anterior.
- **B:** só a vacina aplicada na UBS.

**VC5. Calendário e aprazamento**
- **A:** só o registro. Os painéis mostram a vacina que falta para o indicador (C2, C3, C6 e C7), pelas regras das notas.
- **B:** também o aprazamento da próxima dose pelo Calendário Nacional de Vacinação do PNI. É conteúdo clínico: pede a fonte citada e a aprovação na Revisão Clínica (LG10).

**VC6. RNDS (RIA)**
- **A:** pelo app, com a mesma escolha da UBS do U15 V5 (`rac_aps_pelo`: app ou PEC).
- **B:** só pelo PEC do município.

**VC7. CPF**
- **A:** a recepção da UBS pede o CPF. Sem CPF, pede a justificativa da lista do LEDI. A ficha sem CPF e sem justificativa fica retida. Vale para todas as fichas do SISAB.
- **B:** o app manda só quem tem CPF e retém os demais, sem pedir justificativa.

## Plano em PRs (se VC1 a VC7 = A)

1. **Tabelas de referência:** imunobiológico, estratégia, dose, grupo de atendimento, fabricante, via, local de aplicação e a relação imunobiológico × estratégia × dose, do LEDI 8.7.0, no banco. Feito na migration `20270415000025_ubs_u15_vacina_referencias.sql` (schema `terminologia`, 871 regras). A influenza tetravalente (77) e o HPV nonavalente (93) não têm regra no LEDI: no app, só como registro anterior. Os códigos de HPV são 60 (bivalente), 67 (quadrivalente) e 93 (nonavalente).
2. **CPF (VC7):** justificativa na recepção da UBS e nas fichas FAI e FP já existentes. Feito na migration `20270415000026_ubs_u15_cpf_justificativa.sql`: o motivo fica em `pacientes.cpf_justificativa`, a tela da recepção da UBS pede, e a ficha sem CPF e sem motivo fica retida no SISAB. O banco não trava a ficha do atendimento.
3. **Lotes da UBS (VC3).** Feito na migration `20270415000027_ubs_u15_vacina_lotes.sql` e na tela "Lotes de vacina" (gestor e enfermeiro da UBS): imunobiológico com regra no LEDI, lote no formato do LEDI, fabricante da RNDS e validade; o vencido e o desativado não vão à sala de vacina.
4. **Sala de vacina:**
   - tela do técnico de enfermagem e do enfermeiro, com a regra da tabela;
   - caderneta do paciente com o registro anterior (VC4).
   Feito na migration `20270415000028_ubs_u15_sala_vacina.sql` e na tela "Sala de vacina" (`/vacina`): técnico de enfermagem e enfermeiro de plantão na UBS; aplicação com a regra do LEDI e o lote da UBS na validade; transcrição sem lote e com a data; cancelar com motivo.
5. **Painéis:** C2, C3, C6 e C7 passam a contar a vacina, e o Painel do Gestor deixa de mostrar a vacina como "fora do app". Feito na migration `20270415000029_ubs_u15_vacina_paineis.sql`: C2 (E) pelo esquema primário da nota (doses com 30 dias de intervalo; pentavalente por componente; tríplice viral só depois dos 12 meses), C3 (F) dTpa a partir da 20ª semana, C6 (D) influenza em 12 meses e C7 (B) HPV (67 ou 93) dos 9 aos 14 anos. Conta a aplicação e a transcrição; o cancelado não conta.
6. **Ficha de Vacinação (SISAB):** fila, carga e montagem no Thrift oficial, tipo 14. Feito na migration `20270415000030_ubs_u15_ficha_vacinacao.sql` e em `fichaFv`; detalhes e o que fica em aberto em `docs/ubs/U15-LEDI-FICHAS.md`.
7. **RIA (RNDS):** pelo modelo oficial da RNDS e pela escolha app/PEC.

O envio real ao SISAB e à RNDS continua dependendo do município e da credencial, como no resto do U15.

## Fontes

- [LEDI APS 8.7.0, Ficha de Vacinação](https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/estrutura_arquivos/dicionario-fv.html) e o [Dicionário de dados](https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/referencias/dicionario.html) (imunobiológico, estratégia, dose, justificativa sem CPF)
- IDL oficial: `thrift/layout-ras/thrift/ficha_vacinacao.thrift` em [laboratoriobridge/esusaps-integracao](https://github.com/laboratoriobridge/esusaps-integracao), commit 9316f280f526
- Notas metodológicas C2, C3, C6 e C7 da SAPS (junho de 2026), as mesmas do U13
