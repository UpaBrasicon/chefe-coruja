# Item 15: aviso de versão nova, com "Atualizar"

Achado: achado 2 da conferência das telas de 08/11/2026 (`CONFERENCIA-TELAS-08NOV.md`), P2.

Pedido: o RT pediu a correção em 08/11/2026 ("Sim, corrige"). Só frontend, sem migration.

Branch: `correcoes/aviso-versao-nova`.

## O que acontecia
- Depois de uma publicação, quem estava com o app aberto continuava com a versão antiga.
- O app é de página única: a navegação entre telas não recarrega o código. Ele só troca numa carga completa da página.
- Os cabeçalhos da Vercel estão certos. `/` e as rotas voltam com `max-age=0, must-revalidate`, e `/index.html` e `/sw.js` com `no-cache`. O service worker busca a navegação sempre na rede. Uma carga completa já traz a versão nova.
- Já existia a recarga quando falta um pedaço do código (`vite:preloadError`, em `recargaDeploy.ts`). Ela só age quando a pessoa abre uma tela ainda não carregada.

## Decisão
- O app confere o `index.html` publicado:
  - quando a aba volta a ficar visível ou ganha foco;
  - a cada 5 minutos com a aba visível;
  - só no build publicado.
- Se o script principal do build (`/assets/index-<hash>.js`) mudou, aparece embaixo, no centro: "Há uma versão nova do Chefe Coruja. Salve o que estiver fazendo e atualize." O aviso tem o botão "Atualizar".
- Não recarrega sozinho: pode haver um formulário em curso.
- Na dúvida, não avisa: sem script na página publicada (erro, fora do ar) ou sem script carregado (dev), nada aparece.

## Feito
- `src/lib/versaoNova.ts` e teste: acha o script principal e decide se mudou. O teste falhou antes do código e passa com ele (5 de 5).
- `src/components/AvisoVersaoNova.tsx`: a conferência e o aviso, montado em `main.tsx` ao lado do `App`. Vale para todas as telas, inclusive o login e a página inicial.
- `tsc` e `eslint` limpos.

## Conferência
Feita no build local (`vite build` e `vite preview`, no navegador do Claude):
1. A versão 1 (`index-CuZxu7sq.js`) foi aberta, sem aviso.
2. A versão 2 (`index-Bap7aYy9.js`) foi gerada com o servidor rodando.
3. Ao voltar o foco para a aba, o aviso apareceu.
4. "Atualizar" recarregou a página. A aba passou a usar `index-Bap7aYy9.js`, e o aviso sumiu.

Na homologação, o aviso só aparece a partir da publicação seguinte à que trouxer esta mudança.
