# Vigias no cron do Nous (etapa 2 da migração Hermes → Nous)

Plano aprovado pelo RT em 02/10/2026: `produto/docs/propostas/migracao-hermes-nous.md`.
Os 12 jobs do Hermes (`hermes/src/jobs/*.ts`, agendados em `hermes/src/queue/agendador.ts`)
viram scripts Python `--no-agent` do cron do Nous, **sem IA**, com o papel `hermes_app_job`.
Mesma lógica, mesmos limites, mesma dedup e mesmas gravações (avisos pela Íris em
`notificacoes_plantonista`, incidentes em `cerbero_incidentes` com `ON CONFLICT`, relatório com id
gerado no cliente). Nenhum job chama modelo de linguagem (o "resumo factual" do Sentinela já era
montado por código), então nada ficou de fora.

| Job no Nous | Script | Horário (Brasília) | Origem (TS) |
|---|---|---|---|
| `coruja-sentinela_escala` | `sentinela.py` | segunda 06h30 | `jobs/sentinela.ts` |
| `coruja-gaviao_relatorio_semanal` | `relatorio.py` | segunda 08h15 | `jobs/relatorio.ts` |
| `coruja-cerbero_dados` | `cerbero_dados.py` | toda hora, minuto 5 (no TS: `every` 1 h) | `rodarPatrulhaDados` |
| `coruja-cerbero_hermes` | `cerbero_hermes.py` | 05h | `rodarPatrulhaHermes` |
| `coruja-gaviao_patrulha` | `gaviao_patrulha.py` | 08h e 20h | `jobs/gaviao.ts` |
| `coruja-argos_auditoria` | `argos.py` | 06h e 18h | `jobs/argos.ts` |
| `coruja-vigia_porta` | `vigia_porta.py` | 07h05 e 19h05 | `vigiaPorta` |
| `coruja-vigia_presenca` | `vigia_presenca.py` | a cada 15 min | `vigiaPresenca` |
| `coruja-vigia_escala` | `vigia_escala.py` | 08h | `vigiaEscala` |
| `coruja-vigia_tardios` | `vigia_tardios.py` | 08h02 | `vigiaTardios` |
| `coruja-guardiao_prontuario` | `guardiao_prontuario.py` | toda hora, minuto 20 | `guardiaoProntuario` |
| `coruja-cadeia_auditoria` | `cadeia_auditoria.py` | 04h | `cadeiaAuditoria` |

## Como o cron do Nous roda isto (conferido na documentação e no código, 02/10/2026)

- **Onde fica o script:** dentro de `$HERMES_HOME/scripts/` (no contêiner `/opt/data/scripts`, no
  host `/home/hermes/.hermes/scripts`). Caminho que sai dessa pasta é recusado. Aqui:
  `/opt/data/scripts/coruja-vigias/`.
  <https://hermes-agent.nousresearch.com/docs/user-guide/features/cron>
- **Interpretador:** `.sh`/`.bash` vão para o `bash`; qualquer outro arquivo roda com o **mesmo
  Python do Nous** (`sys.executable`). O shebang é ignorado. Por isso os scripts são `.py` e usam o
  `asyncpg` que já está na imagem.
  <https://hermes-agent.nousresearch.com/docs/guides/cron-script-only>
- **Saída:** stdout vazio = nada é entregue (o "vigia silencioso"). Código diferente de 0 ou
  estouro de tempo gera aviso de falha. Tempo máximo padrão: 3600 s.
- **Ambiente:** o script não herda as credenciais de provedor de IA do Nous (há uma lista de
  bloqueio de nomes conhecidos: chaves de API, tokens de bot etc.). Variáveis nossas como
  `HERMES_PG_JOB_URL` e `VIGIAS_MODO` passam (`tools/environments/local_env_policy.py` no
  repositório `NousResearch/hermes-agent`). `TZ`, `HOME` e `HERMES_HOME` também passam.
