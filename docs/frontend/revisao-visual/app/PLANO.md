# Revisão visual — parte 3, app por papel

Trilha "Revisão visual" do `BACKLOG.md`, parte 3 (P2). Critério: telas sem
divergência do guia do padrão e aprovadas pelo RT; direções só onde o padrão não
fixou.

## Decisões do RT (21/10/2026)

1. **Divisão em nove subpartes**, uma por branch e PR, na ordem do guia
   (`docs/frontend/GUIA.md`, seção 6):

   | Subparte | Telas |
   |---|---|
   | 3.1 | Casca e menus (lateral, topo, barra do celular, título de página) |
   | 3.2 | Recepção e painel da TV |
   | 3.3 | Atendimento e documentos da porta |
   | 3.4 | Triagem e enfermagem |
   | 3.5 | Leito aberto |
   | 3.6 | Observação |
   | 3.7 | Farmácia |
   | 3.8 | Central do Plantonista e ferramentas |
   | 3.9 | Escala e menu do gestor |

2. **Alcance da direção da landing no app:** antes da 3.1, maquetes de três
   níveis para o RT escolher:
   - **Mínimo:** só tirar os reflexos genéricos (o ícone em quadrado colorido no
     título de cada página, cartões de enfeite), sem mudar a tipografia.
   - **Médio:** o mínimo, mais título de página em serifa (Newsreader) e linhas
     de registro onde hoje há cartões com ícone.
   - **Completo:** o médio, mais horas e leitos em Geist Mono e fios no lugar de
     cartões nas listas.

3. **Imagens das telas reais** tiradas na homologação (pacientes fictícios), com
   a sessão aberta pelo RT no navegador. Nada é fotografado na produção.

## Maquetes dos níveis (21/10/2026)

Sem sessão no navegador (o RT está em outro computador), as maquetes foram
montadas a partir do código da casca (`Lateral`, `Topo`, `Marca`,
`TituloPagina`) com dados fictícios, numa tela de plantão. "Hoje" é uma
aproximação do app atual, não uma captura.

| Imagem | O que mostra |
|---|---|
| `nivel-atual-claro.jpg` | Hoje: título com ícone em quadrado, cartões de pendência com ícone colorido, aviso da lateral em cartão com selo |
| `nivel-minimo-claro.jpg` | Mínimo: sem o quadrado do título, sem ícone nos cartões, aviso da lateral sem cartão. Tipografia igual |
| `nivel-medio-claro.jpg` | Médio: o mínimo, mais título da página em Newsreader e pendências como linhas de registro com fio |
| `nivel-completo-claro.jpg` | Completo: o médio, mais leitos e prazos em Geist Mono, abas sublinhadas, faixa sem cartão, topo sem pílulas |
| `*-escuro.jpg` | Os mesmos níveis no tema escuro |

## Decisão do nível (21/10/2026)

**Mínimo.** O RT escolheu só tirar os reflexos genéricos, sem serifa no app. Pediu
também para rever a faixa de números ("Sob seu cuidado", "Maior permanência"…),
que parece molde de métrica de painel gerado. A faixa entra na 3.1 porque mora na
casca (`FaixaDoPapel`, peça `Parametro` em `src/components/monitor/Parametros.tsx`)
e também aparece no cartão de turno do plantonista, no painel do gestor e na
landing.

Três opções da faixa, sobre o nível mínimo (`faixa-a|b|c-claro|escuro.jpg`):

- **A · linha de leitura:** a mesma grade de quatro, sem ícone, número do tamanho
  de um texto forte (20 px) com a legenda na mesma linha; cor só no que pede
  atenção; um quadradinho na cor da grandeza.
- **B · régua:** quatro linhas empilhadas; a escala com o limite escrito vira a
  leitura, o número fica pequeno à esquerda e o estado por extenso à direita.
- **C · frase:** o plantão numa frase, com os números no texto; só o que pede ação
  ganha cor e vira link para a tela que resolve.

**Escolhas do RT (21/10/2026): faixa em régua (B)** e **o rótulo pequeno em
frase** (sai o `text-transform: uppercase` e o espaçamento da classe `.rotulo`,
934 usos; guia 5.1).

## 3.1 aplicada até aqui

- `TituloPagina` sem o azulejo de ícone (vale para as 79 telas; a prop `icone`
  segue aceita e sai das chamadas tela a tela).
- Lateral: o aviso "Da unidade" e os números "Da rede" sem cartão; saiu o selo
  "AVISO".
- Maiúsculas forçadas fora (guia 5.1): títulos de grupo da paleta de busca, o
  cabeçalho da lista fora do expediente e a classe `.rotulo` em todo o app.
- **Faixa em régua** (`Parametro`, `FaixaParametros`, CSS `.cc-faixa` e
  `.cc-param` em `src/index.css`): cada parâmetro é uma linha com fio na cor da
  grandeza, o número na cor do estado (sem o corpo de 30/36/42 px), a escala com
  o limite desenhado e escrito embaixo, e o estado por extenso. Sem ícone. A
  linha decide a forma pela largura (container query): larga em quatro colunas,
  estreita empilhada (grades do gestor, celular). O modo compacto esconde o
  estado. A faixa deixou de ficar fixa ao rolar: quatro linhas tomariam a tela.
- A landing usa a mesma peça no lugar do desenho próprio
  (`regua-landing-claro-desktop.jpg`, `regua-landing-escuro-celular.jpg`).

Verificação: typecheck, lint, build e catraca verdes. Detector do `impeccable`
na landing local: um "contraste baixo" falso (mede a legenda do limite contra o
fundo da marca grafite, mas ela fica fora da marca, sobre o fundo claro: 5,8:1)
e as listras da escala, já aceitas na parte 1. **Sem sessão aqui, não vi** a
casca, a faixa do farmacêutico, do administrador e da telemedicina, nem as
grades "Agora" (Indicadores) e o painel do gestor: conferir na homologação.

## Conferência da régua no Refero (21/10/2026)

As opções da faixa da 3.1 foram montadas sem consultar o Refero (desvio da
decisão da trilha, avisado ao RT). A pedido dele, a régua foi conferida depois
contra telas reais (`refero_search_screens`: métricas com limite, páginas de
cota, painéis de monitoramento):

| Referência | O que confirma ou corrige |
|---|---|
| Zendesk Status (`7957c520`) | Confirma linhas empilhadas por serviço, com o estado escrito à direita e a legenda uma vez só |
| Appwrite, uso do plano (`1d33fe84`) | Corrige: o limite vai junto do número ("0 B / 5 GB used"), não solto na barra |
| Cohere, limite de gasto (`0316cb1c`) | Corrige: textos da escala nas pontas, alinhados, nunca flutuando sobre a marca |
| Visitors, Web Vitals (`a7582434`) | Confirma: valor compacto com o estado na cor, sem número gigante |

**Ajuste proposto** (branch `feat/visual-3-1b-regua`): o texto do limite sai de
baixo da marca e vai para o lado do número ("7h20 · limite 6h"); a marca fica sem
legenda; a coluna do número tem largura fixa, então as escalas de todas as linhas
começam no mesmo ponto; as linhas ficam da mesma altura. Imagens:
`regua-ajuste-claro-desktop.jpg`, `regua-ajuste-escuro-desktop.jpg`,
`regua-ajuste-escuro-celular.jpg` (antes: `regua-landing-*.jpg`).

## Outras formas da faixa, a partir do Refero (21/10/2026)

O RT perguntou se havia outras formas de mostrar os parâmetros com base no
Refero (a régua tinha sido a melhor entre A, B e C, que não vinham dele). Três
direções novas, cada uma de uma referência real, sobre o nível mínimo
(`faixa-d|e|f-claro|escuro.jpg`):

| Direção | Referência do Refero | Como fica |
|---|---|---|
| **D · faixa de status** | Fingerprint, visão geral (`217e2393`): faixa de status com rótulo pequeno em cima e o estado em ponto colorido ("No issues found") | Uma linha baixa: rótulo, valor e contexto; só o que pede atenção ganha ponto e selo ("2 acima de 6h"). Sem barra. Cabe fixa no topo |
| **E · tabela de leitura** | Zendesk Talk, fila (`1686eace`): rótulo à esquerda, valor alinhado à direita, em colunas | Duas colunas de linhas: rótulo e valor na mesma linha, o estado por extenso embaixo. Sem barra |
| **F · primeiro o que pede ação** | Linear, grupos de SLA (`cb07661a`); Factory, "Immediate Action Required" (`3125417b`) | O que passou do limite vem em linhas com o caminho ("Ver observação →"); o que está em ordem vira uma linha quieta embaixo. Sem nada fora do limite, só a linha quieta |

