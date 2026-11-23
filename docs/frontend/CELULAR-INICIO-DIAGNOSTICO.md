# Tela inicial do celular para o médico: diagnóstico

Data: 23/11/2026. Item 6 do BACKLOG ("Pedidos do RT em 17/11/2026"), P1, depois da dose em mL (decisão do RT). Situação: decisões CM1 a CM8 = A (RT, 23/11/2026); visual escolhido: mescla das opções A e B do protótipo (seção 5); lote 1 em homologação.

Referência: os prints de um app do mercado mandados pelo RT em 23/11/2026, com as notas de disposição e espaçamento guardadas fora do repositório. Copiamos só a organização, a disposição e o espaçamento, nunca a marca nem as cores. As opções de desenho também saem de telas reais do Refero (Notion, Givingli, Pinterest, Ada), como manda a revisão visual.

## 1. Como está hoje no celular (largura abaixo de 1024 px)

- **Entrada.** O médico abre a Central (`/plantonista`) e cai no **Guia rápido** (`PlantonistaHome.tsx:141`, `GuiaRapido.tsx`). A tela mostra o título, a chave Criança/Adulto (criança primeiro), peso e idade ou a cor da fita, uma faixa "Calculadoras e escores" e uma grade de cartões por situação: 16 no adulto e 12 na criança, com ícone e nome, sem subtítulo, contagem ou marcador.
- **Lista completa.** As 233 ferramentas só aparecem pela faixa "Calculadoras e escores" (`?todas=1`). Lá estão a busca (Fuse, siglas e "Perguntar à IA"), os favoritos, os "mais usados" e as seções clínicas em lista.
- **Navegação.** Não há barra embaixo. O médico tem 4 abas **no topo** (`navegacao.ts:413`): Guia rápido, Leitos, Prontuários e Agenda. Não há busca no topo nem botão flutuante de busca.
- **Já existe e pode ser reaproveitado:**
  - o cronômetro da parada (criança e adulto), aberto pelo cartão "Parada e reanimação";
  - sepse, CAD e intoxicações (adulto e criança);
  - o cartão do turno e o próximo plantão;
  - favoritos e "mais usados" gravados por médico no banco;
  - a peça `Canal` (ícone, nome, exemplos, contagem e seta), que é quase a linha de categoria da referência;
  - os tons de cada seção, prontos para o quadrado do ícone.
- **Não existe:** conversor de gotas/min e de corticoide, checklists, fluxogramas como categoria, busca de CID fora do atendimento, módulo de eletro, anotações pessoais, passômetro do médico, "dividir descanso" e soluções personalizadas.

## 2. Diferenças em relação à referência

| Referência | Hoje |
|---|---|
| Saudação e chave Adulto/Pediatria no alto | Título e chave Criança/Adulto; peso antes de tudo |
| Busca no topo e botão flutuante | Busca só na lista completa |
| Central de Urgências (PCR, Sepse, CAD) e faixa "Modo PCR — Iniciar" | O cronômetro existe, mas só abre por um cartão |
| Abas "Conteúdo" e "Meu plantão" | Não há; o turno aparece só na lista completa |
| Categorias por tipo de conteúdo, em lista ou grade, abrindo no lugar | Cartões por situação (guia) e seções clínicas (lista completa), que abrem outra página |
| Marcador (favorito) em cada cartão | Favorito só na lista completa |
| Barra embaixo com 5 itens e o do meio em destaque | 4 abas no topo |

## 3. Decisões para o RT (A recomendada)

