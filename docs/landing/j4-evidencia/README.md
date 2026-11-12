# J4: evidência da seção "Telas" na página de entrada

Pedido 8, caminho C, J4. Conferido em 12/11/2026 num Edge sem janela, contra o servidor de desenvolvimento da branch `landing/j4-um-plantao`.

## Telas

- Capturadas na homologação em 12/11/2026, às 15:43, na UPA 24h Jardim Primavera, pela coordenadora fictícia (`scripts/demo/capturar-telas.mjs`, PR #627).
- Arquivos: `public/landing/telas/porta.jpg` (85 KB), `painel.jpg` (83 KB) e `escala.jpg` (118 KB). Todos em 1424 × 749.
- Nenhuma mostra "teste", "E2E", "F5", outra rede ou o menu de administrador.
- O teste `src/pages/landing/telas.test.ts` confere o tamanho, o peso abaixo de 250 KB e o texto alternativo de cada tela. Ele roda no CI, no passo "Página de entrada (telas)".

## Comportamento

| Conferência | Resultado |
|---|---|
| 1280 × 800, rolagem no começo, no meio e no fim da seção | Mostra porta, painel e escala, nessa ordem. O botão da tela atual fica marcado (`aria-pressed`) e a legenda acompanha |
| Botão "Escala" | Leva à escala e marca o botão |
| Quadro da tela em 1280 × 800 | Do pixel 236 ao 657, com 800 px de largura: título, legenda, tela e nota cabem juntos |
| Largura da página | 1280 em 1280 e 375 em 375: nada passa da largura |
| 375 × 812 | As três telas vêm em sequência, com 343 px de largura, sem rolagem presa e sem botões |
| Menos movimento | Transição de 0,01 ms: a troca acontece sem animação |
| Sem JavaScript | A primeira tela já aparece. A troca depende do script, mas o conteúdo não |

As fontes deram 403 no servidor de desenvolvimento do worktree, porque estão fora da pasta que o Vite libera. Isso não acontece no build.

## Imagens

- `1280-painel.png`: a seção em 1280 × 800, no meio da rolagem.
- `375-telas.png`: a seção no celular.
