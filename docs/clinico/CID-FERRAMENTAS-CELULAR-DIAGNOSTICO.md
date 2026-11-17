# Ferramentas pelo CID no atendimento e tela do celular — diagnóstico

Pedido do RT em 17/11/2026. O RT explicou por que pediu as calculadoras e os escores no modelo novo, com dois objetivos:

1. **Celular.** Ao abrir no celular, a tela deve ser diferente: as coisas aparecem de outro jeito, e o RT quer otimizar isso.
2. **CID.** Quando o médico está atendendo e escolhe um CID, aparecem as calculadoras e os escores daquela doença. Exemplos do RT: I20 mostra HEART, TIMI e outros; I64 mostra NIHSS, ABCD2 e outros. Vale "seja na urgência ou UBS".

Decisões do RT na mesma conversa:
- os dois pedidos viram **um item só**;
- o item entra **antes das trilhas LG (obrigatórios legais) e SP (sepse)**.

**Decisões do RT em 17/11/2026:** CF1 a CF9 = A ("Todas A"). O ABCD2 entra só no G45 (AIT), seguindo a fonte. Começa pela F1.

**Leitura da sessão de obrigatórios legais (17/11/2026), aceita pelo RT:** entra com condições, sem esperar nenhum LG. Não muda o caminho 1 nem a classe. O mapa e o preenchimento automático vão para a lista do LG11, para o consultor confirmar. Condições:
- **Rótulo fixo no bloco:** "Atalho para ferramentas de referência. A decisão é do médico."
- **Idade e peso do prontuário (F3):**
  - o campo mostra a origem e a data ("peso do prontuário, 12/11") e continua editável;
  - sem peso, ou com peso velho, o campo fica vazio e pede digitação. Peso velho, decisão do RT: na criança, mais de 24 h; no adulto, mais de 7 dias;
  - idade pelo corte de 13 anos, 11 meses e 29 dias;
  - a dose só aparece depois do clique em calcular.
- **Teste:** prova que o bloco nunca mostra cor, dose ou conduta.
- **Fora da URL:** idade, peso e CID nunca vão no endereço (query ou hash). Conferir que o Sentry e os breadcrumbs não capturam esses campos.
- **Comitê clínico:** o mapa entra na revisão do comitê quando o LG13 existir.

**F5 fora (decisão do RT em 17/11/2026):** abaixo de 1024 px o médico não tem a aba Atendimento (só Central, Leitos, Prontuários e Agenda, `ABAS_ESTREITAS_PLANTONISTA`). O atendimento continua só no computador, com o bloco do CID e o aviso de sepse; no celular fica só a F4, nas ferramentas da Central.

**F4, celular na Central (17/11/2026).** O RT testou no celular e não tem queixa de funcionamento; quer otimizar o visual. Modelos que ele gosta: ANY App e PedAjuda, estudados no Chrome dele. Deles se leva a organização, nunca a marca, as cores ou os textos. Referências do Refero: Clearful (grade de cartões grandes), GrowPal (resultado grande no topo) e Grok (chave de dois lados no topo). Decisões do RT, M1 a M6 = A:
- **M1, início:** grade de cartões grandes, 2 por linha, com ícone e nome curto, um cartão por grupo clínico.
- **M2, dentro do grupo:** busca no topo e lista das ferramentas, com contagem.
- **M3, adulto e criança:** chave fixa no topo, com bebê de um lado e adulto do outro. Um toque troca o lado e zera idade e peso, como a regra de hoje.
- **M4, dentro da ferramenta:** respostas em botões grandes, resultado na faixa de baixo e textos de apoio recolhidos no fim.
- **M5:** vale só no celular; o computador fica como está.
- **M6:** cores da marca, com o contraste reforçado.

Antes do código, um protótipo no tamanho de celular vai ao RT para aprovação.

