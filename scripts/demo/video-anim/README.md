# Vídeo de venda animado (backlog comercial, item 8)

Versão em blocos animados, no estilo dos três modelos que o RT mandou em 15/11/2026: cenas filmadas, notebook com a tela do produto, telas inclinadas em 3D, recortes saltando da interface, gráficos e texto animados. A narração (`docs/comercial/video/narracao.json`) e a trilha (`scripts/demo/trilha.py`) são as mesmas da versão narrada.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `blocos.json` | Um bloco por fala: tipo (abertura, tela3d, clipe, gráficos, tema, dispositivos, segurança, fechamento), imagem ou trecho gravado, título, legenda e recortes (em pixels da tela de 1920 × 1080) |
| `video.html` | O motor: monta os blocos e expõe `window.renderizar(t)`, que desenha o quadro do instante `t`. Nada anima sozinho: o tempo vem de fora, quadro a quadro, por isso a imagem não treme |
| `preparar.mjs` | Mede cada fala, monta a linha do tempo, extrai os quadros dos trechos gravados e grava `assets/blocos.js`, `falas-video.json` e a trilha |
| `previa.mjs` | Tira um quadro de cada bloco, para conferir antes de renderizar |
| `animar.mjs` | Renderiza todos os quadros no navegador e monta o MP4 com narração e trilha (a música abaixa quando a voz fala) |

## Pasta de trabalho (fora do git)

Rode numa pasta de trabalho com `video.html`, `blocos.json` e `assets/`:

- `assets/porta.jpg` e `assets/still/*.jpg`: quadros das gravações do `gravar-video.mjs` (nomes em `blocos.json`);
- `assets/corredor/0001.jpg…`: 8 s do clipe do Pexels 6130553, a 30 quadros por segundo;
- `assets/coruja.webp`: cópia de `public/landing/coruja.webp`.

```bash
FFMPEG=".../ffmpeg.exe" node preparar.mjs blocos.json <narracao.json> <pasta das gravações> <pasta das falas>
node previa.mjs 0.8
FFMPEG=".../ffmpeg.exe" node animar.mjs video.html <segundos> video-animado.mp4 falas-video.json
```

## Clipes do Pexels

Baixados com o ok do RT em 15/11/2026, licença do Pexels (uso comercial livre, sem crédito obrigatório; não pode sugerir que as pessoas filmadas apoiam o produto). Não vão para o git.

- 6130553 — profissionais conversando no corredor do hospital (usado na abertura);
- 8381605 — profissional andando no corredor;
- 6129925 — enfermeira empurrando cadeira de rodas.