- **CM1. Barra de navegação.** A: barra embaixo com 5 itens: Início, Leitos, **Perguntar à IA** (no meio, em destaque), Prontuários e Menu (Agenda e o resto entram no Menu). B: a mesma barra, com Agenda no lugar de Prontuários. C: manter as 4 abas no topo.
- **CM2. Topo da tela.** A: saudação e chave **Adulto/Pediatria** (adulto primeiro, como na referência). O peso e a idade saem do início e são pedidos dentro da ferramenta que precisa deles, como já é na lista completa. B: manter o peso no início.
- **CM3. Central de Urgências.** A: pílulas PCR, Sepse e CAD e uma faixa "Modo PCR — Iniciar" na cor crítica do app, que abre o cronômetro da parada do lado escolhido (adulto ou criança). B: sem a faixa; só as pílulas.
- **CM4. Abas "Conteúdo" e "Meu plantão".** A: "Meu plantão" mostra o que já existe: o cartão do turno, o próximo plantão, os favoritos e os mais usados. Anotações, passômetro, dividir descanso e soluções personalizadas viram pedidos novos no BACKLOG, sem código agora. B: só a aba "Conteúdo".
- **CM5. Categorias.** A: por tipo de conteúdo, só com o que existe hoje:
  - Urgências, com os grupos de condutas;
  - Diluições e doses (infusões, diluição, doses por peso, ampolas);
  - Calculadoras;
  - Escores;
  - Intoxicação;
  - CID, com a busca de terminologia.

  A chave Adulto/Pediatria filtra o conteúdo. Conversores, checklists, fluxogramas e eletro não aparecem até existirem. B: manter as seções clínicas de hoje (Condutas adulto, Pediatria, Escores, Protocolos, Farmácia), só com o visual novo.
- **CM6. Lista ou grade.** A: chave Lista/Grade. A categoria abre no lugar, numa grade de 2 colunas de cartões com marcador (favorito). B: só lista, abrindo outra página.
- **CM7. Busca.** A: campo de busca no topo do início e botão flutuante redondo nas outras telas, com a busca atual (siglas, semântica e "Perguntar à IA"). B: só o campo no topo.
- **CM8. Como decidir o visual.** A: antes do código, um protótipo navegável com 2 ou 3 opções tiradas das telas do Refero e da disposição dos prints, só com os tokens do app. Você escolhe uma, e depois o trabalho segue em lotes pequenos na homologação. B: ir direto para a homologação com uma opção só.

## 4. Riscos

- Tirar o peso do início (CM2) muda o fluxo do guia de parada da criança, que hoje usa a cor da fita. O guia de parada continua pedindo peso ou cor dentro dele.
- Barra embaixo (CM1) muda a navegação de todos os médicos: a troca é anunciada na tela por uma semana.
- Categorias novas (CM5) exigem mapear as 233 ferramentas. Cada ferramenta continua com a ficha dela; nenhuma dose muda.

## 5. Visual escolhido e lotes

O protótipo teve três opções (A no molde dos prints, B com cartões grandes, C com seções recolhíveis). O RT pediu, em 23/11/2026, "uma mescla de a e b" e que não fosse cópia do app de referência; o grupo abre **na própria tela** (resposta do RT). Ficou assim:

- cartões grandes e coloridos da opção B, em duas colunas, um por tipo de conteúdo;
- o toque abre, logo abaixo da linha do cartão, a grade de duas colunas da opção A, com sigla, marcador e "Ver todas, com busca";
- visual próprio: saudação sem foto, chave Adulto/Criança na largura toda e um bloco inteiro "Iniciar PCR" acima dos cartões, sem a faixa e as pílulas da referência. Sepse e CAD saíram do topo e ficam em Urgências e Calculadoras (RT, 23/11/2026, conferindo o lote 1 na homologação).

Lotes, todos pela homologação:

1. **Início novo** (`InicioCelular.tsx`, `src/content/inicioCelular.ts`): saudação, chave Adulto/Criança, busca (abre a Central completa com o texto), Central de Urgências e as categorias. "Urgências" reaproveita os cartões do Guia rápido; as outras listam as ferramentas mais usadas de cada tipo. CID fica de fora até existir a busca fora do atendimento (CM5).
2. **Abas "Conteúdo" e "Meu plantão"** (CM4; no PR do lote 1, a pedido do RT em 23/11/2026; a aba fica no endereço, `?aba=plantao`): turno, próximo plantão, favoritos e mais usados. O marcador de cada item já grava o favorito desde o lote 1 (pedido do RT na conferência, 23/11/2026), com a mesma chave da Central completa.
3. **Barra embaixo com 5 itens e botão flutuante de busca** (CM1 e CM7; RT aprovou o lote 2 e pediu o 3 em 23/11/2026): Início, Leitos, Perguntar à IA (abre a busca da Central com o campo em foco), Prontuários e Menu (Agenda e as outras telas). Numa UBS ficam Prontuários, Agenda e Menu. A busca flutuante aparece fora do início, acima das Mensagens. O aviso da troca fica uma semana no aparelho ou até "Entendi". As abas do topo saem, e os guias voltam por "← Início".
