# Clicáveis sem destaque — levantamento

**Pedido do RT, 11/11/2026:** "tudo que for clicável coloque um destaque; às vezes
fica quase impossível saber que dá para clicar, a exemplo dos itens como alergia e
isolamento, que só descobri quando cliquei sem querer". Na captura, no cabeçalho do
paciente da porta, "Alergia não registrada" (texto âmbar com escudo) e "Isolamento"
(texto cinza com escudo) são botões, mas parecem texto de situação.

**Este documento é só levantamento.** Nenhum código mudou. Não há proposta de
visual aqui: as opções de desenho vêm do Refero, à parte. O objetivo é dar a lista
completa e os padrões que se repetem, para a correção ser feita por peça do sistema
de desenho, e não item por item.

Base: `origin/master` em `0427d735` (11/11/2026). As linhas citadas são desse commit.

## Método

1. Leitura de todos os `.tsx` de `src/` (sem os testes) pela árvore do TypeScript.
   São 1 586 `onClick`. Separei:
   - elementos com `onClick` que não são `Button`, `BotaoLinha` nem `Chip`
     (67, entre eles `TableRow`, `div`, `Link` e as peças locais que embrulham
     um botão);
   - todos os `Button` com `variant="ghost"` ou `variant="link"` (365);
   - todos os `Link`, `NavLink` e `<a>` (106);
   - todos os `BotaoLinha` (59);
   - os `<button>` soltos fora de `src/components/ui` e `src/components/monitor` (44;
     a catraca `botao-solto` está em zero, então todos estão na casca ou têm
     `padrao-ok`);
   - os `<summary>` (14) e as ações que só aparecem no hover.
2. Para cada candidato, li o trecho e a tela onde ele aparece (`src/App.tsx`,
   `src/content/registry.tsx` e quem importa o componente).
3. **Critério de "tem destaque":** borda, fundo, sublinhado, seta ou chevron, ou
   `Button` numa variante visível (`default`, `outline`, `secondary`,
   `destructive`). Cor de ação (petróleo) em texto curto conta como sinal fraco
   de link e não entrou como achado.
4. **Gravidade:**
   - **alta**: atrás do clique está uma ação clínica ou uma informação clínica
     importante (alergia, isolamento, resultado de exame, sepse, óbito);
   - **média**: ação ou informação de trabalho que a pessoa precisa achar
     (retificar, regulação, escala, alta vigilância, segundo fator);
   - **baixa**: o resto (ação secundária, atalho, administração).

### O que o sistema de desenho entrega hoje

- `Button variant="ghost"` (`src/components/ui/button.tsx`): `text-tinta-sussurro
  hover:text-acao`, sem borda e sem fundo. **Todo botão fantasma com texto é texto
  cinza**; só o hover muda a cor, e no toque não há hover.
- `Button variant="link"`: texto em cor de ação, sublinhado só no hover. Várias
  telas trocam a cor para `text-tinta` ou `text-tinta-sussurro`, e aí some o único
  sinal.
- `BotaoLinha variante="linha"` (`src/components/ui/botao-linha.tsx`): fio embaixo e
  fundo no hover. Não traz seta; 5 dos 59 usos põem a seta por conta própria.
- `TableRow` (`src/components/ui/table.tsx`): fundo no hover para toda linha, clicável
  ou não. Nada diferencia a linha que abre alguma coisa.
- `Badge` não tem versão clicável. Os selos clicáveis são `<button>` feitos à mão,
  com `padrao-ok`, copiando a forma do selo de situação.
- `Parametro` (`src/components/monitor/Parametros.tsx`): com `onClick`, a linha
  inteira vira botão só com `hover:bg-campo`.
- O guia (`docs/frontend/GUIA.md`, 3.1) diz qual peça usar, mas não diz quando o
  botão fantasma é permitido. A verificação `scripts/padrao-frontend.mjs` não tem
  regra de destaque.

### O que não entrou na lista, e por quê

- **132 botões fantasma "de par"**: Voltar, Cancelar, Não, Desistir, Fechar,
  Limpar, Descartar rascunho, ao lado de um botão primário ou com borda. O botão
  vizinho dá o contexto.
- **32 botões fantasma com ícone e verbo claro** (lixeira + "Remover", impressora +
  "Imprimir", lápis + "Editar", "Suspender" com o ícone de proibido).
