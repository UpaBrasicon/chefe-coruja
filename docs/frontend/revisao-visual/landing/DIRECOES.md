# Revisão visual — parte 1, landing (piloto)

Trilha "Revisão visual" do `BACKLOG.md`, decisões do RT "1c 2a 3a 4a" (20/10/2026).
Fica o que a trilha do padrão fixou: ação em petróleo, quadrado teal da marca, a
coruja, o tema escuro, os tokens e a catraca da CI. Muda composição, tipografia,
layout e imagens. Este documento traz o diagnóstico da landing atual e três
direções para o RT escolher antes da aplicação.

## 1. Diagnóstico da landing atual

Imagens: `atual-desktop.jpg` e `atual-celular.jpg` (produção, 20/10/2026).

O que dá a cara de "feito por IA" (padrões repetidos em milhares de páginas
geradas, sem nada que seja só do Chefe Coruja):

- **Formas soltas de enfeite:** barras arredondadas giradas a −38°, bolhas, anel e
  quatro discos com ícone flutuando em volta da coruja (`.palco-campo`, `.orbita`).
  Não dizem nada sobre o produto.
- **Etiqueta-pílula acima do título** ("Gestão de plantão hospitalar") e **uma
  palavra do título em outra cor** ("porta"). Os dois são o reflexo mais comum de
  página gerada.
- **Fileira de números no herói** ("12h · 6h / 8 / 1") que não pede ação.
- **Mesmo molde em toda seção:** traço + rótulo em maiúsculas, título, subtítulo e
  três itens com ícone num quadrado colorido. Seis seções seguidas no mesmo ritmo.
- **Imagens geradas por IA** em três seções: enfermeira com prontuário em holograma,
  "guardião cibernético" e médica segurando certificado da LGPD. São a parte mais
  visível do problema e prometem o que o produto não mostra.
- **Cartões que sobem no hover** com barra colorida no topo, em grade 2×3.
- **Uma família só, sempre peso 600**, e o tamanho fazendo todo o trabalho.
- **Cor fora do padrão:** a landing usa o teal antigo (`#0F766E`) como ação, não o
  petróleo do guia (`#155E75`), e tem hex soltos no `landing.css`.
- **Sem tema escuro:** a landing fica sempre clara, mesmo com o tema escuro do app.

Crítica do `impeccable` (20/10/2026, revisão de design e detector em agentes
separados; registro em `.impeccable/critique/`): nota 17/32 nas heurísticas de
Nielsen (7 e 10 fora, por ser landing). Achados que somam ao diagnóstico:

- **[P0] A imagem da médica com "certificado de conformidade com a LGPD" sugere uma
  certificação que não existe.** O PRODUCT.md proíbe inventar isso.
- **Dez seções e repetição:** o check-in "dentro do raio" é explicado três vezes,
  "leito antes do nome" duas, e há três fileiras de números. A seção "O sistema
  visual" é texto de designer, não argumento.
- **Papéis:** o herói diz 8, a seção mostra 6 e o PRODUCT.md lista 9 (faltam
  Faturamento, Regulador/NIR e Telemedicina). Os seis cartões levam todos ao mesmo
  login, e "Primeiro acesso" só aparece no fim da página.
- **Texto:** jargão de dev e de design na página pública (`npm run test:banco`,
  "grandeza", "numeral", "gateway", "handoff"); quatro nomes para o mesmo botão de
  entrar (guia 5.2); maiúsculas por CSS (guia 5.1).
- **Celular:** sem menu abaixo de 860 px, página de 8.989 px, "Passe o mouse" em
  tela de toque.
- **Fonte:** o detector marca o Geist como fonte saturada (a mesma de milhares de
  páginas geradas). O Geist é a fonte do app inteiro.
- O detector não achou nada no código da landing (a leitura estática não mede
  layout) e não pôde rodar na página publicada: a CSP de produção bloqueia o
  script dele, como deve.

O que está certo e fica: o posicionamento ("a escala é a porta"), o texto, a faixa
de parâmetros do produto (é a única peça real do produto na página), a seção de
verificação com números contados no código e a transição em onda até o login.

## 2. Referências do Refero

