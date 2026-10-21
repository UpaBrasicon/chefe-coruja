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

## O que o padrão já fixou (não muda nesta parte)

Cores e tokens nos dois temas, ação em petróleo, marca teal, peças de base
(`Aviso`, `MensagemErro`, `Vazio`, `Chip`, `Abas`, `BotaoLinha`, tabelas),
tamanhos de texto e cantos do projeto, grupos do menu do gestor e nomes do menu,
a catraca da CI.