- **51 botões só de ícone** (`size="icon…"`): X, lixeira, setas, estrela. Entraram
  só os do leito, porque o ícone lê como situação do leito (padrão "Ícone que
  parece estado").
- Fantasmas que o próprio className transforma em outra coisa: abas do admin,
  controle segmentado do login e do cadastro, cartões da escala, cabeçalho de
  ordenação da fila, passos da alta (têm borda, fundo ou seta).
- `Recusar` ao lado de `Aceitar`/`Aprovar` (escala, passagem de plantão) e
  `Manter na fila` ao lado de `Retirar` (chamada da porta).
- Navegação da casca (lateral, topo, menu do usuário) e marca que volta ao início.
- `<summary>` com o triângulo padrão do navegador.

Limite do método: é leitura de código, sem abrir as telas. Um item pode ter
destaque vindo de CSS global que não vi; conferi `src/index.css` para `a`,
`.cc-param` e `.cc-lista-linha`.

## Resumo

| Gravidade | Itens |
|---|---|
| alta | 10 |
| média | 34 |
| baixa | 114 |
| **total** | **158** |

Cada linha de arquivo conta como um item. Os 19 resultados de busca estão nos
"baixa" e aparecem só na seção de padrões.

## Lista por área

Colunas: **Qtd** é o número de pontos no código daquela linha da tabela.

### Porta e atendimento

O cabeçalho e os blocos do paciente são os mesmos na porta, no leito e na gaveta de
cuidados da enfermagem. Ficam aqui, com a lista de onde aparecem.

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/components/paciente/AlergiasEventos.tsx:85` (`SeloAlergia`) | Cabeçalho do paciente: porta (`/atendimento`), leito (`/internacao`, `/observacao`), gaveta de cuidados (`/enfermagem/pronto-socorro`, `/enfermagem/internacao`); topo da prescrição | Abre a gaveta "Alergias e eventos adversos" (registrar, negar, histórico) | `<button>` com o texto do estado e um escudo. "Alergia não registrada", "não informada" e "não verificada": texto âmbar (`font-medium text-atencao`). "Nenhuma alergia conhecida": texto cinza (`text-tinta-sussurro`). Com alergia: cápsula vermelha cheia (`rounded-capsula bg-critico`), igual a selo de situação. Só `hover:opacity-90` | alta | Selo clicável | 1 |
| `src/components/paciente/Isolamento.tsx:53` (`SeloIsolamento`, sem isolamento) | Mesmo cabeçalho do paciente | Abre a gaveta de isolamento para marcar | `Button variant="ghost"` com `min-h-0 gap-1 p-0`: palavra "Isolamento" cinza com escudo, sem altura de botão | alta | Selo clicável | 1 |
| `src/components/paciente/Isolamento.tsx:61` (`SeloIsolamento`, ativo) | Mesmo cabeçalho do paciente | Abre a gaveta de isolamento (ver o tipo, retirar) | Cápsula vermelha cheia (`rounded-capsula bg-critico ... hover:opacity-90`), igual a selo de situação | alta | Selo clicável | 1 |
| `src/components/paciente/CabecalhoPaciente.tsx:91` (`SeloClassificacao`) | Porta (`/atendimento`) | Vai para a aba Atendimento e rola até a classificação | Cápsula na cor do protocolo, igual ao selo que não clica (`hover:opacity-90`) | média | Selo clicável | 1 |
| `src/pages/plantao/porta/AbaExames.tsx:53` | Porta, aba Exames | "Ver resultado" abre o resultado completo (versões, laudo, ciência); "Detalhe" abre o pedido | Fantasma `xs`, palavra cinza no fim da linha, depois dos selos "crítico · novo" | alta | Fantasma só texto | 1 |
| `src/components/obito/PainelObito.tsx:114` | Painel do óbito: leito, passos da alta, óbitos pendentes da fila da porta, da enfermagem e da recepção | Registra a via da declaração de óbito ("Via branca guardada", "Via amarela entregue", "Via rosa no prontuário") | Fantasma `sm`. O rótulo é frase de situação: lê como coisa já feita, não como ação | alta | Fantasma só texto | 1 |
| `src/components/obito/PainelObito.tsx:119` | Painel do óbito | "D.O. anulada ou rasurada" abre o registro da anulação | Fantasma `sm`, frase de situação | alta | Fantasma só texto | 1 |
| `src/components/obito/ObitosPendentes.tsx:41` | Fila da porta, enfermagem, recepção | "Abrir" mostra o painel do óbito (comunicações, vias, liberação do corpo) | Fantasma `xs`, palavra cinza no fim da linha | média | Fantasma só texto | 1 |
| `src/components/regulacao/HistoricoRegulacao.tsx:79` | Porta, leito, prontuário (`/prontuarios/:id`) | Abre o detalhe do pedido de regulação embaixo | `BotaoLinha` com `border-0 p-0 hover:bg-transparent`: data, selos e texto; sem fundo no hover, sem seta | média | Abre embaixo sem seta | 1 |
| `src/components/prontuario/Contencao.tsx:112` | Porta, leito, gaveta de cuidados | "N contenções anteriores" mostra as contenções anteriores | `Button variant="link"` recolorido para cinza (`text-tinta-sussurro underline`); o sublinhado cinza é o único sinal | média | Link apagado | 1 |
| `src/components/prontuario/Contencao.tsx:200` | Porta, leito, gaveta de cuidados | "Retificar" a revisão da contenção | Fantasma `xs`, palavra cinza | média | Fantasma só texto | 1 |
| `src/components/prontuario/Intercorrencias.tsx:69` | Porta, leito, gaveta de cuidados | "Retificar" a intercorrência | Fantasma `xs`, palavra cinza | média | Fantasma só texto | 1 |
| `src/components/clinico/ResultadoExame.tsx:135` | Resultado aberto, na porta e no leito | "Retificar" o resultado | Fantasma `sm` entre botões com borda | média | Fantasma só texto | 1 |
| `src/components/prontuario/Intercorrencias.tsx:77` | Porta, leito, gaveta de cuidados | Mostra as versões anteriores | Link recolorido para cinza, sublinhado | baixa | Link apagado | 1 |
| `src/components/clinico/ResultadoExame.tsx:131` | Resultado de exame de imagem | "Link da imagem" / "Trocar link da imagem" | Fantasma `sm` | baixa | Fantasma só texto | 1 |
| `src/components/preNatal/PreNatalNaConsulta.tsx:102`, `src/components/puericultura/PuericulturaNaConsulta.tsx:72` | Consulta da UBS, aba Conduta | "Retirar do pré-natal" / "Retirar da puericultura" | Fantasma `xs` | baixa | Fantasma só texto | 2 |
| `src/components/documentos/AtestadoReceita.tsx:183`, `:202`, `:243` | Atestado e receita da porta e da alta | "Reabrir" e "Trocar" | Fantasma | baixa | Fantasma só texto | 3 |

### Leito e internação (inclui a enfermagem)

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/components/internacao/caderno/Acuidade.tsx:125` | Leito aberto, bloco Acuidade (NEWS2/PEWS) | Abre e fecha o motivo do alerta | `BotaoLinha` com `border-0 bg-transparent`: o minigráfico de tendência e um texto cinza ("24 h · subindo") | alta | Gráfico clicável | 1 |
| `src/components/internacao/caderno/Sepse.tsx:47` | Leito, "Rastreio de sepse · Phoenix" | "Marcar suspeita de infecção" (ou retirar): liga ou desliga o cálculo do Phoenix | Fantasma `xs`, texto cinza no canto do título da seção | alta | Fantasma só texto | 1 |
| `src/components/clinico/ExamesEAgravos.tsx:127` | Leito, exames | "Ver resultado" abre o resultado completo (versões, laudo, ciência) | Fantasma `xs` depois do selo "crítico · novo" | alta | Fantasma só texto | 1 |
| `src/components/clinico/ExamesEAgravos.tsx:110` | Leito, exame pendente | "Detalhe" abre o pedido | Fantasma `xs` | média | Fantasma só texto | 1 |
| `src/components/internacao/caderno/PainelPaciente.tsx:67` | Leito, painel "Paciente" | Selo da classificação abre a classificação | Cápsula na cor do protocolo, igual ao selo que não clica | média | Selo clicável | 1 |
| `src/components/evolucao/Historico.tsx:154` | Leito, aba Evolução | Abre o registro da evolução | `BotaoLinha` linha (`hover:bg-campo/60`), sem seta | média | Abre embaixo sem seta | 1 |
| `src/components/internacao/caderno/Alta.tsx:283` | Leito, "Pacote de alta" | "Revogar" o link que o paciente recebeu | Fantasma `xs` | média | Fantasma só texto | 1 |
| `src/components/leito/AcoesLeito.tsx:105`, `:117`, `:129`, `:146`, `:158`, `:189` | Enfermagem (`/enfermagem/pronto-socorro`, `/enfermagem/internacao`, "Leitos para liberar") e Setores (`/unidade?aba=setores`) | Higienizado, bloquear, desbloquear, reservar, cancelar reserva, liberar leito sem paciente | Fantasma `icon-xs` (24 px), sem borda. Cadeado e marcador ao lado do leito leem como situação do leito; o texto só aparece no `title` | média | Ícone que parece estado | 6 |
| `src/pages/enfermagem/Checagem.tsx:322` | `/checagem` | "Usar sugestão" preenche os horários com a sugestão | Fantasma `xs`, palavra cinza na linha da sugestão | média | Fantasma só texto | 1 |
| `src/components/internacao/caderno/Trilha.tsx:75` | Leito, "Trilha do episódio" | Abre a lista de eventos | `<summary>` com `flex` (some o triângulo), texto cinza com ícone de relógio | baixa | Abre embaixo sem seta | 1 |
| `src/components/internacao/caderno/Trilha.tsx:80`, `:102` | Leito, trilha aberta | "Ver eventos mais antigos" / "Ver transferências mais antigas" | Fantasma `sm` | baixa | Fantasma só texto | 2 |
| `src/pages/enfermagem/PassagemEnfermagem.tsx:160` | `/enfermagem/internacao`, histórico de passagens | Abre a passagem | `<summary>` com `flex` (some o triângulo): texto pequeno e selos | baixa | Abre embaixo sem seta | 1 |
| `src/components/leito/ReservarLeito.tsx:90`, `src/components/paciente/CadastroRn.tsx:69` | Reserva de leito; recém-nascido da mãe | "Trocar" | Fantasma `xs` | baixa | Fantasma só texto | 2 |

### Prescrição

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/components/paciente/AlergiasEventos.tsx:116` (`ResumoAlergias`) | Topo da prescrição do leito e aba Prescrição da porta | "Alergias e eventos adversos" abre a gaveta de alergias | Fantasma `xs`, texto cinza à direita do selo | alta | Fantasma só texto | 1 |
| `src/components/prescricao/PrescricaoEstruturada.tsx:631` | Prescrição do leito, novo item | "Sinalizar falta" avisa a farmácia | Fantasma `xs` | média | Fantasma só texto | 1 |
| `src/components/prescricao/PrescricaoEstruturada.tsx:637` | Prescrição do leito, novo item | "Trocar" o medicamento | Fantasma `xs` | baixa | Fantasma só texto | 1 |
| `src/pages/PreferenciasPrescricao.tsx:201` | `/preferencias-prescricao` | "Trocar" | Fantasma `xs` | baixa | Fantasma só texto | 1 |

### Escala

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/pages/Escala.tsx:1847` | `/escala`, grade da escala fixa | Abre a edição da célula (setor × dia) | `<button>` sem borda, só `hover:bg-acao/5`; vazia, mostra "+ adicionar" em cinza | média | Célula de grade | 1 |
| `src/pages/Escala.tsx:1946` | `/escala`, grade semanal | Abre a edição do plantão | Igual à anterior | média | Célula de grade | 1 |
| `src/pages/Escala.tsx:1859` | `/escala`, grade da escala fixa | "remover" o nome da célula | `Button variant="link"` com `hidden ... group-hover:block`: só aparece com o mouse em cima; no celular e no tablet nunca aparece | média | Só no hover | 1 |
| `src/pages/gestor/EscalaMes.tsx:310` | `/escala`, escala do mês | "Remover" o profissional do turno | Link recolorido para cinza (`text-tinta-sussurro`), sem sublinhado | média | Link apagado | 1 |
| `src/pages/gestor/EscalaMes.tsx:321` | `/escala`, escala do mês | "Retirar vaga" | Igual à anterior | média | Link apagado | 1 |
| `src/components/escala/EscalaEquipe.tsx:198` | `/minha-escala` | Escolhe o dia no calendário | `BotaoLinha` sem borda, fundo branco | baixa | Célula de grade | 1 |
| `src/pages/gestor/EscalaMes.tsx:267` | `/escala`, escala do mês | Escolhe o dia no calendário | `BotaoLinha` sem borda, fundo branco | baixa | Célula de grade | 1 |

### Gestão e administração

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/pages/RevisaoClinica.tsx:272` | `/revisao-clinica` | O título da ficha abre a ferramenta para conferir | `Link` em cor de texto (`text-tinta hover:text-acao`) | média | Link apagado | 1 |
| `src/pages/gestor/PainelGestor.tsx:82` | `/gestao`, régua de números | Abre a tela do número | `Parametro` com `onClick`: linha com fundo só no hover, sem seta | baixa | Linha sem seta | 1 |
| `src/pages/Setores.tsx:215` | `/unidade?aba=setores` | Escolhe o setor | `BotaoLinha` com `border-0 bg-transparent p-0 hover:bg-transparent` | baixa | Linha sem seta | 1 |
| `src/pages/admin/RedeCompleta.tsx:129` | `/painel`, rede | O nome da unidade abre a edição | Link recolorido para `text-tinta` | baixa | Link apagado | 1 |
| `src/pages/admin/ErrosEAlertas.tsx:286` | `/erros-e-alertas` | O selo "N falhas" abre a lista | Fantasma com forma de selo, igual ao selo "ok" ao lado, que não clica | baixa | Selo clicável | 1 |
| `src/pages/admin/WebhooksAba.tsx:92` | `/integracoes`, destinos | Abre o destino | `TableRow` com `cursor-pointer hover:bg-trilha/60` | baixa | Linha de tabela | 1 |
| `src/pages/admin/WebhooksAba.tsx:94` | `/integracoes`, destinos | O nome abre o destino | Link recolorido para `text-tinta` | baixa | Link apagado | 1 |
| `src/pages/admin/Integracoes.tsx:149`, `:255` | `/integracoes` | "Já copiei", "Ver acessos" | Fantasma `xs` | baixa | Fantasma só texto | 2 |
| `src/pages/gestor/DetalhesAdmissao.tsx:82`, `src/pages/Configuracao.tsx:253` | `/configuracao` | "Remover" / "Reativar" | Fantasma `sm` | baixa | Fantasma só texto | 2 |
| `src/pages/gestor/ExamesUnidade.tsx:163`, `:164`, `:239` | `/gestao/exames` | "Editar", "Retirar" | Fantasma `xs` | baixa | Fantasma só texto | 3 |
| `src/pages/gestor/Implantacao.tsx:255`, `:321` | `/implantacao` | "Reabrir", "Desfazer" | Fantasma `xs` | baixa | Fantasma só texto | 2 |
| `src/pages/gestor/Protocolos.tsx:212` | `/gestao/protocolos` | "Voltar para em revisão" | Fantasma `sm` | baixa | Fantasma só texto | 1 |

### Central e ferramentas

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/pages/plantonista/calculadoras/InfusoesAdulto.tsx:195` | `/plantonista/calculadoras/infusoes-adulto` | Abre o grupo de drogas | `BotaoLinha` linha com ícone e contagem, sem seta | baixa | Abre embaixo sem seta | 1 |
| `src/pages/plantonista/SectionHome.tsx:95` | `/plantonista/:section` | Índice: pula para o grupo | Link cinza (`text-tinta-apoio`) | baixa | Link apagado | 1 |
| `src/components/plantonista/ToolLayout.tsx:67` | Ferramentas da central | Sumário: pula para a seção | Link cinza (`text-tinta-sussurro`) | baixa | Link apagado | 1 |
| `src/components/plantonista/central/CartaoTurno.tsx:217` | `/plantonista`, cartão do turno | "Ver pacientes internados" | Link cinza com ícone | baixa | Link apagado | 1 |

### Outros

**Farmácia**

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/components/casca/FaixaDoPapel.tsx:90` | Faixa do farmacêutico, no alto das telas | "Administradas sem liberação" leva a `/alta-vigilancia` | `Parametro` com `onClick`: linha com fundo só no hover, sem seta | média | Linha sem seta | 1 |
| `src/pages/farmacia/AltaVigilancia.tsx:150`, `:180` | `/alta-vigilancia` | Escolhe o item e abre o painel ao lado | `TableRow` com `cursor-pointer`; o `BotaoLinha` de dentro tem `border-0 p-0 hover:bg-transparent` | média | Linha de tabela | 2 |
| `src/components/casca/FaixaDoPapel.tsx:97` | Faixa do farmacêutico | "Faltas sinalizadas em aberto" leva a `/farmacia` | Igual à de cima | baixa | Linha sem seta | 1 |
| `src/pages/farmacia/Farmacia.tsx:166`, `src/pages/farmacia/Interacoes.tsx:114`, `:136` | `/farmacia`, `/interacoes` | Escolhe a linha e abre o painel ao lado | `TableRow` com `cursor-pointer` | baixa | Linha de tabela | 3 |
| `src/pages/farmacia/Farmacia.tsx:555`, `:686`, `src/pages/farmacia/AltaVigilancia.tsx:386`, `src/pages/farmacia/Diluicoes.tsx:175`, `:185`, `src/pages/farmacia/Dispensacao.tsx:106` | `/farmacia`, `/alta-vigilancia`, `/dispensacao` | Escolhe o item da lista e abre o painel ao lado | `BotaoLinha` linha, sem seta | baixa | Linha sem seta | 6 |
| `src/pages/farmacia/AltaVigilancia.tsx:138`, `:358`, `Diluicoes.tsx:318`, `Dispensacao.tsx:227`, `:331`, `Farmacia.tsx:534`, `Interacoes.tsx:202`, `UnidadeConsumo.tsx:293`, `:294` (todos em `src/pages/farmacia/`) | Telas da farmácia | "Ver a lista", "Trocar", "Devolução", "Preencher o grupo", "Corrigir", "Inativar" | Fantasma `xs`. "Devolução" é substantivo e lê como nome de coluna | baixa | Fantasma só texto | 9 |

**Faturamento**

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/pages/faturamento/Contas.tsx:111`, `EnvioErp.tsx:112`, `Glosas.tsx:94` | `/faturamento/contas`, `/faturamento/erp`, `/faturamento/glosas` | Abre a conta, o envio ou a competência | `TableRow` com `cursor-pointer hover:bg-trilha/60` | baixa | Linha de tabela | 3 |
| `src/pages/faturamento/Contas.tsx:566` | `/faturamento/contas` | "Fora da conta" / "Voltar à conta" | Fantasma `xs`; "Fora da conta" lê como situação | baixa | Fantasma só texto | 1 |
| `src/pages/faturamento/Bpa.tsx:105`, `:505`, `Contas.tsx:325`, `:645`, `:786`, `Materiais.tsx:94`, `:156`, `Glosas.tsx:196` | Telas do faturamento | "Abrir", "Retirar", "Trocar", "Editar", "Tirar", ação da glosa | Fantasma `xs`/`sm` | baixa | Fantasma só texto | 8 |

**Regulação**

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/pages/regulacao/Regulacao.tsx:1037` | `/regulacao`, fila | Abre o pedido com as ações | `BotaoLinha` com `border-0 p-0 hover:bg-transparent`: selos, espera, nome e resumo; sem fundo no hover, sem seta | média | Abre embaixo sem seta | 1 |
| `src/pages/regulacao/Regulacao.tsx:1056` | `/regulacao`, pedido aberto | "Devolver à fila" | Fantasma `xs` | média | Fantasma só texto | 1 |
| `src/pages/regulacao/Regulacao.tsx:266`, `:410`, `:1250` | `/regulacao` | "Trocar", "Ver o mapa de vagas" | Fantasma `xs` | baixa | Fantasma só texto | 3 |
| `src/pages/regulacao/Aih.tsx:153`, `:184`, `Apac.tsx:134`, `:136`, `:282`, `:400` | `/aih`, `/apac` | "Cancelar AIH", "Cancelar APAC", "Ver histórico", "Tirar", "Abrir" | Fantasma `xs`/`sm` | baixa | Fantasma só texto | 6 |
| `src/components/regulacao/MapaVagas.tsx:158`, `:159`, `SlaRegulacao.tsx:210`, `AnexosRegulacao.tsx:139`, `src/components/apac/SolicitarApac.tsx:102` | Mapa de vagas, SLA, anexos, pedido de APAC | "Editar", "Tirar do mapa", "Desfazer", "Retirar", "Trocar" | Fantasma `xs`/`sm` | baixa | Fantasma só texto | 5 |

**Entrada e segurança**

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/components/seguranca/SegundoFator.tsx:475`, `:480`, `:485` | Segundo fator (entrada, `/perfil`, exportar dados, recuperar senha) | "Estou sem e-mail: quero ir pelo autenticador", "Usar um código de recuperação", "Voltar ao código por e-mail" | Fantasma com `p-0`: frase cinza solta. Quem não acha fica fora do sistema | média | Fantasma só texto | 3 |
| `src/components/seguranca/SegundoFator.tsx:403` | Segundo fator | "Reenviar código" | Fantasma | baixa | Fantasma só texto | 1 |

**Demais telas**

| Arquivo:linha | Onde aparece | O que o clique faz | Como está hoje | Grav. | Padrão | Qtd |
|---|---|---|---|---|---|---|
| `src/pages/preNatal/PreNatal.tsx:147` | `/pre-natal` | "Fim da gestação" registra o desfecho | Fantasma `xs`; o rótulo lê como fase, não como ação | média | Fantasma só texto | 1 |
| `src/pages/preNatal/PreNatal.tsx:146`, `:148`, `src/pages/puericultura/Puericultura.tsx:106` | `/pre-natal`, `/puericultura` | "Corrigir DUM", "Retirar" | Fantasma `xs` | baixa | Fantasma só texto | 3 |
| `src/pages/Notificacoes.tsx:177` | `/notificacoes` | "Marcar como lido" | Link recolorido para cinza, com `hover:no-underline` | baixa | Link apagado | 1 |
| `src/components/chat/ListaConversas.tsx:48` | Gaveta de mensagens | Abre a conversa | `BotaoLinha` linha, sem seta | baixa | Linha sem seta | 1 |
| `src/pages/agenda/AgendaConsultas.tsx:299` | `/agenda-consultas` | Escolhe o dia | Fantasma `xs` com o número do dia (o dia escolhido vira primário) | baixa | Célula de grade | 1 |
| `src/pages/agenda/AgendaConsultas.tsx:397` | `/agenda-consultas` | "Trocar" | Fantasma `xs` | baixa | Fantasma só texto | 1 |
| `src/pages/prontuario/ImpressaoProntuario.tsx:394`, `src/pages/prontuario/PedidosProntuario.tsx:213`, `src/components/prontuario/HistoricoEncerrado.tsx:110` | `/impressao-prontuario`, `/prontuarios`, prontuário | "Desmarcar", "Cancelar pedido", "Ver todos" | Fantasma `sm` | baixa | Fantasma só texto | 3 |
| `src/pages/recepcao/CadastrosDuplicados.tsx:190` | `/cadastros-duplicados` | "Cancelar meu pedido" | Fantasma `sm` | baixa | Fantasma só texto | 1 |
| `src/pages/Perfil.tsx:242` | `/perfil` | "Remover" | Fantasma `sm` | baixa | Fantasma só texto | 1 |

### As 10 de gravidade alta

1. `AlergiasEventos.tsx:85` — selo de alergia (cabeçalho da porta, do leito e da enfermagem).
2. `Isolamento.tsx:53` — "Isolamento" sem isolamento, texto cinza (mesmo cabeçalho).
3. `Isolamento.tsx:61` — isolamento ativo, cápsula vermelha igual a selo de situação.
4. `AlergiasEventos.tsx:116` — "Alergias e eventos adversos" no topo da prescrição.
5. `AbaExames.tsx:53` — "Ver resultado" do exame na porta.
6. `ExamesEAgravos.tsx:127` — "Ver resultado" do exame no leito.
7. `Acuidade.tsx:125` — gráfico de tendência que abre o motivo do alerta, no leito.
8. `Sepse.tsx:47` — "Marcar suspeita de infecção" (liga o Phoenix), no leito.
9. `PainelObito.tsx:114` — vias da declaração de óbito, rotuladas como situação.
10. `PainelObito.tsx:119` — "D.O. anulada ou rasurada", rotulada como situação.

## Padrões que se repetem

Cada padrão sai de uma peça (ou da falta de uma). Corrigir a peça corrige todos os
usos dela.

| Padrão | O que é | Itens | alta | média | baixa | Peça envolvida |
|---|---|---|---|---|---|---|
| Fantasma só texto | `Button variant="ghost"` com palavra ou frase, sem ícone, solto no conteúdo | 83 | 6 | 13 | 64 | `Button` (variante `ghost`) |
| Resultado de busca | Item da lista que aparece depois de digitar | 19 | 0 | 0 | 19 | `BotaoLinha`, `Button ghost`, `Button link` |
| Link apagado | `Button variant="link"` ou `Link` recolorido para cor de texto ou cinza | 11 | 0 | 4 | 7 | `Button` (variante `link`) e `Link` |
| Linha sem seta | Linha que abre ou escolhe algo, sem seta | 11 | 0 | 1 | 10 | `BotaoLinha variante="linha"`, `Parametro` |
| Linha de tabela | `TableRow` com `onClick` | 9 | 0 | 2 | 7 | `TableRow` |
| Selo clicável | Botão com forma ou cor de selo de situação (inclui o "Isolamento" cinza, que é o mesmo selo sem isolamento) | 6 | 3 | 2 | 1 | Selos feitos à mão (`padrao-ok`); `Badge` não tem versão clicável |
| Abre embaixo sem seta | Linha ou `<summary>` que expande, sem seta | 6 | 0 | 3 | 3 | `BotaoLinha`, `<summary>` com `flex` |
| Ícone que parece estado | Botão só de ícone, sem borda, ao lado de algo cuja situação o ícone também poderia indicar | 6 | 0 | 6 | 0 | `Button` (`ghost` + `icon-xs`) |
| Célula de grade | Célula de calendário ou de grade que abre ou escolhe | 5 | 0 | 2 | 3 | `<button>` com `padrao-ok`, `BotaoLinha`, `Button ghost` |
| Gráfico clicável | Gráfico que abre detalhe | 1 | 1 | 0 | 0 | `BotaoLinha` |
| Só no hover | Ação que só aparece com o mouse em cima | 1 | 0 | 1 | 0 | `Button variant="link"` com `group-hover` |
| **total** | | **158** | **10** | **34** | **114** | |

Cada item está em um padrão só. Três peças concentram quase tudo: a variante
`ghost` do `Button` (83), o `BotaoLinha` sem seta (linhas, acordeões, buscas) e o
selo feito à mão.

### Detalhes dos padrões

**Fantasma só texto.** É o maior grupo e nasce na variante: `ghost` é
`text-tinta-sussurro` sem borda e sem fundo. Dentro dele há um caso pior, o
**rótulo que lê como situação**: "Via branca guardada", "Via amarela entregue",
"Via rosa no prontuário", "D.O. anulada ou rasurada", "Fim da gestação", "Fora da
conta". Aí nem a palavra diz que é ação.

**Selo clicável.** Selo de alergia, de isolamento (ativo e o estado sem
isolamento) e da classificação, mais o selo de falhas do admin. A forma copia o
selo de situação que não clica, e o selo da classificação vira botão numa tela e
fica parado em outra. No mesmo cabeçalho, a cápsula do leito/setor
(`bg-acao/10`) **não** clica e parece mais clicável que a alergia ao lado.

**Linha sem seta e abre embaixo sem seta.** O `BotaoLinha` não traz seta; 5 dos
59 usos põem a seta à mão (`DestinoRegulacao`, `SlaRegulacao`, `Rede`,
`Regulacao:682`, `PanoramaConfig`). Os outros dependem do fundo no hover, e alguns
o desligam (`hover:bg-transparent`).

**Linha de tabela.** O `TableRow` pinta o hover em toda linha. A linha que abre
alguma coisa fica igual à que não abre.

**Resultado de busca** (19, baixa, não estão nas tabelas de área): aparecem logo
depois de a pessoa digitar no campo, então o contexto ajuda. Mesmo assim, alguns
são texto puro.
`src/components/apac/SolicitarApac.tsx:110`,
`src/components/internacao/documentos/PedidoExamesLeito.tsx:130`,
`src/components/perfil/CampoCbo.tsx:56`, `src/pages/faturamento/Bpa.tsx:535`,
`src/pages/faturamento/Contas.tsx:794`, `src/pages/gestor/ExamesUnidade.tsx:100`,
`src/pages/plantao/porta/AbaExames.tsx:176` (fantasma `justify-start`);
`src/components/hiperdia/IncluirNoHiperdia.tsx:89`,
`src/components/leito/ReservarLeito.tsx:106`,
`src/components/paciente/CadastroRn.tsx:77`,
`src/components/preNatal/Dialogos.tsx:99`,
`src/components/regulacao/AnexosRegulacao.tsx:189`,
`src/pages/agenda/AgendaConsultas.tsx:408`, `src/pages/farmacia/Dispensacao.tsx:233`,
`src/pages/faturamento/Materiais.tsx:165`, `src/pages/PreferenciasPrescricao.tsx:211`,
`src/pages/PrescricaoTeste.tsx:199`, `src/pages/regulacao/Regulacao.tsx:420`
(`BotaoLinha` linha); `src/pages/farmacia/Diluicoes.tsx:322` (`Button variant="link"`
recolorido para `text-tinta`).

## Exceções `padrao-ok` em elementos clicáveis

Todas as exceções da verificação do frontend que caem num elemento clicável:

| Arquivo:linha | Motivo declarado | Tem destaque? |
|---|---|---|
| `src/components/paciente/AlergiasEventos.tsx:84` | Selo de alergia clicável nos tons de cada estado | **Não** (item alta) |
| `src/components/paciente/Isolamento.tsx:60` | Selo de isolamento ativo, cápsula vermelha | **Não** (item alta) |
| `src/components/paciente/CabecalhoPaciente.tsx:90` | Pílula da classificação clicável nas cores do protocolo | **Não** (item média) |
| `src/pages/Escala.tsx:1846` | Célula da grade da escala fixa | **Não** (item média) |
| `src/pages/Escala.tsx:1945` | Célula da grade da escala semanal | **Não** (item média) |
| `src/pages/Escala.tsx:1233` | Célula do calendário mensal da escala | Sim: borda e fundo |
| `src/pages/Escala.tsx:1548` | Célula do calendário mensal da escala geral | Sim: borda e fundo |
| `src/components/prescricao/PrescricaoEstruturada.tsx:330` | Chip de favorito travado por alergia | Sim: borda |
| `src/pages/plantao/atendimento/ReceituarioMedico.tsx:354` | Chip de favorito com três estados | Sim: borda |
| `src/pages/enfermagem/triagem/Classificar.tsx:303` | Escolha da cor da classificação | Sim: borda de 2 px |
| `src/pages/enfermagem/triagem/Classificar.tsx:407` | Marca de 18 px dentro da linha clicável | Sim: caixa de marcar |
| `src/components/ui/caixa-marcar.tsx:31` | Caixa de marcar de 18 px | Sim: forma de caixa |
| `src/pages/gestor/PanoramaConfig.tsx:102` | Interruptor liga/desliga | Sim: forma de interruptor |
| `src/pages/recepcao/CadastrosDuplicados.tsx:258` | Cartão selecionável do par de cadastros | Sim: borda |
| `src/pages/SeletorUnidade.tsx:21` | Linha de unidade na tela de marca | Sim: seta |
| `src/pages/admin/RndsAba.tsx:403` | Área de soltar o arquivo | Sim: borda tracejada |
| `src/pages/public/PainelChamada.tsx:161` | Botão de som do painel da TV | Sim: cápsula com fundo |
| `src/components/plantonista/DaUnidade.tsx:63` | Ponto do carrossel de avisos | Ponto de carrossel (convenção); alvo de 6 px |
| `src/pages/public/PainelChamada.tsx:229` | Marcador das artes do painel da TV | Ponto de carrossel (convenção) |

São 19 exceções em clicáveis; 5 estão sem destaque e já estão na lista acima.
