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
# plugins: só o rtk-rewrite (comandos do terminal pelo rtk) e o lab-skills
# (organizador das skills); o plugin do Chefe Coruja NÃO entra
rm -rf "$DIR/plugins"; mkdir -p "$DIR/plugins"
cp -r "$AQUI/plugins/rtk-rewrite" "$AQUI/plugins/lab-skills" "$DIR/plugins/"

# rtk (rtk-ai/rtk), binário oficial conferido pelo sha256 da release
RTK_VER=0.51.0
RTK_TGZ=rtk-x86_64-unknown-linux-musl.tar.gz
TMP=$(mktemp -d)
curl -fsSL -o "$TMP/$RTK_TGZ" "https://github.com/rtk-ai/rtk/releases/download/v$RTK_VER/$RTK_TGZ"
curl -fsSL -o "$TMP/checksums.txt" "https://github.com/rtk-ai/rtk/releases/download/v$RTK_VER/checksums.txt"
(cd "$TMP" && grep "$RTK_TGZ" checksums.txt | sha256sum -c -) || { echo "sha256 do rtk não confere: abortado" >&2; rm -rf "$TMP"; exit 1; }
mkdir -p "$DIR/bin" && tar -xzf "$TMP/$RTK_TGZ" -C "$TMP" && cp "$(find "$TMP" -type f -name rtk | head -1)" "$DIR/bin/rtk" && chmod 755 "$DIR/bin/rtk"
rm -rf "$TMP"
echo "rtk $RTK_VER instalado em $DIR/bin (telemetria do rtk: desligada por padrão)"

# senha própria da Lab no gateway (origem lab:telegram; NER só no que a pessoa digita)
ENVP=/home/hermes/deploy/.env.prod
grep -q '^IA_GATEWAY_TOKEN_LAB=' "$ENVP" || { echo "IA_GATEWAY_TOKEN_LAB=$(openssl rand -hex 32)" >> "$ENVP"; echo "IA_GATEWAY_TOKEN_LAB criado no .env.prod: recrie o hermes-app"; }
TLAB=$(grep '^IA_GATEWAY_TOKEN_LAB=' "$ENVP" | cut -d= -f2-)

python3 - "$DIR/config.yaml" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
# Telegram com skills, terminal, arquivos, lista de tarefas e o organizador de skills
s = re.sub(r"(platform_toolsets:\n(?:  .*\n|    .*\n)*?  telegram:\n)(    - .*\n)+", r"\1    - skills\n    - terminal\n    - file\n    - todo\n    - lab-skills\n", s, count=1)
s = re.sub(r"plugins:\n  enabled:\n(    - .*\n)+", "plugins:\n  enabled:\n    - rtk-rewrite\n    - lab-skills\n", s, count=1)
open(p, "w").write(s)
print("config: telegram =", re.search(r"  telegram:\n((?:    - .*\n)+)", s).group(1).split())
PY
# .env do Nous sem credenciais do Chefe Coruja nem chaves de IA
grep -v -E '^(TELEGRAM_BOT_TOKEN|DEEPSEEK_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|HERMES_PG_[A-Z_]*|BIBLIOTECA_[A-Z_]*|HERMES_SKILL_TOKEN|HERMES_BACKEND_URL|SUPABASE_[A-Z_]*|CORUJA_[A-Z_]*|VIGIAS_MODO|API_SERVER_KEY)=' "$BASE/.env" > "$DIR/.env" || true

docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hermes-agent \
  | grep -v -E '^(TZ|TELEGRAM_BOT_TOKEN|HERMES_HOME|IA_GATEWAY_TOKEN|DEEPSEEK_API_KEY|HERMES_PG_[A-Z_]*|BIBLIOTECA_[A-Z_]*|HERMES_SKILL_TOKEN|HERMES_BACKEND_URL|SUPABASE_[A-Z_]*|CORUJA_[A-Z_]*|VIGIAS_MODO|API_SERVER_KEY)=' \
  | grep -v '^$' > "$DIR/.ambiente"
{
  echo "TZ=America/Sao_Paulo"
  echo "TELEGRAM_BOT_TOKEN=$(head -n1 "$TOKEN_ARQ" | tr -d '\r\n ')"
  echo "CORUJA_AGENTE=lab"
  echo "IA_GATEWAY_TOKEN=$TLAB"
} >> "$DIR/.ambiente"
# rtk no PATH do contêiner (o plugin rtk-rewrite procura "rtk" no PATH)
sed -i 's|^PATH=|PATH=/opt/data/bin:|' "$DIR/.ambiente"
sed -i "s|^  api_key: .*|  api_key: $TLAB|" "$DIR/config.yaml"
chown -R --reference="$BASE" "$DIR"

IMG=$(docker inspect -f '{{.Image}}' hermes-agent)
docker rm -f hermes-agent-lab >/dev/null 2>&1 || true
docker run -d --name hermes-agent-lab --restart unless-stopped --env-file "$DIR/.ambiente" \
  -v "$DIR:/opt/data" -w /opt/hermes \
  --entrypoint /opt/hermes/docker/entrypoint-dispatch.sh "$IMG" gateway run >/dev/null
# rede só para alcançar o gateway de IA (hermes-app); não há credencial de banco aqui
docker network connect deploy_default hermes-agent-lab
echo "hermes-agent-lab no ar: $(ls "$DIR/skills/terceiros" | wc -l) skills. Confira: docker exec hermes-agent-lab env | grep -c -E 'HERMES_PG|BIBLIOTECA_API_KEY' (tem de dar 0)"
