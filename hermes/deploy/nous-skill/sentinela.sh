#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — SENTINELA — usada pelo Nous via terminal
# Consulta alertas de escala (Sentinela) e relatório semanal do Gavião.
#
# ⚠️ Visível SOMENTE a gestor/admin da unidade (guarda no SKILL.md).
# ⚠️ Relata fatos e números — nunca especular motivo/caráter do médico.
#
# Uso:
#   sentinela.sh alertas [unidade_id] [status]
#   sentinela.sh relatorio
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"
AUTH="apikey: $SUPABASE_SERVICE_ROLE_KEY"
AUTH2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

comando="${1:?uso: sentinela.sh <alertas|relatorio> [args...]}"
api() { curl -s "$SUPABASE_URL/rest/v1/$1" -H "$AUTH" -H "$AUTH2"; }

CACHE_DIR="${TMPDIR:-/tmp}/gaviao-cache"
CACHE_TTL=300 # 5 min — dados de sentinela mudam pouco
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
  alertas)
    # args: alertas [status] [unidade_id] — status default 'novo'
    status="${2:-novo}"
    unidade="${3:-}"
    filtros="status=eq.$status"
    [ -n "$unidade" ] && filtros="$filtros&unidade_id=eq.$unidade"
    api_cacheada "alertas-sent-$status-$unidade" \
      "chronos_alertas_escala?select=id,unidade_id,medico_id,metrica,valor,mediana_unidade,limite_outlier,status,criado_em&$filtros&order=criado_em.desc&limit=25"
    ;;

  relatorio)
    api_cacheada "relatorio-semanal" \
      "gaviao_relatorios_semanais?select=periodo_inicio,periodo_fim,resumo,gerado_em&order=periodo_inicio.desc&limit=1"
    ;;

  *)
    echo "comando desconhecido: $comando (alertas|relatorio)" >&2
    exit 1
    ;;
esac
