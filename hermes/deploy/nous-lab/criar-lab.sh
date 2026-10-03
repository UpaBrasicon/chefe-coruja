#!/bin/sh
# Coruja Lab — agente ISOLADO para skills de terceiros com terminal e arquivos
# (pedido do RT em 03/10/2026). Diferente das quatro Corujas de saúde:
#   • sem senha do banco (HERMES_PG_*), sem plugin chefe-coruja, sem biblioteca;
#   • toolsets do Telegram: skills, terminal, file, todo;
#   • a IA continua só pelo gateway do hermes-app (sem chave de provedor).
# Uso, NA VPS, como root:
#   1) token do bot do @BotFather em /home/hermes/.agente-lab.token (chmod 600)
#   2) sh criar-lab.sh            (na pasta onde este arquivo está, com skills/ e SOUL.md)
set -e
umask 077
AQUI="$(cd "$(dirname "$0")" && pwd)"
BASE=/home/hermes/.hermes
DIR=/home/hermes/.hermes-lab
TOKEN_ARQ=/home/hermes/.agente-lab.token
[ -s "$TOKEN_ARQ" ] || { echo "falta $TOKEN_ARQ (token do bot do @BotFather)" >&2; exit 1; }

mkdir -p "$DIR/skills/terceiros"
cp "$BASE/config.yaml" "$DIR/config.yaml"
cp "$AQUI/SOUL.md" "$DIR/SOUL.md"
rm -rf "$DIR/skills/terceiros"; mkdir -p "$DIR/skills/terceiros"
cp -r "$AQUI/skills/." "$DIR/skills/terceiros/"
# sem plugin do Chefe Coruja e sem lista de plugins habilitados
rm -rf "$DIR/plugins"
python3 - "$DIR/config.yaml" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
# Telegram com skills, terminal, arquivos e lista de tarefas
s = re.sub(r"(platform_toolsets:\n(?:  .*\n|    .*\n)*?  telegram:\n)(    - .*\n)+", r"\1    - skills\n    - terminal\n    - file\n    - todo\n", s, count=1)
s = re.sub(r"plugins:\n  enabled:\n(    - .*\n)+", "plugins:\n  enabled: []\n", s, count=1)
open(p, "w").write(s)
print("config: telegram =", re.search(r"  telegram:\n((?:    - .*\n)+)", s).group(1).split())
PY
# .env do Nous sem credenciais do Chefe Coruja nem chaves de IA
grep -v -E '^(TELEGRAM_BOT_TOKEN|DEEPSEEK_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|HERMES_PG_[A-Z_]*|BIBLIOTECA_[A-Z_]*|HERMES_SKILL_TOKEN|HERMES_BACKEND_URL|SUPABASE_[A-Z_]*|CORUJA_[A-Z_]*|VIGIAS_MODO|API_SERVER_KEY)=' "$BASE/.env" > "$DIR/.env" || true

docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hermes-agent \
  | grep -v -E '^(TZ|TELEGRAM_BOT_TOKEN|HERMES_HOME|DEEPSEEK_API_KEY|HERMES_PG_[A-Z_]*|BIBLIOTECA_[A-Z_]*|HERMES_SKILL_TOKEN|HERMES_BACKEND_URL|SUPABASE_[A-Z_]*|CORUJA_[A-Z_]*|VIGIAS_MODO|API_SERVER_KEY)=' \
  | grep -v '^$' > "$DIR/.ambiente"
{
  echo "TZ=America/Sao_Paulo"
  echo "TELEGRAM_BOT_TOKEN=$(head -n1 "$TOKEN_ARQ" | tr -d '\r\n ')"
  echo "CORUJA_AGENTE=lab"
} >> "$DIR/.ambiente"
chown -R --reference="$BASE" "$DIR"

IMG=$(docker inspect -f '{{.Image}}' hermes-agent)
docker rm -f hermes-agent-lab >/dev/null 2>&1 || true
docker run -d --name hermes-agent-lab --restart unless-stopped --env-file "$DIR/.ambiente" \
  -v "$DIR:/opt/data" -w /opt/hermes \
  --entrypoint /opt/hermes/docker/entrypoint-dispatch.sh "$IMG" gateway run >/dev/null
# rede só para alcançar o gateway de IA (hermes-app); não há credencial de banco aqui
docker network connect deploy_default hermes-agent-lab
echo "hermes-agent-lab no ar: $(ls "$DIR/skills/terceiros" | wc -l) skills. Confira: docker exec hermes-agent-lab env | grep -c -E 'HERMES_PG|BIBLIOTECA_API_KEY' (tem de dar 0)"