A régua ajustada (limite junto do número, réguas alinhadas) segue como opção.

**Escolha do RT (21/10/2026): F, primeiro o que pede ação.** Aplicada na branch
`feat/visual-3-1b-regua`:

- Peça nova `ResumoParametros` (`src/components/monitor/Parametros.tsx`): recebe
  os mesmos `<Parametro>` e os separa pelo nível. Atenção e crítico viram linhas
  com o número na cor do estado, o rótulo, o que aconteceu (e o limite, se houver)
  e o caminho quando o parâmetro tem destino (`acao`, por exemplo "Conferir alta
  vigilância"); o crítico vem antes. O que está em ordem, ou é leitura antiga,
  vai para uma linha quieta: "Rótulo: **valor** · estado".
- `FaixaParametros` (faixa do farmacêutico, do administrador e da telemedicina)
  passa a usar a peça. A landing também.
- As grades "Agora" (Indicadores) e o painel do gestor seguem com a régua de
  `Parametro` até a 3.9, quando entram as telas do gestor.
- Imagens: `faixa-f-aplicada-claro-desktop.jpg`, `faixa-f-aplicada-escuro-desktop.jpg`,
  `faixa-f-aplicada-escuro-celular.jpg`. Typecheck, lint, build e catraca verdes;
  detector do `impeccable` na landing sem achado novo.
- **Sem sessão aqui, não vi** a faixa do farmacêutico, do administrador e da
  telemedicina: conferir na homologação.

**Faixa sob o título da página (pedido do RT, 21/10/2026).** A faixa saía da casca
antes da página, colada no topo e acima de "Central do Farmacêutico". Agora a casca
a põe num contexto (`FaixaDaPagina`, `src/components/monitor/faixaDaPagina.ts`) e o
`TituloPagina` a desenha logo abaixo do título e da descrição, como um bloco da
coluna (borda e canto das peças da página), antes das abas. `TabsPagina` zera o
contexto dentro das abas, para a tela montada numa aba (a Rede do administrador)
não repetir a faixa. Nas linhas de ação, o número tem coluna fixa (os textos
começam no mesmo ponto) e, no celular, fica em cima do texto. Imagens:
`faixa-sob-titulo-claro-desktop.jpg` e `faixa-sob-titulo-escuro-celular.jpg`,
tiradas de uma página de teste local com as peças reais e dados fictícios.

**Espaços vazios (pedido do RT, 21/10/2026, com captura da homologação).** Dois
vãos: (1) páginas com largura própria (`max-w-4xl`, `max-w-5xl`, em 28 telas)
ficavam presas à esquerda da coluna, com um vão à direita em tela larga; uma
regra da casca (`.cc-pagina > * { margin-inline: auto }` em `src/index.css`) as
centraliza, com margens iguais. (2) Na faixa, a coluna do número tinha largura
fixa e abria um vão entre "3 na fila" e o texto; agora as linhas de ação dividem
uma grade (subgrid) e a coluna tem a largura do maior número. Imagens:
`pagina-centralizada-claro-1920.jpg`, `pagina-centralizada-escuro-1366.jpg`.

**Coluna com 5% de margem (pedido do RT, 21/10/2026).** A partir de 1024 px a
coluna do app deixou de ter teto (era 896 px, crescendo até 1200–1560 px): ocupa
a área ao lado da lateral com 5% de margem de cada lado, no mínimo 28 px. As
páginas que punham o próprio teto de 896 a 1152 px (`max-w-4xl`, `5xl`, `6xl`,
29 telas) passam a seguir a coluna. Formulário estreito (`max-w-2xl`, `3xl`, 4
telas) segue estreito e no centro, porque campo esticado a 90% da tela não se lê.
Medido numa página de teste: 65 px de cada lado em 1366 e 93 px em 1920, 5,0%.
Imagens: `coluna-5pct-claro-1920.jpg`, `coluna-5pct-escuro-1366.jpg`. Risco a
conferir na homologação: tabelas e listas largas ficam mais compridas em tela
grande.

## 3.2 · Recepção e painel da TV (21/10/2026)

**Levantamento.** Recepção (`src/pages/recepcao/Recepcao.tsx`, telas Nova ficha,
Fila da triagem, Fila médica e Painel de chamada): faixa de quatro contadores com
rótulo em maiúsculas espaçadas e sombra (molde de métrica de painel; guia 5.1);
linhas da fila com um selo por status ("Aguardando" cinza, "Chamado",
"Em atendimento"); cartões com sombra; a página tem largura própria de 896 px,
fora da regra dos 5%. Painel da TV (`src/pages/public/PainelChamada.tsx`): rótulos
em maiúsculas espaçadas e a coruja num azulejo.

**Referências do Refero** (`refero_search_screens`: fila com espera e status,
painel de chamada, lista agrupada por status):

| Referência | O que mostra |
|---|---|
| Zendesk Talk, fila (`1686eace`) | Faixa "Current queue activity" com seis contadores em caixa normal, sem sombra |
| Linear, issues agrupadas (`58ac6637`) | Lista agrupada por status, com a contagem no cabeçalho do grupo e o status num ícone pequeno, sem selo |
| Linear, lista ativa (`ab6ce0f5`) | Status como ícone + texto na linha |
| Linear SLA e Factory (`cb07661a`, `3125417b`) | Primeiro o que pede ação (a faixa F da 3.1) |

Para o painel da TV o Refero não tem referência (as buscas por quadro de chamada
e quadro de embarque voltaram telas de compra); por isso a TV recebe só o nível
mínimo, sem opções.

**Opções da fila** (sobre a fila médica, dados fictícios; `recepcao-hoje|A|B|C-claro|escuro.jpg`):

- **A · contadores enxutos** (Zendesk Talk): os quatro contadores ficam, em caixa
  normal, sem sombra e mais baixos. As linhas não mudam.
- **B · fila agrupada** (Linear): sai a faixa de contadores; a lista se agrupa em
  "Aguardando o médico 4" e "Em atendimento 2", com a maior espera e quem passou do
  alvo no cabeçalho do grupo; o status vira ponto + texto, sem selo.
- **C · primeiro o que pede ação** (faixa F da 3.1): no lugar dos contadores, o que
  passou do alvo da cor e quem foi chamado três vezes sem resposta vêm em linhas
  com o caminho; as contagens vão para a linha quieta.

Em qualquer opção: a página passa a seguir a coluna (sai o teto de 896 px), os
cartões perdem a sombra e o painel da TV perde as maiúsculas espaçadas e o azulejo.

**Escolha do RT (21/10/2026): B, fila agrupada.** Aplicada na branch
`feat/visual-3-2-recepcao`:

- `Recepcao.tsx`: sai a faixa de contadores; `ListaFila` recebe grupos. Fila da
  triagem: "Aguardando triagem N", com a maior espera. Fila médica: "Aguardando o
  médico N", com a maior espera e quantos passaram do alvo da cor (em vermelho
  quando há), e "Em atendimento N". Grupo vazio não aparece.
- Status de cada paciente em ponto + texto: ponto vazio aguardando, contornado em
  âmbar chamado, em vermelho chamado três vezes sem resposta, cheio na cor da ação
  em atendimento. A cor da classificação segue no selo com o nome (regra clínica).
- Cartões sem sombra; a página segue a coluna (5% de margem) e o formulário da
  Nova ficha fica em até 896 px.
