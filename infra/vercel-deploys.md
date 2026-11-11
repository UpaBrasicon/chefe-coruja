# Deploys do Vercel: só master e homolog

Decisão do RT de 11/11/2026, depois que o limite diário de deploys do Vercel estourou ("Deployment rate limited — retry in 24 hours"). Nesse dia, nem a produção (#568) nem a homologação conseguiram publicar.

## O que cobre

`git.deploymentEnabled` passou de lista do que não publica para lista do que publica:

- **`vercel.json`** (app `chefe-coruja`): `{"**": false, "master": true, "homolog": true}`.
- **`landing/vercel.json`** (site `chefe-coruja-landing`): `{"**": false, "master": true}`.

Pela regra do Vercel, quando um branch casa com mais de uma regra e pelo menos uma é `true`, o deploy acontece. Assim, `master` e `homolog` publicam e todo o resto fica de fora. Antes, cada prefixo novo de branch (`lacunas/`, `humanizer/`, `desempenho/`…) gerava um deploy de prévia a cada push, porque não estava na lista.

## O que não cobre

- Não há mais prévia por branch nem por PR. A conferência de tela é feita na homologação.
- O limite do plano continua o mesmo. Só diminui o que consome o limite.
- O build quebrado continua possível. Depois de cada push na `homolog` ou no `master`, olhe o status "Vercel – chefe-coruja" do commit no GitHub.

## Chaves envolvidas

Nenhuma.

## Como reverter

Volte o `git.deploymentEnabled` dos dois arquivos para a lista anterior (no histórico do git, antes deste PR). Também dá para trocar por `true` para publicar todos os branches.