**F7, pedido do RT em 17/11/2026:** CID de quadro infeccioso com NEWS2 da triagem aumentado abre o aviso "pensar em sepse", que orienta os exames para fechar o diagnóstico.
- Entra neste item, depois da F2.
- O RT liberou uma exceção à regra "nada sugere conduta" da aba Atendimento, só para este aviso. Os exames vêm de fonte citada com página, e nada é pedido sozinho.
- Antes do código: diagnóstico curto com o corte do NEWS2, a lista de CIDs infecciosos e os exames, tudo da fonte (SSC 2026, ILAS). Só adulto.
- **Leitura da sessão legal (17/11/2026): entra com condições.** É apoio à decisão sobre um paciente específico, dentro do SaMD, na mesma categoria do alerta de sepse da internação. O uso novo na porta e na UBS vai como pergunta ao consultor no LG11. Condições:
  - **Mesmo critério:** usa a mesma regra e a mesma ficha do alerta de sepse do adulto (`sepse-adulto`). Não pode haver dois alertas de sepse com regras diferentes.
  - **Texto:** "Pode ser sepse. Considere: <exames com fonte e página>. A decisão é do médico." Sem cor, sem a palavra "diagnóstico", sem exame pré-marcado e sem pedido feito sozinho.
  - **Disparo:** só com o NEWS2 do episódio atual e vitais recentes das últimas 6 h (decisão do RT em 17/11/2026). Sem vitais, não há aviso. Só para 14 anos ou mais.
  - **Registro:** grava que o aviso apareceu e se foi dispensado (episódio, autor do login, hora, motivo opcional), numa tabela só de inserção, com RLS de quem cuida do paciente. É também o dado do SP1 e entra no inventário do LG4.
  - **Desligar por unidade:** pela camada que já existe (`ferramenta_unidade.oculta`), com motivo e auditoria. Vem ligado.
  - **Testes:** a criança nunca recebe o aviso; o aviso nunca aparece sem vitais recentes; os limites do NEWS2 seguem a ficha.

## 1. Como está hoje

### Onde o CID é escolhido no atendimento

A urgência e a UBS usam a mesma tela, `/atendimento`, em `src/pages/plantao/AtendimentoPorta.tsx`, que abre `porta/JanelaAtendimento.tsx`. A UBS é reconhecida por `ep.tipo_atendimento_aps` (`JanelaAtendimento.tsx:59`).

| Lugar | Fluxo | Campo | O que já mostra |
|---|---|---|---|
| Aba Atendimento (`porta/AbaAtendimento.tsx:127`) | urgência e UBS | `soap.cid`, campo `CampoCid` | "CIDs de referência" tirados do texto da Avaliação. O clique só preenche o campo |
| Aba Conduta (`porta/AbaConduta.tsx:50–210`) | só UBS | `problemas` (lista, CIAP-2 ou CID-10) | CID relacionado ao CIAP. Um CID de gestação abre o pré-natal |
| Aba Desfecho (`porta/AbaDesfecho.tsx:143, 294`) | urgência | `cidAlta`, que já vem preenchido com o CID do atendimento | procedimentos SIGTAP do CID |
| Documentos avulsos (pedido de exame, atestado) | os dois | `BuscaCid` | nada |

O que cada aba já tem do paciente:
- **Idade:** a janela calcula a faixa (`faixaEtaria`, `JanelaAtendimento.tsx:179`), e a data de nascimento está no episódio.
- **Peso:** só a aba Prescrição lê o último peso aferido (`AbaPrescricao.tsx:102`).

Uma regra da tela pesa sobre este pedido. O comentário de `AbaAtendimento.tsx:4–6` diz: "Nada aqui sugere cor, dose ou conduta" (decisão do RT, C2 de 06/11/2026).

### Ligação entre CID e ferramenta

Não existe em lugar nenhum, nem no código nem no banco:
- a ficha (`src/clinico/ficha.ts`), o escore e o topo não têm campo de CID;
- o que existe são ligações de outro tipo: texto livre → CID (`cid_termo` e `cid_sugerir_do_texto`), CIAP → CID, CID → SIGTAP, CID → notificação compulsória e CID → gestação;
- na Central há palavras de busca por ferramenta (`tags` do registry) e as relacionadas por grupo de seção.

São 233 ferramentas na Central, 229 com ficha e rota (`ROTA_DA_FICHA`). Entre elas estão 47 escores.

### Como uma ferramenta abre

- Só pela rota `/plantonista/<seção>/<ferramenta>`. Nenhuma janela por cima de outra tela abre uma ferramenta.
- Os componentes não recebem nada por propriedade. Idade, peso e modo (adulto ou criança) vêm da "Central do paciente" (`src/lib/pacienteCentral.ts`), que fica só na memória da aba.
- A ferramenta lê esses dados uma vez, quando abre (`calc/pacienteNaFerramenta.ts`), e mostra o selo "da Central".

