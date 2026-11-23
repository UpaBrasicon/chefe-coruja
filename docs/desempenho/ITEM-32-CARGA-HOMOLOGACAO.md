# Item 32: teste de carga na homologação (23/11/2026)

Esta é a evidência do item 32 da trilha Desempenho. A suíte está em `loadtest/`, e o passo a passo e a reversão estão em `infra/teste-carga.md`.

## Como rodou

- O alvo foi o Supabase da homologação (`kswurfyxxvfydpjfrivy`): PostgREST com o JWT de cada usuário e só a chave publicável. O site da Vercel ficou fora.
- O gerador foi o VPS (2 vCPU, 7,8 GB), com o k6 1.0.0 pelo Docker.
- A massa tinha 64 contas `carga-*`, distribuídas assim:

  | Papel | Contas |
  |---|---|
  | médico | 40 |
  | enfermeiro | 15 |
  | gestor | 3 |
  | recepção | 6 |

  Elas trabalham em 4 setores, com 40 leitos, 30 internados e 80 pacientes fictícios.
- O segundo fator ficou ligado na homologação durante a rodada, como na produção (decisão do RT em 23/11/2026). A sessão foi confirmada pelo dispositivo confiável, o mesmo caminho da tela. A chave voltou a `false` no fim.
- O Auth da homologação tem CAPTCHA, então a sessão saiu do link de acesso gerado pela chave de serviço (decisão do RT em 23/11/2026). O login não foi medido.
- A rodada foi só de leitura (`ESCRITA` desligada), e prescrição e mensagem não entraram. As jornadas de cada papel chamam as RPCs reais da tela, com pausas de 5 a 25 s entre as ações.

## Smoke: 2 usuários por 2 min

Passou com 0 erro (`smoke_20261123_1634.json`).

## Carga média: de 0 a 150 usuários em 5 min, 15 min parados em 150 e 2 min descendo

Os resultados completos estão em `carga/carga_20261123_1634.html` (relatório do k6) e `carga/carga_20261123_1634.json`.

| Medida | Resultado | Limite |
|---|---|---|
| Requisições | 19.646 (14,6 por segundo) | — |
| Falhas | 0,00% | menos de 1% |
| Checagens | 100% (19.646 de 19.646) | mais de 99% |
| Leitura: mediana | 31,5 ms | — |
| Leitura: p95 | 62,8 ms | menos de 800 ms |
| Leitura: p99 | 200,3 ms | menos de 2.000 ms |
| Leitura: máximo | 870,6 ms | — |

Todas as 19 RPCs passaram 100% das vezes:

- `meu_plantao_agora`, `minhas_notificacoes`, `situacao_leitos` e `painel_observacao`;
- `tendencia_acuidade`, `alergias_do_paciente`, `prescricao_vigente` e `buscar_medicamento`;
- `escala_da_unidade` e `contatos_chat`;
- `enfermagem_leitos`, `enfermagem_pacientes_do_setor` e `fila_checagem`;
- `painel_gestor`, `ocupacao_setores`, `escala_mes_gestor` e `presencas_do_dia_gestor`;
- `fila_da_porta` e `buscar_pacientes`.

## Carga média com escrita (ok do RT em 23/11/2026)

Mesmo perfil, com `ESCRITA=1`, de 14:18 a 14:41 (horário de Brasília). Antes da carga, uma sonda chamou cada escrita uma vez: as três voltaram 200. O smoke também passou com 0 erro.

- O médico prescreve em 15% das visitas, com `prescrever` e um item de cuidado.
- O médico manda mensagem no chat em 10% das visitas, com `enviar_mensagem`.
- A recepção faz a ficha da porta em 5% das visitas, com `registrar_ficha`, que cria o paciente e o episódio.

Os resultados completos estão em `carga/carga_escrita_20261123_1704.html` e `.json`.

| Medida | Resultado | Limite |
|---|---|---|
| Requisições | 19.986 (14,8 por segundo) | — |
| Falhas | 0,00% | menos de 1% |
| Checagens | 100% | mais de 99% |
| Escrita: mediana | 38,6 ms | — |
| Escrita: p95 | 78,2 ms | menos de 1.500 ms |
| Escrita: máximo | 232 ms | — |
| Leitura: mediana | 37,2 ms | — |
| Leitura: p95 | 190 ms | menos de 800 ms |
| Leitura: p99 | 347 ms | menos de 2.000 ms |

O banco da homologação ficou com 214 itens de prescrição "LOADTEST cuidado de carga", 129 mensagens "LOADTEST ping" e 18 fichas novas "PACIENTE CARGA". São só de inclusão e ficam para sempre. No VPS, o k6 chegou a 26% de CPU e a biblioteca da produção a 0,5%. O hermes-app chegou a 60%, com picos dele que acontecem também sem o k6 (35% a 38% nas outras fases).

Com escrita, o p95 da leitura subiu de 63 ms para 190 ms e continua longe do limite.

## O VPS durante a carga

A CPU foi lida pelo `docker stats` a cada 30 s. O valor é o pico, e 100% equivale a 1 núcleo.

| Contêiner | Pico de CPU |
|---|---|
| k6 | 23% |
| biblioteca-api (produção) | 0,4% |
| hermes-app | 35% |

O pico do hermes-app foi o mesmo sem o k6: 38% na fase de login. A biblioteca da produção não chegou perto do limite de 80% de CPU, que manda parar o teste.

## O que o número não diz

- A medida é do Supabase da homologação. Compare o plano e o tamanho de máquina com os da produção antes de levar o número para lá.
- A latência é a do VPS ao Supabase, os dois no Brasil. O navegador de cada usuário soma a rede dele.
- Na carga média não houve escrita. A escrita e os testes de limite estão nas seções abaixo, cada um rodado com o ok do RT.

