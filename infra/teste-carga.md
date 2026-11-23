# Teste de carga (k6) no VPS

Trilha Desempenho, item 32 do `BACKLOG.md` (pedido do RT em 22/11/2026; entrou como P1 em 23/11/2026). A suíte fica em `loadtest/` e o uso de cada teste está em `loadtest/README.md`.

## O que cobre
- A carga vai direto no Supabase da **homologação** (PostgREST, Auth e Realtime), nunca no site da Vercel.
- O k6 usa só a chave publicável (anon) e o JWT dos usuários `carga-*`. A chave de serviço (service_role) fica só nos scripts Node que criam e limpam a massa, e nunca entra no k6.
- O k6 roda no VPS pela imagem oficial do Docker (`grafana/k6`, versão presa). Não instala nada no sistema. Os scripts Node rodam na imagem `node:22`.

## O que não cobre
- **Produção:** nenhum teste roda na produção sem ok do RT, teste por teste.
- O VPS também serve a biblioteca e o Hermes da produção. O k6 disputa CPU e memória com eles, por isso:
  - testes só fora do horário de uso;
  - stress, pico e ruptura só com ok do RT;
  - `docker stats` aberto num segundo terminal durante o teste. Se a biblioteca passar de 80% de CPU, pare com Ctrl+C.
- O limite de taxa do Auth do Supabase conta por IP. Todos os logins saem do IP do VPS, por isso o `pre_login.mjs` espaça os logins (1,5 s por padrão).
- O resultado mede o Supabase da homologação, que pode estar num plano ou num tamanho de máquina diferente da produção. Compare o plano e o compute dos dois projetos no painel antes de tirar conclusões para a produção.

## Chaves envolvidas (só nomes)
Ficam em `loadtest/.env`, no VPS, fora do git (`loadtest/.gitignore`):
- `SUPABASE_URL` da homologação (`https://kswurfyxxvfydpjfrivy.supabase.co`);
- `SUPABASE_ANON_KEY` (publicável da homologação);
- `SUPABASE_SERVICE_ROLE_KEY` da homologação. Só os scripts de massa e limpeza usam;
- `LOADTEST_SENHA`: senha única dos usuários `carga-*`, gerada na hora (`openssl rand -base64 24`).

`.tokens.json`, `dados.json` e `resultados/` também ficam fora do git.

## Passo a passo no VPS

```bash
# 1. código
cd /srv && git clone https://github.com/UpaBrasicon/chefe-coruja.git chefe-coruja-carga   # ou git pull, se já existir
cd /srv/chefe-coruja-carga && git checkout chore/teste-carga && cd loadtest

# 2. segredos (editar com os valores da HOMOLOGAÇÃO)
cp .env.example .env && chmod 600 .env && nano .env

# 3. atalhos (valem só nesta sessão do terminal)
K6="docker run --rm -i --user $(id -u) -v $PWD:/carga -w /carga --env-file .env grafana/k6:1.0.0"
NODE="docker run --rm -i --user $(id -u) -v $PWD:/carga -w /carga node:22-slim"

# 4. dependência dos scripts Node (uma vez)
$NODE npm install --no-save @supabase/supabase-js

# 5. massa e logins
$NODE node setup/criar_massa.mjs
$NODE node setup/pre_login.mjs      # repetir se os tokens tiverem mais de 50 min

# 6. smoke (obrigatório primeiro; precisa dar 0 erro)
$K6 run -e SUPABASE_URL -e SUPABASE_ANON_KEY testes/smoke.js

# 7. carga média, com relatório HTML
$K6 run -e SUPABASE_URL -e SUPABASE_ANON_KEY \
  -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_EXPORT=resultados/carga_$(date +%Y%m%d_%H%M).html \
  --summary-export=resultados/carga.json testes/carga.js
```

O `--env-file .env` entrega as variáveis ao contêiner, e o `-e NOME` sem valor repassa cada uma ao script do k6. O relatório HTML e o JSON ficam em `loadtest/resultados/`. Copie-os para a sua máquina com `scp` e anexe ao PR.

## Como reverter
1. `$NODE node setup/limpar_massa.mjs` mostra o que seria apagado (só conta).
2. Com ok do RT, `--apply` apaga as linhas apagáveis, marca a organização de carga como inativa e remove os usuários `carga-*`. O que é só inserção (prontuário, auditoria, prescrição) fica, porque os gatilhos de imutabilidade não são desligados.
3. No VPS: `rm -rf /srv/chefe-coruja-carga` e `docker image rm grafana/k6:1.0.0 node:22-slim`.
