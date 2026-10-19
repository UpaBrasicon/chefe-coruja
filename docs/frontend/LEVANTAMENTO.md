# Levantamento do frontend — trilha "Padrão do frontend", parte 1

Data: 19/10/2026. Escopo: `src/` do repositório `chefe-coruja` (React + TypeScript + Vite + Tailwind 4 + shadcn/base-ui).
Pedido do responsável técnico: organizar o frontend e manter o padrão daqui para a frente.

Este documento só descreve. Nenhum arquivo de código mudou. A parte 2 (guia) e a parte 3 (verificação na CI) partem daqui.

**Como as contagens foram feitas.** Um script de varredura (fora do repositório) leu os 743 arquivos `.ts`, `.tsx` e `.css` de `src/`, sem testes (`*.test.ts`) e sem `src/types/database.ts`. São 441 `.tsx`. As expressões usadas estão na seção 3 de cada tipo. Toda contagem conta ocorrência no texto do código, não uso em tela. Onde um número inclui algo legítimo, o texto diz.

---

## Resumo

- A base visual existe e está boa: tokens de cor, tipografia, raio, sombra e movimento em `src/index.css`, e um conjunto pequeno de componentes (`Button`, `Badge`, `Dialog`, `Gaveta`, `Spinner`, `TituloPagina`, `TituloSecao`, `Chip`, `Vazio`). A paleta crua do Tailwind quase sumiu (2 ocorrências).
- O padrão quebra em outros lugares. Os maiores volumes:
  - **1.280 tamanhos de texto fora da escala** (`text-xs`, `text-sm`, `text-[11px]`…) em 170 arquivos, contra 2.280 usos dos tokens. Mais de um terço do texto não usa a escala.
  - **261 `<button>` feitos à mão** em 128 arquivos (contra 818 `<Button>`), com 6 versões locais de `Chip` e 3 de `Abas`.
  - **Erro mostrado de 5 jeitos**: `<Erro>` importado da página da farmácia por 10 páginas de outras áreas, `<p role="alert">`, `<p>` sem `role="alert"` (117 casos), `Aviso` da enfermagem e `Mensagem` da evolução. A caixa de erro usa 6 lavagens diferentes.
  - **127 formatadores de data e hora locais** (fora de `src/lib` e `src/domain`) (21 se chamam `hora`, 17 `quando`), embora exista `src/lib/datas.ts`.
  - **88 `<select>` nativos** com 14 cópias da mesma constante de classe, e **64 tabelas** montadas à mão (o `Table` de `ui/` está em 1 arquivo).
  - **58 importações cruzadas**: 19 de `src/components` (e `contexts`) para `src/pages`, e 39 de uma área de página para outra.
- As telas com mais divergência são as **ferramentas clínicas** (464, em 151 arquivos), o **leito aberto/internados** (225), a **Escala do gestor** (191 em só 5 arquivos), a **entrada** (login, cadastro: 112) e a **Regulação** (100).

---

## 1. Base do padrão que já existe

### 1.1 Tokens (`src/index.css`, bloco `@theme inline`)

O Tailwind 4 não tem arquivo `tailwind.config.*`. Os tokens vivem em `src/index.css` e viram classes (`bg-acao`, `text-apoio`, `rounded-controle`…). O comentário do arquivo resume a gramática: a cor de identidade pertence à grandeza (rótulo e barra), a cor de estado pertence ao numeral, e o teal sinaliza o que é clicável. Não há modo escuro, por decisão de produto.

| Grupo | Tokens (classe gerada) | Valores |
|---|---|---|
| Ação e marca | `acao`, `acao-pressionada`, `marca` | `#0F766E`, `#134E4A`, `#0D9488` |
| Grandezas | `leitos`, `observacao`, `turno`, `suprimento` | verde, âmbar, ardósia, azul |
| Estados | `ok`, `atencao`, `critico`, `conforme` | `#1E293B`, `#92400E`, `#B91C1C`, `#15803D` |
| Neutros | `tinta`, `tinta-apoio`, `tinta-sussurro`, `grafite`, `superficie`, `campo`, `trilha`, `fio`, `fio-forte` | escala ardósia |
| Manchester | `mts-vermelho`, `mts-laranja`, `mts-amarelo`, `mts-amarelo-texto`, `mts-verde`, `mts-azul` | cores do protocolo |
| Pediatria | `pediatria` | `#6D28D9` |
| Seções da Central | `secao-calculadoras` … `secao-games` (12) | um passo profundo por seção |
| Lavagens | `alerta-atencao`, `alerta-critico`, `alerta-observacao`, `alerta-marca`, `alerta-conforme`, `nota`, `desfazer-regua`, `veu` | cor + 8% |
| Texto | `text-rotulo` 12, `text-apoio` 13, `text-controle` 14, `text-corpo` 15, `text-secao` 17, `text-dialogo` 20, `text-titulo` 24, `text-numeral-compacto` 25, `text-numeral-ok` 30, `text-numeral-atencao` 36, `text-numeral-critico` 42 | px |
| Raio | `rounded-micro` 5, `controle-sm` 9, `controle` 10, `bloco` 11, `container` 12, `menu` 14, `cartao` 16, `capsula` 999 | px |
| Sombra | `shadow-repouso`, `halo`, `halo-ferramenta`, `popover`, `toast`, `dialogo`, `paleta`, `desfazer`, `lateral`, `lateral-aberta`, `fab` | — |
| Movimento | `animate-cc-sobe`, `cc-dlg`, `cc-scrim`, `cc-lateral`, `cc-toast`, `cc-toast-sai`, `cc-abre-leito`, `cc-zoom-dia`, `cc-zoom-mes`, `cc-veu-saida` | — |
| Utilitários | `.tabular` (números alinhados), `.rotulo` (12px/600 caixa alta), `.cc-tecla`, `.cc-casc` (cascata), `.alvo-toque` | — |

O que **não** existe como token:

- **Espaçamento.** O protótipo usa um ritmo fino e ímpar (7, 12, 14, 22, 28 px). O app escreve esses valores à mão: 599 classes `p-[7px]`, `gap-[13px]`, `mb-[22px]` em 118 arquivos.
- **Lavagem de erro e aviso como componente.** O token `alerta-critico` existe, mas cada tela monta a caixa.
- **Superfícies escuras de marca** (entrada, painel da TV): usam hex solto (`#5EEAD4`, `#B7DED8`, `#0B3D3A`).
- **Véu de diálogo** (`rgba(15,23,42,0.42)`): repetido em 3 arquivos em vez de um token.
- **Peso de texto acima de 600 na tela**: a regra do protótipo é 400/500/600. Não há regra que impeça `font-bold`.

Os nomes do shadcn (`bg-primary`, `text-muted-foreground`, `border-input`…) estão mapeados para os tokens e **não aparecem fora de `ui/`** (só `bg-card`, 7 vezes). Esse vocabulário paralelo não é problema hoje.

### 1.2 Componentes de base (`src/components/ui/`)

