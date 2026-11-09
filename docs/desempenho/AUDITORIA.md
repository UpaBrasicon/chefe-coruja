# Auditoria de desempenho — kit de 31 passos

Pedido do RT em 08/11/2026: "quero fazer as 31 melhorias agora", do kit de desempenho para apps (goat-entregas.vercel.app/kit-performance-app, de @gustagoat.ai). Esta auditoria é só de leitura: nenhuma linha de código mudou. Base: `origin/master` em `c4f2cb41` (08/11/2026).

Cada item tem uma de três situações:

- **já tem**: o app já faz o que o kit pede (com a evidência);
- **não se aplica**: o kit mesmo diz quando pular, e o motivo vale para o Chefe Coruja hoje;
- **falta**: vira tarefa, em branch `desempenho/<item>` e PR próprio com base master.

## 1. Linha de base (item 31)

### 1.1 Lighthouse, celular, 4G lento (simulado), produção

A homologação (`homolog.chefecoruja.com.br`) fica atrás do login da Vercel: o Lighthouse sem navegador recebe `302` para `vercel.com/sso-api`. A tela de login da produção é pública, sem dado de paciente, e roda o mesmo código do master. Medida nela, três vezes, Lighthouse 12.8.2, `--form-factor=mobile --throttling-method=simulate` (Moto G Power, 4G lento: 150 ms de RTT, 1,6 Mbit/s, CPU 4× mais lenta).

| Execução | Nota | FCP | LCP | TBT | CLS | Requisições | Transferido |
|---|---|---|---|---|---|---|---|
| 1 | 66 | 3,3 s | 5,2 s | 47 ms | 0,174 | 44 | 8.262 KB |
| 2 | 75 | 3,1 s | 5,0 s | 65 ms | 0 | 42 | 8.029 KB |
| 3 | 68 | 3,1 s | 44,2 s | 67 ms | 0,048 | 44 | 8.229 KB |
| **Mediana** | **68** | **3,1 s** | **5,2 s** | **65 ms** | **0,048** | **44** | **8.229 KB** |

A terceira execução teve o LCP preso no fim do download de 5,7 MB (veja abaixo); por isso a mediana, não a média.

O que pesa no login (execução 2):

| Arquivo | Transferido | Observação |
|---|---|---|
| `/logo.png` | 5.747 KB | Ícone do `manifest.webmanifest`. É PNG de 2048×2048 declarado como 512×512. O Chrome baixa o ícone em toda abertura. |
| Cloudflare Turnstile (2 arquivos) | 1.654 KB | Verificação anti-robô do login. É exigida; não sai. |
| `vendor-other-*.js` | 182 KB | Inclui Sentry e dependências de bibliotecas que deveriam vir só sob demanda (item 22). |
| `index-*.js` | 96 KB | Código do app que abre em toda tela. |
| `vendor-base-ui`, `vendor-react`, `vendor-supabase` | 60 + 55 + 50 KB | Necessários. |
| Fonte Geist (latin) | 30 KB | Já é do próprio domínio. |

JavaScript que todo usuário baixa ao abrir o app (build local de `c4f2cb41`): **1.624 KB sem compressão, 504 KB em gzip**, em 18 arquivos. O Lighthouse aponta 308 KB de JavaScript não usado no login (mediana).

### 1.2 Homologação, no Chrome do RT (sem limitação de rede)

Login da homologação, segunda visita (service worker ativo): primeira pintura em 268 ms, 35 requisições, 3 KB transferidos (o resto veio do cache do service worker). O `logo.png` de 5.745 KB também aparece na homologação.

### 1.3 Telas logadas, homologação, médico (08/11/2026)

O RT entrou na homologação no próprio Chrome com `medico.upa.f5` (a sessão não leu nem digitou a senha). Cada tela foi recarregada inteira e medida pela Performance API depois de 8 s. Rede do RT, sem limitação, service worker ativo (os arquivos vêm do cache). "Dados prontos" é o fim da última chamada ao banco da carga. A homologação tem pouco dado, então o tamanho das listas não pesa aqui.

