# Coruja Lab — skills de terceiros ligadas, em agente isolado

Pedido do RT em 03/10/2026: instalar e **ligar** no Nous as skills
planning-with-files, delegate-skills, caveman, SKILLRET e rtk.

Para funcionarem, essas skills precisam de **terminal e arquivos**. As quatro
Corujas de saúde guardam no ambiente o acesso ao banco de produção; com
terminal, uma mensagem maliciosa no Telegram poderia ler esse acesso. Por isso
elas foram ligadas num **quinto agente isolado**, a Coruja Lab: sem senha do
banco, sem plugin do Chefe Coruja, sem biblioteca, com a IA só pelo gateway.

| Origem | O que entrou (`skills/`) |
|---|---|
| OthmanAdi/planning-with-files | `planning-with-files` (versão para Hermes; sem o plugin de ganchos) |
| amElnagdy/delegate-skills (= skillsllm.com/skill/delegate-skills) | as 18 `*-delegate` e `delegate-setup` |
| JuliusBrussee/caveman | as skills de `skills/`, **menos `caveman-setup`** (troca o provedor de IA por um gateway externo, o que furaria o nosso) |
| rtk-ai/rtk | **o programa `rtk` v0.51.0** (binário oficial, sha256 conferido no `criar-lab.sh`) e o plugin `rtk-rewrite` deles: todo comando do terminal da Lab passa pelo rtk, que encurta a saída (menos tokens de entrada). Telemetria do rtk desligada (padrão). Mais as skills de `.claude/skills` (prefixo `rtk-`) |
| ThakiCloud/SKILLRET | **plugin `lab-skills`**, no papel da SkillRet: índice das skills por categoria e a ferramenta `skill_buscar`, que devolve as mais relevantes para o pedido (BM25 só com Python padrão; os modelos treinados da SkillRet exigem PyTorch/GPU, que o Nous não tem). `skill_categorias` lista o índice |

Observações:
- As `*-delegate` só funcionam com o CLI de cada ferramenta instalado e logado
  no contêiner (claude, codex, cursor…), o que manda texto para essas IAs fora
  do gateway. Não instale esses CLIs sem decisão do RT.
- Licenças originais em `licencas/`.

Instalação (VPS, como root): criar o bot "Coruja Lab" no @BotFather, gravar o
token em `/home/hermes/.agente-lab.token` e rodar `sh criar-lab.sh` nesta pasta.

## Gateway: senha própria da Lab
O `criar-lab.sh` cria `IA_GATEWAY_TOKEN_LAB` no `.env.prod`. O hermes-app reconhece a Lab por essa senha
(origem `lab:telegram`) e, por ela não ter dado do Chefe Coruja, o NER olha só o que a pessoa digita
(a saída do terminal é texto técnico em inglês). Regex, resíduo e pseudônimo continuam em tudo. As outras
Corujas ganham senha própria do mesmo jeito: `IA_GATEWAY_TOKEN_GESTORA` (etc.) no `.env.prod` e
`criar-agente.sh <nome>` de novo.

## Maestro (RT, 03/10/2026)

A Lab passa a ser o **maestro** das quatro Corujas de saúde (corujinha, gestora,
clinica, suporte): olha **só números agregados** e as melhora **propondo skills**
(instruções em texto). O RT aprova no Telegram; um script do host instala.

Ferramentas (plugin `plugins/maestro`, toolset `maestro`, só com `CORUJA_AGENTE=lab`):

| Ferramenta | O que faz |
|---|---|
| `numeros_corujas` | lê `/opt/maestro/numeros/numeros.json` (montado **somente leitura**; gerado fora da Lab de hora em hora em `/home/hermes/.hermes/maestro-saida/` no host) e devolve os dados + resumo: taxa de bloqueio por agente no dia de referência x 7 dias, vigias com falha, idade dos dados (aviso se > 3 h ou se o arquivo faltar) |
| `propor_skill(agente, nome, descricao, conteudo, motivo)` | grava `/opt/data/maestro/propostas/<AAAAMMDD-HHMM-nome>/SKILL.md` + `proposta.json` (status `pendente`) |
| `listar_propostas(status?)` / `ver_proposta(id)` | lista / mostra (com o SKILL.md) |
| `aprovar_proposta(id)` / `rejeitar_proposta(id, motivo)` | muda o status; quem decide vem da **sessão do Telegram** e precisa estar em `MAESTRO_APROVADORES` (o `criar-lab.sh` copia o `TELEGRAM_ALLOWED_USERS` da Corujinha). **Aprovar não instala nada** |

Regras da proposta (recusa com o motivo):
- `agente` ∈ corujinha, gestora, clinica, suporte; `nome` kebab-case `^[a-z0-9-]{3,48}$`;
  `descricao` em uma linha (10–300); `conteudo` markdown sem frontmatter, até 12000; `motivo` 10–1000.
