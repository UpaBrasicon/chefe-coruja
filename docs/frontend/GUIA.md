# Guia do padrão do frontend

Parte 2 da trilha "Padrão do frontend" do BACKLOG. Cada seção registra as
decisões do responsável técnico (RT), tomadas em quatro rodadas em 19/10/2026. O
guia vale para toda tela nova e para as correções da parte 4; a parte 3
transforma as regras que dá para checar em verificação automática na CI.
Mudança no guia passa por PR, com a decisão do RT registrada.

Base: `docs/frontend/LEVANTAMENTO.md` (o que existe e onde diverge) e
`PRODUCT.md` (usuários, marca e princípios).

## 1. Base (rodada 1, 19/10/2026)

### 1.1 Cor do produto — decisão "C, petróleo"

| Papel | Tema claro | Tema escuro | Uso |
|---|---|---|---|
| Ação | `#155E75` | `#67E8F9` (texto `#0F172A` sobre ele) | Botão principal, link, seleção (chip ativo, item marcado) |
| Ação pressionada | `#164E63` | `#22D3EE` | Hover e pressionado |
| Marca | `#0D9488` | `#0D9488` | **Só** a marca: o quadrado da coruja e a identidade. Nunca em botão ou estado |

- Contraste medido: ação sobre branco 7,3:1; ação escura sobre o fundo escuro
  (`#0F172A`) 12,3:1. Os dois passam do AA.
- O teal da marca é intocável (PRODUCT.md), mas deixa de ser a cor das ações.
- **Classificação de risco sempre com o nome escrito.** O petróleo fica perto do
  azul da classificação; por isso a cor da classificação nunca aparece sozinha:
  o selo leva o nome ("Azul · Não urgente"). Isso já vale pela regra clínica de
  não depender só da cor.
- Imagens de comparação: `docs/frontend/propostas-cor/`.

### 1.1.1 Paleta do tema escuro — aprovada pelo RT ("1a", 19/10/2026)

Contraste medido sobre o fundo (`#0F172A`) e o cartão (`#1E293B`); todo texto
passa de 4,5:1 também sobre a faixa (`#273449`). Os valores moram em
`src/index.css` (`--cc-*` em `:root[data-tema="escuro"]`). Imagens:
`docs/frontend/tema-4-1/`.

| Papel | Token | Escuro | Contraste (fundo / cartão) |
|---|---|---|---|
| Fundo da página | `campo` | `#0F172A` | — |
| Cartão | `superficie` | `#1E293B` | — |
| Faixa e hover | `trilha` | `#273449` | — |
| Borda / borda forte | `fio` / `fio-forte` | `#334155` / `#64748B` | borda forte 3,8 / 3,1 |
| Texto / apoio / sussurro | `tinta` / `tinta-apoio` / `tinta-sussurro` | `#E2E8F0` / `#CBD5E1` / `#94A3B8` | 14,5 / 12,0 / 7,0 sobre o fundo |
| Ação / pressionada | `acao` / `acao-pressionada` | `#67E8F9` / `#22D3EE` | 12,3 / 9,9 |
| Texto sobre a ação | `sobre-acao` | `#0F172A` | 12,3 |
| Crítico / atenção / conforme | `critico` / `atencao` / `conforme` | `#F87171` / `#FBBF24` / `#4ADE80` | 6,5 / 10,7 / 10,3 |
| Observação / suprimento / pediatria | `observacao` / `suprimento` / `pediatria` | `#FB923C` / `#60A5FA` / `#C4B5FD` | 7,9 / 7,0 / 9,7 |

A classificação de risco (`mts-*`) e a marca têm o mesmo valor nos dois temas.
A folha impressa não lê estes tokens e sai sempre clara.

### 1.2 Contraste — "2a"

AA é piso obrigatório nos dois temas: 4,5:1 para texto e 3:1 para ícone, borda
e elemento não textual. A verificação automática mede (parte 3).

