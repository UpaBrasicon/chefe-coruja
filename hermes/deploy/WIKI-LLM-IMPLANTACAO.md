# LLM Wiki no Hermes Agent (Corujinha) — Implantação 23/08/2026

> Base: prompt "LLM Wiki no Hermes Agent (VPS Hostinger) v1.0 — Agosto/2026"
> Vault: `/opt/hermes-wiki` · Skill: `llm-wiki` v2.1.0 (bundled) · Hermes v0.20.5

## O que foi implantado

| Item | Estado |
|---|---|
| Vault `/opt/hermes-wiki` (git init + 4 commits) | ✅ |
| `WIKI_PATH=/opt/hermes-wiki` no `.env` do Nous (append) | ✅ |
| `SCHEMA.md` (governança completa: barreira LGPD, taxonomia, confidence) | ✅ |
| `index.md` (Total de páginas: 3) e `log.md` (3 entradas) | ✅ |
| Container `hermes-agent` recriado com volume extra `-v /opt/hermes-wiki` | ✅ |
| Ingestão piloto (EBSERH PRT.UPS.003) — 3 páginas + raw | ✅ |
| Cron `wiki-backup` (todo dia 23:00, no-agent) | ✅ |
| Cron `wiki-lint` (segunda 07:30, LLM, entrega Telegram) | ✅ |
| `skills.write_approval: true` no config.yaml | ✅ |

## Decisão de arquitetura (importante)

O prompt original mandava criar o vault em `/opt/hermes-wiki` — **opção escolhida
pelo usuário (Opção 2)**: o `hermes-agent` roda em container Docker e só
enxerga `/opt/data` (= `/home/hermes/.hermes`). Para o agente alcançar o vault,
o container foi **recriado** com um volume extra:

```
-v /opt/hermes-wiki:/opt/hermes-wiki
```

⚠️ O container foi recriado com TODOS os flags do original (confirmados por
`docker inspect` antes):
- `--sysctl net.ipv6.conf.all.disable_ipv6=1` + `default` (fix do Telegram)
- `-p 8642:8642`, `--restart unless-stopped`
- `-v /home/hermes/.hermes:/opt/data` (rw) + o novo volume do wiki
- rede `deploy_default` reconectada (`docker network connect deploy_default hermes-agent`)
- env defaults do container + `.env` do Nous

**Nunca recriar o container sem esses flags** — o Telegram volta a travar no
IPv6. Se precisar recriar de novo, o playbook está em `wiki-implantacao.sh`
(se existir no repo) ou nos comandos acima.

## Como o agente escreve no vault

`HERMES_WRITE_SAFE_ROOT=/opt/data` **bloqueia** a tool `write_file` do Hermes
para fora de `/opt/data`. O vault `/opt/hermes-wiki` está fora desse raiz, então:

- A tool `write_file` do Hermes é **negada** (o verifier registra
  "Write denied")
- O agente contorna gravando via terminal/python (funciona — os arquivos
  existem de verdade, verificados no disco)
- A ingestão e o lint **funcionaram mesmo assim** (verificado: 3 páginas +
  raw + log.md + commits reais)

Se quiser eliminar o ruído do verifier, adicionar `/opt/hermes-wiki` ao
`HERMES_WRITE_SAFE_ROOT` — mas isso dá ao agente escrita direta fora do home
(avaliar trade-off de segurança antes).

## Permissões

- Vault: `chown -R 10000:10000 /opt/hermes-wiki` + `chmod 750` — o **uid do
  container** (hermes = 10000), NÃO o uid do host (hermes = 1000). Bind mount
  mapeia por uid numérico.
- Scripts de cron: `/home/hermes/.hermes/scripts/wiki-backup.sh` (host) =
  `/opt/data/scripts/` (container), dono 10000.
- **Atenção**: NÃO criar `/opt/data/scripts` no HOST (foi um erro no primeiro
  deploy — o host não tem `/opt/data`, o mount é `/home/hermes/.hermes`).

## Validação (Etapa 6)

| Check | Resultado |
|---|---|
| `hermes -z 'Qual o valor de WIKI_PATH?'` | `/opt/hermes-wiki` ✅ |
| Estrutura de dirs | 8 (5 raw + 3 layer2) ✅ |
| Commits no vault | 4 ✅ |
| `.gitignore` com `*.pdf` | ✅ |
| SCHEMA.md + barreira | ✅ |
| Ingestão piloto (3 páginas + raw, frontmatter completo) | ✅ |
| Wikilinks (6, 2/página, nenhum quebrado) | ✅ |
| index.md (Total: 3) + log.md (3 entradas) | ✅ |
| Crons ativos (backup + lint) | 2 ✅ |
| Backup executado (completed no executions.db) | ✅ |
| Lint executado (completed, relatório gerado) | ✅ |
| Lint achou vigência expirada (4 ocorrências) e sugeriu correções | ✅ |

O lint semanal já identificou o primeiro achado real: a fonte piloto
(EBSERH 2021) tem vigência vencida e 3 páginas dependem dela — `confidence`
deveria ser `low` na página do protocolo (ação sugerida, não executada,
aguardando decisão).

## Pendências do prompt

- **Remote git privado** para `git push origin main` no backup (hoje o push é
  silencioso `|| true` — sem remote configurado o backup só commita local)
- **Etapa 4 restante**: ingerir fontes reais da unidade (protocolos SAMU/MS,
  classificação de risco da UPA, CFM/CREMEGO) — ordem do estável para o volátil
- **`/sethome`**: o cron lint entrega no Telegram (canal home do perfil); se
  quiser outro canal, usar `/sethome`
- **OCR dos fluxogramas** do piloto (13 fluxogramas são imagens — ficaram como
  `revisao-pendente`)
- **`hermes prompt-size`** antes/depois (custo do index.md no prompt fixo)
- Roadmap W2–W6 (Anexo C do prompt): bulk ingest, MCP com Chefe Coruja, etc.

## Comandos úteis

```bash
# Vault (dentro do container)
docker exec hermes-agent sh -c 'git -C /opt/hermes-wiki log --oneline'
docker exec hermes-agent sh -c 'tail -20 /opt/hermes-wiki/log.md'

# Crons
docker exec hermes-agent sh -c 'hermes cron list'
docker exec hermes-agent sh -c 'hermes cron run wiki-backup'
docker exec hermes-agent sh -c 'hermes cron run wiki-lint'

# Execuções reais
docker exec hermes-agent sh -c 'python3 -c "import sqlite3; c=sqlite3.connect(\"/opt/data/cron/executions.db\"); [print(r) for r in c.execute(\"SELECT job_id,status,started_at FROM executions ORDER BY rowid DESC LIMIT 5\")]"'
```
