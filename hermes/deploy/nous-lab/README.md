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
| rtk-ai/rtk | as skills de `.claude/skills` (prefixo `rtk-`). O programa `rtk` (binário em Rust) **não** foi instalado |
| ThakiCloud/SKILLRET | nada: é um benchmark acadêmico (treino em GPU), não uma skill |

Observações:
- As `*-delegate` só funcionam com o CLI de cada ferramenta instalado e logado
  no contêiner (claude, codex, cursor…), o que manda texto para essas IAs fora
  do gateway. Não instale esses CLIs sem decisão do RT.
- Licenças originais em `licencas/`.

Instalação (VPS, como root): criar o bot "Coruja Lab" no @BotFather, gravar o
token em `/home/hermes/.agente-lab.token` e rodar `sh criar-lab.sh` nesta pasta.