### 1.3 Densidade — "3a"

Telas densas de propósito: leitos, pendências e horário à vista sem rolar.
Espaço só quando ajuda a ler.

### 1.4 Modo escuro — obrigatório (PRODUCT.md) e "4a"

- Segue o tema do sistema operacional do aparelho.
- Chave manual no menu do usuário: claro, escuro ou automático, guardada por
  pessoa.
- Todo token de cor tem o valor claro e o escuro; nenhuma tela usa cor fora dos
  tokens.

### 1.5 Texto — "5a"

- Só os tamanhos do projeto (`text-rotulo`, `text-apoio`, `text-controle`,
  `text-dialogo` e os de título); os tamanhos do Tailwind (`text-xs`…`text-2xl`)
  e os arbitrários (`text-[11px]`) ficam proibidos.
- **Piso de 12 px na tela.**
- Exceções declaradas: painel da TV, folha impressa (escala própria em pt) e
  eixos de gráfico.

## 2. Componentes de feedback (rodada 2, 19/10/2026)

### 2.1 Aviso — "1a"

Um componente `Aviso` com `tom` (`atencao`, `critico`, `conforme`, `informacao`,
`marca`). Cada tom tem um fundo suave, a borda e o texto próprios, com valores
para o tema claro e o escuro. Saem os fundos claros soltos (as 36 lavagens no
estilo Tailwind-50, como `#FEF2F2`) e as variações de opacidade
(`bg-critico/[0.0x]`).

### 2.2 Mensagem de erro — "2a"

- Um componente só, `MensagemErro`, em dois formatos:
  - **linha** sob o campo (texto pequeno no tom crítico, ligado ao campo por
    `aria-describedby`);
  - **caixa** para falha de ação ou de carga (salvar, carregar a lista).