| Tela | 1ª pintura | LCP | Dados prontos | Chamadas ao banco | Distintas | Repetidas |
|---|---|---|---|---|---|---|
| `/plantonista` (Central) | 364 ms | — | 2.113 ms | 33 | 26 | `meu_plantao_agora` 3×, `turno_atual` 2×, `contexto_sem_conexao` 2×, `setores_na_escala_agora` 2× |
| `/plantao` | 2.404 ms | 2.404 ms | 2.433 ms | 30 | 24 | `perfis` 4×, `turno_atual` 2×, `meu_plantao_agora` 2×, `contexto_sem_conexao` 2× |
| `/atendimento` | 224 ms | 2.320 ms | 2.378 ms | 30 | 25 | `perfis` 4×, `episodios` 2×, `contexto_sem_conexao` 2× |
| `/plantao/observacao` | 224 ms | 2.432 ms | 2.457 ms | 25 | 21 | `perfis` 4×, `contexto_sem_conexao` 2× |
| `/plantao/internacao/pacientes` | 240 ms | 2.372 ms | 2.439 ms | 28 | 24 | `perfis` 4×, `contexto_sem_conexao` 2× |
| `/regulacao` | 220 ms | 2.472 ms | 2.471 ms | 26 | 22 | `perfis` 4×, `contexto_sem_conexao` 2× |
| `/agenda` | 220 ms | 2.444 ms | 2.514 ms (1.446 ms na 2ª vez) | 28 | 23 | `perfis` 4×, `contexto_sem_conexao` 2×, `escala_da_unidade` 2× |

O que a medição mostra:

- **Nenhuma chamada passou de 500 ms.** O banco responde rápido; o tempo vai na cascata.
- **A casca faz cerca de 20 chamadas em toda recarga**, antes dos dados da tela: `perfis` (3 vezes seguidas, `src/contexts/AuthContext.tsx:62`), `user`, `segundo_fator_status`, `listar_conversas`, `meu_papel_tecnico`, `contexto_sem_conexao` (2×, `src/lib/offline/relogio.ts:29`), `vinculos`, `super_admins`, `chave_rascunho`, `chave_fila`, `minhas_notificacoes`, `teleinterconsultas_da_unidade`, `situacao_checkin`, `turno_atual`, `meu_plantao_agora`, `banners`, `gerar_notificacoes_turno`, `contatos_chat`.
- **Cascata de arquivos da tela:** em `/agenda`, o arquivo `AgendaGrupo` só é pedido depois da casca (627 ms), e o `Escala` só depois dele (979 ms). Os dados da tela começam em 1.358 a 1.974 ms.
- **Mesma RPC por vários caminhos:** `meu_plantao_agora` é chamada por cinco lugares com chaves de cache diferentes (`src/components/AppShell.tsx:283`, `src/components/casca/FaixaDoPapel.tsx:176`, `src/components/plantonista/central/CartaoTurno.tsx:43`, `src/hooks/useChat.ts:236`, `src/hooks/useFaixaPlantonista.ts:32`); `turno_atual` por dois (`useFaixaPlantonista.ts:30`, `usePlantao.ts:56`).
- Navegar de uma tela para outra dentro do app (sem recarregar) não teve nenhum quadro longo (Long Animation Frames, mais de 80 ms).

Falta medir enfermagem e gestor; ficam para a medição de antes e depois de cada item que mexer nessas telas.

## 2. Os 31 itens

Na ordem do kit (as 10 primeiras), depois o resto.

