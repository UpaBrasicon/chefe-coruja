# Lacuna 1: paciente não identificado na recepção (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 1 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `1.nao_identificado` (paciente #15, trazido pelo SAMU, inconsciente e sem
documento).

## 1. Estado atual (lido do master em 10/11/2026)

**Ficha da recepção.**
- `registrar_ficha` exige nome com 3 letras ou mais no cadastro novo
  (`supabase/migrations/20261003000003_cadastro_paciente.sql:215`). A tela
  exige o mesmo (`src/pages/recepcao/Recepcao.tsx:458`).
- A própria tela promete o caminho que não existe: "Paciente sem
  identificação pode ser cadastrado com o que se sabe" (`Recepcao.tsx:571`).
- Hoje a recepção inventa um nome para conseguir abrir a ficha.

**Tabela `pacientes`.**
- Só o nome é obrigatório; nascimento, sexo, CPF, CNS e prontuário aceitam vazio.
- O prontuário (AAAA.NNNNNN) sai do servidor, em sequência por unidade e por ano.

**Precedente: recém-nascido** (`cadastrar_rn`, decisões do RT de 16/10/2026).
- O nome é gerado no servidor ("RN 1 de <mãe>").
- O cadastro é auditado.
- O nome próprio entra depois, pela edição normal do cadastro.

**Regulação.**
- "Não identificado" na regulação quer dizer "sem CNS e sem CPF"
  (`private.paciente_tem_documento`). A marca fica gravada no pedido e não é
  atualizada depois.
- É outra coisa: quem tem nome e não tem documento também é "não
  identificado" ali.

**Reidentificação.**
- Hoje é a edição do cadastro (`salvar_cadastro_paciente`).
- A auditoria guarda só os nomes dos campos alterados, não os valores: o
  nome provisório se perde.
- Na edição não há checagem de nome + nascimento: se o desconhecido for uma
  pessoa já cadastrada, nasce uma duplicata sem aviso.
- Juntar com o cadastro antigo é a unificação: a recepção pede e outro
  gestor aprova. É recusada se os dois cadastros tiverem atendimento aberto.

**Travas clínicas que continuam valendo, por decisão do RT:**
- Classificação: sem data de nascimento, o enfermeiro escolhe adulto ou
  pediatria à mão.
- Prescrição: qualquer medicamento exige data de nascimento ou idade
  estimada, mais o peso aferido, estimado ou referido neste atendimento.
  Não há exceção de emergência; o RT confirmou que a trava fica.
- Idade desconhecida nunca vira adulto por padrão.

**Vários desconhecidos ao mesmo tempo.**
- Sem data de nascimento, o selo "Mesmo nome e nascimento" e a checagem de
  duplicata ficam desligados. Hoje só o prontuário separa um do outro.

**Faturamento e RNDS.**
- Sem sexo ou sem nascimento, a linha sai do BPA-I. A marca
  `sem_documento` já existe para o SIA.
- A regulação sem documento não vai à RNDS.

## 2. Pontos para o RT decidir

### N1. Nome provisório
- **A (recomendada):** o servidor gera o nome, como no recém-nascido:
  "Não identificado" mais o número do prontuário (ex.: "Não identificado
  2026.000123"). Não colide com outro cadastro, aparece igual em todas as
  telas e não depende do que a recepção digitar.
- **B:** a recepção digita um apelido livre ("homem, camisa azul").

### N2. O que a recepção registra no cadastro provisório
- **A (recomendada):** sexo aparente (opcional), idade estimada em anos
  (opcional) e um campo de texto com sinais e quem trouxe (ex.: "SAMU,
  ocorrência 123; tatuagem no braço direito").
  - A idade estimada usa o registro que já existe
    (`data_nascimento_estimada`). Na triagem, ela já decide adulto ou
    pediatria, e na prescrição já vale como idade.
  - Sem idade estimada, valem as regras de hoje: a triagem escolhe o grupo
    à mão, e a prescrição pede a idade estimada.
- **B:** só a marca e o nome provisório; o resto fica com a enfermagem e o
  médico.

### N3. Marca no cadastro
- **A (recomendada):** marca própria no cadastro, "identidade
  desconhecida", separada do "sem documento" da regulação.
  - A marca aparece como selo nas filas da triagem, do PS e da internação,
    com os sinais do N2.
  - Ela sai quando a pessoa for identificada.
  - A regulação, a RNDS e a API continuam como hoje.
- **B:** sem marca nova; o nome provisório já basta.

### N4. Identificar depois
- **A (recomendada):** uma ação própria "Identificar paciente", na
  recepção e no cadastro.
  - Pede o nome e, se houver, o nascimento, o sexo e os documentos.
  - Antes de gravar, procura cadastro com o mesmo CPF ou CNS, ou com o
    mesmo nome e nascimento. Se achar, oferece juntar os dois pelo pedido de
    unificação que já existe, que outro gestor aprova.
  - O nome provisório e os sinais ficam guardados no histórico do cadastro,
    com quem identificou e quando.
- **B:** continuar pela edição comum do cadastro, como hoje.

## 3. Fora do escopo desta lacuna
- **Pulseira:** é a lacuna 2. A pulseira do não identificado sai com o nome
  provisório.
- **Chegada regulada:** a chegada de paciente sem documento continua criando
  cadastro novo no destino, como hoje.
- **Regra de prescrição:** a trava de idade e peso não muda.
