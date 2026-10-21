# Revisão visual — parte 2, telas de entrada

Trilha "Revisão visual" do `BACKLOG.md`. O RT pediu "a mesma direção da landing"
(20/10/2026): o "Livro da escala" com títulos em serifa, registrado em
`../landing/DIRECOES.md`. Por isso esta parte não traz direções novas.

## Telas

| Tela | Rota | O que mudou |
|---|---|---|
| Entrar | `/login` | Coluna da marca nova; título do formulário em serifa; o painel "Primeira vez" trocou os cartões com ícone por linhas de registro |
| Primeiro acesso | `/cadastro` | A mesma coluna, com os dois passos como linhas numeradas e a marca "agora" no passo atual; saiu a etiqueta "Passo 1 de 2" acima do título (o passo já aparece na coluna, também no celular) |
| Esqueci a senha | `/recuperar-senha` | Herda a coluna e o título do Entrar |
| Aguardando liberação | `/aguardando` | Página de entrada (topo com a marca, título em serifa, linhas). O texto não fala mais em três papéis: quem libera é o gestor da unidade ou a administração da rede |
| Escolher a unidade | `/seletor` | Unidades como linhas clicáveis (nome, papel e seta), no lugar dos botões em cartão |
| Link de receita | `/r/:tipo/:token` | Saiu o jargão de dev ("Deep link", "Edge Function", "Pendência técnica") e o token na tela. A página diz, em linguagem de quem recebeu o link, que a etapa ainda não está disponível |
| Pacote de alta | `/alta/:token` | Topo escuro com as colunas da escala e o título em serifa; saiu o ícone em ladrilho da caixa do código. Os documentos (`DocumentosAlta`) não mudaram |

## Peças

`src/components/entrada/LadoMarca.tsx` passa a ter as peças comuns:

- `FolhaMarca` e `LinhaMarca`: a coluna escura (fundo `veu`, colunas de 2 h da
  escala, título em Newsreader, linhas com fio). Saíram as barras giradas, a
  bolha, a palavra do título em outra cor e os ícones em quadrado colorido.
- `TituloEntrada`: Newsreader, a mesma voz dos títulos da landing.
- `PaginaEntrada` e `LinhaEntrada`: a página de entrada sem coluna.
- O quadrado da marca agora é o teal da marca (`bg-marca`) em todas as telas.

Estilos em `src/components/entrada/entrada.css`, só com tokens `--cc-*`. No tema
escuro o título do formulário fica na tinta, como na landing. O movimento da
entrada (a onda da landing recolhe para a coluna, a coluna engole o formulário)
ficou igual.

## Evidência

- `antes-*.jpg`: login e primeiro acesso em produção antes desta parte.
- `depois-*.jpg`: Entrar, Primeiro acesso, Link de receita e Pacote de alta, a
  1280 e 390 px, claro e escuro. Sem rolagem lateral em nenhuma.
- Detector do `impeccable` nas páginas locais de Entrar, Primeiro acesso e Link
  de receita: nenhum achado.
- Catraca do padrão: nada piorou. Typecheck, lint dos arquivos e build verdes.
- **Não fotografadas aqui:** Aguardando liberação e Escolher a unidade pedem
  sessão; usam a mesma `PaginaEntrada` do Link de receita. Conferir na
  homologação.