| Item | Situação | Evidência | O que fazer |
|---|---|---|---|
| **31** Medir no celular e em rede lenta | **feito (linha de base)** | Seção 1: login da produção no Lighthouse (celular, 4G lento) e 7 telas logadas do médico na homologação. | Repetir antes e depois de cada item. |
| **19** Servidor perto do banco | **não se aplica** | Não há funções na Vercel (o projeto não tem pasta `api/`): o navegador fala direto com o Supabase. Supabase da produção e da homologação em `sa-east-1` (São Paulo). A borda da Vercel que respondeu foi `gru1` (São Paulo), cabeçalho `x-vercel-id`. O kit diz para pular quando o front fala direto com o Supabase. | Nada. |
| **24** Só as colunas usadas | **falta** | 13 `select('*')`: `src/components/documentos/identificacao.ts:144` (pacientes), `src/components/documentos/SeletorPaciente.tsx:82` (pacientes), `src/components/internacao/caderno/Trilha.tsx:99`, `src/components/internacao/LeitoAberto.tsx:164` (pendências), `src/components/termo/termo.ts:214`, `src/contexts/AuthContext.tsx:63` (perfis, em toda abertura), `src/hooks/useBanners.ts:14`, `src/hooks/useDadosUnidade.ts:21` (`vw_censo_unidade`), `src/hooks/useDocumentos.ts:60` e `:158`, `src/lib/observacao.ts:62`, `src/pages/farmacia/Diluicoes.tsx:113`, `src/pages/gestor/Banners.tsx:57`. O resto do app lê por RPC (760 chamadas `.rpc(` contra 218 `.from(`). | Trocar cada `*` pelas colunas que a tela usa. Frontend puro. |
| **08** Consultas N+1 | **falta** | Quatro casos que pesam (seção 3.1): painel de observação, 2 RPCs por cartão (`CartaoObservacao.tsx:131-132`); checagem da enfermagem, 1 RPC de alergia por paciente (`Checagem.tsx:120`); trava de alergia, 1 RPC por medicamento (`useTravas.ts:15`); série de sinais vitais, 3 chamadas por conceito (`EvolucaoClinica.tsx:96-100`). | RPC em lote ou o dado dentro da RPC da lista (migration nos três primeiros). |
| **17** Índices nos filtros | **falta (parte)** | A auditoria de 21/10/2026 indexou as 84 chaves estrangeiras usadas em RLS e junções (`20261021000001`, `20261021000002`; memória db-best-practices). O advisor da produção (08/11/2026, só metadados) ainda lista 322 chaves estrangeiras sem índice em 150 tabelas: 193 são colunas de autoria (`*_por`, `autor_id`), deixadas sem índice de propósito; 129 são outras. A busca de paciente por nome usa `ilike '%termo%'` (`SeletorPaciente.tsx:70` e as buscas do item 04) e não há índice trigram (`pg_trgm`) em `pacientes`. Advisor: 8 políticas RLS reavaliam `auth.uid()` por linha (`clinical_search_feedback`, `adesoes_contrato`, `aceites_termo`, `preferencias_aviso` ×3, `dispositivos_confiaveis` ×2) e 45 casos de várias políticas permissivas. A produção quase não tem volume (memória producao-sem-equipe), então `EXPLAIN ANALYZE` lá não é representativo. | Decisão do RT (A/B, seção 4). |
| **02** Imagens leves (WebP/AVIF) | **falta** | `public/logo.png` 5.883.299 bytes, 2048×2048, ícone do `public/manifest.webmanifest:11` (declarado 512×512). `public/fundo-login.png` (5,9 MB) e `public/logo-login.png` (5,2 MB) não são usados por nenhum arquivo e vão para o deploy. Banners, foto do perfil e artes do painel são enviados sem reduzir (`src/lib/api.ts:255`, `src/pages/Perfil.tsx:234`, `src/pages/recepcao/PropagandaPainel.tsx:190`); o banner aparece na lateral de toda tela (`src/components/casca/Lateral.tsx:70`). Na homologação ainda não há banner nem foto (só os buckets `exames` e `regulacao`). | Ícones 192 e 512 px; apagar os dois PNG órfãos; reduzir para WebP no envio. |
| **15** Imagem fora da tela só quando chegar perto | **falta** | Nenhuma das 9 `<img>` do app tem `loading="lazy"` (`grep '<img' src`). | `loading="lazy"` nas listas (Banners, Propaganda, DaUnidade); a lateral e o login ficam como estão. |
| **01** Esqueleto ao carregar | **falta (parte)** | O componente existe (`src/components/ui/skeleton.tsx`) e só uma tela usa (`src/components/observacao/PainelObservacoes.tsx:39`). As demais mostram "Carregando…" (62 lugares) ou spinner (145 arquivos). | Esqueleto nas telas principais, uma por vez, começando pelas que o RT apontar. |
| **05** Paginação | **falta** | 22 leituras sem limite em listas que crescem (seção 3.2). As que mais pesam: sinais vitais da internação lidos inteiros, duas vezes (`src/lib/observacao.ts:108` e `:126`); série de um sinal com padrão "tudo" (`observacao.ts:60`); avaliações, intercorrências, pareceres, procedimentos e trilha do paciente da vida inteira; AIH e APAC da unidade; painéis do Hiperdia e da puericultura. Dez listas têm teto (200 a 1.000) e cortam sem avisar. | Por tela: janela de tempo (internação atual, 48 h) onde a tela é clínica; páginas de 20 a 50 onde é lista administrativa. |
| **13** Texto da IA aparecendo aos poucos | **já tem** | `src/lib/useClinicalAsk.ts:6` e `:115`: a resposta do "Pergunte à IA" chega em stream NDJSON e é mostrada enquanto chega (status `streaming`). | Nada. |
| **04** Esperar parar de digitar | **falta** | Só `src/hooks/useTerminologia.ts:38` (`termoDebounced`) espera. Consultam a cada tecla (a partir de 2 ou 3 letras): `SeletorPaciente.tsx:66`, `ReservarLeito.tsx:46`, `IncluirNoHiperdia.tsx:46`, `PedidoExamesLeito.tsx:73`, `CadastroRn.tsx:39`, `CampoCbo.tsx:28`, `preNatal/Dialogos.tsx:59`, `SolicitarApac.tsx:39`, `AgendaConsultas.tsx:350`, `farmacia/Diluicoes.tsx:283`, `faturamento/Bpa.tsx:272` e `:514`, `faturamento/Contas.tsx:747`, `faturamento/Materiais.tsx:117`, `gestor/ExamesUnidade.tsx:49`. A conferir: `AlergiasEventos.tsx:431`, `PrescricaoEstruturada.tsx:412`, `AltaVigilancia.tsx:76`, `Dispensacao.tsx:74`, `UnidadeConsumo.tsx:50` (têm `setTimeout` no arquivo, não necessariamente na busca). | Um gancho só (`useValorAdiado`, ~300 ms) aplicado a cada busca. Frontend puro. |
| **03** Chamada repetida | **falta (parte)** | TanStack Query em 226 arquivos, `staleTime` de 30 s (`src/App.tsx:124-133`). Mas a medição com login (1.3) achou repetição em toda tela: `perfis` 3× ao abrir (`src/contexts/AuthContext.tsx:62`), `contexto_sem_conexao` 2× (`src/lib/offline/relogio.ts:29`), `meu_plantao_agora` por cinco caminhos com chaves diferentes, `turno_atual` por dois. 27 arquivos ainda buscam dentro de `useEffect`, fora do cache. | Uma chave de cache por RPC da casca; perfil lido uma vez por sessão. Frontend puro. |
| **12** Tempo-limite em serviço externo | **falta (parte)** | Têm: `supabase/functions/clinical-search/index.ts:131` (120 s para pergunta, 45 s para busca) e `supabase/functions/webhooks/index.ts:36`. Não tem: `supabase/functions/enviar-codigo-2fa/index.ts:67` (envio do código pela Resend). No navegador, as chamadas ao banco não têm limite (`src/lib/supabase.ts:174`): em 4G ruim a tela espera até o navegador desistir. | Limite na Resend; decisão do RT sobre o limite no navegador (A/B, seção 4). |
| **16** Chamadas independentes em paralelo | **já tem** | Varredura de pares `await supabase…` a até 6 linhas: 23 candidatos, todos são escolha de ação por ternário (só uma das chamadas roda) ou dependem do resultado anterior (`Configuracao.tsx:409`). As leituras de cada tela são `useQuery` separados, que já rodam juntos. | Nada. |
| **21** Scripts de terceiros depois da página | **falta (parte)** | Turnstile só é baixado no login, sob demanda (`src/components/seguranca/TurnstileWidget.tsx:24`). O Sentry entra no pacote inicial (`src/main.tsx:24`, `src/lib/sentry.ts:1`): `@sentry/core`, `@sentry/browser` e `@sentry/conventions` somam ~590 KB de fonte em `vendor-other`. | Carregar o Sentry depois da primeira pintura, guardando os erros de antes numa fila. |
| **22** JavaScript por tela | **falta (parte)** | 103 telas já vêm sob demanda (`lazy(`). Mas o `manualChunks` do `vite.config.ts:93-111` manda **toda** dependência não listada para `vendor-other`, que é baixado no início. Com isso, dependências das bibliotecas sob demanda vão para o pacote inicial: `pako` (230 KB de fonte), `canvg` (180 KB), `core-js` (142 KB), `fflate` (91 KB), `dompurify` (86 KB) vêm do jsPDF; `@reduxjs/toolkit` (80 KB), `es-toolkit`, `decimal.js-light`, `immer` vêm do Recharts. `vendor-other`: 539 KB, 178 KB em gzip. | Deixar o Vite decidir para o que não for núcleo (sem o "resto vai para vendor-other") e conferir o pacote inicial. Frontend puro. |
| **29** Fontes no próprio domínio, poucos pesos | **já tem** | `@fontsource-variable/geist` (`src/index.css:4`), Newsreader e Geist Mono só no login e na landing (`src/components/entrada/LadoMarca.tsx:4`). Fonte variável: um arquivo por alfabeto; o login baixou 30 KB. | Nada. |
| **14** Interface otimista | **já tem onde cabe** | `onMutate` em `src/hooks/useChat.ts`, `src/lib/useFavoritos.ts`, `src/pages/gestor/OlhoDeGaviao.tsx`, `src/pages/gestor/panorama.ts`. Ação clínica (prescrição, checagem, classificação, alta) não deve aparecer feita antes do banco confirmar. | Nada. Ampliar só a pedido. |
| **26** Redesenho à toa | **condicionado ao 30** (decisão do RT em 09/11/2026) | O kit manda agir só quando a tela trava ao digitar ou rolar. Não há relato de travamento; o TBT do login é 65 ms. As métricas de usuários reais (INP, item 30) dizem se alguma tela trava. | Rever com os números do 30. |
| **30** Medir usuários reais | **falta, decisão do RT em 09/11/2026** (antes "não se aplica por ora") | Sem medição de usuários reais; as telas logadas só foram medidas uma vez, com o Chrome do RT. | `web-vitals` (LCP, INP, CLS, FCP, TTFB) ao Sentry, com a rota sem identificador e o papel ativo. Feito na branch `desempenho/30-usuarios-reais` (`docs/desempenho/ITEM-30-USUARIOS-REAIS.md`). |
| **11** Dependências sem uso | **falta (pequeno)** | Sem nenhum import: `framer-motion`, `mammoth` (ainda citados no `vite.config.ts:96` e `:106`). `html2canvas` só chega pelo jsPDF. `shadcn` só pelo CSS (`src/index.css:3`). Como não são importados, não entram no pacote: o ganho é na instalação e no CI. | Tirar `framer-motion` e `mammoth` do `package.json` e do `vite.config.ts`. |
| **06** CDN | **já tem** | Vercel com borda em São Paulo (`x-vercel-id: gru1`), Cloudflare na frente (`server: cloudflare`). | Nada. |
| **09** Compressão | **já tem** | `content-encoding: br` no JavaScript da produção. | Nada. |
| **27** Cache de arquivos com hash | **falta (parte)** | O service worker já guarda `/assets/*` e serve do cache (`public/sw.js:47-60`). Mas o cabeçalho HTTP é `cache-control: public, max-age=14400, must-revalidate` (4 h, o padrão da Cloudflare por cima do `max-age=0` da Vercel), não um ano `immutable`. Antes de o service worker instalar, e no navegador que não o usa, o arquivo volta a ser pedido a cada 4 h. | Cabeçalho `public, max-age=31536000, immutable` para `/assets/(.*)` no `vercel.json`. Conferir se a regra da Cloudflare respeita. |
| **25** Pool de conexões | **não se aplica** | O app só fala com o banco pela API do Supabase (`supabase-js`, HTTP). O Hermes, que roda no VPS e conecta direto, já usa pool (`hermes/src/lib/pg.ts:44`, 5 ou 3 conexões, compatível com o pooler 6543). | Nada. |
| **07** Tarefa lenta em fila | **já tem onde precisa** | Envio à RNDS por fila (`interop_outbox`), webhooks por motor no `pg_cron` com fila de entregas (`20270201000002`). PDFs são feitos no aparelho (jsPDF, sob demanda). | Nada. |
| **10** Cache com Redis | **não se aplica** | O kit manda pular em app pequeno e corrigir as consultas antes (itens 08, 17, 24). Volume atual: uma unidade, sem equipe em produção. | Nada. |
| **18** Rastreamento com OpenTelemetry | **não se aplica** | Não há backend próprio em várias etapas: as regras ficam em RPCs. O kit manda começar pelos registros que já existem (Sentry, `erros_cliente`, logs do Supabase). | Nada. |
| **20** HTML pronto no servidor | **não se aplica** | O app fica atrás do login. A página pública, que precisa de busca no Google, já é Next.js em projeto separado (`landing/next.config.mjs`, projeto Vercel `chefe-coruja-landing`). | Nada. |
| **23** Virtualizar listas longas | **não se aplica (junto com o 05)** | As listas que podem passar de cem linhas numa tela são as com teto de 500 (`contas_da_unidade` em `Contas.tsx:58`, `glosas_da_unidade`, `regulacao_fila` em `Regulacao.tsx:957`, `regulacao_sla_painel`, `dispensacoes_da_unidade`). O kit manda pular a virtualização quando a lista é paginada. | Paginar no item 05; virtualizar só se alguma lista continuar longa. |
| **28** Várias instâncias | **não se aplica** | Vercel serve arquivos estáticos e escala sozinha; o banco é o Supabase gerenciado. | Nada. |

