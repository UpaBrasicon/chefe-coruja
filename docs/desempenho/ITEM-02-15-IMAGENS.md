# Itens 02 e 15 — Imagens leves e carregadas só quando aparecem

Trilha de desempenho (kit de 31 passos), pedido do RT em 08/11/2026. Auditoria em `docs/desempenho/AUDITORIA.md`.

## Diagnóstico

- `public/logo.png`: PNG de 2048×2048, 5.883.299 bytes, ícone do `manifest.webmanifest` (declarado 512×512) e do aviso do `sw.js`. O Chrome baixava o ícone ao abrir o app: no Lighthouse do login da produção eram 5.747 KB de 8.229 KB.
- `public/fundo-login.png` (5,9 MB) e `public/logo-login.png` (5,2 MB): nenhum arquivo do app usava; iam para o deploy.
- Banner, foto do perfil e arte do painel subiam no tamanho original (foto de celular de vários MB). O banner aparece na lateral de toda tela.
- Nenhuma `<img>` tinha `loading="lazy"`.

## Correção (só frontend, sem migration)

- `public/logo.png` refeito em 512×512 (436.917 bytes, 93% menor) e `public/logo-192.png` novo (66.541 bytes). O manifest declara os dois; o Chrome usa o de 192 px na maior parte dos casos. O aviso do `sw.js` usa o de 192 px.
- `public/fundo-login.png` e `public/logo-login.png` apagados; `FRONTEND.md` atualizado.
- `src/lib/reduzirImagem.ts`: antes de subir, a imagem é reduzida no aparelho ao tamanho em que aparece e vira WebP (qualidade 0,82). Banner até 1600 px (`src/lib/api.ts`), foto do perfil até 512 px (`src/pages/Perfil.tsx`), arte do painel da TV até 1920 px (`src/pages/recepcao/PropagandaPainel.tsx`). Se falhar, se o navegador não fizer WebP ou se não ficar menor, sobe o original. GIF e SVG passam como estão. Os três buckets aceitam WebP (`painel` tem a lista PNG, JPEG e WebP; `banners` e `fotos` não têm lista).
- `loading="lazy"` nas listas: banners da tela do gestor e artes do painel na recepção. A lateral, a Central e a TV ficam sem, porque são a imagem principal visível.

## Teste

`src/lib/reduzirImagem.test.ts` (6 casos): medida reduzida mantém a proporção e nunca aumenta; nome vira `.webp`; só PNG, JPEG e WebP são reduzidos; os três envios passam pela redução; `logo.png` abaixo de 600 KB e `logo-192.png` abaixo de 150 KB. Falha no master (logo de 5,9 MB e envios sem redução) e passa aqui.

Também passaram: `npm run lint`, `npm run typecheck`, `npm run build` e 461 testes de `src/lib`.

## Medição

Antes (Lighthouse, login da produção, celular, 4G lento, mediana de 3, 08/11/2026): nota 68, LCP 5,2 s, 8.229 KB transferidos, dos quais 5.747 KB do `logo.png`. O depois é medido do mesmo jeito na produção depois do merge e fica registrado no BACKLOG.

## Como reverter

Reverter o commit deste item. Sem banco nem configuração.
