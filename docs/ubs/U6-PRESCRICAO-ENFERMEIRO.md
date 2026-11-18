# Prescrição do enfermeiro pelo protocolo do município (U6, PR 3b): diagnóstico (18/11/2026)

Decisão P2 = B do plano (`docs/ubs/U6-U7-PLANO.md`): o enfermeiro prescreve pelos protocolos do município.

**Decisões do RT (18/11/2026): R1 = A, R2 = A, R3 = A, R4 = A, R5 = A.**

## Base legal

- Lei 7.498/1986, art. 11, II, c, e Decreto 94.406/1987, art. 8º, II, c: o enfermeiro, como integrante da equipe, prescreve medicamentos estabelecidos em programas de saúde pública e em rotina aprovada pela instituição de saúde.
- PNAB, Portaria de Consolidação nº 2/2017, Anexo XXII: entre as atribuições do enfermeiro, prescrever medicações conforme protocolos, diretrizes clínicas e terapêuticas, ou outras normativas técnicas estabelecidas pelos gestores federal, estadual, municipal ou do Distrito Federal.
- Portaria SVS/MS 344/1998: a receita de controle especial e a notificação de receita são de prescritor habilitado. O enfermeiro não prescreve controlado.

Estes textos foram escritos de memória. Antes de valer, cada um precisa ser conferido com a publicação oficial, como as fichas clínicas.

## O que o app tem hoje

- **Protocolos de receita da unidade** (`receita_protocolos`, migrations 20261005000002 e 20261007000002):
  - o gestor escreve o protocolo na tela "Protocolos";
  - cada protocolo tem nome, indicação, versão, fonte e itens (medicamento, posologia e quantidade);
  - para publicar, versão e fonte são obrigatórias, e cada gravação guarda uma versão (só inserção);
  - o médico vê os protocolos no Receituário e escolhe item a item.
- **Receita da consulta:** fica na aba "Atestado e receita" e é emitida por `emitir_documento` ou pelo rascunho. `private.faltas_documento` confere três coisas:
  - posologia em cada item;
  - alergia que trava o medicamento;
  - na receita de controle especial, quantidade e registro no conselho.
- **Lacuna:** o banco não confere o papel de quem emite a receita. Basta estar de plantão no setor do paciente. A consulta de enfermagem não mostra a aba de receita, mas o banco aceitaria.

## Decisões para o RT

**R1. Onde mora o protocolo do enfermeiro**
- **A:** nos mesmos "Protocolos de receita" do gestor, com a marca "Protocolo de enfermagem do município". Para publicar, exige o documento de origem: número, data e órgão (ex.: "Protocolo de Enfermagem na Atenção Primária, SMS, Portaria nº…").
- **B:** uma tela e uma tabela separadas só para a enfermagem.

**R2. O que o enfermeiro pode mudar no item**
- **A:** nada. Medicamento, posologia e quantidade saem como estão no protocolo publicado.
- **B:** só a quantidade, dentro do protocolo.

**R3. Controlados (Portaria 344)**
- **A:** o enfermeiro nunca prescreve item de controle especial, nem que esteja no protocolo. O banco recusa.
- **B:** segue a regra geral da receita.

**R4. Onde fica na consulta de enfermagem**
- **A:** uma aba "Receita" na consulta de enfermagem, só com os protocolos de enfermagem publicados. Sem atestado e sem texto livre.
- **B:** a aba "Atestado e receita" inteira, como a do médico.

**R5. A lacuna do papel**
- **A:** o banco passa a exigir que a receita seja do médico ou, na consulta de enfermagem, do enfermeiro pelo protocolo. Os outros papéis não emitem receita.
- **B:** deixar como está.

## Como ficaria (se R1 a R5 = A)

Um PR, como os outros do U6:

- **Banco:**
  - `receita_protocolos` ganha a marca de enfermagem e o documento de origem;
  - a publicação exige o documento de origem;
  - a trava na emissão da receita: quem não é médico só emite na consulta de enfermagem, com cada item igual a um item de protocolo de enfermagem publicado, e sem controle especial.
- **Tela:**
  - Protocolos (gestor): a marca e o documento de origem;
  - consulta de enfermagem: aba "Receita" com os itens do protocolo para escolher;
  - a folha da receita sai em nome do enfermeiro, com o registro no conselho do perfil.
- Testes de banco e de tela, homologação, PR com CI verde, ok produção.
