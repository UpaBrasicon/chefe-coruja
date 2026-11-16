# Trilha de segurança, S8: Hermes e VPS — diagnóstico

**Pedido.** Em 15/11/2026, depois do S7, o RT escolheu o S8 ("S8 segurança").

**Origem.** Auditoria Cloudflare (`docs/seguranca/auditoria-cloudflare-2026-11-15/RESUMO.md`, itens 15 e 16, e a passada 3).

**Escopo.** Só diagnóstico.
- O código foi lido no repositório: `hermes/`, `services/rnds-envio/deploy/` e `biblioteca/`.
- A proteção do `master` foi lida pela API do GitHub (fato 5 do S0).
- O VPS **não** foi acessado; o estado dele vem dos scripts e da memória do projeto.

## Fato 5 do S0: o `master` não tem proteção (conferido)

- A API do GitHub responde "Branch not protected", e o repositório não tem regras (rulesets).
- Há uma conta com permissão de push.
- Um push direto no `master`, sem PR e sem CI, é aceito.

Isso pesa porque **dois crons do root no VPS sobem o que estiver no `master`**, sem conferir CI:
- `/root/update-hermes.sh` às 04:00 (hermes-app);
- `/home/rnds/deploy/atualizar-rnds.sh` às 04:10 (envio à RNDS, inclusive o `docker-compose.yml`).

## As lacunas

### Assistente (Hermes)

1. **O histórico do assistente volta à IA sem o NER** (`hermes/src/server/ia-proxy.ts`, `textosParaNER`).
   - O nome que a resposta anterior trouxe de volta para a pessoa (já reidentificado) vai de novo ao provedor na próxima pergunta.
   - Nessa volta, o texto passa só pela regex e pelos nomes conhecidos, não pelo NER.
   - O NER saiu da fala da IA em 02/10/2026 por falsos positivos ("HCFMUSP", "Manole").
2. **Argumentos de ferramenta reidentificados vão para o log e para a auditoria.**
   - `hermes/src/agent/loop.ts:132` registra `args` no log do contêiner.
   - `tools.ts` grava os mesmos `args` em `hermes_audit_log`.
   - Hoje os argumentos são enumerações e ids, mas um valor escolhido pelo modelo levaria o identificador junto.
3. **Pseudônimos com o mesmo nome em dois cofres** (passada 3).
   - `skill-api.ts` e `consulta.py` trocam nomes nas notificações por `[PESSOA_1]`… com um cofre próprio.
   - O gateway pode já ter usado `[PESSOA_1]` para outra pessoa, como o nome de quem pergunta.
   - Na volta, a resposta pode atribuir a notificação de um colega à pessoa errada. Não vaza para outra pessoa, mas a resposta sai errada.

### VPS

4. **Deploy automático sem CI** (fato 5 acima).
5. **O usuário `rnds` controla o que o root executa** (`services/rnds-envio/deploy/instalar-rnds.sh`).
   - O script do cron do root fica em `/home/rnds/deploy`, e a pasta toda é do `rnds` (`chown -R rnds:rnds /home/rnds`). Quem for o `rnds` troca o script e o root o executa às 04:10.
   - O `rnds` também está no grupo `docker`, o que já equivale a root.
6. **`deploy-backend.sh` imprime o `SKILL_API_TOKEN`** no terminal (linha 43), e o valor fica no histórico da sessão SSH e em qualquer registro dela.
7. **A porta 8642 do Nous está aberta em todas as interfaces.**
   - `recriar-agente.sh:21` usa `-p 8642:8642`.
   - O Docker publica a porta por fora do UFW, que só libera 22, 80 e 443.
   - A API do Nous guarda o acesso ao banco do Hermes e os tokens das ferramentas. A chave dela (`API_SERVER_KEY`) é a única barreira.

### Biblioteca

8. **A rota `/homolog` usa o `.env` da produção** (`biblioteca/docker-compose.homolog.yml`, `env_file: ./app/.env`).
   - A mesma `BIBLIOTECA_API_KEY` abre as duas.
   - O código da branch de homologação roda com as chaves e o Qdrant da produção (só a coleção é outra).
9. **A chave da biblioteca é comparada com `!=`** (`biblioteca/app/main.py:73`), não em tempo constante.

## Decisões para o RT

**D1. Histórico do assistente.**
- **A (recomendada):** o NER volta a olhar a fala da IA, mas o nome achado ali é **trocado por pseudônimo**, sem bloquear a conversa.
  - Falso positivo ("Manole") só vira `[PESSOA_n]` no histórico.
  - O que a pessoa digita continua bloqueando, como hoje.
