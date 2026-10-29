# Aba Escala, entrega E4 — opções visuais

28/10/2026. A E4 é a última da trilha. Ela dá aos papéis da E3 (enfermeiro, técnico, recepção,
regulador, farmacêutico, faturamento, NIR, telemedicina e papéis de rede) os pedidos de escala que hoje só
o plantonista tem: **troca, passagem e justificativa de falta**, e as **vagas com candidatura**.

Já decidido pelo RT:
- troca, passagem e falta valem para todos, só dentro da mesma categoria (resposta 4); a trava está no
  banco desde a E1;
- vagas e candidatura valem para todas as categorias, menos gestor e administrador (resposta 5); a vaga
  tem categoria desde a E1/E2.

**Nada aplicado.** As maquetes são a tela da E3 (opção A, já em produção) com os pedidos e as vagas, vista
por uma enfermeira, com dados fictícios (página de teste, fora do repositório).

## Referências do Refero

| Tela | O que se aproveita |
|---|---|
| Aboard, registrar ausência (`9797b9e9`) | Janela do pedido com o formulário à esquerda e "o que acontece" à direita |
| Aboard, calendário de ausências (`3255dd44`) | Mês com o pedido pendente marcado (ampulheta) e a coluna de pendentes ao lado |
| Aboard, avisos (`71ccf324`) | Pedido respondido com o estado em selo (aprovado, recusado) |
| Skiff, menu do evento (`d767aebe`) | Ações abertas no próprio item da agenda |

## Opções (`maquetes/e4-A|B|C-claro|escuro.jpg` e `-claro-celular.jpg`)

Em todas: a vaga da minha categoria aparece em âmbar no mês ("vaga · Noite"); o plantão com pedido
pendente leva a ampulheta; a janela de troca mostra o meu plantão, o plantão do colega (só da minha
categoria), uma mensagem opcional e, ao lado, o que acontece se a coordenação aprovar. A passagem e a falta
usam a mesma janela, com o colega de destino ou o atestado.

- **A · ações no painel do dia** (Aboard, registrar ausência). Ao escolher um dia em que trabalho, o painel
  abre com "Seu plantão" e três botões: Trocar, Passar e Justificar falta. Abaixo, a equipe do dia e "Seus
  pedidos" com o estado de cada um. Num dia com vaga, o painel mostra a vaga com "Candidatar-me". É a mais
  perto da tela que já está no ar.
- **B · coluna de pedidos e vagas** (Aboard, calendário de ausências). O lado direito deixa de ser o dia e
  vira "Pedidos e vagas": o que espera a coordenação (com "cancelar"), as vagas da minha categoria com
  "Candidatar-me" e os pedidos já respondidos. "Novo pedido" pergunta o plantão, o tipo e o colega. Tudo à
  vista, mas a equipe do dia sai da tela.
- **C · menu no próprio plantão** (Skiff, Aboard avisos). Toque no meu plantão no mês e abre um menu com
  Trocar com colega, Passar para colega e Justificar falta. Os pedidos ficam numa segunda aba, "Meus
  pedidos", com a contagem do que está pendente; a resposta também chega nos Avisos. O painel do dia segue
  como hoje, com a vaga do mês.

## Fora do visual (igual nas três)

- **Vagas:** `candidatar_vaga` passa a aceitar quem tem o papel da vaga (vaga sem categoria continua do
  plantonista); `aprovar_candidatura` grava no plantão a categoria da vaga.
- **Colegas para passar:** uma RPC com os colegas da minha categoria na unidade (só nome), no lugar da lista
  de plantonistas.
- **Troca e passagem:** as mesmas RPCs de hoje (`solicitar_troca`, `passar_plantao`), com a trava de
  categoria da E1. **Falta:** o mesmo pedido de hoje, com anexo.
- **Coordenação:** os pedidos chegam na aba Pedidos do gestor, como os do plantonista; nada muda lá.

## Perguntas ao RT

1. **Qual opção:** A, B ou C?
2. **Sair do fixo e fracionar plantão:** o plantonista tem os dois. Entram para as outras categorias nesta
   etapa? Sugestão: não; só troca, passagem, falta e vaga, como o RT pediu.

## Decisão do RT (28/10/2026) e o que foi aplicado

**Opção A**, ações no painel do dia; **a passagem é uma janela (popup)**, pedido do RT (troca e falta
também). Sair do fixo e fracionar: sem resposta nesta rodada; vale a sugestão (ficam de fora).

- Migration `20270202000004_escala_pedidos_categorias.sql`: `colegas_da_categoria` (destino da passagem,
  só nome e categoria); `candidatar_vaga` aceita quem tem o papel da vaga (sem categoria, só plantonista);
  `aprovar_candidatura` grava a categoria da vaga no plantão e "já preenchido" passa a ser por alguém da
  mesma categoria.
- `src/components/escala/PedidosEscala.tsx`: "Seu plantão" com Trocar, Passar e Justificar falta, cada um
  numa janela; "Vaga da sua categoria" com "Candidatar-me"; "Seus pedidos" com o estado. Plantão que já
  terminou só aceita justificar falta; plantão com pedido pendente mostra o aviso no lugar dos botões.
- `src/hooks/usePedidosDaEquipe.ts`: os meus pedidos (solicitações e trocas) e as vagas da categoria.
- No mês: a vaga em âmbar e a ampulheta no plantão com pedido pendente.
- Imagens da tela real com dados fictícios: `maquetes/e4-A-aplicada-claro|escuro|celular.jpg`,
  `e4-A-aplicada-passar.jpg` e `e4-A-aplicada-trocar.jpg`.