## 3. N+1, paginação e listas longas (itens 05, 08 e 23)

Varredura de todo `src/`: cada `.map(` que desenha linhas, seguindo o componente da linha até o `useQuery`, e cada laço com chamada ao banco. Para cada RPC, a última `create or replace function` em `supabase/migrations`.

### 3.1 Uma chamada por linha (N+1)

| # | Onde | Chamada | Linhas | Peso |
|---|---|---|---|---|
| 1 | `src/components/observacao/PainelObservacao.tsx:94` desenha `CartaoObservacao`; cada cartão chama `SeloAlergia` e `Acuidade` (`CartaoObservacao.tsx:131-132`, `:36-40`) | `alergias_do_paciente` + `acuidade` | 10 a 30 pacientes em observação: 20 a 60 chamadas ao abrir, de novo ao voltar à aba | **alto** (tela do plantão) |
| 2 | `src/pages/enfermagem/Checagem.tsx:115` desenha um cartão por paciente com `AlergiaNaTela` (`:120`, `AlergiaNaTela.tsx:17`) | `alergias_do_paciente` | 10 a 40 pacientes dos setores da enfermagem | **alto** |
| 3 | `src/components/paciente/useTravas.ts:15`, chamado por `ReceituarioMedico.tsx:178` (itens + todos os favoritos) e `PrescricaoEstruturada.tsx:498` | `alergia_trava_medicamento`, uma por medicamento | 1 a 10 itens + favoritos (crescem por médico). A chave é a lista inteira: incluir um item refaz todas | **alto** (receita) |
| 4 | `src/pages/plantao/EvolucaoClinica.tsx:96-100`, um `getSerieObservacao` por conceito escolhido (`src/lib/observacao.ts:52`) | abrir prontuário + `observacao` + `conceito`: 3 chamadas por conceito | 1 a 8 conceitos | médio |
| 5 | `src/lib/api.ts:139` (`salvarOrdemSetores`) e `:245` (`reordenarBanners`): um `update` por item, em sequência, sem conferir erro | `setores`, `banners` | 5 a 30 | baixo (tela do gestor, rara) |
| 6 | `src/hooks/useNotificacoesTurno.ts:40` (`marcarTodas`) | `marcar_notificacao_lida` por aviso | 2 a 4 | baixo |
| 7 | `src/pages/regulacao/Regulacao.tsx:368-377`: um envio por arquivo e um vínculo por documento escolhido | `regulacao_registrar_anexo`, `regulacao_anexar_documento` | 1 a 10 | baixo (o envio do arquivo é um por arquivo de qualquer jeito) |

