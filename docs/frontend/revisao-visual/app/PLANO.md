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

## O que o padrão já fixou (não muda nesta parte)

Cores e tokens nos dois temas, ação em petróleo, marca teal, peças de base
(`Aviso`, `MensagemErro`, `Vazio`, `Chip`, `Abas`, `BotaoLinha`, tabelas),
tamanhos de texto e cantos do projeto, grupos do menu do gestor e nomes do menu,
a catraca da CI.