### Celular

- Já se adapta:
  - a navegação inferior aparece abaixo de `md`;
  - a faixa flutuante do resultado já sobe acima dessa navegação (`ResumoFlutuante.tsx:38`);
  - o app é PWA e roda instalado, em tela cheia.
- Ainda é tela de computador:
  - **Topo longo antes das entradas:** título, chips "Quando usar" e "Por que usar", situação da ficha e instruções. No celular o médico rola antes de digitar o primeiro dado.
  - **Menu lateral da seção:** só aparece a partir de `lg`. No celular não há como ir de uma ferramenta a outra da seção, só voltar pelo caminho.
  - **Coluna da direita:** "Nesta página" e as relacionadas aparecem só a partir de `xl`. Abaixo disso, as relacionadas vão para o fim da página e "Nesta página" some.
  - **Tabelas:** 66 telas usam tabela e 62 rolam para o lado; as de dose e de referência ficam largas.
  - **Entradas:** as grades de 3 e 4 colunas de campos (cerca de 200) quebram para uma coluna sem ordem pensada.
  - **Atendimento:** a janela tem 12 abas numa linha só, que rola para o lado.

## 2. O que fazer, em frentes

| Frente | O que entrega |
|---|---|
| F1 | **Mapa CID → ferramentas.** Arquivo versionado, cada ligação com a frase e a página da fonte da própria ferramenta. Teste: toda ferramenta citada existe e toda ligação tem fonte |
| F2 | **Bloco "Ferramentas para este CID"** na aba Atendimento (urgência e UBS) e na Conduta da UBS. Aparece assim que o CID é escolhido e filtra adulto ou criança pela idade do paciente |
| F3 | **Ferramenta aberta por cima do atendimento,** sem sair dele, já com idade, peso e modo do paciente (selo "do atendimento"). O "Copiar" leva o resultado |
| F4 | **Celular nas ferramentas:** entradas primeiro, topo recolhido, tabelas largas viram lista, navegação da seção numa gaveta |
| F5 | **Celular no atendimento:** abas que cabem na tela e o bloco do CID à vista |
| F6 | **Aprovação do mapa** pelo RT na Revisão Clínica, com versão própria, coberto pelo gate do LG10 |

## 3. Decisões para o RT (A recomendada)

**CF1 — Onde fica o mapa CID → ferramentas**
- A) Num arquivo do código (`src/clinico/cidFerramentas.ts`), com versão própria aprovada na Revisão Clínica, como as fichas. O gate do LG10 obriga versão nova a cada mudança.
- B) Numa tabela do banco que o RT edita por uma tela. Exige tela de edição, auditoria e RLS próprias.

**CF2 — Como o CID casa com a ferramenta**
- A) Por categoria de 3 caracteres e por faixa (ex.: I20–I25, I63–I64, G45). Um código completo (I21.0) herda a categoria.
- B) Código a código, só os completos.

**CF3 — O que justifica pôr uma ferramenta num CID**
- A) A fonte citada da própria ferramenta: o "Quando usar" do topo ou a ficha precisa falar da condição, e a ligação guarda a frase e a página. Sem fonte, a ferramenta não entra.
- B) Lista clínica do RT, sem frase de fonte.

**CF4 — O bloco do CID e a regra "nada sugere conduta"**
- A) O bloco só mostra e abre ferramentas; não mostra resultado, dose, cor nem conduta. O título é "Ferramentas para este CID", e o médico escolhe se abre. A regra da aba Atendimento continua valendo.
- B) O bloco já traz um resultado ou um próximo passo. Muda a decisão C2 de 06/11/2026.

**CF5 — Como a ferramenta abre a partir do atendimento**
- A) Numa janela por cima do atendimento (no celular, tela cheia), já com a idade, o peso aferido e o modo do paciente. Fechar a janela volta à aba onde o médico estava, sem perder o rascunho.
- B) Na Central, numa aba nova do navegador, sem dados do paciente.

**CF6 — Idade do paciente**
- A) Filtra pela faixa. Até 13 anos, 11 meses e 29 dias aparecem só as ferramentas pediátricas; depois, só as de adulto. Sem data de nascimento, aparecem as duas, com o rótulo de cada uma.
- B) Mostra tudo sempre.

