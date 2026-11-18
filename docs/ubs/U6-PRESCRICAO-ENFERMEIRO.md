# Prescrição do enfermeiro pelo protocolo do município (U6, PR 3b): diagnóstico (18/11/2026)

Decisão P2 = B do plano (`docs/ubs/U6-U7-PLANO.md`): o enfermeiro prescreve pelos protocolos do município.

**Decisões do RT (18/11/2026): R1 = A, R2 = A, R3 = A, R4 = A, R5 = A.**

## Base legal (conferida no texto oficial em 18/11/2026)

- **Lei 7.498/1986, art. 11, II, c** (planalto.gov.br): como integrante da equipe de saúde, o enfermeiro faz a "prescrição de medicamentos estabelecidos em programas de saúde pública e em rotina aprovada pela instituição de saúde".
- **Decreto 94.406/1987, art. 8º, II, c**: o mesmo, com a palavra "previamente".
- **PNAB, Portaria de Consolidação GM/MS nº 2/2017, Anexo XXII, Anexo 1, item 4.2.1 (Enfermeiro), inciso II**: o enfermeiro prescreve "medicações conforme protocolos, diretrizes clínicas e terapêuticas, ou outras normativas técnicas", estabelecidas pelo gestor federal, estadual, municipal ou do Distrito Federal. Segue vigente.
- **Resolução Cofen 801/2026** (DOU de 22/01/2026), específica da prescrição de medicamentos pelo enfermeiro:
  - art. 2º: a prescrição se fundamenta em protocolos aprovados ou de programas de saúde pública e é feita na consulta de enfermagem;
  - art. 3º, I: a receita traz a identificação do protocolo usado e o ano de publicação;
  - art. 3º, II: a receita traz a instituição e o CNPJ.
  - Situação judicial: a ação do CFM (ACP 1045641-03.2026.4.01.3400) teve a liminar negada em 14/11/2026. A resolução segue em vigor, com o mérito pendente.
- **Portaria SVS/MS 344/1998**:
  - Notificação de Receita: só por inscrito no CRM, CRMV ou CRO (art. 1º);
  - Receita de Controle Especial: "profissionais devidamente habilitados" (art. 55);
  - não há permissão para o enfermeiro.

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

## Implementação (18/11/2026)

- **Migration `20270415000013_ubs_prescricao_enfermeiro.sql`:**
  - `receita_protocolos` ganha `enfermagem` e o documento de origem (número, data e órgão), com CHECK: protocolo de enfermagem publicado sem a origem não grava;
  - `definir_protocolo_enfermagem` é a ação do gestor, com auditoria;
  - `receita_protocolos_da_unidade` devolve a marca e a origem;
  - `private.faltas_receita_papel` entra em `faltas_documento`, que vale para a emissão direta, o rascunho e a sincronização. A receita só sai assim:
    - do médico (plantonista ou telemedicina);
    - ou do enfermeiro, na consulta de enfermagem aberta do paciente, com itens iguais aos do protocolo publicado e sem controle especial.
- **Tela:**
  - Protocolos (gestor): botão "Protocolo de enfermagem", com o documento de origem;
  - consulta de enfermagem: aba "Receita", com os itens do protocolo para escolher;
  - a receita sai com o protocolo e o ano em "Observações" (Cofen 801/2026, art. 3º, I).
  - Criança e paciente sem data de nascimento ficam com o médico, porque o protocolo não separa a dose por idade.
- **Para o RT:** a Cofen 801/2026 (art. 3º, II) pede o CNPJ da instituição na receita. A folha da receita hoje não traz o CNPJ, e é preciso conferir se o cadastro da unidade o tem.