Conferidos e sem N+1: `FilaPS.tsx:283` e `BarraConsultorio.tsx:49` usam `useSalas` com cache por setor (uma chamada por setor); `ListaInternados.tsx:92-130` já lê pendências, diagnósticos e alergias em lote com `.in()`; os detalhes de exame, APAC, AIH, regulação e leito só buscam quando a linha é aberta; `ReceituarioMedico.tsx:249` descarta no máximo 2 rascunhos.

### 3.2 Listas sem limite que crescem com o uso

| # | Tela (arquivo:linha) | RPC ou tabela | Cresce com |
|---|---|---|---|
| 1 | `src/lib/observacao.ts:108` e `:126` (`getPainelInternacao`, de `PainelObservacoes.tsx:35`) | `observacao` da internação, lida inteira duas vezes para mostrar as 2 últimas de cada conceito | dias de internação (UTI: milhares) |
| 2 | `src/lib/observacao.ts:60` (`getSerieObservacao`, padrão `'tudo'`) | `observacao` | dias de internação |
| 3 | `src/components/avaliacao/useAvaliacao.ts:57` (`AbasRegistro.tsx:174`, `AbaCuidadosPaliativos.tsx:45`, `AbaAvaliacaoCrescimento.tsx:101`) | `avaliacoes_do_paciente` (`20261004000003`, linha 499) | vida do paciente (escalas diárias) |
| 4 | `src/components/internacao/caderno/Trilha.tsx:35` e `:47` (em `LeitoAberto.tsx:395`) | `eventos_adt`, `transferencias_paciente` | vida do paciente |
| 5 | `src/components/internacao/LeitoAberto.tsx:164` e `:173` | `pendencias`, `passagens_plantao` da internação | dias de internação |
| 6 | `src/components/prontuario/Intercorrencias.tsx:46` | `intercorrencias_do_paciente` (`20261031000003`, linha 163) | vida do paciente |
| 7 | `src/components/parecer/AbaParecer.tsx:106` | `pareceres_do_paciente` (`20261022000006`, linha 417) | vida do paciente |
| 8 | `src/components/paciente/ProcedimentosRealizados.tsx:43` | `procedimentos_do_paciente` (`20261103000002`, linha 799) | vida do paciente |
| 9 | `src/pages/prontuario/ImpressaoProntuario.tsx:165-168` | `documentos_do_paciente` com conteúdo completo, anexos, impressões | vida do paciente |
| 10 | `src/pages/regulacao/Aih.tsx:44` (repete a cada 60 s) | `aihs_da_unidade` (`20261102000003`, linha 291): abas aprovada, rejeitada, cancelada e todas | internações da unidade |
| 11 | `src/pages/regulacao/Apac.tsx:53` | `apacs_da_unidade` (`20261104000001`, linha 352) | APACs da unidade |
| 12 | `src/pages/hiperdia/Hiperdia.tsx:44` | `hiperdia_painel` (`20270218000001`, linha 215) | pacientes do programa (centenas a milhares por UBS) |
| 13 | `src/pages/puericultura/Puericultura.tsx:39` | `puericultura_painel` (`20270224000001`, linha 112) | crianças da faixa na UBS |
| 14 | `src/pages/preNatal/PreNatal.tsx:43` | `pre_natal_painel` (`20270222000001`, linha 372) | gestações ativas (dezenas a centenas) |
| 15 | `src/hooks/useChat.ts:61` | `listar_conversas` (`20260817000002`, linha 255), com contagem por conversa | uso de cada pessoa |
| 16 | `src/hooks/usePessoas.ts:25` e `:34` (`Pessoas.tsx:59`) | `perfis` sem filtro e `vinculos` de todas as unidades | equipe da organização |
| 17 | `src/pages/gestor/ChamadosTecnicos.tsx:49`, `src/lib/dadosAdmin.ts:139` | `chamados_tecnicos_da_unidade`, `chamados_tecnicos_lista` (com os resolvidos) | tempo |
| 18 | `useEncaminhamentos.ts:79`, `EnviosDoPaciente.tsx:15`, `RetornosDoPaciente.tsx:17`, `SolicitarApac.tsx:33`, `Regulacao.tsx:336` | encaminhamentos, contrarreferências, APACs e documentos do paciente | vida do paciente (pouco volume) |
| 19 | `src/pages/farmacia/Diluicoes.tsx:113` | `diluicao`, todas as versões | versões (devagar) |