- **Horário:** o Nous casa a expressão cron no relógio do fuso configurado: `HERMES_TIMEZONE`,
  senão `timezone:` do `config.yaml`, senão o fuso local do processo (`hermes_time.py` e
  `cron/jobs.py` do mesmo repositório). O `hermes-agent` é recriado com `TZ=America/Sao_Paulo`
  (`recriar-agente.sh`), então **as expressões vão em horário de Brasília**, e não em UTC como no
  `agendador.ts`. O `agenda.py` descobre o fuso do Nous e converte, e o `instalar.sh` mostra qual
  fuso encontrou.
- **Agenda:** aceita expressão cron de 5 campos, `every 30m`, `every monday 9am` e ISO. Os jobs ficam
  em `/opt/data/cron/jobs.json`. Nome **não é único** (por isso o `instalar.sh` confere antes de criar).
  `--deliver` sem origem fica `local` (`/opt/data/cron/output/`). Aqui ele vai explícito como
  `local`: nem a falha vai para o Telegram.

## Modo sombra e modo valer

`VIGIAS_MODO` no ambiente do `hermes-agent`:

- `sombra` (**padrão**): calcula tudo e **não grava**. A conexão é somente leitura (transação READ
  ONLY), e a camada de gravação também recusa. Cada gravação que faria vira uma linha em
  `/opt/data/logs/vigias-sombra/<job>-AAAA-MM-DD.jsonl` (data de Brasília). A linha leva só IDs,
  chaves em sha256 e contagens: sem texto de mensagem nem trecho de conversa. A chave do Gavião leva
  trecho, por isso também vai em hash. O registro também anota as chaves que **já estavam abertas**,
  para a comparação.
- `valer`: grava de verdade, como o Hermes.

O log de execução fica em `/opt/data/logs/vigias/<job>-AAAA-MM-DD.log`, com contagens e avisos.
Em falha sai uma linha no stderr, e o código de saída 1 aparece em `hermes cron list`.

## Passo a passo na VPS (como `hermes`)

### 0. Hermes com a chave `HERMES_CRONS` (antes da sombra)
Publicar o `hermes-app` com o código desta etapa (`src/config/crons.ts`). Sem a variável, nada muda.
É isso que deixa a virada ser uma linha.

### 1. Levar a pasta para a VPS
Com o repositório atualizado em `/home/hermes/deploy`, a pasta fica em
`/home/hermes/deploy/deploy/nous-vigias`. Ou copie da máquina local:
`scp -r hermes/deploy/nous-vigias hermes@<vps>:~/nous-vigias`.

### 2. Variáveis do Nous (`~/.agent.extra.env`, chmod 600)
```sh
grep '^HERMES_PG_JOB_URL=' /home/hermes/deploy/.env.prod >> ~/.agent.extra.env   # a mesma URL do hermes-app
echo 'VIGIAS_MODO=sombra' >> ~/.agent.extra.env
chmod 600 ~/.agent.extra.env
sh /home/hermes/deploy/deploy/recriar-agente.sh     # recria o hermes-agent com as variáveis
docker rm hermes-agent-antigo                        # depois de conferir que o bot respondeu
```
(Se a linha já existir no `~/.agent.extra.env`, edite em vez de acrescentar.)

### 3. Instalar
```sh
sh ~/nous-vigias/instalar.sh          # ou /home/hermes/deploy/deploy/nous-vigias/instalar.sh
docker exec hermes-agent hermes cron list
docker exec hermes-agent hermes cron run coruja-cadeia_auditoria   # teste: sombra não grava
docker exec hermes-agent ls /opt/data/logs/vigias /opt/data/logs/vigias-sombra
```
O `instalar.sh` é idempotente: o job que já existe é pulado. Para trocar um horário, rode
`remover.sh` e depois `instalar.sh`.

### 4. Comparar (depois de N dias, recomendado ≥ 3 dias úteis e uma segunda-feira)
```sh
docker exec -w /opt/data/scripts/coruja-vigias hermes-agent sh -c '
  for p in python3 /opt/hermes/.venv/bin/python /opt/hermes/venv/bin/python; do
    $p -c "import asyncpg" 2>/dev/null && exec $p compara.py 2026-10-06; done'
```
(Sem data = ontem.) Para cada tabela, o resultado mostra quantos registros o Nous previu, quantos
o Hermes gravou, quantos bateram e quantos ficaram só de um lado. Código 0 significa que tudo
bateu; código 3 significa que há diferença.

