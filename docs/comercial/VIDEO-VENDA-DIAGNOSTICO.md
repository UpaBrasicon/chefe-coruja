# Backlog comercial, item 8: vídeo de venda — diagnóstico

**Pedido do RT, 15/11/2026:** "faz a demo em vídeo para mim com um roteiro criado pelo Fable e produzido pelo Opus; no vídeo mostra todas as funcionalidades, da UBS à internação, da regulação ao tema claro e escuro, as ferramentas; cerca de até 5 minutos mostrando praticamente tudo. Um vídeo para venda."

O pedido não estava no backlog. O RT o incluiu como item 8 do backlog comercial, P2, e decidiu V1 a V5 = A ("Sim, todas A").

## Como está hoje

- **Rede de demonstração** (`scripts/demo/`): só a UPA 24h Jardim Primavera, com plantão em curso. Não tem UBS nem Central de Regulação; a tela Regulação diz "A rede ainda não tem Central de Regulação".
- **UBS e regulação com dados** existem só na rede de teste da Fase 5, com nomes de teste ("F5", "teste B05"). Não servem para um vídeo de venda.
- **Gravação:** o `playwright-core` já está no projeto, e o `capturar-telas.mjs` entra como a coordenadora fictícia por link de acesso único, sem conta real.
- **Montagem:** o ffmpeg não estava instalado.

## Decisões do RT (V1 a V5 = A)

- **V1, dados:** criar na rede de demonstração uma UBS e uma Central de Regulação fictícias, com nomes coerentes. Só roteiro da homologação, sem migration.
- **V2, gravação:** automática com o Playwright, em 1920×1080, como a coordenadora fictícia pelo link de acesso único. Nenhuma conta real aparece.
- **V3, voz:** legendas curtas na tela e, em separado, o texto da narração para o RT gravar por cima, se quiser.
- **V4, montagem:** ffmpeg oficial (gyan.dev) baixado numa pasta própria, fora do repositório, com o ok do RT.
- **V5, roteiro:** escrito por um agente no modelo Fable e produzido pelo Opus; aprovado pelo RT antes da gravação.

## Subtarefas

1. `scripts/demo/04_ubs_regulacao.sql`: UBS e Central de Regulação na rede de demonstração, com pacientes fictícios na agenda, no Hiperdia, no pré-natal e na puericultura, e pedidos de regulação.
2. Roteiro do vídeo (Fable): cenas, tempo de cada uma, legenda e narração. `docs/comercial/video/roteiro-video.md`.
3. `scripts/demo/gravar-video.mjs`: grava cada cena em WebM.
4. Montagem com ffmpeg: cortes, legendas, cartela de abertura e fechamento, MP4 em 1920×1080.
5. Conferência quadro a quadro: sem nome de teste, sem dado real, sem dose ditada.

## Banco, funções e permissões

- **Sem migration.** Só dados na homologação, pelos mesmos caminhos do `01` e do `02`. Os roteiros param se o banco não for a homologação.
- **Nunca na produção.** O vídeo grava a homologação.
- **Conta:** a coordenadora fictícia fica bloqueada fora da gravação, como no `capturar-telas.mjs`.

## Critérios de aceite

- MP4 de até cerca de 5 minutos, 1920×1080, com todas as áreas do pedido: porta à alta, internação e leitos, regulação, UBS, Central e ferramentas, IA, faturamento, tema claro e escuro.
- Nenhum quadro com "E2E", "F5", "teste", conta real ou dado real.
- Nenhuma dose ditada e nenhuma promessa de RNDS ou de certificação.
- Aprovação do RT.

## Riscos

- **IA da homologação fora do ar:** a cena da IA é gravada à parte e pode ser regravada.
- **Plantão envelhecido:** rodar o `02` logo antes de gravar.
- **Segundo fator:** a sessão pelo link de acesso pode não ter o segundo fator; o vídeo navega e mostra, sem gravar dado clínico.
- **O vídeo fica só na máquina do RT.** Nada é publicado.