| Referência | O que vem dela | O que não vem |
|---|---|---|
| Operate (operate.so) — "livro de registro" | Grade fina como estrutura, rótulos em fonte mono, seções como linhas de um registro | O verde e o violeta deles |
| Vectary / Spellbook — B2B sóbrio | Hierarquia só por tamanho e espaço, sem enfeite | — |
| Ease Health (easehealth.com) — clínico editorial | Título em serifa leve, bloco de cor cheia no herói ao lado de peças do produto, planos de cor sem sombra, cantos de 14 px | O verde-floresta deles |
| Function Health | Serifa como voz de autoridade calma | Creme e laranja |
| Dovetail / Axiom — central noturna | Fundo escuro com grade quase invisível, painel do produto como palco, rótulos mono, um só acento | Azul e laranja deles |

## 3. As três direções

Todas usam o mesmo texto da landing atual, a ação em petróleo, o quadrado teal e a
coruja. Todas trocam as imagens geradas por IA por peças do próprio produto
(desenhadas em código, com valores ilustrativos marcados como tal). Nenhuma inventa
número, depoimento ou cliente.

### A — Livro da escala

Imagens: `a-livro-da-escala-desktop.jpg`, `a-livro-da-escala-celular.jpg`.

- **Ideia:** a página é a própria escala. O herói mostra a grade do dia (24 h,
  colunas de 2 h) com a linha do "agora" pelo relógio do servidor: quem está dentro
  do turno tem a porta aberta, quem não está vê a tela de espera. O posicionamento
  vira imagem, sem metáfora.
- **Tipografia:** Geist 500 grande e apertada no título; Geist Mono nos rótulos,
  horas e numeração das seções.
- **Layout:** folha pautada com a grade da escala ao fundo; seções como linhas de
  registro numeradas (1.1, 1.2…), com fio fino entre elas. Sem cartão, sem sombra.
- **Coruja:** sai do palco e assina a seção dos papéis, pequena.
- **Tema escuro:** a mesma folha com os tokens escuros do guia.
- **A favor:** a mais específica do produto; nenhuma outra empresa usaria esta
  página. **Contra:** a mais austera; a coruja perde presença. No celular a grade de
  24 h aperta: lá ela mostra só as 6 h em volta do "agora".

### B — Prontuário clínico

Imagens: `b-prontuario-clinico-desktop.jpg`, `b-prontuario-clinico-celular.jpg`.

- **Ideia:** a calma de um prontuário bem escrito. Herói dividido: bloco cheio em
  petróleo escuro com o título e a coruja; ao lado, peças do produto empilhadas
  (leitos 12A, 14B, Box 1 com o prazo de cada um, a faixa de números e o aviso da
  farmácia).
- **Tipografia:** Newsreader (serifa) leve nos títulos; Geist no resto. Fonte nova
  no projeto (só na landing e, na parte 2, nas telas de entrada).
- **Layout:** planos de cor suaves sem sombra (petróleo, sálvia e areia bem claros),
  cantos de 14 px, papéis numa grade de 3 com fio fino.
- **Coruja:** fica no herói, no canto do bloco petróleo.
- **Tema escuro:** bloco e planos com os tokens escuros; a serifa se mantém.
- **A favor:** a mais acolhedora e a que mais parece produto de saúde de primeira
  linha. **Contra:** entra uma família de fonte nova; a serifa é a direção mais
  usada hoje em sites de saúde.

### C — Plantão noturno

Imagens: `c-plantao-noturno-desktop.jpg`, `c-plantao-noturno-celular.jpg`.

- **Ideia:** a cena de madrugada do PRODUCT.md. Fundo escuro com a paleta já
  aprovada do tema escuro, o painel "Meu plantão" como palco (faixa de parâmetros e
  lista de leitos), números grandes na cor do estado. A coruja, que é bicho da
  noite, vigia o plantão.
- **Tipografia:** Geist 600 grande e apertada; Geist Mono nos rótulos e horários.
- **Layout:** grade de 48 px quase invisível; seções em blocos com fio de 1 px;
  um acento só (o ciano da ação no escuro).
- **Coruja:** grande no herói, com um halo discreto.
- **Tema claro:** a página segue o tema do aparelho; no claro, os mesmos blocos com
  os tokens claros.
