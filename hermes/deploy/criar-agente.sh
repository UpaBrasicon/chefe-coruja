#!/bin/sh
# Cria (ou recria) um agente novo do Nous — um contêiner por agente
# (decisão do RT, 02/10/2026; plano em produto/docs/propostas/migracao-hermes-nous.md).
#
# Uso, NA VPS, como root (a pasta do Nous é do uid do contêiner, 10000):
#   sh criar-agente.sh gestora|clinica|suporte
#
# Antes, uma vez por agente, crie o bot no @BotFather e grave o token em
#   ~/.agente-<nome>.token        (só o token, uma linha; chmod 600)
# O token nunca vai para o chat nem para o git.
#
# O que cada agente recebe:
#   pasta própria ~/.hermes-<nome> (config, SOUL, plugin, sessões separadas);
#   a mesma imagem e o mesmo plugin chefe-coruja da Corujinha;
#   CORUJA_AGENTE=<nome> (o plugin registra só as ferramentas desse agente);
#   o gateway de IA do hermes-app como único provedor (sem chave de IA);
#   HERMES_PG_USER_URL (consultas direto no banco como hermes_app_user).
set -e
umask 077
NOME="$1"
case "$NOME" in gestora|clinica|suporte) ;; *) echo "uso: sh criar-agente.sh gestora|clinica|suporte" >&2; exit 1 ;; esac

BASE=/home/hermes/.hermes
DIR=/home/hermes/.hermes-$NOME
DEPLOY=/home/hermes/deploy
TOKEN_ARQ=/home/hermes/.agente-$NOME.token
[ -s "$TOKEN_ARQ" ] || { echo "falta $TOKEN_ARQ (token do bot do @BotFather)" >&2; exit 1; }
[ -s "$DEPLOY/deploy/SOUL-$NOME.md" ] || { echo "falta $DEPLOY/deploy/SOUL-$NOME.md" >&2; exit 1; }

# 1. pasta do agente: config da Corujinha (já aponta o modelo para o gateway),
#    plugin e SOUL próprio. Sessões, memória e skills NÃO são copiadas.
mkdir -p "$DIR/plugins"
cp "$BASE/config.yaml" "$DIR/config.yaml"
rm -rf "$DIR/plugins/chefe-coruja"
cp -r "$BASE/plugins/chefe-coruja" "$DIR/plugins/chefe-coruja"
cp "$DEPLOY/deploy/SOUL-$NOME.md" "$DIR/SOUL.md"
# .env do Nous sem o token do bot da Corujinha nem chave de provedor de IA
grep -v -E '^(TELEGRAM_BOT_TOKEN|DEEPSEEK_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)=' "$BASE/.env" > "$DIR/.env" || true

# 2. ambiente: o mesmo da Corujinha, trocando bot e agente
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hermes-agent \
  | grep -v -E '^(TZ|TELEGRAM_BOT_TOKEN|CORUJA_AGENTE|HERMES_HOME|DEEPSEEK_API_KEY)=' | grep -v '^$' > "$DIR/.ambiente"
{
  echo "TZ=America/Sao_Paulo"
  echo "TELEGRAM_BOT_TOKEN=$(head -n1 "$TOKEN_ARQ" | tr -d '\r\n ')"
  echo "CORUJA_AGENTE=$NOME"
  echo "DEEPSEEK_API_KEY="
} >> "$DIR/.ambiente"
# senha do gateway própria do agente, se existir (IA_GATEWAY_TOKEN_<NOME> no .env.prod)
MAIUSC=$(echo "$NOME" | tr a-z A-Z)
T=$(grep "^IA_GATEWAY_TOKEN_$MAIUSC=" "$DEPLOY/.env.prod" 2>/dev/null | cut -d= -f2-)
if [ -n "$T" ]; then
  sed -i '/^IA_GATEWAY_TOKEN=/d' "$DIR/.ambiente"; echo "IA_GATEWAY_TOKEN=$T" >> "$DIR/.ambiente"
  sed -i "s|^  api_key: .*|  api_key: $T|" "$DIR/config.yaml"
fi

chown -R --reference="$BASE" "$DIR"   # mesmo dono da pasta da Corujinha (uid do contêiner)
# 3. contêiner
IMG=$(docker inspect -f '{{.Image}}' hermes-agent)
docker rm -f "hermes-agent-$NOME" >/dev/null 2>&1 || true
docker run -d --name "hermes-agent-$NOME" --restart unless-stopped --env-file "$DIR/.ambiente" \
  -v "$DIR:/opt/data" -w /opt/hermes \
  --entrypoint /opt/hermes/docker/entrypoint-dispatch.sh "$IMG" gateway run >/dev/null
docker network connect deploy_default "hermes-agent-$NOME"
echo "hermes-agent-$NOME no ar (CORUJA_AGENTE=$NOME). Mande /new ao bot e teste."
