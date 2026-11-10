# Item 30: medir usuários reais

Trilha de desempenho (kit de 31 passos). Na auditoria de 08/11/2026 o item ficou como "não se aplica por ora" (produção sem equipe). Decisão do RT em 09/11/2026: fazer agora, antes do 08; o item 26 (redesenho à toa) fica condicionado ao que o 30 mostrar.

## O que mede

As cinco métricas do `web-vitals` 5.1.0 (Google, Apache-2.0), em cada abertura do app na homologação e na produção:

| Métrica | O que é |
|---|---|
| LCP | tempo até o maior conteúdo da tela aparecer |
| INP | demora da tela para responder a um toque ou clique (o pior da visita) |
| CLS | quanto a tela "pula" enquanto carrega (em milésimos) |
| FCP | tempo até a primeira coisa aparecer |
| TTFB | tempo até o servidor responder |

Cada medição vai ao Sentry que já existe (`src/lib/sentry.ts`) como mensagem de nível "info", agrupada por métrica e rota. Para ver: no Sentry, filtrar `tipo:metrica` e agrupar pelos marcadores `metrica`, `rota` e `papel`; o valor está no marcador `valor` (milissegundos; CLS em milésimos) e a nota do Google em `nota` (`good`, `needs-improvement`, `poor`).

## Privacidade

Por medição vão só cinco marcadores (`src/lib/metricaReal.ts`):

- `metrica`: LCP, INP, CLS, FCP ou TTFB (outro nome é recusado);
- `valor`: número inteiro;
- `nota`: a classificação do `web-vitals`;
- `rota`: o caminho da tela sem nenhum identificador (`src/lib/rotaSemIdentificador.ts`). Lista branca: fica só o trecho que é nome de tela (minúsculas, hífen e sublinhado, sem dígito); UUID, número de paciente, atendimento ou regulação, CPF, CNS, e-mail e qualquer trecho com dígito, maiúscula ou símbolo viram `:id`; depois de `/r/`, `/painel/` e `/alta/` (links públicos) tudo vira `:token`; consulta (`?`) e âncora (`#`) saem inteiras; profundidade máxima de 6;
- `papel`: o papel ativo, só se for um dos papéis do sistema (senão `outro`).

Não vão: unidade, nome, CPF, CNS, texto de tela, endereço completo. O Sentry segue com o desenho LGPD da Fase 0 (sem integrações, sem breadcrumbs, `beforeSend` limpando).

## Como foi feito (só frontend, sem migration)

- O `web-vitals` desce depois que o Sentry carrega (item 21: depois da primeira pintura, com o navegador ocioso), num pedaço próprio de 2,3 KB em gzip, fora da pré-carga. O JavaScript inicial não mudou (342,8 KB em gzip). As métricas usam observadores com histórico (`buffered`), então LCP, FCP e TTFB da abertura são capturados mesmo assim.
- `TAXA_METRICAS = 1`: toda abertura é medida, porque o uso ainda é pequeno. Baixar quando o volume crescer, por causa da cota do Sentry.
- No computador de desenvolvimento (sem DSN do Sentry) nada é medido nem enviado, como os erros.
- Limite conhecido: o LCP e o FCP são da primeira tela aberta; o INP e o CLS valem para a visita toda e levam a rota em que a pessoa estava quando o navegador fechou a medição.

## Testes

- `src/lib/rotaSemIdentificador.test.ts` (7 casos), escrito antes: UUID e número viram `:id`; CPF, CNS, nome codificado, maiúscula e e-mail viram `:id`; links públicos viram `:token`; consulta e âncora saem; rotas do app ficam; profundidade e tamanho limitados.
- `src/lib/metricaReal.test.ts` (5 casos), escrito antes: só os cinco campos; CLS em milésimos; papel fora da lista vira `outro`; métrica fora da lista é recusada; o envio no `sentry.ts` usa `montarMetrica` e não manda a unidade.
- `src/lib/filaAteCarregar.test.ts` continua passando (as métricas usam a mesma fila do item 21).
- No build servido localmente, o pedaço do `web-vitals` carrega e mede (TTFB devolvido; FCP e LCP só saem com a aba à frente, como prevê a biblioteca).
- `npm run lint`, `npm run typecheck`, `npm run build` e os testes de `src/lib` passaram.

## Telas logadas

Este item passa a ser a medição das telas logadas que ficou pendente nos itens 03, 08, 21, 22 e 24: com a primeira pessoa usando a homologação ou a produção, os números de cada tela aparecem no Sentry. A medição com o Chrome do RT continua pendente para quando ele voltar ao computador.

## Como reverter

Reverter o commit deste item. Sem banco.