- **A favor:** a mais impactante e a que usa o tema escuro como argumento.
  **Contra:** escuro é o padrão de "central de comando" de software técnico; o risco
  é parecer ferramenta de desenvolvedor, não de hospital. A fileira de números da
  verificação continua (mas são números contados no código). O detector marca a
  grade de fundo como reflexo comum (aviso, não erro).

Detector nas maquetes: B teve 3 avisos (entrelinha e fonte), A teve 14 (10 são
"padding apertado" nas linhas da grade, falso positivo de tabela com fio), C teve
os rótulos acima do título, já tirados da maquete.

## 4. O que vale para qualquer direção

- As três imagens geradas por IA saem. No lugar: peças do produto em código, e,
  quando houver, capturas reais da homologação com pacientes fictícios.
- A landing passa a seguir o tema (claro, escuro ou automático), como o app.
- A ação vai para o petróleo do guia e os hex soltos do `landing.css` viram tokens
  de marca (guia, seção 4.6).
- A transição em onda até o login fica.
- O texto é o atual, mas a página pode encolher para cerca de cinco movimentos
  (porta, faixa do produto, fatos, papéis, entrada), com os nove papéis do
  PRODUCT.md e "Primeiro acesso" ao lado de "Entrar". Isso muda texto e depende do
  RT.
- Nenhuma regra nova na catraca da CI; os títulos de marca seguem com `padrao-ok`.

## 5. Decisão do RT (20/10/2026)

1. **Direção: A com o título de B.** Base do Livro da escala (grade da escala no
   herói, linha do "agora", seções como linhas de registro); os títulos em
   Newsreader leve, como em B.
2. **Imagem do "certificado LGPD": sai já**, em correção própria, antes do PR da
   landing.
3. **Conteúdo enxuto:** cerca de cinco movimentos (porta, faixa do produto, fatos,
   papéis, entrada), os nove papéis do PRODUCT.md, "Primeiro acesso" ao lado de
   "Entrar", sem a seção "O sistema visual" e sem jargão.
4. **Fonte: segue a direção.** Newsreader nos títulos, Geist no texto, Geist Mono
   nos rótulos e horas. Só na landing; o app segue no Geist.

## 6. Aplicação (20/10/2026)

- **Correção da imagem LGPD:** branch `fix/landing-certificado-lgpd`, só tira a
  imagem e deixa a seção com o texto.
- **Landing:** branch `feat/visual-1-landing`, montada sobre a correção.
  - Herói com o título em Newsreader e a escala do dia (régua de 24 h, linha do
    "agora", três pessoas dentro e duas fora). As colunas da régua sobem por trás
    do título. No celular a escala vira lista: papel, turno e estado.
  - A faixa de parâmetros fica, com a explicação das duas regras numa frase.
  - Cinco grupos de registro (plantão, prontuário, segurança, dados pessoais,
    verificação): rótulo na margem, título e linhas com fio. Os nove papéis do
    PRODUCT.md, sem link falso; a coruja assina a margem dos papéis.
  - Saíram as formas de enfeite, a etiqueta acima do título, a palavra em cor, os
    números do herói, a seção "O sistema visual" e as três imagens e o vídeo
    gerados por IA (`seguranca.webp`, `prontuario.mp4`, `prontuario-poster.webp`).
  - Texto sem jargão ("passagem de plantão" no lugar de "handoff"; sem
    `npm run test:banco` nem "gateway"); "Entrar" e "Primeiro acesso" com o mesmo
    nome em todo lugar e lado a lado no topo, no herói e no fecho.
  - Cores só dos tokens `--cc-*`: a página segue o tema do aparelho e a escolha
    salva, e a ação é o petróleo do guia. Nenhum hex no `landing.css`.
- **Evidência:** `aplicada-claro-desktop.jpg`, `aplicada-escuro-desktop.jpg`,
  `aplicada-claro-celular.jpg`, `aplicada-escuro-celular.jpg` (sem rolagem
  lateral em 1280 e 390 px nos dois temas). Detector do `impeccable` na página
  local: 1 aviso (listras do turno fora da escala, uso intencional: hachura marca
  o turno indisponível). Catraca do padrão sem divergência nova; typecheck e build
  verdes.
- **Fica para depois:** o rodapé não tem política de privacidade (o app não tem a
  página); a tela de login e o resto das telas de entrada são a parte 2.
