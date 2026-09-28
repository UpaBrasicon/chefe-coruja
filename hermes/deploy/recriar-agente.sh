#!/bin/sh
# Recria o container hermes-agent (Nous, bot do Telegram) mantendo imagem,
# pastas, porta e variáveis — e com o fuso de Brasília (TZ), sem o qual o bot
# responde a hora em UTC (3 h adiantado). Rodar NA VPS, como hermes.
# Uso: sh recriar-agente.sh            → mesma imagem do container atual
#      sh recriar-agente.sh <imagem>   → troca a imagem (ex.: atualização)
set -e
umask 077
IMG="${1:-$(docker inspect -f '{{.Image}}' hermes-agent)}"
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hermes-agent | grep -v '^TZ=' | grep -v '^$' > ~/.agent.env
echo 'TZ=America/Sao_Paulo' >> ~/.agent.env
# variáveis novas (ex.: BIBLIOTECA_URL/BIBLIOTECA_API_KEY da biblioteca clínica):
# uma por linha em ~/.agent.extra.env (chmod 600, fora da pasta montada no
# container); sobrepõem as atuais.
if [ -f ~/.agent.extra.env ]; then
  for k in $(cut -d= -f1 ~/.agent.extra.env); do grep -v "^$k=" ~/.agent.env > ~/.agent.env.tmp && mv ~/.agent.env.tmp ~/.agent.env; done
  cat ~/.agent.extra.env >> ~/.agent.env
fi
docker stop hermes-agent >/dev/null
docker rename hermes-agent hermes-agent-antigo
docker run -d --name hermes-agent --restart unless-stopped --env-file ~/.agent.env -p 8642:8642 \
  -v /home/hermes/.hermes:/opt/data -v /opt/hermes-wiki:/opt/hermes-wiki -w /opt/hermes \
  --entrypoint /opt/hermes/docker/entrypoint-dispatch.sh "$IMG" gateway run >/dev/null
rm -f ~/.agent.env
# o bot fala com o backend pelo nome hermes-app: precisa da rede do compose
docker network connect deploy_default hermes-agent
echo "novo hermes-agent no ar; confira e depois: docker rm hermes-agent-antigo"
docker exec hermes-agent date