- **B:** bloquear também na fala da IA, como na mensagem da pessoa. Os falsos positivos de 02/10 voltam.

**D2. Argumentos no log e na auditoria.**
- **A (recomendada):** o log registra só os nomes dos campos.
  - A auditoria guarda os valores de enumeração e de id, que hoje são o que a ferramenta aceita.
  - Texto livre vira o resumo sha256.
- **B:** não guardar argumento nenhum.

**D3. Pseudônimos das notificações.**
- **A (recomendada):** o cofre das ferramentas usa outro prefixo (`[NOTIF_1]`…), que o gateway não reidentifica como nome de pessoa.
- **B:** deixar como está.

**D4. Deploy só com CI verde.**
- **A (recomendada):** proteger o `master` no GitHub.
  - Só entra por PR, com os quatro checks do CI verdes (`web`, `banco`, `hermes`, `nous`).
  - Sem push forçado e sem apagar a branch.
  - Eu configuro pela API com o seu ok. O jeito de trabalhar não muda: os PRs já esperam o CI antes de mesclar.
  - Os crons do VPS seguem lendo o `master`, que passa a ter só commit com CI verde.
- **B:** além do A, os crons sobem só um SHA que você fixar à mão.

**D5. Usuário `rnds`.**
- **A (recomendada):**
  - o script do cron vai para `/usr/local/sbin/atualizar-rnds.sh`, dono root e permissão 750;
  - o `rnds` sai do grupo `docker`, e os contêineres seguem geridos pelo root (o cron já é do root);
  - `instalar-rnds.sh` passa a fazer isso.
- **B:** só mover o script.

**D6. Token no `deploy-backend.sh`.**
- **A (recomendada):** o script grava o token direto no `.env` do Nous e imprime só "token gravado". O valor não aparece no terminal.
- **B:** imprimir só o começo do token.

**D7. Porta 8642 do Nous.**
- **A (recomendada):** `-p 127.0.0.1:8642:8642` no `recriar-agente.sh`. O contêiner continua na rede `deploy_default`, onde o hermes-app o alcança, e nada no repositório chama a 8642 de fora.
- **B:** manter aberta e limitar por firewall no Docker (`DOCKER-USER`).

**D8. Biblioteca.**
- **A (recomendada):**
  - a homologação ganha `.env` próprio, com chave própria (`BIBLIOTECA_API_KEY` diferente);
  - a comparação passa a usar `hmac.compare_digest`;
  - a coleção da homologação continua separada.
- **B:** só a comparação.

**D9. Leitura do VPS antes de mexer.**
- **A (recomendada):** com a sua autorização, uma leitura por SSH, sem ler nenhum segredo, de:
  - o `crontab` do root;
  - os grupos do `rnds`;
  - o dono e a permissão dos scripts;
  - as portas publicadas (`docker ps`, `ss -ltnp`);
  - se a 8642 responde de fora.

  Isso confirma o que os scripts dizem. Depois disso as mudanças são aplicadas no VPS, uma por vez, com o comando de volta escrito.
- **B:** aplicar só pelos scripts do repositório.

## Riscos

- **D4:**
  - um PR com o CI vermelho não entra mais, e um conserto urgente também passa pelo CI;
  - o push na `homolog` não muda, porque a branch não é protegida.
- **D5:** se algum passo do `rnds` usar o docker sem o root, ele para. Pelo script de instalação, nenhum usa.
- **D7:** se algum serviço de fora do VPS chama o Nous na 8642, ele para. Nada no repositório faz isso, e o Telegram é chamado pelo Nous, não o contrário. A leitura da D9 confirma antes.
- **D1:** o pseudônimo na fala da IA pode trocar uma palavra comum que o NER confunde com nome. Isso fica só no texto que vai ao modelo; a pessoa não vê.
- **Rollback:**
  - código: voltar o PR;
  - VPS: cada mudança com o comando de volta no `infra/`;
  - proteção do `master`: apagar a regra no GitHub.

## Critérios de aceite

1. Teste de unidade: nome na fala da IA vira pseudônimo e não bloqueia; o log da ferramenta não leva valor de texto livre; o prefixo das notificações não colide.
2. Push direto no `master` recusado; PR com check vermelho não mescla.
3. No VPS:
   - o script do cron é do root;
   - o `rnds` está fora do grupo `docker`;
   - a 8642 não responde de fora;
   - a biblioteca da homologação recusa a chave da produção.
4. CI verde.

## Depois

Com as decisões, abro a tarefa: código e testes primeiro, depois a proteção do `master` e, por último, o VPS, um passo por vez.
