# Item 34: diagnóstico dos "31 pedidos" de desempenho (23/11/2026)

Pedido do RT em 23/11/2026, à noite: rodar o prompt dos 31 pedidos (checklist de desempenho web) contra o `master` e executar as melhorias. Decisões do RT no mesmo pedido: nada vai à produção sem o ok dele, as melhorias ficam em PR com CI verde e publicadas na homologação, migration só na homologação, e as telas logadas usam a medição de 16/11/2026.

O diagnóstico abaixo foi feito sobre `origin/master` 34a0d201, sem mudar nada. Os PRs de cada item estão no `BACKLOG.md` (item 34).

---

# Diagnóstico de desempenho: os 31 pedidos contra o master de 23/11/2026

Diagnóstico só de leitura. Nenhum arquivo do projeto mudou, nenhum branch, commit, PR, migration ou SQL. O RT estava dormindo: onde o prompt mandava perguntar, ficou a opção mais conservadora e a pergunta está na seção 5.

## 1. Onde mediu

**Código:** worktree `C:\Users\Ricardo\Desktop\chefe coruja\wt-perf-diag`, HEAD destacado em `34a0d201` (`origin/master` de 23/11/2026 21:55, #1091). Durante a sessão o `origin/master` andou para `8a0d8359` (#1093, divisão do descanso dos médicos: 13 arquivos, migration e tela do plantão; não mexe na casca nem no pacote de entrada). As medições na produção (22h de 23/11) já pegaram essa versão (`index-CPz_QPKq.js`).

**Data:** 23/11/2026, entre 21h50 e 22h30 (Brasília).

| Medição | Ambiente | Método | Resultado |
|---|---|---|---|
| Instalação e conferência | worktree, Windows 11, Node 24.13.1, npm 11.8.0 | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` | tudo com saída 0; lint sem aviso |
| Guardas e testes | worktree | como o CI: `node --experimental-strip-types --test src/lib/*.test.ts src/lib/offline/*.test.ts` e `node --test scripts/padrao-frontend.test.mjs` | 744 de 744 em `src/lib`; 11 de 11 no padrão do frontend |
| Pacote inicial | build local (`VITE_SUPABASE_URL` da homologação, sem chave; nada foi servido nem logado) | soma dos `.js` citados no `dist/index.html`, `zlib` gzip padrão | 19 arquivos, 1.191.752 bytes, **358.427 em gzip** (305.509 em brotli) |
| Pacote inicial da produção | arquivos baixados de `www` (o `index.html` de 22h) | mesmo script | 19 arquivos, 1.194.492 bytes, **359.602 em gzip** |
| Composição do pacote de entrada | build local com `--sourcemap` numa pasta temporária | atribuição dos bytes do `index-*.js` por arquivo de origem | 74% do `index-*.js` é casca logada e catálogo da Central (seção 2, pedido 6) |
| Login da produção | PC do RT, Chrome sem janela, Lighthouse 12.8.2 | `npx lighthouse@12.8.2 https://www.chefecoruja.com.br/login --form-factor=mobile --throttling-method=simulate --only-categories=performance`, 3 vezes, mediana | tabela abaixo |
| Login da produção, com limite real de rede | mesmo PC | o mesmo comando com `--throttling-method=devtools`, **1 execução** (não é mediana) | LCP 4,75 s |
| Página pública `/` da produção | mesmo PC | o mesmo do login, com `--only-categories=performance,seo`, 3 vezes | tabela abaixo |
| Cabeçalhos da produção | PC do RT | `curl -I` em `/`, `/login`, `/sw.js`, `/assets/index-*.js`, `/assets/index-*.css`, `/manifest.webmanifest`, `/logo-192.png`, `/precache.json` | seção 2, pedidos 12 a 14 |

Login da produção, celular, 4G lento simulado (Moto G Power, 150 ms, 1,6 Mbit/s, CPU 4×):

| Execução | Nota | FCP | LCP | TBT | CLS | TTFB | Requisições | Transferido | JS sem uso |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 72 | 2,70 s | 7,22 s | 1 ms | 0 | 213 ms | 49 | 2.390 KB | 165 KB |
| 2 | 73 | 2,76 s | 6,33 s | 0 ms | 0 | 65 ms | 48 | 2.353 KB | 184 KB |
| 3 | 73 | 2,69 s | 6,47 s | 0 ms | 0 | 45 ms | 47 | 2.294 KB | 177 KB |
| **Mediana** | **73** | **2,70 s** | **6,47 s** | **0 ms** | **0** | **65 ms** | **48** | **2.353 KB** | **177 KB** |

- Elemento do LCP no modo simulado: o botão "Aguardando a verificação…" (90% do LCP é atraso de pintura). O LCP observado sem limite foi 1,08 s, mas depois de o Turnstile começar a baixar; o simulador põe o desafio da Cloudflare (1.555 KB) no caminho do LCP. Por isso o número simulado sai inflado.
- Com limite real de rede (devtools, 1 execução): FCP 3,77 s, **LCP 4,75 s**, TBT 49 ms, CLS 0,001, 2.469 KB. O elemento do LCP é o parágrafo "Use o e-mail da sua unidade…". A cadeia é serial: HTML até 0,65 s; `index-*.js` (107 KB em brotli) até 3,50 s; o pedaço do `Login` só é pedido em 3,67 s e chega em 4,38 s; a fonte Geist chega em 4,71 s.
- O que pesa no login: desafio do Turnstile 1.555 KB + 217 KB, `index-*.js` 107 KB, `logo-192.png` 66 KB (ícone do manifest), `vendor-base-ui` 60 KB, `vendor-react` 56 KB, `vendor-supabase` 52 KB, `sentryCarga` 31 KB, fonte Geist 30 KB.

Página pública `/` da produção (mesmas condições, mediana de 3): nota 77, SEO 83, FCP 2,76 s, **LCP 5,07 s**, TBT 0, CLS 0, 38 requisições, 836 KB. O HTML chega vazio (`<div id="root"></div>`) e não tem `meta description`.

**Não medido hoje, e por quê:**

- Telas logadas: o RT estava dormindo e não dava para entrar com conta de teste. Vale a medição de **16/11/2026** na homologação, só como médico (`ITEM-30-MEDICAO-HOMOLOGACAO.md`): LCP de 0,9 a 1,7 s, processamento das interações até 14 ms, uma tarefa longa de 207 ms na carga da Central. Enfermagem e gestor nunca foram medidos.
- Sentry (usuários reais e INP): esta sessão não tem acesso. Número de amostras desconhecido. **Atenção:** as 10 execuções do Lighthouse desta noite (7 no `/login`, 3 no `/`, de 22h00 a 22h10 de 23/11) mandaram métricas do `web-vitals` ao Sentry da produção (2 a 3 envios por execução). Filtrar essa janela antes de olhar o p75.
- Banco: sem SQL nesta tarefa (decisão do RT). Valem `ITEM-08`, `ITEM-17` e `ITEM-24` e o código das migrations.
- Gatilho "lista acima de 1.000 linhas numa unidade": pede SQL; não conferido.
- INP: o Lighthouse não mede.

## 2. Os 31 pedidos

| Nº | Pedido | Situação | Evidência | Impacto | Esforço |
|---|---|---|---|---|---|
| 1 | Skeleton no lugar de spinner e tela em branco | **FALTA** (em parte) | As cinco telas do #519 continuam com esqueleto (guarda `esqueletos` passa). Das telas principais, ainda com spinner: `/enfermagem` (`InicioEnfermagem.tsx:16`), `/enfermagem/pronto-socorro` (`ProntoSocorroEnfermagem.tsx:105` e `:145`), `/atendimento` (`porta/FilaPS.tsx:322`), `/internacao` e `/observacao` do gestor (`InternacaoPainel.tsx:254`), internação do médico (`internacao/ListaInternados.tsx:182`), `/meu-plantao` (`MeuPlantao.tsx:220`), `/gestao` (`gestor/PainelGestor.tsx:73`), `/escala` e `/painel` (fallback do `TabsPagina.tsx:84`), troca de rota (`App.tsx:200` e `:215`, spinner de tela cheia). `/plantao` não tem estado de carga e mostra um estado falso enquanto carrega: "Check-in pendente" (`PlantaoHome.tsx:78`), "Sem setor na escala agora" (`:95`) e "Ninguém em observação no seu acesso" (`:103`). Telas novas depois de 09/11, todas com spinner: `Passometro.tsx:130`, `vacina/SalaVacina.tsx:128`, `vacina/LotesVacina.tsx:51`, `enfermagem/SinaisVitaisUbs.tsx:56`, `admin/UsoDoApp.tsx:101`, `admin/SisabAba.tsx:58` e `:196`, `Tecnovigilancia.tsx:21` | médio no `/plantao` (texto errado por um instante); baixo no resto. Sem medição de CLS logado hoje | médio, só frontend |
| 2 | `loading="lazy"` com largura e altura fora da tela; LCP sem lazy | FEITO | `gestor/Banners.tsx:181` e `recepcao/PropagandaPainel.tsx:166` com lazy; telas novas da página pública com `width`, `height` e lazy (`landing/UmPlantao.tsx:64-83`, `landing/Landing.tsx:340`). A lateral, a Central e a TV ficam sem lazy, por serem a imagem visível. O LCP do login e do `/` é texto | — | — |
| 3 | Debounce de 250 a 300 ms, cancelar a anterior, descartar resposta fora de ordem | **FALTA** (em parte) | Debounce: `useValorAdiado` (`hooks/useValorAdiado.ts:8`) nas 18 buscas do #511 (guarda `buscaComEspera` passa), mais `preNatal/EscolherGestante.tsx:22` e um temporizador de 350 ms em `vacina/SalaVacina.tsx:60`. Consultam a cada tecla: `plantao/porta/AbaExames.tsx:114-119` (`buscar_exames`), `regulacao/Regulacao.tsx:312-316` (`buscar_pacientes`, campo em `:415`), `PreferenciasPrescricao.tsx:151-160` (`medicamento` com `ilike`, campo em `:206`), `ReferenciaDiluicao.tsx:68-80` (`medicamento` com `ilike`, campo em `:131`). Os quatro já existiam em 09/11 e ficaram fora do #511. Ordem das respostas: segura, porque cada termo tem a própria chave no TanStack Query e a tela só mostra a da chave atual. Cancelamento: nenhuma consulta usa `.abortSignal(signal)`; a anterior termina no servidor. Só a Central cancela (`PlantonistaHome.tsx:188-195`, `AbortController`) | baixo: busca de paciente leva 1,6 ms no banco (`ITEM-17`); sem medição na tela | pequeno, só frontend |
| 4 | Atualização otimista em ações simples | FEITO | `useChat.ts:263`, `useFavoritos.ts:79`, `gestor/panorama.ts:176`. Ação clínica segue sem otimismo, por regra | — | — |
| 5 | Remover dependências sem uso e trocar as pesadas | FEITO | Guarda `dependenciasEmUso` passa; nenhuma dependência nova desde 09/11 (`package.json` igual). Sobras sem efeito no pacote: a linha do `framer-motion` no `vite.config.ts:106` e arquivos órfãos em `public/` (pedido 11) | — | — |
| 6 | Code splitting por rota e `React.lazy` | FEITO, com deriva | 89 `lazy(` no `App.tsx`; todas as telas novas sob demanda (`App.tsx:27`, `:38`, `:39`, `:69`, `:75`, `:111`, `:114`); sem `vendor-other` (guarda `pacoteInicial` passa). Mas a casca logada é importada de forma estática (`App.tsx:14` e `:231`): 74% do `index-*.js` (cerca de 269 de 365 KB de código) é casca e catálogo da Central (`content/registry.tsx`, 102 KB), baixados também no login. JS inicial: 342 KB (09/11) → 358 KB em gzip hoje (regressão leve, seção 3) | médio no login: 177 KB de JS sem uso (Lighthouse); o pedaço do Login só sai depois do `index-*.js` (3,67 s com limite real) | médio, só frontend |
| 7 | Scripts de terceiros depois da página interativa | **FALTA** (em parte, borda) | No código: Sentry depois da pintura (`lib/sentry.ts:58` e `:102`), `web-vitals` depois dele, Turnstile só no login, no desbloqueio, na recuperação e ao abrir o formulário de demonstração (`landing/AgendarDemonstracao.tsx:31`). Na borda: a Cloudflare injeta o Web Analytics (`static.cloudflareinsights.com/beacon.min.js`, com `"spa":2`) em todo HTML pedido por navegador. A CSP bloqueia (0 byte, status -1 no Lighthouse), então ele não roda, mas custa uma tentativa por página e não está registrado em `infra/cloudflare.md` | baixo (bloqueado); sem medição | pequeno, painel da Cloudflare (ação do RT) |
| 8 | Virtualizar listas com mais de 100 itens | NÃO SE APLICA (por ora) | Fechado em 16/11 (D1 = A, `ITEM-30-MEDICAO-HOMOLOGACAO.md`). Gatilho não conferido: sem acesso ao Sentry e sem SQL. Listas novas conferidas no código, todas pequenas ou limitadas: `ledi_itens` (50), `passometro` (24 h), `gestao_ubs` (10), lotes e caderneta de vacina | — | — |
| 9 | Evitar re-render, medindo com o Profiler | NÃO SE APLICA (por ora) | Fechado em 16/11 (D1 = A). Gatilho não conferido (Sentry). TBT do login 0 ms hoje | — | — |
| 10 | Fontes no próprio domínio, woff2, poucos pesos | **FALTA** (em parte, só a CSP) | Fontes no domínio: `@fontsource-variable` com `font-display: swap`; Newsreader e Geist Mono só no login e na página pública (`entrada/LadoMarca.tsx:4-5`, `landing/Landing.tsx:6-7`). Nenhum arquivo de `src/`, `index.html` ou `public/` usa Google Fonts, mas a CSP ainda libera `https://fonts.googleapis.com` e `https://fonts.gstatic.com` (`vercel.json:25` e `:37`). A fonte do LCP não é pré-carregada (chega em 4,71 s com limite real) | baixo | pequeno, só configuração |
| 11 | Imagens em WebP ou AVIF, no tamanho certo | FEITO | Envio reduzido a WebP (`lib/reduzirImagem.ts`, guarda `reduzirImagem` passa); `coruja.webp`. Sobras pequenas: capturas da página pública em JPG de 85 a 121 KB (`public/landing/telas/*.jpg`, 1424×749, com lazy); `logo-192.png` de 66 KB baixado no login; órfãos no deploy (`public/plantao/MODELO_EXAMES.png` 387 KB, `public/plantao/background.png` 69 KB, `public/login-img-1..4.svg`, `public/icons.svg`), citados só no `FRONTEND.md:615-616` | — | — |
| 12 | Estáticos por CDN | FEITO | `x-vercel-id: gru1::…` e `cf-ray: …-GRU` em todas as respostas de 23/11 | — | — |
| 13 | Brotli ou Gzip | FEITO | `content-encoding: br` no HTML, JS, CSS, manifest e `precache.json` | — | — |
| 14 | Cache longo com hash e `no-cache` no HTML | FEITO, com ressalva | `/assets/*`: `public, max-age=31536000, immutable` (guarda `cacheAssets` passa); HTML: `public, max-age=0, must-revalidate`. Ressalva: `/sw.js` sai com `Cache-Control: max-age=14400` e `cf-cache-status: REVALIDATED`, embora o `vercel.json:10-12` diga `no-cache`. A Cloudflare guarda o arquivo na borda com cabeçalhos de 09/11 (`last-modified` de 09/11 e a CSP antiga, sem `assina.chefecoruja.com.br`). O conteúdo é igual ao do master. O navegador ignora o cache HTTP ao checar o service worker (`register` sem `updateViaCache`, `main.tsx:92`), então hoje não atrasa versão nova | baixo | pequeno, painel da Cloudflare |
| 15 | Sem chamadas duplicadas, buscas no TanStack Query | FEITO | Guarda `chamadaCompartilhada` passa; casca por `lib/rpcCasca.ts`. Chamadas diretas ao banco dentro de `useEffect`: 12 arquivos (a auditoria contou 27, com critério mais largo), todos de efeito único ou de gravação (chaves da fila e do rascunho, marcar resultado visto, web push, uso do app, painel da TV). `minhas_notificacoes` aparece em três lugares, mas com a mesma chave (`casca/useNotasNav.ts:18`, `plantonista/SinoAvisos.tsx:21`, `Notificacoes.tsx:96`). Sem medição logada hoje | — | — |
| 16 | Paginação das listagens | FEITO (restante NÃO SE APLICA por ora) | #521, #522, #525 de pé (guardas `janelasClinicas`, `paginasAdministrativas`, `paginasPaciente` passam). Chat, chamados, pessoas e diluições: fechados em 16/11, gatilho não conferido. Listas novas sem limite, todas de baixo volume: `tecnovigilancia_da_unidade` (`20270418000094`, linha 190), `vacina_caderneta`, `vacina_lotes_da_unidade`, fichas abertas da UBS (`SinaisVitaisUbs.tsx:39-45`, com índice `episodios_fila`) | — | — |
| 17 | Requisições independentes em paralelo | FEITO | Varredura dos 609 arquivos de `src/` mudados depois de 09/11: os pares de `await` seguidos são escolha por ternário ou dependem do anterior (`casca/Bloqueio.tsx:57-61`, `Configuracao.tsx:414-419`); `usePlantao.ts:55` usa `Promise.all` | — | — |
| 18 | Timeout, retry e mensagem clara nas APIs externas | **FALTA** (em parte) | Edge Functions novas com limite: `pedir-demonstracao/index.ts:76` e `:109`, `avisar-tecnovigilancia/index.ts:79`. Hermes: todas as quatro chamadas externas com `AbortSignal.timeout`. Sem limite: o assinador ICP-Brasil (LG7, criado em 18/11, desligado na produção): `services/assinador/src/docicp17.ts:67`, `:81`, `:97` (provedor de certificado em nuvem) e `services/assinador/src/real.ts:16`, `:58`, `:63` (Supabase); e o navegador chamando o assinador (`src/lib/assinador.ts:17`). O relato ao Sentry das funções (`supabase/functions/_shared/sentry.ts:55`) também não tem limite, mas não segura a resposta | baixo hoje (desligado); alto quando ligar: o médico espera a assinatura sem prazo | pequeno, serviço do VPS e frontend |
| 19 | Resposta da IA em streaming | FEITO | `lib/useClinicalAsk.ts:131` (`getReader`) e `:156`; a função responde `text/event-stream` (`clinical-search/index.ts:196`) | — | — |
| 20 | Tarefas lentas em fila | FEITO | RNDS e webhooks por fila; LEDI/SISAB por itens com reenvio e conferência noturna (`ledi-conferencia-noturna`); 18 rotinas no `pg_cron`; PDF no aparelho | — | — |
| 21 | Cache no Redis | NÃO SE APLICA | O motivo vale: uma unidade, produção sem equipe, banco em 1 a 2 ms | — | — |
| 22 | SSR, SSG ou ISR | **FALTA** (em parte) | Continua sem pasta `api/` e sem funções na Vercel. Mas o motivo "o site público é Next.js" deixou de valer para a raiz: desde o caminho C (J1 a J5, 12/11), a página pública de `www.chefecoruja.com.br/` é o `src/pages/landing/Landing.tsx`, desenhada no navegador (`routes/RequireAuth.tsx:8` e `:24-30`). O HTML chega vazio, sem `meta description`; LCP 5,07 s e SEO 83 no Lighthouse de hoje. As telas logadas seguem fora | médio para a página pública (LCP 5,07 s); nenhum para quem usa o app | pequeno (só meta) a grande (pré-desenhar no build); decisão do RT (pergunta P3) |
| 23 | Servidor na mesma região do banco | NÃO SE APLICA | O motivo vale: sem funções na Vercel, navegador direto no Supabase sa-east-1, borda `gru1`. A região do VPS não consta em `infra/` | — | — |
| 24 | Várias instâncias atrás de balanceador | NÃO SE APLICA | O motivo vale: Vercel e Supabase gerenciados; limites em `ITEM-32-CARGA-HOMOLOGACAO.md` | — | — |
| 25 | Corrigir N+1 | FEITO | Lotes do #509 de pé (`loteador` passa). Telas novas por amostragem: as leituras por paciente só rodam com a linha aberta (`SinaisVitaisUbs.tsx:76-82`) ou num paciente só (`AvisoSepseAtendimento` em `porta/AbaAtendimento.tsx:142` e `AbaConduta.tsx:225`) | — | — |
| 26 | Índices nas consultas mais comuns, com EXPLAIN | FEITO, com pendência pequena | #517 de pé (migration `20270320000002`). As 46 tabelas criadas depois de 09/11 conferidas no código: nenhuma política RLS nova com `auth.uid()` sem `(select …)`. Chaves sem índice nas tabelas que crescem: `avisos_sepse_atendimento.episodio_id` (só o índice parcial de `evento = 'exibido'`, `20270416000001:281`, e a consulta de `'dispensado'` em `:339` e em `20270418000095:198` não usa) e `paciente_id` em `avisos_sepse_atendimento` (`20270416000001:270`) e `alertas_sepse_internacao` (`20270418000095`). Sem EXPLAIN hoje (sem SQL) | sem medição; baixo pelo volume | pequeno, migration |
| 27 | Só as colunas necessárias | **FALTA** (em parte) | Guarda `semSelectEstrela` passa, mas só pega `select('*')` exato. Escapam três `select('*, …')` com junção, anteriores a 09/11: `hooks/usePedidosEscala.ts:30` (`solicitacoes_escala`, roda na casca pela `EscalaEquipe`), `:47` (`candidaturas_escala`) e `pages/InternacaoPainel.tsx:101` (`transferencias_paciente`) | baixo (limites de 100, 200 e 30 linhas) | pequeno, só frontend |
| 28 | Pool de conexões | NÃO SE APLICA | O motivo vale: o app usa `supabase-js` por HTTP; o Hermes tem pool (`hermes/src/lib/pg.ts`); o assinador novo também (`services/assinador/src/real.ts:73`, `max: 3`) | — | — |
| 29 | OpenTelemetry | NÃO SE APLICA | O motivo vale. O assinador é uma segunda etapa de backend (navegador → assinador → provedor e Supabase), mas está desligado; revisitar quando ligar | — | — |
| 30 | Web Vitals de usuários reais | FEITO | `lib/sentry.ts:155` (`TAXA_METRICAS = 1`), `:172-181`; guardas `metricaReal` e `rotaSemIdentificador` passam; o Lighthouse viu os envios ao Sentry na produção. Amostras: não conferidas (sem acesso) | — | — |
| 31 | Teste no celular e em rede lenta; metas LCP < 2,5 s, INP < 200 ms, CLS < 0,1 | **FALTA** (LCP) | Login: LCP 6,47 s (simulado, mediana de 3) e 4,75 s (limite real, 1 execução); CLS 0; TBT 0. Página `/`: LCP 5,07 s. INP: não medido (Sentry). Telas logadas: medição de 16/11 (LCP 0,9 a 1,7 s, sem limite de rede) | alto no primeiro acesso em 4G: LCP do login 2 a 4 s acima da meta | médio, só frontend (plano F1) |

## 3. Regressões

**Uma, leve: o JavaScript inicial cresceu.** Em 09/11 eram 342 KB em gzip (`ITEM-21`; 342,8 KB depois do item 30). Hoje são 358,4 KB no build de `34a0d201` e 359,6 KB na produção: +16 KB (+4,7%). Os módulos novos que entraram no pacote de entrada depois de 09/11 (bytes de código minificado, pelo mapa de fontes):

| Módulo | Bytes | Entrou em | Por quê está no início |
|---|---|---|---|
| `components/ui/area-de-anexo.tsx` + `lib/anexo.ts` | 6.237 + 1.830 | 10/11, #567 | `GateCheckIn.tsx:6` e `casca/ForaDoExpediente.tsx:10` importam `EscalaEquipe`, que importa `PedidosEscala.tsx:20`, que importa a área de anexo |
| `casca/BarraMedico.tsx` | 4.780 | 23/11, #1077 | `AppShell.tsx:30` |
| `domain/primeirosPassos.ts` + `casca/PrimeirosPassos.tsx` + `hooks/usePrimeirosPassos.ts` | 4.436 + 2.079 + 720 | 23/11, #1081 | `AppShell.tsx:37` |
| `content/sobreModuloClinico.ts` | 2.200 | 17/11, #908 | `App.tsx:13` importa só a constante `ROTA_SOBRE_MODULO` e leva o texto junto |

A guarda `pacoteInicial` não pega isso: ela confere a configuração do `manualChunks`, não o tamanho.

**O resto foi achado, sem dar para chamar de regressão:**

- `select('*, …')` em três leituras (pedido 27) e quatro buscas sem espera (pedido 3): já existiam em 09/11 e escaparam da guarda ou da lista do item.
- LCP do login: em 08/11 era 5,2 s com o `logo.png` de 5,7 MB; o número depois das correções de 09/11 não foi registrado. Hoje: 6,47 s simulado e 4,75 s com limite real. A auditoria já dizia "investigar à parte" (seção 6). Desde o #994 (19/11), o elemento do LCP simulado passou a ser o botão "Aguardando a verificação…".
- `precache.json` lista um arquivo que não existe (`/assets/geist-mono-DCUBnTp4.js`, 404 na produção), porque a importação só de CSS em `entrada/LadoMarca.tsx:5` vira um pedaço vazio que o Vite apaga depois de o plugin (`vite.config.ts:38-47`) montar a lista. O `sw.js` (`public/sw.js:71-86`) tenta de novo a cada carga: um 404 por abertura. Já existia em 09/11 (sem mudança de dependência desde então). A pré-carga sem conexão baixa 97 arquivos, 671 KB em gzip, depois da primeira carga (eram 71 arquivos em 09/11).
- `sw.js` com `max-age=14400` na borda e o Web Analytics da Cloudflare injetado e bloqueado pela CSP (pedidos 7 e 14): não há registro de como estavam em 09/11.

## 4. Plano do que falta

Ordem por impacto e esforço. Cada item é um branch e um PR (`desempenho/<id>`, base `master`), homologação antes da produção. Itens que mexem no mesmo arquivo estão juntos; nenhum arquivo aparece em dois itens. Antes de começar cada um, conferir as linhas de novo no master do dia.

### F1. Login mais rápido no 4G (pedidos 31, 6 e 10) — P2

- **Telas:** `/login` e a entrada de qualquer tela (todo mundo baixa o pacote de entrada).
- **Arquivos e o que muda:**
  1. `src/App.tsx:14` e `:231`: `AppShell` passa a `lazy(() => import('@/components/AppShell').then((m) => ({ default: m.AppShell })))`. O `<Suspense>` de `App.tsx:215` já cobre. Sai do pacote de entrada a casca, o catálogo da Central (`content/registry.tsx`, pelo `casca/fontesPaleta.ts:3`), o `cmdk`, o chat, a `EscalaEquipe` e a área de anexo.
  2. `src/App.tsx:13`: importar `ROTA_SOBRE_MODULO` de um arquivo novo, `src/content/rotaSobreModulo.ts`, só com a constante; `src/content/sobreModuloClinico.ts` passa a reexportar de lá (os outros três que importam, `central/InicioCelular.tsx:7`, `plantonista/ToolLayout.tsx:12` e `PlantonistaHome.tsx:10`, não mudam).
  3. `vite.config.ts`: plugin novo (no padrão do `precacheSemConexao`, `:38-47`) com `transformIndexHtml` em `order: 'post'` que lê o `bundle` e injeta no `<head>`: `<link rel="modulepreload">` do pedaço do `src/pages/Login.tsx` e das importações dele; `<link rel="preload" as="font" type="font/woff2" crossorigin>` do `geist-latin-wght-normal-*.woff2`; e `<link rel="prefetch">` (prioridade baixa) do pedaço do `AppShell`, para quem já está logado não esperar uma ida a mais. Alternativa mais simples ao modulepreload: importar o `Login` de forma estática em `App.tsx:21` (o `Login` já está na pré-carga sem conexão, então quem está logado já o baixa).
  4. `vite.config.ts:106`: apagar a linha do `framer-motion` (dependência removida no #520).
  5. Orçamento do pacote inicial: `src/lib/orcamentoPacote.ts` (função pura que recebe o HTML e os tamanhos e soma os `.js` citados) e `scripts/orcamento-pacote.mjs` (lê `dist/`, aplica o gzip e falha acima do teto). Passo novo no `.github/workflows/ci.yml`, logo depois de "Build (tsc + vite)" (`ci.yml:54-55`): `node scripts/orcamento-pacote.mjs dist <teto>`. Teto: o número medido depois da mudança + 5%.
- **Migration:** não.
- **Testes:** `src/lib/pacoteInicial.test.ts` ganha: (a) o `App.tsx` não tem `import { AppShell } from` estático; (b) o `App.tsx` não importa `@/content/sobreModuloClinico`; (c) o `vite.config.ts` tem o plugin da pré-carga do login. Novo `src/lib/orcamentoPacote.test.ts` (no padrão de `preconnectSupabase.test.ts`): soma certa num `dist` falso, ignora `.css`, falha acima do teto. Os dois devem falhar no master.
- **Medir antes e depois:** o pacote inicial pelo script do item 5 (hoje 358.427 bytes em gzip, 19 arquivos); o Lighthouse do login com o mesmo comando, 3 vezes, mediana (hoje LCP 6,47 s, JS sem uso 177 KB) e com `--throttling-method=devtools` (hoje LCP 4,75 s, `Login-*.js` pedido em 3,67 s). Nas telas logadas, pedir ao RT a medição pela Performance API na homologação (Central, Plantão, Atendimento, Enfermagem), comparando com 16/11.
- **Risco:** comportamento: baixo, mas a casca passa a chegar depois do pacote de entrada; quem recarrega uma tela logada pode ver o spinner de tela cheia um instante a mais se o prefetch não tiver terminado (medir). Erro de pedaço ausente depois de deploy já é tratado (`main.tsx:78-87`). O `precache.json` muda de conteúdo (o `AppShell` vira pedaço próprio; continua entrando pelas importações das telas sem conexão, conferir no build). Visual: nenhum.
- **Esforço:** médio, só frontend e CI.

### F2. Esqueleto e estado de carga nas telas principais (pedido 1) — P2 pelo `/plantao`, P3 o resto

- **Telas e arquivos:** `src/pages/plantao/PlantaoHome.tsx:46-61`, `:78`, `:95`, `:103` (enquanto `presenca` e `faixa` carregam, mostrar `Skeleton` no selo e nos dois cartões, nunca "Check-in pendente", "Sem setor na escala agora" ou "Ninguém em observação"; usar `isLoading` das duas consultas); `src/pages/enfermagem/InicioEnfermagem.tsx:16`; `src/pages/enfermagem/ProntoSocorroEnfermagem.tsx:105` e `:145`; `src/pages/plantao/porta/FilaPS.tsx:322`; `src/components/internacao/ListaInternados.tsx:182`; `src/pages/MeuPlantao.tsx:220-222`; `src/pages/gestor/PainelGestor.tsx:73`; `src/components/TabsPagina.tsx:84-88`; e as telas novas `src/pages/plantao/Passometro.tsx:130`, `src/pages/vacina/LotesVacina.tsx:51`, `src/pages/enfermagem/SinaisVitaisUbs.tsx:56`, `src/pages/admin/UsoDoApp.tsx:101`, `src/pages/admin/SisabAba.tsx:58` e `:196`, `src/pages/Tecnovigilancia.tsx:21`, `src/pages/vacina/SalaVacina.tsx:128`. Trocar o spinner por `EsqueletoLinhas` (`src/components/ui/esqueleto-linhas.tsx`) com o número de linhas e o rótulo de cada tela. Spinner em botão (`isPending`) fica como está. O código do `InternacaoPainel.tsx:254` muda no F3 (mesmo arquivo do pedido 27); este item só o acrescenta ao teste, por isso entra depois do F3.
- **Migration:** não.
- **Teste:** acrescentar as telas à lista `TELAS` de `src/lib/esqueletos.test.ts` (padrão atual: regex do carregamento antigo + exigência de `<EsqueletoLinhas` ou `<Skeleton`). Para o `PlantaoHome`, um caso próprio: o arquivo não pode ter `'Check-in pendente'` fora de um ramo que confira o fim da carga (por exemplo, exigir `isLoading` no arquivo e `<Skeleton` no selo).
- **Medir:** CLS e LCP pela Performance API na homologação, com o RT, antes e depois em `/plantao`, `/enfermagem` e `/gestao`; depois, o CLS por rota no Sentry.
- **Risco:** visual pequeno (faixas cinza no lugar do círculo). Nenhuma mudança de dado.
- **Esforço:** médio (muitos arquivos, troca mecânica), só frontend.

### F3. `select('*, …')` e esqueleto do painel de internação do gestor (pedidos 27 e 1) — P3

- **Arquivos:** `src/hooks/usePedidosEscala.ts:30` e `:47`; `src/pages/InternacaoPainel.tsx:101` (colunas) e `:254` (esqueleto); `src/lib/semSelectEstrela.test.ts`.
- **O que muda:** trocar o `*` pelas colunas que a tela usa. Base: os tipos `SolicitacaoComExtra`, `CandidaturaComExtra` (`usePedidosEscala.ts`, no começo do arquivo) e `TransferenciaPaciente` (`src/types`), conferidos contra `src/types/database.ts`, como no `ITEM-24`. No `InternacaoPainel.tsx:254`, `EsqueletoLinhas`.
- **Migration:** não.
- **Teste:** a regex da guarda (`semSelectEstrela.test.ts:30`) passa a pegar `select('*` seguido de `)` ou de `,` (por exemplo `/\.select\(\s*['"`]\*\s*(['"`]|,)/`); a exceção do `AuthContext` continua. Falha no master com os três achados. Este item não mexe em `esqueletos.test.ts`: o F2, que é dono desse teste, acrescenta o `InternacaoPainel.tsx` à lista. Por isso o **F3 entra antes do F2**.
- **Medir:** tamanho da resposta de `solicitacoes_escala` e `candidaturas_escala` na homologação (aba Rede do navegador, com o RT), antes e depois.
- **Risco:** coluna esquecida dá erro 400 ou campo vazio na Escala do gestor e no painel de transferências. Conferir as três telas na homologação com conta de gestor.
- **Esforço:** pequeno, só frontend.

### F4. As quatro buscas sem espera (pedido 3) — P3

- **Arquivos:** `src/pages/plantao/porta/AbaExames.tsx:114-119`; `src/pages/regulacao/Regulacao.tsx:312-316`; `src/pages/PreferenciasPrescricao.tsx:151-160`; `src/pages/ReferenciaDiluicao.tsx:68-80`; `src/lib/buscaComEspera.test.ts`.
- **O que muda:** `const termoAdiado = useValorAdiado(termo)` e usar o valor adiado na chave e na consulta, como nas 18 do #511. O campo continua mostrando o que se digita. Em `ReferenciaDiluicao.tsx:70` (`enabled: true`), a lista inicial sem termo continua igual.
- **Cancelamento:** fora deste item, pela opção conservadora (pergunta P5). Se o RT quiser, o mesmo PR põe `.abortSignal(signal)` nas quatro consultas (o `queryFn` recebe `{ signal }` do TanStack Query).
- **Migration:** não.
- **Teste:** acrescentar as quatro ao array `BUSCAS` de `buscaComEspera.test.ts`, com as chaves `buscar-exames`, `regulacao-busca-paciente`, `busca-medicamento` e `medicamento-catalogo`. Falha no master.
- **Medir:** contar as chamadas ao digitar "dipirona" na aba Rede (hoje até 6; depois 1).
- **Risco:** 300 ms a mais até a lista aparecer. Nenhum visual.
- **Esforço:** pequeno, só frontend.

### F5. `precache.json` sem arquivo inexistente — P3

- **Arquivos:** `src/lib/offline/precache.ts:30-47` (`listaPrecache`) e `src/lib/offline/precache.test.ts`.
- **O que muda:** pular o pedaço cujo código está vazio (só CSS), mantendo o `importedCss` dele. O tipo `Chunk` ganha `code?: string`. Se no build o código ainda vier preenchido, a alternativa é o plugin conferir o pedaço no `writeBundle` e regravar o `precache.json` com `fs`.
- **Migration:** não.
- **Teste:** caso novo em `precache.test.ts` com um `bundle` falso que tem um pedaço de código vazio e CSS importado: o `.js` não entra, o `.css` entra. Conferência no build: todo caminho do `dist/precache.json` existe em `dist/` (hoje falta `/assets/geist-mono-DCUBnTp4.js`).
- **Medir:** na produção, `curl` do `precache.json` e um `curl -I` em cada caminho: zero 404.
- **Risco:** nenhum para a tela.
- **Esforço:** pequeno, só frontend.

### F6. Borda: CSP sem Google Fonts, Web Analytics e `sw.js` (pedidos 7, 10 e 14) — P3

- **Arquivos:** `vercel.json:25` e `:37` (tirar `https://fonts.googleapis.com` do `style-src` e `https://fonts.gstatic.com` do `font-src`, nas duas CSPs); `infra/cloudflare.md` (registrar as decisões); teste novo `src/lib/cspSemTerceirosSemUso.test.ts`: as duas CSPs do `vercel.json` não citam `fonts.googleapis.com` nem `fonts.gstatic.com`, e nenhum arquivo de `src/` ou o `index.html` cita esses domínios.
- **Ações no painel da Cloudflare (do RT, sem código):** desligar a injeção automática do Web Analytics (Analytics & Logs → Web Analytics → zona `chefecoruja.com.br`), ou decidir liberá-lo na CSP (pergunta P4); criar uma regra de cache "Bypass" para `/sw.js` (ou "respeitar o cabeçalho da origem") e expurgar o `/sw.js` da borda.
- **Migration:** não.
- **Medir:** `curl -I https://www.chefecoruja.com.br/sw.js` deve mostrar `cache-control: no-cache` e `cf-cache-status` `DYNAMIC` ou `BYPASS`; `curl` do `/login` com cabeçalho de navegador não deve trazer `cloudflareinsights`; o Lighthouse não deve listar `static.cloudflareinsights.com`.
- **Risco:** a CSP mais fechada vale na hora do merge, na produção inteira; se algo usar Google Fonts escondido, a fonte cai para a reserva (nenhum uso achado). Passar pela homologação e olhar o console.
- **Esforço:** pequeno: configuração e painel.

### F7. Prazo nas chamadas do assinador ICP-Brasil (pedido 18) — P2, antes de ligar a LG7

- **Arquivos:** `services/assinador/src/docicp17.ts:67`, `:81`, `:97`; `services/assinador/src/real.ts:16`, `:58`, `:63`; `src/lib/assinador.ts:17`; testes em `services/assinador/tests/docicp17.test.ts` e `src/lib/assinador.test.ts` (novo, ou no teste que já cobre `assinadorPuro`).
- **O que muda:** `signal: AbortSignal.timeout(LIMITE_MS)` em cada `fetch` (sugestão: 15 s para o provedor, 10 s para o Supabase, 20 s no navegador, que espera o assinador inteiro). No estouro, o assinador responde 504 com texto claro ("o provedor do certificado não respondeu; o documento foi emitido e pode ser assinado de novo") e relata ao Sentry, como o `enviar-codigo-2fa`. No navegador, `assinarSeDer` já trata erro como `'erro'` sem bloquear a emissão (`src/lib/assinador.ts`, fim do arquivo). Sem nova tentativa automática na assinatura (assinar duas vezes não é inofensivo).
- **Migration:** não.
- **Teste:** em `docicp17.test.ts`, um `Fetch` falso que nunca responde: a chamada rejeita depois do limite (limite injetável para o teste rodar rápido); guarda de texto: cada `await f(` dos dois arquivos tem `signal`. No `src/lib`, guarda: `assinador.ts` chama `fetch` com `AbortSignal.timeout`. Os dois falham no master. O CI já roda `npm test` em `services/assinador` (`ci.yml:104-109`).
- **Medir:** não há número hoje (desligado). Na homologação com provedor real, o tempo de cada etapa no log do assinador.
- **Risco:** limite curto demais recusa assinatura lenta, mas válida; começar folgado.
- **Esforço:** pequeno: serviço do VPS (publicar pelo roteiro de `infra/assinador.md`) e frontend.

### F8. Índices das tabelas de sepse (pedido 26) — P3, só se o EXPLAIN mostrar

- **Antes do código:** na homologação, só leitura, `EXPLAIN ANALYZE` da consulta de `aviso_sepse_atendimento` (`20270416000001:338-339`) e do relatório de desempenho do alerta (`20270418000095:191-198`), com massa de teste. Se der `Seq Scan` em `avisos_sepse_atendimento`, seguir.
- **Migration nova (expand, reaplicável):** `CREATE INDEX IF NOT EXISTS avisos_sepse_atendimento_episodio_idx ON public.avisos_sepse_atendimento (episodio_id, nivel, evento);` `CREATE INDEX IF NOT EXISTS avisos_sepse_atendimento_paciente_fk_idx ON public.avisos_sepse_atendimento (paciente_id);` `CREATE INDEX IF NOT EXISTS alertas_sepse_internacao_paciente_fk_idx ON public.alertas_sepse_internacao (paciente_id);`. Rollback: três `DROP INDEX IF EXISTS`. Tabelas pequenas hoje, sem `CONCURRENTLY` (a migration roda em transação).
- **Teste:** `supabase/tests/desempenho_26_indices_sepse.sql`: os três índices existem (`pg_indexes`). E a guarda de migrations destrutivas do CI.
- **Medir:** o mesmo `EXPLAIN ANALYZE` antes e depois.
- **Risco:** nenhum para a tela; escrita um pouco mais cara (desprezível).
- **Esforço:** pequeno, migration (homologação, CI do banco verde, "ok produção").

### F9. Limpeza de `public/` e imagens da página pública (pedidos 11 e 5) — P3

- **Arquivos:** apagar `public/plantao/MODELO_EXAMES.png`, `public/plantao/background.png`, `public/login-img-1.svg` a `-4.svg` e `public/icons.svg` (nenhuma referência em `src/`, `index.html`, `public/sw.js`, manifest ou `vercel.json`; conferir de novo antes); atualizar `FRONTEND.md:615-616`; converter `public/landing/telas/porta.jpg`, `painel.jpg` e `escala.jpg` para WebP e trocar as extensões em `src/pages/landing/telas.ts:20`, `:28`, `:36`; recomprimir `public/logo-192.png` (66 KB) sem perda visível.
- **Migration:** não.
- **Teste:** novo `src/lib/publicSemOrfaos.test.ts`: cada arquivo de `public/` é citado por `src/`, `index.html`, `public/sw.js`, `public/manifest.webmanifest` ou `vercel.json`. no `reduzirImagem.test.ts`, o caso do tamanho do `logo-192.png` baixa o teto de 150 KB para o novo tamanho mais uma folga.
- **Medir:** Lighthouse do `/` (hoje 836 KB transferidos) e do `/login` (2.353 KB).
- **Risco:** visual na página pública (qualidade do WebP); conferir as três capturas.
- **Esforço:** pequeno, só frontend.

### F10. Página pública `/` (pedido 22) — depende da pergunta P3

- Opção conservadora (B), se o RT quiser: `index.html` ganha `<meta name="description" content="…">` (texto do RT). O F1 já encurta o caminho da página pública também.
- Opção A (pré-desenhar a raiz no build): plugin no `vite.config.ts` (o F1 já mexe nesse arquivo; por isso a opção A só entra depois do F1, em PR próprio) que gera o HTML do `Landing.tsx` e serve só em `/` sem sessão. Esforço grande e risco de a pessoa logada ver a página pública antes do redirecionamento. Não recomendo agora.
- **Medir:** Lighthouse do `/`, 3 vezes (hoje LCP 5,07 s, SEO 83).

## 5. Perguntas para o RT

**P1. Prioridade do F1 (login mais rápido).** A: entra como P2 depois da fila atual. B: P1, antes do que está na fila, porque o login é a primeira tela de toda pessoa nova e o LCP está 2 a 4 s acima da meta em 4G. **Recomendo A**: a produção ainda não tem equipe, e com Wi-Fi da unidade o login carrega bem abaixo disso (LCP observado sem limite: 1,08 s).

**P2. F1: Login pré-carregado ou importado direto.** A: plugin no `vite.config.ts` que põe o `modulepreload` do pedaço do Login e o `preload` da fonte no `index.html`. B: importar o `Login` de forma estática no `App.tsx` (mais simples; o pacote de entrada cresce uns 5 a 10 KB para todos). **Recomendo A**: mantém o pacote de entrada menor e quem está logado já baixa o Login pela pré-carga sem conexão.

**P3. Pedido 22: a página pública `/` desenhada no navegador.** A: pré-desenhar a raiz no build (SEO e LCP melhores; esforço grande e risco de a pessoa logada ver a página pública antes de ir para a tela dela). B: manter como está, pôr só a `meta description` e aproveitar o F1. **Recomendo B**, e reabrir A se o site público passar a depender de busca no Google.

**P4. Web Analytics da Cloudflare.** A: desligar a injeção automática no painel (a CSP já bloqueia; hoje só gera uma tentativa por página). B: liberar `static.cloudflareinsights.com` e o envio na CSP e passar a usar (mais um terceiro com dado de navegação, a registrar no inventário da LGPD, LG4). **Recomendo A.** Nesta sessão não mudei nada (opção conservadora).

**P5. Cancelar a busca anterior.** A: só o debounce nas quatro buscas que faltam (F4); sem cancelamento. B: também `.abortSignal(signal)` em todas as buscas (as 22), para a consulta antiga parar no servidor. **Recomendo A**: com 300 ms de espera e a busca de paciente em 1,6 ms no banco, o ganho do cancelamento é pequeno e mexe em 22 arquivos.

**P6. Gatilho dos itens 8, 9 e resto do 16.** A: o RT olha o Sentry (`tipo:metrica`, por `metrica`, `rota` e `papel`, tirando a janela de 22h00 a 22h10 de 23/11, que é do Lighthouse desta sessão) e diz o número de amostras e o p75 de INP e LCP por tela. B: manter fechados sem olhar até a primeira unidade entrar em uso. **Recomendo A** quando houver uso; hoje a produção não tem equipe, então B na prática.

**P7. Orçamento do pacote no CI (parte 5 do F1).** A: o CI falha quando o JS inicial passa do teto (+5% sobre o medido depois do F1). B: só avisar no log, sem falhar. **Recomendo A**: foi a falta dessa trava que deixou o pacote crescer 16 KB sem ninguém ver.