- Sempre `role="alert"`, para o leitor de tela anunciar.
- O texto é uma frase que diz o que falhou e o que fazer: "Não foi possível
  salvar a evolução. Tente de novo." Nunca a mensagem crua do banco ou da rede.
  Quando a regra do servidor já devolve uma frase para a pessoa (ex.: "Escreva o
  motivo…"), ela é mostrada como veio.
- Substitui o `<Erro>` que hoje mora em `pages/farmacia/Farmacia.tsx`.

### 2.3 Vazio e carregando — "3a"

- **Vazio:** sempre o `Vazio`. Na página, com título e texto; dentro de seção,
  na variante de uma linha. O texto começa por "Nenhum"/"Nenhuma" e diz o que
  falta ("Nenhum exame pedido neste atendimento.").
- **Carregando:** spinner com o nome do que carrega ("Carregando exames…"),
  centralizado. Esqueleto de carregamento fica para depois.

## 3. Componentes de formulário e dados (rodada 2, 19/10/2026)

### 3.1 Botões — "4a"

`<button>` solto só dentro dos componentes de base (`src/components/ui` e as peças
como `Chip` e abas) e na casca (`src/components/casca` e `AppShell`), onde os
botões são a própria navegação (parte 4.3, "2a"). No resto: `Button`, `Chip`, ou `Button size="icon"` com
`aria-label`. A cor de ação é o petróleo (seção 1.1).

### 3.2 Seleção — "5a"

Select nativo com uma classe única, num componente `CampoSelecao` em
`src/components/ui`. No celular e no tablet ele abre a roda do sistema. Saem as
14 cópias da mesma classe (`SELECT`, `selectCls`).

### 3.3 Tabelas — "6a"

Um componente de tabela único (`src/components/ui/table.tsx`, ajustado ao
padrão), usado nas 64 tabelas feitas à mão. Para lista de pacientes, uma versão
que vira lista empilhada no celular.

## 4. Organização do código (rodada 3, 19/10/2026)

### 4.1 Títulos — "1a"

- `TituloPagina` em toda tela com rota, inclusive dentro de abas (`TabsPagina`) e
  das ferramentas (`ToolLayout`).
- Dentro da tela: `TituloSecao` para seção e `TituloCartao` (novo, menor) para
  cartão. Nada de `<h1>`/`<h2>` feito à mão fora dessas peças.

### 4.2 Peças duplicadas — "2a"

Uma versão única de cada peça repetida hoje: `Campo` (7 cópias), `Aviso` (5),
`Cartao` (5), `Abas` (3), `Chip` (6) e `Secao` (6). Formulário e feedback ficam
em `src/components/ui`; peças de página, em `src/components/monitor`.

### 4.3 Cantos e espaçamento — "3a"

- Cantos só com os nomes do projeto: `rounded-controle`, `rounded-container`,
  `rounded-cartao`, `rounded-capsula`. Os nomes do Tailwind (`rounded-lg`…) e o
  `rounded-menu` saem.
- Espaçamento: cinco tokens do ritmo atual — `justo` (7 px), `proximo` (12 px),
  `base` (14 px), `secao` (22 px) e `pagina` (28 px). O resto do espaçamento não
  é barrado na verificação.

### 4.4 Datas, horas e números — "4a"

Um arquivo único, `src/lib/formato.ts`: hora, data, data e hora, tempo relativo
("há 1h05"), moeda e número, sempre no fuso de Brasília e com vírgula decimal.
O `src/lib/datas.ts` entra nele; as 127 versões locais saem.

### 4.5 Onde as peças moram — "5a"

- Uma tela não importa peça de tela de outra área; componente não importa de
  tela. Peça usada por mais de uma área mora em `src/components`.
- Antes de a regra entrar na verificação, as 58 importações cruzadas mudam para
  o lugar certo.

### 4.6 Telas de marca — "6a"

Login, cadastro, recuperar senha, painel da TV e página pública ganham tokens
próprios de marca (`marca-escura`, `marca-clara`, `marca-texto-claro`) e ficam
como exceção declarada. Nenhum hex solto nelas.

## 5. Texto e navegação (rodada 4, 19/10/2026)

### 5.1 Maiúsculas — "1a"

Maiúscula só no começo da frase em título, menu, aba e botão ("Minha agenda",
"Revisão clínica"). Siglas seguem em maiúscula (CID, SIGTAP, AIH, APAC, BPA, NIR,
PS). Nomes próprios do produto ficam como estão: "Chefe Coruja", "Olho de
Gavião", "Central do Plantonista", "Central do Farmacêutico" (parte 4.3, "3a"),
"Corujinha". Nome próprio novo entra nesta lista por decisão do RT.

### 5.2 Mesmo destino, mesmo nome — "2a"

Um item de menu que leva à mesma tela tem o mesmo nome para todo papel
("Notificação compulsória"). O nome só muda quando a ação muda de fato (por
exemplo, a retirada sem farmacêutico é outra ação na mesma tela). Na parte 4.3
("1a") o menu ficou: Notificação compulsória, BPA, Contas do atendimento, AIH,
APAC, Pendências do NIR, Rede e Telemedicina para todos os papéis; na barra do
celular, os curtos Central, Prontuários e Agenda.

### 5.3 Pronto-Socorro — "3a"

Escreve-se "Pronto-Socorro", com hífen.

### 5.4 Emoji e o formulário de internação antigo — "4a"

- Emoji fica proibido na tela e na folha impressa; no lugar, ícone (lucide).
- O formulário de internação legado (`/plantao/internacao/formulario`) é
  retirado, como a auditoria de 03/10/2026 sugeria. Feito na parte 4.7a: o endereço antigo, a
  busca rápida e as pendências do PEP levam ao leito aberto do paciente
  (`/plantao/internacao/pacientes?paciente=…&aba=…`, `src/components/internacao/rotas.ts`).

### 5.5 Gráficos — "5a"

As cores dos gráficos (recharts e SVG) vêm dos tokens, por `var(--color-…)`, e
funcionam nos dois temas.

### 5.6 Menu do gestor — "6a"

O menu do gestor (30 itens) é agrupado por área — Porta, Leitos, Farmácia,
Exames, Faturamento e Unidade — numa tarefa própria da parte 4.

## 6. Como o guia entra no código (partes 3 e 4)

1. **Tokens como variáveis, com claro e escuro.** Hoje o Tailwind grava a cor
   dentro da classe (`@theme inline`), e o tema não troca em tempo de
   execução. Os tokens passam a ser variáveis CSS com o valor claro e o escuro,
   a cor de ação vira o petróleo e entra a chave de tema no menu do usuário.
2. **Peças novas e únicas**, sem mudar tela: `Aviso`, `MensagemErro`,
   `CampoSelecao`, `TituloCartao`, a variante de linha do `Vazio`, a tabela
   ajustada, `src/lib/formato.ts` e os tokens de espaçamento e das telas de
   marca. As peças das importações cruzadas mudam para `src/components`.
3. **Verificação na CI (parte 3):** regras de ESLint para o que é estrutural
   (`<button>`, `<select>`, `<table>` e `<h1>` soltos, importação cruzada,
   formatação de data fora de `formato.ts`) e um script com catraca, que
   guarda a contagem de divergências por arquivo e falha se ela subir. Assim o
   guia vale já para código novo.
   Feita na parte 3 (seção 7).
4. **Correção tela por tela (parte 4)**, na ordem do plantão: casca e menus,
   recepção e painel da TV, atendimento e documentos da porta, triagem e
   enfermagem, leito aberto, observação, farmácia, Central do Plantonista e
   ferramentas. A escala do gestor e o menu do gestor são tarefas próprias. O
   formulário de internação legado sai.


## 7. Verificação na CI (parte 3, decisões "1a 2a 3a 4a 5a", 19/10/2026)

- **Um script só, com catraca** ("1a"). `scripts/padrao-frontend.mjs` lê cada
  arquivo de `src/` pela árvore do TypeScript e conta, por arquivo e por regra, o
  que foge deste guia. O ESLint fica com as regras que já estão em zero; hoje
  nenhuma regra do guia está em zero, então o ESLint não mudou.
- **Regras contadas:** cor crua (paleta do Tailwind, branco e preto), cor e
  opacidade arbitrárias em classe, hex/rgb fora de classe, tamanho de texto fora
  dos tokens, canto fora dos quatro nomes, `<button>`, `<select>`, `<table>` e
  `<h1>`/`<h2>` fora da base, data/hora/número formatado fora de
  `src/lib/formato.ts`, importação cruzada, emoji e "Pronto Socorro" sem hífen.
  As exceções declaradas na seção 1.5 (painel da TV e folha impressa) ficam
  fora da conta de texto; a folha impressa, também da conta de hex.
- **Como trava** ("2a"). A base fica em `scripts/padrao-frontend.base.json`. A CI
  falha se algum arquivo subir em alguma regra, se um arquivo novo nascer com
  divergência, se a base ficar para trás de uma correção e se a base do PR subir
  em relação à do ramo de destino. Quem corrige roda
  `node scripts/padrao-frontend.mjs --atualizar` e comita a base junto.
- **Exceção pontual** ("3a"). `// padrao-ok: <motivo>` na linha ou na linha de
  cima (no JSX, `{/* padrao-ok: <motivo> */}`). Sem motivo, a CI falha. O
  relatório (`npm run padrao`) lista todas as exceções.
- **`impeccable`** ("4a") fica fora da CI: o detector dele procura vícios
  genéricos de design e não conhece os tokens nem os componentes deste guia.
  Continua como ferramenta local de revisão de tela na parte 4.
- **Verificação no navegador** ("5a") — contraste, foco e transbordo com
  `scripts/verificacao-telas.mjs` — entra no fim da parte 4, quando os tokens
  já forem variáveis com os dois temas.

## 8. Peças de base (parte 4.2, decisões "1a 2a 3a", 19/10/2026)

| Peça | Onde mora | Guia |
|---|---|---|
| `Aviso` (`tom`: atencao, critico, conforme, informacao, marca) | `src/components/ui/aviso.tsx` | 2.1 |
| `MensagemErro` (`formato`: linha ou caixa; `texto`, ou `erro` + `acao`) | `src/components/ui/mensagem-erro.tsx`; classificação em `src/lib/erros.ts` | 2.2 |
| `Vazio` (bloco) e `VazioLinha` | `src/components/monitor/Pagina.tsx` | 2.3 |
| `Carregando` (spinner com o nome do que carrega) | `src/components/ui/spinner.tsx` | 2.3 |
| `CampoSelecao` | `src/components/ui/campo-selecao.tsx` | 3.2 |
| `TituloPagina`, `TituloSecao`, `TituloCartao` | `src/components/monitor/Pagina.tsx` | 4.1 |
| `Abas` (cápsula, tablist; contagem opcional por aba) | `src/components/monitor/Pagina.tsx` | 4.2 |
| Texto sobre as cores da classificação (`text-mts-texto`; no amarelo, `text-mts-amarelo-texto`) | `src/index.css`, igual nos dois temas | 1.1 (parte 4.6) |
| `Chip` (`variante`: filtro ou opcao; `radio` para radiogroup; `tom` critico; `titulo`, `desabilitado`) | `src/components/monitor/Pagina.tsx` | 3.1 |
| Tabela de referência das ferramentas (`<Table variante="referencia">`: só estrutura, o desenho vem do className) | `src/components/ui/table.tsx` | 3.3 (parte 4.10b) |
| `BotaoLinha` (cartão, linha ou tracejado clicável) e `OpcaoLista` (opção de lista suspensa) | `src/components/ui/botao-linha.tsx` | 3.1 (parte 4.5) |
| `CaixaMarcar` (caixa de marcar com texto; `bloqueado` mostra X) | `src/components/ui/caixa-marcar.tsx` | 3.1 (parte 4.5) |
| Tokens do painel da TV (`tv-fundo`, `tv-faixa`, `tv-borda`, `tv-chamada`, `tv-trilho`, `tv-destaque`, `tv-apoio`, `tv-texto`, `tv-texto-forte`, `tv-claro`, `tv-alerta`) | `src/index.css`, iguais nos dois temas | 4.6 (parte 4.4, "1a") |
| Espaçamento `justo`, `proximo`, `base`, `secao`, `pagina` (`p-base`, `gap-justo`…) | `src/index.css` (`--spacing-*`) | 4.3 |
| Hora, data, data e hora, tempo decorrido, moeda e número | `src/lib/formato.ts` (`datas.ts` reexporta os nomes antigos) | 4.4 |

- **Erro do servidor** ("3a"): a recusa de uma regra do banco (`RAISE EXCEPTION`,
  código P0001) aparece como veio, sem o prefixo de código. Rede, permissão e
  erro técnico mostram "Não foi possível <ação>. Tente de novo." e o detalhe vai
  para o registro de erros do admin.
- **Painel da TV** (parte 4.4, "2a"): escala pela altura da tela; texto e canto
  em `vh` são exceção declarada. Canto fixo usa os nomes do projeto.
- **Importação entre telas** (4.5): uma tela que agrupa telas (as abas de
  `pages/grupos/`, Indicadores, Configuração) pode montar outra tela inteira — o
  import traz só a tela (o default, ou o nome igual ao do arquivo). Peça, hook
  ou constante de outra área não: moram em `src/components`, `src/hooks` ou
  `src/lib`. Com a contagem em zero, "componente não importa tela" entrou no
  ESLint como erro.