- Painel da TV: sem maiúsculas espaçadas nos rótulos ("Chamando agora", "Últimas
  chamadas") e a coruja no quadrado teal da marca.
- Typecheck, lint, catraca e build verdes. **Não vi** a fila nem a TV renderizadas
  (pedem login ou link de painel válido): conferir na homologação.

## 3.3 · Atendimento e documentos da porta (21/10/2026)

**Levantamento** (agente de busca): fila do Pronto-Socorro (`porta/FilaPS.tsx`)
com duas pílulas por linha (cor e estado) e blocos com sombra; janela de
atendimento (`porta/JanelaAtendimento.tsx`) como cartão com sombra de diálogo,
cabeçalho empilhado (contexto, pílula "Em atendimento há…", dados do paciente,
caixas de aviso) e contador em pílula nas abas; abas com pílula de situação em
cada item de prescrição e de exame; documentos (`plantao/atendimento/*`,
`components/documentos/ui.tsx`) em cartões com sombra e títulos de bloco em
maiúsculas espaçadas. Sem ícone em quadrado, sem números gigantes, sem gradiente.

**Referências do Refero:** Linear, página da issue (`1a493a2c`: conteúdo no meio e
lateral de propriedades com status, pessoa e datas em linhas); Attio, registro
(`705e033f`: abas por assunto, linha do tempo e detalhes à direita); DocuSign
(`5a07bc9f`: documento no centro e ações no rodapé).

**Opções da janela de atendimento** (paciente fictícia de 8 anos;
`porta-hoje|A|B|C-claro|escuro.jpg`):

- **A · mínimo:** mesma composição de hoje, sem a sombra de diálogo, o tempo de
  atendimento em texto com relógio (sem pílula), o aviso de pediatria numa linha
  (sem caixa) e o contador das abas em número simples.
- **B · lateral de propriedades** (Linear): cabeçalho de uma linha (nome, cor com o
  nome, idade, alergia, queixa, tempo); à direita, um painel "Paciente" com idade,
  prioridade, alergias, setor, chegada, tempo de atendimento, o aviso de pediatria
  e os botões Histórico e Prontuário.
- **C · linha do atendimento** (Attio): o mesmo cabeçalho de uma linha; à direita,
  o aviso e a linha do tempo do atendimento (ficha, classificação com quem
  classificou, chamada, início).

Em qualquer opção: a fila do Pronto-Socorro segue a forma da recepção (agrupada,
status em ponto + texto, sem a segunda pílula); prescrição e exames trocam a
pílula de situação por ponto + texto; documentos sem sombra e com títulos de
bloco em caixa normal. A cor da classificação continua no selo com o nome.

**Escolha do RT (21/10/2026): A, mesma composição sem os reflexos.** Aplicada na
branch `feat/visual-3-3-porta`:

- `JanelaAtendimento.tsx`: sem a sombra de diálogo; "Em atendimento há…" em texto;
  avisos de pediatria e de paciente sem identificação numa linha colorida, sem
  caixa, com o texto clínico inteiro; contador das abas em número simples.
- `FilaPS.tsx`: grupos como na recepção ("Aguardando o médico N" com quantos
  passaram do alvo da cor, em vermelho quando há; "Em atendimento N"; "Saídas do
  plantão N"), cabeçalho no fundo do campo e cartões sem sombra. A segunda pílula
  vira ponto + texto: vazio aguardando, contornado âmbar em reavaliação (vermelho
  quando atrasada), cheio na cor da ação em atendimento, verde no desfecho,
  contornado vermelho no excluído.
- `porta/Estado.tsx` (novo): o ponto + texto, usado pela fila e pelas abas.
  Prescrição (prescrito, administrado, suspenso, recusado), exames (pedido,
  coletado, resultado, crítico, cancelado) e documentos (emitido, rascunho) trocam
  a pílula por ele. Os selos "urgente", "novo" e "crítico" dos exames ficam: são
  alerta.
- Documentos (`components/documentos/ui.tsx`, atestado, pedido de exames,
  receituário): cartões sem sombra e títulos de bloco em caixa normal.
- Typecheck, lint, catraca e build verdes. A fila foi vista numa página de teste
  local com o componente real e dados fictícios, nos dois temas
  (`fila-ps-claro|escuro.jpg`). A janela e os documentos pedem login: conferir na
  homologação.

**Ajuste do RT (21/10/2026): a fila em abas**, no lugar dos grupos um em cima do
outro: "Aguardando atendimento N" (antes "Aguardando o médico"), "Em atendimento
N" e "Saídas do plantão N". A aba fica na URL (`?fila=`), então o médico volta à
mesma aba ao fechar o atendimento. Quantos passaram do alvo da cor fica à direita
das abas, visível em qualquer uma (no celular desce para a linha de baixo). Aba
vazia diz que está vazia. Vista na página de teste nos dois temas, 1366 e 390 px
(`fila-ps-abas-claro|escuro.jpg`).

**Pesquisa nos rivais (21/10/2026), a pedido do RT.** Seis modelos, montados com
os componentes reais e dados fictícios (`ps-modelo-1..6-claro|escuro.jpg`):

1. abas + pendências na linha (Epic Track Board, athenaOne);
2. tabela densa (quadros de rastreamento: Epic, athenaOne, Cerner FirstNet);
3. painel por zona (Cerner ED LaunchPoint);
4. grade de ações com hora e cor (Symphony, Reino Unido);
5. resumo por cor no topo (MV Painel; projeto de lei de Serra/ES);
6. quadro de etapas lado a lado (Refero: Linear, Workflow, Marathon).

Fontes: ajuda do athenaOne (Tracking Board), páginas de suporte Epic das
universidades de Iowa e Houston Methodist, boletins do Health PEI e da Northern
Light (FirstNet e LaunchPoint), guia do Symphony da UH Sussex, manuais do MV
Painel (SES-ES). Nenhum fornecedor publica captura da tela.

**Escolha do RT (21/10/2026): tabela densa, mas dentro das abas** (nada de
"aguardando" em cima e "em atendimento" embaixo; `ps-tabela-aba0..2-*.jpg`).
Agora entra só o que a fila já lê; as colunas de dado novo (alergia, sala,
médico, exames, medicação) vão ao BACKLOG como item próprio. A grade de ações
(modelo 4) vai para o gestor, junto da 3.9. Aplicado na branch
`feat/visual-3-3-tabela`:

- Cada aba tem a sua tabela. Aguardando: cor, paciente (com prioridade legal e
  faixa pela idade embaixo), queixa, espera (vermelha acima do alvo), alvo,
  situação (aguardando ou chamado N vezes; vermelho a partir de 3) e as ações
  (sala, chamar, abrir). Em atendimento: cor, paciente, queixa, há quanto tempo,
  situação (em atendimento ou reavaliação, atrasada em vermelho) e abrir ou
  reavaliar. Saídas: cor, paciente, desfecho, CID, destino ou motivo, hora.
- Clique no título ordena (cor, espera, há, hora): maior primeiro, menor
  primeiro, volta à ordem de sempre (a médica; nas saídas, a mais recente).
- `BotaoChamar` ganha `semContagem`: na tabela a contagem já está na Situação,
  então o botão diz só "Chamar de novo". Recepção e triagem não mudam.
- Vista na página de teste com o componente real nos dois temas, 1366 e 390 px
  (no celular a tabela rola na horizontal); a ordenação foi conferida clicando
  em "Espera" (`fila-ps-tabela-*.jpg`).

## 3.4 · Triagem e enfermagem (25/10/2026)

**O que estava genérico:** na fila da triagem, cada linha tinha duas pílulas cinzas
("Sem triagem" e "Aguardando"), e quem tinha sido chamado três vezes sem resposta
pesava o mesmo que quem nunca foi chamado; a barra da sala e os blocos da fila em
cartão com sombra; o rótulo acima do nome na janela de classificação em maiúsculas
espaçadas; na enfermagem do PS e nas telas de leito, passagem e checagem, situação
em pílula e blocos com sombra.

**Referências do Refero:** lista da Linear agrupada por status, com o prazo na
linha; listas de tarefas da Reclaim e da Amie, com o atrasado na linha da tarefa.
A busca por triagem e sinais vitais não trouxe tela clínica de fila; a referência
de formulário mais próxima (Hers) não entrou nas opções.

**Opções** (componentes reais, pacientes fictícios; `triagem-hoje|A|B-claro|escuro.jpg`):

- **A · mesma composição sem os reflexos:** sala em linha simples, sem a pílula
  "Sem triagem", situação em ponto + texto, blocos sem sombra; a lista de quem espera
  o médico continua embaixo.
- **B · abas e tabela, como a fila do PS:** abas "Aguardando triagem N" e
  "Classificados aguardando o médico N"; à direita, a maior espera e quantos passaram
  do alvo da cor; tabela densa com a situação em ponto + texto e as ações na linha.

**Escolha do RT (25/10/2026): B**, e o mesmo mínimo nas telas da enfermagem.
Aplicada na branch `feat/visual-3-4-triagem`:

- `Triagem.tsx`: abas com contagem e a aba no endereço (`?fila=medico`); à direita,
  "maior espera na triagem N min · N acima do alvo da cor" (vermelho quando há);
  título sem ícone; rótulo da janela de classificação em caixa normal.
- `triagem/useSalaTriagem.ts` (novo): salas, chamadas e a sala escolhida no aparelho,
  num gancho só, para a barra da sala ficar acima das abas.
- `triagem/Fila.tsx`: barra da sala sem cartão; tabela com Paciente (prioridade legal
  e homônimo embaixo), Queixa, Espera (a hora da ficha no título), Situação e as ações
  Chamar · Triar · Excluir da fila. Situação em ponto + texto: cinza aguardando, âmbar
  chamado (Nª vez), vermelho a partir da 3ª chamada sem resposta; sala e hora da
  chamada na linha de baixo.
- `triagem/Espera.tsx`: tabela com Cor (selo da enfermagem), Paciente, Queixa,
  Classificado, Espera e Reclassificar. **A espera passou a contar da classificação**
  (antes, da ficha) e fica vermelha acima do alvo da cor (`acimaDoAlvo` em `comum.ts`).
- Enfermagem: sem `shadow-repouso` na passagem, nas peças, na classificação, na
  gestação e no histórico. Situação em `Estado` no Pronto-Socorro da enfermagem
  (aguardando médico, em reavaliação, em atendimento, em observação; o box em texto),
  na passagem (recebida, aguardando quem assume), na checagem (feito, não feito,
  recusado, a checar) e nos leitos para liberar (livre, reservado, em higienização,
  bloqueado). Ficam como alerta: a pendência da passagem e os selos de vasoativo e de
  alta vigilância da checagem.
- Vista na página de teste com os componentes reais, nos dois temas, a 1100 px
  (`triagem-B-aplicada-claro|escuro.jpg`); no celular a tabela rola na horizontal. As
  telas da enfermagem pedem login: conferir na homologação.

## 3.5 · Leito aberto (25 e 26/10/2026)

**Levantamento** (agente de busca): pacientes internados em
`pages/InternacaoPainel.tsx` → `components/internacao/ListaInternados.tsx`; o leito
abre dentro da linha (`LeitoAberto.tsx`, modo caderno) com o cabeçalho único
(`paciente/CabecalhoPaciente.tsx`) e 13 abas. Reflexos: lista com sombra e, dentro
dela, o cabeçalho com outra sombra (cartão dentro de cartão); leito em pílula;
"Internado" em pílula; abas em 13 cápsulas com ícone; rótulos de bloco em
maiúsculas espaçadas (`caderno/caixas.tsx`, `Acuidade.tsx`, `Trilha.tsx`,
`Diagnostico.tsx`, `FichaAdmissao.tsx` e outras); NEWS2 em número de 30 px;
tipo da pendência em pílula maiúscula; situações em pílula ou `Badge` nas abas
(histórico da evolução, parecer, termo, encaminhamento, AIH, regulação,
intercorrência); `Card` com sombra em exames, passagens e regulação. Sem
gradiente e sem ícone em quadrado. `porta/Estado` ainda não é usado na internação.
Ficam como alerta: alergia, isolamento, selo da classificação (enfermagem),
Phoenix sepse/choque, pendência vencida, exame urgente ou crítico, agravo
suspeito, parecer urgente, gravidade alta.

**Referências do Refero:** Linear, página da issue (`1a493a2c`: conteúdo no meio e
propriedades à direita); Attio, registro (`cacd5be1`: abas no centro e detalhes à
direita); Hello Ivy, documentação (`e1a53517`: navegação agrupada à esquerda), no
mesmo molde da 3.8 opção C escolhida pelo RT.

**Opções** (pacientes fictícios; `leito-hoje|A|B|C-claro.jpg`; o tema escuro não
saiu na página de teste e fica para a aplicação):

- **A · mínimo:** mesma composição; lista sem sombra e leito em texto; cabeçalho
  sem cartão, separado por fio; "Internado" em ponto + texto; NEWS2 em texto na cor
  da faixa; abas sublinhadas, sem ícone; blocos do Resumo sem caixa, rótulos em
  caixa normal, número do NEWS2 em 24 px; tipo da pendência em ponto + texto.
- **B · lateral de propriedades** (Linear/Attio): o A, com o cabeçalho reduzido a
  nome, permanência e alergia; à direita, o painel "Paciente" com leito, situação,
  internação, chegada, classificação, acuidade, alergia, isolamento, diagnóstico,
  episódios anteriores e transferir.
- **C · abas agrupadas na lateral** (manual da Central, 3.8 C): o A, com as 13
  abas numa coluna à esquerda em três grupos — Cuidado (Resumo, Classificação,
  Evolução, Diagnóstico), Documentos (Admissão, Prescrição, Exames, AIH, APAC,
  Encaminhamento, Atestado, Parecer e termos) e Saída (Alta e documentos).

Em qualquer opção, as abas internas seguem o mínimo: situação em ponto + texto,
sem sombra, sem maiúsculas espaçadas; os alertas acima continuam como estão.

**Escolha do RT (26/10/2026): B, com ressalvas** (`leito-B2-claro.jpg`): as 13 abas
numa linha só, de ponta a ponta; abaixo dela, o Resumo (NEWS2) e o painel
"Paciente" começando na mesma altura; "Transferir de setor" no canto superior
direito, na linha do nome, acima das abas e do painel.

Aplicada na branch `feat/visual-3-5-leito`:

- `LeitoAberto.tsx` (caderno): cabeçalho sem cartão, separado da linha do leito por
  fio, com "Transferir de setor" no canto direito; as 13 abas na peça de base
  (`ui/tabs`), sublinhadas, sem ícone, numa linha só (na tela estreita rola para o
  lado); embaixo, a aba à esquerda e o painel Paciente à direita a partir de 1024 px
  (no celular o painel vai depois da aba). O modo simples (observação) não mudou:
  fica para a 3.6.
- `CabecalhoPaciente.tsx`: modo `compacto` (nome, idade, sexo e permanência numa
  linha, a ação à direita e embaixo só os alertas: alergia, isolamento e atendimento
  anterior sem desfecho). O selo da classificação virou `SeloClassificacao`, usado
  pelo cabeçalho e pelo painel. A porta continua com o cabeçalho de antes.
- `caderno/PainelPaciente.tsx` (novo): leito e setor, situação em ponto + texto,
  internação, chegada na unidade, selo da classificação (abre a aba Classificação),
  acuidade em texto na cor da faixa e diagnóstico; no pé, o recém-nascido da mãe.
  Alergia e isolamento não se repetem no painel: ficam no cabeçalho, à vista também
  no celular.
- `ListaInternados.tsx`: lista sem sombra; leito em texto; alerta Phoenix em texto
  vermelho (sepse, choque) ou apagado (rastreio).
- `Estado` mudou para `src/components/porta/Estado.tsx` (componente não importa
  tela); `porta/tomEstado.ts` traduz a variante antiga do selo para o tom.
- Abas internas, o mínimo: rótulos sem maiúsculas espaçadas (`caixas.tsx`,
  acuidade, diagnóstico, trilha, ficha de admissão, laudo da AIH, exames e agravos,
  resumo clínico e rótulo de seção da evolução, termo, alergias); NEWS2 em 24 px;
  tipo da pendência, link do pacote de alta, situação do registro da evolução,
  movimento do antibiótico, status do parecer, do termo, do encaminhamento, da
  regulação e da AIH em ponto + texto; cartões de exames, passagens e regulação e o
  histórico na unidade sem sombra. Ficam como alerta: selo de alergia e isolamento,
  classificação, prioridade do parecer e da regulação, intercorrência grave, exame
  urgente ou crítico, agravo suspeito e a faixa das escalas de avaliação.
- Visto na página de teste com o `LeitoAberto` real e dados fictícios a 1280 px nos
  dois temas e a 375 px (`leito-B-aplicada-claro|escuro.jpg`); as 13 abas cabem
  numa linha a 1280 px com qualquer aba ativa.

## 3.6 · Observação (26/10/2026)

**Levantamento** (agente de busca): `pages/plantao/secoes/PacientesObservacao.tsx`
→ `components/observacao/PainelObservacao.tsx` (o mesmo painel no gestor, só
leitura) → uma linha por box em `CartaoObservacao.tsx`, com os painéis da linha em
`PaineisCartao.tsx` (reavaliar, desfecho, protocolo, passar plantão). A
"Prancheta" abre o `LeitoAberto` no modo simples num diálogo. O prazo de 6 horas
vem de `modelo.ts` (`relogioPermanencia`): permanência, "Faltam X" ou "Passou há X"
(verde, âmbar na última hora, vermelho depois) e uma barra fina. Reflexos: lista
com sombra; box em pílula; situação em pílula colorida (`ESTADOS.classe`); sigla
do protocolo em etiqueta cheia; acuidade em pílula; faixa verde "tudo calmo" em
caixa; situação da passagem em pílula; no modo simples do leito, o cabeçalho em
cartão com sombra e "Em observação" em `Badge`. Sem maiúsculas espaçadas, sem
ícone em quadrado, sem gradiente. Ficam como alerta: selo de alergia, o aviso de
quem passou de 6 horas, o relógio vencido, reavaliação atrasada e a faixa crítica
da acuidade.

**Referências do Refero:** Linear, lista com o prazo de atendimento na linha
(`cb07661a`); Wrike, linha do tempo da equipe com a linha vermelha de "agora"
(`8bb3f47e`).

**Opções** (pacientes fictícios, agora às 15:00; `obs-hoje-claro.jpg`,
`obs-A|B|C-claro|escuro.jpg`):

- **A · mínimo:** mesma lista e os mesmos filtros; sem sombra; box em texto;
  situação em ponto + texto numa coluna própria, com a reavaliação e o protocolo
  embaixo; acuidade em texto na cor da faixa; a faixa verde vira uma linha de texto
  (quantos passaram, maior permanência, setores); o relógio e a barra ficam.
- **B · abas e tabela, como a fila do PS:** abas "Em observação N" e "Finalizados no
  plantão N"; à direita, a maior permanência e quantos passaram de 6 horas; tabela
  com box, paciente (alertas embaixo), situação, há quanto tempo (desde que hora) e
  prazo (faltam ou passou, até que hora), ações na linha. Os filtros por situação
  saem; a aba separa quem está e quem saiu.
- **C · régua das 6 horas** (Wrike): à esquerda paciente e situação; no meio, um
  eixo de horas com a janela de 6 horas de cada um, cheia até agora, o que passou
  do prazo em vermelho e uma linha vermelha de "agora" atravessando a lista; ações
  à direita. Mostra de relance quem vence primeiro.

Em qualquer opção: o aviso de quem passou de 6 horas fica em caixa (é alerta); a
situação da passagem vira ponto + texto; a Prancheta (modo simples do leito) ganha
o cabeçalho sem cartão e "Em observação" em ponto + texto, como no leito da 3.5.

**Escolha do RT (26/10/2026): B, abas e tabela.** Aplicada na branch
`feat/visual-3-6-observacao`:

- `PainelObservacao.tsx`: o aviso de quem passou de 6 horas continua em caixa e só
  aparece quando há alguém; a faixa verde "tudo calmo" e os filtros (prazo e
  situação) saem. Abas "Em observação N" e "Finalizados no plantão N" (no gestor,
  "Finalizados em 12 horas"); à direita, a maior permanência e, em vermelho,
  quantos passaram de 6 horas, à vista nas duas abas. Uma tabela por aba; a linha
  de quais setores a pessoa vê fica embaixo.
- `CartaoObservacao.tsx`: cada box é uma linha da tabela — box em texto; paciente,
  queixa, selo de alergia e acuidade em texto na cor da faixa; situação em ponto +
  texto com o desfecho, a reavaliação, o protocolo (sigla na cor) e a espera até o
  primeiro registro médico embaixo; na observação, há quanto tempo e desde que
  hora; prazo de 6 h com "Faltam" ou "Passou há" na cor do relógio e até que hora
  (ou "Definir conduta ou internar"); as ações do estado. Os painéis da linha
  (reavaliar, desfecho, protocolo, passar plantão, passagem) abrem numa linha de
  largura inteira logo abaixo. A barra fina do relógio sai: o prazo em texto já
  diz o mesmo.
- `modelo.ts`: `ESTADOS` guarda o tom do ponto (`TomEstado`) no lugar da classe da
  pílula. `PaineisCartao.tsx`: situação da passagem em ponto + texto.
- Prancheta (`LeitoAberto` no modo simples): `CabecalhoPaciente` com `semCartao`
  (as duas linhas de sempre, sem cartão; leito e acuidade em texto) e a situação
  (em observação, internado, alta) em ponto + texto. A porta continua com o
  cabeçalho em cartão.
- Visto na página de teste com as linhas reais e dados fictícios, a 1366 px nos dois
  temas (`obs-B-aplicada-claro|escuro.jpg`), com a aba Finalizados e o modo
  simples do leito. O painel inteiro (unidade, relógio do servidor) e a prancheta
  no diálogo pedem login: conferir na homologação.

## 3.7 · Farmácia (26/10/2026)

**Levantamento** (agente de busca): a "Central do Farmacêutico" (`pages/farmacia/Farmacia.tsx`,
`/farmacia`) tem seis abas em pílula (`Abas` de `monitor/Pagina`): Painel, Disponibilidade,
Diluição padrão, Rascunhos, Faltas e Validação. A Validação é o trabalho do dia (`fila_validacao`,
a cada 60 s): uma pilha de cartões com sombra, um por item, sem agrupar por paciente; a urgência é só
a borda âmbar (alta vigilância ou diluição fora do padrão) e o tempo é a hora da prescrição, sem
"há quanto". Fora dela: dispensação (`Dispensacao.tsx`, abas em pílula e um bloco por paciente),
alta vigilância, interações e unidade de consumo, em cartões de linha. Reflexos: `Badge` (pílula com
maiúsculas espaçadas) para situação em todas as telas; `shadow-repouso` nos blocos em repouso e em
cada item da fila; `Card` com sombra nos rascunhos; caixas tintadas dentro de cartões; números em
blocos no painel (escondidos para o farmacêutico, que os vê na faixa do papel). Sem gradiente, sem
ícone em quadrado, sem `uppercase` escrito à mão. Ficam como alerta: alta vigilância, interação
contraindicada ou grave, estoque em falta ou crítico, saldo negativo na dispensação.

**Referências do Refero:** Aboard, aprovação de documentos (`18fe2fd1`: lista de pedidos à esquerda,
documento e "Aprovar" à direita); Missive e Wrike, caixa de entrada em lista e detalhe
(`9a9cec0f`, `053b797e`).

**Opções da aba Validação** (prescrições fictícias; `farm-hoje-claro.jpg`,
`farm-A|B|C-claro|escuro.jpg`):

- **A · mínimo:** abas sublinhadas (`ui/tabs`) com a contagem; a fila numa lista só, sem sombra,
  linhas em fio; leito na cor da ação; alta vigilância em selo com ícone, sem maiúsculas; diluição
  padrão ou fora do padrão numa linha; "prescrito por … às 14:20 · há 40min"; devolvido em ponto +
  texto; Confere e Devolver à direita da linha.
- **B · tabela agrupada por paciente**, como a fila do PS: uma faixa por paciente (leito, nome,
  idade, peso, quem prescreveu, quando e há quanto) e uma linha por item com medicamento (selo de
  alta vigilância), dose, via e frequência, diluição, situação (a conferir, devolvido com o motivo) e
  as ações; à direita do resumo, o mais antigo e quantos estão fora do padrão.
- **C · caixa de entrada** (Aboard, Missive): à esquerda, uma linha por paciente com quantos itens,
  quais, há quanto tempo e os sinais (alta vigilância, fora do padrão, devolvido); à direita, a
  prescrição do paciente escolhido com Confere e Devolver em cada item.

Em qualquer opção, as outras abas e telas da farmácia recebem o mínimo: abas sublinhadas, `Badge` de
situação em ponto + texto, blocos sem sombra; os alertas acima continuam em selo.

**Escolha do RT (26/10/2026): C, caixa de entrada**, e o mesmo mínimo nas outras telas. Aplicada na
branch `feat/visual-3-7-farmacia`:

- `Farmacia.tsx`, aba Validação: a fila juntada por paciente (leito e nome), na ordem do servidor. À
  esquerda, uma linha por paciente (`BotaoLinha`) com quantos itens, quais, há quanto tempo desde a
  prescrição (anda a cada minuto) e os sinais em texto (alta vigilância, fora do padrão, devolvido); à
  direita, a prescrição do escolhido (quem prescreveu, quando, há quanto, peso de referência) e cada
  item numa linha em fio, com Confere e Devolver; o motivo da devolução abre embaixo do item. Quando o
  último item do paciente é conferido, a escolha passa ao próximo. No celular, a lista vem em cima e a
  prescrição embaixo. A consulta da fila (`useFilaValidacao`) serve também à contagem da aba.
- Abas da Central e da dispensação na peça de base (`ui/tabs`), sublinhadas; a `Abas` em cápsula de
  `monitor/Pagina` continua nas outras áreas que a usam.
- `components/farmacia/SeloAltaVigilancia.tsx` (novo): o selo de alta vigilância sem maiúsculas,
  âmbar nas listas e vermelho no painel de faltas. Falta, estoque crítico e gravidade da interação
  seguem em selo, sem maiúsculas.
- Situação em ponto + texto: estoque ok ou não informado, diluição da unidade ou modelo da rede,
  falta (registrada, em cotação, reposta), rascunho de diluição (vigente, rascunho, substituída),
  interação, item da dispensação (validado, devolvido), retirada sem farmacêutico a conferir, exige ou
  não liberação na alta vigilância. Blocos sem sombra (disponibilidade, limites, diluição padrão,
  faltas, envio de arquivo, rascunhos).
- Visto na página de teste com a Central real (unidade falsa só na página de teste) e a fila semeada,
  a 1100 px nos dois temas (`farm-C-aplicada-claro|escuro.jpg`): escolher outro paciente e abrir a
  devolução funcionaram. As outras abas e telas pedem login: conferir na homologação.

## 3.7b · Outras telas do farmacêutico (pedido do RT em 26/10/2026)

Uma tela por vez, na ordem Disponibilidade → Dispensação → Faltas → Diluição padrão e Rascunhos → Painel →
Alta vigilância e Interações.

### Disponibilidade (26/10/2026)

**Hoje** (`farmacia/Farmacia.tsx`, `Disponibilidade` e `LinhaEstoque`): dois cartões em cima (enviar a lista
da farmácia central e o padrão da unidade) e uma lista com um bloco por medicamento — nome e apresentação,
botão de limites, campo de saldo com Salvar, situação e "Sinalizar falta". Falta e crítico vêm primeiro, mas
tudo fica na mesma lista longa (até 80 itens), e o limite do item abre uma caixa dentro da linha.

**Referências do Refero:** produtos do Shopify (`24ccbcc1`: abas por situação e tabela com o estoque em
vermelho quando zera); biblioteca de itens do Square (`63ff98b3`: barra de filtros e tabela); lista agrupada
por situação da Linear (`4a094449`).

**Opções** (estoque fictício; `estoque-hoje-claro.jpg`, `estoque-A|B|C-claro|escuro.jpg`). Em todas, o padrão
da unidade e o envio da lista viram uma linha só no topo, sem cartões:

- **A · abas e tabela** (Shopify): abas "Precisa de atenção N" (falta e crítico), "Sem saldo informado N" e
  "Todos N"; tabela com medicamento (selo de alta vigilância), saldo editável, situação, limites (abre a
  edição), atualizado por quem e quando, e sinalizar falta.
- **B · lista agrupada por situação** (Linear): grupos "Em falta", "Crítico", "Sem saldo informado" abertos e
  "Em dia" recolhido; cada linha com saldo editável, limites e sinalizar falta. O que pede ação fica em
  cima e o que está em dia não ocupa a tela.
- **C · tabela e ficha do item**: à esquerda, tabela curta (medicamento, saldo na cor da situação,
  situação); à direita, a ficha do item escolhido com o saldo, os limites próprios (com "voltar ao padrão"),
  quem atualizou e a falta.

**Escolha do RT (26/10/2026): C, tabela e ficha do item.** Aplicada na branch
`feat/visual-3-7b-disponibilidade`:

- `Farmacia.tsx`, `Disponibilidade`: no topo, duas linhas sem cartão — o padrão da unidade (com "Definir
  padrão", que abre o formulário logo abaixo, marcado por um fio à esquerda) e a última lista enviada
  (`EnviarArquivo` ganhou o modo `compacto`: nome, quando, quem, Baixar e o botão de enviar à direita).
  Embaixo, a tabela (medicamento com o selo AV curto, saldo na cor da situação, situação) com filtro e "só
  alta vigilância"; a linha escolhida fica marcada e cada nome é um `BotaoLinha` (teclado). À direita, a
  ficha (`FichaEstoque`, no lugar da `LinhaEstoque`): saldo com Salvar e quem atualizou; limites do item
  com "Voltar ao padrão" quando são próprios e "Salvar limites"; situação com "Sinalizar falta" ou "Falta
  enviada". Nenhuma regra mudou: as mesmas chamadas ao servidor da linha de antes. No celular a ficha vem
  antes da tabela.
- Visto na página de teste com a Central real e o estoque semeado, a 1100 px nos dois temas
  (`estoque-C-aplicada-claro|escuro.jpg`), escolhendo um item com limite próprio. Salvar e sinalizar pedem
  login: conferir na homologação.

### Dispensação (26/10/2026)

**Hoje** (`farmacia/Dispensacao.tsx`, aba Prescrições, `LinhaItem`): um bloco por paciente (nome,
prontuário, setor) com um item por linha — medicamento, dose, validado ou devolvido, o dispensado nas
últimas 24 h, o estoque, a sugestão com a conta, o aviso quando há, o campo de quantidade e Dispensar.
Tudo empilhado: com muitos pacientes, a página fica longa e o estoque de cada medicamento se repete em
cada paciente. Com a farmácia fechada, a mesma tela serve à enfermagem (retirada com justificativa).

**Referências do Refero:** pedido de compra do Shopify (`e58fca53`: tabela de produtos com a quantidade
recebida editável na linha); caixas de entrada do Missive e da Wrike, as mesmas da validação (3.7 C).

**Opções** (itens fictícios; `disp-hoje-claro.png`, `disp-A|B|C-claro|escuro.png`, fotografadas no Chrome
sem janela, porque o painel do navegador estava oculto):

- **A · caixa de entrada por paciente**, como a validação: à esquerda um paciente por linha (setor, leito,
  prontuário, quantos itens, sinais de estoque zerado e devolvido); à direita os itens do escolhido, com
  sugestão, últimas 24 h e estoque numa linha e a quantidade com Dispensar à direita.
- **B · tabela agrupada por paciente** (Shopify): uma faixa por paciente e uma linha por item com
  medicamento (validado, alta vigilância), prescrito, sugestão com a conta, 24 h, estoque (vermelho quando
  zera), quantidade e Dispensar.
- **C · lista de separação por medicamento:** uma faixa por medicamento com quantos pacientes, o total
  sugerido e o estoque ("não cobre o total" em vermelho); embaixo, um paciente por linha com a quantidade e
  Dispensar. Ajuda a tirar da prateleira de uma vez.

Avulsa e Registro recebem o mesmo mínimo nas três (a tabela do registro já está em linhas em fio).

**Escolha do RT (26/10/2026): A, caixa de entrada por paciente.** Aplicada na branch
`feat/visual-3-7b-dispensacao`:

- `Dispensacao.tsx`, aba Prescrições: resumo (quantos itens de quantos pacientes) e a busca numa linha;
  à esquerda um paciente por linha (`BotaoLinha`) com setor, leito, prontuário, quantos itens e os sinais
  "estoque zerado" e "devolvido para correção"; à direita os itens do escolhido. Cada item numa linha em
  fio: medicamento com validado ou devolvido, dose, "sugestão (a conta) · nas últimas 24 h · estoque" (o
  estoque em vermelho quando zera), as notas da sugestão e, à direita, a quantidade com a unidade e
  Dispensar. Para a enfermagem (farmácia fechada), a justificativa e "Retirar sem farmacêutico" ficam
  embaixo do item. Nenhuma regra mudou: as mesmas chamadas ao servidor. Avulsa e Registro não mudaram.
- Visto na página de teste com a tela real e itens semeados, fotografada no Chrome sem janela a 1100 px
  nos dois temas (`disp-A-aplicada-claro|escuro.png`). Dispensar e a retirada pela enfermagem pedem
  login: conferir na homologação.

### Faltas (26/10/2026)

**Hoje** (`farmacia/Farmacia.tsx`, `Faltas`): uma lista única com as últimas 100 faltas, da mais nova para a
mais antiga, misturando registradas, em cotação e repostas; cada linha com medicamento, observação, quem
sinalizou e quando (data e hora, sem "há quanto"), a situação e os botões "Em cotação" e "Reposta". O
painel da Central já tem uma lista priorizada das abertas (`faltas_priorizadas`: alta vigilância primeiro,
depois quantos pacientes têm o medicamento prescrito, depois a mais antiga, e o retorno ao plantão).

**Referências do Refero:** quadro do Marathon com as ações no cartão (`0ef30cb0`); quadro da Linear por
situação (`ccd45807`); a fila do PS em abas e tabela, já escolhida na 3.3.

**Opções** (faltas fictícias; `faltas-hoje-claro.png`, `faltas-A|B|C-claro|escuro.png`):

- **A · quadro por situação:** três colunas (Registrada, Em cotação, Reposta nas últimas 72 h); cada falta é
  um cartão com o medicamento, o selo AV, a observação, quem sinalizou e por onde, há quanto tempo e o botão
  da próxima etapa. A mais antiga fica em cima.
- **B · abas e tabela**, como a fila do PS: abas "Abertas N" e "Repostas nas últimas 72 h N"; à direita, a
  mais antiga e quantas são de alta vigilância; tabela com medicamento, pacientes com prescrição, há quanto
  tempo e por quem, situação e ações.
- **C · lista agrupada por situação** (Linear): grupos Registrada e Em cotação abertos e Reposta recolhido;
  cada linha com medicamento, observação e quem sinalizou, há quanto tempo, pacientes com prescrição e as
  ações.

B e C usam os dados da lista priorizada do painel (`faltas_priorizadas`), que já traz os pacientes com
prescrição; nada muda no banco.

**Escolha do RT (26/10/2026): C, com cada situação numa aba** ("para quando for mais medicação não ficar
poluído"). Aplicada na branch `feat/visual-3-7b-faltas`:

- `Farmacia.tsx`, `Faltas`: abas "Registradas N" (vermelho quando há), "Em cotação N" e "Repostas N"; à
  direita, a mais antiga das abertas e quantas são de alta vigilância. Registradas e Em cotação vêm da
  lista priorizada do painel (mesma chave de cache, a mesma ordem: alta vigilância, pacientes com o
  medicamento prescrito, a mais antiga); cada linha com medicamento, apresentação e selo AV, a observação
  e quem sinalizou, o retorno ao plantão quando houver, há quanto tempo (anda a cada minuto), quantos
  pacientes com prescrição e em que setores, e "Em cotação" e "Reposta". Repostas vêm das últimas faltas
  da unidade, como antes. As chamadas ao servidor são as mesmas.
- `haQuanto` passou a dizer "2h", "1h 55min", "1 dia", "3 dias" (antes "24h 00min"); vale também para a
  validação.
- Visto na página de teste com a Central real, abrindo a aba sozinha, fotografada no Chrome sem janela nos
  dois temas (`faltas-C-aplicada-*.png`). Avançar a falta pede login: conferir na homologação.

### Diluição padrão e Rascunhos (26/10/2026)

**Hoje:** são duas abas da Central. **Diluição padrão** (`Farmacia.tsx`, `PadraoUnidade` e `LinhaDiluicao`)
tem o envio do padrão em cartão, filtros e uma pilha de cartões grandes, um por medicamento, cada um com a
grade de sete campos, a flebite, a fonte, o "por que muda" e os botões "Ajustar esta linha" e "Voltar ao
modelo". **Rascunhos** (`Diluicoes.tsx`) já é lista e editor lado a lado, mas em dois cartões e com as
situações (vigentes, rascunhos, substituídas) em botões. Para comparar duas linhas é preciso rolar.

**Referências do Refero:** tabela de registros do Attio (`361d1d78`); editor do Hashnode com rascunhos e
publicados na lateral (`373e8b1b`); histórico de versões do InVision (`444de771`); a Disponibilidade da
3.7b (tabela e ficha), já escolhida.

**Opções** (linhas fictícias, valores só de exemplo; `dil-hoje-claro.png`, `dil-A|B|C-claro|escuro.png`):

- **A · tabela de consulta e ficha**, como a Disponibilidade: o envio do padrão numa linha; à esquerda a
  tabela (medicamento com AV, diluir em com o volume mínimo, tempo, origem); à direita a ficha da linha
  escolhida com todos os campos, o valor do modelo riscado quando a unidade mudou, a fonte, o "por que muda"
  e as ações. Rascunhos continua aba à parte, com o mesmo mínimo.
- **B · uma aba só, como biblioteca** (Hashnode): "Diluição padrão" e "Rascunhos" viram uma aba "Diluição"
  com abas internas "Valendo na unidade", "Rascunhos" e "Substituídas"; à esquerda a lista, à direita a ficha
  (valendo, substituída) ou o editor (rascunho), com Salvar e Publicar no topo. Ajustar uma linha leva ao
  rascunho na mesma tela.
- **C · tabela larga** (Attio): todos os campos em colunas, o valor do modelo riscado embaixo, flebite e
  origem; a linha escolhida abre embaixo com fonte, "por que muda" e as ações. Bom para comparar
  medicamentos; no celular a tabela rola para o lado. Rascunhos continua à parte.

Nenhuma opção muda regra nem banco: publicar continua pedindo CRF e fonte, e publicada não se edita.

**Escolha do RT (26/10/2026): B, uma aba só, como biblioteca.** Aplicada na branch
`feat/visual-3-7b-diluicao`:

- Central do Farmacêutico: as abas "Diluição padrão" e "Rascunhos" viram **"Diluição"** (a Central passa a
  ter cinco abas).
- `Diluicoes.tsx` (a tela inteira): no topo, o último padrão enviado numa linha (`EnviarArquivo` compacto,
  que agora diz "padrão" ou "lista" conforme o tipo); abas internas "Valendo na unidade N" (o que chega ao
  prescritor desta unidade, `padrao_diluicao_unidade`), "Rascunhos N" (âmbar quando há) e "Substituídas N";
  busca, "só da unidade" e "só AV". À esquerda a lista; à direita:
  - em Valendo, a ficha (`FichaValendo`, no lugar da antiga `LinhaDiluicao` da Central): os campos em
    linhas, o valor do modelo da rede riscado quando a unidade mudou, a flebite, a fonte, o "por que muda",
    "Ajustar esta linha" (ou "Continuar o ajuste") e "Voltar ao modelo";
  - em Rascunhos e Substituídas, o editor de antes, sem cartão, com "Salvar rascunho" e "Publicar aos
    prescritores" (ou "Criar nova versão") no topo; "Nova diluição" fica no alto da lista de rascunhos.
- Ajustar uma linha que vale cria o rascunho da unidade e leva a ele na mesma tela (aba Rascunhos, já
  escolhido). Nenhuma regra mudou: as mesmas chamadas ao servidor.
- Visto na página de teste com a Central real e linhas semeadas, fotografada no Chrome sem janela nos dois
  temas (`dil-B-aplicada-*.png`). Ajustar, voltar ao modelo, salvar e publicar pedem login: conferir na
  homologação.

## 3.8 antecipada · Central do Plantonista: calculadoras, escores e condutas (21/10/2026)

A pedido do RT, a 3.8 vem antes da 3.4. A Central tem 212 ferramentas em 8 seções
(`/plantonista`, registry em `src/content/registry.tsx`); toda ferramenta passa por
`ToolLayout`, e os 39 escores por `EscoreTela`. Fotos das telas atuais, sem login,
com o componente real (`central-hoje-*.jpg`).

**O que dá a cara de IA hoje** (levantamento com arquivo e linha):

- **Escore:** cada pergunta vira dois botões "Não" e "Sim" da largura da tela; o
  resultado só aparece embaixo de tudo, com o número dentro de uma bolha e o cartão
  com borda colorida pelo estado.
- **Calculadora de infusão:** ícone em azulejo no cabeçalho do grupo, contagem em
  pílula, resultado em duas caixas tintadas com número de 30 px no centro,
  "ERRATA" em pílula maiúscula.
- **Conduta:** pilha de cartões com caixas dentro de caixas; o "quando" de cada
  medida em pílula maiúscula ("AGORA", "15 A 30 MIN"); gravidade em pílula ("GRAVE").
- **Índice de seção:** 39 cartões iguais em grade de duas colunas, cada um com uma
  estrela; nada agrupa nem resume.
- **Geral:** todo `Card` traz sombra (`ui/card.tsx:11`); todo `Badge` é maiúsculo
  espaçado (`ui/badge.tsx:9`, cerca de 45 usos na Central); "Bloco" e "Linha"
  copiados em sete arquivos de peças; no celular, a lista de seções vira grade de
  blocos coloridos com ícone (`PlantonistaHome.tsx:341-369`).

O início da Central já é uma lista (canais) e fica como está, salvo a grade do
celular.

**Referências do Refero:** calculadora do Wealthsimple (`8a2c763a`) e da Mercury
(`4bc19a59`): entradas à esquerda e resultado vivo à direita; documentação da
Anthropic (`ec087562`) e página de remédio da Doctronic (`b80ae175`): leitura com
títulos, tabelas e "nesta página"; downloads da Teenage Engineering (`945f3e52`) e
diretório da The Org (`50d03282`): índice denso, uma linha por item.

**Opções** (maquetes com os componentes reais; textos clínicos copiados das telas
atuais, sem conteúdo novo; `central-A|B|C-*-claro|escuro.jpg`):

- **A · mínimo:** mesma composição. Sim/Não num seletor na linha da pergunta;
  resultado em frase ("CURB-65: 3 pontos · mortalidade em 30 dias 17%"); conduta
  com linhas separadas por fio e o "quando" em texto; sem sombra, sem borda
  colorida, sem pílula maiúscula.
- **B · calculadora em duas colunas** (Wealthsimple, Mercury): itens com os pontos
  à esquerda e o resultado fixo à direita, sempre à vista; a infusão aberta à
  direita, com a velocidade da bomba numa linha de resultado; índice de seção
  denso e agrupado por sistema, no lugar da grade de cartões.
- **C · leitura de manual** (Anthropic, Doctronic): a conduta como página de
  manual, passos como títulos e tabelas (medida, quando, observação), com "Nesta
  conduta" à direita; os escores agrupados numa lateral e a ferramenta aberta ao
  lado, sem voltar ao índice.

Em qualquer opção: `Card` e `Badge` da Central sem sombra e sem maiúsculas; a
grade colorida do celular vira lista; as peças repetidas ("Bloco", "Linha")
passam a uma só. Nenhuma dose, limiar ou texto clínico muda. Os agrupamentos por
sistema da opção B são de exemplo: os grupos de verdade saem da classificação
que o RT aprovar.

**Escolha do RT (23/10/2026): C, conduta e escores como leitura de manual, com a
lateral de navegação.** Aplicada na branch `feat/visual-3-8-central`:

- **Lateral da seção** (`LateralSecao.tsx`, novo): dentro de qualquer ferramenta,
  a partir de 1024 px, as ferramentas da seção ficam à esquerda, nos grupos que
  a seção já tem (emergências e pediatria) ou na ordem do cadastro, com filtro;
  a atual em destaque. A troca é sem voltar ao índice. No celular, some.
- **Nesta página** (`ToolLayout`): com três partes ou mais (títulos dos cartões),
  à direita, a partir de 1280 px, leva a cada parte; acompanha o resultado que
  aparece depois de preencher. O aviso de apoio à decisão e a fonte viram texto
  com fio em cima (mesmo texto, mesmo `role`).
- **Corpo da ferramenta** (`.cc-leitura` no `index.css`): cartões sem sombra;
  selos sem maiúsculas e sem fundo, na própria cor; as linhas em caixa dentro dos
  cartões viram linhas separadas por fio. Avisos tintados e campos não mudam.
  Vale para as 212 ferramentas sem tocar no conteúdo de cada uma.
- **Escore** (`EscoreTela`): cada item numa linha, a pergunta à esquerda e as
  opções em cápsula (`Chip`, radio) à direita (opções longas descem); o resultado
  em frase ("CURB-65: 3 pontos · mortalidade em 30 dias 17%"), com o número na cor
  da faixa (antes era a borda do cartão), sem bolha.
- **Índice da seção** (`SectionHome`): uma linha por ferramenta, nome e para que
  serve, agrupada quando a seção tem grupos; filtro também nas seções com mais de
  12 ferramentas (os 39 escores). Sai a grade de cartões.
- **Infusões**: velocidade e dose em linhas de resultado, sem caixa tintada nem
  número de 30 px; sai o ícone em quadrado e a contagem em pílula do grupo.
- **Início da Central**: no celular, a grade de blocos coloridos vira lista;
  atalhos e busca sem sombra e sem "levantar" ao passar o mouse; "Modo do
  paciente" sem maiúsculas.
- Nenhuma dose, limiar, texto clínico ou cálculo mudou: `npm run test:clinico`
  (929 testes) verde. Typecheck, lint, catraca (uma exceção `padrao-ok` a menos)
  e build verdes. Visto na página de teste com os componentes reais
  (`central-C-aplicada-*.jpg`): escore, conduta, índice, infusão, abstinência no
  escuro e início no celular.

**Ajuste do RT (23/10/2026): escores por especialidade**, na lateral e no índice
("cardiologia com HAS-BLED, HEART e outros"). Os 39 escores ganharam grupos em
`src/content/gruposSecoes.ts`: Cardiologia (10: HEART, TIMI, TIMI IAMCSST, GRACE,
Killip, CHA₂DS₂-VA, HAS-BLED, as duas regras de síncope e Duke), Pneumologia e
tromboembolismo (8), Neurologia (4), Gastroenterologia e hepatologia (8), Terapia
intensiva e sepse (4), Hematologia (2), Trauma (2: Canadian CT Head Rule e ISS) e
Nefrologia (1: CKD-EPI). Os endereços e os favoritos não mudam; o teste
`gruposSecoes.test.ts` confere que cada escore está em exatamente um grupo
(`central-escores-*.jpg`).

**Junção das seções e modo do paciente (pedido do RT de 23/10/2026).** Calculadoras e
"Emergências — manual HC" viraram uma seção só, **"Condutas e cálculos — adulto"** (109
ferramentas), na primeira posição da Central. A junção é só de exibição (`SECOES_JUNTAS` e
`secaoExibida` no registry): cada calculadora segue no endereço de sempre
(`/plantonista/calculadoras/...`) e com a mesma chave de favorito e de uso no banco, então
nenhum favorito se perde e nada muda no banco. As calculadoras entraram nos grupos por assunto
(um grupo novo, "Infusões e via aérea", e as demais nos grupos de anticoagulação, eletrólitos,
neurológico e procedimentos); o teste dos grupos passou a contar as duas seções. A trilha, a
lateral, a busca e a paleta mostram o nome novo. O bloco "Adulto ou pediátrico?" do início só
aparece no celular; na tela larga cada ferramenta pergunta o paciente na própria tela
(`central-juncao-*.jpg`).

Itens repetidos (levantamento com arquivo e linha, para o RT decidir): duas duplicatas exatas
(a porta única das infusões e as três entradas que abrem a mesma tela numa classe; as duas
entradas de heparina não fracionada, que abrem a mesma tela); os demais pares parecidos são
complementares (outra indicação ou outra fonte).

**Escolha do RT (23/10/2026):** fica só a **porta única das infusões** (saem "Drogas
vasoativas", "Sedação contínua" e "Bloqueio neuromuscular contínuo": a mesma tela, a mesma
regra do Anexo 1 e do PADIS 2025, e a busca já acha pela droga) e **uma entrada só para a
heparina**, "Heparina não fracionada EV — dose e ajuste pelo TTPa" (a dose 80/18 e o nomograma
da Tabela 7 já estavam na mesma tela). Os endereços antigos redirecionam: as três classes abrem
a porta única já na classe (`?classe=`), e o ajuste da heparina abre a heparina. As palavras de
busca das entradas que saíram foram para a que ficou (sem "dopamina", que a tela não tem).
Quem tinha uma dessas quatro entradas como favorita perde esse favorito (o RT foi avisado). Os
pares complementares ficam: heparina EV × anticoagulação plena (60/12 com lítico e TTPa 60–80 ×
80/18 e 46–70, contextos diferentes), escolha de acesso × calibres e IO, sequência rápida ×
sedação para procedimento, vasoativas × ressuscitação volêmica.

## O que o padrão já fixou (não muda nesta parte)

Cores e tokens nos dois temas, ação em petróleo, marca teal, peças de base
(`Aviso`, `MensagemErro`, `Vazio`, `Chip`, `Abas`, `BotaoLinha`, tabelas),
tamanhos de texto e cantos do projeto, grupos do menu do gestor e nomes do menu,
a catraca da CI.
