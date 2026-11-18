# U11: parto, puerpério e recém-nascido (plano, 18/11/2026)

Decisão U11 = A do diagnóstico (`docs/ubs/PERCURSO-UBS-DIAGNOSTICO.md`, achados A8, A9, A10 e E4):
- o parto ou o aborto registrado no hospital ou na UPA fecha a gestação na UBS de origem;
- o recém-nascido entra na puericultura da UBS da mãe;
- a data de nascimento passa a ser obrigatória;
- a DUM é conferida contra parto recente da mesma mulher.

**Decisões do RT (18/11/2026):**
- **N1, decidida pelo RT nas palavras dele** (nem A nem B como estavam):
  - quando o RN é cadastrado no hospital, a UBS da mãe recebe um aviso e um cadastro em segundo plano. Na primeira consulta, a criança já tem cadastro;
  - o RN aparece sozinho na puericultura, com o alerta "ainda não veio à UBS" e os dados da mãe (nome e telefone), para a UBS entrar em contato;
  - se a criança nascer fora do sistema e a mãe foi acompanhada no pré-natal da UBS, a puericultura fica em aberto. Ao chegar a DPP sem parto registrado, ela alerta para procurar a mãe.
- **N2 = A:** a data de nascimento fica obrigatória só na UBS.

## O que o app tem hoje

- **Não existe registro estruturado de parto, aborto ou nascimento.** Os sinais que existem:
  - o cadastro do recém-nascido no hospital (`cadastrar_rn`), com a mãe (`mae_id`) e a data de nascimento. O RN fica na unidade da mãe, isto é, no hospital;
  - o CID de alta da internação (`internacoes.cid_alta`) e do desfecho da porta da UPA.
- **Gestação na UBS** (`pre_natal_gestacoes`, por unidade):
  - fecha à mão (`pre_natal_registrar_desfecho`) ou pelo CID ou CIAP de aborto numa consulta da própria UBS;
  - um CID de parto ou aborto na UPA ou no hospital nunca fecha.
- **A mesma mulher em outra unidade** (o cadastro é por unidade):
  - `private.regulacao_mesmo_paciente` acha o cadastro na mesma rede por CNS, CPF ou unificação;
  - a contrarreferência já usa isso para avisar a UBS da alta.
- **Puericultura:** a criança entra só por cadastro ativo na própria UBS, com data de nascimento e menos de 2 anos. Sem data, não entra.
- **Data de nascimento:** é opcional no cadastro (`registrar_ficha`). Só o cadastro do RN a exige.
- **DUM:** nenhuma validação compara a DUM com parto ou RN anterior da mesma mulher. Daí o achado E4: gestante com bebê de 3 meses e 21 semanas de gestação, aceita sem aviso.

## Plano em PRs

**PR 1. DUM e data de nascimento**
- **DUM:** a DUM não pode cair antes do último parto ou aborto da mesma mulher. Valem dois registros:
  - o desfecho de gestação anterior na UBS;
  - o nascimento de RN ligado a ela (`mae_id`) em qualquer cadastro da rede.

  A regra vale nos quatro pontos onde a DUM entra: inclusão no pré-natal, correção da DUM, escuta inicial e abertura pela consulta. Essa conta não depende de escolha: a DUM antes do parto é impossível.
- **Data de nascimento obrigatória na UBS** (N2): na ficha da UBS, cadastro sem data de nascimento não abre ficha. A tela marca o campo com asterisco.

**PR 2. A gestação fecha pelo que vem de fora**
- O parto fecha a gestação ativa nas UBS da rede onde a mulher tem cadastro (CNS, CPF ou unificação). O sinal do parto é um destes:
  - o cadastro do RN no hospital (`cadastrar_rn`), com a data do nascimento;
  - a alta da internação ou o desfecho da UPA com CID O80 a O84.
- O aborto é a alta ou o desfecho com CID O00 a O08.
- O fechamento fica na auditoria com a origem ("hospital" ou "UPA"). A UBS já recebe a contrarreferência.
- Sem CNS, CPF nem unificação, a UBS não é achada e a gestação continua aberta. A UBS fecha à mão, como hoje.

**PR 3. O recém-nascido na puericultura da UBS da mãe** (N1)
- **RN do hospital:**
  - o `cadastrar_rn` cria, em segundo plano, o cadastro do RN na UBS da mãe, achada por CNS, CPF ou unificação;
  - o cadastro leva "RN de <mãe>", a data de nascimento, o sexo e a mãe ligada, e fica marcado como "cadastro vindo do hospital";
  - a UBS recebe o aviso.
- **Puericultura:**
  - o RN aparece sozinho, com o alerta "ainda não veio à UBS" e os dados da mãe (nome e telefone) até a primeira consulta;
  - na chegada, a recepção completa o cadastro: nome, CNS e CPF.
- **Bebê esperado:**
  - a gestação da UBS que passa da DPP sem parto registrado entra na puericultura como "bebê esperado de <mãe>, DPP tal";
  - o alerta é "procurar a mãe", com os dados dela;
  - sai quando o parto é registrado ou quando a UBS dá a saída.

Ordem: PR 1, PR 2, PR 3.

## Decisões para o RT

**N1. Como o RN chega à UBS da mãe**
- **A:** o cadastro do RN no hospital cria também o cadastro na UBS da mãe.
  - Os dados são "RN de <mãe>", a data de nascimento, o sexo e a mãe ligada.
  - O RN aparece sozinho na puericultura.
  - A recepção da UBS completa o nome, o CNS e o CPF na primeira consulta.
- **B:** a UBS recebe um aviso ("nasceu o RN de <mãe>, no hospital tal, em tal data"), e a recepção cadastra o bebê.
  - Não há cadastro automático.
  - Há risco de o bebê não ser cadastrado.

**N2. Onde a data de nascimento fica obrigatória**
- **A:** só na UBS. Na UPA e no hospital continua opcional, por causa do paciente não identificado da emergência.
- **B:** em todas as unidades.