## Bateria de limite (ok do RT em 23/11/2026, 14:51 a 17:28 de Brasília)

O RT pediu stress, pico, ruptura, resistência e Realtime em sequência, com escrita ligada, e mandou não parar o teste para proteger a biblioteca: "teste ao máximo para entendermos todas nossas adversidades". A trava de 80% de CPU saiu do script. Antes de cada bloco, a massa e os logins foram refeitos, porque o token vale 1 hora. Os relatórios estão em `carga/<teste>_20261123_1751.html` e `.json`.

| Teste | Forma | Requisições | Falha | p95 | Máximo |
|---|---|---|---|---|---|
| Stress | 150, 225, 300 e 450 usuários, 5 min por degrau, com pausas reais | 35.005 (28/s) | 0% | 276 ms (escrita 121 ms) | 4,1 s |
| Pico da troca de plantão | 50 para 300 usuários em 30 s, 5 min em 300, **sem pausa**: cada um bate ponto e abre o mapa de leitos sem parar | 89.910 (230/s) | 0% | 3,7 s | 14,6 s |
| Ruptura | taxa de jornadas subindo de 38/s até 1.200/s em 18 min, até 900 usuários | 54.652 (49/s) | 0,48% | 31 s | 60 s |
| Realtime | 200 e depois 500 conexões abertas ao mesmo tempo, 1 min cada | 2.854 sessões, 11.262 mensagens recebidas | 0 | conexão em 172 ms | 0,5 s |
| Resistência | 90 usuários por 45 min, com pausas reais e escrita | 28.512 (10/s) | 0% | 217 ms (escrita 68 ms) | 1,3 s |

O que cada um mostrou:

1. **Stress.** Com 450 usuários usando o app como na vida real, nada falhou e o p95 ficou abaixo de 300 ms. É o triplo da carga média.
2. **Pico.** É o caso extremo, com 300 pessoas apertando o botão sem parar por 5 minutos, e não a troca de plantão real, em que cada pessoa bate o ponto uma vez. Nada falhou, mas a resposta ficou lenta: p95 de 3,7 s contra a meta de 800 ms. Por isso o teste saiu com código 99 (meta de tempo estourada, sem erro). O gerador também chegou ao teto: o contêiner do k6 usou os 2 núcleos do VPS (206%). Parte da lentidão é do próprio VPS, e o número real do Supabase é melhor do que esse.
3. **Ruptura.** O Supabase da homologação satura por lentidão, não por erro. Com jornadas chegando cada vez mais rápido, as respostas foram para 9 s de média e 31 s no p95, e 480 mil jornadas nem começaram por falta de usuário livre no gerador. Só 0,48% falhou, e a trava de 5% não disparou. Aqui o k6 ficou em 72% de CPU, então a saturação foi do banco, não do VPS.
4. **Realtime.** As 500 conexões simultâneas, o limite do plano, abriram em 172 ms no p95, sem falha.
5. **Resistência.** Em 45 minutos seguidos não houve falha nem piora com o tempo: o p95 de 217 ms ficou na faixa da carga média.

Leitura para a operação: o uso real (150 usuários) gera cerca de 13 requisições por segundo, e o stress mostrou folga até 28 por segundo sem perder tempo de resposta. A lentidão começa perto de 230 por segundo sem pausa, uns 17 vezes o uso real. O limite medido é o da máquina da homologação, e o plano da produção precisa ser comparado antes de levar o número para lá.

**VPS durante a bateria.** A biblioteca da produção chegou a 1% de CPU no máximo. O hermes-app teve picos de 51%, o mesmo tipo de pico que já tinha sem o k6 (38% na fase de login da carga média). O k6 chegou a 206% só no pico.

**Achado à parte.** A limpeza parou no `auth.admin.listUsers`, que devolveu "Database error finding users". Na homologação, uma conta de fixture (`…e505`, de 28/10/2026, criada por SQL) tem colunas de token em NULL, e isso derruba a listagem do Auth para todas as contas. O `limpar_massa.mjs` agora busca as contas `carga-*` em `perfis`. A fixture ficou como estava.

**Limpeza (ok do RT em 23/11/2026).** Apagados: 882 mensagens de chat, 129 participantes, 3 conversas, 6 notificações, 305 presenças, 549 linhas de escala e 549 de histórico, 64 vínculos e 64 dispositivos confiáveis. Ficaram inativos 40 leitos, 4 setores, a unidade e a organização de carga. As 64 contas `carga-*` estão banidas e com perfil inativo. Pacientes, episódios, internações, prescrições e auditoria ficaram, porque são só inserção. O segundo fator da homologação voltou a `false`, e os tokens foram apagados do VPS.

## Correções que a rodada exigiu (no mesmo PR)

1. **Contas pelo banco.** A API de admin do Auth não cria conta: a regra de cadastro só por convite recusa o INSERT. Entrou `setup/usuarios_sql.py`.
2. **Segundo fator por dispositivo confiável.** O `criar_massa.mjs` cria o dispositivo e o `pre_login.mjs` confirma a sessão.
3. **Login pelo link de admin.** É o caminho por causa do CAPTCHA (`LOGIN=senha` mantém o login por senha).
4. **Massa antes de cada rodada.** O `criar_massa.mjs` tem de rodar antes de cada rodada: o check-in semeado só cobre os turnos já começados. Sem isso, as RPCs por paciente voltam "Acesso negado".
5. **`.env` sem `\r`.** Um `.env` com fim de linha do Windows deixa a URL inválida, e nenhuma requisição sai.
