# Azul de metileno no adulto: diagnóstico

**Pedido do RT:** fora do backlog desde a revisão PubMed (H7). Incluído em 11/11/2026 como P2 ("Pedidos do RT em 11/11/2026", item 3).

Este documento é só diagnóstico, sem código. As doses vêm do texto completo das duas diretrizes da AHA, nos PDFs que o RT entregou para o H7:
- AHA 2023: Lavonas EJ et al., Circulation 2023;148:e149–e184, PMID 37721023;
- AHA 2025: Cao D et al., Parte 10, Circulation 2025;152(suppl 2):S578–S672, PMID 41122889.

## Como é hoje

- **Criança:** "Doses por peso" (`src/clinico/pediatria/bolus.ts:269`) traz o azul de metileno na metemoglobinemia: 1–2 mg/kg, azul de metileno 1% = 10 mg/mL. A fonte é o livro do ICr, p. 102. A anafilaxia refratária da criança também o usa (`anafilaxia.ts:38`).
- **Adulto:** a ferramenta de antídotos (`src/clinico/adulto/intoxicacoes.ts`) não tem metemoglobinemia nem azul de metileno. A conferência do H7 com a AHA (`docs/clinico/H7-AHA-DOSE-POR-DOSE.md`) listou essa falta.
- **Não conferi** se o manual do HC (caps. 97–99) traz a metemoglobinemia. A ferramenta segue o manual e não tem a linha, então provavelmente não traz, mas isso não foi lido.

## O que a AHA diz (texto completo)

**Dose** (AHA 2023, Tabela 2, p. e155; AHA 2025, Tabela 4, p. S633):
- indicações na tabela: metemoglobinemia e bloqueador de canal de cálcio;
- dose inicial do adulto: 1–2 mg/kg, repetida a cada hora se necessário;
- manutenção de 1 mg/kg/h, só para o choque vasodilatador;
- dose máxima: 5–7 mg/kg na AHA 2023 e **7 mg/kg** na AHA 2025.

**Recomendações na metemoglobinemia com risco de vida** (AHA 2025, p. S649; as mesmas classes na AHA 2023, p. e167):
- azul de metileno deve ser administrado: classe 1, nível B-NR;
- exsanguineotransfusão, se não responder ao azul: 2b, C-EO;
- oxigênio hiperbárico, se não responder ao azul: 2b, C-EO;
- ácido ascórbico, quando o azul for contraindicado ou não houver: 2b, C-EO. A AHA 2023 o classificava como sem benefício;
- N-acetilcisteína não é recomendada: 3, sem benefício, B-R.

**Cuidado:** na deficiência de G6PD, o azul pode não funcionar ou causar hemólise (AHA 2023, texto da seção de metemoglobinemia).

**No bloqueador de canal de cálcio:** o azul aparece como opção no choque vasoplégico refratário, com classe 2b nas duas diretrizes. Ficou fora do pedido.

## Opções

- **A. Linha nova no adulto, só para a metemoglobinemia (recomendada).** "Azul de metileno (metemoglobinemia com risco de vida)" na ferramenta de antídotos do adulto, com fonte na AHA 2025 e na AHA 2023:
  - 1–2 mg/kg IV, repetível a cada hora, até 7 mg/kg, com a conta em mg pelo peso;
  - os cuidados: G6PD, exsanguineotransfusão ou oxigênio hiperbárico se refratária, ácido ascórbico só sem o azul, N-acetilcisteína não.
  - O volume em mL não é calculado: nenhuma fonte de adulto lida dá a apresentação. A tela diz para conferir na bula do produto disponível.
- **B. A, mais uma nota no bloqueador de canal de cálcio:** azul de metileno no choque vasoplégico refratário, classe 2b, com a dose da tabela (1–2 mg/kg e manutenção de 1 mg/kg/h).
- **C. Só uma nota sem dose,** apontando a AHA.

## Decisão do RT

| Pergunta | Recomendação | Decisão |
|---|---|---|
| Azul de metileno no adulto | A | A (11/11/2026): linha nova só para a metemoglobinemia |
