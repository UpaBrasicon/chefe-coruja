#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Instala o serviço de envio à RNDS no VPS (5C-5.3c). Uma vez, como root.
# Idempotente: rodar de novo não estraga o que já existe.
#
#   - usuário rnds (grupo docker), sem senha e sem login por senha
#   - /home/rnds/deploy: atualizar-rnds.sh, .env.rnds (600, preencher à mão),
#     certificados/ (do usuário do contêiner, uid 1000, 700)
#   - /home/rnds/deploy/cofre/chave.pem: a chave privada do cofre (5.4b), RSA
#     3072, gerada aqui uma vez e nunca substituída por este script: chave nova
#     obriga os gestores a enviar de novo todos os certificados
#   - /home/rnds/logs
#   - cron do root às 04:10 (depois do update-hermes.sh, às 04:00)
#
# Depois: preencher /home/rnds/deploy/.env.rnds e rodar
#   /home/rnds/deploy/atualizar-rnds.sh --forcar
# Passo a passo e reversão em infra/rnds-envio.md.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode como root"; exit 1; }

CLONE=/opt/chefe-coruja
DEPLOY=/home/rnds/deploy

id rnds >/dev/null 2>&1 || useradd --create-home --shell /usr/sbin/nologin rnds
usermod -aG docker rnds
mkdir -p "$DEPLOY/certificados" /home/rnds/logs
chown -R rnds:rnds /home/rnds
# o contêiner roda como o usuário node (uid 1000) e só lê
chown 1000:1000 "$DEPLOY/certificados" && chmod 700 "$DEPLOY/certificados"

mkdir -p "$DEPLOY/cofre"
if [ ! -f "$DEPLOY/cofre/chave.pem" ]; then
  ( umask 077 && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$DEPLOY/cofre/chave.pem" 2>/dev/null )
  echo "chave do cofre gerada em $DEPLOY/cofre/chave.pem (entra no backup do VPS)"
fi
chown -R 1000:1000 "$DEPLOY/cofre" && chmod 700 "$DEPLOY/cofre" && chmod 400 "$DEPLOY/cofre/chave.pem"

git -C "$CLONE" fetch --quiet origin master
git -C "$CLONE" show origin/master:services/rnds-envio/deploy/atualizar-rnds.sh > "$DEPLOY/atualizar-rnds.sh"
chmod 750 "$DEPLOY/atualizar-rnds.sh"

if [ ! -f "$DEPLOY/.env.rnds" ]; then
  umask 077
  cat > "$DEPLOY/.env.rnds" <<'EOF'
# HOMOLOGAÇÃO do Supabase (kswurfyxxvfydpjfrivy). Nunca a produção nesta etapa.
SUPABASE_URL=https://kswurfyxxvfydpjfrivy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
RNDS_INTERVALO_S=60
RNDS_LOTE=20
EOF
  chown root:root "$DEPLOY/.env.rnds"
  echo "preencha SUPABASE_SERVICE_ROLE_KEY em $DEPLOY/.env.rnds"
fi

LINHA="10 4 * * * $DEPLOY/atualizar-rnds.sh >> /home/rnds/logs/atualizar.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'atualizar-rnds.sh' ; echo "CRON_TZ=America/Sao_Paulo" ; echo "$LINHA" ) | awk '!(/^CRON_TZ=/ && seen++)' | crontab -
echo "instalado; cron: $LINHA"
