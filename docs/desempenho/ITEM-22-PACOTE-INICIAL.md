# Item 22 — JavaScript por tela (pacote inicial)

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md`.

## Diagnóstico

103 telas já vinham sob demanda (`lazy(`). Mas o `manualChunks` do `vite.config.ts` mandava toda dependência não listada para um `vendor-other` único, baixado ao abrir o app. Com isso iam para o início as dependências das bibliotecas que só abrem sob demanda: `pako`, `canvg`, `core-js`, `fflate` e `dompurify` (do jsPDF); `@reduxjs/toolkit`, `immer`, `decimal.js-light` e `es-toolkit` (do Recharts). `vendor-other` tinha 539 KB, 178 KB em gzip.

## Correção (só build, sem migration)

`vite.config.ts`: o `manualChunks` continua separando React, roteador, TanStack Query, Supabase, Base UI, cmdk, ícones e formulários (cache estável entre versões). O resto deixa de ir para o `vendor-other`: o Vite põe cada dependência junto de quem a usa.

## Medição (build de `37c4c004`, 09/11/2026)

| | Antes | Depois |
|---|---|---|
| JavaScript inicial (entrada + pré-carga do `index.html`) | 18 arquivos, 1.625.847 bytes, **504.237 em gzip** | 18 arquivos, 1.218.483 bytes, **370.611 em gzip** |

**−26% em gzip.** O Sentry (cerca de 31 KB em gzip) ainda vai no inicial, dentro do pedaço do `supabase`; sai no item 21.

## Conferência

- Build servido localmente (`vite preview`, apontando para o Supabase local desligado, sem tocar homologação nem produção): o login monta sem erro no console; os pedaços sob demanda de jsPDF, Recharts, html2canvas e pdf.js carregam; o jsPDF gerou um PDF de teste.
- A lista de pré-carga sem conexão (`precache.json`) continua sendo gerada (71 arquivos; eram 70).
- `src/lib/pacoteInicial.test.ts`: o `manualChunks` não junta o resto num pedaço único e as libs pesadas continuam fora do mapeamento. Falha no master.
- `npm run lint`, `npm run typecheck`, `npm run build` e 465 testes de `src/lib` passaram.

## Como reverter

Reverter o commit deste item. Sem banco nem configuração da Vercel.
