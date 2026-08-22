#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — SEGURANÇA (Cérbero) — usada pelo Nous via terminal
# Consulta incidentes e quarentena (tabelas do Cérbero) via Supabase REST.
#
# ⚠️ EXCLUSIVO SUPER_ADMIN: quem não for super_admin recebe resposta genérica
#    (guarda no SKILL.md — o agente NUNCA revela a existência do Cérbero).
# ⚠️ Nunca expõe dado de paciente — incidentes citam IDs/títulos, não nomes.
#
# Uso:
#   seguranca.sh incidentes [patrulha] [severidade]
#   seguranca.sh quarentena [status]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"
AUTH="apikey: $SUPABASE_SERVICE_ROLE_KEY"
AUTH2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

comando="${1:?uso: seguranca.sh <incidentes|quarentena> [args...]}"
api() { curl -s "$SUPABASE_URL/rest/v1/$1" -H "$AUTH" -H "$AUTH2"; }

# Cache com TTL (60s)
CACHE_DIR="${TMPDIR:-/tmp}/gaviao-cache"
CACHE_TTL=60
mkdir -p "$CACHE_DIR"

api_cacheada() {
  local chave="$1" url="$2"
  local hash
  hash="$(printf '%s' "$url" | sha256sum | cut -d' ' -f1)"
  local arquivo="$CACHE_DIR/$hash"
  if [ -f "$arquivo" ] && [ $(( $(date +%s) - $(stat -c %Y "$arquivo" 2>/dev/null || echo 0) )) -lt $CACHE_TTL ]; then
    cat "$arquivo"
    return
  fi
  local resposta
  resposta="$(api "$url")"
  printf '%s' "$resposta" > "$arquivo"
  printf '%s' "$resposta"
}

case "$comando" in
  incidentes)
    patrulha="${2:-}"
    severidade="${3:-}"
    filtros="status=in.(aberto,em_analise)"
    [ -n "$patrulha" ] && filtros="$filtros&patrulha=eq.$patrulha"
    [ -n "$severidade" ] && filtros="$filtros&severidade=eq.$severidade"
    api_cacheada "incidentes-$patrulha-$severidade" \
      "cerbero_incidentes?select=id,patrulha,severidade,titulo,status,detectado_em&$filtros&order=detectado_em.desc&limit=25"
    ;;

  quarentena)
    status="${2:-}"
    filtros="liberado=eq.false"
    [ -n "$status" ] && filtros="$filtros&status=eq.$status"
    api_cacheada "quarentena-$status" \
      "cerbero_quarentena?select=id,tipo,origem,motivo,liberado,criado_em&$filtros&order=criado_em.desc&limit=25"
    ;;

  *)
    echo "comando desconhecido: $comando (incidentes|quarentena)" >&2
    exit 1
    ;;
esac