| Componente | Arquivo | Para que serve | Arquivos que importam |
|---|---|---|---|
| `Button` (variantes `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; tamanhos `xs`, `sm`, `default`, `lg`, `bloco`, `icon*`) | `ui/button.tsx` | Todo comando. Primário é a única cor de comando; alvo mínimo 32 px; `bloco` dá 44 px para o celular. | 169 |
| `Badge` (variantes `default`, `secondary`, `destructive`, `outline`, `ghost`, `success`, `warning`, `info`) | `ui/badge.tsx` | Selo de estado: cápsula 12px/600 caixa alta, com a própria cor como lavagem. | 104 |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `ui/card.tsx` | Cartão de conteúdo. | 81 |
| `Input` | `ui/input.tsx` | Campo de texto. | 111 |
| `Textarea` | `ui/textarea.tsx` | Texto longo. | 52 |
| `Label` | `ui/label.tsx` | Rótulo de campo. | 79 |
| `Select…` (base-ui) | `ui/select.tsx` | Lista suspensa desenhada. | 14 |
| `InputGroup…` | `ui/input-group.tsx` | Campo com adorno (ícone, unidade). | 0 |
| `Dialog…` | `ui/dialog.tsx` | Diálogo modal. | 26 |
| `Gaveta`, `GavetaCabeca`, `GavetaPe` | `ui/gaveta.tsx` | Painel lateral (420 px). | 10 |
| `Tabs…` | `ui/tabs.tsx` | Abas. | 3 |
| `Table…` | `ui/table.tsx` | Tabela com rolagem horizontal. | 1 (`pages/Pessoas.tsx`) |
| `Command…` (cmdk) | `ui/command.tsx` | Busca da paleta. | 1 |
| `Spinner` | `ui/spinner.tsx` | Carregando, com `role="status"` e rótulo para leitor de tela. | 132 |
| `Skeleton` | `ui/skeleton.tsx` | Esqueleto de carregamento. | 1 |

`InputGroup` não tem uso. `Table`, `Tabs` e `Select` têm uso mínimo: as telas montam esses elementos à mão (seção 3).

### 1.3 Componentes de página (`src/components/monitor/` e outros)

| Componente | Arquivo | Para que serve | Uso |
|---|---|---|---|
| `TituloPagina` | `monitor/Pagina.tsx:8` | h1 de 24 px com azulejo de 42 px e ícone, descrição e ações. | 60 vezes em 57 arquivos |
| `Trilha` | `monitor/Pagina.tsx:26` | Migalha ("Você está em"). | 9 arquivos |
| `TituloSecao` | `monitor/Pagina.tsx:44` | h2 de 17px/600 com contagem à direita. | 34 vezes em 16 arquivos |
| `Chip`, `Chips` | `monitor/Pagina.tsx:57`, `:74` | Filtro em cápsula, com `aria-pressed`. | 15 arquivos usam `Chips` |
| `Vazio` | `monitor/Pagina.tsx:83` | Estado vazio: ícone, título e texto. | 60 vezes em 44 arquivos |
| `FaixaParametros`, `Parametro`, `FitaSinal` | `monitor/Parametros.tsx` | Faixa de números do plantão (a "assinatura" visual). | casca e painéis |
| `Canais`, `Canal` | `monitor/Canais.tsx` | Atalhos grandes por grandeza. | — |
| `TabsPagina` | `components/TabsPagina.tsx` | Página com abas na URL (`?aba=`). Desenha o próprio h1. | grupos de gestão |
| `ToolLayout` | `components/plantonista/ToolLayout.tsx` | Moldura das ferramentas da Central. Desenha o próprio h1 e a fonte. | ferramentas |
| `PilulaRisco` | `components/clinico/PilulaRisco.tsx` | Cor de risco (só exibe). | porta, leito |
| `CabecalhoPaciente` | `components/paciente/CabecalhoPaciente.tsx` | Identificação e alergia no topo. | leito, porta |
| Avisos flutuantes (toast) e Desfazer | `contexts/AvisosFlutuantesContext.tsx`, `contexts/DesfazerContext.tsx` | Retorno de ação e desfazer. | casca |

Há também **"kits" paralelos** dentro de áreas, que repetem a função dos componentes acima com outro desenho: `components/documentos/ui.tsx` (`Cartao`, `Bloco`, `Campo`, `Chip`, `Pilulas`, `Aviso`, `Rodape`), `components/enfermagem/pecas.tsx` (`Cartao`, `Campo`, `Aviso`, `Nota`), `components/evolucao/pecas.tsx` (`Bloco`, `ChipEscolha`, `Selo`, `Mensagem`), `components/internacao/caderno/caixas.tsx` (`Secao`, `Caixa`, `Chip`), `pages/admin/ui.tsx` (`Metricas`, `Abas`, `Barra`), `pages/telemedicina/comum.tsx` (`Cartao`, `Secao`, `Nota`, `VazioLinha`) e `pages/farmacia/Farmacia.tsx` (`Erro`, `Abas`). A seção 3.12 lista as duplicações.

### 1.4 O que ainda vale dos documentos de referência

**`produto/docs/design-system-prototipo.md` (26/09)** — extração do protótipo.

- Vale como **fonte da gramática e dos valores**: seção 2 (cor, tipografia, raio, sombra, movimento) foi implementada quase inteira em `src/index.css`. Seção 3 (inventário) continua sendo a referência de desenho para tabela (3.18), estado vazio (3.19), feedback (3.17), campos (3.14) e abas (3.15).
- Seção 2.4 (tokens de espaço `justo`, `proximo`, `base`, `secao`, `pagina`) **não foi implementada**. É decisão em aberto (pergunta 13).
- Seção 6.2 propôs `src/ui/*` com `Botao`, `Selo`, `Campo`, `Tabela`, `PseudoTabela`, `Faixa`, `EstadoVazio`, `FolhaA4`. O app seguiu outro caminho: `src/components/ui` (shadcn) mais `src/components/monitor`. Existem o botão (`Button`), o selo (`Badge`), a gaveta, a paleta e o estado vazio (`Vazio`). **Faltam** `Campo` (com dica e erro), `Tabela`/`PseudoTabela` no desenho do protótipo, `Faixa` (aviso inline) e `Caixa`/`Interruptor`.
- Seção 6.3 (pendências) — situação hoje:
  1. Resíduos: `rounded-menu` (14 px) ainda tem 10 usos; texto de 11 px tem 26 usos (`text-[11px]`) e o `.cc-tecla` segue em 11 px; `#0B5D57`, `#94A3B8`, `#DC2626` ainda aparecem (10 ocorrências).
  2. Lavagens Tailwind-50 (`#FEF2F2`, `#FFFBEB`, `#FDE68A`, `#FEF3C7`, `#FECACA`, `#ECF7F5`): **ainda em 36 lugares, 15 arquivos**. Decisão em aberto (pergunta 3).
  3. a 5. Não conferidos neste levantamento (corte de 1023 px, trilho do interruptor, largura da coluna).

**`produto/docs/AUDITORIA-FRONTEND-2026-10-03.md`** — quase toda clínica (riscos, defeitos, faltas). O que toca o padrão visual:

- "Componentes `EstadoVazio`, `PseudoTabela`, `FolhaA4` e `Fab` genérico não existem; token `kpi`": hoje o estado vazio existe (`Vazio`), os outros três não, e não há token `kpi` (o mais próximo é `text-numeral-compacto`).
- "`EvolucaoTab.tsx` ainda alcançável… retirar": **continua alcançável** por `/plantao/internacao/formulario`, com emoji nas abas e cores cruas na impressão (seção 3.4 e 3.15).
- Seções 6 e 7 (não portar; o que está certo) continuam válidas.

**`produto/docs/mapa-frontend-atual.md` (26/09)** — retrato de **antes do porte**. Ficou desatualizado na parte visual (fala de Inter, modo escuro, `#F59E0B`, 167 arquivos; hoje são 441 `.tsx`). Continua útil para stack (seção 1), camada de dados (seção 3) e guardas de rota (2.4).

**`chefe-coruja/FRONTEND.md` (22/08)** — a seção 9 (design system) está **obsoleta**: lista `--cor-secundaria #F59E0B`, `--cor-sucesso #16A34A` e tokens oklch que não existem mais. Os nomes `--cor-*` ainda estão em `:root` como apelidos antigos, mas nenhuma tela deveria usá-los. Recomendo que o guia (parte 2) substitua essa seção.

---

## 2. Mapa das telas

Fonte: rotas de `src/App.tsx` e menus de `src/components/casca/navegacao.ts`. As áreas estão na ordem de uso no plantão. "Papéis" é o `RequireRole` da rota; quando o menu do papel não mostra o item, a coluna diz.

### 2.1 Porta (recepção)

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Nova ficha, fila da triagem, fila médica, painel | `/recepcao`, `/recepcao/:tela` | `pages/recepcao/Recepcao.tsx` (+ `CamposCadastro.tsx`, `PropagandaPainel.tsx`, `components/porta/*`) | recepcao, plantonista, gestor (menu só na recepção) |
| Painel de chamada (TV) | `/painel/:token` | `pages/public/PainelChamada.tsx` | público, por token |
| Cadastros duplicados | `/cadastros-duplicados` | `pages/recepcao/CadastrosDuplicados.tsx` | recepcao, gestor |

### 2.2 Atendimento no PS (médico)

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Pronto Socorro: fila médica e janela do atendimento (abas) | `/atendimento` | `pages/plantao/AtendimentoPorta.tsx` + `pages/plantao/porta/*` (`FilaPS`, `JanelaAtendimento`, `AbaAtendimento`, `AbaPrescricao`, `AbaExames`, `AbaReavaliacao`, `AbaAtestadoReceita`, `AbaDesfecho`) | plantonista |
| Documentos da porta: receituário, atestado, encaminhamento, pedido de exames | `/plantao/atendimento-porta/:tool` | `pages/plantao/PlantaoToolRouter.tsx` → `pages/plantao/atendimento/*` (+ `components/documentos/*`) | plantonista |
| Pareceres | `/pareceres` | `pages/parecer/Pareceres.tsx` | plantonista, gestor, telemedicina |
| Telemedicina (pedido) | `/teleinterconsulta` | `pages/telemedicina/Teleinterconsulta.tsx` | plantonista, gestor, telemedicina |
| Notificação compulsória | `/notificacao-compulsoria` | `pages/notificacao/NotificacaoCompulsoria.tsx`, `FichaSinan.tsx` | plantonista, enfermeiro, gestor |
| Contingência | `/contingencia` | `pages/Contingencia.tsx` | plantonista, enfermeiro, gestor |

### 2.3 Triagem e enfermagem

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Triagem (fila, classificação, espera, histórico) | `/triagem` | `pages/enfermagem/Triagem.tsx` + `pages/enfermagem/triagem/*` | enfermeiro |
| Início da enfermagem (segue a escala) | `/enfermagem` | `pages/enfermagem/InicioEnfermagem.tsx` | enfermeiro, técnico |
| Pronto Socorro da enfermagem | `/enfermagem/pronto-socorro` | `pages/enfermagem/ProntoSocorroEnfermagem.tsx` | enfermeiro, técnico |
| Internação da enfermagem (cuidados, passagem, leitos a liberar) | `/enfermagem/internacao` | `pages/enfermagem/InternacaoEnfermagem.tsx` (+ `GavetaCuidados`, `PassagemEnfermagem`, `LeitosParaLiberar`, `components/enfermagem/*`) | enfermeiro, técnico |
| Checagem | `/checagem` | `pages/enfermagem/Checagem.tsx` | enfermeiro, técnico |
| Retirada sem farmacêutico | `/dispensacao` | `pages/farmacia/Dispensacao.tsx` | farmacêutico, enfermeiro, técnico, gestor |
| Alta vigilância | `/alta-vigilancia` | `pages/farmacia/AltaVigilancia.tsx` | farmacêutico, enfermeiro, gestor |

### 2.4 Internação e leitos (médico)

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Plantão (início e seções) | `/plantao`, `/plantao/:secao` | `pages/plantao/PlantaoHome.tsx`, `PlantaoSectionHome.tsx` | plantonista |
| Meu plantão (check-in e check-out) | `/plantao/check-in/check-in`; `/meu-plantao` | `pages/MeuPlantao.tsx` (+ `components/checkin/*`) | plantonista; `/meu-plantao` abre para gestor e admin |
| Pacientes internados e leito aberto (caderno de 12 abas) | `/plantao/internacao/pacientes`; `/internacao` | `pages/InternacaoPainel.tsx` + `components/internacao/*` (`LeitoAberto`, `ListaInternados`, `caderno/*`) | plantonista; `/internacao` direto para gestor e admin |
| Formulário de internação (legado) | `/plantao/internacao/formulario` | `pages/plantao/Internacao.tsx` + `pages/plantao/internacao/*Tab.tsx` | plantonista |
| Evolução clínica (gráfico e flowsheet) | `/plantao/evolucao/evolucao` | `pages/plantao/EvolucaoClinica.tsx` | plantonista |

### 2.5 Observação

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Pacientes em observação | `/plantao/observacao/pacientes`; `/observacao` | `components/observacao/PainelObservacao.tsx` (plantonista); `pages/InternacaoPainel.tsx` modo observação (gestor, admin) | plantonista, gestor, admin |

### 2.6 Prontuário

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Prontuários (pedidos de acesso) | `/prontuarios` | `pages/prontuario/PedidosProntuario.tsx` | plantonista, telemedicina, enfermeiro, técnico, farmacêutico |
| Prontuário de leitura | `/prontuarios/:pacienteId` | `pages/prontuario/ProntuarioLeitura.tsx` | os mesmos + gestor |
| Pendências do PEP | `/pendencias-pep` | `pages/prontuario/PendenciasPep.tsx` | plantonista |
| Impressão de prontuário | `/impressao-prontuario` | `pages/prontuario/ImpressaoProntuario.tsx` | plantonista |

### 2.7 Farmácia

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Central do farmacêutico | `/farmacia` | `pages/farmacia/Farmacia.tsx` (+ `Diluicoes`, `PainelFarmacia`, `EnviarArquivo`) | farmacêutico |
| Dispensação | `/dispensacao` | `pages/farmacia/Dispensacao.tsx` | farmacêutico, enfermeiro, técnico, gestor |
| Alta vigilância | `/alta-vigilancia` | `pages/farmacia/AltaVigilancia.tsx` | farmacêutico, enfermeiro, gestor |
| Unidade de consumo | `/unidade-consumo` | `pages/farmacia/UnidadeConsumo.tsx` | farmacêutico, gestor |
| Interações críticas | `/interacoes` | `pages/farmacia/Interacoes.tsx` | farmacêutico, gestor, plantonista (menu só farmacêutico e gestor) |
| Farmácia do gestor | `/gestao/farmacia` | `pages/gestor/FarmaciaGestor.tsx` | gestor |

### 2.8 Regulação e NIR

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Regulação | `/regulacao` | `pages/regulacao/Regulacao.tsx` (+ `components/regulacao/*`) | plantonista, gestor, regulador, admin, nir |
| AIH | `/aih` | `pages/regulacao/Aih.tsx` | regulador, gestor |
| APAC | `/apac` | `pages/regulacao/Apac.tsx` | regulador, faturamento, gestor |
| NIR (pendências) | `/nir` | `pages/nir/Nir.tsx` | nir, gestor |
| Rede (papéis de rede) | `/rede` | `pages/rede/Rede.tsx` | secretaria, regulação regional, faturamento da rede, admin |

### 2.9 Faturamento

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| BPA | `/faturamento` | `pages/faturamento/Bpa.tsx` | faturamento, gestor |
| Contas do atendimento | `/faturamento/contas` | `pages/faturamento/Contas.tsx` | faturamento, gestor |
| Glosas | `/faturamento/glosas` | `pages/faturamento/Glosas.tsx` | faturamento, gestor |

### 2.10 Gestão

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Painel (panorama) | `/gestao` | `pages/gestor/PainelGestor.tsx` | gestor |
| Porta agora | `/gestao/porta` | `pages/gestor/PortaAgora.tsx` | gestor |
| Intercorrências | `/gestao/intercorrencias` | `pages/gestor/IntercorrenciasRelatorio.tsx` | gestor |
| Olho de Gavião | `/gestao/gaviao` | `pages/gestor/OlhoDeGaviao.tsx` | gestor |
| Exames da unidade | `/gestao/exames` | `pages/gestor/ExamesUnidade.tsx` | gestor |
| Protocolos | `/gestao/protocolos` | `pages/gestor/Protocolos.tsx` | gestor |
| Chamados técnicos | `/gestao/chamados` | `pages/gestor/ChamadosTecnicos.tsx` | gestor |
| Auditoria | `/auditoria` | `pages/gestor/Auditoria.tsx` | gestor |
| Escala (abas: escala, mês, histórico, presenças) | `/escala` | `pages/grupos/EscalaGrupo.tsx` → `pages/Escala.tsx`, `gestor/EscalaMes.tsx`, `HistoricoEscala.tsx`, `gestor/PresencasDoDia.tsx` | gestor, admin (plantonista vai para `/agenda`) |
| Unidade (abas: setores, leitos, configurações, imagens, convites, segurança…) | `/unidade` | `pages/grupos/UnidadeGrupo.tsx` → `Setores`, `Configuracao`, `gestor/MapaLeitos`, `Banners`, `Convites`… | gestor, admin |
| Indicadores | `/indicadores` | `pages/Indicadores.tsx` (+ `gestor/Espera*`, `EvasaoIndicador`, `PacientesPorCor`, `FiltrosBI`, `PanoramaConfig`) | gestor, admin |
| Revisão clínica | `/revisao-clinica` | `pages/RevisaoClinica.tsx` | qualquer autenticado; menu do gestor e do responsável técnico |
| Integrações (API), Exportar dados, Implantação | `/integracoes`, `/exportar`, `/implantacao` | `pages/admin/Integracoes.tsx`, `gestor/ExportarDados.tsx`, `gestor/Implantacao.tsx` | admin, gestor |

### 2.11 Administração

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Rede da organização (abas, pessoas) | `/painel` | `pages/grupos/OrganizacaoGrupo.tsx` → `Pessoas`, `admin/RedeCompleta`, `admin/NumerosOrganizacao` | admin |
| Olho de Gavião (admin) | `/gaviao` | `pages/admin/GaviaoPainel.tsx` | admin |
| Plataformas, Pendências técnicas, Servidores | `/plataformas`, `/pendencias-tecnicas`, `/servidores` | `pages/admin/*` | admin |
| Erros e alertas | `/erros-e-alertas` | `pages/admin/ErrosEAlertas.tsx` | super admin |

### 2.12 Ferramentas clínicas e telemedicina

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Central do Plantonista | `/plantonista` | `pages/plantonista/PlantonistaHome.tsx` (+ `components/plantonista/*`) | plantonista, gestor, admin |
| Seção da Central (calculadoras, pediatria, emergências, escores, protocolos, farmácia, dengue, ventilação) | `/plantonista/:section` | `pages/plantonista/SectionHome.tsx` | plantonista, gestor, admin |
| Ferramenta | `/plantonista/:section/:tool` | `pages/plantonista/ToolRouter.tsx` → 151 arquivos em `pages/plantonista/**` | plantonista, gestor, admin |
| Telemedicina (fila, salas, agenda, telemonitoramento, assinaturas, histórico, credenciais) | `/teleinterconsulta`, `/telemedicina/:tela` | `pages/telemedicina/*` | telemedicina |

### 2.13 Outros

| Tela | Rota | Arquivo | Papéis |
|---|---|---|---|
| Casca: lateral, topo, faixa do papel, paleta, chat, saída | todas | `components/AppShell.tsx`, `components/casca/*`, `components/chat/*` | todos |
| Login, Cadastro, Recuperar senha, segundo fator | `/login`, `/cadastro`, `/recuperar-senha` | `pages/Login.tsx`, `Cadastro.tsx`, `RecuperarSenha.tsx`, `entrada/LadoMarca.tsx`, `components/seguranca/*` | público |
| Página inicial pública | sem sessão | `pages/landing/Landing.tsx` (via `routes/RequireAuth.tsx`) | visitante |
| Aguardando liberação, Seletor de unidade, Papel em preparo | `/aguardando`, `/seletor`, `/em-preparo` | `pages/*` | autenticado |
| Minha agenda (escala, vagas, extrato) | `/agenda` | `pages/grupos/AgendaGrupo.tsx` → `MinhaAgenda`, `Vagas`, `Extrato` | plantonista, gestor, admin |
| Perfil, Avisos, Preferências de prescrição | `/perfil`, `/notificacoes`, `/preferencias-prescricao` | `pages/*` | autenticado / vários / plantonista |
| Pacote de alta do paciente | `/alta/:token` | `pages/public/PacoteAlta.tsx` | público, por token |
| Link de receita | `/r/:tipo/:token` | `pages/public/LinkReceita.tsx` | público (esboço) |

Rotas legadas que só redirecionam: `/pessoas`, `/setores`, `/configuracao`, `/banners`, `/historico-escala`, `/minha-agenda`, `/vagas`, `/extrato`, `/prescricao-teste`, `/referencia-diluicao`, `/mensagens`.

### 2.14 Menus por papel (`navegacao.ts`)

| Papel | Itens | Observação |
|---|---|---|
| plantonista | 11 + Regulação | Central, Plantão, Contingência, Atendimento, Telemedicina, Pareceres, Notificação compulsória, Farmácia, Minha Agenda, Avisos, Prontuários |
| enfermeiro | 10 | Triagem primeiro |
| técnico de enfermagem | 6 | sem Triagem e Notificações |
| recepção | 5 | — |
| farmacêutico | 6 | — |
| telemedicina | 8 | — |
| regulador | 2 + Regulação | — |
| faturamento | 4 | — |
| nir | 3 | — |
| secretaria / regulação regional / faturamento da rede | 2 / 2 / 1 | — |
| gestor | **26 + 4** | Integrações, Exportar, Implantação, Regulação. É o maior menu e não tem grupos. |
| admin | 6 (+6 do super admin) | — |

O mesmo destino aparece com **nomes diferentes** conforme o papel: `/notificacao-compulsoria` é "Notificação compulsória" (plantonista) e "Notificações" (enfermeiro); `/dispensacao` é "Dispensação" e "Retirada sem farmacêutico"; `/faturamento` é "Faturamento (BPA)" e "BPA"; `/agenda` é "Minha Agenda" e, na telemedicina, `/telemedicina/agenda` é "Minha agenda".

---

## 3. Divergências do padrão

Contagem total e por arquivo. "Fora de `ui/`" exclui `src/components/ui`, que é onde a base mora.

### Quadro geral

| Tipo | Ocorrências | Arquivos |
|---|---:|---:|
| 3.1 Paleta crua do Tailwind (`text-red-*`, `bg-amber-*`…) | 2 | 2 |
| 3.2 Cor arbitrária em classe (`bg-[#…]`, `bg-[rgba(…)]`) | 115 | 31 |
| ↳ das quais lavagens Tailwind-50 (`#FEF2F2`, `#FFFBEB`…) | 36 | 15 |
| 3.3 Branco e preto crus (`bg-white`, `text-black`, `bg-black`, `border-white`) | 38 | — |
| 3.4 Hex e rgb fora de classe (em `style`, HTML montado, gráficos) | 60 em linhas com `style` + 23 em gráficos | 10 + 2 |
| 3.5 Texto fora da escala (`text-xs`…`text-2xl`) | 1.161 | 170 |
| ↳ tamanho arbitrário (`text-[11px]`…) | 119 | 45 |
| ↳ abaixo do piso de 12 px (`text-[9px]`, `[10px]`, `[11px]`) | 43 | — |
| ↳ peso acima de 600 (`font-bold`, `font-black`) | 10 | 7 |
| 3.6 Raio com nome do Tailwind (`rounded-lg`, `-md`…) | 365 | 150 |
| ↳ raio arbitrário (`rounded-[8px]`…) | 60 | 30 |
| ↳ sombra do Tailwind (`shadow-sm/md/lg`) | 10 | 5 |
| 3.7 Espaçamento arbitrário (`p-[7px]`, `gap-[13px]`…) | 599 | 118 |
| 3.8 `<button>` feito à mão | 261 | 128 |
| 3.9 `<select>` nativo | 88 | 36 |
| ↳ constante de classe copiada (`SELECT`, `selectCls`) | 14 cópias | 14 |
| ↳ `<input>` nativo (inclui checkbox) / `<textarea>` nativo | 106 / 9 | 73 / 5 |
| 3.10 `<table>` montada à mão | 64 | 53 |
| 3.11 Erro: `<p>` de erro sem `role="alert"` | 117 | 73 |
| ↳ `<Erro>` importado de `pages/farmacia/Farmacia` | 10 arquivos | — |
| ↳ ajudantes locais para tirar o texto do erro | 12 cópias | 12 |
| 3.12 Componentes duplicados (Chip, Abas, Cartao, Campo, Secao, Bloco, Aviso…) | 49 definições locais | — |
| 3.13 Formatadores de data e hora locais | 127 | 81 |
| ↳ formatador de moeda local | 4 + 1 em `lib` | 5 |
| 3.14 Estado vazio em texto solto ("Nenhum…", "Sem…") | 171 | ~116 |
| ↳ "Carregando…" em texto solto | 21 | 11 |
| 3.15 Título de página feito à mão (h1 com classe) | 26 | 26 |
| ↳ h2 de seção feito à mão | 41 | 31 |
| 3.16 Importação cruzada (componente → página, área → área) | 58 | — |
| 3.17 Emoji pictográfico | 17 | 4 |

### 3.1 Paleta crua do Tailwind — 2 ocorrências, 2 arquivos

Expressão: `(text|bg|border|ring|fill|stroke|from|to|via|outline|divide|…)-(slate|gray|zinc|…|rose)-NNN`.

- `src/pages/Escala.tsx:1945` — `border-r-amber-200`
- `src/pages/public/PainelChamada.tsx:209` — `text-amber-200` (texto de erro no painel da TV)

Correção: `border-atencao/30`; no painel da TV, um token claro para fundo escuro (pergunta 20).

### 3.2 Cor arbitrária em classe — 115 ocorrências, 31 arquivos (113 em 29 fora de `ui/`)

Expressão: `qualquer-classe-[#hex | rgb(…) | rgba(…) | hsl(…)]`. Os arquivos com mais: `pages/Cadastro.tsx` (33), `pages/public/PainelChamada.tsx` (23), `pages/entrada/LadoMarca.tsx` (6), `pages/recepcao/Recepcao.tsx` (5).

Exemplos:

- `src/pages/recepcao/Recepcao.tsx:550` — `border-[#FDE68A] bg-[#FFFBEB]` (caixa de aviso amarela). O mesmo par aparece em 11 arquivos, entre eles `triagem/Classificar.tsx:474`, `atendimento/AtestadoMedico.tsx:300`, `atendimento/PedidoExames.tsx:296`, `plantao/shared/DadosPaciente.tsx:548`, `documentos/ui.tsx:166`.
- `src/components/casca/MenuUsuario.tsx:149` — `hover:bg-[#FEF2F2]`
- `src/components/casca/Saida.tsx:69` — `hover:bg-[#0B5D57]` (botão primário desenhado à mão)
- `src/components/chat/ChatFab.tsx:24` — `bg-[#B45309]` (é o valor de `observacao`)
- `src/components/porta/Chamada.tsx:233` — `hover:bg-[#991B1B]`
- `src/components/ui/dialog.tsx:29`, `ui/gaveta.tsx:28`, `casca/Saida.tsx:42` — `bg-[rgba(15,23,42,0.42)]` (o mesmo véu em 3 lugares)

Correção: lavagens viram `bg-alerta-atencao` / `bg-alerta-critico` dentro de um componente de aviso (pergunta 3); `#B45309` vira `bg-observacao`; hovers de botão saem com o próprio `Button`; o véu vira token (`--color-veu-dialogo`).

### 3.3 Branco e preto crus — 38 ocorrências

`bg-white` 31, `text-black` 4, `bg-black` 2, `border-white` 1. `text-white` (127) sobre fundo cheio de ação ou estado é aceito, porque o próprio `Button` usa.

- `src/pages/Escala.tsx:893` — `rounded-2xl bg-white text-xl font-semibold text-black`
- `src/pages/Escala.tsx:952` — `bg-white p-4`
- `src/pages/PrescricaoTeste.tsx:198` — `rounded-lg border bg-white shadow-lg`

Correção: `bg-superficie`, `text-tinta`.

### 3.4 Hex e rgb fora de classe — 60 em `style` e HTML montado (10 arquivos), 23 em gráficos (2 arquivos)

Os 89 hex de `src/index.css` são a definição dos tokens, e os 61 hex soltos de `src/lib/folhas.ts` são o CSS da folha impressa: ficam fora da conta. As 60 ocorrências em linhas com `style` incluem 6 da folha e 7 de `src/lib/prontuario.ts`. Exemplos:

- `src/pages/plantao/internacao/ExportarTab.tsx:103` — `background:#dc2626` com "⚠️ ALERGIA" (folha do formulário legado; 20 hex no arquivo)
- `src/pages/plantao/internacao/EvolucaoTab.tsx:88` — o mesmo bloco de alergia
- `src/lib/prontuario.ts:164` e `src/pages/plantao/internacao/FichaAdmissao.tsx:141` — mensagem de falha escrita na janela de impressão com `color:#B91C1C`
- `src/components/avaliacao/CurvaCrescimento.tsx:13`, `:58`, `:60` — cores do gráfico (`#B91C1C`, `#F1F5F9`, `#64748B`)
- `src/components/observacao/GraficoEvolucao.tsx:91` — `fill="rgba(13,148,136,0.08)"`
- `src/pages/landing/Landing.tsx` — 13 hex em `style={{}}` (página pública, desenho próprio)

Correção: gráficos leem `var(--color-critico)` etc.; as mensagens da janela de impressão passam por um ajudante único em `lib/prontuario.ts`; o legado do formulário de internação sai (pergunta 19).

### 3.5 Texto fora da escala — 1.161 ocorrências em 170 arquivos, mais 119 arbitrárias em 45

Distribuição: `text-sm` 582, `text-xs` 400, `text-base` 159, `text-lg` 9, `text-xl` 8, `text-2xl` 3. Arbitrárias: `text-[11px]` 26, `text-[12px]` 16, `text-[15px]` 15, `text-[10px]` 14, `text-[26px]` 10, `text-[22px]` 7, outras 31. Os tokens da escala aparecem 2.280 vezes (`text-apoio` 1.245, `text-rotulo` 562, `text-corpo` 203, `text-controle` 177, …).

Arquivos com mais: `pages/Escala.tsx` (94), `faturamento/Bpa.tsx` (32), `plantonista/dengue/ClassificacaoDengue.tsx` (31), `gestor/Auditoria.tsx` (30), `components/prescricao/PrescricaoEstruturada.tsx` (25).

- `src/pages/enfermagem/Checagem.tsx:105` — `text-sm` na mensagem de erro; `:113` — `CardTitle className="text-base"`
- `src/components/internacao/caderno/Sepse.tsx:30` — `text-sm`; `:57` — `text-2xl` no escore
- `src/components/internacao/caderno/Acuidade.tsx:106` — `text-[12px] … uppercase` (é o `.rotulo`); `:113` — `text-[30px]` (é `text-numeral-ok`)
- `src/components/casca/Topo.tsx:158` — `text-[11px]` (abaixo do piso)
- `src/components/documentos/ui.tsx:36` — `font-bold`

Correção (mapa proposto): `text-xs`→`text-rotulo`; `text-sm`→`text-apoio` (texto) ou `text-controle` (campo, item de menu); `text-base`→`text-corpo`; `text-lg`→`text-secao`; `text-xl`→`text-dialogo`; `text-2xl`→`text-titulo`; `text-[12px]`→`text-rotulo`; `text-[15px]`→`text-corpo`; `text-[30px]`→`text-numeral-ok`; `font-bold`→`font-semibold`. Exceções a decidir: painel da TV (usa `vh`), folha impressa, eixos de gráfico.

### 3.6 Raio e sombra — 365 raios com nome do Tailwind (150 arquivos), 60 arbitrários (30), 10 sombras (5)

`rounded-lg` 211, `rounded-md` 95, `rounded-full` 26, `rounded-xl` 17, `rounded-2xl` 9, `rounded-sm` 5. Os tokens do projeto aparecem 688 vezes. O `@theme` já mapeia `rounded-lg` para 10 px e `rounded-md` para 9 px, então o desenho quase não muda: a divergência é de vocabulário.

- `src/components/internacao/LeitoAberto.tsx:240` — `rounded-lg` na caixa de erro
- `src/components/internacao/caderno/Documentos.tsx:37` — `rounded-md` num select
- `src/components/casca/Topo.tsx:194` — `rounded-[8px]` (fora da escala)
- `src/components/internacao/caderno/Diagnostico.tsx:141` — `rounded-[10px]` (é `rounded-controle`)
- `src/components/encaminhamento/AbaEncaminhamentoInterno.tsx:114` — `shadow-lg` numa lista suspensa

Correção: `lg`→`controle`, `md`/`sm`→`controle-sm`, `xl`→`container`, `2xl`→`cartao`, `full`→`capsula`; `shadow-lg` de menu→`shadow-popover`.

### 3.7 Espaçamento arbitrário — 599 ocorrências, 118 arquivos

Valores mais usados: `[7px]` 102, `[5px]` 73, `[13px]` 71, `[3px]` 67, `[11px]` 61, `[18px]` 59, `[22px]` 57, `[9px]` 50. É o ritmo do protótipo, de propósito (por exemplo `mb-[22px]` no próprio `TituloPagina`). Não conto como erro: o guia precisa decidir se vira token (pergunta 13).

### 3.8 Botões feitos à mão — 261 `<button>` em 128 arquivos

Expressão: `<button\b`. Para comparar, `<Button>` aparece 818 vezes. Classificação pelos atributos:

| Uso | Quantidade | Destino sugerido |
|---|---:|---|
| Chip ou alternador (`aria-pressed`, `aria-checked`) | 65 | `Chip` de `monitor/Pagina.tsx` |
| Ícone (`aria-label`, `size-*`) | 23 | `Button size="icon*" variant="ghost"` |
| Linha clicável (`w-full`, `text-left`) | 14 | componente novo `BotaoLinha` |
| Estilizado como botão comum (`bg-acao`, `border-fio`, `px-*`) | 17 | `Button` |
| Abre e fecha (`aria-expanded`) | 9 | `Button variant="ghost"` ou `Dobra` |
| Aba (`role="tab"`) | 8 | `ui/tabs` ou `TabsPagina` |
| Outros | 125 | revisar um a um |

Exemplos: `src/components/casca/Saida.tsx:66`, `src/components/casca/Topo.tsx:190`, `src/components/chat/Thread.tsx:210` (botão primário redesenhado), `src/pages/plantao/porta/AbaDesfecho.tsx:35` e `AbaAtestadoReceita.tsx:45` (Chip local), `src/pages/admin/ui.tsx:42` (aba local). Arquivos com mais: `pages/Escala.tsx` (14), `components/seguranca/SegundoFator.tsx` (7), `casca/MenuUsuario.tsx` (6), `gestor/PanoramaConfig.tsx` (6).

### 3.9 Campos nativos — 88 `<select>` em 36 arquivos

A mesma classe está copiada em 14 constantes:

- `const SELECT = 'h-8 rounded-controle border border-fio bg-campo px-2'` em `components/regulacao/DestinoRegulacao.tsx:30`, `IndicadoresRegulacao.tsx:30`, `MapaVagas.tsx:33`, `SlaRegulacao.tsx:34`, `pages/rede/Rede.tsx:38`, `pages/regulacao/Regulacao.tsx:100`; e outra versão em `pages/recepcao/CamposCadastro.tsx:66`.
- `const selectCls = 'h-9 … text-apoio'` em `faturamento/Bpa.tsx:45`, `Contas.tsx:44`, `Glosas.tsx:39`, `regulacao/Apac.tsx:35`, `components/apac/SolicitarApac.tsx:19`; e `h-8` em `farmacia/UnidadeConsumo.tsx:22`, `components/paciente/ProcedimentosRealizados.tsx:19`.

Fora das constantes há mais 12 combinações escritas em linha, com alturas `h-8`/`h-9` e textos `text-xs`/`text-sm`/`text-controle`/`text-apoio` (por exemplo `pages/enfermagem/Checagem.tsx:235`, `pages/plantao/porta/AbaDesfecho.tsx:249`). O `Select` de `ui/` está em 14 arquivos. `pages/regulacao/Regulacao.tsx` sozinho tem 23 selects.

`<input>` nativo: 106 em 73 arquivos (parte é checkbox, que não tem componente); `<textarea>` nativo: 9 em 5.

Correção: um `CampoSelecao` (select nativo com a classe única) em `ui/`, porque o nativo funciona melhor no celular; e um `Caixa` (checkbox desenhado). Decisão na pergunta 8.

### 3.10 Tabelas montadas à mão — 64 `<table>` em 53 arquivos `.tsx`

O `Table` de `ui/` é usado em 1 arquivo (`pages/Pessoas.tsx`). As outras tabelas variam:

- `<thead>` com 6 combinações (`text-tinta-sussurro` 25; sem classe 14; `border-b border-fio text-left text-rotulo` 12; …).
- `<th>` com pelo menos 12 combinações (`pr-3 pb-2` 52; `px-3 py-2 font-medium` 38; `font-medium` 18; `font-normal` 17; …).
- Corpo em `text-sm` (`pages/Escala.tsx:1777`, `components/observacao/PainelObservacoes.tsx:46`), `text-apoio` (`faturamento/Contas.tsx:98`), `text-xs` (`plantonista/manual/AcidoBase.tsx:91`) ou sem tamanho (`pages/rede/Rede.tsx:190`).

36 das 64 estão nas ferramentas clínicas (tabelas de dose e de referência). Correção: ajustar `ui/table.tsx` ao desenho do protótipo (cabeçalho 12px/600 caixa alta, `tinta-sussurro` sobre `campo`; seção 3.18 do design system) e usar em todas.

### 3.11 Mensagens de erro — 5 jeitos de mostrar

| Jeito | Onde | Quantidade |
|---|---|---:|
| `<p role="alert" className="… text-critico">` escrito na tela | 100 arquivos | 175 `role="alert"`, 157 com `text-critico` |
| `<p className="… text-critico">{erro}</p>` **sem** `role="alert"` (leitor de tela não anuncia) | 73 arquivos | 117 |
| `<Erro>` exportado por `pages/farmacia/Farmacia.tsx:32` | 10 páginas de outras áreas + Telemedicina com o seu (`telemedicina/Telemedicina.tsx:61`) | 57 usos em 14 arquivos |
| `Aviso` de `components/enfermagem/pecas.tsx:28` (e cópia em `avaliacao/AbaAvaliacaoCrescimento.tsx:58`) | enfermagem, avaliação | 10 usos |
| `Mensagem` de `components/evolucao/pecas.tsx:73`; `Aviso tom="critico"` de `documentos/ui.tsx:161` | evolução, documentos | 6 + 6 |

A caixa de erro usa **6 lavagens**: `bg-alerta-critico` 51, `bg-critico/[0.08]` 30, `bg-critico/10` 18, `bg-critico/[0.06]` 9, `/[0.05]`, `/[0.04]`, `/5`, `/15` (6). E 2 cores de texto além do token (`text-[#7F1D1D]` em `pages/Cadastro.tsx:795`).

Na mesma tela convivem jeitos diferentes. Na janela do atendimento: `AbaAtendimento.tsx:135` (linha sem `role`), `AbaExames.tsx:180` (linha com borda, sem `role`), `AbaAtestadoReceita.tsx:130` e `AbaDesfecho.tsx:344` (caixa com `role="alert"`).

Texto: "Erro ao …" 12 vezes em 8 arquivos (`pages/Escala.tsx:749`, `plantao/internacao/EvolucaoTab.tsx:140`, `components/observacao/PainelObservacoes.tsx:36`), "Falha ao …" 10 (`gestor/PainelGestor.tsx:58`, `gestor/OlhoDeGaviao.tsx:182`), "Não foi possível …" 33. Algumas mostram a mensagem crua do banco depois de "Erro ao salvar: " (`EvolucaoTab.tsx:140`).

O texto do erro é extraído por **12 cópias do mesmo ajudante** (`msg`, `mensagemErro`, `erroTexto`, `mensagem`): `components/avaliacao/useAvaliacao.ts:33`, `encaminhamento/useEncaminhamentos.ts:64`, `enfermagem/dadosCuidados.ts:87`, `evolucao/dados.ts:283`, `internacao/caderno/comum.ts:110`, `paciente/AlergiasEventos.tsx:34`, `paciente/Isolamento.tsx:31`, `parecer/comum.ts:45`, `termo/termo.ts:116`, `pages/gestor/Protocolos.tsx:38`, `pages/plantao/porta/comum.ts:34`, `pages/PreferenciasPrescricao.tsx:45`.

Correção: um `MensagemErro` em `ui/` com dois formatos (linha sob o campo, caixa para falha de ação ou de carga), sempre `role="alert"`, lavagem `bg-alerta-critico`; um ajudante `textoDoErro` em `lib/`. Pergunta 4.

### 3.12 Componentes duplicados — 49 definições locais

| Peça | Definições | Onde |
|---|---:|---|
| `Chip` | 6 (+ `ChipEscolha`) | `monitor/Pagina.tsx:57` (o oficial), `documentos/ui.tsx:111`, `internacao/caderno/caixas.tsx:40`, `paciente/AlergiasEventos.tsx:118`, `plantao/porta/AbaAtestadoReceita.tsx:45`, `plantao/porta/AbaDesfecho.tsx:35`, `evolucao/pecas.tsx:44` |
| `Abas` | 3 (+ `TabsPagina` + `ui/tabs`) | `pages/admin/ui.tsx:34`, `pages/Cadastro.tsx:211`, `pages/farmacia/Farmacia.tsx:37` |
| `Cartao` | 5 (+ `ui/card`) | `avaliacao/AbaAvaliacaoCrescimento.tsx:55`, `documentos/ui.tsx:13`, `enfermagem/pecas.tsx:7`, `gestor/OlhoDeGaviao.tsx:58`, `telemedicina/comum.tsx:65`; e a constante `cartao` em `admin/ui.tsx:9` |
| `Campo` | 7 | `documentos/ui.tsx:60`, `enfermagem/pecas.tsx:21`, `termo/AbaTermoConsentimento.tsx:75`, `pages/Cadastro.tsx:83`, `prontuario/ImpressaoProntuario.tsx:526`, `recepcao/CamposCadastro.tsx:19`, `regulacao/Regulacao.tsx:223` |
| `Secao` | 6 (+ `TituloSecao`) | `chat/ListaConversas.tsx:72`, `internacao/caderno/caixas.tsx:7`, `regulacao/IndicadoresRegulacao.tsx:176`, `triagem/Classificar.tsx:57`, `manual/CadEhhTratamento.tsx:16`, `telemedicina/comum.tsx:165` |
| `Bloco` | 9 | `documentos/ui.tsx:30`, `evolucao/pecas.tsx:9`, `termo/AbaTermoConsentimento.tsx:513`, `enfermagem/Pecas.tsx:11`, `plantao/porta/FilaPS.tsx:43`, `manual/LoteAPecas.tsx:40`, `manual/PecasLoteC.tsx:23`, `pediatria/PecasIcr.tsx:55`, `pediatria/PecasP2.tsx:75` |
| `Aviso` | 5 | `avaliacao/AbaAvaliacaoCrescimento.tsx:58`, `documentos/ui.tsx:161`, `enfermagem/pecas.tsx:28`, `termo/AbaTermoConsentimento.tsx:84`, `pediatria/PecasP4.tsx:144` |
| `Vazio` | 3 (+ `VazioLinha`) | `monitor/Pagina.tsx:83` (o oficial), `chat/ListaConversas.tsx:81`, `prontuario/PendenciasPep.tsx:49`; `telemedicina/comum.tsx:186` |
| `Nota` | 3 | `enfermagem/pecas.tsx:45`, `pediatria/PecasIcr.tsx:95`, `telemedicina/comum.tsx:177` |
| `Erro` | 2 | `farmacia/Farmacia.tsx:32`, `telemedicina/Telemedicina.tsx:61` |

Correção: `Campo`, `Aviso` (com tom), `TituloCartao`/`Cartao` com cabeçalho, `Vazio` com variante de linha e `Abas` passam a existir uma vez só, em `src/components/ui` ou `monitor`. Os `Bloco` das ferramentas clínicas podem virar uma peça só da Central.

### 3.13 Formatadores de data, hora e moeda — 127 definições locais em 81 arquivos

Expressão: função ou `const` cujo corpo (até 4 linhas) chama `toLocaleTimeString`, `toLocaleDateString`, `toLocaleString` com `hour`/`day`/`dateStyle`/`timeStyle`, ou `Intl.DateTimeFormat`. Contando também `src/lib` e `src/domain` são 133, em 88 arquivos. `src/lib/datas.ts` já tem `fmtDataHora` e `fmtData`, importados por 39 arquivos.

Nomes repetidos: `hora` 21, `quando` 17, `hoje` 9, `hojeSP` 7, `dia` 6, `diaHora` 5, `hhmm` 4, `fmtDia` 4, `fmtHora` 3, `diasAtras` 3.

- `src/pages/farmacia/Farmacia.tsx:28` — `const hora = (iso) => … toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', … })` (é `fmtDataHora`)
- `src/pages/enfermagem/Checagem.tsx:45` e `src/components/prescricao/PrescricaoEstruturada.tsx:60` — mesma função, mesmo nome
- `src/lib/regulacao.ts:325` — `hora` **sem fuso** (`toLocaleTimeString('pt-BR', { hour, minute })`), diferente das outras, que fixam `America/Sao_Paulo`
- `src/pages/plantao/porta/comum.ts:31`, `src/pages/enfermagem/triagem/comum.ts:32`, `src/pages/enfermagem/useEnfermagem.ts:33` — três `hora` exportados, um por área

Moeda: `brl` em `pages/Configuracao.tsx:125`, `pages/Extrato.tsx:27`, `pages/Vagas.tsx:33`, `pages/telemedicina/Telemedicina.tsx:35`, além de `reais` em `lib/contas.ts:110`.

Correção: um `src/lib/formato.ts` com `hora`, `dataHora`, `data`, `quando` (relativo), `moeda`, `numero`, todos no fuso da unidade.

### 3.14 Estados vazio e carregando

- `<Vazio>`: 60 usos em 44 arquivos.
- Texto vazio solto ("Nenhum…", "Nenhuma…", "Sem …" como conteúdo de elemento): 171 trechos fora de `lib/folhas.ts`. Exemplos: `src/components/internacao/caderno/Documentos.tsx:101` ("Nenhum atestado emitido para este paciente."), `src/pages/Escala.tsx:1598` (`text-sm`), `src/pages/prontuario/PedidosProntuario.tsx:201` ("Nenhum pedido.", `text-sm`), `src/pages/Notificacoes.tsx:144` (div com `py-[26px]`). Boa parte é vazio de linha dentro de uma seção, onde o `Vazio` em bloco é grande demais. Falta a variante de linha (a telemedicina criou a sua, `VazioLinha`).
- `<Spinner>`: 260 usos em 132 arquivos (234 sem parâmetro, 17 com `size-4`, 5 com `size-3.5`). Só 4 têm rótulo próprio.
- "Carregando…" em texto solto: 21 em 11 arquivos (9 são o estado da faixa de parâmetros, `casca/FaixaDoPapel.tsx`, e estão certos). Exemplos fora disso: `pages/farmacia/Farmacia.tsx:134`, `pages/enfermagem/triagem/Espera.tsx:27`, `components/documento/BarraDocumento.tsx:221`.
- `<Skeleton>`: 1 uso.

Correção: `Vazio` com `variante="linha"`; um `Carregando` (spinner centralizado com rótulo do que carrega). Pergunta 5 e 6.

### 3.15 Títulos feitos à mão

- `TituloPagina` está em 57 arquivos. 18 lugares **copiam** a classe dele num `<h1>` próprio (`text-titulo leading-[1.1] font-semibold tracking-[-0.02em]`), sem o azulejo do ícone: `components/TabsPagina.tsx:64`, `components/plantonista/ToolLayout.tsx:42`, `pages/InternacaoPainel.tsx:184`, `pages/MeuPlantao.tsx:148`, `pages/Perfil.tsx:205`, `pages/Escala.tsx:811`, `pages/plantao/Internacao.tsx:107`, `pages/plantao/EvolucaoClinica.tsx:154`, `pages/Configuracao.tsx:148`…
- 5 títulos de página usam outra escala: `text-xl` em `pages/Pessoas.tsx:132`, `pages/Setores.tsx:177`, `pages/gestor/Banners.tsx:156`, `pages/admin/GaviaoPainel.tsx:97`, `components/ErroBoundary.tsx:43`.
- `h2` à mão: 41 em 31 arquivos (sem contar entrada e landing). Dois tamanhos convivem para o mesmo papel: `text-corpo font-semibold` (15 px, em 20 h2, como título de cartão) e `text-secao font-semibold` (17 px, em 21 lugares, como título de seção). `pages/gestor/OlhoDeGaviao.tsx:229` usa `text-[18px]`. `TituloSecao` está em 16 arquivos.

Correção: `TabsPagina` e `ToolLayout` passam a renderizar `TituloPagina`; um `TituloCartao` (15px/600) junto do `TituloSecao` (17px/600).

### 3.16 Importações cruzadas — 58

Uma página importar de outra página indica peça que deveria morar em `src/components` ou `src/lib`.

- **Componente importando página (19)**: `components/AppShell.tsx:21` → `pages/plantonista/ForaDoExpediente`; `components/casca/FaixaDoPapel.tsx:8` → `pages/gestor/limites`; `components/documentos/SeletorPaciente.tsx:15-19` → `pages/recepcao/CamposCadastro`, `cadastroForm`, `pages/plantao/shared/*`; `components/internacao/caderno/Documentos.tsx:13-18` → quatro abas de `pages/plantao/internacao/*`; `contexts/AuthContext.tsx:4` → `pages/plantao/shared/rascunho`.
- **Uma área de página importando outra (39)**: `pages/faturamento/Bpa.tsx:39` → `import { Abas, Erro } from '@/pages/farmacia/Farmacia'` (o mesmo em `Contas`, `Glosas`, `regulacao/Aih`, `Apac`, `Regulacao`, `gestor/ExamesUnidade`, `ExportarDados`, `Implantacao`, `admin/Integracoes`); `pages/gestor/ChamadosTecnicos.tsx:17` → `pages/admin/ui`; `pages/plantao/porta/AbaAtestadoReceita.tsx:26` → `pages/recepcao/cadastroForm`; `pages/Indicadores.tsx:13-20` → 8 módulos de `pages/gestor`.

Correção: `Erro` e `Abas` vão para `ui/`; `cadastroForm` e `CamposCadastro` para `components/paciente`; `plantao/shared/rascunho` e `gestor/limites` para `lib/`; `admin/ui` para `components/monitor`.

### 3.17 Textos

- **Maiúsculas.** Títulos e menus misturam caixa de título e caixa de frase. Em caixa de título (17): "Central do Plantonista", "Minha Agenda", "Revisão Clínica", "Meu Plantão", "Pacientes em Observação", "Configurações da Unidade", "Histórico da Escala", "Extrato Financeiro", "Vagas de Plantão", "Referência de Diluição", "Consulta de Medicamentos", "Setores e Leitos", "Meu Perfil"; no registro do Plantão também "Receituário Médico", "Atestado Médico", "Pedido de Exames", "Pacientes Internados", "Formulário de Internação", "Evolução Clínica". Em caixa de frase (33): "Alta vigilância", "Cadastros duplicados", "Exames da unidade", "Contas do atendimento", "Imagens da unidade", "Minha agenda" (telemedicina), "Impressão de prontuário". O mesmo destino troca de caixa conforme o papel ("Minha Agenda" × "Minha agenda").
- **Tom do erro.** "Erro ao …" (12), "Falha ao …" (10) e "Não foi possível …" (33) convivem. Não há "Erro:" na tela.
- **Reticências.** Consistente: 171 "…" contra 2 "..." (`lib/reportarErro.ts`, `plantao/shared/DadosPaciente.tsx`).
- **Emoji pictográfico: 17 em 4 arquivos.** `pages/plantao/Internacao.tsx:141-146` (💊 📋 📝 🩸 🏥 📥 nos rótulos das abas), `pages/plantao/internacao/ExportarTab.tsx:103`, `:130`, `:206-208`, `:229`, `EvolucaoTab.tsx:88` (⚠️ na folha), `components/regulacao/AnexosRegulacao.tsx:116` (📄). Símbolos tipográficos (✓ ✕ ○ ● ⚠) aparecem 27 vezes em 12 arquivos, em listas de critério e na folha impressa.
- **Pronto Socorro.** A tela escreve "Pronto Socorro" (21 vezes); os comentários escrevem "Pronto-Socorro". A grafia oficial é com hífen.

---

## 4. Divergências por tela

Colunas: **Cor** (3.1 a 3.4: paleta crua, cor arbitrária, `bg-white`/`text-black`, hex em `style`); **Texto** (3.5: `text-xs`…`2xl` e `text-[Npx]`); **Botão** (3.8); **Campo** (3.9: `select`, `textarea` e `input` nativos, sem checkbox, radio, file, hidden, range); **Tabela** (3.10); **Erro** (3.11: `<p>` de erro sem `role="alert"`); **Título** (3.15: `h1`/`h2` com classe à mão); **Data** (3.13: formatador local). A soma vem dos arquivos que compõem a tela (coluna "Arq."). Peças compartilhadas do leito (`components/internacao`, `evolucao`, `prescricao`, `paciente`, `clinico`…) entram uma vez, na linha "Pacientes internados e leito aberto".

**Prioridade:** alta = tela de uso diário no plantão; média = uso frequente fora da beira do leito; baixa = gestão, administração e uso eventual.

| Área | Tela | Arq. | Cor | Texto | Botão | Campo | Tabela | Erro | Título | Data | **Total** | Prioridade |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Porta | Recepção (ficha e filas) | 7 | 7 | 5 | 5 | 4 | 0 | 4 | 2 | 3 | **30** | alta |
| Porta | Painel de chamada (TV) | 1 | 26 | 0 | 2 | 0 | 0 | 0 | 0 | 1 | **29** | alta |
| Porta | Cadastros duplicados | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | **1** | média |
| Atendimento PS | Atendimento médico (fila e janela) | 10 | 0 | 0 | 7 | 3 | 0 | 12 | 0 | 2 | **24** | alta |
| Atendimento PS | Documentos da porta | 17 | 10 | 1 | 15 | 1 | 0 | 1 | 5 | 2 | **35** | alta |
| Atendimento PS | Pareceres | 3 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | 0 | **3** | alta |
| Atendimento PS | Notificação compulsória | 3 | 0 | 0 | 3 | 0 | 0 | 2 | 4 | 5 | **14** | média |
| Atendimento PS | Contingência | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | média |
| Triagem e enfermagem | Triagem | 9 | 4 | 3 | 4 | 0 | 1 | 0 | 4 | 2 | **18** | alta |
| Triagem e enfermagem | Pronto Socorro da enfermagem | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | **1** | alta |
| Triagem e enfermagem | Internação da enfermagem | 14 | 0 | 0 | 3 | 3 | 0 | 4 | 1 | 7 | **18** | alta |
| Triagem e enfermagem | Checagem | 1 | 0 | 14 | 0 | 1 | 0 | 1 | 0 | 1 | **17** | alta |
| Internação e leitos | Pacientes internados e leito aberto | 56 | 1 | 124 | 39 | 19 | 1 | 18 | 1 | 22 | **225** | alta |
| Internação e leitos | Plantão (início, seções) e Meu plantão | 6 | 1 | 12 | 5 | 0 | 0 | 0 | 2 | 2 | **22** | alta |
| Internação e leitos | Formulário de internação (legado) | 13 | 5 | 38 | 5 | 0 | 1 | 3 | 1 | 3 | **56** | média |
| Internação e leitos | Evolução clínica (gráfico) | 1 | 0 | 12 | 1 | 0 | 0 | 1 | 1 | 0 | **15** | média |
| Observação | Pacientes em observação | 6 | 0 | 10 | 1 | 0 | 1 | 3 | 0 | 4 | **19** | alta |
| Prontuário | Prontuários (pedidos e leitura) | 2 | 0 | 33 | 0 | 0 | 1 | 4 | 0 | 0 | **38** | média |
| Prontuário | Pendências do PEP | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | **1** | média |
| Prontuário | Impressão de prontuário | 1 | 0 | 1 | 3 | 0 | 1 | 0 | 0 | 3 | **8** | média |
| Farmácia | Central do farmacêutico | 4 | 0 | 13 | 7 | 2 | 0 | 1 | 0 | 4 | **27** | alta |
| Farmácia | Dispensação e retirada | 1 | 0 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | **3** | alta |
| Farmácia | Alta vigilância | 1 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | média |
| Farmácia | Interações críticas | 1 | 0 | 5 | 0 | 1 | 0 | 0 | 0 | 0 | **6** | média |
| Farmácia | Unidade de consumo | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | **2** | baixa |
| Regulação e NIR | Regulação | 7 | 0 | 41 | 8 | 43 | 2 | 3 | 0 | 3 | **100** | média |
| Regulação e NIR | AIH | 1 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | **5** | média |
| Regulação e NIR | NIR | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | média |
| Regulação e NIR | APAC | 1 | 0 | 18 | 0 | 2 | 0 | 0 | 0 | 0 | **20** | baixa |
| Regulação e NIR | Rede (secretaria) | 1 | 0 | 7 | 1 | 2 | 2 | 0 | 0 | 1 | **13** | baixa |
| Faturamento | BPA | 1 | 0 | 32 | 1 | 2 | 0 | 0 | 0 | 0 | **35** | baixa |
| Faturamento | Contas do atendimento | 1 | 0 | 0 | 2 | 2 | 3 | 0 | 0 | 0 | **7** | baixa |
| Faturamento | Glosas | 1 | 0 | 0 | 1 | 2 | 1 | 0 | 0 | 0 | **4** | baixa |
| Gestão | Escala (gestor) | 5 | 23 | 131 | 19 | 0 | 3 | 8 | 2 | 5 | **191** | média |
| Gestão | Painel do gestor | 2 | 2 | 0 | 5 | 1 | 0 | 3 | 2 | 1 | **14** | média |
| Gestão | Porta agora | 1 | 0 | 2 | 0 | 0 | 1 | 0 | 0 | 0 | **3** | média |
| Gestão | Unidade (abas) | 14 | 3 | 67 | 1 | 0 | 0 | 13 | 3 | 2 | **89** | baixa |
| Gestão | Indicadores | 7 | 1 | 22 | 6 | 7 | 4 | 1 | 1 | 14 | **56** | baixa |
| Gestão | Integrações, exportar, implantação | 3 | 0 | 36 | 0 | 6 | 0 | 0 | 0 | 3 | **45** | baixa |
| Gestão | Auditoria | 1 | 0 | 30 | 0 | 0 | 2 | 5 | 0 | 2 | **39** | baixa |
| Gestão | Olho de Gavião | 1 | 0 | 2 | 5 | 0 | 0 | 1 | 1 | 3 | **12** | baixa |
| Gestão | Protocolos | 1 | 0 | 0 | 2 | 0 | 0 | 4 | 2 | 2 | **10** | baixa |
| Gestão | Revisão clínica | 1 | 0 | 3 | 1 | 0 | 0 | 1 | 0 | 1 | **6** | baixa |
| Gestão | Farmácia do gestor | 1 | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 1 | **4** | baixa |
| Gestão | Chamados técnicos | 1 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | 1 | **4** | baixa |
| Gestão | Intercorrências | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | **1** | baixa |
| Gestão | Exames da unidade | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | baixa |
| Admin | Rede da organização (abas) | 4 | 0 | 19 | 1 | 0 | 1 | 7 | 1 | 0 | **29** | baixa |
| Admin | Olho de Gavião (admin) | 1 | 0 | 24 | 0 | 0 | 0 | 0 | 1 | 0 | **25** | baixa |
| Admin | Plataformas, pendências, servidores, erros | 5 | 0 | 2 | 6 | 0 | 0 | 5 | 1 | 2 | **16** | baixa |
| Telemedicina | Teleinterconsulta e telemedicina | 3 | 0 | 8 | 2 | 1 | 0 | 3 | 2 | 4 | **20** | média |
| Ferramentas clínicas | Ferramentas (151 arquivos) | 151 | 2 | 401 | 21 | 2 | 34 | 0 | 3 | 1 | **464** | alta |
| Ferramentas clínicas | Central do plantonista (início e seções) | 17 | 0 | 31 | 20 | 1 | 0 | 0 | 6 | 3 | **61** | alta |
| Outros | Casca (lateral, topo, menus, chat) | 27 | 14 | 7 | 25 | 2 | 0 | 0 | 5 | 7 | **60** | alta |
| Outros | Entrada (login, cadastro, senha, 2FA) | 10 | 50 | 18 | 18 | 6 | 0 | 1 | 17 | 2 | **112** | média |
| Outros | Agenda (escala, vagas, extrato) | 4 | 0 | 28 | 0 | 0 | 0 | 0 | 3 | 1 | **32** | média |
| Outros | Pacote de alta (público) | 3 | 2 | 37 | 0 | 1 | 1 | 0 | 2 | 3 | **46** | baixa |
| Outros | Perfil, avisos, preferências | 3 | 0 | 14 | 5 | 0 | 0 | 4 | 2 | 0 | **25** | baixa |

**As cinco telas mais divergentes (total):**

1. **Ferramentas clínicas** — 464 em 151 arquivos (3,1 por arquivo). Quase tudo é tamanho de texto (401) e tabela à mão (34). Volume grande, correção mecânica.
2. **Pacientes internados e leito aberto** — 225 em 56 arquivos. Texto (124), botão (39), campo nativo (19), erro sem `role` (18), 22 formatadores de data. É a tela mais usada no plantão.
3. **Escala do gestor** — 191 em 5 arquivos (38 por arquivo; `pages/Escala.tsx` tem 2.174 linhas). Texto (131), cor (23), botão (19). É a mais distante do padrão por arquivo.
4. **Entrada** (login, cadastro, recuperar senha, segundo fator) — 112. Cor arbitrária (50, desenho de marca com hex solto) e títulos à mão (17).
5. **Regulação** — 100 em 7 arquivos. Campo nativo (43, quase tudo `<select>` com `SELECT` copiado) e texto (41).

Entre as telas de prioridade alta, depois das duas primeiras vêm a **Central do plantonista** (61), a **casca** (60), os **documentos da porta** (35), a **recepção** (30), o **painel da TV** (29), a **farmácia** (27) e o **atendimento médico** (24, metade em erro sem `role="alert"`).

---

## 5. Propostas para o guia (parte 2) e para a CI (parte 3)

### 5.1 Perguntas para o responsável técnico

Cada pergunta traz uma recomendação. O guia só fecha depois das respostas.

1. **Escala de texto.** Proibir `text-xs`…`text-2xl` e `text-[Npx]` e usar só os tokens? *Recomendo sim*, com o mapa da seção 3.5. Exceções declaradas: painel da TV, folha impressa, eixos de gráfico.
2. **Piso de 12 px.** Subir os 43 textos de 9 a 11 px (e o `.cc-tecla`) para 12 px? *Recomendo sim* na tela. A folha impressa segue a sua escala em pt.
3. **Lavagens de aviso e erro.** Uma lavagem por estado (`bg-alerta-critico`, `-atencao`, `-conforme`, `-marca`) e fim das Tailwind-50 (`#FEF2F2`, `#FFFBEB`…) e das variações `bg-critico/[0.0x]`? *Recomendo sim*, dentro de um componente `Aviso` com `tom`.
4. **Mensagem de erro.** Um componente só, com dois formatos: linha sob o campo (`text-rotulo text-critico`, ligado por `aria-describedby`) e caixa para falha de ação ou de carga? Sempre `role="alert"`. Texto em frase que diz o que falhou e o que fazer ("Não foi possível salvar a evolução. Tente de novo."), sem a mensagem crua do banco. *Recomendo sim*, padronizando em "Não foi possível …", que já é o mais usado (33).
5. **Estado vazio.** `Vazio` ganha `variante="linha"` para o vazio dentro de uma seção ("Nenhum atestado emitido.")? *Recomendo sim*; o texto começa por "Nenhum/Nenhuma" e diz o que falta.
6. **Carregando.** Spinner com rótulo do que carrega, centralizado, como padrão; `Skeleton` só em lista de paciente? *Recomendo spinner com rótulo*; esqueleto fica para depois.
7. **Botões.** `<button>` solto só dentro de `src/components/ui` e das peças de base (`Chip`, abas, `BotaoLinha`)? *Recomendo sim*. No resto, `Button`, `Chip`, `BotaoLinha` ou `Button size="icon"` com `aria-label`.
8. **Select.** Select nativo com uma classe única (`CampoSelecao` em `ui/`) ou o `Select` desenhado do base-ui? *Recomendo o nativo*: abre a roda do sistema no celular e no tablet do plantão, e 88 já são nativos.
9. **Tabelas.** Ajustar `ui/table.tsx` ao desenho do protótipo e usar em todas as 64? *Recomendo sim*, mais uma `PseudoTabela` só para lista de pacientes que reflui no celular.
10. **Títulos.** `TituloPagina` obrigatório em toda tela roteada (inclusive dentro de `TabsPagina` e `ToolLayout`)? E dois títulos internos: `TituloSecao` (17 px) e `TituloCartao` (15 px)? *Recomendo sim aos dois.*
11. **Peças duplicadas.** Consolidar `Campo` (7), `Aviso` (5), `Cartao` (5), `Abas` (3), `Chip` (6) e `Secao` (6) numa versão única cada? *Recomendo sim*, em `src/components/ui` (formulário e feedback) e `src/components/monitor` (página).
12. **Raio.** Exigir os nomes do projeto (`rounded-controle`, `-container`, `-cartao`, `-capsula`) e tirar `rounded-menu` (14 px)? *Recomendo sim*; o desenho quase não muda.
13. **Espaçamento.** Criar tokens para os 5 valores do ritmo (`justo` 7, `proximo` 12, `base` 14, `secao` 22, `pagina` 28) ou deixar o px solto? *Recomendo criar os 5 tokens* e não bloquear o resto na CI.
14. **Datas e números.** Um `src/lib/formato.ts` único (hora, data, data e hora, relativo, moeda, número), sempre no fuso da unidade? *Recomendo sim*; `src/lib/datas.ts` entra nele.
15. **Onde as peças moram.** Proibir página importar de outra área e componente importar de página? *Recomendo sim*, movendo antes as 58 importações da seção 3.16.
16. **Caixa dos textos.** Caixa de frase em título, menu, aba e botão ("Minha agenda", "Revisão clínica"), com siglas em maiúscula e nomes próprios de produto mantidos ("Olho de Gavião", "Central do Plantonista")? *Recomendo caixa de frase*; o RT define a lista de nomes próprios.
17. **Mesmo destino, mesmo nome.** O item de menu de uma rota tem o mesmo nome para todo papel ("Notificação compulsória", não "Notificações")? *Recomendo sim*, salvo quando a função muda (a "Retirada sem farmacêutico" é outra ação na mesma tela; aí o nome diferente se justifica).
18. **Pronto-socorro.** Escrever "Pronto-Socorro" (com hífen, como a norma) ou manter "Pronto Socorro"? *Recomendo com hífen.*
19. **Emoji.** Proibir emoji pictográfico na tela e na folha? E o formulário de internação legado (`/plantao/internacao/formulario`), que concentra os emojis e as cores cruas: retirar ou corrigir? *Recomendo proibir emoji* (ícone `lucide` no lugar) e **retirar o legado**, como a auditoria de 03/10 já sugeriu, em vez de gastar correção nele.
20. **Telas de marca.** Login, cadastro, recuperar senha, painel da TV e página pública usam fundo escuro com teal claro em hex solto. Criar tokens próprios (`marca-escura`, `marca-clara`, `marca-texto-claro`) e tratar essas telas como exceção declarada? *Recomendo sim.*
21. **Gráficos.** Cores de gráfico (recharts e SVG) lidas dos tokens por `var(--color-…)`? *Recomendo sim.*
22. **Menu do gestor.** São 30 itens sem grupo. Agrupar (Porta, Leitos, Farmácia, Faturamento, Unidade)? *Recomendo levar à parte 2 como item de navegação*, sem misturar com a limpeza visual.

### 5.2 Regras automáticas para a CI (parte 3)

A CI já roda `npm run lint`, `typecheck` e `build` no job `web` (`.github/workflows/ci.yml`). Proponho duas peças, sem dependência nova.

**A. Regras de ESLint (estruturais).** Entram em `eslint.config.js`, que já é flat config. `no-restricted-syntax` e `no-restricted-imports` são do próprio ESLint.

| Regra | Como | Onde vale |
|---|---|---|
| `<button>` solto | `no-restricted-syntax` com `JSXOpeningElement[name.name='button']` | todo `src/` menos `src/components/ui/**` e `src/components/monitor/**` |
| `<select>`, `<table>`, `<textarea>` soltos | mesmo seletor com `select`, `table`, `textarea` | idem; `src/lib/folhas.ts` fica fora (é HTML em texto) |
| `<h1>` solto | `JSXOpeningElement[name.name='h1']` | idem, menos as telas de marca declaradas |
| Cor e tamanho cru em `className` | `no-restricted-syntax` com `JSXAttribute[name.name='className'] Literal[value=/(text\|bg\|border)-(red\|amber\|…)-\d{2,3}\|-\[#\|text-(xs\|sm\|base\|lg\|xl)\b/]` (e o mesmo em `TemplateElement`) | todo `src/` menos `ui/` |
| Componente importando página | `no-restricted-imports` com `patterns: ['@/pages/*']` | `src/components/**`, `src/contexts/**`, `src/lib/**`, `src/hooks/**` |
| Página importando outra área | regra local pequena dentro do próprio `eslint.config.js` (objeto `plugins: { padrao: { rules: { … } } }`), que compara a pasta de origem com a de destino | `src/pages/**` |
| Data formatada fora de `lib/formato.ts` | `no-restricted-syntax` com `CallExpression[callee.property.name=/^toLocale(Date\|Time)String$/]` e `NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']` | todo `src/` menos `src/lib/formato.ts` |

O seletor de `className` não pega classe montada fora do atributo (constantes como `SELECT`, mapas de estado, `cva`). Por isso a parte B.

**B. Script de padrão com catraca (`scripts/padrao-frontend.mjs`).** Um script Node que varre `src/` com as expressões da seção 3 (cores cruas e arbitrárias, `bg-white`/`text-black`, texto fora da escala e abaixo de 12 px, `font-bold`, raio e sombra do Tailwind, erro sem `role="alert"`, emoji pictográfico, `TituloPagina` ausente em tela roteada, formatador local de data). Ele grava a contagem por arquivo e por regra num arquivo de base (`scripts/padrao-frontend.base.json`).

- Na CI, o passo falha se **algum arquivo aumentar** a contagem de alguma regra, ou se **um arquivo novo** nascer com divergência.
- Quem corrige roda `node scripts/padrao-frontend.mjs --atualizar` e a base desce no mesmo PR.
- Assim o padrão vale já para código novo, e as 3.000+ divergências antigas saem aos poucos, tela por tela, cada correção no seu PR (como pede a regra de branch e PR por tarefa).
- Entra no job `web` depois do Lint: `- name: Padrão do frontend` / `run: node scripts/padrao-frontend.mjs --ci`.

**C. Verificação no navegador (depois).** O repositório já tem `scripts/verificacao-telas.mjs` (contraste WCAG, anel de foco, transbordo, sticky), que roda contra o app local com o seed. Ele pode virar um job da CI quando o job `banco` (que já sobe o Supabase local) puder servir o app. Fica como passo seguinte da parte 3, não do primeiro corte.

### 5.3 Ordem sugerida depois do guia

1. Criar as peças que faltam (`MensagemErro`, `Aviso`, `Campo`, `CampoSelecao`, `BotaoLinha`, `TituloCartao`, `Vazio` de linha, `lib/formato.ts`) e mover as peças das importações cruzadas. Sem mudar tela.
2. Ligar a catraca (parte 3, A e B) com a base atual.
3. Corrigir as telas de prioridade alta, na ordem do plantão: casca, recepção e painel da TV, atendimento e documentos da porta, triagem e enfermagem, leito aberto, observação, farmácia, Central do plantonista e ferramentas.
4. Depois as de prioridade média e baixa; a Escala do gestor entra como tarefa própria, pelo tamanho.