Com teto e sem página (cortam calado quando passam do teto): `contas_da_unidade` e `glosas_da_unidade` (500), `regulacao_fila` (500, `Regulacao.tsx:957`), `regulacao_sla_painel` (500), `dispensacoes_da_unidade` (500 em 72 h), `rede_regulacoes` (300), `regulacao_lista` e `regulacao_destino_lista` (200), `trilha_da_unidade` e `acessos_prontuario_da_unidade` (1.000 no período), `minhas_notificacoes` (100), saídas da `FilaPS.tsx:176` (200).

Conferidas e limitadas: filas do PS e da triagem por etapa (`FilaPS.tsx:159`, `Triagem.tsx:68` e `:87`, `ProntoSocorroEnfermagem.tsx:52`, `CartaoTurno.tsx:61`; só enquanto os atendimentos saem da etapa), `painel_observacao` (12 h), `InternacaoPainel.tsx:79` (internados), chamadas (24 h), RPCs com janela de 7 a 30 dias, históricos com limite de 200.

## 4. Decisões para o RT

Perguntadas uma de cada vez, na ordem em que a correção chega.

| Item | Pergunta | A | B |
|---|---|---|---|
| 31 | Medir as telas logadas | **Escolhida em 08/11/2026:** o RT entrou na homologação no próprio Chrome e a sessão mediu (seção 1.3) | — |
| 17 | Índices | Agora: trigram no nome do paciente, corrigir as 8 políticas RLS do advisor e indexar as chaves das tabelas que crescem com o uso, com `EXPLAIN ANALYZE` na homologação | Esperar volume real na produção e decidir pelo `pg_stat_statements` |
| 12 | Tempo-limite das chamadas ao banco no navegador | 20 s em toda chamada, com aviso "a rede está lenta, tente de novo" | Só nos serviços externos (Resend), como o kit pede |
| 05 | Paginação clínica | Janela de tempo (internação atual, últimas 48 h, com "ver mais") | Páginas de 20 a 50 com "ver mais" |
| 30 | Medir usuários reais | Escolhida em 08/11/2026: ligar quando a primeira unidade entrar em uso. **Trocada pelo RT em 09/11/2026: fazer agora, antes do 08.** | — |

