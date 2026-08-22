#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PICA-PAU (Hefesto) — status de infraestrutura (usada pelo Nous via terminal)
# Consulta o /health do backend e o RLS das tabelas. EXCLUSIVO super_admin.
# NUNCA dado de paciente.
#
# Uso:
#   picapau.sh health
#   picapau.sh rls
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"
AUTH="apikey: $SUPABASE_SERVICE_ROLE_KEY"
AUTH2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

comando="${1:?uso: picapau.sh <health|rls>}"

# Health do backend (Gavião) — via Caddy na porta 80 (exposto publicamente)
BACKEND_URL="${HERMES_BACKEND_URL:-http://localhost/health}"

case "$comando" in
  health)
    # Tenta o backend local; se não alcançável, reporta apenas Supabase
    health=$(curl -s -m 5 "$BACKEND_URL" 2>/dev/null || echo '{"status":"indisponivel"}')
    printf '%s' "$health"
    ;;

  rls)
    # Tabelas do schema public com RLS habilitado (via RPC do backend)
    curl -s "$SUPABASE_URL/rest/v1/rpc/gaviao_painel_admin" \
      -H "$AUTH" -H "$AUTH2" -H 'Content-Type: application/json' -d '{}' \
      2>/dev/null | head -c 500 || echo '{}'
    ;;

  *)
    echo "comando desconhecido: $comando (health|rls)" >&2
    exit 1
    ;;
esac
