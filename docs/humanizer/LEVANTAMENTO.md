# Levantamento de textos com cara de IA no Chefe Coruja

Levantamento só de leitura, feito em 09/11/2026 sobre o `origin/master` em `f841b68e` (merge do #518). Nenhum arquivo do projeto mudou. O critério é a skill humanizer (`C:\Users\Ricardo\.claude\skills\humanizer\SKILL.md`, versão 3.1.0), com os 26 padrões aplicados no equivalente em português.

Convenções deste relatório:

- O travessão dos trechos citados aparece como ‹trav›, para o relatório não usar o caractere. A seta aparece como ‹seta›.
- Severidade forte: padrão de §1 a §5, ou vários padrões no mesmo trecho. Fraca: o resto. Um fecho de uma linha (§2) que traz um fato novo fica como fraco, porque a skill manda manter fecho que acrescenta fato.
- O que entrou como "§12" em português são palavras de estimação: "nasce" no sentido de "é criado", "tempo real", "eficiência".
- Linha é a do arquivo no `origin/master`.

## Resumo

A interface do app já está, na maior parte, escrita de forma direta: frases curtas, sujeito claro, quase nenhum "garantir", "fundamental", "robusto" ou "de forma eficiente" (a busca por essas palavras nas telas fora do conteúdo clínico não achou nenhuma). Os vícios se concentram em três lugares:

1. A página pública do app (`src/pages/landing/Landing.tsx`) e as telas de entrada (`LadoMarca`, `Cadastro`): frases de efeito, contraste "não é X, é Y" e títulos escritos para impressionar.
2. O site de marketing em Next.js na pasta `landing/` da raiz: texto de modelo pronto, com depoimentos e um número de resultado provisórios (marcados como TODO no código). Não sei se este site está publicado; se estiver, é o ponto mais urgente.
3. O travessão como conectivo, espalhado em avisos, descrições e botões de todas as áreas (52 dos achados).

As telas mais usadas (Central do Plantonista, Observação, Enfermagem, Triagem) têm poucos achados, todos fracos. UBS não tem nenhum.

## Contagem por área

| Área | Achados | Fortes | Fracos |
|---|---|---|---|
| Central do Plantonista (inclui porta, atendimento e internação do médico) | 10 | 0 | 10 |
| Observação | 2 | 0 | 2 |
| Enfermagem | 3 | 0 | 3 |
| Triagem | 0 | 0 | 0 |
| Regulação (inclui NIR) | 10 | 2 | 8 |
| Farmácia | 5 | 1 | 4 |
| Faturamento | 2 | 0 | 2 |
| Gestor | 11 | 4 | 7 |
| UBS | 0 | 0 | 0 |
| Login e landing do app (`src/`) | 20 | 13 | 7 |
| Site de marketing (`landing/` na raiz) | 13 | 10 | 3 |
| Componentes comuns (inclui escala e check-in) | 17 | 3 | 14 |
| Outras telas (admin, telemedicina, prontuário, rede, notificação, recepção) | 19 | 2 | 17 |
| Total nas telas | 112 | 35 | 77 |
| Mensagens do banco (dependem de migration) | 2 | 0 | 2 |
| Total geral | 114 | 35 | 79 |

Fora da contagem: 74 linhas de tela com aspas curvas (§21, fraco sozinho), listadas no fim por área, e os itens "não mexer" do conteúdo clínico.

## Contagem por padrão

Um achado pode ter mais de um padrão; por isso a soma (136) passa do total de achados.

| Padrão | Ocorrências |
|---|---|
| §1 "não é X, é Y" e contraste com cauda negativa | 4 |
| §2 fecho de uma linha e fragmento | 9 |
| §3 frase de efeito | 11 |
| §4 rodeio antes do ponto | 0 |
| §5 discussão com ninguém | 3 |
| §6 trio forçado | 4 |
| §7 frases com a mesma abertura | 1 |
| §8 travessão como conectivo | 52 |
| §12 palavra de estimação | 8 |
| §13 importância inflada | 3 |
| §16 linguagem de venda | 9 |
| §17 autoridade ou prova inventada | 4 |
| §18 verbo trocado por locução | 1 |
| §20 título decorativo, caixa alta de título, símbolo | 6 |
| §21 aspas curvas (só as que vieram junto de outro padrão) | 1 |
| §22 sobra de chatbot ("com sucesso") | 5 |
| §24 título repetido na primeira frase | 6 |
| §25 texto que fala do próprio processo (sobra de desenvolvimento) | 9 |
| Demais padrões (§9, §10, §11, §14, §15, §19, §23, §26) nas telas | 0 |

## Achados por área

### Central do Plantonista

Nenhum achado forte. A tela inicial da Central, o modo do paciente e o rodapé das ferramentas estão limpos. Os achados são travessões em avisos do atendimento.

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/components/plantonista/central/CartaoTurno.tsx:161 | "Check-in pendente ‹trav› fazer agora" | §8 | "Check-in pendente: fazer agora" | fraco |
| src/lib/useClinicalAsk.ts:138 | "Resposta com citação incompleta ‹trav› confira as fontes." | §8 | "Resposta com citação incompleta: confira as fontes." | fraco |
| src/pages/plantao/atendimento/AtestadoMedico.tsx:282 | "Só marque a pedido do paciente ‹trav› o diagnóstico no atestado depende de autorização expressa dele (...)" | §8 | "Só marque a pedido do paciente: o diagnóstico no atestado depende de autorização expressa dele (...)" | fraco |
| src/pages/plantao/atendimento/PedidoExames.tsx:287 | "O que motiva o pedido ‹trav› o serviço precisa disso para priorizar" | §8 | "O que motiva o pedido. O serviço usa isso para priorizar." | fraco |
| src/pages/plantao/atendimento/ReceituarioMedico.tsx:201 | "...bloqueado pela alergia a X ‹trav› remova o item" | §8 | "...bloqueado pela alergia a X: remova o item" | fraco |
| src/pages/plantao/porta/AbaDesfecho.tsx:152 | "Exames com resultado ‹trav› sem resultado: ..." | §8 | "Exames sem resultado: ..." | fraco |
| src/pages/plantao/porta/AbaDesfecho.tsx:158 | "Medicação administrada ‹trav› falta checar: ..." | §8 | "Medicação ainda sem checagem: ..." | fraco |
| src/pages/InternacaoPainel.tsx:267 | "{nome} ‹trav› para qual setor?" | §8 | "Transferir {nome} para qual setor?" | fraco |
| src/pages/InternacaoPainel.tsx:165 | "Paciente transferido com sucesso (evento ADT registrado)." | §22 | "Paciente transferido. Evento ADT registrado." | fraco |
| src/content/plantaoRegistry.tsx:132 | "Enfermarias e sala vermelha ‹trav› dos setores onde você está na escala." | §8 | "Enfermarias e sala vermelha dos setores da sua escala." | fraco |

### Observação

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/content/plantaoRegistry.tsx:140 | "Pacientes em observação ‹trav› no máximo 6 horas." | §8 | "Pacientes em observação, por no máximo 6 horas." | fraco |
| src/components/observacao/PainelObservacao.tsx:159 | Título "Pacientes em Observação" | §20 | "Pacientes em observação" (as outras telas usam caixa de frase) | fraco |

### Enfermagem

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/pages/enfermagem/InternacaoEnfermagem.tsx:129 | "A internação da enfermagem mostra os leitos dos setores em que você está de plantão neste momento." | §25 | "Aparecem aqui os leitos dos setores em que você está de plantão agora." | fraco |
| src/pages/enfermagem/ProntoSocorroEnfermagem.tsx:92 | "O Pronto-Socorro da enfermagem mostra os pacientes dos setores em que você está de plantão neste momento." | §25 | "Aparecem aqui os pacientes dos setores em que você está de plantão agora." | fraco |
| src/components/paciente/Isolamento.tsx:161 | "Médico ou enfermeiro marca e retira, sempre com motivo. Tudo fica na auditoria." | §2 (traz fato) | "Médico ou enfermeiro marca e retira, sempre com motivo, e cada mudança fica na auditoria." | fraco |

### Triagem

Nenhum achado fora do conteúdo clínico. As frases com padrão forte da triagem são regra clínica (a cor da classificação é da enfermagem) e estão na seção "não mexer".

### Regulação

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/components/regulacao/IndicadoresRegulacao.tsx:74 | "...a fila atual não depende do período. Só números." | §2 | Cortar "Só números." ou trocar por "Sem dado de paciente." se for isso que se quer dizer | forte |
| src/components/regulacao/MapaVagas.tsx:74 | "Leitos em tempo real; atualiza a cada minuto. Só números, sem paciente." | §2, §12 | "Leitos atualizados a cada minuto, sem dado de paciente." | forte |
| src/pages/regulacao/Regulacao.tsx:688 | "As 200 mais recentes. A fila com filtros e a decisão chegam nas próximas tarefas." | §25 | "As 200 mais recentes." A segunda frase é sobra de desenvolvimento e já está desatualizada: a fila com filtros existe na mesma tela (linhas 1001 e 1044). | fraco |
| src/pages/regulacao/Regulacao.tsx:614 | "Anexar arquivo (PDF, JPG, PNG ‹trav› até 10 MB cada)" | §8 | "Anexar arquivo (PDF, JPG ou PNG, até 10 MB cada)" | fraco |
| src/components/regulacao/DestinoRegulacao.tsx:88 | "Não chegou ‹trav› registrado em {data} (...)" | §8 | "Não chegou: registrado em {data} (...)" | fraco |
| src/pages/nir/Nir.tsx:56 | Título "NIR ‹trav› pendências da unidade" | §8 | "Pendências do NIR" | fraco |
| src/pages/nir/Nir.tsx:85 | "cobrado N× ‹trav› última por X em {data}" | §8 | "cobrado N×, a última por X em {data}" | fraco |
| src/pages/nir/Nir.tsx:75 | Vazio "Nada parado" / "Nenhuma pendência neste assunto." | §24 | Título "Nada parado neste assunto", sem texto | fraco |
| src/components/regulacao/SlaRegulacao.tsx:109 | Vazio "Nada esperando decisão" / "Nenhum pedido com esses filtros." | §24 | Título "Nada esperando decisão com esses filtros", sem texto | fraco |
| src/components/regulacao/IndicadoresRegulacao.tsx:113 | Vazio "Sem pedidos" / "Nenhum pedido de regulação com esses filtros." | §24 | Título "Nenhum pedido com esses filtros", sem texto | fraco |

### Farmácia

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/pages/farmacia/Farmacia.tsx:435 | "O plantão sinaliza pela prescrição; você registra aqui ou pela Disponibilidade. Tudo aparece aqui." | §2 | "O plantão sinaliza pela prescrição; você registra aqui ou pela Disponibilidade." | forte |
| src/pages/farmacia/Farmacia.tsx:59 | "O que existe na unidade, como se dilui e o que volta para correção" | §6 | "Estoque, diluição padrão e itens devolvidos para correção" (confirmar que as três partes são as abas) | fraco |
| src/pages/farmacia/PainelFarmacia.tsx:135 | "Sem administração sem liberação, sem validação de alta vigilância pendente, sem falta sem retorno e sem estoque crítico sem falta registrada." | §7 | "Nenhuma pendência: nenhuma administração sem liberação, nenhuma validação de alta vigilância, nenhuma falta sem retorno e nenhum estoque crítico sem falta registrada." | fraco |
| src/pages/farmacia/Interacoes.tsx:37 | "ativa ‹trav› alerta na prescrição" | §8 | "ativa: alerta na prescrição" | fraco |
| src/pages/farmacia/Interacoes.tsx:38 | "proposta ‹trav› não alerta" | §8 | "proposta: ainda não alerta" | fraco |

### Faturamento

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/pages/faturamento/Bpa.tsx:75 | Título "Faturamento ‹trav› BPA" | §8 | "BPA" (o menu já diz Faturamento) | fraco |
| src/pages/faturamento/EnvioErp.tsx:97 | "A versão para o ERP nasce quando o faturamento marca a conta como faturada." | §12 | "A versão para o ERP é criada quando o faturamento marca a conta como faturada." | fraco |

### Gestor

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/pages/gestor/Protocolos.tsx:46 | "O que a instituição oferece com um clique. Publicar um protocolo aqui muda o que o plantonista vê no Receituário ‹trav› ele escolhe item a item, e nunca recebe o pacote sem ver." | §16, §8 | "Protocolos de prescrição da instituição. Publicar um protocolo muda o que o plantonista vê no Receituário: ele escolhe item a item e não recebe o pacote sem ver." | forte |
| src/pages/gestor/Protocolos.tsx:258 | "Nenhum protocolo de prescrição. Nada vem pronto: protocolo genérico seria lido como o da unidade." | §5 | "Nenhum protocolo de prescrição. O sistema não traz protocolo pronto, porque um genérico seria lido como o da unidade." | forte |
| src/pages/gestor/FerramentasUnidade.tsx:52 | "...acrescenta uma nota local ou suspende o uso ‹trav› sem apagar a regra." | §8, §1 | "...acrescenta uma nota local ou suspende o uso. A regra continua registrada." | forte |
| src/pages/gestor/FarmaciaGestor.tsx:106 | "O gestor vê a consequência: o que falta e o que já foi cotado." | §3 | "O gestor vê o que falta e o que já foi cotado." | forte |
| src/pages/gestor/PanoramaConfig.tsx:148 | "...quando houver a consulta no banco ‹trav› até lá ela fica em preparo, sem número." | §8 | "...quando houver a consulta no banco. Até lá, ela fica em preparo, sem número." | fraco |
| src/pages/gestor/PanoramaConfig.tsx:171 | "Tirar uma medida do Painel do Gestor não apaga o dado ‹trav› ele continua nesta página." | §8 | "Tirar uma medida do Painel do Gestor não apaga o dado: ele continua nesta página." | fraco |
| src/pages/gestor/Banners.tsx:166 | "{unidade} ‹trav› o quadro exibido na Central do Plantonista." | §8 | "Quadro de imagens da Central do Plantonista em {unidade}." | fraco |
| src/pages/Setores.tsx:190 | "{unidade} ‹trav› gerencie setores e crie leitos em lote." | §8 | "Setores e leitos de {unidade}. Os leitos podem ser criados em lote." | fraco |
| src/pages/gestor/Convites.tsx:224 | "O primeiro acesso de plantonista, (...) nasce de um convite desta unidade." | §12 | "...começa por um convite desta unidade." | fraco |
| src/pages/RevisaoClinica.tsx:114 | Botão "Confere ‹trav› aprovar" | §8 | "Aprovar" (ou "Aprovar: confere") | fraco |
| src/pages/RevisaoClinica.tsx:116 | Botão "Aponta correção ‹trav› reprovar" | §8 | "Reprovar com correção" | fraco |

### UBS

Nenhum achado em hiperdia, pré-natal, puericultura, agenda e consultório. Os textos dizem o que entra no painel e quem inclui, sem enfeite.

### Login e landing do app (`src/`)

Esta é a área com mais achados fortes. A página pública (`Landing.tsx`) foi escrita em tom de manifesto, e o tom se repete na lateral da entrada (`LadoMarca.tsx`) e no cadastro.

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/pages/landing/Landing.tsx:198 | Título da aba "Chefe Coruja ‹trav› a escala é a porta" | §8, §3 | "Chefe Coruja: prontuário eletrônico do plantão" (usa a frase do rodapé) | forte |
| src/pages/landing/Landing.tsx:229 | H1 "A escala é a porta de entrada." | §3 | "Só entra quem está na escala." | forte |
| src/pages/landing/Landing.tsx:265 | "Três fatos que a tela obedece." | §6, §20 | "Regras do plantão na tela" | forte |
| src/pages/landing/Landing.tsx:267 | "O prazo tem consequência clínica. O número que conta as observações vencidas é também o caminho até elas." | §3, §18 | "Passar de 6 horas na observação tem consequência clínica. O número de observações vencidas abre a lista delas." | forte |
| src/pages/landing/Landing.tsx:270 | "Fora do turno, a porta fecha." | §3 | "Fora do turno, o sistema não abre." | forte |
| src/pages/landing/Landing.tsx:273 | "É assim que o plantonista fala, e é o quanto a tela precisa mostrar." | §3 | "O plantonista chama o paciente pelo leito, e a tela mostra o leito antes do nome." | forte |
| src/pages/landing/Landing.tsx:291 | "Não é auditoria feita depois. É a mesma regra que abre a porta: se a escala não autoriza, a tela não abre." | §1, §5 | "A mesma regra que libera a entrada registra o acesso: se a escala não autoriza, a tela não abre." | forte |
| src/pages/landing/Landing.tsx:305 | Título "Menos dado em tela é menos risco." e abertura "No plantão isso já era hábito: o paciente é o leito." | §3 | Título "Cada tela mostra só o dado necessário". Abertura: "A LGPD pede finalidade e o mínimo necessário. No plantão, o paciente já é chamado pelo leito." | forte |
| src/pages/landing/Landing.tsx:315 | "Contado no código, não estimado." | §1 | "Números contados no código e nos testes" | forte |
| src/pages/landing/Landing.tsx:326 e 327 | Título "Cada papel, o seu produto." e abertura "Os papéis têm o mesmo peso. (...)" | §3, §5 | Título "Uma tela para cada papel". Abertura sem a primeira frase: "Um mesmo usuário pode ter papéis diferentes em unidades diferentes; vale o da unidade selecionada." | forte |
| src/pages/landing/Landing.tsx:246 | "O plantão, como a tela mostra." | §20 | "O que a tela do plantão mostra primeiro" | fraco |
| src/components/entrada/LadoMarca.tsx:55 | "O turno começa quando a escala diz." | §3 | "O acesso abre no horário da escala." | forte |
| src/pages/Cadastro.tsx:563 | "O vínculo vem antes do primeiro leito." | §3 | "Primeiro a unidade confirma o seu vínculo." | forte |
| src/pages/Cadastro.tsx:587 | "O acesso é de uma pessoa, numa unidade, num papel. É isso que este passo estabelece." | §6, §2 | "Este passo liga o acesso a você, a uma unidade e a um papel." | forte |
| src/pages/Cadastro.tsx:120 | "A conta nasce agora; o vínculo (...)" | §12 | "A conta é criada agora; o vínculo (...)" | fraco |
| src/pages/Cadastro.tsx:325 | "...na lista de convites ‹trav› não é preciso ligar." | §8 | "...na lista de convites. Não é preciso ligar." | fraco |
| src/pages/Cadastro.tsx:780 | "Escolha o que te interrompe durante o plantão ‹trav› dá para mudar depois em Avisos." | §8 | "Escolha o que te interrompe durante o plantão. Dá para mudar depois em Avisos." | fraco |
| src/pages/Login.tsx:246 | "A conta nasce de um convite (...). Ninguém se cadastra sozinho: (...)" | §12, §24 | "A conta é criada a partir de um convite da unidade ou do contrato da rede, porque só a coordenação sabe quem está na escala e em cada leito." (o título logo acima já diz "Não existe cadastro próprio") | fraco |
| src/pages/PapelEmPreparo.tsx:13 | "Fase 7 ‹trav› teleinterconsulta de apoio ao plantonista." | §25, §8 | "Chegam com a teleinterconsulta de apoio ao plantonista." O número da fase é do plano interno. | fraco |
| src/pages/PapelEmPreparo.tsx:29 | "Chegam nas próximas fases do plano." | §25 | "Ainda não estão disponíveis." | fraco |

Mantidos de propósito: Landing.tsx:293 ("o relógio do servidor, não o do aparelho") e LadoMarca.tsx:59 ("a janela do plantão, não o dia inteiro"). Nos dois, a metade negativa corrige uma suposição real do leitor, e a skill manda manter.

### Site de marketing (`landing/` na raiz, Next.js)

É um site separado do app, com cara de modelo de agência. Alguns textos são provisórios e marcados como TODO no próprio código. Antes de reescrever, vale saber se ele está publicado.

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| landing/components/Testimonials.tsx:11 | Depoimento "A plataforma organizou nossa escala (...). (Texto placeholder ‹trav› TODO)" | §17 | Tirar a seção até haver depoimento real, com nome e autorização. Não reescrever: é depoimento inventado. | forte |
| landing/components/Testimonials.tsx:18 | Depoimento sobre LGPD e trilha de auditoria, também "(Texto placeholder ‹trav› TODO)" | §17 | Igual ao anterior | forte |
| landing/components/Testimonials.tsx:25 | Depoimento "reduziram erros e aceleraram o atendimento", também provisório | §17 | Igual ao anterior | forte |
| landing/components/CaseStudy.tsx:34 e 35 | "-35% no tempo médio de permanência na observação, com leitos sempre atualizados." (o código marca como métrica provisória) | §17 | Tirar o número até haver medida real com fonte | forte |
| landing/components/CaseStudy.tsx:11, 18 e 26 | "UPA reduziu fila de espera e ganhou visibilidade da operação"; "...prescrição manual ‹trav› sem rastreio..."; "...escala integrada ‹trav› com trilha de auditoria..." | §13, §8 | Esperar o caso real (o código pede o nome da unidade). Sem ele, não há o que reescrever sem inventar. | forte |
| landing/components/Hero.tsx:21 | H1 "Gestão hospitalar simples, segura e em conformidade, feita por quem entende de UPA" | §6, §16 | "Prontuário e gestão de plantão feitos por um médico coordenador de UPA" | forte |
| landing/components/Hero.tsx:24 e 25 | "...em uma única plataforma ‹trav› pensada por um médico coordenador de UPA e pronta para hospitais, UPAs e clínicas." | §8, §16 | "Prontuário eletrônico, gestão de leitos, prescrição e escala médica no mesmo sistema, para hospitais, UPAs e clínicas." | forte |
| landing/app/funcionalidades/page.tsx:53 | "Tudo o que sua unidade precisa para operar com mais segurança e eficiência." | §16, §12 | "Prontuário, leitos, prescrição, escala e indicadores da unidade." | forte |
| landing/components/Team.tsx:25 e 26 | "O Chefe Coruja nasceu dentro de uma UPA, liderado por um médico coordenador que viveu os desafios do dia a dia: (...)" | §13, §16 | "O Chefe Coruja foi criado numa UPA por um médico coordenador, a partir de problemas do plantão: escala no papel, leitos sem visão e prescrição sem rastreio." | forte |
| landing/components/Team.tsx:29 e 30 | "Unimos prática assistencial e tecnologia para entregar uma plataforma que organiza a operação e respeita as normas brasileiras ‹trav› da Resolução CFM à LGPD." | §16, §8 | "O sistema segue as resoluções do CFM e a LGPD." | forte |
| landing/components/Hero.tsx:18 | Selo "✓ Conformidade CFM e LGPD nativa" | §20, §16 | "Segue o CFM e a LGPD" | fraco |
| landing/app/page.tsx:38 | "Agende uma demonstração gratuita e veja como o Chefe Coruja se adapta à sua realidade." | §16 | "Agende uma demonstração gratuita." | fraco |
| landing/components/FAQ.tsx:14 | "...construído com conformidade nativa à LGPD (...)" | §16 | "...segue a LGPD, com dado de saúde tratado como dado sensível (...)" | fraco |

Também provisórios no mesmo site, fora do critério da skill mas visíveis: o telefone `+55 62 99999-9999` em `landing/lib/site.ts:12` e a promessa "Respondemos em até 4 horas úteis" (`Hero.tsx`, `contato/page.tsx`), que precisa de confirmação do RT.

### Componentes comuns (inclui escala, check-in, perfil, segurança e documentos)

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/components/seguranca/SegundoFator.tsx:595 | "Nada a configurar ‹trav› você pode marcar "confiar neste dispositivo" para não repetir por 30 dias." (aspas curvas no original) | §2, §8, §21 | "Não há nada a configurar. Você pode marcar "confiar neste dispositivo" para não repetir por 30 dias." | forte |
| src/components/documento/BarraDocumento.tsx:203 | "O documento continua no prontuário, riscado, com a justificativa. Nada é apagado." | §2 | "O documento continua no prontuário, riscado, com a justificativa." | forte |
| src/components/paciente/AlergiasEventos.tsx:103 | "Alergia ativa trava na prescrição o medicamento de mesmo nome ‹trav› nada a contorna. "Nega alergias" é registro com autor e hora, não campo em branco." | §8, §1 | "Alergia ativa trava na prescrição o medicamento de mesmo nome, sem exceção. "Nega alergias" fica registrado com autor e hora; é diferente de deixar o campo em branco." | forte |
| src/components/casca/Bloqueio.tsx:118 | Botão "Não sou {nome} ‹trav› sair" | §8 | "Não sou {nome}. Sair" | fraco |
| src/components/casca/Saida.tsx:36 | "Sair do sistema não encerra o plantão nem faz o check-out ‹trav› a escala continua no seu nome." | §8 | "Sair do sistema não encerra o plantão nem faz o check-out: a escala continua no seu nome." | fraco |
| src/components/seguranca/ConectarTelegram.tsx:53 | "A Corujinha responde sobre (...) da unidade ‹trav› só depois de você ligar o Telegram à sua conta." | §8 | "A Corujinha responde sobre (...) da unidade. Ela só responde depois que você liga o Telegram à sua conta." | fraco |
| src/pages/Perfil.tsx:212 | "✓ Perfil salvo com sucesso." | §22, §20 | "Perfil salvo." | fraco |
| src/pages/Perfil.tsx:328 | "Formação, especialidades e certificações ‹trav› ajudam o gestor a alocar o setor certo." | §8 | "Formação, especialidades e certificações. O gestor usa esses dados para escolher o setor." | fraco |
| src/pages/Perfil.tsx:412 | "Informações que protegem você e a equipe durante o atendimento. Dado sensível ‹trav› tratado conforme a LGPD." | §8, §13 | "Dado sensível, tratado conforme a LGPD." (manter a primeira frase só se disser o que protege e como) | fraco |
| src/lib/constants.ts:22 | Descrição do papel gestor "Gestão da unidade ‹trav› setores, leitos e equipe" | §8 | "Gestão da unidade: setores, leitos e equipe" | fraco |
| src/pages/MeuPlantao.tsx:166 | "Esta unidade ainda não configurou geolocalização ‹trav› o registro será feito sem validação de local." | §8 | "Esta unidade ainda não configurou a geolocalização: o registro é feito sem conferir o local." | fraco |
| src/pages/MeuPlantao.tsx:129 | "Check-out realizado com sucesso." | §22 | "Check-out registrado." | fraco |
| src/components/checkin/FormularioCheckin.tsx:73 | "Check-in realizado com sucesso." | §22 | "Check-in registrado." | fraco |
| src/pages/Escala.tsx:742 | "Plantão passado com sucesso." | §22 | "Plantão passado." (como já está em PedidosEscala.tsx:158) | fraco |
| src/pages/Escala.tsx:836 | "Gestor ‹trav› monte a escala" e "Admin ‹trav› todas as unidades" | §8 | "Gestor: monte a escala" e "Admin: todas as unidades" | fraco |
| src/pages/Escala.tsx:1394 | "Plantões do dia por setor e turno ‹trav› candidat-se aos livres." | §8 | "Plantões do dia por setor e turno. Candidate-se aos livres." (o original tem erro de digitação em "candidat-se") | fraco |
| src/components/escala/PedidosEscala.tsx:64 | Link "{rótulo} ‹seta›" | §20 | Tirar a seta; o link já indica a ação | fraco |

### Outras telas (admin, telemedicina, prontuário, rede, notificação, recepção)

| Arquivo:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| src/pages/admin/Plataformas.tsx:48 | "Nenhum dado de paciente atravessa esta tela." | §3 | "Esta tela não mostra dado de paciente." | forte |
| src/pages/rede/Rede.tsx:188 | "Pedidos em aberto, atrasados e concluídos nos últimos 30 dias. Só números." | §2 | Cortar "Só números." (mesmo fecho de IndicadoresRegulacao e MapaVagas) | forte |
| src/pages/telemedicina/Telemedicina.tsx:354 | "A assinatura com certificado ICP-Brasil (...) entra com a etapa 4.8, que ainda não tem provedor escolhido." | §25 | "A assinatura com certificado ICP-Brasil (...) ainda não está disponível: falta escolher o provedor." | fraco |
| src/pages/telemedicina/Telemedicina.tsx:470 | "ICP-Brasil entra com a etapa 4.8 (provedor a escolher)" | §25 | "ICP-Brasil ainda sem provedor" | fraco |
| src/pages/telemedicina/Telemedicina.tsx:32 | "Onde você pode atender e com que inscrição ‹trav› a CFM 2.314 exige identificação do médico em toda teleconsulta" | §8 | "Onde você pode atender e com que inscrição. A Res. CFM 2.314 exige identificação do médico em toda teleconsulta." | fraco |
| src/pages/telemedicina/Teleinterconsulta.tsx:238 | "Você tem N teleinterconsultas em atendimento ‹trav› responder em Salas em andamento" | §8 | "Você tem N teleinterconsultas em atendimento. Responda em Salas em andamento." | fraco |
| src/pages/admin/GaviaoPainel.tsx:100 e 101 | Título "Gavião ‹trav› Sentinela"; descrição "Fiscal de segurança e integridade da plataforma. Dados que o Gavião considera pertinentes." | §8, §25 | Título "Gavião". Descrição dizendo o que a tela lista, por exemplo "Alertas de segurança e integridade da plataforma." (confirmar o conteúdo) | fraco |
| src/pages/admin/Plataformas.tsx:138 | "...ficam no painel do Supabase ‹trav› trazê-los para cá exige a chave de gestão (...)" | §8 | "...ficam no painel do Supabase. Trazê-los para cá exige a chave de gestão (...)" | fraco |
| src/pages/admin/ErrosEAlertas.tsx:332 | "Íntegra ‹trav› nenhuma linha adulterada." | §8 | "Íntegra: nenhuma linha adulterada." | fraco |
| src/pages/admin/Integracoes.tsx:39 | "Laboratório (LIS): pedidos de exame, coleta e laudo ‹trav› FHIR" | §8 | "Laboratório (LIS, em FHIR): pedidos de exame, coleta e laudo" | fraco |
| src/pages/admin/Integracoes.tsx:41 | "Imagem (RIS/PACS): (...) link e laudo ‹trav› FHIR" | §8 | "Imagem (RIS/PACS, em FHIR): (...) link e laudo" | fraco |
| src/pages/parecer/Pareceres.tsx:93 | "nenhuma declarada ‹trav› a fila fica vazia até você declarar." | §8 | "nenhuma declarada: a fila fica vazia até você declarar." | fraco |
| src/pages/prontuario/ImpressaoProntuario.tsx:360 | "Cópia do prontuário com autorização e declaração de recebimento. Tudo fica registrado." | §2 (traz fato) | "Cópia do prontuário com autorização e declaração de recebimento, registrada na auditoria." | fraco |
| src/pages/admin/RndsAba.tsx:327 | Vazio "Nada aqui" / "Nenhum documento nesta situação." | §24 | Título "Nenhum documento nesta situação", sem texto | fraco |
| src/pages/rede/Rede.tsx:258 | Vazio "Nenhum pedido" / "Nenhum pedido com esses filtros." | §24 | Título "Nenhum pedido com esses filtros", sem texto | fraco |
| src/pages/notificacao/NotificacaoCompulsoria.tsx:101 | "...o mapeamento CID ‹seta› agravo veio do protótipo" | §25 | Trocar "veio do protótipo" pela origem que o leitor entende (por exemplo "foi montado pela equipe do sistema"), confirmando com o RT. O aviso em si fica. | fraco |
| src/lib/unificacao.ts:26 | "mesmo nome, nascimento diferente ou em branco ‹trav› conferir" | §8 | "mesmo nome, nascimento diferente ou em branco: conferir" | fraco |
| src/pages/admin/JanelaUnidade.tsx:108 | "A unidade nasce ativa, sem setores e sem equipe." | §12 | "A unidade é criada ativa, sem setores e sem equipe." | fraco |
| src/pages/admin/RndsAba.tsx:471 | "A credencial nasce na homologação da RNDS." | §12 | "A credencial é criada na homologação da RNDS." | fraco |

Recepção ficou só com o item de `unificacao.ts`. As telas da recepção estão limpas.

## Aspas curvas (§21, fraco sozinho)

74 linhas de tela usam aspas curvas (“ ”) onde o resto do app usa aspas retas. Muitas envolvem texto digitado pelo usuário (motivo, justificativa), o que é aceitável. Distribuição: faturamento 10, farmácia 9, termo de consentimento 8, gestor 5, regulação 4, enfermagem (telas) 4, prescrição 4, recepção 3, prontuário 3, Central do Plantonista 3, e 1 ou 2 nas demais. Para uniformizar, basta uma passada mecânica; não vale a pena tratar caso a caso.

## Mensagens de erro do banco

As mensagens de `RAISE EXCEPTION` estão diretas e quase todas dizem o que fazer. A busca nas 431 migrations não achou travessão, "não é X, é Y", "garantir", "fundamental" ou sobra de chatbot. Nenhuma tem padrão forte. As duas menos claras:

| Migration:linha | Texto atual | Padrão | Reescrita sugerida | Sev. |
|---|---|---|---|---|
| supabase/migrations/20261005000005_cuidados_enfermagem.sql:155 | "%: só a retirada ou o cancelamento se registram depois; o resto não se altera." (o % é o nome da tabela) | §11 | "Este registro não se altera. Depois de gravado, só é possível registrar a retirada ou o cancelamento." | fraco |
| supabase/migrations/20260926000006_fase1_auditoria_so_insercao.sql:74 | "% é só-inserção: registro de auditoria não se altera nem se apaga." (mostra o nome da tabela ao usuário) | §10 | "Registro de auditoria não se altera nem se apaga." | fraco |

As duas dependem de migration nova que redefina a função ou o gatilho. Antes de mexer, conferir se migrations posteriores já redefiniram essas funções com outro texto.

## Não mexer (conteúdo clínico com padrão forte)

Estes trechos têm a forma de frase de efeito, mas carregam regra clínica do produto. Ficam como estão; qualquer mudança passa pelo RT.

| Arquivo:linha | Texto | Padrão | Motivo |
|---|---|---|---|
| src/pages/enfermagem/Triagem.tsx:118 | "A classificação do CAB 28 é referência; a cor é sua." | §3 | Regra: a cor da classificação é da enfermagem |
| src/pages/enfermagem/Triagem.tsx:119 | "O protocolo é referência; a cor é sua." | §3 | Mesma regra |
| src/pages/gestor/Protocolos.tsx:81 | "O protocolo é apoio ao enfermeiro; a cor é sempre dele." | §3 | Mesma regra |
| src/pages/plantao/AtendimentoPorta.tsx:36 | "A cor manda; 80+ e prioridade legal só desempatam dentro da mesma cor." | §3 | Regra de ordenação da fila por classificação |
| supabase/migrations/20261004000003_encaminhamento_interno_avaliacao.sql:167 | "Braden e Morse são escalas do adulto: na criança não se usam (nada se converte do adulto)." | §2 | Regra: nunca converter adulto para criança |

Também fora do escopo e não listados: cerca de 600 linhas com travessão nas páginas do manual clínico (`src/pages/plantonista/manual`, `pediatria`, `dengue`, `ventilacao`, `calculadoras`, `escores`, `protocolos`) e em `src/clinico`; 146 linhas de `src/content/registry.tsx` onde o travessão separa o nome da ferramenta clínica do que ela faz; o termo de uso e sigilo em `Cadastro.tsx` (linhas 206 a 214 e 741), que tem rótulos em negrito mas é texto legal; as folhas impressas de `src/lib/folhas.ts`; a página de teste `src/pages/PrescricaoTeste.tsx`.

## Amostra de documentos

A amostra cobre `README.md`, os 11 arquivos de `docs/desempenho/` e os 10 de `docs/teste-rede/fila/`. O vício dominante nos documentos é o negrito decorativo (§19), não o travessão.

| Documento | Travessões | Trechos em negrito | Itens com rótulo em negrito | Observação |
|---|---|---|---|---|
| README.md | 7 | 13 | 0 | Título "Chefe Coruja ‹trav› Plataforma de Gestão Hospitalar (Fase 1)" tem travessão, caixa alta de título (§20) e está desatualizado (o projeto passou da Fase 5). "**Fase 1**", "**plantonista**", "**Central Clínica**" (linhas 4 a 6) e "**Regra inviolável:**" (linha 33) são negrito decorativo (§19), o último com importância inflada (§13). |
| docs/desempenho/AUDITORIA.md | 17 | 104 | 7 | Título com travessão. A mediana da tabela inteira vai em negrito, e quase todo item tem um trecho em negrito. |
| docs/desempenho/ITEM-*.md (10 arquivos) | 12 no total | 24 no total | 0 | Texto direto. Um ou dois travessões por arquivo, quase sempre no título. |
| docs/teste-rede/fila/*.md (10 arquivos) | 1 no total | 104 no total | 61 no total | Cada item abre com rótulos em negrito ("**Origem:**", "**Decisão do RT:**", "**Branch:**") e marca as decisões em negrito dentro da tabela. É o padrão §19 em forma de modelo. |

Para os documentos, a correção mais barata é tirar o negrito dos rótulos e dos números e trocar o travessão do título por dois-pontos. O texto corrido já é bom.

## As 10 piores ocorrências

1. landing/components/Testimonials.tsx:11, 18 e 25: três depoimentos provisórios ("Texto placeholder", TODO) que, publicados, seriam depoimentos inventados (§17).
2. landing/components/CaseStudy.tsx:34: o "-35%" no tempo de permanência na observação é número provisório sem fonte (§17), dentro de um caso de sucesso também provisório (§13, §8).
3. src/pages/landing/Landing.tsx:291: "Não é auditoria feita depois. É a mesma regra que abre a porta" (§1 dividido em duas frases, §5).
4. src/pages/landing/Landing.tsx:315: "Contado no código, não estimado." (§1).
5. src/pages/landing/Landing.tsx:326 e 327: "Cada papel, o seu produto." seguido de "Os papéis têm o mesmo peso." (§3, §5).
6. src/pages/landing/Landing.tsx:305: "Menos dado em tela é menos risco." e "o paciente é o leito" (§3).
7. src/pages/Cadastro.tsx:587: "O acesso é de uma pessoa, numa unidade, num papel. É isso que este passo estabelece." (§6, §2).
8. landing/components/Hero.tsx:21: "Gestão hospitalar simples, segura e em conformidade, feita por quem entende de UPA" (§6, §16).
9. src/pages/gestor/Protocolos.tsx:46: "O que a instituição oferece com um clique. (...) ‹trav› ele escolhe item a item" (§16, §8).
10. src/pages/landing/Landing.tsx:198 e 229: o lema "a escala é a porta (de entrada)", no título da aba e no H1 (§3, §8).

Fora da lista porque o problema é mais de conteúdo do que de estilo: src/pages/regulacao/Regulacao.tsx:688 promete para "as próximas tarefas" uma fila com filtros que já existe na mesma tela.

## O que ficou de fora

- A varredura cobriu todas as telas de `src/pages`, `src/components`, `src/lib`, `src/hooks` e `src/content` fora do conteúdo clínico, mas por padrões de busca e pela leitura das frases longas (12 palavras ou mais), dos títulos, descrições, estados vazios e rodapés de gaveta. Rótulos curtos de campo e textos de botão comuns foram lidos só quando apareceram nessas buscas.
- Mensagens do banco: leitura das mensagens com mais de 110 caracteres das migrations a partir de outubro de 2026 e busca por padrão em todas as 431; não houve leitura uma a uma das 3.501 ocorrências de `RAISE EXCEPTION`.
- Documentos: só a amostra pedida. `docs/` tem muitos outros arquivos não lidos.