## 5. O que falta, na ordem do kit

1. **31** — feito: linha de base na seção 1.
2. **03** — chamadas repetidas da casca (`perfis` 3×, `meu_plantao_agora` por cinco caminhos), achadas na medição com login. Entra aqui porque pesa em toda tela.
3. **24** — 13 `select('*')`.
4. **08** — N+1: painel de observação, checagem, trava de alergia, série de sinais (migrations nos três primeiros).
5. **17** — índices (decisão do RT).
6. **02/15** — `logo.png` de 5,7 MB no manifest, dois PNG órfãos de 5 MB, imagens enviadas sem reduzir, `loading="lazy"`.
7. **01** — esqueletos nas telas principais.
8. **05** — paginação ou janela nas 19 listas (seção 3.2), uma tela por vez.
9. **04** — esperar parar de digitar em ~15 buscas.
10. Depois, na ordem do kit: **12** (tempo-limite), **21** (Sentry depois da pintura), **22** (pacote inicial), **27** (cabeçalho de cache), **11** (dependências).

Não se aplicam (motivo na tabela da seção 2), **confirmados pelo RT em 08/11/2026**: 19, 25, 10, 18, 20, 28, 23 (se o 05 paginar), 26 (condicionado ao 30, decisão do RT em 09/11/2026). O 30 saiu da lista em 09/11/2026 e foi feito. Já têm: 06, 09, 13, 16, 29, 14, 07.

## Como medir de novo

```bash
npx lighthouse@12.8.2 https://www.chefecoruja.com.br/login --form-factor=mobile --throttling-method=simulate --only-categories=performance --output=json --output-path=./login.json
```

Rodar três vezes e usar a mediana. Pacote inicial: `npx vite build` e somar os arquivos `.js` citados no `dist/index.html` (com e sem gzip).