- Nada que pareça **dado pessoal**: CPF, CNS, telefone, e-mail, data completa (use mês/ano).
- Nada que mande usar **ferramenta que as Corujas de saúde não têm** (terminal, file, execute,
  read_file/write_file, shell/bash, skill_manage...).
- **Nenhuma dose**, em agente nenhum (na clínica é a regra central): número + mg, mcg, g, mL, UI, mEq...
  e unidades como mg/kg, mL/h, UI/kg são recusadas. Dose só vem da fonte citada com página.
- Uma proposta pendente por agente/nome; caractere de controle é recusado.

Status: `pendente` → `aprovada` | `rejeitada`; `aprovada` → `aplicada` (no host) | `rejeitada`;
`aplicada` → `removida` (no host). Na aprovação o plugin valida o SKILL.md de novo e guarda o sha256.

**Atenção:** a Lab tem terminal e escreve na própria pasta, então um `proposta.json` "aprovada"
sozinho não prova nada. O `aplicar-propostas.sh` confere de novo (só `SKILL.md` na pasta, tamanho,
`name` = nome, regras de conteúdo, sha256 da aprovação, `aprovada_por` dentro do
`TELEGRAM_ALLOWED_USERS` do `hermes-agent`) e **pede s/N para cada uma**, mostrando o resumo e as
20 primeiras linhas. Leia antes de confirmar: essa é a trava.

Destino da skill instalada: corujinha → `/home/hermes/.hermes/skills/maestro/<nome>/SKILL.md`;
as outras → `/home/hermes/.hermes-<agente>/skills/maestro/<nome>/SKILL.md` (dono da pasta do
agente; o contêiner `hermes-agent` ou `hermes-agent-<agente>` é reiniciado). A Coruja só lê a
skill se tiver o toolset `skills` no Telegram (o script avisa se faltar).

### Passo a passo na VPS (como root)

```sh
# 1. do PC: mandar a pasta (sem .env, sem token)
scp -r hermes/deploy/nous-lab root@<vps>:/home/hermes/deploy/deploy/
# 2. na VPS: recriar a Lab (copia o plugin maestro, liga no config, monta os números :ro)
cd /home/hermes/deploy/deploy/nous-lab && sh criar-lab.sh
docker exec hermes-agent-lab sh -c 'ls /opt/maestro/numeros; test -w /opt/maestro/numeros && echo GRAVAVEL || echo so-leitura'
#    (tem de dar so-leitura; numeros.json aparece quando o gerador de hora em hora estiver no ar)
```

3. No Telegram, no chat da Coruja Lab: `/new`, depois por exemplo "veja os números das corujas e
   proponha uma skill para a gestora responder o resumo do dia em 5 linhas". A Lab responde com o
   `id`. Para revisar: "mostre a proposta <id>". Para decidir: "aprovo a proposta <id>" ou
   "rejeite a proposta <id>: motivo". Só os usuários de `TELEGRAM_ALLOWED_USERS` conseguem.
4. Na VPS, instalar o que foi aprovado (pergunta s/N uma a uma):

```sh
cd /home/hermes/deploy/deploy/nous-lab && sh aplicar-propostas.sh
# desinstalar:
sh aplicar-propostas.sh --remover gestora resumo-do-dia-curto
```

### Resumo diário às 08:00 (cron do Nous com IA)

Não é criado automaticamente. Antes, mande `/sethome` no chat da Coruja Lab (o cron entrega no
canal "home" do Telegram). A Lab roda com `TZ=America/Sao_Paulo`, então `0 8 * * *` é 08:00 de
Brasília. Nome de job não é único: confira `hermes cron list` antes para não duplicar.

```sh
U=$(docker exec hermes-agent-lab stat -c %u:%g /opt/data)
docker exec hermes-agent-lab hermes cron list
docker exec -u "$U" hermes-agent-lab hermes cron create "0 8 * * *" \
  "Chame numeros_corujas e listar_propostas. Mande em PT-BR um resumo curto (até 10 linhas): avisos primeiro (dados velhos, vigias com falha, bloqueio acima do normal), depois a taxa de bloqueio de cada Coruja no dia x 7 dias e as propostas pendentes ou aprovadas esperando instalação. Só números agregados; não aprove nada; se faltar dado, diga que não chegou." \
  --name maestro-resumo-diario --deliver telegram </dev/null
docker exec hermes-agent-lab hermes cron run maestro-resumo-diario   # teste
```

Remover: `docker exec hermes-agent-lab hermes cron list` (pegue o id) e
`docker exec -u "$U" hermes-agent-lab hermes cron remove <id>`.

Testes: `python -m unittest discover -s hermes/deploy/nous-lab/tests -v` (inclui a reescrita do
`config.yaml` num exemplo, feita por `reescrever-config.py`).
