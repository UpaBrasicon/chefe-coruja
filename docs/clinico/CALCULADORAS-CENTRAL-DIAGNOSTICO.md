# Calculadoras da Central do Médico — diagnóstico

**Pedido do RT, 16/11/2026:** "preciso melhorar a funcionalidade das calculadoras
da Central do Médico". No mesmo dia o RT mandou o modelo que quer seguir: a
página do HEART no MDCalc
(`https://www.mdcalc.com/calc/1752/heart-score-major-cardiac-events`), e pediu o
modelo em **Condutas e cálculos — adulto, Pediatria e Escores**. Nas palavras
do RT, o que ele quer do modelo:

- subtítulo com um resumo do texto (ex.: "Prevê o risco de eventos cardíacos
  adversos graves em 6 semanas em pacientes com dor no peito");
- instruções resumidas;
- subabas "Quando usar", "Armadilhas" e "Por que usar";
- resumo do cálculo flutuante, que acompanha a tela ao rolar e ao subir;
- copiar o resultado;
- próximos passos (o que fazer com o dado);
- evidências e comentários;
- calculadoras relacionadas;
- "tudo muito claro, simplificado e sem muitos dados em tela poluindo e
  dificultando".

**Este documento é só diagnóstico.** Nenhum código mudou, nenhuma migration,
nada na homologação. O modelo é de organização da tela: não se copia marca,
cores, textos nem conteúdo clínico do MDCalc. Os textos clínicos novos (resumo,
instruções, quando usar, armadilhas, próximos passos) saem das fontes que cada
ficha já cita, com página, e passam pela aprovação do RT como nova versão da
ficha.

Base: `origin/master` em `81f5bff9` (16/11/2026). As linhas citadas são desse
commit. A homologação pediu login da Vercel e não havia sessão aberta; o
levantamento foi feito pelo código; depois o RT abriu a sessão no Chrome dele e duas telas foram conferidas (seção 3, "Conferido na homologação"). A página do MDCalc foi aberta no navegador
em 16/11/2026 (cookies não essenciais recusados).

## Decisões do RT (16/11/2026)

**C1 a C8 = A** ("Todas A", repassado pela sessão principal em 16/11/2026). O piloto
do C7 usa a lista de 10 ferramentas abaixo, aprovada pelo RT em 16/11/2026,
quando ele também confirmou C1–C8 = A diretamente. Depois do piloto, as demais
ferramentas seguem em lotes por seção, cada um com homologação e "ok produção".

### Piloto do C7 (lista aprovada pelo RT em 16/11/2026)

Critério: o HEART que o RT citou, ferramentas de uso frequente no PS e pelo
menos uma de cada montagem que se repete (seção 1), para a biblioteca nova
(F6) ser testada em todas antes dos outros lotes. A contagem de uso da produção
não foi lida (precisa do ok do RT); o RT pode trocar qualquer item.

| # | Ferramenta | Seção | Montagem | Por que no piloto |
|---|---|---|---|---|
| 1 | HEART | Escores | `EscoreTela` | O modelo que o RT mandou |
| 2 | CURB-65 | Escores | `EscoreTela` | Pneumonia, frequente; próximos passos claros por faixa |
| 3 | Sepse no adulto (qSOFA, SOFA, lactato) | Escores | `EscoreTela` | Mais de um resultado na mesma tela: testa o resumo flutuante |
| 4 | Escala de Coma de Glasgow (GCS-P) | Escores | `EscoreTela` | A mais comum no plantão; escore sem conduta própria |
| 5 | Intubação orotraqueal (sequência rápida) | Calculadoras (no adulto) | campo próprio + tabela | Lista de doses por peso e a tabela longa da DAS 2025: testa C3, C5 e C6 |
| 6 | Infusões contínuas — adulto | Calculadoras (no adulto) | campo próprio | Conta de mL/h muito usada; única que recebe dado pelo endereço |
| 7 | Hipocalemia — potássio | Condutas — adulto | `LoteAPecas` (40 telas) | Várias contas em blocos na mesma tela |
| 8 | PCR — drogas e desfibrilação | Condutas — adulto | `PecasLoteC` (62 telas, o maior kit) | Emergência, lista de doses com a AHA ao lado |
| 9 | Doses pediátricas por peso | Pediatria | peças próprias | Peso e idade da Central; lista longa com errata e divergências: testa C5 e C6 |
| 10 | Diarreia aguda — desidratação e planos | Pediatria | `PecasIcr` (36 telas) | Muito frequente; o maior kit da pediatria |

Ficam para os lotes seguintes os kits `PecasP2`, `PecasP4`, `PecasP5`,
`PecasLoteE6` e `PecasLoteE7`. Se o RT preferir a crise asmática da criança
(`PecasP2`) no lugar do Glasgow, a troca não muda o resto do piloto.

## 1. Como as calculadoras funcionam hoje

### Onde ficam

| Parte | Arquivo | O que faz |
|---|---|---|
| Registro | `src/content/registry.tsx` | 232 ferramentas em 8 seções: Condutas e cálculos — adulto (105), Pediatria (58), Escores (50), Calculadoras (9), Protocolos (4), Ventilação mecânica (3), Farmácia (2), Dengue (1). Cada uma carregada sob demanda (`registry.tsx:21`). **O pedido cobre 213 delas** (105 + 58 + 50) |
| Página inicial | `src/pages/plantonista/PlantonistaHome.tsx` | Busca local (Fuse.js) e "Perguntar à IA", cartão do turno, favoritos e mais usadas (no banco, `src/lib/useFavoritos.ts:57`), escolha "Adulto ou pediátrico?" |
| Seção | `src/pages/plantonista/SectionHome.tsx` | Índice em linhas, filtro nas seções grandes, aviso "Sem referência pediátrica" / "Só pediátrica" conforme o modo (`SectionHome.tsx:41-47`) |
| Ferramenta | `src/pages/plantonista/ToolRouter.tsx` | Lateral da seção, trilha, favoritar, faixa do modo do paciente e a ferramenta. No modo errado a ferramenta some (`ToolRouter.tsx:51-58`) |
| Casca | `src/components/plantonista/ToolLayout.tsx` | Título e descrição, situação da ficha (aprovada, aguardando, reprovada), nota da unidade, índice "Nesta página", ressalva "Apoio à decisão clínica" (`ToolLayout.tsx:75`) e o bloco Fonte com revisão e versão da regra. Usada por 129 telas; 127 passam a `ficha` |
| Conta | `src/clinico/` | Funções puras por área (adulto 127 arquivos, pediatria 112, escores 88), com 171 arquivos de teste. A tela só chama a função |
| Escores | `src/components/plantonista/EscoreTela.tsx` | Tela única dos escores do pacote `src/clinico` (17 arquivos a usam) |
| Ficha | `src/clinico/ficha.ts:14-22` | `id`, `titulo`, `versao`, `publico`, `fontes`, `revisadoEm`. **Não há campo** para resumo, instruções, quando usar, armadilhas, por que usar nem próximos passos |
| Resultado do escore | `src/clinico/escore.ts:18-28` | `rotulo`, `valor`, `nota`, `estado` (só cor), `derivados`, `alerta`, `cuidados`. O mais perto de "próximos passos" hoje é `cuidados` |

### O paciente da Central

A Central pergunta "Adulto ou pediátrico?" e depois idade, peso e gestante
(`src/components/plantonista/central/ModoPaciente.tsx:136-143`). Esse paciente
vive só na memória da aba, sem nome, e some ao recarregar ou trocar
(`src/lib/pacienteCentral.ts:6-10`, `:25-28`), para que o peso de um paciente
nunca reapareça como dose de outro.

### Padrão de entrada

- Campo numérico comum: `src/components/plantonista/NumberField.tsx`, em 100
  telas. Unidade entre parênteses ao lado do nome; com faixa normal, escreve
  "⚠ fora do intervalo" (`NumberField.tsx:62`).
- Os escores têm o próprio campo em `EscoreTela.tsx:66-82`.
- Escolhas: `Chip` em 13 telas, caixas de marcar soltas em 20.

### Padrão de resultado

Não há um. Cada lote de ferramentas trouxe o seu kit de peças:

| Kit | Telas que usam | Peças |
|---|---|---|
| `manual/PecasLoteC.tsx` | 62 | `Bloco` (`:24`), `LinhaManual` (`:37`) |
| `manual/LoteAPecas.tsx` | 40 | `Bloco` (`:40`), `Resultado` (`:52`), `Alertas` |
| `pediatria/PecasIcr.tsx` | 36 | `Bloco` (`:55`), `LinhaLivro` (`:68`) |
| `pediatria/PecasP4.tsx` | 24 | `LinhaDoseLivro` (`:22`), `LinhaBolusApendice` (`:60`) |
| `pediatria/PecasP2.tsx` | 15 | `LinhaDose` (`:48`), `Bloco` (`:75`), `LinhaReferencia` (`:87`) |
| `pediatria/PecasP5.tsx` | 12 | `LinhaFaixa` (`:49`) |
| `manual/PecasLoteE7.tsx` | 9 | — |
| `manual/PecasLoteE6.tsx` | 8 | — |

Quatro `Bloco` diferentes e cinco jeitos de mostrar uma linha de dose. A fonte
com página aparece por item ("PS Pediatria ICr-HCFMUSP, p. …" em
`pediatria/BolusPediatrico.tsx:50`) e também no rodapé da casca
(`ToolLayout.tsx:77-83`).

## 2. O modelo do RT contra o que existe

| Elemento do modelo | Hoje no app | Falta |
|---|---|---|
| Subtítulo com resumo de uma frase | Há descrição, mas ela fala do conteúdo e da fonte, não do uso: "Tabela 2 do manual do HC com as doses por peso calculadas, a carga do choque e a AHA 2025 ao lado" (`manual/PcrAdulto.tsx:30`); "Apêndice do PS Pediatria ICr-HCFMUSP (4ª ed., 2023), com página" (`pediatria/BolusPediatrico.tsx:75`) | Uma frase de "para que serve", em linguagem de plantão |
| Instruções resumidas (em quem usar, em quem não usar) | Espalhadas em notas soltas dentro de cada tela | Campo próprio na ficha e caixa fixa logo abaixo do subtítulo |
| Abas "Quando usar", "Armadilhas", "Por que usar" | Não existem | Três textos curtos por ferramenta, com fonte e página |
| Resumo flutuante que acompanha a rolagem | Nenhuma tela usa `sticky`; o resultado fica abaixo dos campos e, no celular, fora da tela | Faixa de resultado fixa |
| Copiar o resultado | Nenhuma ferramenta copia. A peça existe (`src/components/plantonista/CopyResult.tsx`) e não é usada em lugar nenhum | Texto padrão de cópia por ferramenta |
| Próximos passos | Só os escores têm algo perto (`cuidados` e `alerta` em `escore.ts:26-27`); nas condutas a tela inteira já é a conduta | Bloco "Próximos passos" por faixa de resultado, com fonte |
| Evidências | Bloco Fonte no rodapé, só a citação (`ToolLayout.tsx:77-83`) | Aba "Evidências": estudo de origem, população, validação, com a citação; a revisão PubMed já feita (H7 e outras) entra aqui |
| Comentários do autor | Não se aplica; o equivalente é a "Nota da unidade" (`ToolLayout.tsx:152-160`) | Mostrar a nota da unidade na mesma aba das evidências |
| Calculadoras relacionadas | A lateral mostra a seção inteira (`src/components/plantonista/LateralSecao.tsx`), sem dizer quais se ligam a esta | Lista curta (3 a 5) por ferramenta |
| Tela limpa, sem poluição | Muitas telas despejam tudo: a intubação traz a tabela inteira da DAS 2025 abaixo das doses (`calculadoras/IsrAdulto.tsx:53-67`); "Divergência", "errata" e "No livro" aparecem em cada item, 126 vezes nas telas (ex.: `BolusPediatrico.tsx:47-49`) | Mostrar primeiro só entrada e resultado; o resto em abas ou "ver mais" |

## 3. Outros problemas de uso encontrados

| # | Achado | Onde | Efeito para o médico |
|---|---|---|---|
| P1 | O peso e a idade digitados na Central não chegam às ferramentas. Só uma lê o paciente da Central (`protocolos/Hiperpotassemia.tsx:119-129`); 69 telas têm o próprio campo de peso. A faixa do modo diz "Confira o peso no campo da ferramenta" (`central/ModoNaFerramenta.tsx:59`) | `src/pages/plantonista/**` | Digita o peso de novo em cada ferramenta; em criança, peso e idade de novo (`BolusPediatrico.tsx:80-82`) |
| P2 | Os escores perguntam "Adulto / Criança" de novo e começam em "adulto" mesmo com a Central em pediátrico (`EscoreTela.tsx:35`, `:43-48`) | `EscoreTela.tsx` | Pergunta repetida; quem não percebe calcula como adulto |
| P3 | Campo numérico começa com **0** visível, e apagar o campo volta a mostrar 0 (`NumberField.tsx:48-55`). 110 telas começam o estado em `useState(0)` | `NumberField.tsx` | Precisa apagar o zero antes de digitar |
| P4 | Vírgula: o escore troca vírgula por ponto (`EscoreTela.tsx:76`); o `NumberField` não (`type="number"`, `:43`). Só 4 telas tratam vírgula | `NumberField.tsx` | "7,5" pode não entrar, conforme o navegador. **A conferir no celular** |
| P5 | Limite de valor plausível é por ferramenta: doses pediátricas validam peso de 0 a 150 kg (`BolusPediatrico.tsx:61`), a intubação não valida nada (`IsrAdulto.tsx:14-23`). O aviso "fora do intervalo" não impede a conta | várias | Erro de digitação (75 → 750 kg) gera dose sem aviso em parte das telas |
| P6 | Só a tela de escores avisa o leitor de tela quando o resultado muda (`EscoreTela.tsx:118`, `aria-live`) | telas | Acessibilidade |
| P7 | 58 telas têm tabela com largura mínima fixa (`min-w-[640px]` e parecidas, ex.: `IsrAdulto.tsx:60`) | telas | Rolagem lateral no celular |
| P8 | Nenhuma ligação entre o paciente aberto (porta, leito) e a Central. Só a de infusões lê parâmetro do endereço (`calculadoras/InfusoesAdulto.tsx:250`) | — | Abrir a calculadora a partir do paciente exige sair da tela dele |
| P9 | Peças de resultado duplicadas (tabela da seção 1) | 8 kits | Cada melhoria precisa ser feita oito vezes; a aparência muda entre ferramentas |

### Conferido na homologação (16/11/2026)

Com a sessão de médico aberta pelo RT no Chrome dele (UPA Fase 5 24h), sem gravar nada:

| # | O que se viu | Causa no código |
|---|---|---|
| H1 | **HEART: cada pergunta ocupa 329 px de altura, 260 deles vazios** entre o nome do item e as opções. Com 6 itens, o resultado começa a 1 986 px do topo, numa janela de 897 px: mais de duas telas abaixo | `EscoreTela.tsx:22-23`: quando as opções não cabem na linha, a linha vira coluna (`flex-col`) e o rótulo mantém `flex-[1_1_260px]`, que em coluna vira 260 px de altura. Vale para todo escore com opção longa |
| H2 | HEART pergunta "Adulto / Criança" de novo e mostra a tabela inteira da SBC 2025 (10 linhas) na tela principal, abaixo do resultado | P2 e F5 |
| H3 | HEART: as opções não mostram quantos pontos valem (o modelo mostra 0, +1, +2) | `EscoreTela.tsx:86-93` |
| H4 | Intubação: o campo de peso abre com "0" e, apagado, volta a "0" | P3 |
| H5 | **Intubação: com 750 kg, a tela calcula "1.125 mg · 112,5 mL · 6 ampolas" na primeira droga, sem nenhum aviso** | P5: `IsrAdulto.tsx:14-23` não valida o peso |
| H6 | Nenhum botão de copiar nas duas telas | P6 |

**H1 e H5 corrigidos em 16/11/2026** (PR #790, na homologação e na produção com o ok do RT, conferidos pelo RT): o rótulo do escore só usa a base de 260 px com as opções na mesma linha; a intubação não calcula dose por peso fora de 30 a 250 kg, regra da unidade decidida pelo RT (`src/domain/pesoAdulto.ts`). A trava de peso entra nas outras ferramentas de adulto com o piloto (F7). Texto original: H1 e H5 são defeitos de produção (o mesmo código está no master). Entram no
piloto (F2 e F7); se o RT quiser, podem ser corrigidos antes, em branch própria,
como correção pequena.

O que já funciona e fica: a conta separada da tela em `src/clinico`, com
testes; a ficha com fonte, versão e aprovação do RT; o bloqueio da ferramenta de
adulto no modo pediátrico; o paciente da Central sem nome e só na memória;
favoritos e mais usadas no banco.

## 4. Referências visuais

O modelo principal é o do RT (MDCalc, HEART). Telas do Refero consultadas em
16/11/2026 para as variações de onde pôr o resultado:

| Ref. | Tela | O que mostra |
|---|---|---|
| M | MDCalc, HEART (web), página indicada pelo RT | Título, subtítulo de uma frase, caixa "Instruções", três abas recolhidas, perguntas em linhas com a pontuação de cada opção, faixa de resultado fixa no rodapé com "Copiar resultado" e "Próximos passos", e abaixo "Próximos passos / Evidências / Comentários"; relacionadas na coluna da direita |
| R1 | Wealthsimple, calculadora de imposto (web) — `refero.design/pages/8a2c763a-aed2-44fa-813c-039af134625b` | Campos à esquerda e "Your Results" num cartão à direita, atualizado enquanto digita |
| R2 | Zendesk, calculadora de ROI (web) — `refero.design/pages/29ece5fd-5151-408a-993b-827dbeff0f19` | Campos e resultado lado a lado no mesmo cartão, número principal destacado |
| R3 | GrowPal, calculadora de TMB (iOS) — `refero.design/screens/c58a006e-f369-48dc-88df-4aaf41ca4eec` | Resultado grande no topo, dados de entrada em linhas logo abaixo |
| R4 | Klarna, calculadora de parcelas (iOS) — `refero.design/screens/0ed61e8e-3bd3-47f5-811f-2db18f002a11` | Um campo no topo e o cartão de resultado logo abaixo, sem rolar |

## 5. Frentes de melhoria

| Frente | O que entrega | Base | Tamanho |
|---|---|---|---|
| F1. Cabeçalho da ferramenta | Subtítulo de uma frase, caixa de instruções e as abas "Quando usar", "Armadilhas", "Por que usar" | Modelo do RT | Grande no texto (213 ferramentas × 5 textos curtos, com fonte), pequeno no código |
| F2. Resultado flutuante com "Copiar" | Faixa fixa que acompanha a rolagem, com o resultado, "Copiar" e um atalho para "Próximos passos" | Modelo do RT; R1/R2 | Médio, na casca e nas peças |
| F3. Próximos passos e evidências | Abaixo do resultado: "Próximos passos" (o que fazer com o resultado, por faixa), "Evidências" (estudo, população, validação, citação) e a nota da unidade | Modelo do RT | Grande no texto; os próximos passos são conteúdo clínico novo |
| F4. Relacionadas | 3 a 5 ferramentas ligadas a esta, no fim da tela (na lateral no computador) | Modelo do RT | Pequeno |
| F5. Tela limpa | Primeiro só entrada e resultado; divergências, errata, notas do livro e tabelas de comparação (ex.: DAS 2025) vão para as abas ou "ver mais" | Modelo do RT, P9 | Médio |
| F6. Uma biblioteca de peças | Um kit só no lugar dos 8; é o que permite F1–F5 em 213 telas sem refazer oito vezes | P9 | Grande, por lotes |
| F7. Peso da Central e campos confiáveis | Peso e idade da Central já no campo; campo começa vazio, aceita vírgula, barra valor impossível; escores seguem o modo da Central | P1–P5 | Médio |
| F8. Celular e leitor de tela | Tabelas sem rolagem lateral; resultado anunciado ao leitor de tela | P6, P7 | Médio |

Fica fora: abrir a calculadora a partir do paciente aberto (P8), que muda a
regra de segurança da Central (ver C8).

## 6. Decisões para o RT

**C1. Quem escreve os textos novos (F1 e F3).** Resumo, instruções, quando
usar, armadilhas, por que usar e próximos passos são conteúdo clínico.
- **A (recomendada):** escritos a partir das fontes que a ficha de cada
  ferramenta já cita, com a página ao lado de cada frase; o que a fonte não
  diz fica em branco (a aba não aparece). Cada lote vira nova versão das fichas
  e passa pela aprovação do RT na Revisão Clínica, como as revisões do HCFMUSP.
  Nenhuma dose muda.
- **B:** só o subtítulo e as instruções agora (tirados das próprias telas, sem
  fonte nova); as abas e os próximos passos ficam para depois.

**C2. Onde fica o resumo flutuante (F2).**
- **A (recomendada), como o modelo:** faixa fixa no rodapé da área da
  ferramenta, em qualquer largura de tela, com o resultado, a faixa de risco,
  "Copiar" e "Próximos passos" (que rola até o bloco).
- **B, como R1 e R2:** no computador, painel à direita que acompanha a rolagem;
  no celular, a faixa no rodapé. Usa melhor a tela larga, mas tira o espaço da
  lateral da seção e das relacionadas.

**C3. O que a faixa flutuante mostra nas condutas com lista de doses (F2).**
Nos escores o resumo é um número. Nas condutas do adulto e da pediatria (ex.:
intubação, doses pediátricas, PCR) o resultado é uma lista.
- **A (recomendada):** a faixa mostra os dados usados (ex.: "Adulto · 70 kg")
  e "Copiar", que leva a lista inteira; a lista fica na página.
- **B:** a faixa mostra a primeira dose da lista (ex.: a de indução), e
  "Copiar" leva a lista inteira.

**C4. O que o "Copiar" leva.**
- **A (recomendada):** texto pronto para a evolução: nome da ferramenta, dados
  usados com unidade, resultado, fonte com página, versão da regra e "apoio à
  decisão; conferido pelo médico". Sem nome do paciente (a Central não tem).
- **B:** só a linha do resultado (ex.: "CURB-65: 3 pontos — alto risco").

**C5. Peso e idade da Central nas ferramentas (F7).**
- **A (recomendada):** a ferramenta abre com o peso e a idade da Central já no
  campo, com o selo "da Central"; o campo continua editável e, se mudar, o selo
  some. Trocar o paciente zera tudo, como hoje. Os escores seguem o modo da
  Central e deixam de perguntar "Adulto / Criança". O campo começa vazio, aceita
  vírgula e tem limite plausível por grandeza.
- **B:** o campo abre vazio, com um botão "Usar 18 kg da Central"; um toque
  preenche. Um toque a mais por ferramenta.

**C6. O que sai da tela principal (F5).**
- **A (recomendada):** divergências entre fontes, errata, "No livro", tabelas
  de comparação e notas longas vão para a aba "Evidências" (ou um "ver mais" no
  item). Alertas que mudam a dose (máximo atingido, condição de idade, aviso de
  segurança) continuam no item, à vista.
- **B:** tudo continua na tela, só recolhido em "ver mais" dentro de cada item.

**C7. Ordem e piloto.**
- **A (recomendada):** primeiro a biblioteca de peças (F6) já com F2, F4, F5,
  F7 e F8; piloto em 10 ferramentas que o RT escolher (por exemplo 4 escores,
  3 condutas do adulto e 3 da pediatria); o RT confere na homologação; depois
  os demais lotes, por seção. Os textos de F1 e F3 seguem em paralelo, em lotes
  de fichas para a Revisão Clínica.
- **B:** começar pelos 50 escores, que já têm tela única (`EscoreTela`): uma
  troca vale para todos; condutas e pediatria depois.

**C8. Abrir a calculadora a partir do paciente.**
- **A (recomendada):** fica fora desta trilha e vai ao backlog como pedido
  separado, com diagnóstico próprio, porque muda a regra atual da Central
  (paciente sem nome, só na memória da aba).
- **B:** entra agora: um botão "Calculadoras" no leito e na porta abre a Central
  com peso, idade e modo do paciente aberto.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Texto novo (resumo, armadilhas, próximos passos) sem respaldo na fonte | Cada frase com fonte e página; sem fonte, a aba não aparece; aprovação do RT por nova versão da ficha (C1 A) |
| "Próximos passos" lido como ordem médica | Texto em forma de referência ("No estudo, …"; "A fonte indica …"), com a ressalva "Apoio à decisão" que já existe |
| Peso da Central errado propagado para várias ferramentas | Selo "da Central" sempre visível; campo editável; trocar paciente zera; limite plausível |
| Faixa fixa cobrindo conteúdo em tela pequena | Altura de uma ou duas linhas; espaço reservado no fim da página; conferir em 360 px |
| Alerta de dose escondido ao limpar a tela | Regra de C6 A: o que muda a dose fica no item; teste de componente para os alertas do piloto |
| Cópia falhar (permissão do navegador) | Mensagem "não foi possível copiar" e o texto selecionável |
| Regressão em 213 ferramentas | Lotes pequenos; as contas em `src/clinico` não mudam e seus testes seguem verdes; conferência do RT por lote |
| Parecer cópia do MDCalc | Só a organização da tela; marca, cores, textos e conteúdo são do app e das nossas fontes |

## 8. Critérios de aceite (quando o RT decidir)

- **F1:** nas ferramentas do lote, subtítulo de uma frase e instruções aparecem
  sob o título; as abas mostram só o que tem fonte, com página. Fichas do lote
  em nova versão, aprovadas pelo RT.
- **F2:** em 360 px e em 1280 px de largura, o resumo fica visível ao rolar
  para baixo e para cima. Captura das duas larguras.
- **F3:** "Próximos passos" muda conforme a faixa do resultado; "Evidências"
  traz a citação e a nota da unidade.
- **F4:** cada ferramenta do lote mostra de 3 a 5 relacionadas que existem no
  registro (teste que barra link quebrado).
- **C4:** "Copiar" leva o texto decidido, com fonte, página e versão. Teste de
  unidade do texto de cada ferramenta do piloto.
- **F5:** o primeiro bloco da tela tem só entrada e resultado; os alertas que
  mudam a dose continuam no item.
- **F6:** as ferramentas do lote usam só a biblioteca nova; a catraca do padrão
  do frontend barra o kit antigo nas telas migradas.
- **F7:** com a Central em pediátrico, 18 kg e 4 anos, as ferramentas do piloto
  abrem com esses dados e o selo; campo vazio ao abrir; "7,5" entra como 7,5;
  750 kg não calcula e diz por quê.
- **F8:** nenhuma rolagem lateral em 360 px nas telas do lote; o resultado tem
  `aria-live`.
- **Todas:** testes de `src/clinico` verdes, sem mudança de conta; CI com os 4
  checks verdes; conferência do RT na homologação antes do "ok produção".

## 9. Banco

F2, F4, F5, F6, F7 e F8 são só tela. F1 e F3 pedem campos novos na ficha
(`src/clinico/ficha.ts`) e, para a Revisão Clínica mostrar o texto novo, nova
versão das fichas pelas migrations de fichas já usadas nos lotes do HCFMUSP.
Nenhuma tabela nova está prevista; se a implementação mostrar o contrário, vira
pergunta ao RT antes.
