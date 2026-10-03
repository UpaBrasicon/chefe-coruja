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
