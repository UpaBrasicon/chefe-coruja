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

## 4. Decisão do RT (10/11/2026)

A em N1, N2, N3 e N4:
- **N1:** o servidor gera o nome "Não identificado <prontuário>".
- **N2:** a recepção registra sexo aparente, idade estimada em anos e
  "sinais e quem trouxe" (até 500 letras), tudo opcional. A idade estimada
  usa `data_nascimento_estimada`; sem ela, as travas de hoje continuam.
- **N3:** marca própria `identidade_desconhecida`, separada do "sem
  documento" da regulação, com selo nas filas da triagem, do PS e da
  internação.
- **N4:** ação "Identificar paciente" na recepção e no cadastro, com busca
  de duplicata antes de gravar e pedido de unificação pelo fluxo que já
  existe.

## 5. Implementação

**Migration** `supabase/migrations/20270322000001_paciente_nao_identificado.sql`
(só aditiva, idempotente):
- `pacientes.identidade_desconhecida` (boolean, padrão falso) e
  `pacientes.sinais_identificacao` (texto, até 500 letras), mais um índice
  parcial dos marcados ativos.
- Tabela `public.pacientes_identidade_provisoria`, o histórico da identidade
  provisória, com uma linha por cadastro:
  - guarda o prontuário, o nome provisório, os sinais, o sexo aparente e a
    idade estimada, além de quem cadastrou e quando;
  - na identificação, ganha quem identificou, quando e se a pessoa confirmou
    "é outra pessoa";
  - com RLS: lê quem lê o paciente (as mesmas políticas de `pacientes`);
    ninguém grava direto, só as funções; anon não tem acesso.
- `public.registrar_nao_identificado(p_setor, p_queixa, p_sexo,
  p_idade_estimada, p_sinais, p_prioridades)`: cria o cadastro com o nome
  provisório, a marca, os sinais e a idade estimada, e abre a ficha por
  `registrar_ficha` (mesmas regras de porta e plantão). Grava a linha do
  histórico.
- `public.identificar_paciente(p_paciente, p_dados, p_outra_pessoa)`:
  - mesmo CPF ou CNS em outro cadastro sempre bloqueia;
  - mesmo nome e nascimento bloqueia até confirmar que é outra pessoa;
  - com candidato, não grava e devolve a lista;
  - sem candidato, completa a linha do histórico, grava, tira a marca e os
    sinais do cadastro e apaga a marca de idade estimada quando vem a data
    real.
- Auditoria por `private.registrar_auditoria`, sem dado de pessoa:
  - `cadastrar_nao_identificado` leva o id do paciente e o setor;
  - `identificar_paciente` leva o id do paciente e os nomes dos campos
    alterados.
- `public.pacientes_nao_identificados(p_unidade)`: a lista da recepção
  (recepção ou gestor da unidade).
- `salvar_cadastro_paciente`: recusa trocar o nome de quem está marcado
  ("use Identificar paciente"). Troca de trecho no texto atual da função.

**Telas**
- Recepção: botão "Não identificado" (só na UPA) e a lista "Não
  identificados na unidade", com Identificar e o pedido de unificação.
- Cadastro do paciente nos documentos (`SeletorPaciente`): selo e botão
  "Identificar paciente".
- Selo "Não identificado" com os sinais na fila da triagem, na espera do
  médico, no cabeçalho da classificação, na fila do PS e na lista de
  internados.

**Testes**
- `supabase/tests/paciente_nao_identificado.sql`: 43 conferências, mais os
  privilégios e a RLS do histórico.
- `src/domain/naoIdentificado.test.ts`: 6 testes das regras da tela.

**Rollback** (no cabeçalho da migration):
1. Reaplicar `salvar_cadastro_paciente` de `20261003000003`.
2. DROP das três funções novas e do índice.
3. DROP da tabela `pacientes_identidade_provisoria`. Isso apaga o
   histórico: exportar antes, se já houver uso real.
4. As colunas ficam; tirá-las só numa janela declarada.