- **Incidentes e alertas** comparam pela chave. Quando o Hermes rodou antes e o Nous viu a chave
  aberta, conta como "bateu".
- **Notificações e relatório:** o `hermes_job` não tem SELECT nessas tabelas. O script mostra o
  que o Nous previu e o SQL para conferir no editor do Supabase. Se quiser comparar na hora, passe
  `VIGIAS_COMPARA_URL` (`-e` no `docker exec`) com uma conexão de leitura que enxergue essas tabelas.
- **Diferenças esperadas e inofensivas:**
  - O Cérbero de dados roda no minuto 5 no Nous e na hora do registro no BullMQ. Um caso que
    abriu e fechou entre os dois aparece de um lado só.
  - O total do relatório semanal pode variar por incidentes criados nos segundos entre um e outro.
  - Incidentes gravados à mão também aparecem como "só no Hermes".

### 5. Virar a chave (sombra → valer) e desligar os crons do Hermes
Faça a virada fora de segunda entre 06h e 09h (Sentinela e relatório). Nos outros horários, rodar
os dois por alguns minutos não duplica nada: incidentes têm `ON CONFLICT` e notificações têm UNIQUE
por pessoa, tipo e dia.
```sh
# a) desliga os crons do Hermes
echo 'HERMES_CRONS=0' >> /home/hermes/deploy/.env.prod
cd /home/hermes/deploy && docker compose -f docker-compose.prod.yml up -d app
docker logs hermes-app 2>&1 | grep 'crons do Hermes DESLIGADOS'
# b) liga o Nous para valer
sed -i 's/^VIGIAS_MODO=.*/VIGIAS_MODO=valer/' ~/.agent.extra.env
sh /home/hermes/deploy/deploy/recriar-agente.sh && docker rm hermes-agent-antigo
docker exec hermes-agent sh -c 'echo $VIGIAS_MODO'      # valer
```
Com `HERMES_CRONS=0`, o `hermes-app` não registra o agendador nem sobe o worker da fila
`hermes-cron`. O resto (gateway de IA, `/health` e skills) continua igual.

### Volta atrás
```sh
sed -i 's/^VIGIAS_MODO=.*/VIGIAS_MODO=sombra/' ~/.agent.extra.env && sh /home/hermes/deploy/deploy/recriar-agente.sh
#   (ou tirar os jobs: sh remover.sh)
sed -i '/^HERMES_CRONS=0$/d' /home/hermes/deploy/.env.prod
cd /home/hermes/deploy && docker compose -f docker-compose.prod.yml up -d app
```
Ao religar, o BullMQ pode rodar **uma vez** cada job que ficou atrasado no Redis. Para incidentes
e avisos isso é inofensivo por causa da dedup. Para o relatório semanal, pode sair um relatório a
mais se a volta for logo depois de uma segunda-feira.

## Testes

- Unitários (só biblioteca padrão, banco falso). Portam os casos de `hermes/src/jobs/*.test.ts` e
  `agent/sentinela.test.ts`, conferem que os padrões de texto são **literalmente** os do TS e que a
  agenda bate com o `agendador.ts`:
  `python -m unittest discover -s hermes/deploy/nous-vigias/tests -v`
- Integração contra o Supabase **local** roda os 12 scripts em sombra e em valer como
  `hermes_app_job`. A senha é temporária e volta a NULL no fim, mesmo em falha:
  `bash hermes/deploy/nous-vigias/tests/integracao_local.sh`

## Equivalências com o TS (por que há `js_*` no código)

A chave de dedup, o texto das notificações e os números precisam sair **iguais** aos do Hermes. Se
não saírem, depois da virada o Nous reabriria os incidentes que o Hermes deixou abertos. Para isso:

- `slice` conta em UTF-16 (emoji vale 2);
- `String(n)` escreve `3`, e não `3.0`;
- `Math.round` arredonda o meio para cima;
- `toISOString` é usado nas janelas de tempo;
- regex do JS sem a flag `u` (`vigias/jsre.py`): `\b`, `\w` e `\d` são só ASCII, e `.` não casa `\r`;
- linhas em JSON gerado pelo Postgres, igual ao `linhasJson`, para os timestamps das chaves.
