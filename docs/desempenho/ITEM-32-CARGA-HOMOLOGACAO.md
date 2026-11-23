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
- Não houve escrita. Stress, pico, ruptura, resistência, Realtime e escrita continuam esperando o ok do RT, um de cada vez.

## Correções que a rodada exigiu (no mesmo PR)

1. **Contas pelo banco.** A API de admin do Auth não cria conta: a regra de cadastro só por convite recusa o INSERT. Entrou `setup/usuarios_sql.py`.
2. **Segundo fator por dispositivo confiável.** O `criar_massa.mjs` cria o dispositivo e o `pre_login.mjs` confirma a sessão.
3. **Login pelo link de admin.** É o caminho por causa do CAPTCHA (`LOGIN=senha` mantém o login por senha).
4. **Massa antes de cada rodada.** O `criar_massa.mjs` tem de rodar antes de cada rodada: o check-in semeado só cobre os turnos já começados. Sem isso, as RPCs por paciente voltam "Acesso negado".
5. **`.env` sem `\r`.** Um `.env` com fim de linha do Windows deixa a URL inválida, e nenhuma requisição sai.
