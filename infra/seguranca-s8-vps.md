# S8 — proteção do `master` e endurecimento do VPS

Trilha de segurança, S8 (`docs/seguranca/S8-HERMES-VPS-DIAGNOSTICO.md`). O RT decidiu todas A em 15/11/2026.

Este arquivo cobre o que muda **fora do código**: a regra do GitHub e os passos no VPS (`root@179.199.128.141`). Cada passo tem o comando de volta. A ordem é a desta página, um passo por vez, com conferência entre eles.

## Leitura antes de mexer (D9, feita em 15/11/2026)

- **Crontab do root:**
  - `backup.sh` 03:00;
  - `update-hermes.sh` 04:00;
  - `ollama-quente.sh` a cada 10 min;
  - `/home/rnds/deploy/atualizar-rnds.sh` 04:10.
- **Usuário `rnds`:** `groups=rnds,docker`.
- **Script do cron do RNDS:**
  - o arquivo é `root:root` 750, mas a pasta `/home/rnds/deploy` e a home são do `rnds`;
  - o `rnds` pode trocar o arquivo pela pasta, e o `docker-compose.yml` que o root sobe também mora ali.
- **Porta 8642:** publicada em `0.0.0.0` e `[::]` pelo `hermes-agent`. Hoje nada escuta nela dentro do contêiner (a API do Nous está desligada), mas a porta abre para a internet quando a API for ligada.
- **Biblioteca:** a homologação lê `/srv/biblioteca/app/.env`, o da produção; `/srv/biblioteca/app-homolog/.env` não existe.
- **UFW:** só 22, 80 e 443. O Docker publica as portas por fora dele.

## D4. Proteção do `master` no GitHub

O que cobre:
- só entra por PR;
- os checks `web (lint, build, testes)`, `banco (supabase/tests)`, `hermes (typecheck, lint, testes)` e `nous` precisam estar verdes;
- sem push forçado;
- sem apagar a branch;
- vale também para o administrador.

Os crons do VPS seguem lendo o `master`, que passa a ter só commit com CI verde.

O que não cobre: a branch `homolog` (fica livre, como hoje).

Volta: `DELETE /repos/UpaBrasicon/chefe-coruja/branches/master/protection` ou, na tela, Settings → Branches → apagar a regra.

## D5. Usuário `rnds`

Com o PR mesclado e o `/opt/chefe-coruja` atualizado pelo cron das 04:00 (ou `git -C /opt/chefe-coruja fetch`), rodar como root:

```sh
git -C /opt/chefe-coruja fetch --quiet origin master
git -C /opt/chefe-coruja show origin/master:services/rnds-envio/deploy/instalar-rnds.sh | bash
```

O instalador é idempotente.
- Tira o `rnds` do grupo `docker`.
- Passa `/home/rnds`, `/home/rnds/deploy` e os logs para o root, menos `certificados/` e `cofre/`, que seguem do uid 1000.
- Move o script para `/usr/local/sbin/atualizar-rnds.sh` (root, 750).
- Troca a linha do cron.
- Não toca no `.env.rnds` nem na chave do cofre.

Conferir:
- `id rnds` (sem `docker`);
- `ls -ld /home/rnds /home/rnds/deploy` (root);
- `crontab -l | grep rnds` (caminho novo);
- `/usr/local/sbin/atualizar-rnds.sh` (deve dizer "nada novo").

Volta:

```sh
usermod -aG docker rnds
chown rnds:rnds /home/rnds /home/rnds/deploy
cp /usr/local/sbin/atualizar-rnds.sh /home/rnds/deploy/atualizar-rnds.sh
crontab -l | sed 's#/usr/local/sbin/atualizar-rnds.sh#/home/rnds/deploy/atualizar-rnds.sh#' | crontab -
```

## D6. Token do `deploy-backend.sh`

Só código: o script grava `HERMES_SKILL_TOKEN` em `/home/hermes/.agent.extra.env` (600, do `hermes`) e não imprime o valor. Nada a fazer no VPS até o próximo deploy do backend.

Volta: o PR.

## D7. Porta 8642 do Nous

`recriar-agente.sh` passa a publicar `127.0.0.1:8642:8642`. Para valer no contêiner atual, rodar como `hermes`:

```sh
cp /opt/chefe-coruja/hermes/deploy/recriar-agente.sh /home/hermes/deploy/recriar-agente.sh
sh /home/hermes/deploy/recriar-agente.sh
```

O `update-hermes.sh` não copia o `recriar-agente.sh`, por isso a cópia à mão.

Conferir:
- `docker ps --format '{{.Names}} {{.Ports}}' | grep hermes-agent` deve mostrar `127.0.0.1:8642`;
- o bot responde no Telegram;
- depois, `docker rm hermes-agent-antigo`.

Volta: `docker rm -f hermes-agent && docker rename hermes-agent-antigo hermes-agent && docker start hermes-agent`.

## D8. Biblioteca da homologação com `.env` próprio

1. Criar `/srv/biblioteca/app-homolog/.env` a partir do `/srv/biblioteca/app/.env`, com `BIBLIOTECA_API_KEY` nova (`openssl rand -hex 32`). O valor não é impresso.
2. Pôr a mesma chave nova no segredo `BIBLIOTECA_API_KEY` do Supabase da **homologação** (`kswurfyxxvfydpjfrivy`). A produção não muda.
3. Copiar `biblioteca/app/main.py` (com `hmac.compare_digest`) para `/srv/biblioteca/app` e `/srv/biblioteca/app-homolog`. Copiar `docker-compose.homolog.yml` para `/srv/biblioteca`.
4. `docker compose -f docker-compose.yml -f docker-compose.homolog.yml up -d --build api-homolog`. A produção (`api`) é reconstruída à parte, depois de conferir a homologação.

Conferir:
- a homologação recusa a chave da produção (401) e aceita a nova;
- a pergunta clínica na homologação responde;
- a produção segue respondendo.

Volta:
- `env_file: ./app/.env` no compose da homologação e o segredo antigo no Supabase da homologação;
- `main.py` anterior pelo backup diário.

## D1, D2 e D3

Só código no `hermes-app` e no plugin do Nous. Sobem pelo `update-hermes.sh` das 04:00 depois do merge; o plugin, pelo caminho de sempre (`hermes/deploy/nous-plugin`).

Volta: o PR.
