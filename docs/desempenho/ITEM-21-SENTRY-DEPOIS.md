# Item 21: scripts de terceiros depois da página

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md`.

## Diagnóstico

- Turnstile (Cloudflare) já era baixado só no login, sob demanda.
- O Sentry entrava no pacote inicial (`src/main.tsx` → `src/lib/sentry.ts` → `@sentry/react`): cerca de 28 KB em gzip que todo usuário baixava antes de ver a tela.

## Correção (só frontend, sem migration)

- `src/lib/sentry.ts` só importa tipos do `@sentry/react`. A inicialização baixa `src/lib/sentryCarga.ts` por import dinâmico depois do `load`, quando o navegador fica ocioso (`requestIdleCallback`, até 5 s; sem ele, 1,5 s).
- `src/lib/sentryCarga.ts` exporta só `init`, `withScope` e `captureMessage`. Um `import('@sentry/react')` direto levaria a biblioteca inteira: 154 KB em gzip, contra 28,8 KB assim.
- `src/lib/filaAteCarregar.ts`: o que `reportarErro` mandar ao Sentry antes de ele carregar espera numa fila de até 20 erros e sai na ordem. O registro no banco (`registrar_erro_cliente`) continua na hora, sem fila.
- O desenho LGPD não muda: mesma inicialização, sem integrações, sem breadcrumbs, `beforeSend` limpando.

## Medição (build local, 09/11/2026, depois do item 22)

| | Antes (master com o 22) | Depois |
|---|---|---|
| JavaScript inicial em gzip | 370.611 bytes | 342.144 bytes (−7,7%) |
| Sentry | no pacote inicial | `sentryCarga-*.js`, 28,8 KB em gzip, depois da pintura |

Desde o começo da trilha (antes dos itens 22 e 21): 504 KB → 342 KB em gzip (−32%).

## Conferência

- Build servido localmente: o login monta sem erro; o pedaço `sentryCarga` não está na pré-carga do `index.html` e, importado, expõe `init`, `withScope` e `captureMessage`. No build local o Sentry fica inerte (sem DSN), como antes.
- `src/lib/filaAteCarregar.test.ts` (5 casos): fila antes de carregar, envio direto depois, teto de 20, falha de um item não derruba os outros, e o `sentry.ts` sem import estático da biblioteca. Falha no master.
- `npm run lint`, `npm run typecheck`, `npm run build` e os testes de `src/lib` passaram.

## Medição na tela logada

Pendente para quando o RT voltar ao computador. O item 30 (métricas de usuários reais) passa a medir as telas logadas.

## Como reverter

Reverter o commit deste item.
