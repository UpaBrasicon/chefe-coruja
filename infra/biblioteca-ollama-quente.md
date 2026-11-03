# Biblioteca: modelo de busca sempre carregado

**Pedido:** ponto 1 da revisão do plantonista ("Perguntar à IA" leva mais de
30 s). **Aprovação:** "ok produção" do RT em 27/10/2026, para homologação e
produção juntas. **Aplicado no VPS:** 27/10/2026, às 23h50 (horário de Brasília).

## Por que

A homologação e a produção usam o mesmo Ollama (`biblioteca-ollama`), com o
modelo de busca `bge-m3`. O Ollama tirava o modelo da memória 24 h depois da
última pergunta: a API pedia `keep_alive` de 24 h, e o contêiner do Ollama
estava com 30 min. Com o app ainda pouco usado, quase toda pergunta encontrava
o modelo fora da memória. No CPU do VPS (2 vCPU), a recarga levava 41,2 s,
43,8 s e mais de 60 s. Acima de 60 s, a busca estoura o limite e a pergunta
volta com erro 500. A medição completa está em
`docs/plantonista/REVISAO-PLANTONISTA-2026-10.md`, ponto 1 (PR #299).

## O que muda

| Onde | Antes | Depois |
|---|---|---|
| `biblioteca/docker-compose.yml`, serviço `ollama` | `OLLAMA_KEEP_ALIVE: "30m"` | `OLLAMA_KEEP_ALIVE: "-1"` (nunca descarrega) |
| `biblioteca/app/main.py`, `embed()` | `keep_alive` padrão `"24h"` | padrão `"-1m"` (negativo = nunca descarrega) |
| `/srv/biblioteca/app/.env` (só no VPS, lido pelas duas APIs) | sem `OLLAMA_KEEP_ALIVE` | `OLLAMA_KEEP_ALIVE=-1m` |
| cron do root no VPS | — | `*/10 * * * * /root/ollama-quente.sh` (cópia de `biblioteca/ollama-quente.sh`) |

O `keep_alive` do pedido vale mais que o do contêiner. Por isso as duas APIs
também mandam `-1m`. No VPS isso entrou pelo `.env`, sem rebuild das imagens.
O padrão no `main.py` garante o mesmo valor quando a imagem for refeita sem
essa linha no `.env`.

O aviso a cada 10 minutos (`ollama-quente.sh`) cobre o caso em que o contêiner
ou o VPS reinicia: o modelo volta fora da memória, e o aviso o recarrega antes
da próxima pergunta. O script só escreve em
`/home/hermes/backups/ollama-quente.log` quando falha ou demora 5 s ou mais.
Uma linha nesse log quer dizer que houve uma recarga.

## O que cobre e o que não cobre

- Cobre a espera de 41–60+ s pela recarga do modelo, e os erros 500 e 503 que
  vinham dela.
- Não cobre a reescrita da pergunta pelo DeepSeek. Ela levou 1,0–1,6 s nas
  medições abaixo, mas já levou cerca de 10 s, e o limite dela é 8 s
  (`REESCRITA_TIMEOUT_S`).
- Não cobre a lentidão do próprio DeepSeek ao escrever a resposta.
- Não cobre a primeira pergunta depois de um restart do Ollama, se ela chegar
  antes do próximo aviso (até 10 min). Essa pergunta ainda pode esperar a
  recarga.

## Custo

O `bge-m3` ocupa cerca de 1,2 GB de memória o tempo todo. O limite do
contêiner é 3,5 GB. Depois da mudança, o VPS ficou com 4,3 GB disponíveis.

## Chaves envolvidas

Nenhuma chave nova. O aviso chama o Ollama em `127.0.0.1:11434`, que só
escuta dentro do VPS, sem autenticação. As medições usaram a
`BIBLIOTECA_API_KEY` que já está no `.env` do VPS, lida lá dentro e nunca
copiada para fora.

## Medição depois da mudança (27/10/2026, direto no VPS)

Perguntas de teste, sem paciente. O modelo já estava carregado.

| Ambiente | Chamada | Resultado |
|---|---|---|
| Homologação | busca (2×) | 3,7 s e 0,4 s |
| Homologação | pergunta (2×) | primeiro trecho em 2,9 s e 2,3 s; fim em 6,0 s e 4,3 s (reescrita 1,6 s e 1,0 s) |
| Produção | busca | 1,8 s |
| Produção | pergunta | primeiro byte em 1,9 s; fim em 6,6 s |

Antes da mudança, uma pergunta da homologação que deu certo terminou em
22,9 s, com o primeiro trecho em 21,7 s. A recarga feita na aplicação
(`ollama-quente.sh` logo depois de recriar o contêiner) levou 60,1 s.

Falta conferir pelo app: perguntar pela tela da homologação e depois olhar
`clinical_search_logs` (`latency_ms`) nos próximos dias, na homologação e na
produção.

## Como reverter

No VPS, como root:

```bash
cd /srv/biblioteca
cp -p docker-compose.yml.bak-20261027 docker-compose.yml
cp -p app/.env.bak-20261027 app/.env
docker compose up -d --no-deps ollama
docker compose up -d --no-deps --no-build api
docker compose -f docker-compose.yml -f docker-compose.homolog.yml up -d --no-deps --no-build api-homolog
crontab -l | grep -v ollama-quente | crontab -
rm /root/ollama-quente.sh
```

No repositório: reverter o PR desta tarefa. Depois de reverter, o modelo volta
a sair da memória e a primeira pergunta volta a esperar a recarga de 41–60+ s.