**CF7 — Como o resultado chega ao prontuário**
- A) Só pelo "Copiar" e colar do médico. Nada entra sozinho, e o autor do registro continua sendo o login de quem salva o SOAP.
- B) Botão "Levar ao SOAP", que acrescenta o texto da cópia ao Objetivo.

**CF8 — Celular nas ferramentas**
- A) Layout próprio abaixo de 768 px:
  - as entradas aparecem primeiro, e o topo vira um "Sobre a ferramenta" recolhido;
  - a faixa flutuante fica como hoje;
  - tabelas largas viram lista de cartões;
  - a navegação da seção e as relacionadas vão para uma gaveta.

  As opções de desenho saem de telas reais do Refero, mostradas ao RT antes do código.
- B) Só ajustes pontuais (quebra de tabela e espaçamentos), sem mudar a ordem.

**CF9 — O que o RT quer ver diferente no celular**
- A) O RT abre 3 ferramentas e o atendimento no próprio celular, na homologação, e lista o que incomoda. A lista entra em F4 e F5 antes do desenho.
- B) Seguir só o diagnóstico acima.

## 4. Exemplos do RT conferidos (para o mapa da F1)

- **I20 (angina) e I21 (IAM):**
  - todos os CIDs do grupo: HEART, TIMI sem supra, GRACE, Killip e SCA inicial;
  - só no I21 com supra: TIMI com supra;
  - entram todos se a fonte de cada um sustentar a ligação (CF3).
- **I63 e I64 (AVC):** NIHSS, FAST-ED, RACE e trombólise no AVC.
  - **Achado:** o ABCD2 é escore de **AIT** (ataque isquêmico transitório), cujo CID é G45, não I64. Pela fonte da ficha (ESO 2021, AIT), ele entra no G45 e não no I64, a menos que o RT decida outra coisa.

## 5. Banco, servidor, permissões e auditoria

- **CF1 = A:** não há migration de tabela. A versão do mapa é registrada como as fichas (`registrar_versao_ferramenta`) e aprovada na Revisão Clínica.
- **Abrir uma ferramenta não grava nada.** Só o SOAP salvo grava, pelo `registrar_soap` de sempre (autor = login).
- **Peso:** vem da mesma leitura que a Prescrição já faz (último peso aferido), sem permissão nova.

## 6. Testes e critérios de aceite

- **Teste do mapa:** cada código do mapa é CID-10 válido; cada ferramenta existe na Central; cada ligação tem fonte com página; nenhuma ferramenta pediátrica aparece para adulto, nem o contrário.
- **Teste de tela:** escolher I21 no atendimento mostra o bloco com as ferramentas do mapa; escolher um CID sem mapa não mostra nada; a ferramenta aberta pelo bloco recebe idade e peso do paciente.
- **Celular:** medido em 375 × 812 na homologação, com a ferramenta inteira usável sem rolar para o lado e a primeira entrada visível sem rolar.
- **Evidência:** capturas na homologação (computador e celular) e o RT conferindo com login próprio.

## 7. Riscos

- **Mapa errado leva o médico à ferramenta errada.** Por isso CF3 (fonte por ligação) e a aprovação do RT antes da produção.
- **O bloco pode ser lido como sugestão de conduta.** Por isso CF4 = A.
- **Janela por cima do atendimento:** a ferramenta não pode perder o rascunho do SOAP. O rascunho já é salvo no servidor, mas a janela não pode recarregar a tela.
- **O celular mexe em muitas telas.** Por isso vai em lotes, como o modelo completo, e com o padrão do frontend sem piora.

## 8. Ordem

F1 (mapa e teste) → F6 (aprovação do RT) → F2 (bloco) → F3 (janela com o paciente) → F4 (celular nas ferramentas, em lotes) → F5 (celular no atendimento).

F2 e F3 podem ir à homologação antes da aprovação do mapa, com o mapa em "aguarda aprovação". Só vão à produção depois do ok.

## 9. Demonstração

No celular, o médico atende um paciente com dor torácica, escolhe I20.0 e toca em HEART. O escore abre por cima do atendimento, já com a idade do paciente. O médico marca os itens, copia o resultado e cola no SOAP sem sair da ficha.
